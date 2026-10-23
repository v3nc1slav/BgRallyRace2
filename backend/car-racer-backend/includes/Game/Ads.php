<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\I18n;
use BgRally\Settings;
use WP_Error;

final class Ads
{
    public const OPTION = 'bgr_ads';
    public const REWARDS = ['energy', 'money', 'discount', 'retry'];
    public const PROVIDERS = ['test' => 'Тестова реклама', 'gpt' => 'Google Ad Manager'];

    private static function table(): string
    {
        return Tables::name('ad_views');
    }

    public static function config(): array
    {
        $config = (array) get_option(self::OPTION, []);
        $provider = (string) ($config['provider'] ?? 'test');

        return [
            'provider' => isset(self::PROVIDERS[$provider]) ? $provider : 'test',
            'gpt_unit' => (string) ($config['gpt_unit'] ?? ''),
            'publisher' => (string) ($config['publisher'] ?? ''),
            'admob_unit' => (string) ($config['admob_unit'] ?? ''),
            'admob_ssv' => (bool) ($config['admob_ssv'] ?? true),
        ];
    }

    public static function label(string $reward): string
    {
        return match ($reward) {
            'energy' => I18n::t('server.ads.energy', ['energy' => Settings::int('ad_energy')]),
            'money' => I18n::money(Settings::int('ad_money')),
            'discount' => I18n::t('server.ads.discount', ['pct' => Settings::int('ad_discount')]),
            default => I18n::t('server.ads.retry'),
        };
    }

    private static function today(): string
    {
        return wp_date('Y-m-d') . ' 00:00:00';
    }

