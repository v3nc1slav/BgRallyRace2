<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Database\Tables;
use BgRally\I18n;
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
        $closed = Tables::name('seasons');
        if ($open || $unpublished || $wpdb->get_var($wpdb->prepare("SELECT 1 FROM $closed WHERE season = %d", $season))) {
            return;
        }

        $positions = self::positions($season);
        self::reserve($season, $positions);
        self::payOut($season);

        $tracks = $wpdb->get_results("SELECT id FROM " . Tables::name('managers') . " WHERE track_status IN ('open', 'building')", ARRAY_A);
        foreach ($tracks as $row) {
            $managerId = (int) $row['id'];
            if (!isset($positions[$managerId]) || $positions[$managerId][1] > 5) {
                $wpdb->update(Tables::name('managers'), ['track_status' => 'closed'], ['id' => $managerId]);
                Inbox::add($managerId, I18n::t('server.seasons.trackClosed', [], I18n::of($managerId)));
            }
        }

        $wpdb->query($wpdb->prepare("INSERT IGNORE INTO $closed (season, closed_at) VALUES (%d, %s)", $season, current_time('mysql')));
    }

    public static function closeDue(): void
    {
        global $wpdb;
        $rallies = Registry::get('rallies')->table();
        $closed = Tables::name('seasons');
        foreach ($wpdb->get_col("SELECT DISTINCT r.season FROM $rallies r LEFT JOIN $closed s ON s.season = r.season WHERE s.season IS NULL") as $season) {
            self::maybeClose((int) $season);
        }
    }

    private static function reserve(int $season, array $positions): void
    {
        global $wpdb;
        $rows = [];
        foreach ($positions as $managerId => [$class, $position]) {
            $rows[] = $wpdb->prepare('(%d, %d, %s, %d)', $season, $managerId, (string) $class, $position);
        }
        if ($rows) {
            $wpdb->query('INSERT IGNORE INTO ' . Tables::name('season_prizes') . ' (season, manager_id, class, place) VALUES ' . implode(', ', $rows));
        }
    }

    private static function payOut(int $season): void
    {
        global $wpdb;
        $table = Tables::name('season_prizes');
        foreach ($wpdb->get_results($wpdb->prepare("SELECT manager_id, class, place FROM $table WHERE season = %d AND paid = 0", $season), ARRAY_A) as $row) {
            $managerId = (int) $row['manager_id'];
            if ($wpdb->query($wpdb->prepare("UPDATE $table SET paid = 1 WHERE season = %d AND manager_id = %d AND paid = 0", $season, $managerId)) === 1) {
                self::award($season, $managerId, (int) $row['class'], (int) $row['place']);
            }
        }
    }

    private static function award(int $season, int $managerId, int $class, int $position): void
    {
        $prize = self::prize($position);
        $xp = $position <= 3 ? Settings::int('season_xp_' . $position) : 0;
        if ($prize) {
            Ledger::add($managerId, $prize, 'season_prize', I18n::t('server.ledger.season', ['season' => $season, 'place' => $position], I18n::of($managerId)));
        }
        if ($position <= 3 && $xp) {
            Progress::addXp($managerId, $xp);
        }
        I18n::as($managerId, fn() => Inbox::add($managerId, I18n::t(
            $prize ? ($position <= 3 && $xp ? 'server.seasons.prizeXp' : 'server.seasons.prize') : 'server.seasons.place',
            ['season' => $season, 'place' => $position, 'class' => Labels::classLabel($class), 'money' => I18n::money($prize), 'xp' => $xp]
        )));
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
