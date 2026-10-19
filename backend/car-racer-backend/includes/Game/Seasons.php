<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Database\Tables;
use BgRally\Settings;

final class Seasons
{
    public static function maybeClose(int $season): void
    {
        global $wpdb;
        $rallies = Registry::get('rallies')->table();
        $runs = Tables::name('rally_runs');

        $open = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $rallies WHERE season = %d AND status <> 'finished'", $season));
        $unpublished = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $rallies r LEFT JOIN $runs ru ON ru.rally_id = r.id WHERE r.season = %d AND (ru.rally_id IS NULL OR ru.published = 0)",
            $season
        ));
        if ($open || $unpublished) {
            return;
        }

        $claimed = $wpdb->query($wpdb->prepare('INSERT IGNORE INTO ' . Tables::name('seasons') . ' (season, closed_at) VALUES (%d, %s)', $season, current_time('mysql')));
        if ($claimed !== 1) {
            return;
        }

        $positions = self::positions($season);
        foreach ($positions as $managerId => [$class, $position]) {
            $prize = self::prize($position);
            $xp = $position <= 3 ? Settings::int('season_xp_' . $position) : 0;
            if ($prize) {
                Ledger::add($managerId, $prize, 'season_prize', sprintf('Сезон %d – %d място', $season, $position));
            }
            if ($position <= 3 && $xp) {
                Progress::addXp($managerId, $xp);
            }
            Inbox::add($managerId, $prize
                ? sprintf('Сезон %d приключи: %d място в %s. Награда %d €%s.', $season, $position, Labels::classLabel($class), $prize, $position <= 3 && $xp ? sprintf(' и %d опит', $xp) : '')
                : sprintf('Сезон %d приключи: %d място в %s.', $season, $position, Labels::classLabel($class)));
        }

        $tracks = $wpdb->get_results("SELECT id FROM " . Tables::name('managers') . " WHERE track_status IN ('open', 'building')", ARRAY_A);
        foreach ($tracks as $row) {
            $managerId = (int) $row['id'];
            if (!isset($positions[$managerId]) || $positions[$managerId][1] > 5) {
                $wpdb->update(Tables::name('managers'), ['track_status' => 'closed'], ['id' => $managerId]);
                Inbox::add($managerId, 'Отборът не завърши сезона в топ 5 и кметът затвори собствената ти тренировъчна писта. Нови преговори могат да я отворят отново.');
            }
        }
    }

    private static function prize(int $position): int
    {
        if ($position <= 5) {
            return Settings::int('season_prize_' . $position);
        }
        return $position <= 10 ? Settings::int('season_prize_rest') : 0;
    }

    private static function positions(int $season): array
    {
        global $wpdb;
        $entries = Tables::name('entries');
        $runs = Tables::name('rally_runs');
        $rallies = Registry::get('rallies')->table();

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT e.class, e.manager_id, e.bot_id, SUM(e.points) AS points, SUM(e.place = 1) AS wins
             FROM $entries e JOIN $rallies r ON r.id = e.rally_id JOIN $runs ru ON ru.rally_id = e.rally_id
             WHERE r.season = %d AND ru.published = 1
             GROUP BY e.class, e.manager_id, e.bot_id
             ORDER BY e.class DESC, points DESC, wins DESC",
            $season
        ), ARRAY_A);

        $positions = [];
        $counters = [];
        foreach ($rows as $row) {
            $class = (int) $row['class'];
            $counters[$class] = ($counters[$class] ?? 0) + 1;
            if ((int) $row['manager_id'] > 0) {
                $positions[(int) $row['manager_id']] = [$class, $counters[$class]];
            }
        }
        return $positions;
    }
}
