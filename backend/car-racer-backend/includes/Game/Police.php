<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\Settings;
use WP_Error;

final class Police
{
    public const INSTITUTIONS = ['police' => 'Полицията', 'mayor' => 'Кметът'];

    private static function table(): string
    {
        return Tables::name('bribes');
    }

    public static function active(int $managerId, string $institution): ?array
    {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . self::table() . " WHERE manager_id = %d AND institution = %s AND status = 'active' AND expires_at > %s ORDER BY id DESC LIMIT 1",
            $managerId,
            $institution,
            current_time('mysql')
        ), ARRAY_A);
    }

    private static function refusedThisWeek(int $managerId, string $institution): bool
    {
        global $wpdb;
        return (bool) $wpdb->get_var($wpdb->prepare(
            'SELECT 1 FROM ' . self::table() . " WHERE manager_id = %d AND institution = %s AND status = 'refused' AND week = %s LIMIT 1",
            $managerId,
            $institution,
            Rallies::week()
        ));
    }

    public static function protection(int $managerId): string
    {
        if (self::active($managerId, 'mayor')) {
            return 'mayor';
        }
        return self::active($managerId, 'police') ? 'police' : 'none';
    }

    public static function officialRisk(int $managerId): int
    {
        return match (self::protection($managerId)) {
            'mayor' => Settings::int('risk_mayor'),
            'police' => Settings::int('risk_police'),
            default => Settings::int('risk_none'),
        };
    }

    public static function blackRisk(int $managerId): int
    {
        return self::protection($managerId) === 'none' ? Settings::int('black_risk') : Settings::int('black_risk_bribe');
    }

    public static function caught(int $risk): bool
    {
        return mt_rand(1, 100) <= $risk;
    }

    public static function fine(int $managerId, int $amount, string $note): void
    {
        Ledger::add($managerId, -$amount, 'fine', $note, true);
        Rumors::about($managerId, 'Полицията глоби %s с ' . $amount . ' €.', sprintf('Полицията глоби отбор от града с %d €.', $amount));
    }

    public static function chance(array $manager, string $institution): int
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $sponsors = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT COUNT(*) FROM ' . Tables::name('contracts') . " WHERE manager_id = %d AND status = 'active'",
            $managerId
        ));
        $position = Rallies::seasonPosition($managerId);

        $chance = Settings::get('bribe_base')
            + (int) $manager['level'] * Settings::get('bribe_per_level')
            + $sponsors * Settings::get('bribe_per_sponsor')
            + ($position !== null && $position <= 10 ? Settings::get('bribe_top10') : 0)
            + ($institution === 'mayor' ? floor(Staff::crew($managerId)['reputation'] / 10) : 0);

        return (int) min(Settings::get('bribe_max'), round($chance));
    }

    public static function bribe(array $manager, string $institution): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];

        if (!isset(self::INSTITUTIONS[$institution])) {
            return new WP_Error('bgr_bribe', 'Няма такава институция.', ['status' => 400]);
        }
        if ($institution === 'mayor' && (int) $manager['level'] < Settings::int('bribe_mayor_level')) {
            return new WP_Error('bgr_level', sprintf('Кметът приема подкупи от ниво %d.', Settings::int('bribe_mayor_level')), ['status' => 400]);
        }
        if (self::active($managerId, $institution)) {
            return new WP_Error('bgr_bribe', 'Подкупът още действа.', ['status' => 400]);
        }
        if (self::refusedThisWeek($managerId, $institution)) {
            return new WP_Error('bgr_bribe', sprintf('%s вече отказа подкуп тази седмица.', self::INSTITUTIONS[$institution]), ['status' => 400]);
        }

        $price = Settings::int($institution === 'mayor' ? 'bribe_mayor_price' : 'bribe_police_price');
        if ((int) $manager['money'] < $price) {
            return new WP_Error('bgr_money', sprintf('Нужни са %d €.', $price), ['status' => 400]);
        }
        $energy = Settings::int('bribe_energy');
        if (!Energy::spend($managerId, $energy)) {
            return new WP_Error('bgr_energy', sprintf('Нямате достатъчно енергия (нужни са %d).', $energy), ['status' => 400]);
        }

        $row = ['manager_id' => $managerId, 'institution' => $institution, 'week' => Rallies::week(), 'created_at' => current_time('mysql')];

        if (mt_rand(1, 100) > self::chance($manager, $institution)) {
            $wpdb->insert(self::table(), $row + ['status' => 'refused']);
            return sprintf('%s отказа подкупа. Губиш енергията, но не и парите. Следващ опит – чак следващата седмица.', self::INSTITUTIONS[$institution]);
        }

        if (!Ledger::add($managerId, -$price, 'bribe', self::INSTITUTIONS[$institution])) {
            Energy::refund($managerId, $energy);
            return new WP_Error('bgr_money', 'Нямате достатъчно пари.', ['status' => 400]);
        }

        $expires = $institution === 'mayor'
            ? date('Y-m-d H:i:s', Rallies::now() + Settings::int('bribe_mayor_days') * DAY_IN_SECONDS)
            : date('Y-m-d 23:59:59', Rallies::now());
        $wpdb->insert(self::table(), $row + ['status' => 'active', 'expires_at' => $expires]);

        return $institution === 'mayor'
            ? sprintf('Кметът прие подкупа. Пази те до %s.', mysql2date('d.m.Y H:i', $expires))
            : 'Полицията прие подкупа. Пази те до края на деня.';
    }

    public static function view(array $manager): array
    {
        $managerId = (int) $manager['id'];
        $bribe = function (string $institution) use ($manager, $managerId) {
            $active = self::active($managerId, $institution);
            return [
                'active_until' => $active ? str_replace(' ', 'T', $active['expires_at']) : null,
                'refused' => self::refusedThisWeek($managerId, $institution),
                'chance' => self::chance($manager, $institution),
                'price' => Settings::int($institution === 'mayor' ? 'bribe_mayor_price' : 'bribe_police_price'),
            ];
        };

        return [
            'police' => $bribe('police'),
            'mayor' => $bribe('mayor') + ['level' => Settings::int('bribe_mayor_level'), 'days' => Settings::int('bribe_mayor_days')],
            'energy' => Settings::int('bribe_energy'),
            'risks' => [
                'official' => self::officialRisk($managerId),
                'black' => self::blackRisk($managerId),
            ],
            'reports' => Sabotage::reportable($manager),
            'report_energy' => Settings::int('report_energy'),
            'report_days' => Settings::int('report_days'),
        ];
    }
}
