<?php

namespace BgRally\Game;

use BgRally\Catalog\Texts;
use BgRally\Database\Tables;
use BgRally\I18n;
use BgRally\Settings;
use WP_Error;

final class BlackTrack
{
    private static function table(): string
    {
        return Tables::name('street_races');
    }

    public static function limits(array $manager): array
    {
        return ['min' => Settings::int('black_bet_min'), 'max' => max(Settings::int('black_bet_min'), Settings::int('black_bet_per_level') * (int) $manager['level'])];
    }

    private static function teamName(int $managerId): string
    {
        $manager = Managers::find($managerId);
        $user = $manager ? get_userdata((int) $manager['user_id']) : null;
        return $user ? $user->display_name : I18n::t('server.common.team');
    }

    private static function stageName(int $stageId): string
    {
        $stages = \BgRally\Catalog\Registry::get('stages')->find($stageId);
        return isset($stages['name']) ? Texts::of($stages['name']) : I18n::t('server.black.stage');
    }

    public static function view(array $manager): array
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $cityId = (int) $manager['city_id'];

        $open = $wpdb->get_results($wpdb->prepare(
            'SELECT * FROM ' . self::table() . " WHERE city_id = %d AND status = 'open' ORDER BY id DESC LIMIT 50",
            $cityId
        ), ARRAY_A);
        $history = $wpdb->get_results($wpdb->prepare(
            'SELECT * FROM ' . self::table() . " WHERE status = 'done' AND (challenger_id = %d OR opponent_id = %d) ORDER BY id DESC LIMIT 10",
            $managerId,
            $managerId
        ), ARRAY_A);

        $challenge = fn(array $row) => [
            'id' => (int) $row['id'],
            'team' => self::teamName((int) $row['challenger_id']),
            'stage' => self::stageName((int) $row['stage_id']),
            'bet' => (int) $row['bet'],
            'mine' => (int) $row['challenger_id'] === $managerId,
        ];

