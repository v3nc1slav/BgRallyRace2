<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Database\Tables;
use BgRally\Frontend;
use WP_Error;

final class Push
{
    public const OPTION = 'bgr_push';
    public const TYPES = [
        'rally_start' => 'Ралито ми започва след 30 минути',
        'results' => 'Резултатите от ралито са публикувани',
        'sabotage' => 'Информаторът предупреждава за саботаж',
        'loan' => 'Неплатена вноска по заема',
        'market' => 'Обявата ми на пазара е продадена',
    ];
    private const REMIND_MINUTES = 30;
    private static bool $pending = false;

    public static function register(): void
    {
        add_action('shutdown', [self::class, 'shutdown']);
    }

    private static function devices(): string
    {
        return Tables::name('push_devices');
    }

    private static function queue(): string
    {
        return Tables::name('push_queue');
    }

    public static function config(): array
    {
        $config = (array) get_option(self::OPTION, []);
        $account = json_decode((string) ($config['service_account'] ?? ''), true);
        $valid = is_array($account) && !empty($account['client_email']) && !empty($account['private_key']) && !empty($account['project_id']);

        return [
            'account' => $valid ? $account : null,
            'web' => [
                'apiKey' => (string) ($config['api_key'] ?? ''),
                'messagingSenderId' => (string) ($config['sender_id'] ?? ''),
                'appId' => (string) ($config['app_id'] ?? ''),
                'vapidKey' => (string) ($config['vapid_key'] ?? ''),
                'projectId' => $valid ? (string) $account['project_id'] : '',
            ],
        ];
    }

    public static function enabled(): bool
    {
        return self::config()['account'] !== null;
    }

    private static function webConfig(): ?array
    {
        $config = self::config();
        return $config['account'] && !in_array('', $config['web'], true) ? $config['web'] : null;
    }

    private static function off(array $manager): array
    {
        return array_filter(explode(',', (string) ($manager['notify_off'] ?? '')));
    }

    public static function link(string $route): string
    {
        return Frontend::gameUrl() . '#/' . ltrim($route, '/');
    }

    public static function notify(int $managerId, string $type, string $title, string $body, string $route = ''): void
    {
        global $wpdb;
        if (!self::enabled() || !isset(self::TYPES[$type])) {
            return;
        }
        $manager = Managers::find($managerId);
        if (!$manager || in_array($type, self::off($manager), true) || !self::deviceCount((int) $manager['user_id'])) {
            return;
        }

        $wpdb->insert(self::queue(), [
            'user_id' => (int) $manager['user_id'],
            'type' => $type,
            'title' => mb_strimwidth($title, 0, 150, '…'),
            'body' => mb_strimwidth($body, 0, 255, '…'),
            'url' => $route !== '' ? self::link($route) : '',
            'created_at' => current_time('mysql'),
        ]);
        self::$pending = true;
    }

    public static function shutdown(): void
    {
        if (!self::$pending) {
            return;
        }
        self::$pending = false;
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
        self::flush();
    }

