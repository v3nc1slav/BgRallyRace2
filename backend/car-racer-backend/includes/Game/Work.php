<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Database\Tables;
use WP_Error;

final class Work
{
    private const MAX_BACKPAY_DAYS = 14;

    public static function job(array $manager): ?array
    {
        return (int) $manager['job_id'] ? Registry::get('jobs')->find((int) $manager['job_id']) : null;
    }

    public static function dailyShift(array $manager, string $today): int
    {
        global $wpdb;
        $job = self::job($manager);
        if (!$job) {
            return 0;
        }

        $last = $manager['job_date'] ?: $today;
        $days = (int) floor((strtotime($today) - strtotime($last)) / DAY_IN_SECONDS);
        if ($days < 1) {
            return 0;
        }

        $days = min(self::MAX_BACKPAY_DAYS, $days);
        $total = (int) $job['pay'] * $days;
        Ledger::add((int) $manager['id'], $total, 'job', $job['name']);
        $wpdb->update(Tables::name('managers'), ['job_date' => $today], ['id' => $manager['id']]);
        Inbox::add((int) $manager['id'], $days === 1
            ? sprintf('Работа – %s: +%d €.', $job['name'], $total)
            : sprintf('Работа – %s: %d дни, +%d €.', $job['name'], $days, $total));

        return (int) $job['energy'];
    }

    public static function view(array $manager): array
    {
        global $wpdb;
        $season = Rallies::currentSeason();
        $job = self::job($manager);
        $free = (int) $manager['job_season'] < $season;
        $rows = $wpdb->get_results('SELECT * FROM ' . Registry::get('jobs')->table() . ' WHERE active = 1 ORDER BY min_level, pay', ARRAY_A);

        return [
            'season' => $season,
            'current' => $job ? [
                'id' => (int) $job['id'],
                'name' => $job['name'],
                'building' => Labels::BUILDINGS[$job['building']] ?? $job['building'],
                'pay' => (int) $job['pay'],
                'energy' => (int) $job['energy'],
            ] : null,
            'can_take' => $free,
            'locked_reason' => $free ? '' : ($job ? 'Работата е избрана за целия сезон.' : 'Напусна работа този сезон. Нова може да започнеш през следващия.'),
            'jobs' => array_map(fn($row) => [
                'id' => (int) $row['id'],
                'name' => $row['name'],
                'building' => Labels::BUILDINGS[$row['building']] ?? $row['building'],
                'pay' => (int) $row['pay'],
                'energy' => (int) $row['energy'],
                'min_level' => (int) $row['min_level'],
                'locked' => (int) $row['min_level'] > (int) $manager['level'],
            ], $rows),
        ];
    }

    public static function take(array $manager, int $jobId): string|WP_Error
    {
        global $wpdb;
        $season = Rallies::currentSeason();
        $job = Registry::get('jobs')->find($jobId);

        if (!$job || !$job['active']) {
            return new WP_Error('bgr_not_found', 'Няма такава работа.', ['status' => 404]);
        }
        if ((int) $job['min_level'] > (int) $manager['level']) {
            return new WP_Error('bgr_level', sprintf('Нужно е ниво %d.', $job['min_level']), ['status' => 400]);
        }
        if ((int) $manager['job_season'] >= $season) {
            return new WP_Error('bgr_job', 'Този сезон вече си избирал работа. Смяна – през следващия сезон.', ['status' => 400]);
        }

        $wpdb->update(Tables::name('managers'), ['job_id' => $jobId, 'job_season' => $season, 'job_date' => wp_date('Y-m-d')], ['id' => $manager['id']]);
        return sprintf('Започваш работа като %s: %d € и %d енергия на ден, от утре.', mb_strtolower($job['name']), $job['pay'], $job['energy']);
    }

    public static function quit(array $manager): string|WP_Error
    {
        global $wpdb;
        $job = self::job($manager);
        if (!$job) {
            return new WP_Error('bgr_job', 'Нямаш работа.', ['status' => 400]);
        }

        $wpdb->update(Tables::name('managers'), ['job_id' => 0], ['id' => $manager['id']]);
        return sprintf('Напусна работата (%s). Нова може да започнеш през следващия сезон.', mb_strtolower($job['name']));
    }

    public static function runDaily(): void
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT * FROM ' . Tables::name('managers') . ' WHERE job_id > 0 AND inactive_since IS NULL AND (energy_date IS NULL OR energy_date < %s) LIMIT 200',
            wp_date('Y-m-d')
        ), ARRAY_A);

        foreach ($rows as $manager) {
            Managers::refreshDay($manager);
        }
    }
}
