<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Catalog\Texts;
use BgRally\Database\Tables;
use BgRally\I18n;
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
        Ledger::add((int) $manager['id'], $total, 'job', Texts::of($job['name'], I18n::of($manager)));
        $wpdb->update(Tables::name('managers'), ['job_date' => $today], ['id' => $manager['id']]);
        I18n::as($manager, fn() => Inbox::add((int) $manager['id'], I18n::t($days === 1 ? 'server.work.paid' : 'server.work.paidDays', ['job' => Texts::of($job['name']), 'days' => $days, 'money' => I18n::money($total)])));

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
                'name' => Texts::of($job['name']),
                'building' => Labels::text('BUILDINGS', $job['building']),
                'pay' => (int) $job['pay'],
                'energy' => (int) $job['energy'],
            ] : null,
            'can_take' => $free,
            'locked_reason' => $free ? '' : I18n::t($job ? 'server.work.season' : 'server.work.quitSeason'),
            'jobs' => array_map(fn($row) => [
                'id' => (int) $row['id'],
                'name' => Texts::of($row['name']),
                'building' => Labels::text('BUILDINGS', $row['building']),
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
            return new WP_Error('bgr_not_found', I18n::t('server.work.notFound'), ['status' => 404]);
        }
        if ((int) $job['min_level'] > (int) $manager['level']) {
            return new WP_Error('bgr_level', I18n::t('server.common.level', ['level' => $job['min_level']]), ['status' => 400]);
        }
        if ((int) $manager['job_season'] >= $season) {
            return new WP_Error('bgr_job', I18n::t('server.work.taken'), ['status' => 400]);
        }

        $wpdb->update(Tables::name('managers'), ['job_id' => $jobId, 'job_season' => $season, 'job_date' => wp_date('Y-m-d')], ['id' => $manager['id']]);
        return I18n::t('server.work.started', ['job' => mb_strtolower(Texts::of($job['name'])), 'money' => I18n::money($job['pay']), 'energy' => $job['energy']]);
    }

    public static function quit(array $manager): string|WP_Error
    {
        global $wpdb;
        $job = self::job($manager);
        if (!$job) {
            return new WP_Error('bgr_job', I18n::t('server.work.none'), ['status' => 400]);
        }

        $wpdb->update(Tables::name('managers'), ['job_id' => 0], ['id' => $manager['id']]);
        return I18n::t('server.work.quit', ['job' => mb_strtolower(Texts::of($job['name']))]);
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
