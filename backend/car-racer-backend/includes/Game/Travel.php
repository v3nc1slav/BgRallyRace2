<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Settings;

final class Travel
{
    private const ROAD_FACTOR = 1.25;

    public static function distanceKm(int $fromCityId, int $toCityId): float
    {
        if ($fromCityId === $toCityId) {
            return 0;
        }

        $cities = Registry::get('cities');
        $from = $cities->find($fromCityId);
        $to = $cities->find($toCityId);
        if (!$from || !$to) {
            return 0;
        }

        $lat1 = deg2rad((float) $from['lat']);
        $lat2 = deg2rad((float) $to['lat']);
        $dLat = $lat2 - $lat1;
        $dLng = deg2rad((float) $to['lng'] - (float) $from['lng']);

        $a = sin($dLat / 2) ** 2 + cos($lat1) * cos($lat2) * sin($dLng / 2) ** 2;
        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a)) * self::ROAD_FACTOR;
    }

    public static function cost(int $fromCityId, int $toCityId): int
    {
        return (int) round(self::distanceKm($fromCityId, $toCityId) * Settings::get('travel_price_per_km') * Privileges::factor($fromCityId, 'travel'));
    }
}
