<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Database\Tables;

final class Bots
{
    private const SKILL = [3 => [20, 45], 2 => [35, 65], 1 => [50, 80]];

    public static function pick(int $rallyId, string $class, int $count): array
    {
        global $wpdb;
        $bots = Tables::name('bots');
        $entries = Tables::name('entries');

        if ($count <= 0) {
            return [];
        }

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT * FROM $bots WHERE class = %s AND id NOT IN (SELECT bot_id FROM $entries WHERE rally_id = %d) ORDER BY RAND() LIMIT %d",
            $class,
            $rallyId,
            $count
        ), ARRAY_A);

        while (count($rows) < $count) {
            $bot = self::create($class);
            if (!$bot) {
                break;
            }
            $rows[] = $bot;
        }

        return $rows;
    }

    private static function create(string $class): ?array
    {
        global $wpdb;
        $cars = Registry::get('cars')->table();

        $carId = (int) $wpdb->get_var($wpdb->prepare("SELECT id FROM $cars WHERE active = 1 AND class = %s ORDER BY RAND() LIMIT 1", $class));
        if (!$carId) {
            return null;
        }

        [$min, $max] = self::SKILL[(int) $class] ?? [30, 60];
        $bot = [
            'name' => Names::person(),
            'class' => $class,
            'car_id' => $carId,
            'skill' => mt_rand($min, $max),
            'nav_skill' => mt_rand($min, $max),
            'created_at' => current_time('mysql', true),
        ];

        $wpdb->insert(Tables::name('bots'), $bot);
        return ['id' => (int) $wpdb->insert_id] + $bot;
    }
}