    public static function flush(int $limit = 50): void
    {
        global $wpdb;
        if (!self::enabled()) {
            return;
        }
        $rows = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . self::queue() . ' ORDER BY id LIMIT %d', $limit), ARRAY_A);
        foreach ($rows as $row) {
            if ($wpdb->delete(self::queue(), ['id' => $row['id']])) {
                self::deliver($row);
            }
        }
    }

    private static function deliver(array $row): int
    {
        global $wpdb;
        $sent = 0;
        $devices = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . self::devices() . ' WHERE user_id = %d', $row['user_id']), ARRAY_A);
        foreach ($devices as $device) {
            $result = self::send($device, $row);
            if ($result === 'invalid') {
                $wpdb->delete(self::devices(), ['id' => $device['id']]);
            }
            $sent += $result === 'ok' ? 1 : 0;
        }
        return $sent;
    }

    private static function message(array $device, array $row): array
    {
        $link = $row['url'] !== '' ? $row['url'] : Frontend::gameUrl();
        return ['message' => [
            'token' => $device['token'],
            'notification' => ['title' => $row['title'], 'body' => $row['body']],
            'data' => ['url' => $link, 'type' => (string) $row['type']],
            'webpush' => [
                'fcm_options' => ['link' => $link],
                'notification' => ['icon' => plugins_url('assets/icon-192.png', BGR_FILE)],
            ],
            'android' => ['notification' => ['color' => '#e63946']],
        ]];
    }

    private static function send(array $device, array $row): string
    {
        $message = self::message($device, $row);
        $override = apply_filters('bgrally_push_send', null, $message, $device);
        if ($override !== null) {
            return (string) $override;
        }

        $config = self::config();
        $token = self::accessToken();
        if (!$token || !$config['account']) {
            return 'error';
        }
        $response = wp_remote_post('https://fcm.googleapis.com/v1/projects/' . rawurlencode($config['account']['project_id']) . '/messages:send', [
            'timeout' => 10,
            'headers' => ['Authorization' => 'Bearer ' . $token, 'Content-Type' => 'application/json'],
            'body' => wp_json_encode($message),
        ]);
        if (is_wp_error($response)) {
            return 'error';
        }
        $code = (int) wp_remote_retrieve_response_code($response);
        if ($code === 200) {
            return 'ok';
        }
        $body = (string) wp_remote_retrieve_body($response);
        return $code === 404 || str_contains($body, 'UNREGISTERED') ? 'invalid' : 'error';
    }

    private static function base64url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function accessToken(): ?string
    {
        $cached = get_transient('bgr_fcm_token');
        if ($cached) {
            return (string) $cached;
        }
        $account = self::config()['account'];
        if (!$account) {
            return null;
        }

        $now = time();
        $unsigned = self::base64url((string) wp_json_encode(['alg' => 'RS256', 'typ' => 'JWT'])) . '.' . self::base64url((string) wp_json_encode([
            'iss' => $account['client_email'],
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + HOUR_IN_SECONDS,
        ]));
        if (!openssl_sign($unsigned, $signature, (string) $account['private_key'], OPENSSL_ALGO_SHA256)) {
            return null;
        }

        $response = wp_remote_post('https://oauth2.googleapis.com/token', [
            'timeout' => 10,
            'body' => ['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $unsigned . '.' . self::base64url($signature)],
        ]);
        $data = is_wp_error($response) ? null : json_decode((string) wp_remote_retrieve_body($response), true);
        if (empty($data['access_token'])) {
            return null;
        }
        set_transient('bgr_fcm_token', $data['access_token'], max(MINUTE_IN_SECONDS, (int) ($data['expires_in'] ?? HOUR_IN_SECONDS) - 5 * MINUTE_IN_SECONDS));
        return (string) $data['access_token'];
    }

    public static function deviceCount(int $userId): int
    {
        global $wpdb;
        return (int) $wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM ' . self::devices() . ' WHERE user_id = %d', $userId));
    }

    public static function addDevice(int $userId, string $token, string $platform): true|WP_Error
    {
        global $wpdb;
        $token = trim($token);
        if (!preg_match('/^[A-Za-z0-9_:\-]{20,255}$/', $token)) {
            return new WP_Error('bgr_push', 'Невалиден адрес за известия.', ['status' => 400]);
        }
        $wpdb->delete(self::devices(), ['token' => $token]);
        $wpdb->insert(self::devices(), [
            'user_id' => $userId,
            'token' => $token,
            'platform' => $platform === 'app' ? 'app' : 'web',
            'created_at' => current_time('mysql'),
        ]);
        return true;
    }

    public static function removeDevice(int $userId, string $token): void
    {
        global $wpdb;
        $wpdb->delete(self::devices(), ['user_id' => $userId, 'token' => trim($token)]);
    }

    public static function setPreferences(array $manager, array $on): void
    {
        global $wpdb;
        $off = array_values(array_diff(array_keys(self::TYPES), array_map('strval', $on)));
        $wpdb->update(Tables::name('managers'), ['notify_off' => implode(',', $off)], ['id' => $manager['id']]);
    }

    public static function view(array $manager): array
    {
        $off = self::off($manager);
        return [
            'enabled' => self::enabled(),
            'web' => self::webConfig(),
            'devices' => self::deviceCount((int) $manager['user_id']),
            'types' => array_map(
                fn($key, $label) => ['key' => $key, 'label' => $label, 'on' => !in_array($key, $off, true)],
                array_keys(self::TYPES),
                self::TYPES
            ),
        ];
    }

    public static function test(int $userId): int
    {
        return self::deliver([
            'user_id' => $userId,
            'type' => 'test',
            'title' => 'BG Rally',
            'body' => 'Пробно известие – всичко работи.',
            'url' => '',
        ]);
    }

    public static function reminders(): void
    {
        global $wpdb;
        if (!self::enabled()) {
            return;
        }
        $now = Rallies::now();
        $rallies = $wpdb->get_results($wpdb->prepare(
            'SELECT id, name FROM ' . Registry::get('rallies')->table() . " WHERE status = 'scheduled' AND start_at > %s AND start_at <= %s",
            date('Y-m-d H:i:s', $now),
            date('Y-m-d H:i:s', $now + self::REMIND_MINUTES * MINUTE_IN_SECONDS)
        ), ARRAY_A);

        foreach ($rallies as $rally) {
            $key = 'bgr_push_start_' . $rally['id'];
            if (get_transient($key)) {
                continue;
            }
            set_transient($key, 1, 2 * DAY_IN_SECONDS);
            $managers = $wpdb->get_col($wpdb->prepare('SELECT manager_id FROM ' . Tables::name('entries') . ' WHERE rally_id = %d AND manager_id > 0', $rally['id']));
            foreach ($managers as $managerId) {
                self::notify((int) $managerId, 'rally_start', $rally['name'], 'Ралито започва до 30 минути. Провери колата и стила за етапите.', 'rallies/' . $rally['id']);
            }
        }
    }
}
