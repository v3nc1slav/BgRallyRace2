<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Catalog\Texts;
use BgRally\Database\Tables;
use BgRally\I18n;
use BgRally\Settings;
use WP_Error;

final class Mayor
{
    public static function moveCost(array $manager): int
    {
        return Settings::int('move_price') + Settings::int('move_per_level') * (int) $manager['level'];
    }

    private static function moveBlocked(array $manager): string
    {
        if ((int) $manager['city_season'] >= Rallies::currentSeason()) {
            return I18n::t('server.mayor.moveSeason');
        }
        if (Rallies::hasUpcomingEntry((int) $manager['id'])) {
            return I18n::t('server.mayor.moveRally');
        }
        return '';
    }

    public static function move(array $manager, int $cityId): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $oldCityId = (int) $manager['city_id'];
        $city = Registry::get('cities')->find($cityId);

        if (!$city || !(int) $city['active']) {
            return new WP_Error('bgr_city', I18n::t('server.mayor.noCity'), ['status' => 404]);
        }
        if ($cityId === $oldCityId) {
            return new WP_Error('bgr_city', I18n::t('server.mayor.sameCity'), ['status' => 400]);
        }
        $blocked = self::moveBlocked($manager);
        if ($blocked) {
            return new WP_Error('bgr_move', $blocked, ['status' => 400]);
        }
        $cost = self::moveCost($manager);
        if ((int) $manager['money'] < $cost) {
            return new WP_Error('bgr_money', I18n::t('server.mayor.moveCost', ['money' => I18n::money($cost)]), ['status' => 400]);
        }
        $energy = Settings::int('move_energy');
        if (!Energy::spend($managerId, $energy)) {
            return new WP_Error('bgr_energy', I18n::t('server.common.energyNeed', ['energy' => $energy]), ['status' => 400]);
        }
        if (!Ledger::add($managerId, -$cost, 'move', I18n::t('server.ledger.move', ['city' => Texts::of($city['name'])]))) {
            Energy::refund($managerId, $energy);
            return new WP_Error('bgr_money', I18n::t('server.mayor.moveCost', ['money' => I18n::money($cost)]), ['status' => 400]);
        }

        $notes = [];
        if (Work::job($manager)) {
            $notes[] = I18n::t('server.mayor.noteJob');
        }
        if ($manager['track_status'] !== '') {
            $notes[] = I18n::t('server.mayor.noteTrack');
        }

        $wpdb->update(Tables::name('managers'), [
            'city_id' => $cityId,
            'city_season' => Rallies::currentSeason(),
            'job_id' => 0,
            'job_season' => 0,
            'track_status' => '',
            'track_ready_at' => null,
        ], ['id' => $managerId]);

        $notes = array_merge($notes, Sponsors::leaveCity($managerId, $oldCityId));
        $refund = BlackTrack::cancelOpen($managerId);
        if ($refund) {
            $notes[] = I18n::t('server.mayor.noteBlack', ['money' => I18n::money($refund)]);
        }
        if (Police::expireAll($managerId)) {
            $notes[] = I18n::t('server.mayor.noteBribes');
        }

