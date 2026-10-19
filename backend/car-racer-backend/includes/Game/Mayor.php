<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\Settings;
use WP_Error;

final class Mayor
{
    private static function table(): string
    {
        return Tables::name('mayor_requests');
    }

    private static function activeSponsors(int $managerId): int
    {
        global $wpdb;
        return (int) $wpdb->get_var($wpdb->prepare(
            'SELECT COUNT(*) FROM ' . Tables::name('contracts') . " WHERE manager_id = %d AND status = 'active'",
            $managerId
        ));
    }

    public static function permitChance(array $manager): int
    {
        $managerId = (int) $manager['id'];
        $chance = Settings::get('permit_base')
            + (int) $manager['level'] * Settings::get('permit_per_level')
            + floor(Staff::crew($managerId)['reputation'] / 10)
            + Clothes::bonus($managerId);
        return (int) min(Settings::get('mayor_max'), round($chance));
    }

    public static function trackChance(array $manager): int
    {
        $managerId = (int) $manager['id'];
        $position = Rallies::seasonPosition($managerId);
        $chance = Settings::get('track_base')
            + (int) $manager['level'] * Settings::get('track_per_level')
            + self::activeSponsors($managerId) * Settings::get('track_per_sponsor')
            + ($position !== null && $position <= 5 ? Settings::get('track_top5') : 0)
            + floor(Staff::crew($managerId)['reputation'] / 10)
            + Clothes::bonus($managerId);
        return (int) min(Settings::get('mayor_max'), round($chance));
    }

    private static function refusedToday(int $managerId, string $kind): bool
    {
        global $wpdb;
        return (bool) $wpdb->get_var($wpdb->prepare(
            'SELECT 1 FROM ' . self::table() . " WHERE manager_id = %d AND kind = %s AND status = 'refused' AND request_date = %s LIMIT 1",
            $managerId,
            $kind,
            wp_date('Y-m-d')
        ));
    }

    private static function storedPermit(int $managerId): ?int
    {
        global $wpdb;
        $id = $wpdb->get_var($wpdb->prepare(
            'SELECT id FROM ' . self::table() . " WHERE manager_id = %d AND kind = 'garage' AND status = 'approved' ORDER BY id LIMIT 1",
            $managerId
        ));
        return $id ? (int) $id : null;
    }

    public static function hasPermit(int $managerId): bool
    {
        return self::storedPermit($managerId) !== null || Police::active($managerId, 'mayor') !== null;
    }

    public static function usePermit(int $managerId): void
    {
        global $wpdb;
        if (Police::active($managerId, 'mayor')) {
            return;
        }
        $id = self::storedPermit($managerId);
        if ($id) {
            $wpdb->update(self::table(), ['status' => 'used'], ['id' => $id]);
        }
    }

    public static function refreshTrack(array $manager): array
    {
        global $wpdb;
        if ($manager['track_status'] === 'building' && $manager['track_ready_at'] && strtotime($manager['track_ready_at']) <= Rallies::now()) {
            $wpdb->update(Tables::name('managers'), ['track_status' => 'open'], ['id' => $manager['id']]);
            Inbox::add((int) $manager['id'], 'Собствената тренировъчна писта е готова. Екипажът може да тренира без полиция всеки ден.');
            $manager['track_status'] = 'open';
        }
        return $manager;
    }

    private static function record(int $managerId, string $kind, string $status): void
    {
        global $wpdb;
        $wpdb->insert(self::table(), [
            'manager_id' => $managerId,
            'kind' => $kind,
            'status' => $status,
            'request_date' => wp_date('Y-m-d'),
            'created_at' => current_time('mysql'),
        ]);
    }

    public static function negotiate(array $manager, string $kind): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $manager = self::refreshTrack($manager);

