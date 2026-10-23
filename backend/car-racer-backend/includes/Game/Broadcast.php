<?php

namespace BgRally\Game;

use BgRally\Catalog\Texts;
use BgRally\Database\Tables;
use BgRally\I18n;

final class Broadcast
{
    public static function view(array $rally, int $managerId): ?array
    {
        $run = Rallies::runRow((int) $rally['id']);
        if (!$run) {
            return null;
        }

        $elapsed = Rallies::now() - strtotime($rally['start_at']);
        if ($elapsed < 0) {
            return ['state' => 'waiting'];
        }

        $length = max(1, (int) $run['broadcast_s']);
        $duration = max(1, (int) $run['duration_s']);
        $finished = $elapsed >= $length;
        $revealed = $finished ? $duration : (int) floor($elapsed / $length * $duration);

        $view = [
            'state' => $finished ? 'finished' : 'live',
            'progress' => (int) round($revealed / $duration * 100),
            'ends_at' => str_replace(' ', 'T', $run['broadcast_end']),
            'events' => self::events((int) $rally['id'], $revealed),
            'table' => self::table((int) $rally['id'], $revealed, $managerId),
            'timeline' => self::timeline($rally, $revealed, $duration / $length, $duration, $finished, $managerId),
        ];

        if ($finished) {
            $view['classification'] = self::classification((int) $rally['id'], $managerId);
        }

        return $view;
    }

