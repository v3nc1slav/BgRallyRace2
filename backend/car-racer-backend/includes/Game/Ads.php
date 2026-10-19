<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
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
        ];
    }

    public static function label(string $reward): string
    {
        return match ($reward) {
            'energy' => sprintf('+%d енергия', Settings::int('ad_energy')),
            'money' => sprintf('%d €', Settings::int('ad_money')),
            'discount' => sprintf('%d%% отстъпка за следващата покупка от магазина', Settings::int('ad_discount')),
            default => 'Втори опит при кмета или при отказан подкуп',
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
            return 'Вече имаш неизползван втори опит.';
        }
        if ($reward === 'discount' && (int) $manager['shop_discount']) {
            return 'Вече имаш отстъпка за следващата покупка.';
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

    public static function start(array $manager, string $reward): array|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];

        if (!in_array($reward, self::REWARDS, true)) {
            return new WP_Error('bgr_reward', 'Няма такава награда.', ['status' => 400]);
        }
        if (!self::left($manager, $reward)) {
            return new WP_Error('bgr_limit', 'Тази награда е изчерпана за днес.', ['status' => 400]);
        }
        $blocked = self::blocked($manager, $reward);
        if ($blocked) {
            return new WP_Error('bgr_blocked', $blocked, ['status' => 400]);
        }
        $cooldown = self::cooldown($managerId);
        if ($cooldown) {
            return new WP_Error('bgr_cooldown', sprintf('Следващата реклама – след %d сек.', $cooldown), ['status' => 400]);
        }

        $config = self::config();
        $token = wp_generate_password(32, false);
        $wpdb->insert(self::table(), [
            'manager_id' => $managerId,
            'reward' => $reward,
            'provider' => $config['provider'],
            'token' => $token,
            'status' => 'started',
            'created_at' => current_time('mysql'),
        ]);

        return [
            'view_id' => (int) $wpdb->insert_id,
            'token' => $token,
            'label' => self::label($reward),
            'seconds' => Settings::int('ad_test_seconds'),
        ] + $config;
    }

    public static function claim(array $manager, int $viewId, string $token): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $managers = Tables::name('managers');
        $view = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE id = %d AND manager_id = %d', $viewId, $managerId), ARRAY_A);

        if (!$view || $view['status'] !== 'started' || !hash_equals($view['token'], $token)) {
            return new WP_Error('bgr_ad', 'Рекламата не е намерена.', ['status' => 400]);
        }
        $minimum = $view['provider'] === 'test' ? Settings::int('ad_test_seconds') : Settings::int('ad_min_seconds');
        if (Rallies::now() - strtotime($view['created_at']) < $minimum - 1) {
            return new WP_Error('bgr_ad', 'Рекламата не е изгледана докрай.', ['status' => 400]);
        }
        $reward = $view['reward'];
        if (!self::left($manager, $reward) || self::blocked($manager, $reward)) {
            return new WP_Error('bgr_limit', 'Тази награда вече не е налична днес.', ['status' => 400]);
        }
        $claimed = $wpdb->query($wpdb->prepare(
            'UPDATE ' . self::table() . " SET status = 'claimed', claimed_at = %s WHERE id = %d AND status = 'started'",
            current_time('mysql'),
            $viewId
        ));
        if ($claimed !== 1) {
            return new WP_Error('bgr_ad', 'Наградата вече е получена.', ['status' => 400]);
        }

        switch ($reward) {
            case 'energy':
                $wpdb->query($wpdb->prepare("UPDATE $managers SET energy = energy + %d WHERE id = %d", Settings::int('ad_energy'), $managerId));
                break;
            case 'money':
                Ledger::add($managerId, Settings::int('ad_money'), 'ad', 'Награда за реклама');
                break;
            case 'discount':
                $wpdb->update($managers, ['shop_discount' => Settings::int('ad_discount')], ['id' => $managerId]);
                break;
            default:
                $wpdb->update($managers, ['ad_retry' => 1], ['id' => $managerId]);
        }

        return 'Получи: ' . self::label($reward) . '.';
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
