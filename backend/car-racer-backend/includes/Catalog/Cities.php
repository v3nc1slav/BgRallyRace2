<?php

namespace BgRally\Catalog;

final class Cities
{
    public static function active(): array
    {
        global $wpdb;
        $table = Registry::get('cities')->table();
        $rows = $wpdb->get_results("SELECT id, name, lat, lng FROM $table WHERE active = 1 ORDER BY name", ARRAY_A);

        return array_map(fn(array $row) => [
            'id' => (int) $row['id'],
            'name' => Texts::of($row['name']),
            'lat' => (float) $row['lat'],
            'lng' => (float) $row['lng'],
        ], $rows);
    }

    public static function isActive(int $id): bool
    {
        global $wpdb;
        $table = Registry::get('cities')->table();
        return (bool) $wpdb->get_var($wpdb->prepare("SELECT 1 FROM $table WHERE id = %d AND active = 1", $id));
    }
}
