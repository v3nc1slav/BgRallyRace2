<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Settings;

final class Shop
{
    public static function catalog(array $manager): array
    {
        global $wpdb;
        $level = (int) $manager['level'];
        $parts = Registry::get('parts')->table();
        $tyres = Registry::get('tyres')->table();

        $partRows = $wpdb->get_results("SELECT * FROM $parts WHERE active = 1 ORDER BY FIELD(type, 'engine', 'turbo', 'gearbox', 'suspension', 'brakes', 'chassis'), price", ARRAY_A);
        $tyreRows = $wpdb->get_results("SELECT * FROM $tyres WHERE active = 1 ORDER BY type, compound", ARRAY_A);
        $carRows = $wpdb->get_results('SELECT * FROM ' . Registry::get('cars')->table() . ' WHERE active = 1 ORDER BY class DESC, price', ARRAY_A);

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
                'price' => (int) $row['price'],
                'min_level' => (int) $row['min_level'],
                'locked' => (int) $row['min_level'] > $level,
                'owned' => in_array((int) $row['id'], $owned, true),
            ], $carRows),
            'trade_in' => $tradeIn ? ['name' => $tradeIn['name'], 'value' => (int) round((int) $tradeIn['price'] * 0.5)] : null,
            'parts' => array_map(fn($row) => [
                'id' => (int) $row['id'],
                'name' => $row['name'],
                'type_label' => Labels::PART_TYPES[$row['type']] ?? $row['type'],
                'class_label' => $row['class'] === '' ? 'Всички класове' : Labels::classLabel($row['class']),
                'bonuses' => [
                    'power' => (int) $row['power_bonus'],
                    'handling' => (int) $row['handling_bonus'],
                    'braking' => (int) $row['braking_bonus'],
                    'reliability' => (int) $row['reliability_bonus'],
                ],
                'wear' => (float) $row['wear_per_100km'],
                'price' => self::price('part', $row, $manager),
                'base_price' => (int) $row['price'],
                'min_level' => (int) $row['min_level'],
                'locked' => (int) $row['min_level'] > $level,
            ], $partRows),
            'tyres' => array_map(fn($row) => [
                'id' => (int) $row['id'],
                'name' => $row['name'],
                'type_label' => Labels::TYRE_TYPES[$row['type']] ?? $row['type'],
                'compound_label' => Labels::COMPOUNDS[$row['compound']] ?? $row['compound'],
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
            'privileges' => Privileges::describe((int) $manager['city_id']),
        ];
    }

    public static function price(string $kind, array $row, array $manager): int
    {
        $cityId = (int) $manager['city_id'];
        return match ($kind) {
            'part' => (int) round((int) $row['price'] * Privileges::factor($cityId, 'parts')),
            'tyre' => (int) round((int) $row['price'] * Privileges::factor($cityId, 'tyres')),
            'spare_tyre' => (int) round((int) $row['price'] * Settings::get('spare_tyre_price_pct') / 100 * Privileges::factor($cityId, 'tyres')),
            default => (int) $row['price'],
        };
    }
}
