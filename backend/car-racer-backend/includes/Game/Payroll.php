<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\I18n;

final class Payroll
{
    public static function process(array $manager): void
    {
        I18n::as($manager, fn() => self::settle($manager));
    }

    private static function settle(array $manager): void
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
            $label = mb_strtolower(Labels::text('ROLES', $row['role']));

            if (Ledger::add($managerId, -$salary, 'salary', $row['name'])) {
                $paid += $salary;
                if ($row['unpaid']) {
                    $wpdb->update($staff, ['unpaid' => 0], ['id' => $row['id']]);
                }
            } elseif ($row['unpaid']) {
                $wpdb->delete($staff, ['id' => $row['id']]);
                Inbox::add($managerId, I18n::t('server.payroll.quit', ['name' => $row['name'], 'role' => $label]));
            } else {
                $wpdb->update($staff, ['unpaid' => 1], ['id' => $row['id']]);
                Inbox::add($managerId, I18n::t('server.payroll.unpaid', ['name' => $row['name'], 'role' => $label, 'money' => I18n::money($salary)]));
            }
        }

        if ($paid) {
            Inbox::add($managerId, I18n::t('server.payroll.paid', ['money' => I18n::money($paid)]));
        }

        Bank::weekly($managerId);

        $boost = Staff::cheerUp($managerId);
        if ($boost) {
            Inbox::add($managerId, I18n::t('server.payroll.morale', ['boost' => $boost]));
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
