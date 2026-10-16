<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\Settings;

final class Progress
{
    public const MAX_LEVEL = 50;

    public static function xpForLevel(int $level): int
    {
        return (int) round(Settings::get('level_xp_base') * pow(max(0, $level - 1), 1.6));
    }

    public static function levelForXp(int $xp): int
    {
        $level = 1;
        while ($level < self::MAX_LEVEL && $xp >= self::xpForLevel($level + 1)) {
            $level++;
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
}
