<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\I18n;

final class Badges
{
    public static function seenBar(array $manager): void
    {
        global $wpdb;
        $week = Rallies::week();
        if (($manager['bar_week'] ?? '') !== $week) {
            $wpdb->update(Tables::name('managers'), ['bar_week' => $week], ['id' => $manager['id']]);
        }
    }

    public static function forManager(array $manager): array
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $badges = [];

        $loan = Bank::summary($managerId);
        if ($loan && $loan['overdue'] > 0) {
            $badges[] = ['key' => 'bank', 'text' => I18n::t('server.badges.bank', ['money' => I18n::money($loan['overdue'])])];
        }

        if (($manager['bar_week'] ?? '') !== Rallies::week()) {
            $badges[] = ['key' => 'bar', 'text' => I18n::t('server.badges.bar')];
        }

        $open = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT COUNT(*) FROM ' . Tables::name('street_races') . " WHERE city_id = %d AND status = 'open' AND challenger_id <> %d AND bet <= %d",
            (int) $manager['city_id'],
            $managerId,
            BlackTrack::limits($manager)['max']
        ));
        if ($open) {
            $badges[] = ['key' => 'black', 'text' => I18n::t('server.badges.black', ['count' => $open])];
        }

        return $badges;
    }
}
