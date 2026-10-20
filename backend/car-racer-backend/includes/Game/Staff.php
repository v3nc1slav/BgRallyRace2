<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\Settings;
use WP_Error;

final class Staff
{
    private const STARTING_SKILL = 30;
    private const STARTING_MORALE = 70;
    private const STARTING_REPUTATION = 20;

    private static function table(): string
    {
        return Tables::name('staff');
    }

    public static function salary(string $role, int $skill): int
    {
        return (int) round(Settings::get('salary_' . $role) * (1 + $skill / 50));
    }

    public static function hireStarterCrew(int $managerId): void
    {
        $rows = self::rows($managerId);
        foreach (['pilot', 'navigator'] as $role) {
            if (!isset($rows[$role])) {
                self::add($managerId, $role, Names::person(), self::STARTING_SKILL);
            }
        }
    }

    private static function add(int $managerId, string $role, string $name, int $skill): void
    {
        global $wpdb;
        $wpdb->insert(self::table(), [
            'manager_id' => $managerId,
            'role' => $role,
            'name' => $name,
            'skill' => $skill,
            'morale' => self::STARTING_MORALE,
            'reputation' => self::STARTING_REPUTATION,
            'energy' => $role === 'mechanic' ? Settings::int('mechanic_energy') : 0,
            'energy_date' => wp_date('Y-m-d'),
            'created_at' => current_time('mysql', true),
        ]);
    }

    public static function rows(int $managerId): array
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE manager_id = %d ORDER BY id', $managerId), ARRAY_A);

        $byRole = [];
        foreach ($rows as $row) {
            $byRole[$row['role']] = self::refreshEnergy($row);
        }

