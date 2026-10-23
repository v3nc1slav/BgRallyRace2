<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Catalog\Texts;
use BgRally\Settings;

final class Shop
{
    public static function sold(array $row, int $cityId): bool
    {
        $cities = array_filter(array_map('intval', explode(',', (string) ($row['city_ids'] ?? ''))));
        return !$cities || in_array($cityId, $cities, true);
    }

    public static function cityPct(int $cityId): int
    {
        static $cache = [];
        if (!isset($cache[$cityId])) {
            $city = Registry::get('cities')->find($cityId);
            $cache[$cityId] = (int) ($city['shop_price_pct'] ?? 0) ?: 100;
        }
        return $cache[$cityId];
    }

    public static function catalog(array $manager): array
    {
        global $wpdb;
        $level = (int) $manager['level'];
        $cityId = (int) $manager['city_id'];
        $parts = Registry::get('parts')->table();
        $tyres = Registry::get('tyres')->table();
        $local = fn(array $rows) => array_values(array_filter($rows, fn($row) => self::sold($row, $cityId)));

        $partRows = $local($wpdb->get_results("SELECT * FROM $parts WHERE active = 1 ORDER BY FIELD(type, 'engine', 'turbo', 'gearbox', 'suspension', 'brakes', 'chassis'), price", ARRAY_A));
        $tyreRows = $local($wpdb->get_results("SELECT * FROM $tyres WHERE active = 1 ORDER BY type, compound", ARRAY_A));
        $carRows = $local($wpdb->get_results('SELECT * FROM ' . Registry::get('cars')->table() . ' WHERE active = 1 ORDER BY class DESC, price', ARRAY_A));

        $owned = array_map(fn($row) => (int) $row['car_id'], Garage::cars((int) $manager['id']));
        $slots = GarageLevels::carSlots((int) $manager['garage_level']);
        $tradeIn = count($owned) >= $slots ? Garage::car((int) $manager['id']) : null;

        return [
            'cars' => array_map(fn($row) => [
                'id' => (int) $row['id'],
                'name' => $row['name'],
                'class_label' => Labels::classLabel($row['class']),
                'stats' => [
                    'power' => (int) $row['power'],
                    'handling' => (int) $row['handling'],
                    'braking' => (int) $row['braking'],
                    'reliability' => (int) $row['reliability'],
                ],
                'fuel_consumption' => (float) $row['fuel_consumption'],
                'price' => self::price('car', $row, $manager),
                'base_price' => (int) $row['price'],
                'min_level' => (int) $row['min_level'],
                'locked' => (int) $row['min_level'] > $level,
                'owned' => in_array((int) $row['id'], $owned, true),
            ], $carRows),
            'trade_in' => $tradeIn ? ['name' => $tradeIn['name'], 'value' => (int) round((int) $tradeIn['price'] * 0.5)] : null,
            'parts' => array_map(fn($row) => [
                'id' => (int) $row['id'],
                'name' => Texts::of($row['name']),
                'type_label' => Labels::text('PART_TYPES', $row['type']),
                'class_label' => Labels::classLabel($row['class']),
                'bonuses' => [
                    'power' => (int) $row['power_bonus'],
                    'handling' => (int) $row['handling_bonus'],
                    'braking' => (int) $row['braking_bonus'],
                    'reliability' => (int) $row['reliability_bonus'],
                ],
                'wear' => (float) $row['wear_per_100km'],
                'fuel_pct' => (int) $row['fuel_pct'],
                'price' => self::price('part', $row, $manager),
                'base_price' => (int) $row['price'],
                'min_level' => (int) $row['min_level'],
                'locked' => (int) $row['min_level'] > $level,
            ], $partRows),
            'tyres' => array_map(fn($row) => [
                'id' => (int) $row['id'],
                'name' => Texts::of($row['name']),
                'type_label' => Labels::text('TYRE_TYPES', $row['type']),
                'compound_label' => Labels::text('COMPOUNDS', $row['compound']),
                'grip' => [
                    'asphalt_dry' => (float) $row['grip_asphalt_dry'],
                    'asphalt_wet' => (float) $row['grip_asphalt_wet'],
                    'gravel' => (float) $row['grip_gravel'],
                    'snow' => (float) $row['grip_snow'],
                ],
                'wear' => (float) $row['wear_per_100km'],
                'price' => self::price('tyre', $row, $manager),
                'single_price' => self::price('spare_tyre', $row, $manager),
                'base_price' => (int) $row['price'],
                'min_level' => (int) $row['min_level'],
                'locked' => (int) $row['min_level'] > $level,
            ], $tyreRows),
            'privileges' => Privileges::describe($cityId),
            'price_pct' => self::cityPct($cityId),
        ];
    }

    public static function price(string $kind, array $row, array $manager): int
    {
        $cityId = (int) $manager['city_id'];
        $base = (int) $row['price'] * self::cityPct($cityId) / 100;
        return match ($kind) {
            'part' => (int) round($base * Privileges::factor($cityId, 'parts')),
            'tyre' => (int) round($base * Privileges::factor($cityId, 'tyres')),
            'spare_tyre' => (int) round($base * Settings::get('spare_tyre_price_pct') / 100 * Privileges::factor($cityId, 'tyres')),
            default => (int) round($base),
        };
    }
}
