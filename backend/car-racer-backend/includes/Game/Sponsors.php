<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Catalog\Texts;
use BgRally\Database\Tables;
use BgRally\I18n;
use BgRally\Settings;
use WP_Error;

final class Sponsors
{
    private static function table(): string
    {
        return Tables::name('contracts');
    }

    public static function slotLevel(string $slot): int
    {
        return Settings::int('slot_level_' . $slot);
    }

    private static function isLocal(array $sponsor, array $manager): bool
    {
        return (int) $sponsor['city_id'] === (int) $manager['city_id'];
    }

    public static function terms(array $sponsor, array $manager): array
    {
        $local = self::isLocal($sponsor, $manager);
        return [
            'local' => $local,
            'payment' => $local ? (int) round($sponsor['payment'] * (1 + Settings::get('sponsor_local_payment') / 100)) : (int) $sponsor['payment'],
            'goal_place' => $local ? max(1, (int) $sponsor['goal_place'] - Settings::int('sponsor_local_goal')) : (int) $sponsor['goal_place'],
            'bonus' => (int) $sponsor['bonus'],
            'weeks' => (int) $sponsor['duration_weeks'],
        ];
    }

    public static function stepChance(array $manager, bool $local): float
    {
        $chance = Settings::get('sponsor_chance_base')
            + (int) $manager['level'] * Settings::get('sponsor_chance_level')
            + ($local ? Settings::get('sponsor_chance_local') : 0);
        return min(Settings::get('sponsor_chance_max'), $chance + Clothes::bonus((int) $manager['id']));
    }

    public static function stepRisk(array $manager, bool $local): float
    {
        return (100 - self::stepChance($manager, $local)) * Settings::get('sponsor_risk_factor') / 100;
    }

    public static function stepProgress(array $sponsor, array $manager, bool $local): int
    {
        $reputation = Staff::crew((int) $manager['id'])['reputation'];
        return (int) round(
            (int) $sponsor['progress_rate']
            + ($local ? Settings::get('sponsor_progress_local') + Privileges::percent((int) $manager['city_id'], 'sponsor_local') : 0)
            + floor($reputation / 10) * Settings::get('sponsor_progress_reputation')
        );
    }

    private static function open(int $managerId): array
    {
        global $wpdb;
        $sponsors = Registry::get('sponsors')->table();
        return $wpdb->get_results($wpdb->prepare(
            'SELECT c.*, s.name, s.city_id, s.progress_rate FROM ' . self::table() . " c JOIN $sponsors s ON s.id = c.sponsor_id
             WHERE c.manager_id = %d AND c.status IN ('negotiating', 'active') ORDER BY c.id",
            $managerId
        ), ARRAY_A);
    }

    public static function view(array $manager): array
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $level = (int) $manager['level'];
        $cities = Registry::get('cities')->options();

        $bySlot = [];
        foreach (self::open($managerId) as $contract) {
            $bySlot[$contract['slot']] = $contract;
        }

        $slots = [];
        foreach (Labels::all('SPONSOR_SLOTS') as $slot => $label) {
            $contract = $bySlot[$slot] ?? null;
            $slots[] = [
                'slot' => $slot,
                'label' => $label,
                'unlock_level' => self::slotLevel($slot),
                'unlocked' => $level >= self::slotLevel($slot),
                'contract' => $contract ? [
                    'sponsor' => $contract['name'],
                    'city' => Texts::of($cities[$contract['city_id']] ?? ''),
                    'status' => $contract['status'],
                    'status_label' => Labels::text('CONTRACT_STATUSES', $contract['status']),
                    'progress' => (int) $contract['progress'],
                    'payment' => (int) $contract['payment'],
                    'goal_place' => (int) $contract['goal_place'],
                    'bonus' => (int) $contract['bonus'],
                    'weeks' => (int) $contract['weeks'],
                    'misses' => (int) $contract['misses'],
                    'ends_at' => $contract['ends_at'] ? str_replace(' ', 'T', $contract['ends_at']) : null,
                ] : null,
            ];
        }

