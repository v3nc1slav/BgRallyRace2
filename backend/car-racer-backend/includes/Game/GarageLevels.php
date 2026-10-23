<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\I18n;

final class GarageLevels
{
    private static function rows(): array
    {
        return Registry::get('garage_levels')->all();
    }

    public static function get(int $level): ?array
    {
        foreach (self::rows() as $row) {
            if ((int) $row['level'] === $level) {
                return $row;
            }
        }
        return null;
    }

    private static function current(int $level): ?array
    {
        $current = null;
        foreach (self::rows() as $row) {
            if ((int) $row['level'] <= $level) {
                $current = $row;
            }
        }
        return $current;
    }

    public static function rolesUnlocked(int $level): array
    {
        $roles = ['pilot', 'navigator'];
        foreach (self::rows() as $row) {
            if ((int) $row['level'] <= $level) {
                $roles = array_merge($roles, array_filter(explode(',', (string) $row['staff_roles'])));
            }
        }
        return array_values(array_unique($roles));
    }

    public static function levelForRole(string $role): int
    {
        if (in_array($role, ['pilot', 'navigator'], true)) {
            return 1;
        }
        foreach (self::rows() as $row) {
            if (in_array($role, explode(',', (string) $row['staff_roles']), true)) {
                return (int) $row['level'];
            }
        }
        return 0;
    }

    public static function hasSecurity(int $level): bool
    {
        return (bool) (self::current($level)['security'] ?? false);
    }

    public static function carSlots(int $level): int
    {
        return max(1, (int) (self::current($level)['cars'] ?? 1));
    }

    public static function spares(int $level): array
    {
        $row = self::current($level);
        return ['tyres' => (int) ($row['spare_tyres'] ?? 0), 'parts' => (int) ($row['spare_parts'] ?? 0)];
    }

    public static function describe(array $row): string
    {
        $parts = [];
        foreach (array_filter(explode(',', (string) $row['staff_roles'])) as $role) {
            $parts[] = mb_strtolower(Labels::text('UNLOCKABLE_ROLES', $role));
        }
        if ((int) $row['spare_tyres']) {
            $parts[] = I18n::t('server.garageLevels.tyres', ['count' => $row['spare_tyres']]);
        }
        if ((int) $row['spare_parts']) {
            $parts[] = I18n::t('server.garageLevels.parts', ['count' => $row['spare_parts']]);
        }
        if ((int) $row['cars'] > 1) {
            $parts[] = I18n::t('server.garageLevels.cars', ['count' => $row['cars']]);
        }
        if ($row['security']) {
            $parts[] = I18n::t('server.garageLevels.security');
        }
        return implode(', ', $parts);
    }

    public static function view(int $level): array
    {
        $next = self::get($level + 1);
        return [
            'level' => $level,
            'car_slots' => self::carSlots($level),
            'next' => $next ? [
                'level' => (int) $next['level'],
                'price' => (int) $next['price'],
                'min_level' => (int) $next['min_level'],
                'unlocks' => self::describe($next),
            ] : null,
        ];
    }
}
