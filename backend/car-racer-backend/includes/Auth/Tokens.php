<?php

namespace BgRally\Auth;

use BgRally\Database\Tables;
use BgRally\Game\Managers;

final class Tokens
{
    private const DAYS = 180;
    private static ?int $current = null;

    public static function register(): void
    {
        add_filter('determine_current_user', [self::class, 'authenticate'], 30);
    }

    private static function table(): string
    {
        return Tables::name('app_tokens');
    }

    private static function fromRequest(): string
    {
        $header = trim((string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? ''));
        if (preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $header, $match)) {
            return strtolower($match[1]);
        }
        $custom = (string) ($_SERVER['HTTP_X_BGR_TOKEN'] ?? '');
        return preg_match('/^[a-f0-9]{64}$/i', $custom) ? strtolower($custom) : '';
    }

    public static function authenticate($userId)
    {
        global $wpdb;
        if ($userId) {
            return $userId;
        }
        $token = self::fromRequest();
        if ($token === '') {
            return $userId;
        }

        $row = $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . self::table() . ' WHERE token_hash = %s AND expires_at > %s',
            hash('sha256', $token),
            gmdate('Y-m-d H:i:s')
        ), ARRAY_A);
        if (!$row || Managers::isBannedUser((int) $row['user_id'])) {
            return $userId;
        }

        self::$current = (int) $row['id'];
        if (!$row['last_used_at'] || strtotime($row['last_used_at'] . ' UTC') < time() - HOUR_IN_SECONDS) {
            $wpdb->update(self::table(), [
                'last_used_at' => gmdate('Y-m-d H:i:s'),
                'expires_at' => gmdate('Y-m-d H:i:s', time() + self::DAYS * DAY_IN_SECONDS),
            ], ['id' => $row['id']]);
        }
        return (int) $row['user_id'];
    }

    public static function issue(int $userId, string $device): string
    {
        global $wpdb;
        $token = bin2hex(random_bytes(32));
        $wpdb->insert(self::table(), [
            'user_id' => $userId,
            'token_hash' => hash('sha256', $token),
            'device' => mb_substr(sanitize_text_field($device), 0, 100),
            'created_at' => gmdate('Y-m-d H:i:s'),
            'expires_at' => gmdate('Y-m-d H:i:s', time() + self::DAYS * DAY_IN_SECONDS),
        ]);
        return $token;
    }

    public static function usingToken(): bool
    {
        return self::$current !== null;
    }

    public static function revokeCurrent(): void
    {
        global $wpdb;
        if (self::$current) {
            $wpdb->delete(self::table(), ['id' => self::$current]);
            self::$current = null;
        }
    }

    public static function revokeAll(int $userId): int
    {
        global $wpdb;
        return (int) $wpdb->delete(self::table(), ['user_id' => $userId]);
    }

    public static function count(int $userId): int
    {
        global $wpdb;
        return (int) $wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM ' . self::table() . ' WHERE user_id = %d AND expires_at > %s', $userId, gmdate('Y-m-d H:i:s')));
    }
}
