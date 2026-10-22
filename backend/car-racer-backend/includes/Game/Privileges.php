<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;

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
            $list[] = sprintf('%s: %d%%', Labels::PRIVILEGES[$type] ?? $type, $value);
        }
        return $list;
    }

    private const PHRASES = [
        'travel' => 'транспортните разходи са с %d%% по-евтини',
        'parts' => 'частите в магазина са с %d%% по-евтини',
        'tyres' => 'гумите в магазина са с %d%% по-евтини',
        'repair' => 'ремонтите са с %d%% по-евтини',
        'home_fee' => 'таксата за местното рали е с %d%% по-ниска',
        'sponsor_local' => 'преговорите с местните спонсори вървят с %d%% по-бързо',
    ];

    public static function sentence(int $cityId): string
    {
        $parts = [];
        foreach (self::of($cityId) as $type => $value) {
            if (isset(self::PHRASES[$type]) && $value) {
                $parts[] = sprintf(self::PHRASES[$type], $value);
            }
        }
        if (!$parts) {
            return 'Градът няма привилегии за отборите си.';
        }
        $last = array_pop($parts);
        return 'Тук ' . ($parts ? implode(', ', $parts) . ' и ' : '') . $last . '.';
    }
}
