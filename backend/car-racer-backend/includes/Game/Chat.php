<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\Settings;
use WP_Error;

final class Chat
{
    public const WORDS_OPTION = 'bgr_bad_words';

    public static function table(): string
    {
        return Tables::name('messages');
    }

    public static function mutedUntil(array $manager): ?string
    {
        $until = $manager['muted_until'] ?? null;
        return $until && strtotime($until) > Rallies::now() ? str_replace(' ', 'T', $until) : null;
    }

    public static function filter(string $text): string
    {
        $words = array_filter(array_map('trim', preg_split('/[\r\n,]+/u', (string) get_option(self::WORDS_OPTION, ''))));
        foreach ($words as $word) {
            $text = preg_replace('/' . preg_quote($word, '/') . '/iu', '***', $text);
        }
        return $text;
    }

    public static function prepare(array $manager, string $text, int $max): string|WP_Error
    {
        global $wpdb;

        if (self::mutedUntil($manager)) {
            return new WP_Error('bgr_muted', sprintf('Заглушен си до %s.', mysql2date('d.m.Y H:i', $manager['muted_until'])), ['status' => 403]);
        }
        $text = trim(preg_replace("/\n{3,}/u", "\n\n", str_replace("\r", '', wp_strip_all_tags($text, false))));
        if ($text === '') {
            return new WP_Error('bgr_empty', 'Напиши съобщение.', ['status' => 400]);
        }
        if (mb_strlen($text) > $max) {
            return new WP_Error('bgr_long', sprintf('Съобщението е до %d знака.', $max), ['status' => 400]);
        }
        $last = $wpdb->get_var($wpdb->prepare('SELECT created_at FROM ' . self::table() . ' WHERE manager_id = %d ORDER BY id DESC LIMIT 1', $manager['id']));
        if ($last && Rallies::now() - strtotime($last) < Settings::int('chat_cooldown')) {
            return new WP_Error('bgr_slow', 'Изчакай няколко секунди преди следващото съобщение.', ['status' => 429]);
        }

        return self::filter($text);
    }

    public static function insert(int $managerId, string $channel, string $text): int
    {
        global $wpdb;
        $wpdb->insert(self::table(), [
            'channel' => $channel,
            'manager_id' => $managerId,
            'text' => $text,
            'created_at' => current_time('mysql'),
        ]);
        return (int) $wpdb->insert_id;
    }

    public static function rows(string $channel, int $afterId, int $limit, int $offset = 0, bool $newest = false): array
    {
        global $wpdb;
        $messages = self::table();
        $managers = Tables::name('managers');

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT msg.id, msg.manager_id, msg.text, msg.created_at, u.display_name AS author
             FROM $messages msg
             JOIN $managers m ON m.id = msg.manager_id
             LEFT JOIN {$wpdb->users} u ON u.ID = m.user_id
             WHERE msg.channel = %s AND msg.deleted = 0 AND msg.id > %d
             ORDER BY msg.id " . ($newest ? 'DESC' : 'ASC') . ' LIMIT %d OFFSET %d',
            $channel,
            $afterId,
            $limit,
            $offset
        ), ARRAY_A);

        return $newest ? array_reverse($rows) : $rows;
    }

    public static function present(array $rows, int $viewerId): array
    {
        return array_map(fn($row) => [
            'id' => (int) $row['id'],
            'author' => $row['author'] ?: 'Отбор',
            'own' => (int) $row['manager_id'] === $viewerId,
            'text' => $row['text'],
            'at' => str_replace(' ', 'T', $row['created_at']),
        ], $rows);
    }

    private static function channel(array $manager): string
    {
        return 'city-' . (int) $manager['city_id'];
    }

    public static function view(array $manager, int $after = 0): array
    {
        $channel = self::channel($manager);
        $rows = $after ? self::rows($channel, $after, 100) : self::rows($channel, 0, Settings::int('chat_keep'), 0, true);

        return [
            'messages' => self::present($rows, (int) $manager['id']),
            'muted_until' => self::mutedUntil($manager),
            'max_length' => Settings::int('chat_length'),
        ];
    }

    public static function say(array $manager, string $text): true|WP_Error
    {
        global $wpdb;
        $text = self::prepare($manager, $text, Settings::int('chat_length'));
        if (is_wp_error($text)) {
            return $text;
        }

        $channel = self::channel($manager);
        self::insert((int) $manager['id'], $channel, $text);

        $edge = $wpdb->get_var($wpdb->prepare(
            'SELECT id FROM ' . self::table() . ' WHERE channel = %s ORDER BY id DESC LIMIT 1 OFFSET %d',
            $channel,
            max(0, Settings::int('chat_keep') - 1)
        ));
        if ($edge) {
            $wpdb->query($wpdb->prepare('DELETE FROM ' . self::table() . ' WHERE channel = %s AND id < %d AND reports = 0', $channel, $edge));
        }
        return true;
    }

    public static function report(array $manager, int $messageId): string|WP_Error
    {
        global $wpdb;
        $updated = $wpdb->query($wpdb->prepare(
            'UPDATE ' . self::table() . ' SET reports = reports + 1 WHERE id = %d AND deleted = 0 AND manager_id <> %d',
            $messageId,
            $manager['id']
        ));
        return $updated ? 'Съобщението е докладвано на админа.' : new WP_Error('bgr_not_found', 'Няма такова съобщение.', ['status' => 404]);
    }
}
