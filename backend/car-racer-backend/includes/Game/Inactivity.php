<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\Settings;
use WP_Error;

final class Inactivity
{
    private static function table(): string
    {
        return Tables::name('managers');
    }

    public static function isInactive(array $manager): bool
    {
        return !empty($manager['inactive_since']);
    }

    public static function touch(array $manager): array
    {
        global $wpdb;
        if (self::isInactive($manager)) {
            $manager = self::comeback($manager);
        }
        $today = wp_date('Y-m-d');
        if (($manager['seen_date'] ?? null) !== $today) {
            $wpdb->update(self::table(), ['seen_date' => $today], ['id' => $manager['id']]);
            $manager['seen_date'] = $today;
        }
        return $manager;
    }

    public static function mark(): void
    {
        global $wpdb;
        $limit = date('Y-m-d', Rallies::now() - Settings::int('inactive_days') * DAY_IN_SECONDS);
        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT id FROM ' . self::table() . ' WHERE inactive_since IS NULL AND seen_date IS NOT NULL AND seen_date < %s LIMIT 200',
            $limit
        ), ARRAY_A);

        foreach ($rows as $row) {
            $managerId = (int) $row['id'];
            $notes = [];
            $refund = BlackTrack::cancelOpen($managerId);
            if ($refund) {
                $notes[] = sprintf('Отворените ти предизвикателства на черната писта бяха отменени и %d € са върнати.', $refund);
            }
            $wpdb->update(self::table(), ['inactive_since' => current_time('mysql'), 'inactive_notes' => wp_json_encode($notes)], ['id' => $managerId]);
        }
    }

    private static function comeback(array $manager): array
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $frozen = max(0, Rallies::now() - strtotime($manager['inactive_since']));
        $frozenDays = max(1, (int) round($frozen / DAY_IN_SECONDS));
        $away = $manager['seen_date'] ? (int) floor((strtotime(wp_date('Y-m-d')) - strtotime($manager['seen_date'])) / DAY_IN_SECONDS) : $frozenDays;

        $notes = json_decode((string) $manager['inactive_notes'], true) ?: [];
        if (Staff::rows($managerId)) {
            $notes[] = 'Заплатите на служителите не бяха начислявани и никой не напусна.';
        }
        if (Bank::active($managerId)) {
            $notes[] = 'Вноските по заема бяха спрени, без наказателна лихва. Плащанията продължават от следващия понеделник.';
        }
        if (Work::job($manager)) {
            $notes[] = 'Заплатата от работата беше спряна. Продължава от утре.';
        }
        $extended = (int) $wpdb->query($wpdb->prepare(
            'UPDATE ' . Tables::name('contracts') . " SET ends_at = DATE_ADD(ends_at, INTERVAL %d SECOND) WHERE manager_id = %d AND status = 'active' AND ends_at IS NOT NULL",
            $frozen,
            $managerId
        ));
        if ($extended) {
            $notes[] = sprintf('Договорите със спонсорите са удължени с %d дни.', $frozenDays);
        }

        $comeback = ['days' => $away, 'notes' => $notes, 'fresh' => self::freshAmount($manager, $away), 'cooldown' => Settings::int('fresh_cooldown'), 'loan_weeks' => Settings::int('fresh_loan_weeks')];
        $changes = [
            'inactive_since' => null,
            'inactive_notes' => '',
            'comeback' => wp_json_encode($comeback),
            'payroll_week' => Rallies::week(),
            'job_date' => wp_date('Y-m-d'),
        ];
        $wpdb->update(self::table(), $changes, ['id' => $managerId]);
        Inbox::add($managerId, trim(sprintf('Добре дошъл отново след %d дни! %s', $away, implode(' ', $notes))));

        return array_merge($manager, $changes);
    }

    public static function freshAmount(array $manager, int $away): ?int
    {
        if ($away < Settings::int('fresh_days')) {
            return null;
        }
        $loan = Bank::summary((int) $manager['id']);
        if ((int) $manager['money'] >= 0 && !($loan && $loan['overdue'] > 0)) {
            return null;
        }
        if ($manager['fresh_at'] && strtotime($manager['fresh_at']) > Rallies::now() - Settings::int('fresh_cooldown') * DAY_IN_SECONDS) {
            return null;
        }
        return Settings::int('fresh_base') + Settings::int('fresh_per_level') * max(0, (int) $manager['level'] - 1);
    }

    public static function info(array $manager): ?array
    {
        $info = json_decode((string) ($manager['comeback'] ?? ''), true);
        return is_array($info) ? $info : null;
    }

    public static function resolve(array $manager, string $choice): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $info = self::info($manager);
        if (!$info) {
            return new WP_Error('bgr_comeback', 'Няма какво да се потвърди.', ['status' => 400]);
        }
        $wpdb->update(self::table(), ['comeback' => ''], ['id' => $managerId]);

        if ($choice !== 'fresh' || empty($info['fresh'])) {
            return 'Продължаваш оттам, докъдето беше стигнал.';
        }

        $target = (int) $info['fresh'];
        $wpdb->query($wpdb->prepare(
            'UPDATE ' . Tables::name('loans') . " SET status = 'forgiven', remaining = 0, overdue = 0, missed = 0, closed_at = %s WHERE manager_id = %d AND status = 'active'",
            current_time('mysql'),
            $managerId
        ));
        $money = (int) $wpdb->get_var($wpdb->prepare('SELECT money FROM ' . self::table() . ' WHERE id = %d', $managerId));
        if ($money < $target) {
            Ledger::add($managerId, $target - $money, 'fresh_start', 'Ново начало');
        }
        $wpdb->update(self::table(), ['fresh_at' => current_time('mysql')], ['id' => $managerId]);

        $until = Rallies::now() + Settings::int('fresh_loan_weeks') * WEEK_IN_SECONDS;
        $message = sprintf('Започваш на чисто: дълговете са изчистени и имаш %d €. Нов заем може да се тегли след %s.', max($money, $target), date('d.m.Y', $until));
        Inbox::add($managerId, $message);
        return $message;
    }

    public static function loanBlockedUntil(array $manager): ?int
    {
        if (empty($manager['fresh_at'])) {
            return null;
        }
        $until = strtotime($manager['fresh_at']) + Settings::int('fresh_loan_weeks') * WEEK_IN_SECONDS;
        return $until > Rallies::now() ? $until : null;
    }
}