        $order = array_flip(array_keys(Labels::ROLES));
        uksort($byRole, fn($a, $b) => ($order[$a] ?? 99) <=> ($order[$b] ?? 99));
        return $byRole;
    }

    public static function member(int $managerId, string $role): ?array
    {
        return self::rows($managerId)[$role] ?? null;
    }

    private static function refreshEnergy(array $row): array
    {
        global $wpdb;
        $today = wp_date('Y-m-d');

        if ($row['role'] !== 'mechanic' || $row['energy_date'] === $today) {
            return $row;
        }

        $row['energy'] = Settings::int('mechanic_energy');
        $row['energy_date'] = $today;
        $wpdb->update(self::table(), ['energy' => $row['energy'], 'energy_date' => $today], ['id' => $row['id']]);
        return $row;
    }

    public static function list(int $managerId): array
    {
        return array_values(array_map(fn(array $row) => [
            'id' => (int) $row['id'],
            'role' => $row['role'],
            'role_label' => Labels::ROLES[$row['role']] ?? $row['role'],
            'name' => $row['name'],
            'skill' => (int) $row['skill'],
            'morale' => in_array($row['role'], ['pilot', 'navigator'], true) ? (int) $row['morale'] : null,
            'reputation' => in_array($row['role'], ['pilot', 'navigator'], true) ? (int) $row['reputation'] : null,
            'physical' => in_array($row['role'], ['pilot', 'navigator'], true) ? (int) $row['physical'] : null,
            'fitness_today' => $row['fitness_date'] === wp_date('Y-m-d'),
            'energy' => $row['role'] === 'mechanic' ? (int) $row['energy'] : null,
            'salary' => self::salary($row['role'], (int) $row['skill']),
            'unpaid' => (bool) $row['unpaid'],
        ], self::rows($managerId)));
    }

    public static function crew(int $managerId): array
    {
        $rows = self::rows($managerId);
        $crew = array_intersect_key($rows, ['pilot' => 1, 'navigator' => 1]);
        $average = fn(string $key, int $default) => $crew
            ? array_sum(array_map(fn($row) => (int) $row[$key], $crew)) / count($crew)
            : $default;

        return [
            'pilot' => ['name' => $rows['pilot']['name'] ?? '—', 'skill' => (int) ($rows['pilot']['skill'] ?? 0)],
            'navigator' => ['name' => $rows['navigator']['name'] ?? '—', 'skill' => (int) ($rows['navigator']['skill'] ?? 0)],
            'morale' => $average('morale', self::STARTING_MORALE),
            'reputation' => $average('reputation', 0),
            'physical' => $average('physical', 0),
            'engineer' => isset($rows['engineer']) ? (int) $rows['engineer']['skill'] : null,
            'chemist' => isset($rows['chemist']) ? (int) $rows['chemist']['skill'] : null,
        ];
    }

    public static function problems(int $managerId): array
    {
        $rows = self::rows($managerId);
        $problems = [];
        if (!isset($rows['pilot'])) {
            $problems[] = 'няма пилот';
        }
        if (!isset($rows['navigator'])) {
            $problems[] = 'няма навигатор';
        }
        return $problems;
    }

    public static function engineerFactor(?int $skill): float
    {
        return $skill === null ? 1 : 1 - (0.01 + 0.02 * $skill / 100);
    }

    public static function chemistTyreFactor(?int $skill): float
    {
        return $skill === null ? 1 : 1 - (0.10 + 0.20 * $skill / 100);
    }

    public static function chemistFuelFactor(int $managerId): float
    {
        $chemist = self::member($managerId, 'chemist');
        return $chemist ? 1 - (0.05 + 0.10 * (int) $chemist['skill'] / 100) : 1;
    }

    public static function mechanicRepairRisk(int $skill): float
    {
        return 20 - 18 * min(100, $skill) / 100;
    }

    public static function spendEnergy(int $staffId, int $amount): bool
    {
        global $wpdb;
        return $wpdb->query($wpdb->prepare(
            'UPDATE ' . self::table() . ' SET energy = energy - %d WHERE id = %d AND energy >= %d',
            $amount,
            $staffId,
            $amount
        )) === 1;
    }

    public static function hire(int $managerId, string $role, string $name, int $skill): ?string
    {
        global $wpdb;
        $current = self::member($managerId, $role);
        if ($current) {
            $wpdb->delete(self::table(), ['id' => $current['id']]);
        }
        self::add($managerId, $role, $name, $skill);
        return $current['name'] ?? null;
    }

    public static function fire(int $managerId, int $staffId): string|WP_Error
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE id = %d AND manager_id = %d', $staffId, $managerId), ARRAY_A);
        if (!$row) {
            return new WP_Error('bgr_staff', 'Няма такъв служител.', ['status' => 404]);
        }

        $wpdb->delete(self::table(), ['id' => $staffId]);
        return sprintf('%s (%s) е освободен.', $row['name'], mb_strtolower(Labels::ROLES[$row['role']] ?? $row['role']));
    }

    public static function improve(int $managerId, int $amount): void
    {
        global $wpdb;
        $wpdb->query($wpdb->prepare(
            'UPDATE ' . self::table() . ' SET skill = LEAST(100, skill + %d) WHERE manager_id = %d',
            $amount,
            $managerId
        ));
    }

    public static function improveRole(int $managerId, string $role, int $amount): void
    {
        global $wpdb;
        $wpdb->query($wpdb->prepare(
            'UPDATE ' . self::table() . ' SET skill = LEAST(100, skill + %d) WHERE manager_id = %d AND role = %s',
            $amount,
            $managerId,
            $role
        ));
    }

    public static function fitness(array $manager, int $staffId): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $row = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE id = %d AND manager_id = %d', $staffId, $managerId), ARRAY_A);

        if (!$row || !in_array($row['role'], ['pilot', 'navigator'], true)) {
            return new WP_Error('bgr_staff', 'Във фитнеса тренират само пилотът и навигаторът.', ['status' => 400]);
        }
        if ($row['fitness_date'] === wp_date('Y-m-d')) {
            return new WP_Error('bgr_fitness', sprintf('%s вече тренира днес.', $row['name']), ['status' => 400]);
        }
        if ((int) $row['physical'] >= 100) {
            return new WP_Error('bgr_fitness', sprintf('%s е в отлична форма.', $row['name']), ['status' => 400]);
        }

        $energy = Settings::int('fitness_energy');
        if (!Energy::spend($managerId, $energy)) {
            return new WP_Error('bgr_energy', sprintf('Нямате достатъчно енергия (нужни са %d).', $energy), ['status' => 400]);
        }
        if (!Ledger::add($managerId, -Settings::int('fitness_price'), 'fitness', $row['name'])) {
            Energy::refund($managerId, $energy);
            return new WP_Error('bgr_money', 'Нямате достатъчно пари.', ['status' => 400]);
        }

        $physical = min(100, (int) $row['physical'] + Settings::int('fitness_gain'));
        $wpdb->update(self::table(), ['physical' => $physical, 'fitness_date' => wp_date('Y-m-d')], ['id' => $staffId]);

        return sprintf('%s тренира във фитнеса. Физически умения: %d.', $row['name'], $physical) . Progress::addDaily($managerId, 'xp_fitness');
    }

    public static function afterRally(int $managerId, int $place, int $classSize, string $status): void
    {
        global $wpdb;
        $third = max(1, intdiv($classSize, 3));

        if ($status !== 'finished') {
            $morale = -10;
            $reputation = 0;
        } else {
            $morale = $place <= $third ? 5 : ($place > $classSize - $third ? -5 : 0);
            $reputation = $place <= 3 ? 3 : ($place <= $classSize / 2 ? 1 : 0);
            self::improve($managerId, 1);
        }

        $wpdb->query($wpdb->prepare(
            'UPDATE ' . self::table() . " SET morale = LEAST(100, GREATEST(0, CAST(morale AS SIGNED) + %d)), reputation = LEAST(100, reputation + %d)
             WHERE manager_id = %d AND role IN ('pilot', 'navigator')",
            $morale,
            $reputation,
            $managerId
        ));
    }

    public static function cheerUp(int $managerId): ?int
    {
        global $wpdb;
        $psychologist = self::member($managerId, 'psychologist');
        if (!$psychologist) {
            return null;
        }

        $amount = (int) round(5 + 10 * (int) $psychologist['skill'] / 100);
        $wpdb->query($wpdb->prepare(
            'UPDATE ' . self::table() . " SET morale = LEAST(100, morale + %d) WHERE manager_id = %d AND role IN ('pilot', 'navigator')",
            $amount,
            $managerId
        ));
        return $amount;
    }
}
