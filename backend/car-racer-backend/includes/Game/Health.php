<?php

namespace BgRally\Game;

use BgRally\Auth\Recovery;
use BgRally\Cron;
use BgRally\Database\Tables;

final class Health
{
    private const LATE_MINUTES = 15;
    private const QUEUE_LIMIT = 200;

    private static function cron(): array
    {
        $last = (int) get_option(Cron::LAST, 0);
        $late = time() - $last > self::LATE_MINUTES * MINUTE_IN_SECONDS;
        return [
            'label' => 'Последно изпълнение на фоновите задачи',
            'value' => $last ? sprintf('преди %s', human_time_diff($last)) : 'още няма',
            'ok' => !$late,
        ];
    }

    private static function schedule(): array
    {
        $system = defined('DISABLE_WP_CRON') && DISABLE_WP_CRON;
        return [
            'label' => 'Какво пуска фоновите задачи',
            'value' => $system ? 'системен Cron' : 'посещенията на сайта (WP-Cron)',
            'ok' => $system || wp_get_environment_type() === 'local',
        ];
    }

    private static function stuck(): array
    {
        $names = array_column(Rallies::stuck(), 'name');
        return ['label' => 'Блокирани ралита', 'value' => $names ? implode(', ', $names) : 'няма', 'ok' => !$names];
    }

    private static function late(): array
    {
        global $wpdb;
        $count = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT COUNT(*) FROM ' . Tables::name('rally_runs') . ' WHERE published = 0 AND broadcast_end < %s',
            date('Y-m-d H:i:s', Rallies::now() - self::LATE_MINUTES * MINUTE_IN_SECONDS)
        ));
        return ['label' => 'Закъснели резултати от ралита', 'value' => (string) $count, 'ok' => $count === 0];
    }

    private static function rewards(): array
    {
        global $wpdb;
        $entries = (int) $wpdb->get_var('SELECT COUNT(*) FROM ' . Tables::name('entries') . ' WHERE reward_pending = 1');
        $seasons = (int) $wpdb->get_var('SELECT COUNT(*) FROM ' . Tables::name('season_prizes') . ' WHERE paid = 0');
        return ['label' => 'Неизплатени награди', 'value' => sprintf('ралита: %d, сезони: %d', $entries, $seasons), 'ok' => $entries + $seasons === 0];
    }

    private static function push(): array
    {
        global $wpdb;
        $count = (int) $wpdb->get_var('SELECT COUNT(*) FROM ' . Tables::name('push_queue'));
        return ['label' => 'Известия в опашката', 'value' => (string) $count, 'ok' => $count < self::QUEUE_LIMIT];
    }

    private static function mail(): array
    {
        $error = (array) get_option(Recovery::MAIL_ERROR, []);
        $recent = !empty($error['at']) && time() - (int) $error['at'] < DAY_IN_SECONDS;
        return [
            'label' => 'Имейли',
            'value' => $recent ? sprintf('грешка преди %s: %s', human_time_diff((int) $error['at']), $error['message'] ?? '') : 'без грешки за последните 24 часа',
            'ok' => !$recent,
        ];
    }

    public static function checks(): array
    {
        return [self::cron(), self::schedule(), self::stuck(), self::late(), self::rewards(), self::push(), self::mail()];
    }
}
