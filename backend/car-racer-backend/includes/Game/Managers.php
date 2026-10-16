<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Database\Tables;
use BgRally\Settings;
use WP_Session_Tokens;

final class Managers
{
    private static function table(): string
    {
        return Tables::name('managers');
    }

    public static function create(int $userId, int $cityId): int
    {
        global $wpdb;

        $wpdb->insert(self::table(), [
            'user_id' => $userId,
            'city_id' => $cityId,
            'level' => 1,
            'energy' => self::energyMax(1),
            'energy_date' => wp_date('Y-m-d'),
            'payroll_week' => Rallies::week(),
            'created_at' => current_time('mysql', true),
        ]);
        $id = (int) $wpdb->insert_id;

        Ledger::add($id, Settings::int('starting_money'), 'start', 'Стартови пари');
        Garage::ensureStarterPack($id);

        return $id;
    }

    public static function find(int $id): ?array
    {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE id = %d', $id), ARRAY_A);
    }

    public static function findByUser(int $userId): ?array
    {
        global $wpdb;
        $cities = Registry::get('cities')->table();

        $query = $wpdb->prepare(
            'SELECT m.*, c.name AS city FROM ' . self::table() . " m LEFT JOIN $cities c ON c.id = m.city_id WHERE m.user_id = %d",
            $userId
        );

        $manager = $wpdb->get_row($query, ARRAY_A);
        if ($manager && $manager['payroll_week'] !== Rallies::week()) {
            Payroll::process($manager);
            $manager = $wpdb->get_row($query, ARRAY_A);
        }

        return $manager ? self::refreshEnergy($manager) : null;
    }

    public static function energyMax(int $level): int
    {
        return Settings::int('energy_base') + ($level - 1) * Settings::int('energy_per_level');
    }

    private static function refreshEnergy(array $manager): array
    {
        global $wpdb;
        $today = wp_date('Y-m-d');

        if ($manager['energy_date'] === $today) {
            return $manager;
        }

        $manager['energy'] = self::energyMax((int) $manager['level']);
        $manager['energy_date'] = $today;
        $wpdb->update(self::table(), ['energy' => $manager['energy'], 'energy_date' => $today], ['id' => $manager['id']]);

        return $manager;
    }

    public static function toApi(array $manager): array
    {
        $level = (int) $manager['level'];

        return [
            'id' => (int) $manager['id'],
            'city_id' => (int) $manager['city_id'],
            'city' => (string) ($manager['city'] ?? ''),
            'money' => (int) $manager['money'],
            'xp' => (int) $manager['xp'],
            'xp_level' => Progress::xpForLevel($level),
            'xp_next' => $level < Progress::MAX_LEVEL ? Progress::xpForLevel($level + 1) : null,
            'level' => $level,
            'garage_level' => (int) $manager['garage_level'],
            'energy' => (int) $manager['energy'],
            'energy_max' => self::energyMax($level),
        ];
    }

    public static function countInCity(int $cityId): int
    {
        global $wpdb;
        return (int) $wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM ' . self::table() . ' WHERE city_id = %d', $cityId));
    }

    /**
     * @return array{0: array[], 1: int}
     */
    public static function search(string $search, int $limit, int $offset): array
    {
        global $wpdb;
        $cities = Registry::get('cities')->table();

        $where = '1=1';
        $args = [];
        if ($search !== '') {
            $like = '%' . $wpdb->esc_like($search) . '%';
            $where = '(u.user_login LIKE %s OR u.user_email LIKE %s)';
            $args = [$like, $like];
        }

        $from = 'FROM ' . self::table() . " m JOIN {$wpdb->users} u ON u.ID = m.user_id LEFT JOIN $cities c ON c.id = m.city_id WHERE $where";

        $countSql = "SELECT COUNT(*) $from";
        $total = (int) $wpdb->get_var($args ? $wpdb->prepare($countSql, ...$args) : $countSql);

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT m.*, u.user_login, u.user_email, c.name AS city $from ORDER BY m.id DESC LIMIT %d OFFSET %d",
            ...[...$args, $limit, $offset]
        ), ARRAY_A);

        return [$rows, $total];
    }

    public static function isBannedUser(int $userId): bool
    {
        global $wpdb;
        return (bool) $wpdb->get_var($wpdb->prepare(
            'SELECT 1 FROM ' . self::table() . ' WHERE user_id = %d AND banned_at IS NOT NULL',
            $userId
        ));
    }

    public static function ban(int $id, string $reason): void
    {
        global $wpdb;
        $manager = self::find($id);
        if (!$manager) {
            return;
        }

        $wpdb->update(self::table(), ['banned_at' => current_time('mysql', true), 'ban_reason' => $reason], ['id' => $id]);
        WP_Session_Tokens::get_instance((int) $manager['user_id'])->destroy_all();
    }

    public static function unban(int $id): void
    {
        global $wpdb;
        $wpdb->update(self::table(), ['banned_at' => null, 'ban_reason' => ''], ['id' => $id]);
    }
}