        if ($kind === 'garage') {
            if (self::hasPermit($managerId)) {
                return new WP_Error('bgr_permit', 'Вече имаш разрешение за следващото ниво на гаража.', ['status' => 400]);
            }
            if (!GarageLevels::get((int) $manager['garage_level'] + 1)) {
                return new WP_Error('bgr_max', 'Гаражът е на максимално ниво.', ['status' => 400]);
            }
            $chance = self::permitChance($manager);
        } elseif ($kind === 'track') {
            if ((int) $manager['level'] < Settings::int('track_level')) {
                return new WP_Error('bgr_level', sprintf('Собствена писта – от ниво %d.', Settings::int('track_level')), ['status' => 400]);
            }
            if ((int) $manager['track_ban_season'] >= Rallies::currentSeason()) {
                return new WP_Error('bgr_track_ban', 'След разкрития саботаж кметът няма да преговаря за пистата до следващия сезон.', ['status' => 400]);
            }
            if (in_array($manager['track_status'], ['building', 'open'], true)) {
                return new WP_Error('bgr_track', 'Пистата вече е твоя.', ['status' => 400]);
            }
            if ($manager['track_status'] === '' && (int) $manager['money'] < Settings::int('track_cost')) {
                return new WP_Error('bgr_money', sprintf('Строежът струва %d €.', Settings::int('track_cost')), ['status' => 400]);
            }
            $chance = self::trackChance($manager);
        } else {
            return new WP_Error('bgr_kind', 'Няма такива преговори.', ['status' => 400]);
        }

        if (self::refusedToday($managerId, $kind)) {
            return new WP_Error('bgr_refused', 'Кметът вече ти отказа днес. Опитай утре.', ['status' => 400]);
        }
        $energy = Settings::int('mayor_energy');
        if (!Energy::spend($managerId, $energy)) {
            return new WP_Error('bgr_energy', sprintf('Нямате достатъчно енергия (нужни са %d).', $energy), ['status' => 400]);
        }

        if (mt_rand(1, 100) > $chance) {
            self::record($managerId, $kind, 'refused');
            return 'Кметът отказа. Можеш да опиташ отново утре.';
        }

        if ($kind === 'garage') {
            self::record($managerId, 'garage', 'approved');
            return 'Кметът подписа разрешение за следващото ниво на гаража.';
        }

        if ($manager['track_status'] === 'closed') {
            $wpdb->update(Tables::name('managers'), ['track_status' => 'open'], ['id' => $managerId]);
            self::record($managerId, 'track', 'used');
            return 'Кметът отвори отново собствената ти тренировъчна писта.';
        }

        if (!Ledger::add($managerId, -Settings::int('track_cost'), 'track', 'Строеж на тренировъчна писта')) {
            Energy::refund($managerId, $energy);
            return new WP_Error('bgr_money', sprintf('Строежът струва %d €.', Settings::int('track_cost')), ['status' => 400]);
        }
        $ready = date('Y-m-d H:i:s', Rallies::now() + Settings::int('track_weeks') * WEEK_IN_SECONDS);
        $wpdb->update(Tables::name('managers'), ['track_status' => 'building', 'track_ready_at' => $ready], ['id' => $managerId]);
        self::record($managerId, 'track', 'used');

        return sprintf('Кметът одобри пистата. Строежът започва и ще е готов на %s.', mysql2date('d.m.Y', $ready));
    }

    public static function view(array $manager): array
    {
        $managerId = (int) $manager['id'];
        $manager = self::refreshTrack($manager);
        $next = GarageLevels::get((int) $manager['garage_level'] + 1);

        return [
            'energy' => Settings::int('mayor_energy'),
            'clothes_bonus' => Clothes::bonus($managerId),
            'permit' => [
                'has' => self::hasPermit($managerId),
                'by_bribe' => Police::active($managerId, 'mayor') !== null,
                'chance' => self::permitChance($manager),
                'refused_today' => self::refusedToday($managerId, 'garage'),
                'next_level' => $next ? (int) $next['level'] : null,
            ],
            'track' => [
                'status' => $manager['track_status'],
                'status_label' => Labels::TRACK_STATUSES[$manager['track_status']] ?? '',
                'ready_at' => $manager['track_ready_at'] ? str_replace(' ', 'T', $manager['track_ready_at']) : null,
                'level' => Settings::int('track_level'),
                'cost' => Settings::int('track_cost'),
                'weeks' => Settings::int('track_weeks'),
                'chance' => self::trackChance($manager),
                'refused_today' => self::refusedToday($managerId, 'track'),
                'banned' => (int) $manager['track_ban_season'] >= Rallies::currentSeason(),
            ],
        ];
    }
}
