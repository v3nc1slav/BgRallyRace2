<?php

namespace BgRally\Game;

use BgRally\Database\Tables;

final class Energy
{
    public static function spend(int $managerId, int $amount): bool
    {
        global $wpdb;
        $table = Tables::name('managers');

        return $wpdb->query($wpdb->prepare(
            "UPDATE $table SET energy = energy - %d WHERE id = %d AND energy >= %d",
            $amount,
            $managerId,
            $amount
        )) === 1;
    }

    public static function refund(int $managerId, int $amount): void
    {
        global $wpdb;
        $table = Tables::name('managers');
        $wpdb->query($wpdb->prepare("UPDATE $table SET energy = energy + %d WHERE id = %d", $amount, $managerId));
    }
}
