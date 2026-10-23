<?php

namespace BgRally\Game;

use BgRally\Database\Tables;

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
            $badges[] = ['key' => 'bank', 'text' => sprintf('Просрочена вноска: %d €', $loan['overdue'])];
        }

        if (($manager['bar_week'] ?? '') !== Rallies::week()) {
            $badges[] = ['key' => 'bar', 'text' => 'Нови кандидати за служители тази седмица'];
        }

        $open = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT COUNT(*) FROM ' . Tables::name('street_races') . " WHERE city_id = %d AND status = 'open' AND challenger_id <> %d AND bet <= %d",
            (int) $manager['city_id'],
            $managerId,
            BlackTrack::limits($manager)['max']
        ));
        if ($open) {
            $badges[] = ['key' => 'black', 'text' => $open === 1 ? 'Чака те предизвикателство' : sprintf('Чакат те %d предизвикателства', $open)];
        }

        return $badges;
    }
}
