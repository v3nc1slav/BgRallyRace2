<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\Settings;
use WP_Error;

final class Bar
{
    private static function table(): string
    {
        return Tables::name('candidates');
    }

    public static function candidates(int $cityId): array
    {
        global $wpdb;
        $week = Rallies::week();
        $query = $wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE city_id = %d AND week = %s ORDER BY role, skill DESC', $cityId, $week);

        $rows = $wpdb->get_results($query, ARRAY_A);
        $flag = "bgr_bar_{$cityId}_{$week}";
        if ($rows || get_transient($flag)) {
            return $rows;
        }

        set_transient($flag, 1, WEEK_IN_SECONDS);
        $wpdb->query($wpdb->prepare('DELETE FROM ' . self::table() . ' WHERE city_id = %d AND week <> %s', $cityId, $week));

        foreach (array_keys(Labels::ROLES) as $role) {
            for ($i = 0; $i < Settings::int('candidates_per_role'); $i++) {
                $talent = mt_rand(1, 100) <= 20 ? mt_rand(10, 35) : 0;
                $wpdb->insert(self::table(), [
                    'city_id' => $cityId,
                    'week' => $week,
                    'role' => $role,
                    'name' => Names::person(),
                    'skill' => min(95, mt_rand(15, 50) + $talent),
                    'created_at' => current_time('mysql', true),
                ]);
            }
        }

        return $wpdb->get_results($query, ARRAY_A);
    }

    public static function view(array $manager): array
    {
        $level = (int) $manager['garage_level'];
        $unlocked = GarageLevels::rolesUnlocked($level);
        $current = Staff::rows((int) $manager['id']);
        $candidates = self::candidates((int) $manager['city_id']);

        $roles = [];
        foreach (Labels::ROLES as $role => $label) {
            $member = $current[$role] ?? null;
            $roles[] = [
                'role' => $role,
                'label' => $label,
                'unlocked' => in_array($role, $unlocked, true),
                'unlock_level' => GarageLevels::levelForRole($role),
                'current' => $member ? [
                    'name' => $member['name'],
                    'skill' => (int) $member['skill'],
                    'salary' => Staff::salary($role, (int) $member['skill']),
                ] : null,
                'candidates' => array_values(array_map(fn($row) => [
                    'id' => (int) $row['id'],
                    'name' => $row['name'],
                    'skill' => (int) $row['skill'],
                    'salary' => Staff::salary($role, (int) $row['skill']),
                ], array_filter($candidates, fn($row) => $row['role'] === $role))),
            ];
        }

        return ['city' => $manager['city'] ?? '', 'roles' => $roles];
    }

    public static function hire(array $manager, int $candidateId): string|WP_Error
    {
        global $wpdb;
        $candidate = $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . self::table() . ' WHERE id = %d AND city_id = %d AND week = %s',
            $candidateId,
            $manager['city_id'],
            Rallies::week()
        ), ARRAY_A);

        if (!$candidate) {
            return new WP_Error('bgr_candidate', 'Кандидатът вече не е в бара.', ['status' => 404]);
        }

        $role = $candidate['role'];
        if (!in_array($role, GarageLevels::rolesUnlocked((int) $manager['garage_level']), true)) {
            return new WP_Error('bgr_locked', sprintf('%s се отключва с гараж ниво %d.', Labels::ROLES[$role], GarageLevels::levelForRole($role)), ['status' => 400]);
        }

        if ($wpdb->query($wpdb->prepare('DELETE FROM ' . self::table() . ' WHERE id = %d', $candidateId)) !== 1) {
            return new WP_Error('bgr_candidate', 'Кандидатът вече не е в бара.', ['status' => 404]);
        }

        $replaced = Staff::hire((int) $manager['id'], $role, $candidate['name'], (int) $candidate['skill']);
        $message = sprintf(
            'Нае %s за %s. Заплатата е %d € на седмица.',
            $candidate['name'],
            mb_strtolower(Labels::ROLES[$role]),
            Staff::salary($role, (int) $candidate['skill'])
        );

        return $replaced ? $message . sprintf(' %s напусна.', $replaced) : $message;
    }
}
