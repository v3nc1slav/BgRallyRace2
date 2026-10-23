<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Catalog\Texts;
use BgRally\Database\Tables;
use BgRally\I18n;
use WP_Error;

final class Clothes
{
    public static function bonus(int $managerId): int
    {
        global $wpdb;
        $items = Tables::name('items');
        $clothes = Registry::get('clothes')->table();

        return (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(c.bonus), 0) FROM $items i JOIN $clothes c ON c.id = i.catalog_id WHERE i.manager_id = %d AND i.kind = 'clothes' AND i.equipped = 1",
            $managerId
        ));
    }

    private static function owned(int $managerId): array
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT id, catalog_id, equipped FROM ' . Tables::name('items') . " WHERE manager_id = %d AND kind = 'clothes'",
            $managerId
        ), ARRAY_A);
        return array_column($rows, null, 'catalog_id');
    }

    public static function view(array $manager): array
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $owned = self::owned($managerId);
        $rows = $wpdb->get_results('SELECT * FROM ' . Registry::get('clothes')->table() . " WHERE active = 1 ORDER BY FIELD(slot, 'suit', 'shoes', 'watch', 'accessory'), price", ARRAY_A);

        return [
            'bonus' => self::bonus($managerId),
            'items' => array_map(fn($row) => [
                'id' => (int) $row['id'],
                'name' => Texts::of($row['name']),
                'slot' => $row['slot'],
                'slot_label' => Labels::text('CLOTHING_SLOTS', $row['slot']),
                'bonus' => (int) $row['bonus'],
                'price' => (int) $row['price'],
                'min_level' => (int) $row['min_level'],
                'locked' => (int) $row['min_level'] > (int) $manager['level'],
                'item_id' => isset($owned[$row['id']]) ? (int) $owned[$row['id']]['id'] : null,
                'equipped' => !empty($owned[$row['id']]['equipped']),
            ], $rows),
        ];
    }

    public static function buy(array $manager, int $clothingId): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $item = Registry::get('clothes')->find($clothingId);

        if (!$item || !$item['active']) {
            return new WP_Error('bgr_not_found', I18n::t('server.clothes.notFound'), ['status' => 404]);
        }
        if ((int) $item['min_level'] > (int) $manager['level']) {
            return new WP_Error('bgr_level', I18n::t('server.common.level', ['level' => $item['min_level']]), ['status' => 400]);
        }
        if (isset(self::owned($managerId)[$clothingId])) {
            return new WP_Error('bgr_owned', I18n::t('server.clothes.owned'), ['status' => 400]);
        }
        if (!Ledger::add($managerId, -(int) $item['price'], 'clothes', Texts::of($item['name']))) {
            return new WP_Error('bgr_money', I18n::t('server.common.money'), ['status' => 400]);
        }

        $wpdb->insert(Tables::name('items'), [
            'manager_id' => $managerId,
            'kind' => 'clothes',
            'catalog_id' => $clothingId,
            'created_at' => current_time('mysql', true),
        ]);
        self::wear($manager, (int) $wpdb->insert_id);

        return I18n::t('server.clothes.bought', ['item' => mb_strtolower(Texts::of($item['name']))]);
    }

    public static function wear(array $manager, int $itemId): string|WP_Error
    {
        global $wpdb;
        $items = Tables::name('items');
        $clothes = Registry::get('clothes')->table();
        $managerId = (int) $manager['id'];

        $item = $wpdb->get_row($wpdb->prepare(
            "SELECT i.id, c.slot, c.name FROM $items i JOIN $clothes c ON c.id = i.catalog_id WHERE i.id = %d AND i.manager_id = %d AND i.kind = 'clothes'",
            $itemId,
            $managerId
        ), ARRAY_A);
        if (!$item) {
            return new WP_Error('bgr_not_found', I18n::t('server.clothes.notOwned'), ['status' => 404]);
        }

        $wpdb->query($wpdb->prepare(
            "UPDATE $items i JOIN $clothes c ON c.id = i.catalog_id SET i.equipped = 0 WHERE i.manager_id = %d AND i.kind = 'clothes' AND c.slot = %s",
            $managerId,
            $item['slot']
        ));
        $wpdb->update($items, ['equipped' => 1], ['id' => $itemId]);

        return I18n::t('server.clothes.worn', ['item' => mb_strtolower(Texts::of($item['name']))]);
    }
}
