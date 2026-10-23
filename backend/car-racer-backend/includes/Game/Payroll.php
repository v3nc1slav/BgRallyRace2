<?php

namespace BgRally\Game;

use BgRally\Database\Tables;

final class Payroll
{
    public static function process(array $manager): void
    {
        global $wpdb;
        $week = Rallies::week();
        $previous = (string) $manager['payroll_week'];
        $managerId = (int) $manager['id'];

        if ($previous === $week) {
            return;
        }

        $claimed = $wpdb->query($wpdb->prepare(
            'UPDATE ' . Tables::name('managers') . ' SET payroll_week = %s WHERE id = %d AND payroll_week = %s',
            $week,
            $managerId,
            $previous
        ));
        if ($claimed !== 1 || $previous === '' || Inactivity::isInactive($manager)) {
            return;
        }

        $staff = Tables::name('staff');
        $paid = 0;

        foreach (Staff::rows($managerId) as $row) {
            $salary = Staff::salary($row['role'], (int) $row['skill']);
            $label = mb_strtolower(Labels::ROLES[$row['role']] ?? $row['role']);

            if (Ledger::add($managerId, -$salary, 'salary', $row['name'])) {
                $paid += $salary;
                if ($row['unpaid']) {
                    $wpdb->update($staff, ['unpaid' => 0], ['id' => $row['id']]);
                }
            } elseif ($row['unpaid']) {
                $wpdb->delete($staff, ['id' => $row['id']]);
                Inbox::add($managerId, sprintf('%s (%s) напусна, защото не получи заплата.', $row['name'], $label));
            } else {
                $wpdb->update($staff, ['unpaid' => 1], ['id' => $row['id']]);
                Inbox::add($managerId, sprintf('Нямаш пари за заплатата на %s (%s, %d €). Ако не получи заплата и следващия понеделник, ще напусне.', $row['name'], $label, $salary));
            }
        }

        if ($paid) {
            Inbox::add($managerId, sprintf('Платени заплати: %d €.', $paid));
        }

        Bank::weekly($managerId);

        $boost = Staff::cheerUp($managerId);
        if ($boost) {
            Inbox::add($managerId, sprintf('Психологът вдигна морала на екипажа с %d.', $boost));
        }
    }

    public static function runAll(): void
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT * FROM ' . Tables::name('managers') . ' WHERE payroll_week <> %s LIMIT 200',
            Rallies::week()
        ), ARRAY_A);

        foreach ($rows as $manager) {
            self::process($manager);
        }
    }
}