        return [
            'stages' => Training::stagesView($manager),
            'limits' => self::limits($manager),
            'energy' => Settings::int('black_energy'),
            'risk' => Police::blackRisk($managerId),
            'fine' => Settings::int('fine_black'),
            'skill_chance' => Settings::int('black_skill_chance'),
            'trained_today' => Training::trainedToday($manager),
            'challenges' => array_map($challenge, $open),
            'history' => array_map(function (array $row) use ($managerId) {
                $mine = (int) $row['challenger_id'] === $managerId;
                $rival = $mine ? ((int) $row['opponent_id'] ? self::teamName((int) $row['opponent_id']) : $row['bot_name']) : self::teamName((int) $row['challenger_id']);
                return [
                    'id' => (int) $row['id'],
                    'rival' => $rival,
                    'stage' => self::stageName((int) $row['stage_id']),
                    'bet' => (int) $row['bet'],
                    'won' => (int) $row['winner_id'] === $managerId,
                    'my_ms' => (int) ($mine ? $row['challenger_ms'] : $row['opponent_ms']),
                    'rival_ms' => (int) ($mine ? $row['opponent_ms'] : $row['challenger_ms']),
                    'caught' => (bool) ($mine ? $row['challenger_caught'] : $row['opponent_caught']),
                    'at' => str_replace(' ', 'T', (string) $row['resolved_at']),
                ];
            }, $history),
        ];
    }

    private static function prepare(array $manager, int $stageId, int $bet): array|WP_Error
    {
        $stage = null;
        foreach (Training::cityStages((int) $manager['city_id']) as $row) {
            if ((int) $row['id'] === $stageId) {
                $stage = $row;
            }
        }
        if (!$stage) {
            return new WP_Error('bgr_stage', I18n::t('server.black.inCity'), ['status' => 400]);
        }

        $limits = self::limits($manager);
        if ($bet < $limits['min'] || $bet > $limits['max']) {
            return new WP_Error('bgr_bet', I18n::t('server.black.betRange', ['min' => I18n::money($limits['min']), 'max' => I18n::money($limits['max'])]), ['status' => 400]);
        }

        $crew = Simulator::streetCrew((int) $manager['id']);
        if (!$crew) {
            return new WP_Error('bgr_not_ready', I18n::t('server.black.notReady'), ['status' => 400]);
        }

        return ['stage' => $stage, 'crew' => $crew];
    }

    private static function pay(array $manager, int $bet): true|WP_Error
    {
        $managerId = (int) $manager['id'];
        $energy = Settings::int('black_energy');

        if ((int) $manager['money'] < $bet) {
            return new WP_Error('bgr_money', I18n::t('server.black.noMoney'), ['status' => 400]);
        }
        if (!Energy::spend($managerId, $energy)) {
            return new WP_Error('bgr_energy', I18n::t('server.common.energyNeed', ['energy' => $energy]), ['status' => 400]);
        }
        if (!Ledger::add($managerId, -$bet, 'black_bet', I18n::t('server.ledger.blackBet'))) {
            Energy::refund($managerId, $energy);
            return new WP_Error('bgr_money', I18n::t('server.black.noMoney'), ['status' => 400]);
        }
        return true;
    }

    private static function lap(array $crew, array $stage): float
    {
        $time = Simulator::stageTime($crew, $stage, 'normal', 'dry');
        if (mt_rand(1, 1000) <= 100 * (1 - $crew['nav_skill'] / 200)) {
            $time += mt_rand(5, 15);
        }
        return $time;
    }

    public static function challenge(array $manager, int $stageId, int $bet): string|WP_Error
    {
        global $wpdb;
        $prepared = self::prepare($manager, $stageId, $bet);
        if (is_wp_error($prepared)) {
            return $prepared;
        }
        $paid = self::pay($manager, $bet);
        if (is_wp_error($paid)) {
            return $paid;
        }

        $wpdb->insert(self::table(), [
            'city_id' => (int) $manager['city_id'],
            'stage_id' => $stageId,
            'challenger_id' => (int) $manager['id'],
            'bet' => $bet,
            'status' => 'open',
            'created_at' => current_time('mysql'),
        ]);

        return I18n::t('server.black.posted', ['money' => I18n::money($bet), 'stage' => Texts::of($prepared['stage']['name'])]);
    }

    public static function cancel(array $manager, int $id): string|WP_Error
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table() . " WHERE id = %d AND challenger_id = %d AND status = 'open'", $id, $manager['id']), ARRAY_A);
        if (!$row || $wpdb->query($wpdb->prepare('UPDATE ' . self::table() . " SET status = 'cancelled' WHERE id = %d AND status = 'open'", $id)) !== 1) {
            return new WP_Error('bgr_challenge', I18n::t('server.black.noOpen'), ['status' => 404]);
        }

        Ledger::add((int) $manager['id'], (int) $row['bet'], 'black_refund', I18n::t('server.ledger.blackCancel'));
        return I18n::t('server.black.cancelled');
    }

    public static function cancelOpen(int $managerId): int
    {
        global $wpdb;
        $refund = 0;
        $rows = $wpdb->get_results($wpdb->prepare('SELECT id, bet FROM ' . self::table() . " WHERE challenger_id = %d AND status = 'open'", $managerId), ARRAY_A);

        foreach ($rows as $row) {
            if ($wpdb->query($wpdb->prepare('UPDATE ' . self::table() . " SET status = 'cancelled' WHERE id = %d AND status = 'open'", $row['id'])) === 1) {
                Ledger::add($managerId, (int) $row['bet'], 'black_refund', I18n::t('server.ledger.blackCancel', [], I18n::of($managerId)));
                $refund += (int) $row['bet'];
            }
        }
        return $refund;
    }

    public static function accept(array $manager, int $id): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $row = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table() . " WHERE id = %d AND status = 'open'", $id), ARRAY_A);

        if (!$row || (int) $row['city_id'] !== (int) $manager['city_id']) {
            return new WP_Error('bgr_challenge', I18n::t('server.black.closed'), ['status' => 404]);
        }
        if ((int) $row['challenger_id'] === $managerId) {
            return new WP_Error('bgr_challenge', I18n::t('server.black.own'), ['status' => 400]);
        }

        $bet = (int) $row['bet'];
        $prepared = self::prepare($manager, (int) $row['stage_id'], min($bet, self::limits($manager)['max']));
        if (is_wp_error($prepared)) {
            return $prepared;
        }
        if ($bet > self::limits($manager)['max']) {
            return new WP_Error('bgr_bet', I18n::t('server.black.overLimit'), ['status' => 400]);
        }

        $challengerId = (int) $row['challenger_id'];
        $rival = Simulator::streetCrew($challengerId);
        if (!$rival) {
            $wpdb->update(self::table(), ['status' => 'cancelled'], ['id' => $id]);
            $rivalLang = I18n::of($challengerId);
            Ledger::add($challengerId, $bet, 'black_refund', I18n::t('server.ledger.blackCancel', [], $rivalLang));
            Inbox::add($challengerId, I18n::t('server.black.rivalNotReadyInbox', [], $rivalLang));
            return new WP_Error('bgr_challenge', I18n::t('server.black.rivalNotReady'), ['status' => 400]);
        }

        $paid = self::pay($manager, $bet);
        if (is_wp_error($paid)) {
            return $paid;
        }
        if ($wpdb->query($wpdb->prepare('UPDATE ' . self::table() . " SET status = 'done' WHERE id = %d AND status = 'open'", $id)) !== 1) {
            Ledger::add($managerId, $bet, 'black_refund', I18n::t('server.ledger.blackTaken'));
            return new WP_Error('bgr_challenge', I18n::t('server.black.taken'), ['status' => 409]);
        }

        $stage = $prepared['stage'];
        $times = [$challengerId => self::lap($rival, $stage), $managerId => self::lap($prepared['crew'], $stage)];
        $winner = $times[$managerId] < $times[$challengerId] ? $managerId : $challengerId;
        $loser = $winner === $managerId ? $challengerId : $managerId;
        $caught = [$challengerId => Police::caught(Police::blackRisk($challengerId)), $managerId => Police::caught(Police::blackRisk($managerId))];

        $payout = [$challengerId => 0, $managerId => 0];
        if (!$caught[$winner]) {
            $payout[$winner] = $caught[$loser] ? $bet : 2 * $bet;
        } elseif (!$caught[$loser]) {
            $payout[$loser] = $bet;
        }

        foreach ([$challengerId => $rival, $managerId => $prepared['crew']] as $id2 => $crew) {
            Garage::applyWear(Simulator::streetWear($crew, $stage, Settings::get('black_wear')));
            if ($payout[$id2]) {
                Ledger::add($id2, $payout[$id2], 'black_win', I18n::t('server.ledger.black', [], I18n::of($id2)));
            }
            if ($caught[$id2]) {
                Police::fine($id2, Settings::int('fine_black'), I18n::t('server.ledger.black', [], I18n::of($id2)));
            }
        }

        $wpdb->update(self::table(), [
            'opponent_id' => $managerId,
            'winner_id' => $winner,
            'challenger_ms' => (int) round($times[$challengerId] * 1000),
            'opponent_ms' => (int) round($times[$managerId] * 1000),
            'challenger_caught' => $caught[$challengerId] ? 1 : 0,
            'opponent_caught' => $caught[$managerId] ? 1 : 0,
            'resolved_at' => current_time('mysql'),
        ], ['id' => $id]);

        $describe = fn(int $who, string $rivalName) => I18n::t('server.black.result', [
            'stage' => Texts::of($stage['name']),
            'rival' => $rivalName,
            'mine' => Simulator::formatTime($times[$who]),
            'theirs' => Simulator::formatTime($times[$who === $managerId ? $challengerId : $managerId]),
            'outcome' => I18n::t($who === $winner ? 'server.black.win' : 'server.black.loss'),
        ]) . ($caught[$who]
            ? ' ' . I18n::t('server.black.caught', ['money' => I18n::money(Settings::int('fine_black'))])
            : ($payout[$who] ? ' ' . I18n::t('server.black.payout', ['money' => I18n::money($payout[$who])]) : ''));

        $xp = [];
        foreach ([$challengerId, $managerId] as $who) {
            $xp[$who] = I18n::as($who, fn() => Progress::addDaily($who, $who === $winner ? 'xp_black_win' : 'xp_black_loss'));
        }

        I18n::as($challengerId, fn() => Inbox::add($challengerId, $describe($challengerId, self::teamName($managerId)) . $xp[$challengerId]));
        return $describe($managerId, self::teamName($challengerId)) . $xp[$managerId];
    }

    public static function botRace(array $manager, int $stageId, int $bet): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $prepared = self::prepare($manager, $stageId, $bet);
        if (is_wp_error($prepared)) {
            return $prepared;
        }
        $paid = self::pay($manager, $bet);
        if (is_wp_error($paid)) {
            return $paid;
        }

        $stage = $prepared['stage'];
        $bot = Simulator::streetBot($prepared['crew']);
        $mine = self::lap($prepared['crew'], $stage);
        $theirs = self::lap($bot, $stage);
        $won = $mine < $theirs;
        $caught = Police::caught(Police::blackRisk($managerId));

        Garage::applyWear(Simulator::streetWear($prepared['crew'], $stage, Settings::get('black_wear')));
        if ($won && !$caught) {
            Ledger::add($managerId, 2 * $bet, 'black_win', I18n::t('server.ledger.black'));
        }
        if ($caught) {
            Police::fine($managerId, Settings::int('fine_black'), I18n::t('server.ledger.black'));
        }

        $wpdb->insert(self::table(), [
            'city_id' => (int) $manager['city_id'],
            'stage_id' => $stageId,
            'challenger_id' => $managerId,
            'bot_name' => $bot['pilot'],
            'bet' => $bet,
            'status' => 'done',
            'winner_id' => $won ? $managerId : 0,
            'challenger_ms' => (int) round($mine * 1000),
            'opponent_ms' => (int) round($theirs * 1000),
            'challenger_caught' => $caught ? 1 : 0,
            'created_at' => current_time('mysql'),
            'resolved_at' => current_time('mysql'),
        ]);

        $xp = Progress::addDaily($managerId, $won ? 'xp_black_win' : 'xp_black_loss');
        $message = I18n::t('server.black.botResult', [
            'stage' => Texts::of($stage['name']),
            'rival' => $bot['pilot'],
            'mine' => Simulator::formatTime($mine),
            'theirs' => Simulator::formatTime($theirs),
            'outcome' => I18n::t($won ? 'server.black.win' : 'server.black.loss'),
        ]);
        if ($caught) {
            return $message . ' ' . I18n::t('server.black.caught', ['money' => I18n::money(Settings::int('fine_black'))]) . $xp;
        }
        return $message . ' ' . ($won ? I18n::t('server.black.won', ['money' => I18n::money(2 * $bet)]) : I18n::t('server.black.lost')) . $xp;
    }
}
