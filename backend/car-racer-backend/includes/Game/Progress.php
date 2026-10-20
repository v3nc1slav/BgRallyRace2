<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\Settings;

final class Progress
{
    public const MAX_LEVEL = 50;
    public const OPTION = 'bgr_level_xp';
    private const FORMULA_BASE = 100;

    public static function formula(int $level): int
    {
        return (int) round(self::FORMULA_BASE * pow(max(0, $level - 1), 1.6));
    }

    public static function table(): array
    {
        $saved = (array) get_option(self::OPTION, []);
        $table = [];
        for ($level = 2; $level <= self::MAX_LEVEL; $level++) {
            $table[$level] = isset($saved[$level]) ? (int) $saved[$level] : self::formula($level);
        }
        return $table;
    }

    public static function xpForLevel(int $level): int
    {
        static $table = null;
        if ($level <= 1) {
            return 0;
        }
        $table ??= self::table();
        return $table[min(self::MAX_LEVEL, $level)];
    }

    public static function levelForXp(int $xp): int
    {
        $level = 1;
        foreach (self::table() as $next => $needed) {
            if ($xp < $needed) {
                break;
            }
            $level = $next;
        }
        return $level;
    }

    public static function addXp(int $managerId, int $amount): void
    {
        global $wpdb;
        $table = Tables::name('managers');

        if ($amount <= 0) {
            return;
        }

        $wpdb->query($wpdb->prepare("UPDATE $table SET xp = xp + %d WHERE id = %d", $amount, $managerId));
        $xp = (int) $wpdb->get_var($wpdb->prepare("SELECT xp FROM $table WHERE id = %d", $managerId));
        $wpdb->update($table, ['level' => self::levelForXp($xp)], ['id' => $managerId]);
    }

    public static function usedToday(array $manager): int
    {
        return ($manager['xp_date'] ?? null) === wp_date('Y-m-d') ? (int) $manager['xp_today'] : 0;
    }

    public static function addDaily(int $managerId, string $setting): string
    {
        global $wpdb;
        $table = Tables::name('managers');
        $amount = Settings::int($setting);
        if ($amount <= 0) {
            return '';
        }

        $today = wp_date('Y-m-d');
        $row = $wpdb->get_row($wpdb->prepare("SELECT xp_date, xp_today FROM $table WHERE id = %d", $managerId), ARRAY_A);
        $used = $row ? self::usedToday($row) : 0;
        $grant = max(0, min($amount, Settings::int('xp_daily_cap') - $used));
        if (!$grant) {
            return ' Дневният лимит на опит е достигнат.';
        }

        $wpdb->update($table, ['xp_date' => $today, 'xp_today' => $used + $grant], ['id' => $managerId]);
        self::addXp($managerId, $grant);
        return sprintf(' +%d опит.', $grant);
    }

    public static function recalculate(): int
    {
        global $wpdb;
        $table = Tables::name('managers');
        $changed = 0;
        foreach ($wpdb->get_results("SELECT id, xp, level FROM $table", ARRAY_A) as $row) {
            $level = self::levelForXp((int) $row['xp']);
            if ($level !== (int) $row['level']) {
                $wpdb->update($table, ['level' => $level], ['id' => $row['id']]);
                $changed++;
            }
        }
        return $changed;
    }
}
