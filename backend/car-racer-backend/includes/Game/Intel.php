<?php

namespace BgRally\Game;

use BgRally\Catalog\Texts;
use BgRally\Database\Tables;
use BgRally\Settings;

final class Intel
{
    public static function view(array $manager, array $rally, ?array $entry): ?array
    {
        $managerId = (int) $manager['id'];
        $informant = Staff::member($managerId, 'informant');
        $saboteur = Staff::member($managerId, 'saboteur');
        if (!$entry || (!$informant && !$saboteur)) {
            return null;
        }

        return [
            'informant' => $informant ? ['name' => $informant['name'], 'skill' => (int) $informant['skill']] : null,
            'scouting' => $informant && $rally['status'] === 'scheduled' ? self::scout($managerId, $entry, (int) $informant['skill']) : null,
            'warnings' => $informant ? Sabotage::warnings($managerId, (int) $rally['id']) : [],
            'sabotage' => $saboteur ? Sabotage::panel($manager, $rally, $entry, $saboteur) : null,
        ];
    }

    private static function scout(int $managerId, array $entry, int $skill): array
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT manager_id, player_car_id FROM ' . Tables::name('entries') . ' WHERE rally_id = %d AND class = %s AND manager_id > 0 AND manager_id <> %d ORDER BY start_number',
            $entry['rally_id'],
            $entry['class'],
            $managerId
        ), ARRAY_A);

        $parts = $skill >= Settings::int('intel_parts_skill');
        $exact = $skill >= Settings::int('intel_exact_skill');
        $round = fn($value) => $exact ? (int) round((float) $value) : (int) (round((float) $value / 10) * 10);

        return array_map(function (array $row) use ($parts, $exact, $round) {
            $rivalId = (int) $row['manager_id'];
            $snapshot = Garage::snapshot((int) $row['player_car_id']);
            $crew = Staff::crew($rivalId);

            return [
                'team' => Managers::name($rivalId),
                'car' => $snapshot['car']['name'] ?? '',
                'tyre' => !empty($snapshot['tyre']) ? ['name' => Texts::of($snapshot['tyre']['name']), 'health' => $round($snapshot['tyre']['health'])] : null,
                'parts' => $parts ? array_values(array_map(fn($part) => [
                    'label' => Labels::text('PART_TYPES', $part['type']),
                    'name' => Texts::of($part['name']),
                    'health' => $round($part['health']),
                ], $snapshot['parts'] ?? [])) : null,
                'crew' => $exact ? ['pilot' => $crew['pilot']['skill'], 'navigator' => $crew['navigator']['skill']] : null,
            ];
        }, $rows);
    }
}
