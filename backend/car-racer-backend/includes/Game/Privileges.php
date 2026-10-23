<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\I18n;

final class Privileges
{
    private static array $cache = [];

    public static function of(int $cityId): array
    {
        if (isset(self::$cache[$cityId])) {
            return self::$cache[$cityId];
        }

        $city = Registry::get('cities')->find($cityId);
        $privileges = [];
        foreach ([1, 2] as $n) {
            $type = (string) ($city["privilege_$n"] ?? '');
            if ($type !== '') {
                $privileges[$type] = ($privileges[$type] ?? 0) + (int) $city["privilege_{$n}_value"];
            }
        }
        return self::$cache[$cityId] = $privileges;
    }

    public static function percent(int $cityId, string $type): int
    {
        return self::of($cityId)[$type] ?? 0;
    }

    public static function factor(int $cityId, string $type): float
    {
        return max(0, 1 - self::percent($cityId, $type) / 100);
    }

    public static function describe(int $cityId): array
    {
        $list = [];
        foreach (self::of($cityId) as $type => $value) {
            $list[] = I18n::t('server.privileges.item', ['label' => Labels::text('PRIVILEGES', $type), 'pct' => $value]);
        }
        return $list;
    }

    private const PHRASES = ['travel', 'parts', 'tyres', 'repair', 'home_fee', 'sponsor_local'];

    public static function sentence(int $cityId): string
    {
        $parts = [];
        foreach (self::of($cityId) as $type => $value) {
            if (in_array($type, self::PHRASES, true) && $value) {
                $parts[] = I18n::t('server.privileges.' . $type, ['pct' => $value]);
            }
        }
        if (!$parts) {
            return I18n::t('server.privileges.none');
        }
        return I18n::t('server.privileges.here', ['list' => I18n::join($parts)]);
    }
}