        $details = implode('; ', $notes);
        $message = I18n::t('server.mayor.moved', ['city' => Texts::of($city['name']), 'money' => I18n::money($cost)]) . ($details !== '' ? ' ' . mb_strtoupper(mb_substr($details, 0, 1)) . mb_substr($details, 1) . '.' : '');
        Inbox::add($managerId, $message);
        return $message;
    }

    private static function moveView(array $manager): array
    {
        global $wpdb;
        $rows = $wpdb->get_results('SELECT id, name FROM ' . Registry::get('cities')->table() . ' WHERE active = 1 AND id <> ' . (int) $manager['city_id'] . ' ORDER BY name', ARRAY_A);

        return [
            'cost' => self::moveCost($manager),
            'energy' => Settings::int('move_energy'),
            'sponsor_risk' => Settings::int('move_sponsor_risk'),
            'blocked' => self::moveBlocked($manager),
            'cities' => array_map(fn($row) => [
                'id' => (int) $row['id'],
                'name' => Texts::of($row['name']),
                'privileges' => Privileges::describe((int) $row['id']),
                'price_pct' => Shop::cityPct((int) $row['id']),
            ], $rows),
        ];
    }

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
            Inbox::add((int) $manager['id'], I18n::t('server.mayor.trackReady', [], I18n::of($manager)));
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
                return new WP_Error('bgr_permit', I18n::t('server.mayor.hasPermit'), ['status' => 400]);
            }
            if (!GarageLevels::get((int) $manager['garage_level'] + 1)) {
                return new WP_Error('bgr_max', I18n::t('server.garage.max'), ['status' => 400]);
            }
            $chance = self::permitChance($manager);
        } elseif ($kind === 'track') {
            if ((int) $manager['level'] < Settings::int('track_level')) {
                return new WP_Error('bgr_level', I18n::t('server.mayor.trackLevel', ['level' => Settings::int('track_level')]), ['status' => 400]);
            }
            if ((int) $manager['track_ban_season'] >= Rallies::currentSeason()) {
                return new WP_Error('bgr_track_ban', I18n::t('server.mayor.trackBan'), ['status' => 400]);
            }
            if (in_array($manager['track_status'], ['building', 'open'], true)) {
                return new WP_Error('bgr_track', I18n::t('server.mayor.trackOwned'), ['status' => 400]);
            }
            if ($manager['track_status'] === '' && (int) $manager['money'] < Settings::int('track_cost')) {
                return new WP_Error('bgr_money', I18n::t('server.mayor.trackCost', ['money' => I18n::money(Settings::int('track_cost'))]), ['status' => 400]);
            }
            $chance = self::trackChance($manager);
        } else {
            return new WP_Error('bgr_kind', I18n::t('server.mayor.noKind'), ['status' => 400]);
        }

        $retry = self::refusedToday($managerId, $kind);
        if ($retry && !(int) $manager['ad_retry']) {
            return new WP_Error('bgr_refused', I18n::t('server.mayor.refusedAd'), ['status' => 400]);
        }
        $energy = Settings::int('mayor_energy');
        if (!Energy::spend($managerId, $energy)) {
            return new WP_Error('bgr_energy', I18n::t('server.common.energyNeed', ['energy' => $energy]), ['status' => 400]);
        }
        if ($retry && !Ads::useRetry($managerId)) {
            Energy::refund($managerId, $energy);
            return new WP_Error('bgr_refused', I18n::t('server.mayor.refused'), ['status' => 400]);
        }

        if (mt_rand(1, 100) > $chance) {
            self::record($managerId, $kind, 'refused');
            return I18n::t('server.mayor.refusedNow');
        }

        if ($kind === 'garage') {
            self::record($managerId, 'garage', 'approved');
            return I18n::t('server.mayor.permitGranted');
        }

        if ($manager['track_status'] === 'closed') {
            $wpdb->update(Tables::name('managers'), ['track_status' => 'open'], ['id' => $managerId]);
            self::record($managerId, 'track', 'used');
            return I18n::t('server.mayor.reopened');
        }

        if (!Ledger::add($managerId, -Settings::int('track_cost'), 'track', I18n::t('server.ledger.track'))) {
            Energy::refund($managerId, $energy);
            return new WP_Error('bgr_money', I18n::t('server.mayor.trackCost', ['money' => I18n::money(Settings::int('track_cost'))]), ['status' => 400]);
        }
        $ready = date('Y-m-d H:i:s', Rallies::now() + Settings::int('track_weeks') * WEEK_IN_SECONDS);
        $wpdb->update(Tables::name('managers'), ['track_status' => 'building', 'track_ready_at' => $ready], ['id' => $managerId]);
        self::record($managerId, 'track', 'used');

        return I18n::t('server.mayor.approved', ['date' => I18n::date(strtotime($ready))]);
    }

    public static function view(array $manager): array
    {
        $managerId = (int) $manager['id'];
        $manager = self::refreshTrack($manager);
        $next = GarageLevels::get((int) $manager['garage_level'] + 1);

        return [
            'energy' => Settings::int('mayor_energy'),
            'clothes_bonus' => Clothes::bonus($managerId),
            'move' => self::moveView($manager),
            'permit' => [
                'has' => self::hasPermit($managerId),
                'by_bribe' => Police::active($managerId, 'mayor') !== null,
                'chance' => self::permitChance($manager),
                'refused_today' => self::refusedToday($managerId, 'garage'),
                'next_level' => $next ? (int) $next['level'] : null,
            ],
            'track' => [
                'status' => $manager['track_status'],
                'status_label' => Labels::text('TRACK_STATUSES', $manager['track_status']),
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