    private static function used(int $managerId): array
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT reward, COUNT(*) AS used FROM ' . self::table() . " WHERE manager_id = %d AND status = 'claimed' AND created_at >= %s GROUP BY reward",
            $managerId,
            self::today()
        ), ARRAY_A);
        return array_column($rows, 'used', 'reward');
    }

    private static function cooldown(int $managerId): int
    {
        global $wpdb;
        $last = $wpdb->get_var($wpdb->prepare('SELECT MAX(claimed_at) FROM ' . self::table() . " WHERE manager_id = %d AND status = 'claimed'", $managerId));
        return $last ? max(0, strtotime($last) + Settings::int('ad_cooldown') * MINUTE_IN_SECONDS - Rallies::now()) : 0;
    }

    private static function blocked(array $manager, string $reward): string
    {
        if ($reward === 'retry' && (int) $manager['ad_retry']) {
            return I18n::t('server.ads.hasRetry');
        }
        if ($reward === 'discount' && (int) $manager['shop_discount']) {
            return I18n::t('server.ads.hasDiscount');
        }
        return '';
    }

    private static function left(array $manager, string $reward): int
    {
        return max(0, Settings::int('ad_' . $reward . '_daily') - (int) (self::used((int) $manager['id'])[$reward] ?? 0));
    }

    public static function view(array $manager): array
    {
        return [
            'cooldown' => self::cooldown((int) $manager['id']),
            'rewards' => array_map(fn($reward) => [
                'key' => $reward,
                'label' => self::label($reward),
                'daily' => Settings::int('ad_' . $reward . '_daily'),
                'left' => self::left($manager, $reward),
                'blocked' => self::blocked($manager, $reward),
            ], self::REWARDS),
        ];
    }

    public static function start(array $manager, string $reward, string $platform = 'web'): array|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];

        if (!in_array($reward, self::REWARDS, true)) {
            return new WP_Error('bgr_reward', I18n::t('server.ads.noReward'), ['status' => 400]);
        }
        if (!self::left($manager, $reward)) {
            return new WP_Error('bgr_limit', I18n::t('server.ads.limit'), ['status' => 400]);
        }
        $blocked = self::blocked($manager, $reward);
        if ($blocked) {
            return new WP_Error('bgr_blocked', $blocked, ['status' => 400]);
        }
        $cooldown = self::cooldown($managerId);
        if ($cooldown) {
            return new WP_Error('bgr_cooldown', I18n::t('server.ads.cooldown', ['seconds' => $cooldown]), ['status' => 400]);
        }

        $config = self::config();
        $provider = $platform === 'app' ? ($config['admob_unit'] !== '' ? 'admob' : 'test') : $config['provider'];
        $token = wp_generate_password(32, false);
        $wpdb->insert(self::table(), [
            'manager_id' => $managerId,
            'reward' => $reward,
            'provider' => $provider,
            'token' => $token,
            'status' => 'started',
            'created_at' => current_time('mysql'),
        ]);
        $viewId = (int) $wpdb->insert_id;

        return [
            'view_id' => $viewId,
            'token' => $token,
            'label' => self::label($reward),
            'seconds' => Settings::int('ad_test_seconds'),
            'provider' => $provider,
            'gpt_unit' => $config['gpt_unit'],
            'publisher' => $config['publisher'],
            'admob_unit' => $config['admob_unit'],
            'ssv_data' => $viewId . '.' . $token,
            'user' => (string) $managerId,
        ];
    }

    public static function claim(array $manager, int $viewId, string $token): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $managers = Tables::name('managers');
        $view = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE id = %d AND manager_id = %d', $viewId, $managerId), ARRAY_A);

        if (!$view || !in_array($view['status'], ['started', 'verified'], true) || !hash_equals($view['token'], $token)) {
            return new WP_Error('bgr_ad', I18n::t('server.ads.notFound'), ['status' => 400]);
        }
        if ($view['provider'] === 'admob' && self::config()['admob_ssv'] && $view['status'] !== 'verified') {
            return new WP_Error('bgr_ad_pending', I18n::t('server.ads.pending'), ['status' => 409]);
        }
        $minimum = $view['provider'] === 'test' ? Settings::int('ad_test_seconds') : Settings::int('ad_min_seconds');
        if ($view['status'] !== 'verified' && Rallies::now() - strtotime($view['created_at']) < $minimum - 1) {
            return new WP_Error('bgr_ad', I18n::t('server.ads.incomplete'), ['status' => 400]);
        }
        $reward = $view['reward'];
        if (!self::left($manager, $reward) || self::blocked($manager, $reward)) {
            return new WP_Error('bgr_limit', I18n::t('server.ads.unavailable'), ['status' => 400]);
        }
        $claimed = $wpdb->query($wpdb->prepare(
            'UPDATE ' . self::table() . " SET status = 'claimed', claimed_at = %s WHERE id = %d AND status IN ('started', 'verified')",
            current_time('mysql'),
            $viewId
        ));
        if ($claimed !== 1) {
            return new WP_Error('bgr_ad', I18n::t('server.ads.claimed'), ['status' => 400]);
        }

        switch ($reward) {
            case 'energy':
                $wpdb->query($wpdb->prepare("UPDATE $managers SET energy = energy + %d WHERE id = %d", Settings::int('ad_energy'), $managerId));
                break;
            case 'money':
                Ledger::add($managerId, Settings::int('ad_money'), 'ad', I18n::t('server.ledger.ad', [], I18n::of($managerId)));
                break;
            case 'discount':
                $wpdb->update($managers, ['shop_discount' => Settings::int('ad_discount')], ['id' => $managerId]);
                break;
            default:
                $wpdb->update($managers, ['ad_retry' => 1], ['id' => $managerId]);
        }

        return I18n::t('server.ads.got', ['reward' => self::label($reward)]);
    }

    private static function admobKeys(): array
    {
        $keys = get_transient('bgr_admob_keys');
        if (!is_array($keys)) {
            $response = wp_remote_get('https://www.gstatic.com/admob/reward/verifier-keys.json', ['timeout' => 10]);
            $data = is_wp_error($response) ? null : json_decode((string) wp_remote_retrieve_body($response), true);
            $keys = [];
            foreach ((array) ($data['keys'] ?? []) as $key) {
                if (isset($key['keyId'], $key['pem'])) {
                    $keys[(string) $key['keyId']] = (string) $key['pem'];
                }
            }
            if ($keys) {
                set_transient('bgr_admob_keys', $keys, DAY_IN_SECONDS);
            }
        }
        return (array) apply_filters('bgrally_admob_keys', $keys);
    }

    public static function verifySsv(string $query): bool
    {
        global $wpdb;
        if (str_starts_with($query, 'rest_route=')) {
            $query = (string) substr($query, (int) strpos($query . '&', '&') + 1);
        }
        $position = strpos($query, '&signature=');
        if ($position === false) {
            return false;
        }
        parse_str($query, $params);
        $pem = self::admobKeys()[(string) ($params['key_id'] ?? '')] ?? null;
        $signature = base64_decode(strtr((string) ($params['signature'] ?? ''), '-_', '+/'), true);
        if (!$pem || !$signature || openssl_verify(substr($query, 0, $position), $signature, $pem, OPENSSL_ALGO_SHA256) !== 1) {
            return false;
        }

        [$viewId, $token] = array_pad(explode('.', (string) ($params['custom_data'] ?? ''), 2), 2, '');
        $view = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table() . " WHERE id = %d AND provider = 'admob'", (int) $viewId), ARRAY_A);
        if (!$view || !hash_equals($view['token'], $token) || (string) $view['manager_id'] !== (string) ($params['user_id'] ?? '')) {
            return false;
        }
        $wpdb->update(self::table(), ['status' => 'verified'], ['id' => $view['id'], 'status' => 'started']);
        return true;
    }

    public static function useRetry(int $managerId): bool
    {
        global $wpdb;
        return $wpdb->query($wpdb->prepare('UPDATE ' . Tables::name('managers') . ' SET ad_retry = 0 WHERE id = %d AND ad_retry = 1', $managerId)) === 1;
    }

    public static function discount(array $manager, int $price): int
    {
        return (int) round($price * (100 - min(100, (int) $manager['shop_discount'])) / 100);
    }

    public static function useDiscount(array $manager): void
    {
        global $wpdb;
        if ((int) $manager['shop_discount']) {
            $wpdb->update(Tables::name('managers'), ['shop_discount' => 0], ['id' => $manager['id']]);
        }
    }

    public static function stats(): array
    {
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare(
            'SELECT reward, COUNT(*) AS started, SUM(status = \'claimed\') AS claimed FROM ' . self::table() . ' WHERE created_at >= %s GROUP BY reward',
            self::today()
        ), ARRAY_A);
    }
}
