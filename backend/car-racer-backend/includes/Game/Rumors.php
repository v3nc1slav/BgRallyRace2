<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\I18n;

final class Rumors
{
    private const KEEP = 50;

    private static function table(): string
    {
        return Tables::name('rumors');
    }

    public static function add(int $cityId, string $key, array $params = []): void
    {
        global $wpdb;
        $wpdb->insert(self::table(), [
            'city_id' => $cityId,
            'named' => I18n::encode(I18n::msg('server.rumors.' . $key, $params)),
            'anon' => I18n::encode(I18n::msg('server.rumors.' . $key . 'Anon', $params)),
            'created_at' => current_time('mysql'),
        ]);

        $edge = $wpdb->get_var($wpdb->prepare('SELECT id FROM ' . self::table() . ' WHERE city_id = %d ORDER BY id DESC LIMIT 1 OFFSET %d', $cityId, self::KEEP - 1));
        if ($edge) {
            $wpdb->query($wpdb->prepare('DELETE FROM ' . self::table() . ' WHERE city_id = %d AND id < %d', $cityId, $edge));
        }
    }

    public static function about(int $managerId, string $key, array $params = []): void
    {
        $manager = Managers::find($managerId);
        if ($manager) {
            self::add((int) $manager['city_id'], $key, $params + ['team' => Managers::name($managerId)]);
        }
    }

    public static function forCity(int $cityId, bool $named, int $limit = 10): array
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare('SELECT named, anon, created_at FROM ' . self::table() . ' WHERE city_id = %d ORDER BY id DESC LIMIT %d', $cityId, $limit), ARRAY_A);

        return array_map(fn($row) => [
            'text' => I18n::render($named ? $row['named'] : $row['anon']),
            'at' => str_replace(' ', 'T', $row['created_at']),
        ], $rows);
    }
}
