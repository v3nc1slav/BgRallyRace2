<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\I18n;
use BgRally\Settings;
use WP_Error;

final class Bank
{
    public const TERMS = [4, 8, 12];
    private const MIN_AMOUNT = 100;

    private static function table(): string
    {
        return Tables::name('loans');
    }

    public static function active(int $managerId): ?array
    {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . self::table() . " WHERE manager_id = %d AND status = 'active' ORDER BY id DESC LIMIT 1",
            $managerId
        ), ARRAY_A);
    }

    public static function blocked(int $managerId): bool
    {
        $loan = self::active($managerId);
        return $loan !== null && (int) $loan['overdue'] > 0;
    }

    public static function maxAmount(array $manager): int
    {
        return (int) $manager['level'] * Settings::int('loan_per_level');
    }

    public static function rate(int $weeks): int
    {
        return Settings::int('loan_rate_' . $weeks);
    }

    private static function payoff(array $loan): int
    {
        $left = max(0, (int) $loan['weeks'] - (int) $loan['weeks_passed']);
        $unearned = (int) round((int) $loan['interest'] * $left / max(1, (int) $loan['weeks']));
        return max(0, (int) $loan['remaining'] - $unearned);
    }

    private static function nextDue(array $loan): int
    {
        return (int) $loan['overdue'] + min((int) $loan['installment'], (int) $loan['remaining'] - (int) $loan['overdue']);
    }

    public static function summary(int $managerId): ?array
    {
        $loan = self::active($managerId);
        return $loan ? ['remaining' => (int) $loan['remaining'], 'next' => self::nextDue($loan), 'overdue' => (int) $loan['overdue']] : null;
    }

    public static function view(array $manager): array
    {
        $loan = self::active((int) $manager['id']);

        return [
            'max' => self::maxAmount($manager),
            'min' => self::MIN_AMOUNT,
            'energy' => Settings::int('loan_energy'),
            'penalty' => Settings::int('loan_penalty'),
            'seize_after' => Settings::int('loan_seize_after'),
            'seize_pct' => Settings::int('loan_seize_pct'),
            'terms' => array_map(fn($weeks) => ['weeks' => $weeks, 'rate' => self::rate($weeks)], self::TERMS),
            'loan' => $loan ? [
                'principal' => (int) $loan['principal'],
                'interest' => (int) $loan['interest'],
                'weeks' => (int) $loan['weeks'],
                'installment' => (int) $loan['installment'],
                'remaining' => (int) $loan['remaining'],
                'overdue' => (int) $loan['overdue'],
                'missed' => (int) $loan['missed'],
                'weeks_passed' => (int) $loan['weeks_passed'],
                'next' => self::nextDue($loan),
                'payoff' => self::payoff($loan),
                'created_at' => str_replace(' ', 'T', $loan['created_at']),
            ] : null,
        ];
    }

    public static function take(array $manager, int $amount, int $weeks): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $max = self::maxAmount($manager);

        if (self::active($managerId)) {
            return new WP_Error('bgr_loan', I18n::t('server.bank.hasLoan'), ['status' => 400]);
        }
        $blocked = Inactivity::loanBlockedUntil($manager);
        if ($blocked) {
            return new WP_Error('bgr_fresh', I18n::t('server.bank.fresh', ['date' => I18n::date($blocked)]), ['status' => 400]);
        }
        if (!in_array($weeks, self::TERMS, true)) {
            return new WP_Error('bgr_term', I18n::t('server.bank.term'), ['status' => 400]);
        }
        if ($amount < self::MIN_AMOUNT || $amount > $max) {
            return new WP_Error('bgr_amount', I18n::t('server.bank.amount', ['min' => I18n::money(self::MIN_AMOUNT), 'max' => I18n::money($max)]), ['status' => 400]);
        }
        $energy = Settings::int('loan_energy');
        if (!Energy::spend($managerId, $energy)) {
            return new WP_Error('bgr_energy', I18n::t('server.common.energyNeed', ['energy' => $energy]), ['status' => 400]);
        }

        $interest = (int) round($amount * self::rate($weeks) / 100);
        $total = $amount + $interest;
        $installment = (int) ceil($total / $weeks);

        $wpdb->insert(self::table(), [
            'manager_id' => $managerId,
            'principal' => $amount,
            'interest' => $interest,
            'weeks' => $weeks,
            'installment' => $installment,
            'remaining' => $total,
            'status' => 'active',
            'created_at' => current_time('mysql'),
        ]);
        Ledger::add($managerId, $amount, 'loan', I18n::t('server.ledger.loan', ['weeks' => $weeks]));

        return I18n::t('server.bank.granted', ['amount' => I18n::money($amount), 'total' => I18n::money($total), 'weeks' => $weeks, 'installment' => I18n::money($installment)]);
    }

    private static function finish(int $loanId): void
    {
        global $wpdb;
        $wpdb->update(self::table(), ['remaining' => 0, 'overdue' => 0, 'missed' => 0, 'status' => 'paid', 'closed_at' => current_time('mysql')], ['id' => $loanId]);
    }

    public static function repay(array $manager): string|WP_Error
    {
        $managerId = (int) $manager['id'];
        $loan = self::active($managerId);
        if (!$loan) {
            return new WP_Error('bgr_loan', I18n::t('server.bank.noLoan'), ['status' => 400]);
        }

        $amount = self::payoff($loan);
        if (!Ledger::add($managerId, -$amount, 'loan_payment', I18n::t('server.ledger.loanEarly'))) {
            return new WP_Error('bgr_money', I18n::t('server.common.need', ['money' => I18n::money($amount)]), ['status' => 400]);
        }
        self::finish((int) $loan['id']);

        return I18n::t('server.bank.repaid', ['money' => I18n::money($amount)]);
    }

    public static function payOverdue(array $manager): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $loan = self::active($managerId);
        if (!$loan || !(int) $loan['overdue']) {
            return new WP_Error('bgr_loan', I18n::t('server.bank.noOverdue'), ['status' => 400]);
        }

        $overdue = (int) $loan['overdue'];
        if (!Ledger::add($managerId, -$overdue, 'loan_payment', I18n::t('server.ledger.overdue'))) {
            return new WP_Error('bgr_money', I18n::t('server.common.need', ['money' => I18n::money($overdue)]), ['status' => 400]);
        }

        $remaining = (int) $loan['remaining'] - $overdue;
        if ($remaining <= 0) {
            self::finish((int) $loan['id']);
            return I18n::t('server.bank.overduePaidAll');
        }
        $wpdb->update(self::table(), ['remaining' => $remaining, 'overdue' => 0, 'missed' => 0], ['id' => $loan['id']]);

        return I18n::t('server.bank.overduePaid', ['money' => I18n::money($overdue), 'left' => I18n::money($remaining)]);
    }

    public static function weekly(int $managerId): void
    {
        I18n::as($managerId, fn() => self::charge($managerId));
    }

    private static function charge(int $managerId): void
    {
        global $wpdb;
        $loan = self::active($managerId);
        if (!$loan) {
            return;
        }

        $loanId = (int) $loan['id'];
        $due = self::nextDue($loan);
        $remaining = (int) $loan['remaining'];
        $passed = (int) $loan['weeks_passed'] + 1;

        if (Ledger::add($managerId, -$due, 'loan_payment', I18n::t('server.ledger.installment'))) {
            $remaining -= $due;
            if ($remaining <= 0) {
                self::finish($loanId);
                Inbox::add($managerId, I18n::t('server.bank.lastInstallment', ['money' => I18n::money($due)]));
                return;
            }
            $wpdb->update(self::table(), ['remaining' => $remaining, 'overdue' => 0, 'missed' => 0, 'weeks_passed' => $passed], ['id' => $loanId]);
            Inbox::add($managerId, I18n::t('server.bank.installment', ['money' => I18n::money($due), 'left' => I18n::money($remaining)]));
            return;
        }

        $penalty = (int) round((int) $loan['installment'] * Settings::get('loan_penalty') / 100);
        $remaining += $penalty;
        $overdue = $due + $penalty;
        $missed = (int) $loan['missed'] + 1;
        $wpdb->update(self::table(), ['remaining' => $remaining, 'overdue' => $overdue, 'missed' => $missed, 'weeks_passed' => $passed], ['id' => $loanId]);

        if ($missed < Settings::int('loan_seize_after')) {
            $text = I18n::t('server.bank.missed', ['money' => I18n::money($due), 'penalty' => I18n::money($penalty)]);
            Inbox::add($managerId, $text);
            Push::notify($managerId, 'loan', I18n::t('server.bank.pushMissed'), $text, 'city/bank');
            return;
        }
        Push::notify($managerId, 'loan', I18n::t('server.bank.pushSeized'), I18n::t('server.bank.seizedPush'), 'city/bank');
        self::seize($managerId, $loanId, $remaining, $overdue);
    }

    private static function seize(int $managerId, int $loanId, int $remaining, int $overdue): void
    {
        global $wpdb;
        $pct = Settings::get('loan_seize_pct') / 100;
        $assets = array_map(fn($asset) => $asset + ['value' => (int) round($asset['base'] * $pct)], Market::assets($managerId));
        $collected = 0;
        $taken = [];

        while ($collected < $overdue && $assets) {
            $pool = array_filter($assets, fn($asset) => $asset['kind'] !== 'car') ?: $assets;
            $need = $overdue - $collected;
            $enough = array_filter($pool, fn($asset) => $asset['value'] >= $need);
            uasort($enough, fn($a, $b) => $a['value'] <=> $b['value']);
            uasort($pool, fn($a, $b) => $b['value'] <=> $a['value']);
            $key = array_key_first($enough ?: $pool);
            $asset = $assets[$key];
            unset($assets[$key]);

            if (Market::remove($managerId, $asset)) {
                $collected += $asset['value'];
                $taken[] = $asset['name'];
            }
        }

        $names = mb_strimwidth(implode(', ', $taken), 0, 140, '…');
        if ($collected) {
            Ledger::add($managerId, $collected, 'seizure', I18n::t('server.ledger.seizure', ['names' => $names]));
        }
        Ledger::add($managerId, -$overdue, 'loan_payment', I18n::t('server.ledger.overdue'), true);

        $remaining -= $overdue;
        if ($remaining <= 0) {
            self::finish($loanId);
        } else {
            $wpdb->update(self::table(), ['remaining' => $remaining, 'overdue' => 0, 'missed' => 0], ['id' => $loanId]);
        }

        Inbox::add($managerId, $taken
            ? I18n::t('server.bank.seized', ['names' => $names, 'money' => I18n::money($collected), 'overdue' => I18n::money($overdue)])
            : I18n::t('server.bank.seizedNothing', ['overdue' => I18n::money($overdue)]));
    }
}
