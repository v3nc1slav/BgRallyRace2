<?php

namespace BgRally\Game;

use BgRally\Database\Tables;

final class Ledger
{
    public static function add(int $managerId, int $amount, string $reason, string $note = '', bool $allowDebt = false): bool
    {
        global $wpdb;

        if ($amount === 0) {
            return true;
        }

        $managers = Tables::name('managers');

        $wpdb->query('START TRANSACTION');

        $updated = $wpdb->query($wpdb->prepare(
            "UPDATE $managers SET money = money + %d WHERE id = %d AND (money + %d >= 0 OR %d = 1)",
            $amount,
            $managerId,
            $amount,
            $allowDebt ? 1 : 0
        ));

        if ($updated !== 1) {
            $wpdb->query('ROLLBACK');
            return false;
        }

        $balance = (int) $wpdb->get_var($wpdb->prepare("SELECT money FROM $managers WHERE id = %d", $managerId));

        $wpdb->insert(Tables::name('ledger'), [
            'manager_id' => $managerId,
            'amount' => $amount,
            'balance' => $balance,
            'reason' => $reason,
            'note' => $note,
            'created_at' => current_time('mysql', true),
        ]);

        $wpdb->query('COMMIT');
        return true;
    }
}