    private static function events(int $rallyId, int $revealed): array
    {
        global $wpdb;
        $events = Tables::name('events');

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT offset_s, type, text FROM $events WHERE rally_id = %d AND offset_s <= %d AND type <> 'go' ORDER BY offset_s DESC, id DESC LIMIT 300",
            $rallyId,
            $revealed
        ), ARRAY_A);

        return array_map(fn($row) => ['offset' => (int) $row['offset_s'], 'type' => $row['type'], 'text' => I18n::render($row['text'])], $rows);
    }

    private static function timeline(array $rally, int $revealed, float $scale, int $duration, bool $finished, int $managerId): array
    {
        global $wpdb;
        $rallyId = (int) $rally['id'];
        $events = Tables::name('events');
        $entries = Tables::name('entries');

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT entry_id, seq, type, offset_s, penalty_s FROM $events WHERE rally_id = %d AND entry_id > 0 AND seq > 0 ORDER BY offset_s, id",
            $rallyId
        ), ARRAY_A);

        $legs = [];
        foreach ($rows as $row) {
            $entry = (int) $row['entry_id'];
            $seq = (int) $row['seq'];
            $at = (int) $row['offset_s'];

            if ($row['type'] === 'go') {
                if ($finished || $at <= $revealed) {
                    $legs[$entry][$seq] = ['start' => $at, 'end' => null, 'stop' => false, 'pauses' => []];
                }
                continue;
            }
            if (!isset($legs[$entry][$seq]) || $legs[$entry][$seq]['end'] !== null) {
                continue;
            }

            $penalty = (int) $row['penalty_s'];
            $leg = &$legs[$entry][$seq];
            switch ($row['type']) {
                case 'mistake':
                case 'puncture':
                case 'breakdown':
                    if ($penalty > 0) {
                        $leg['pauses'][] = [$at, $penalty];
                    } else {
                        $leg['end'] = $at;
                        $leg['stop'] = true;
                    }
                    break;
                case 'finish':
                case 'dnf':
                    $leg['end'] = $at;
                    break;
                case 'crash':
                case 'chassis':
                    $leg['end'] = $at;
                    $leg['stop'] = true;
                    break;
            }
            unset($leg);
        }

        $crews = [];
        $entryRows = $wpdb->get_results($wpdb->prepare("SELECT id, start_number, class, pilot_name, manager_id FROM $entries WHERE rally_id = %d ORDER BY start_number", $rallyId), ARRAY_A);
        foreach ($entryRows as $row) {
            if (empty($legs[(int) $row['id']])) {
                continue;
            }
            $crews[] = [
                'id' => (int) $row['id'],
                'number' => (int) $row['start_number'],
                'pilot' => $row['pilot_name'],
                'class' => (int) $row['class'],
                'is_me' => (int) $row['manager_id'] === $managerId,
                'legs' => (object) $legs[(int) $row['id']],
            ];
        }

        return [
            'start_at' => str_replace(' ', 'T', $rally['start_at']),
            'weather' => self::weather($rally),
            'revealed' => $revealed,
            'duration' => $duration,
            'scale' => round($scale, 3),
            'finished' => $finished,
            'stages' => array_map(fn($stage, $index) => [
                'seq' => $index + 1,
                'id' => (int) $stage['id'],
                'name' => Texts::of($stage['name']),
                'length_km' => (float) $stage['length_km'],
                'turns' => (int) $stage['turns'],
                'surface' => $stage['surface'],
                'difficulty' => (int) $stage['difficulty'],
                'route' => json_decode((string) ($stage['route'] ?? ''), true) ?: null,
            ], Rallies::stages($rally), array_keys(Rallies::stages($rally))),
            'crews' => $crews,
        ];
    }

    private static function weather(array $rally): array
    {
        global $wpdb;
        $at = $wpdb->get_var($wpdb->prepare(
            'SELECT offset_s FROM ' . Tables::name('events') . " WHERE rally_id = %d AND type = 'weather' ORDER BY offset_s LIMIT 1",
            $rally['id']
        ));

        return [
            'start' => $rally['weather'] ?: 'dry',
            'change' => $at !== null && !empty($rally['weather_change']) ? ['at' => (int) $at, 'to' => $rally['weather_change']] : null,
        ];
    }

    private static function table(int $rallyId, int $revealed, int $managerId): array
    {
        global $wpdb;
        $entries = Tables::name('entries');
        $times = Tables::name('stage_times');

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT e.id, e.class, e.team_name, e.pilot_name, e.manager_id, e.status, e.dnf_stage,
                    COUNT(st.id) AS stages, COALESCE(SUM(st.time_ms), 0) AS total_ms
             FROM $entries e
             LEFT JOIN $times st ON st.entry_id = e.id AND st.start_s * 1000 + st.time_ms <= %d * 1000
             WHERE e.rally_id = %d
             GROUP BY e.id",
            $revealed,
            $rallyId
        ), ARRAY_A);

        usort($rows, fn($a, $b) => [(int) $b['stages'], (int) $a['total_ms']] <=> [(int) $a['stages'], (int) $b['total_ms']]);

        return self::groupByClass($rows, fn($row) => [
            'team' => Account::team($row['team_name']),
            'pilot' => $row['pilot_name'],
            'stages' => (int) $row['stages'],
            'total_ms' => (int) $row['total_ms'],
            'dns' => $row['status'] === 'dnf' && (int) $row['dnf_stage'] === 0,
            'is_me' => (int) $row['manager_id'] === $managerId,
        ]);
    }

    private static function classification(int $rallyId, int $managerId): array
    {
        global $wpdb;
        $entries = Tables::name('entries');

        $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $entries WHERE rally_id = %d ORDER BY place", $rallyId), ARRAY_A);

        return self::groupByClass($rows, fn($row) => [
            'place' => (int) $row['place'],
            'team' => Account::team($row['team_name']),
            'pilot' => $row['pilot_name'],
            'total_ms' => (int) $row['total_ms'],
            'status' => $row['status'],
            'points' => (int) $row['points'],
            'prize' => (int) $row['prize'],
            'is_me' => (int) $row['manager_id'] === $managerId,
        ]);
    }

    private static function groupByClass(array $rows, callable $map): array
    {
        $classes = [];
        foreach ($rows as $row) {
            $class = (int) $row['class'];
            $classes[$class] ??= ['class' => $class, 'label' => Labels::classLabel($class), 'rows' => []];
            $classes[$class]['rows'][] = $map($row);
        }
        krsort($classes);
        return array_values($classes);
    }
}
