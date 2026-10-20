<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Database\Tables;
use BgRally\Settings;
use WP_Error;

final class Sabotage
{
    private static function table(): string
    {
        return Tables::name('sabotages');
    }

    private static function entry(int $rallyId, int $managerId): ?array
    {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . Tables::name('entries') . ' WHERE rally_id = %d AND manager_id = %d', $rallyId, $managerId), ARRAY_A);
    }

    private static function usedThisWeek(int $managerId): bool
    {
        global $wpdb;
        return (bool) $wpdb->get_var($wpdb->prepare('SELECT 1 FROM ' . self::table() . ' WHERE manager_id = %d AND week = %s LIMIT 1', $managerId, Rallies::week()));
    }

    private static function targets(array $manager, array $entry): array
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT e.manager_id, m.level FROM ' . Tables::name('entries') . ' e JOIN ' . Tables::name('managers') . ' m ON m.id = e.manager_id
             WHERE e.rally_id = %d AND e.class = %s AND e.manager_id > 0 AND e.manager_id <> %d AND m.level >= %d
             AND e.manager_id NOT IN (SELECT target_id FROM ' . self::table() . ' WHERE rally_id = %d AND manager_id = %d)
             ORDER BY e.start_number',
            $entry['rally_id'],
            $entry['class'],
            $managerId,
            (int) $manager['level'] - Settings::int('sabotage_level_gap'),
            $entry['rally_id'],
            $managerId
        ), ARRAY_A);

        return array_map(fn($row) => ['id' => (int) $row['manager_id'], 'team' => Managers::name((int) $row['manager_id']), 'level' => (int) $row['level']], $rows);
    }

    public static function panel(array $manager, array $rally, array $entry, array $saboteur): array
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $orders = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE rally_id = %d AND manager_id = %d ORDER BY id', $rally['id'], $managerId), ARRAY_A);

        return [
            'saboteur' => ['name' => $saboteur['name'], 'skill' => (int) $saboteur['skill']],
            'open' => Rallies::state($rally) === 'open',
            'used_week' => self::usedThisWeek($managerId),
            'cost' => Settings::int('sabotage_cost'),
            'energy' => Settings::int('sabotage_energy'),
            'level_gap' => Settings::int('sabotage_level_gap'),
            'kinds' => Labels::SABOTAGE_KINDS,
            'targets' => self::targets($manager, $entry),
            'orders' => array_map(fn($row) => [
                'team' => Managers::name((int) $row['target_id']),
                'kind_label' => Labels::SABOTAGE_KINDS[$row['kind']] ?? $row['kind'],
                'status_label' => Labels::SABOTAGE_STATUSES[$row['status']] ?? $row['status'],
                'caught' => (bool) $row['caught'],
            ], $orders),
        ];
    }

    public static function order(array $manager, int $rallyId, int $targetId, string $kind): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $rally = Registry::get('rallies')->find($rallyId);
        $saboteur = Staff::member($managerId, 'saboteur');

        if (!$rally) {
            return new WP_Error('bgr_not_found', 'Няма такова рали.', ['status' => 404]);
        }
        if (!$saboteur) {
            return new WP_Error('bgr_saboteur', 'Нямаш саботьор. Наема се в бара с гараж ниво 5.', ['status' => 400]);
        }
        if (!isset(Labels::SABOTAGE_KINDS[$kind])) {
            return new WP_Error('bgr_kind', 'Няма такъв саботаж.', ['status' => 400]);
        }
        if (Rallies::state($rally) !== 'open') {
            return new WP_Error('bgr_closed', 'Саботаж се поръчва, докато записването е отворено.', ['status' => 400]);
        }
        $entry = self::entry($rallyId, $managerId);
        if (!$entry) {
            return new WP_Error('bgr_entry', 'Трябва да си записан за ралито.', ['status' => 400]);
        }
        if (self::usedThisWeek($managerId)) {
            return new WP_Error('bgr_week', 'Саботьорът вече има поръчка тази седмица.', ['status' => 400]);
        }
        $target = array_values(array_filter(self::targets($manager, $entry), fn($row) => $row['id'] === $targetId))[0] ?? null;
        if (!$target) {
            return new WP_Error('bgr_target', sprintf('Целта трябва да е друг отбор от твоя клас в това рали, не повече от %d нива под теб.', Settings::int('sabotage_level_gap')), ['status' => 400]);
        }

        $energy = Settings::int('sabotage_energy');
        if (!Energy::spend($managerId, $energy)) {
            return new WP_Error('bgr_energy', sprintf('Нямате достатъчно енергия (нужни са %d).', $energy), ['status' => 400]);
        }
        if (!Ledger::add($managerId, -Settings::int('sabotage_cost'), 'sabotage', 'Материали за саботаж')) {
            Energy::refund($managerId, $energy);
            return new WP_Error('bgr_money', sprintf('Материалите струват %d €.', Settings::int('sabotage_cost')), ['status' => 400]);
        }

        $wpdb->insert(self::table(), [
            'rally_id' => $rallyId,
            'manager_id' => $managerId,
            'target_id' => $targetId,
            'kind' => $kind,
            'status' => 'planned',
            'week' => Rallies::week(),
            'created_at' => current_time('mysql'),
        ]);
        self::warn((int) $wpdb->insert_id, $targetId, $rally);

        return sprintf('Саботьорът %s ще действа срещу %s при старта на „%s“.', $saboteur['name'], $target['team'], $rally['name']);
    }

    private static function warn(int $sabotageId, int $targetId, array $rally): void
    {
        global $wpdb;
        $informant = Staff::member($targetId, 'informant');
        if (!$informant) {
            return;
        }
        $skill = (int) $informant['skill'];
        if (mt_rand(1, 100) > min(Settings::int('warn_max'), Settings::int('warn_base') + intdiv($skill, 2))) {
            return;
        }

        $wpdb->update(self::table(), ['warned' => 1], ['id' => $sabotageId]);
        $text = sprintf('Информаторът %s научи, че се готви саботаж срещу колата ти за „%s“.', $informant['name'], $rally['name']);

        if ($skill >= Settings::int('warn_names_skill')) {
            $real = array_map('intval', $wpdb->get_col($wpdb->prepare(
                'SELECT DISTINCT manager_id FROM ' . self::table() . ' WHERE rally_id = %d AND target_id = %d AND warned = 1',
                $rally['id'],
                $targetId
            )));
            $suspects = self::suspects($targetId, (int) $rally['id'], $real);
            $wpdb->update(self::table(), ['suspects' => wp_json_encode($suspects)], ['id' => $sabotageId]);
            $text .= ' Заподозрени: ' . implode(', ', array_map(fn($s) => sprintf('%s %d%%', $s['team'], $s['chance']), $suspects)) . '.';
        }

        Inbox::add($targetId, mb_strimwidth($text, 0, 255, '…'));
        Push::notify($targetId, 'sabotage', 'Готви се саботаж', $text, 'rallies/' . $rally['id']);
    }

    private static function split(int $total, int $parts): array
    {
        if ($parts < 1) {
            return [];
        }
        $weights = array_map(fn() => mt_rand(70, 130), range(1, $parts));
        $sum = array_sum($weights);
        $shares = array_map(fn($weight) => (int) floor($total * $weight / $sum), $weights);
        $shares[0] += $total - array_sum($shares);
        return $shares;
    }

    private static function suspects(int $targetId, int $rallyId, array $real): array
    {
        global $wpdb;
        $exclude = array_merge($real, [$targetId]);

        $pool = array_values(array_diff(array_map('intval', $wpdb->get_col($wpdb->prepare(
            'SELECT manager_id FROM ' . Tables::name('entries') . ' WHERE rally_id = %d AND manager_id > 0',
            $rallyId
        ))), $exclude));
        shuffle($pool);
        $random = array_slice($pool, 0, 2);

        if (count($random) < 2) {
            $others = array_map('intval', $wpdb->get_col('SELECT id FROM ' . Tables::name('managers') . ' WHERE banned_at IS NULL ORDER BY RAND() LIMIT 10'));
            foreach (array_diff($others, $exclude, $random) as $id) {
                if (count($random) < 2) {
                    $random[] = $id;
                }
            }
        }

        $realShare = !$random ? 100 : (count($real) === 1 ? mt_rand(36, 44) : 70);
        $chances = array_combine($real, count($real) === 1 ? [$realShare] : self::split($realShare, count($real)))
            + ($random ? array_combine($random, self::split(100 - $realShare, count($random))) : []);

        $suspects = [];
        foreach ($chances as $id => $chance) {
            $suspects[] = ['team' => Managers::name((int) $id), 'chance' => $chance];
        }
        shuffle($suspects);
        return $suspects;
    }

    public static function warnings(int $managerId, int $rallyId): array
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT suspects, created_at FROM ' . self::table() . ' WHERE rally_id = %d AND target_id = %d AND warned = 1 ORDER BY id',
            $rallyId,
            $managerId
        ), ARRAY_A);

        return array_map(fn($row) => [
            'at' => str_replace(' ', 'T', $row['created_at']),
            'suspects' => $row['suspects'] ? json_decode($row['suspects'], true) : null,
        ], $rows);
    }

    public static function resolve(int $rallyId): array
    {
        global $wpdb;
        $rally = Registry::get('rallies')->find($rallyId);
        $rows = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . self::table() . " WHERE rally_id = %d AND status = 'planned' ORDER BY id", $rallyId), ARRAY_A);
        $effects = [];

        foreach ($rows as $row) {
            $ordererId = (int) $row['manager_id'];
            $targetId = (int) $row['target_id'];
            $saboteur = Staff::member($ordererId, 'saboteur');
            $target = Managers::find($targetId);
            $entry = self::entry($rallyId, $targetId);
            $skill = $saboteur ? (int) $saboteur['skill'] : 0;

            $chance = Settings::int('sabotage_base') + intdiv($skill, 4)
                - ($target && GarageLevels::hasSecurity((int) $target['garage_level']) ? Settings::int('sabotage_security') : 0)
                - ($row['warned'] ? Settings::int('sabotage_warned') : 0);
            $chance = max(Settings::int('sabotage_min'), min(Settings::int('sabotage_max'), $chance));
            $success = $saboteur && $entry && mt_rand(1, 100) <= $chance;

            if ($success && $row['kind'] === 'tyres') {
                $wpdb->query($wpdb->prepare(
                    'UPDATE ' . Tables::name('items') . " SET health = GREATEST(0, health - %d) WHERE player_car_id = %d AND kind = 'tyre'",
                    Settings::int('sabotage_tyres'),
                    $entry['player_car_id']
                ));
            } elseif ($success) {
                $effects[$targetId]['engine'] = ($effects[$targetId]['engine'] ?? 1) * Settings::get('sabotage_engine');
            }

            $bribed = Police::active($ordererId, 'police') || Police::active($ordererId, 'mayor');
            $catch = max(Settings::int('catch_min'), Settings::int('catch_base') - intdiv($skill, 5)) * ($success ? 1 : 2) * ($bribed ? 0.5 : 1);
            $caught = $saboteur && mt_rand(1, 100) <= $catch;

            $wpdb->update(self::table(), [
                'status' => $success ? 'success' : 'failed',
                'caught' => $caught ? 1 : 0,
                'resolved_at' => current_time('mysql'),
            ], ['id' => $row['id']]);

            Inbox::add($ordererId, sprintf(
                $success ? 'Саботажът срещу %s в „%s“ успя.' : 'Саботажът срещу %s в „%s“ не успя.',
                Managers::name($targetId),
                $rally['name']
            ));
            if ($caught) {
                self::punish($row, $rally);
            }
        }

        return $effects;
    }

    private static function punish(array $row, array $rally): void
    {
        global $wpdb;
        $ordererId = (int) $row['manager_id'];
        $manager = Managers::find($ordererId);
        if (!$manager) {
            return;
        }
        $managers = Tables::name('managers');
        $staff = Tables::name('staff');
        $contracts = Tables::name('contracts');

        $fine = Settings::int('fine_sabotage') + Settings::int('fine_sabotage_per_level') * (int) $manager['level'];
        Ledger::add($ordererId, -$fine, 'fine', 'Саботаж', true);
        $wpdb->delete($staff, ['manager_id' => $ordererId, 'role' => 'saboteur']);
        $wpdb->query($wpdb->prepare(
            "UPDATE $managers SET track_status = IF(track_status IN ('building', 'open'), 'closed', track_status), track_ban_season = %d WHERE id = %d",
            Rallies::currentSeason(),
            $ordererId
        ));
        $wpdb->query($wpdb->prepare(
            "UPDATE $staff SET reputation = GREATEST(0, CAST(reputation AS SIGNED) - %d) WHERE manager_id = %d AND role IN ('pilot', 'navigator')",
            Settings::int('sabotage_reputation'),
            $ordererId
        ));

        $lost = [];
        $active = $wpdb->get_results($wpdb->prepare(
            "SELECT c.id, s.name FROM $contracts c JOIN " . Registry::get('sponsors')->table() . " s ON s.id = c.sponsor_id WHERE c.manager_id = %d AND c.status = 'active'",
            $ordererId
        ), ARRAY_A);
        foreach ($active as $contract) {
            if (mt_rand(1, 100) <= Settings::int('sabotage_sponsor_risk')) {
                $wpdb->update($contracts, ['status' => 'terminated'], ['id' => $contract['id']]);
                $lost[] = $contract['name'];
            }
        }
        $wpdb->query($wpdb->prepare(
            "UPDATE $contracts SET progress = GREATEST(0, CAST(progress AS SIGNED) - %d) WHERE manager_id = %d AND status = 'negotiating'",
            Settings::int('sabotage_progress_loss'),
            $ordererId
        ));

        $name = Managers::name($ordererId);
        Inbox::add($ordererId, mb_strimwidth(sprintf(
            'Полицията разкри саботажа ти в „%s“: глоба %d €, саботьорът е арестуван, пистата е затворена до следващия сезон%s.',
            $rally['name'],
            $fine,
            $lost ? ', договорът прекратиха: ' . implode(', ', $lost) : ''
        ), 0, 255, '…'));
        Inbox::add((int) $row['target_id'], sprintf('Полицията разкри саботаж срещу теб в „%s“, поръчан от %s.', $rally['name'], $name));
        Rumors::add((int) $manager['city_id'], sprintf('Полицията разкри саботаж, поръчан от %s.', $name), 'Полицията разкри саботаж, поръчан от отбор от града.');
    }

    public static function reportable(array $manager): array
    {
        global $wpdb;
        $rallies = Registry::get('rallies')->table();
        $now = Rallies::now();

        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT r.id, r.name, r.start_at FROM ' . Tables::name('entries') . " e JOIN $rallies r ON r.id = e.rally_id
             WHERE e.manager_id = %d AND e.sabotage_report = 0 AND r.status = 'finished' AND r.start_at BETWEEN %s AND %s
             ORDER BY r.start_at DESC",
            $manager['id'],
            date('Y-m-d H:i:s', $now - Settings::int('report_days') * DAY_IN_SECONDS),
            date('Y-m-d H:i:s', $now)
        ), ARRAY_A);

        return array_map(fn($row) => ['id' => (int) $row['id'], 'name' => $row['name'], 'start_at' => str_replace(' ', 'T', $row['start_at'])], $rows);
    }

    public static function report(array $manager, int $rallyId): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];

        if (!in_array($rallyId, array_column(self::reportable($manager), 'id'), true)) {
            return new WP_Error('bgr_report', sprintf('Сигнал се подава до %d дни след рали, в което си участвал, и само веднъж.', Settings::int('report_days')), ['status' => 400]);
        }
        $energy = Settings::int('report_energy');
        if (!Energy::spend($managerId, $energy)) {
            return new WP_Error('bgr_energy', sprintf('Нямате достатъчно енергия (нужни са %d).', $energy), ['status' => 400]);
        }
        $wpdb->update(Tables::name('entries'), ['sabotage_report' => 1], ['rally_id' => $rallyId, 'manager_id' => $managerId]);

        $rally = Registry::get('rallies')->find($rallyId);
        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT * FROM ' . self::table() . " WHERE rally_id = %d AND target_id = %d AND caught = 0 AND status <> 'planned'",
            $rallyId,
            $managerId
        ), ARRAY_A);
        $chance = Settings::int('report_chance') + (Staff::member($managerId, 'informant') ? Settings::int('report_informant') : 0);

        $found = [];
        foreach ($rows as $row) {
            if (mt_rand(1, 100) <= $chance) {
                $wpdb->update(self::table(), ['caught' => 1], ['id' => $row['id']]);
                self::punish($row, $rally);
                $found[] = Managers::name((int) $row['manager_id']);
            }
        }

        return $found
            ? sprintf('Полицията разкри саботаж срещу теб, поръчан от %s.', implode(' и ', array_unique($found)))
            : 'Полицията не откри следи от саботаж.';
    }
}
