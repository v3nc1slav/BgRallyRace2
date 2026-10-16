<?php

namespace BgRally\Game;

use BgRally\Database\Tables;

final class Inbox
{
    public static function add(int $managerId, string $text): void
    {
        global $wpdb;
        $wpdb->insert(Tables::name('inbox'), [
            'manager_id' => $managerId,
            'text' => mb_substr($text, 0, 255),
            'created_at' => current_time('mysql'),
        ]);
    }

    public static function latest(int $managerId, int $limit = 15): array
    {
        global $wpdb;
        $table = Tables::name('inbox');
        $rows = $wpdb->get_results($wpdb->prepare("SELECT text, created_at FROM $table WHERE manager_id = %d ORDER BY id DESC LIMIT %d", $managerId, $limit), ARRAY_A);

        return array_map(fn($row) => ['text' => $row['text'], 'at' => str_replace(' ', 'T', $row['created_at'])], $rows);
    }
}
