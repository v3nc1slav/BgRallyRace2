<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Database\Tables;

final class Finance
{
    private const HISTORY = 5;

    private const LABELS = [
        'prize' => 'Награди от ралита',
        'season_prize' => 'Награди за сезона',
        'sponsor' => 'Спонсори',
        'job' => 'Работа',
        'market_sale' => 'Продажби на пазара',
        'dealer' => 'Изкупвач',
        'car_sale' => 'Продадени коли',
        'black_win' => 'Черна писта – печалби',
        'black_refund' => 'Черна писта – върнати залози',
        'ad' => 'Реклами',
        'loan' => 'Заеми от банката',
        'seizure' => 'Запор – продадено имущество',
        'start' => 'Стартови пари',
        'rally_entry' => 'Ралита – такса, път и гориво',
        'recon' => 'Тренировка преди рали',
        'training' => 'Тренировки',
        'shop' => 'Магазин',
        'car_purchase' => 'Нови коли',
        'repair' => 'Ремонти',
        'garage' => 'Гараж',
        'salary' => 'Заплати',
        'market' => 'Покупки от пазара',
        'loan_payment' => 'Вноски по заеми',
        'fine' => 'Глоби',
        'bribe' => 'Подкупи',
        'black_bet' => 'Черна писта – залози',
        'clothes' => 'Дрехи',
        'fitness' => 'Фитнес',
        'track' => 'Собствена писта',
        'sabotage' => 'Саботаж',
        'move' => 'Преместване в друг град',
        'fresh_start' => 'Ново начало',
    ];

    private static function boundary(string $startAt): string
    {
        return get_gmt_from_date(substr($startAt, 0, 10) . ' 23:59:59');
    }

    private static function seasons(int $current): array
    {
        global $wpdb;
        return array_map('intval', $wpdb->get_col($wpdb->prepare(
            'SELECT DISTINCT season FROM ' . Registry::get('rallies')->table() . ' WHERE season BETWEEN %d AND %d ORDER BY season DESC',
            $current - self::HISTORY,
            $current
        )));
    }

    private static function categories(array $sums): array
    {
        arsort($sums);
        $rows = [];
        foreach ($sums as $reason => $amount) {
            $rows[] = ['key' => $reason, 'label' => self::LABELS[$reason] ?? 'Други', 'amount' => $amount];
        }
        return $rows;
    }

    public static function view(array $manager, int $season): array
    {
        global $wpdb;
        $rallies = Registry::get('rallies')->table();
        $current = Rallies::currentSeason();
        $seasons = self::seasons($current);
        if (!in_array($season, $seasons, true)) {
            $season = $current;
        }

        $schedule = $wpdb->get_results($wpdb->prepare("SELECT id, name, start_at FROM $rallies WHERE season = %d ORDER BY start_at, id", $season), ARRAY_A);
        $previous = $wpdb->get_var($wpdb->prepare("SELECT MAX(start_at) FROM $rallies WHERE season < %d", $season));
        $from = $previous ? self::boundary($previous) : '1970-01-01 00:00:00';
        $to = $season === $current || !$schedule ? '9999-12-31 23:59:59' : self::boundary(end($schedule)['start_at']);

        $entries = $wpdb->get_results($wpdb->prepare(
            'SELECT reason, amount, balance, created_at FROM ' . Tables::name('ledger') . ' WHERE manager_id = %d AND created_at > %s AND created_at <= %s ORDER BY id',
            $manager['id'],
            $from,
            $to
        ), ARRAY_A);
        $opening = $wpdb->get_var($wpdb->prepare(
            'SELECT balance FROM ' . Tables::name('ledger') . ' WHERE manager_id = %d AND created_at <= %s ORDER BY id DESC LIMIT 1',
            $manager['id'],
            $from
        ));

        $now = gmdate('Y-m-d H:i:s');
        $income = [];
        $expense = [];
        $points = [];
        $cursor = 0;
        $balance = (int) $opening;

        foreach ($schedule as $index => $rally) {
            $end = $index === count($schedule) - 1 ? $to : self::boundary($rally['start_at']);
            $point = ['id' => (int) $rally['id'], 'name' => $rally['name'], 'income' => 0, 'expense' => 0, 'current' => $end >= $now];
            while ($cursor < count($entries) && $entries[$cursor]['created_at'] <= $end) {
                $amount = (int) $entries[$cursor]['amount'];
                $point[$amount >= 0 ? 'income' : 'expense'] += abs($amount);
                $balance = (int) $entries[$cursor]['balance'];
                $cursor++;
            }
            $point['balance'] = $balance;
            $points[] = $point;
            if ($point['current']) {
                break;
            }
        }

        foreach ($entries as $entry) {
            $amount = (int) $entry['amount'];
            if ($amount >= 0) {
                $income[$entry['reason']] = ($income[$entry['reason']] ?? 0) + $amount;
            } else {
                $expense[$entry['reason']] = ($expense[$entry['reason']] ?? 0) - $amount;
            }
        }

        return [
            'season' => $season,
            'seasons' => $seasons ?: [$current],
            'current' => $season === $current,
            'totals' => [
                'income' => array_sum($income),
                'expense' => array_sum($expense),
                'opening' => (int) $opening,
                'closing' => $entries ? (int) end($entries)['balance'] : (int) $opening,
            ],
            'income' => self::categories($income),
            'expense' => self::categories($expense),
            'rallies' => $points,
        ];
    }
}
