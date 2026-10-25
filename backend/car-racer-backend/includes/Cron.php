<?php

namespace BgRally;

use BgRally\Auth\Guard;
use BgRally\Game\Rallies;

final class Cron
{
    public const HOOK = 'bgr_tick';
    private const SCHEDULE = 'bgr_five_minutes';

    public static function register(): void
    {
        add_filter('cron_schedules', [self::class, 'schedules']);
        add_action(self::HOOK, [Rallies::class, 'runDue']);
        add_action(self::HOOK, [Guard::class, 'purge']);
        add_action('init', [self::class, 'ensureScheduled']);
    }

    public static function schedules(array $schedules): array
    {
        $schedules[self::SCHEDULE] = ['interval' => 300, 'display' => 'BG Rally: на всеки 5 минути'];
        return $schedules;
    }

    public static function ensureScheduled(): void
    {
        if (!wp_next_scheduled(self::HOOK)) {
            wp_schedule_event(time(), self::SCHEDULE, self::HOOK);
        }
    }

    public static function unschedule(): void
    {
        wp_clear_scheduled_hook(self::HOOK);
    }
}