        $sponsors = $wpdb->get_results('SELECT * FROM ' . Registry::get('sponsors')->table() . ' WHERE active = 1 ORDER BY min_level, payment', ARRAY_A);
        $offers = array_map(function (array $sponsor) use ($manager, $level, $bySlot, $cities) {
            $terms = self::terms($sponsor, $manager);
            $slotOpen = $level >= self::slotLevel($sponsor['slot']) && !isset($bySlot[$sponsor['slot']]);
            return [
                'id' => (int) $sponsor['id'],
                'name' => $sponsor['name'],
                'city' => Texts::of($cities[$sponsor['city_id']] ?? ''),
                'slot_label' => Labels::text('SPONSOR_SLOTS', $sponsor['slot']),
                'min_level' => (int) $sponsor['min_level'],
                'locked' => (int) $sponsor['min_level'] > $level,
                'available' => $slotOpen && (int) $sponsor['min_level'] <= $level,
                'progress_step' => self::stepProgress($sponsor, $manager, $terms['local']),
                'risk' => round(self::stepRisk($manager, $terms['local']), 1),
            ] + $terms;
        }, $sponsors);

        return [
            'slots' => $slots,
            'offers' => $offers,
            'energy_cost' => Settings::int('energy_negotiation'),
            'misses_limit' => Settings::int('sponsor_misses'),
        ];
    }

    public static function negotiate(array $manager, int $sponsorId): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $sponsor = Registry::get('sponsors')->find($sponsorId);

        if (!$sponsor || !$sponsor['active']) {
            return new WP_Error('bgr_not_found', I18n::t('server.sponsors.notFound'), ['status' => 404]);
        }
        if ((int) $sponsor['min_level'] > (int) $manager['level']) {
            return new WP_Error('bgr_level', I18n::t('server.common.level', ['level' => $sponsor['min_level']]), ['status' => 400]);
        }
        if ((int) $manager['level'] < self::slotLevel($sponsor['slot'])) {
            return new WP_Error('bgr_slot', I18n::t('server.sponsors.slotLevel', ['level' => self::slotLevel($sponsor['slot'])]), ['status' => 400]);
        }
        foreach (self::open($managerId) as $contract) {
            if ($contract['slot'] === $sponsor['slot']) {
                return new WP_Error('bgr_slot', I18n::t('server.sponsors.slotTaken'), ['status' => 400]);
            }
        }

        $energy = Settings::int('energy_negotiation');
        if (!Energy::spend($managerId, $energy)) {
            return new WP_Error('bgr_energy', I18n::t('server.common.energyNeed', ['energy' => $energy]), ['status' => 400]);
        }

        $terms = self::terms($sponsor, $manager);
        $wpdb->insert(self::table(), [
            'manager_id' => $managerId,
            'sponsor_id' => $sponsorId,
            'slot' => $sponsor['slot'],
            'status' => 'negotiating',
            'progress' => 0,
            'payment' => $terms['payment'],
            'goal_place' => $terms['goal_place'],
            'bonus' => $terms['bonus'],
            'weeks' => $terms['weeks'],
            'local' => $terms['local'] ? 1 : 0,
            'created_at' => current_time('mysql'),
        ]);

        return I18n::t('server.sponsors.started', ['name' => $sponsor['name']]);
    }

    public static function afterRally(array $manager, array $entry, string $rallyName): void
    {
        global $wpdb;
        $managerId = (int) $manager['id'];

        foreach (self::open($managerId) as $contract) {
            $id = (int) $contract['id'];

            if ($contract['status'] === 'negotiating') {
                $sponsor = ['progress_rate' => $contract['progress_rate']];
                $local = (bool) $contract['local'];

                if (mt_rand(1, 10000) <= self::stepRisk($manager, $local) * 100) {
                    $wpdb->update(self::table(), ['status' => 'failed'], ['id' => $id]);
                    Inbox::add($managerId, I18n::t('server.sponsors.failed', ['name' => $contract['name'], 'pct' => $contract['progress']]));
                    continue;
                }

                $progress = min(100, (int) $contract['progress'] + self::stepProgress($sponsor, $manager, $local));
                if ($progress >= 100) {
                    $wpdb->update(self::table(), [
                        'status' => 'active',
                        'progress' => 100,
                        'starts_at' => current_time('mysql'),
                        'ends_at' => date('Y-m-d H:i:s', Rallies::now() + (int) $contract['weeks'] * WEEK_IN_SECONDS),
                    ], ['id' => $id]);
                    Inbox::add($managerId, I18n::t('server.sponsors.signed', ['name' => $contract['name'], 'weeks' => $contract['weeks']]));
                } else {
                    $wpdb->update(self::table(), ['progress' => $progress], ['id' => $id]);
                    Inbox::add($managerId, I18n::t('server.sponsors.progress', ['name' => $contract['name'], 'pct' => $progress]));
                }
                continue;
            }

            $success = $entry['status'] === 'finished' && (int) $entry['place'] <= (int) $contract['goal_place'];
            $amount = $success ? (int) $contract['payment'] + (int) $contract['bonus'] : (int) round($contract['payment'] / 2);
            Ledger::add($managerId, $amount, 'sponsor', sprintf('%s – %s', $contract['name'], $rallyName));

            $misses = $success ? 0 : (int) $contract['misses'] + 1;
            if ($misses >= Settings::int('sponsor_misses')) {
                $wpdb->update(self::table(), ['status' => 'terminated', 'misses' => $misses], ['id' => $id]);
                Inbox::add($managerId, I18n::t('server.sponsors.terminated', ['name' => $contract['name'], 'money' => I18n::money($amount), 'misses' => $misses]));
                continue;
            }

            $wpdb->update(self::table(), ['misses' => $misses], ['id' => $id]);
            Inbox::add($managerId, $success
                ? I18n::t('server.sponsors.paid', ['name' => $contract['name'], 'money' => I18n::money($amount)])
                : I18n::t('server.sponsors.paidHalf', ['name' => $contract['name'], 'money' => I18n::money($amount), 'place' => $contract['goal_place']]));
        }
    }

    public static function expire(): void
    {
        global $wpdb;
        $sponsors = Registry::get('sponsors')->table();
        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT c.id, c.manager_id, s.name FROM ' . self::table() . " c JOIN $sponsors s ON s.id = c.sponsor_id JOIN " . Tables::name('managers') . " m ON m.id = c.manager_id
             WHERE c.status = 'active' AND c.ends_at <= %s AND m.inactive_since IS NULL",
            current_time('mysql')
        ), ARRAY_A);

        foreach ($rows as $row) {
            $wpdb->update(self::table(), ['status' => 'ended'], ['id' => $row['id']]);
            Inbox::add((int) $row['manager_id'], I18n::t('server.sponsors.expired', ['name' => $row['name']], I18n::of((int) $row['manager_id'])));
        }
    }

    public static function leaveCity(int $managerId, int $oldCityId): array
    {
        global $wpdb;
        $notes = [];

        foreach (self::open($managerId) as $contract) {
            if ((int) $contract['city_id'] !== $oldCityId) {
                continue;
            }
            if ($contract['status'] === 'negotiating') {
                $wpdb->update(self::table(), ['status' => 'failed'], ['id' => $contract['id']]);
                $notes[] = I18n::t('server.sponsors.noteStopped', ['name' => $contract['name']]);
            } elseif (mt_rand(1, 100) <= Settings::int('move_sponsor_risk')) {
                $wpdb->update(self::table(), ['status' => 'terminated'], ['id' => $contract['id']]);
                $notes[] = I18n::t('server.sponsors.noteEnded', ['name' => $contract['name']]);
            }
        }
        return $notes;
    }
}
