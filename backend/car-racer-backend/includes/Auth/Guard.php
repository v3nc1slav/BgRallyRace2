<?php

namespace BgRally\Auth;

use BgRally\Database\Tables;
use BgRally\I18n;
use BgRally\Settings;
use WP_Error;
use WP_User;

final class Guard
{
    private const KEEP_HOURS = 24;

    public static function register(): void
    {
        add_filter('authenticate', [self::class, 'check'], 90, 2);
        add_action('wp_login_failed', [self::class, 'failed'], 10, 2);
        add_filter('xmlrpc_enabled', '__return_false');
        add_filter('xmlrpc_methods', fn() => []);
        add_filter('wp_headers', [self::class, 'headers']);
        add_filter('rest_endpoints', [self::class, 'endpoints']);
        add_filter('oembed_response_data', [self::class, 'oembed']);
        add_filter('wp_sitemaps_add_provider', fn($provider, string $name) => $name === 'users' ? false : $provider, 10, 2);
        add_action('template_redirect', [self::class, 'authors'], 1);
    }

    private static function table(): string
    {
        return Tables::name('guard');
    }

    public static function ip(): string
    {
        $header = match (Settings::int('guard_proxy')) {
            1 => 'HTTP_CF_CONNECTING_IP',
            2 => 'HTTP_X_FORWARDED_FOR',
            default => '',
        };
        if ($header !== '' && !empty($_SERVER[$header])) {
            $candidate = trim(explode(',', (string) $_SERVER[$header])[0]);
            if (filter_var($candidate, FILTER_VALIDATE_IP)) {
                return $candidate;
            }
        }
        $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        return filter_var($remote, FILTER_VALIDATE_IP) ? $remote : '0.0.0.0';
    }

    private static function exempt(): bool
    {
        return wp_get_environment_type() === 'local' && Settings::int('guard_local') === 1 && in_array(self::ip(), ['127.0.0.1', '::1'], true);
    }

    private static function login(?string $username): string
    {
        return mb_substr(mb_strtolower(trim((string) $username)), 0, 60);
    }

    public static function check($user, $username)
    {
        if (self::exempt()) {
            return $user;
        }
        $login = self::login($username);
        $wait = self::wait(self::ip(), $login);
        if ($wait > 0) {
            return new WP_Error('bgr_locked', I18n::t('server.auth.locked', ['count' => (int) ceil($wait / 60)]), ['status' => 429]);
        }
        if ($user instanceof WP_User) {
            self::clear(self::ip(), $login);
        }
        return $user;
    }

    public static function failed($username, $error = null): void
    {
        if (self::exempt() || ($error instanceof WP_Error && in_array($error->get_error_code(), ['bgr_locked', 'bgr_banned'], true))) {
            return;
        }
        self::record('login', self::login($username));
    }

    public static function wait(string $ip, string $login): int
    {
        return max(
            self::lock($ip, $login, Settings::int('guard_login_attempts'), Settings::int('guard_login_minutes')),
            self::lock($ip, null, Settings::int('guard_ip_attempts'), Settings::int('guard_ip_minutes'))
        );
    }

    private static function lock(string $ip, ?string $login, int $limit, int $minutes): int
    {
        global $wpdb;
        if ($limit <= 0 || $minutes <= 0) {
            return 0;
        }
        $where = $login === null ? '' : $wpdb->prepare(' AND login = %s', $login);
        $times = $wpdb->get_col($wpdb->prepare(
            'SELECT created_at FROM ' . self::table() . " WHERE kind = 'login' AND ip = %s$where AND created_at > %s ORDER BY id DESC LIMIT %d",
            $ip,
            gmdate('Y-m-d H:i:s', time() - 2 * $minutes * MINUTE_IN_SECONDS),
            $limit
        ));
        if (count($times) < $limit) {
            return 0;
        }
        $newest = strtotime($times[0] . ' UTC');
        $oldest = strtotime(end($times) . ' UTC');
        if ($newest - $oldest > $minutes * MINUTE_IN_SECONDS) {
            return 0;
        }
        return max(0, $newest + $minutes * MINUTE_IN_SECONDS - time());
    }

    public static function registration(): ?WP_Error
    {
        global $wpdb;
        $limit = Settings::int('guard_register_limit');
        if (self::exempt() || $limit <= 0) {
            return null;
        }
        $count = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT COUNT(*) FROM ' . self::table() . " WHERE kind = 'register' AND ip = %s AND created_at > %s",
            self::ip(),
            gmdate('Y-m-d H:i:s', time() - HOUR_IN_SECONDS)
        ));
        return $count >= $limit ? new WP_Error('bgr_register_limit', I18n::t('server.auth.registerLimit'), ['status' => 429]) : null;
    }

    public static function registered(): void
    {
        if (!self::exempt()) {
            self::record('register', '');
        }
    }

    private static function record(string $kind, string $login): void
    {
        global $wpdb;
        $wpdb->insert(self::table(), ['kind' => $kind, 'ip' => self::ip(), 'login' => $login, 'created_at' => gmdate('Y-m-d H:i:s')]);
    }

    public static function clear(string $ip, ?string $login = null): void
    {
        global $wpdb;
        $where = ['kind' => 'login', 'ip' => $ip];
        if ($login !== null) {
            $where['login'] = $login;
        }
        $wpdb->delete(self::table(), $where);
    }

    public static function purge(): void
    {
        global $wpdb;
        $wpdb->query($wpdb->prepare('DELETE FROM ' . self::table() . ' WHERE created_at < %s', gmdate('Y-m-d H:i:s', time() - self::KEEP_HOURS * HOUR_IN_SECONDS)));
    }

    public static function locks(): array
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT ip, login FROM ' . self::table() . " WHERE kind = 'login' AND created_at > %s GROUP BY ip, login",
            gmdate('Y-m-d H:i:s', time() - 2 * max(Settings::int('guard_login_minutes'), Settings::int('guard_ip_minutes')) * MINUTE_IN_SECONDS)
        ), ARRAY_A);

        $locks = [];
        foreach ($rows as $row) {
            $ip = (string) $row['ip'];
            if (!isset($locks[$ip . '|'])) {
                $wait = self::lock($ip, null, Settings::int('guard_ip_attempts'), Settings::int('guard_ip_minutes'));
                if ($wait > 0) {
                    $locks[$ip . '|'] = ['ip' => $ip, 'login' => null, 'until' => time() + $wait];
                }
            }
            $wait = self::lock($ip, (string) $row['login'], Settings::int('guard_login_attempts'), Settings::int('guard_login_minutes'));
            if ($wait > 0) {
                $locks[$ip . '|' . $row['login']] = ['ip' => $ip, 'login' => (string) $row['login'], 'until' => time() + $wait];
            }
        }
        return array_values($locks);
    }

    public static function headers(array $headers): array
    {
        unset($headers['X-Pingback']);
        return $headers;
    }

    public static function endpoints(array $endpoints): array
    {
        if (!current_user_can('list_users')) {
            foreach (array_keys($endpoints) as $route) {
                if (str_starts_with($route, '/wp/v2/users')) {
                    unset($endpoints[$route]);
                }
            }
        }
        return $endpoints;
    }

    public static function oembed(array $data): array
    {
        unset($data['author_name'], $data['author_url']);
        return $data;
    }

    public static function authors(): void
    {
        if ((is_author() || isset($_GET['author'])) && !current_user_can('list_users')) {
            wp_safe_redirect(home_url('/'), 301);
            exit;
        }
    }
}
