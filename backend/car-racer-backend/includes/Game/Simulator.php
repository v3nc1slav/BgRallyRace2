<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Database\Tables;
use BgRally\Settings;

final class Simulator
{
    private const BASE_SPEED = [
        'asphalt' => ['fast' => 115, 'technical' => 95],
        'gravel' => ['fast' => 105, 'technical' => 85],
        'snow' => ['fast' => 90, 'technical' => 75],
    ];
    private const WEATHER_SPEED = ['dry' => 1.0, 'rain' => 0.93, 'snow' => 0.88];
    private const STYLE_TIME = ['safe' => 1.03, 'normal' => 1.0, 'attack' => 0.97];
    private const STYLE_WEAR = ['safe' => 0.8, 'normal' => 1.0, 'attack' => 1.4];
    private const SURFACE_WEAR = ['asphalt' => 1.0, 'gravel' => 1.3, 'snow' => 1.1];
    private const STYLE_RISK = [
        'mistake' => ['safe' => 0.6, 'normal' => 1.0, 'attack' => 1.8],
        'puncture' => ['safe' => 0.8, 'normal' => 1.0, 'attack' => 1.5],
        'breakdown' => ['safe' => 0.8, 'normal' => 1.0, 'attack' => 1.3],
        'crash' => ['safe' => 0.4, 'normal' => 1.0, 'attack' => 2.5],
        'chassis' => ['safe' => 0.4, 'normal' => 1.0, 'attack' => 2.5],
    ];
    private const SEVERITY = ['chassis', 'crash', 'breakdown', 'puncture', 'mistake'];
    private const BOT_GRIP = 0.95;
    private const RECON_WEAR = 0.1;
    private const START_INTERVAL = 60;
    private const STAGE_GAP = 300;
    private const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

    private array $stages;
    private array $catalog = [];
    private array $crews = [];
    private array $events = [];
    private array $times = [];
    private int $duration = 1;
    private string $weather;
    private ?string $newWeather = null;
    private ?int $changeStage = null;

    private function __construct(private readonly array $rally)
    {
        $this->stages = Rallies::stages($rally);
        $this->weather = $rally['weather'] ?: 'dry';

        foreach (Registry::get('incidents')->all() as $event) {
            if ($event['active']) {
                $this->catalog[$event['type']][] = $event;
            }
        }
    }

    public static function run(int $rallyId): bool
    {
        global $wpdb;
        $table = Registry::get('rallies')->table();

        $claimed = $wpdb->query($wpdb->prepare("UPDATE $table SET status = 'computing' WHERE id = %d AND status = 'scheduled'", $rallyId));
        if ($claimed !== 1) {
            return false;
        }

        $seed = random_int(1, 2147483647);
        mt_srand($seed);

        $simulator = new self(Registry::get('rallies')->find($rallyId));
        $simulator->forecast();
        $simulator->loadCrews();
        $simulator->race();
        $simulator->classify();
        $simulator->save($seed);

        $wpdb->update($table, ['status' => 'finished'], ['id' => $rallyId]);
        return true;
    }

    public static function publish(int $rallyId): void
    {
        global $wpdb;
        $runs = Tables::name('rally_runs');
        $entries = Tables::name('entries');

        $claimed = $wpdb->query($wpdb->prepare("UPDATE $runs SET published = 1 WHERE rally_id = %d AND published = 0", $rallyId));
        if ($claimed !== 1) {
            return;
        }

        $rally = Registry::get('rallies')->find($rallyId);
        $name = $rally['name'] ?? '';
        $sizes = [];
        foreach ($wpdb->get_results($wpdb->prepare("SELECT class, COUNT(*) AS size FROM $entries WHERE rally_id = %d GROUP BY class", $rallyId), ARRAY_A) as $row) {
            $sizes[$row['class']] = (int) $row['size'];
        }
        $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $entries WHERE rally_id = %d AND manager_id > 0", $rallyId), ARRAY_A);

        foreach ($rows as $entry) {
            $managerId = (int) $entry['manager_id'];
            $place = (int) $entry['place'];

            if ((int) $entry['prize'] > 0) {
                Ledger::add($managerId, (int) $entry['prize'], 'prize', sprintf('%s – %d място', $name, $place));
            }
            Progress::addXp($managerId, (int) $entry['xp']);
            Garage::applyWear(json_decode((string) $entry['wear'], true) ?: []);
            Garage::applyEffects($managerId, (int) $entry['player_car_id'], json_decode((string) $entry['effects'], true) ?: []);
            Staff::afterRally($managerId, $place, $sizes[$entry['class']] ?? 1, $entry['status']);

            Inbox::add($managerId, $entry['status'] === 'finished'
                ? sprintf('%s: %d място в %s, %d € награда и %d опит.', $name, $place, Labels::classLabel($entry['class']), $entry['prize'], $entry['xp'])
                : sprintf('%s: отпаднахте. Получавате %d опит.', $name, $entry['xp']));

            $manager = Managers::find($managerId);
            if ($manager) {
                Sponsors::afterRally($manager, $entry, $name);
            }
        }
    }

    public static function wearAmount(float $ratePer100km, float $km, string $surface, string $style): float
    {
        return $ratePer100km * $km / 100 * (self::SURFACE_WEAR[$surface] ?? 1) * (self::STYLE_WEAR[$style] ?? 1);
    }

    public static function reconWear(array $snapshot, array $stages): array
    {
        $wear = [];
        foreach ($stages as $stage) {
            $km = (float) $stage['length_km'];
            foreach ($snapshot['parts'] as $part) {
                $wear[$part['id']] = ($wear[$part['id']] ?? 0) + self::wearAmount((float) $part['wear_per_100km'], $km, $stage['surface'], 'normal') * self::RECON_WEAR;
            }
            if ($snapshot['tyre']) {
                $id = $snapshot['tyre']['id'];
                $wear[$id] = ($wear[$id] ?? 0) + self::wearAmount((float) $snapshot['tyre']['wear_per_100km'], $km, $stage['surface'], 'normal') * self::RECON_WEAR;
            }
        }
        return $wear;
    }

    private function forecast(): void
    {
        $target = (string) ($this->rally['weather_change'] ?? '');
        if ($target === '' || $target === $this->weather || !$this->stages) {
            return;
        }
        if (mt_rand(1, 100) <= (int) $this->rally['change_chance']) {
            $this->newWeather = $target;
            $this->changeStage = mt_rand(0, count($this->stages) - 1);
        }
    }

    private function loadCrews(): void
    {
        global $wpdb;
        $entries = Tables::name('entries');
        $rallyId = (int) $this->rally['id'];

        $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $entries WHERE rally_id = %d AND manager_id > 0 ORDER BY start_number", $rallyId), ARRAY_A);

        $perClass = [];
        $next = 1;
        foreach ($rows as $entry) {
            $crew = $this->playerCrew($entry);
            $this->crews[] = $crew;
            $perClass[$crew['class']] = ($perClass[$crew['class']] ?? 0) + 1;
            $next = max($next, (int) $entry['start_number'] + 1);
        }

        $min = Settings::int('grid_min_per_class');
        foreach ($perClass as $class => $count) {
            foreach (Bots::pick($rallyId, (string) $class, $min - $count) as $bot) {
                $wpdb->insert($entries, [
                    'rally_id' => $rallyId,
                    'bot_id' => $bot['id'],
                    'class' => (string) $class,
                    'start_number' => $next,
                    'created_at' => current_time('mysql', true),
                ]);
                $this->crews[] = $this->botCrew((int) $wpdb->insert_id, $bot);
                $next++;
            }
        }
    }

    private static function tyreData(array $row, ?int $id): array
    {
        return [
            'id' => $id,
            'catalog_id' => (int) ($row['catalog_id'] ?? 0),
            'name' => $row['name'],
            'health' => (float) $row['health'],
            'rate' => (float) $row['wear_per_100km'],
            'grip_asphalt_dry' => (float) $row['grip_asphalt_dry'],
            'grip_asphalt_wet' => (float) $row['grip_asphalt_wet'],
            'grip_gravel' => (float) $row['grip_gravel'],
            'grip_snow' => (float) $row['grip_snow'],
        ];
    }

    private function playerCrew(array $entry): array
    {
        $managerId = (int) $entry['manager_id'];
        $snapshot = Garage::snapshot((int) $entry['player_car_id']);
        $manager = Managers::find($managerId);
        $user = $manager ? get_userdata((int) $manager['user_id']) : null;
        $crew = Staff::crew($managerId);
        $spares = $manager ? Rallies::loadout($manager, $entry, $snapshot) : ['tyres' => [], 'parts' => []];

        $parts = [];
        foreach ($snapshot['parts'] ?? [] as $part) {
            $parts[(int) $part['id']] = [
                'type' => $part['type'],
                'health' => (float) $part['health'],
                'rate' => (float) $part['wear_per_100km'],
                'defect' => (bool) $part['defect'],
            ];
        }

        $spareParts = [];
        foreach ($spares['parts'] as $part) {
            $spareParts[$part['type']] = [
                'id' => (int) $part['id'],
                'type' => $part['type'],
                'health' => (float) $part['health'],
                'rate' => (float) $part['wear_per_100km'],
                'defect' => (bool) $part['defect'],
            ];
        }

        $spareTyres = [];
        foreach ($spares['tyres'] as $tyre) {
            $spareTyres[(int) $tyre['id']] = self::tyreData($tyre, (int) $tyre['id']);
        }

        return $this->crew([
            'entry_id' => (int) $entry['id'],
            'manager_id' => $managerId,
            'class' => (string) $entry['class'],
            'team' => $user ? $user->display_name : 'Отбор',
            'pilot' => $crew['pilot']['name'],
            'ready' => $snapshot && !$snapshot['problems'] && !Staff::problems($managerId),
            'stats' => $snapshot['stats'] ?? [],
            'parts' => $parts,
            'tyre' => !empty($snapshot['tyre']) ? self::tyreData($snapshot['tyre'], (int) $snapshot['tyre']['id']) : null,
            'spare_parts' => $spareParts,
            'spare_tyres' => $spareTyres,
            'pilot_skill' => (int) $crew['pilot']['skill'],
            'nav_skill' => (int) $crew['navigator']['skill'],
            'morale' => (float) $crew['morale'],
            'physical' => (float) $crew['physical'],
            'time_factor' => Staff::engineerFactor($crew['engineer']),
            'tyre_factor' => Staff::chemistTyreFactor($crew['chemist']),
            'home' => $manager && (int) $manager['city_id'] === (int) $this->rally['city_id'],
            'recon' => (bool) $entry['recon'],
            'styles' => json_decode((string) $entry['styles'], true) ?: [],
        ]);
    }

    public static function streetCrew(int $managerId): ?array
    {
        $car = Garage::car($managerId);
        $snapshot = $car ? Garage::snapshot((int) $car['player_car_id']) : null;
        if (!$snapshot || $snapshot['problems'] || Staff::problems($managerId)) {
            return null;
        }

        $crew = Staff::crew($managerId);
        $parts = [];
        foreach ($snapshot['parts'] as $part) {
            $parts[(int) $part['id']] = [
                'type' => $part['type'],
                'health' => (float) $part['health'],
                'rate' => (float) $part['wear_per_100km'],
                'defect' => (bool) $part['defect'],
            ];
        }

        return [
            'class' => (string) $snapshot['class'],
            'pilot' => $crew['pilot']['name'],
            'stats' => $snapshot['stats'],
            'parts' => $parts,
            'tyre' => self::tyreData($snapshot['tyre'], (int) $snapshot['tyre']['id']),
            'pilot_skill' => (int) $crew['pilot']['skill'],
            'nav_skill' => (int) $crew['navigator']['skill'],
            'time_factor' => Staff::engineerFactor($crew['engineer']),
            'tyre_factor' => Staff::chemistTyreFactor($crew['chemist']),
            'home' => true,
            'recon' => false,
        ];
    }

    public static function streetBot(array $rival): array
    {
        global $wpdb;
        $cars = Registry::get('cars')->table();
        $car = $wpdb->get_row($wpdb->prepare("SELECT * FROM $cars WHERE active = 1 AND class = %s ORDER BY RAND() LIMIT 1", $rival['class']), ARRAY_A);
        $skill = fn(int $base) => max(10, min(95, $base + mt_rand(-10, 10)));

        return [
            'class' => $rival['class'],
            'pilot' => Names::person(),
            'stats' => $car ? [
                'power' => (int) $car['power'],
                'handling' => (int) $car['handling'],
                'braking' => (int) $car['braking'],
                'reliability' => (int) $car['reliability'],
            ] : $rival['stats'],
            'parts' => [],
            'tyre' => null,
            'pilot_skill' => $skill($rival['pilot_skill']),
            'nav_skill' => $skill($rival['nav_skill']),
            'time_factor' => 1.0,
            'tyre_factor' => 1.0,
            'home' => false,
            'recon' => false,
        ];
    }

    public static function streetWear(array $crew, array $stage, float $factor): array
    {
        $km = (float) $stage['length_km'];
        $wear = [];
        foreach ($crew['parts'] as $id => $part) {
            $wear[$id] = self::wearAmount($part['rate'], $km, $stage['surface'], 'normal') * $factor;
        }
        if ($crew['tyre']) {
            $wear[$crew['tyre']['id']] = self::wearAmount($crew['tyre']['rate'], $km, $stage['surface'], 'normal') * $factor * $crew['tyre_factor'];
        }
        return $wear;
    }

    private function botCrew(int $entryId, array $bot): array
    {
        $car = Registry::get('cars')->find((int) $bot['car_id']);

        return $this->crew([
            'entry_id' => $entryId,
            'class' => (string) $bot['class'],
            'team' => $bot['name'],
            'pilot' => $bot['name'],
            'ready' => (bool) $car,
            'stats' => $car ? [
                'power' => (int) $car['power'],
                'handling' => (int) $car['handling'],
                'braking' => (int) $car['braking'],
                'reliability' => (int) $car['reliability'],
            ] : [],
            'pilot_skill' => (int) $bot['skill'],
            'nav_skill' => (int) $bot['nav_skill'],
            'bot' => true,
        ]);
    }

    private function crew(array $data): array
    {
        return $data + [
            'manager_id' => 0,
            'stats' => [],
            'parts' => [],
            'tyre' => null,
            'spare_parts' => [],
            'spare_tyres' => [],
            'morale' => 70.0,
            'physical' => 50.0,
            'time_factor' => 1.0,
            'tyre_factor' => 1.0,
            'home' => false,
            'recon' => false,
            'styles' => [],
            'bot' => false,
            'status' => 'running',
            'swapped' => false,
            'total' => 0.0,
            'dnf_stage' => 0,
            'place' => 0,
            'points' => 0,
            'prize' => 0,
            'xp' => 0,
            'wear' => [],
            'effects' => ['unmount' => [], 'mount' => [], 'remove' => [], 'tyre_set' => null],
        ];
    }

    private function race(): void
    {
        $this->event(0, 0, 0, 'start', sprintf('Ралито „%s“ започва. На старта са %d екипажа. Времето: %s.', $this->rally['name'], count($this->crews), mb_strtolower(Labels::WEATHER[$this->weather] ?? '')));

        foreach ($this->crews as &$crew) {
            if (!$crew['ready']) {
                $crew['status'] = 'dnf';
                $this->event(0, $crew['entry_id'], 0, 'dns', sprintf('%s не успя да стартира – отборът не е готов.', $crew['pilot']));
            }
        }
        unset($crew);

        $clock = 0;
        foreach ($this->stages as $index => $stage) {
            $seq = $index + 1;
            $runners = array_keys(array_filter($this->crews, fn($crew) => $crew['status'] === 'running'));

            $changeAt = null;
            if ($this->changeStage === $index) {
                $changeAt = $clock + mt_rand(0, max(0, count($runners) - 1)) * self::START_INTERVAL;
                $this->event($changeAt, 0, $seq, 'weather', $this->weatherText($this->newWeather));
            }

            $stageEnd = $clock;
            $finished = [];
            $crashed = [];

            foreach ($runners as $slot => $i) {
                $crew = &$this->crews[$i];
                $start = $clock + $slot * self::START_INTERVAL;
                $weather = $this->newWeather && $this->changeStage !== null
                    && ($index > $this->changeStage || ($changeAt !== null && $start >= $changeAt))
                    ? $this->newWeather
                    : $this->weather;

                $this->event((int) round($start), $crew['entry_id'], $seq, 'go', '');
                $style = $this->style($crew, (int) $stage['id']);
                $time = $this->stageTime($crew, $stage, $style, $weather);
                $event = $this->rollEvent($crew, $stage, $style, $weather, $index);
                $loss = 0;
                $outcome = 'finish';

                if ($event) {
                    $turn = mt_rand(1, max(1, (int) $stage['turns']));
                    $at = (int) ($start + $time * $turn / max(1, (int) $stage['turns']));
                    $seconds = mt_rand((int) $event['penalty_min'], max((int) $event['penalty_min'], (int) $event['penalty_max']));
                    [$outcome, $loss, $text] = $this->applyEvent($crew, $event, $seconds, $seq);
                    $this->event($at, $crew['entry_id'], $seq, $event['type'], $this->fill($event['text'] . $text, $crew, $turn, $seconds, $event), $outcome === 'finish' ? $loss : 0);
                }

                if ($outcome === 'dnf') {
                    $crew['status'] = 'dnf';
                    $crew['dnf_stage'] = $seq;
                    unset($crew);
                    continue;
                }

                $this->wear($crew, $stage, $style);

                if ($outcome === 'crash') {
                    $crashed[] = [$i, $start, $time];
                    unset($crew);
                    continue;
                }

                $total = $time + $loss;
                $finish = $start + $total;
                $notes = [];
                $service = $this->service($crew, $notes);
                if ($service === null) {
                    $crew['status'] = 'dnf';
                    $crew['dnf_stage'] = $seq;
                    $this->event((int) ceil($finish), $crew['entry_id'], $seq, 'dnf', sprintf('%s няма резервна част и отпада от ралито.', $crew['pilot']));
                    unset($crew);
                    continue;
                }

                $crew['total'] += $total + $service;
                $this->times[] = [
                    'entry_id' => $crew['entry_id'],
                    'stage_id' => (int) $stage['id'],
                    'seq' => $seq,
                    'start_s' => (int) round($start),
                    'time_ms' => (int) round(($total + $service) * 1000),
                    'penalty_ms' => (int) round($service * 1000),
                ];
                $this->event((int) ceil($finish), $crew['entry_id'], $seq, 'finish', sprintf('%s завърши етап %d за %s.', $crew['pilot'], $seq, self::formatTime($total)));
                foreach ($notes as $note) {
                    $this->event((int) ceil($finish), $crew['entry_id'], $seq, 'service', $note);
                }
                $finished[$crew['class']][] = [$crew['pilot'], $total];
                $stageEnd = max($stageEnd, $finish);
                unset($crew);
            }

            foreach ($crashed as [$i, $start, $own]) {
                $crew = &$this->crews[$i];
                $times = array_column($finished[$crew['class']] ?? [], 1);
                $penalty = $times ? max($times) + Settings::int('crash_extra') : $own * 1.3;

                $notes = [];
                $service = $this->service($crew, $notes);
                if ($service === null) {
                    $crew['status'] = 'dnf';
                    $crew['dnf_stage'] = $seq;
                    $this->event((int) ceil($stageEnd), $crew['entry_id'], $seq, 'dnf', sprintf('%s няма резервна част след катастрофата и отпада от ралито.', $crew['pilot']));
                    unset($crew);
                    continue;
                }
                foreach ($notes as $note) {
                    $this->event((int) ceil($stageEnd), $crew['entry_id'], $seq, 'service', $note);
                }

                $crew['total'] += $penalty + $service;
                $this->times[] = [
                    'entry_id' => $crew['entry_id'],
                    'stage_id' => (int) $stage['id'],
                    'seq' => $seq,
                    'start_s' => (int) round($start),
                    'time_ms' => (int) round(($penalty + $service) * 1000),
                    'penalty_ms' => (int) round(($penalty + $service) * 1000),
                ];
                $this->event((int) ceil($stageEnd), $crew['entry_id'], $seq, 'penalty', sprintf('%s получава наказателно време за етап %d: %s.', $crew['pilot'], $seq, self::formatTime($penalty)));
                unset($crew);
            }

            krsort($finished);
            foreach ($finished as $class => $results) {
                usort($results, fn($a, $b) => $a[1] <=> $b[1]);
                [$pilot, $time] = $results[0];
                $this->event((int) ceil($stageEnd), 0, $seq, 'stage', sprintf('Етап %d „%s“: най-бърз в %s е %s – %s.', $seq, $stage['name'], Labels::classLabel($class), $pilot, self::formatTime($time)));
            }

            if ($this->changeStage !== null && $index >= $this->changeStage && $index < count($this->stages) - 1) {
                $this->swapTyres((int) ceil($stageEnd), $seq);
            }

            $clock = (int) ceil($stageEnd) + self::STAGE_GAP;
        }

        $this->duration = max(1, $clock - self::STAGE_GAP);
    }

    private function applyEvent(array &$crew, array $event, int $seconds, int $seq): array
    {
        switch ($event['type']) {
            case 'mistake':
                return ['finish', $seconds, ''];

            case 'puncture':
                if ($crew['bot']) {
                    return ['finish', $seconds, sprintf(' Смени гумата за %d сек.', $seconds)];
                }
                $spare = array_key_first($crew['spare_tyres']);
                if ($spare === null) {
                    return ['dnf', 0, ' Няма резервна гума и отпада от ралито.'];
                }
                unset($crew['spare_tyres'][$spare]);
                $crew['effects']['remove'][] = $spare;
                return ['finish', $seconds, sprintf(' Смени гумата за %d сек.', $seconds)];

            case 'breakdown':
                $part = $this->breakdownPart($crew, $event);
                if ($part !== null) {
                    $this->breakPart($crew, $part);
                }
                return ['finish', $seconds, ''];

            case 'crash':
                foreach (['suspension' => 'crash_damage_suspension', 'chassis' => 'crash_damage_chassis'] as $type => $setting) {
                    $this->damage($crew, $type, Settings::get($setting));
                }
                return ['crash', 0, ''];

            case 'chassis':
                $this->damage($crew, 'chassis', 100);
                return ['dnf', 0, ' Отпада от ралито.'];
        }
        return ['finish', 0, ''];
    }

    private function breakdownPart(array $crew, array $event): ?int
    {
        if ($crew['bot'] || !$crew['parts']) {
            return null;
        }

        $weights = [];
        foreach ($crew['parts'] as $id => $part) {
            if ($event['part_type'] !== '' && $part['type'] !== $event['part_type']) {
                continue;
            }
            if ($event['part_type'] === '' && $part['type'] === 'chassis') {
                continue;
            }
            $weights[$id] = (int) round((105 - $part['health']) * ($part['defect'] ? 2 : 1));
        }
        if (!$weights) {
            return null;
        }

        $roll = mt_rand(1, max(1, array_sum($weights)));
        foreach ($weights as $id => $weight) {
            $roll -= $weight;
            if ($roll <= 0) {
                return $id;
            }
        }
        return array_key_last($weights);
    }

    private function breakPart(array &$crew, int $id): void
    {
        $crew['wear'][$id] = ($crew['wear'][$id] ?? 0) + $crew['parts'][$id]['health'];
        $crew['parts'][$id]['health'] = 0;
    }

    private function damage(array &$crew, string $type, float $amount): void
    {
        foreach ($crew['parts'] as $id => $part) {
            if ($part['type'] === $type) {
                $delta = min($part['health'], $amount);
                $crew['parts'][$id]['health'] -= $delta;
                $crew['wear'][$id] = ($crew['wear'][$id] ?? 0) + $delta;
            }
        }
    }

    private function service(array &$crew, array &$notes): ?int
    {
        if ($crew['bot']) {
            return 0;
        }

        $penalty = 0;
        foreach ($crew['parts'] as $id => $part) {
            if ($part['health'] > 0) {
                continue;
            }
            $spare = $crew['spare_parts'][$part['type']] ?? null;
            if (!$spare || $part['type'] === 'chassis') {
                return null;
            }

            unset($crew['parts'][$id], $crew['spare_parts'][$part['type']]);
            $crew['parts'][$spare['id']] = $spare;
            $crew['effects']['unmount'][] = $id;
            $crew['effects']['mount'][] = $spare['id'];
            $penalty += Settings::int('service_penalty');
            $notes[] = sprintf(
                'В сервиза сменят %s на %s (+%d сек.).',
                mb_strtolower(Labels::PART_TYPES[$part['type']] ?? $part['type']),
                $crew['pilot'],
                Settings::int('service_penalty')
            );
        }
        return $penalty;
    }

    private function swapTyres(int $at, int $seq): void
    {
        if (!in_array($this->newWeather, ['rain', 'snow'], true)) {
            return;
        }
        $key = self::gripKey('asphalt', $this->newWeather);

        foreach ($this->crews as &$crew) {
            if ($crew['status'] !== 'running' || $crew['bot'] || $crew['swapped'] || !$crew['tyre']) {
                continue;
            }

            $groups = [];
            foreach ($crew['spare_tyres'] as $id => $tyre) {
                $groups[$tyre['catalog_id']][$id] = $tyre;
            }

            $best = null;
            foreach ($groups as $tyres) {
                if (count($tyres) < 4) {
                    continue;
                }
                $grip = reset($tyres)[$key];
                if ($grip > $crew['tyre'][$key] && (!$best || $grip > reset($best)[$key])) {
                    $best = $tyres;
                }
            }
            if (!$best) {
                continue;
            }

            $set = array_slice($best, 0, 4, true);
            foreach (array_keys($set) as $id) {
                unset($crew['spare_tyres'][$id]);
                $crew['effects']['remove'][] = $id;
            }
            if ($crew['tyre']['id']) {
                $crew['effects']['unmount'][] = $crew['tyre']['id'];
            }

            $first = reset($set);
            $crew['tyre'] = ['id' => null, 'health' => array_sum(array_column($set, 'health')) / 4] + $first;
            $crew['swapped'] = true;
            $this->event($at, $crew['entry_id'], $seq, 'swap', sprintf('%s смени гумите с „%s“ заради времето.', $crew['pilot'], $first['name']));
        }
        unset($crew);
    }

    private function style(array $crew, int $stageId): string
    {
        if ($crew['bot']) {
            $roll = mt_rand(1, 100);
            return $roll <= 15 ? 'safe' : ($roll <= 30 ? 'attack' : 'normal');
        }
        $style = $crew['styles'][$stageId] ?? 'normal';
        return isset(self::STYLE_TIME[$style]) ? $style : 'normal';
    }

    private static function gripKey(string $surface, string $weather): string
    {
        return match (true) {
            $surface === 'snow' || $weather === 'snow' => 'grip_snow',
            $surface === 'gravel' => 'grip_gravel',
            $weather === 'rain' => 'grip_asphalt_wet',
            default => 'grip_asphalt_dry',
        };
    }

    private static function grip(array $crew, array $stage, string $weather): float
    {
        if (!$crew['tyre']) {
            return self::BOT_GRIP;
        }
        return $crew['tyre'][self::gripKey($stage['surface'], $weather)] * (0.85 + 0.15 * $crew['tyre']['health'] / 100);
    }

    private static function partsHealth(array $crew): float
    {
        if (!$crew['parts']) {
            return 100;
        }
        return array_sum(array_column($crew['parts'], 'health')) / count(Labels::PART_TYPES);
    }

    public static function stageTime(array $crew, array $stage, string $style, string $weather): float
    {
        $speed = (self::BASE_SPEED[$stage['surface']][$stage['profile']] ?? 90) - (int) $stage['difficulty'] * 1.5;
        $speed *= self::WEATHER_SPEED[$weather] ?? 1;
        $base = (float) $stage['length_km'] / max(20, $speed) * 3600;

        $stats = $crew['stats'] + ['power' => 0, 'handling' => 0, 'braking' => 0];
        $weights = $stage['profile'] === 'fast' ? [0.6, 0.25, 0.15] : [0.3, 0.4, 0.3];
        $performance = $weights[0] * $stats['power'] / 300 + $weights[1] * $stats['handling'] / 60 + $weights[2] * $stats['braking'] / 60;
        $carFactor = 1 / max(0.3, 0.6 + 0.4 * $performance);

        $tyreFactor = 1 / (0.5 + 0.5 * self::grip($crew, $stage, $weather));
        $partsFactor = 1 + 0.15 * (1 - self::partsHealth($crew) / 100);
        $crewFactor = 1 - 0.08 * ($crew['pilot_skill'] - 50) / 50 - 0.02 * ($crew['nav_skill'] - 50) / 50;
        $bonus = ($crew['home'] ? 0.98 : 1) * ($crew['recon'] ? 0.99 : 1) * $crew['time_factor'];
        $random = 1 + mt_rand(-150, 150) / 10000;

        return $base * $carFactor * $tyreFactor * $partsFactor * $crewFactor * self::STYLE_TIME[$style] * $bonus * $random;
    }

    private function rollEvent(array $crew, array $stage, string $style, string $weather, int $index): ?array
    {
        foreach (self::SEVERITY as $type) {
            foreach ($this->catalog[$type] ?? [] as $event) {
                if ($event['surface'] !== '' && $event['surface'] !== $stage['surface']) {
                    continue;
                }
                if ($event['weather'] !== '' && $event['weather'] !== $weather) {
                    continue;
                }
                $chance = (float) $event['chance'] / 100 * $this->modifier($type, $crew, $stage, $style, $weather, $index);
                if (mt_rand() / mt_getrandmax() < $chance) {
                    return $event;
                }
            }
        }
        return null;
    }

    private function modifier(string $type, array $crew, array $stage, string $style, string $weather, int $index): float
    {
        $factor = (self::STYLE_RISK[$type][$style] ?? 1) * (0.6 + (int) $stage['difficulty'] / 10);
        $morale = max(0.5, 1 + (70 - $crew['morale']) / 100);
        $slippery = self::grip($crew, $stage, $weather) < 0.85 ? 1.5 : 1;
        $fatigue = 1 + $index * Settings::get('fatigue_per_stage') / 100 * (1 - $crew['physical'] / 100);

        switch ($type) {
            case 'mistake':
                return $factor * (1 - $crew['nav_skill'] / 200) * ($crew['recon'] ? 0.7 : 1) * $slippery * $morale * $fatigue;

            case 'puncture':
                $health = $crew['tyre']['health'] ?? 100;
                return $factor * (1 + (1 - $health / 100));

            case 'breakdown':
                $reliability = max(0.5, 1.5 - ($crew['stats']['reliability'] ?? 50) / 100);
                $worn = 1;
                foreach ($crew['parts'] as $part) {
                    $risk = ($part['health'] < 50 ? 1 + 2 * (50 - $part['health']) / 50 : 1) * ($part['defect'] ? 2 : 1);
                    $worn = max($worn, $risk);
                }
                return $factor * $reliability * $worn;

            case 'crash':
            case 'chassis':
                return $factor * (1 - $crew['pilot_skill'] / 200) * $morale * $slippery * $fatigue * ($weather !== 'dry' ? 1.3 : 1) * ($crew['recon'] ? 0.85 : 1);
        }
        return $factor;
    }

    private function fill(string $text, array $crew, int $turn, int $seconds, array $event): string
    {
        $part = $event['part_type'] !== '' ? $event['part_type'] : '';
        if ($event['type'] === 'breakdown' && $part === '') {
            foreach ($crew['parts'] as $item) {
                if ($item['health'] <= 0) {
                    $part = $item['type'];
                }
            }
        }
        $partLabel = mb_strtolower(Labels::PART_TYPES[$part] ?? Labels::PART_TYPES[array_rand(array_diff_key(Labels::PART_TYPES, ['chassis' => 1]))]);

        return strtr($text, [
            '{пилот}' => $crew['pilot'],
            '{завой}' => self::ordinal($turn),
            '{секунди}' => (string) $seconds,
            '{част}' => $partLabel,
        ]);
    }

    private function weatherText(string $weather): string
    {
        foreach ($this->catalog['weather'] ?? [] as $event) {
            if ($event['weather'] === $weather) {
                return $event['text'];
            }
        }
        return sprintf('Времето се промени: %s.', mb_strtolower(Labels::WEATHER[$weather] ?? $weather));
    }

    private function wear(array &$crew, array $stage, string $style): void
    {
        $km = (float) $stage['length_km'];

        foreach ($crew['parts'] as $id => &$part) {
            if ($part['health'] <= 0) {
                continue;
            }
            $amount = min($part['health'], self::wearAmount($part['rate'], $km, $stage['surface'], $style));
            $part['health'] -= $amount;
            $crew['wear'][$id] = ($crew['wear'][$id] ?? 0) + $amount;
        }
        unset($part);

        if ($crew['tyre']) {
            $amount = min($crew['tyre']['health'], self::wearAmount($crew['tyre']['rate'], $km, $stage['surface'], $style) * $crew['tyre_factor']);
            $crew['tyre']['health'] -= $amount;
            if ($crew['tyre']['id']) {
                $crew['wear'][$crew['tyre']['id']] = ($crew['wear'][$crew['tyre']['id']] ?? 0) + $amount;
            }
        }
    }

    private function classify(): void
    {
        $prizes = array_map('intval', array_filter(array_map('trim', explode(',', (string) $this->rally['prizes'])), 'strlen'));
        $xpParticipation = Settings::int('xp_participation');
        $xpWin = Settings::int('xp_win');

        foreach ($this->crews as &$crew) {
            if ($crew['status'] === 'running') {
                $crew['status'] = 'finished';
            }
            if ($crew['swapped'] && $crew['tyre']) {
                $crew['effects']['tyre_set'] = ['catalog_id' => $crew['tyre']['catalog_id'], 'health' => round($crew['tyre']['health'], 2)];
            }
        }
        unset($crew);

        $classes = [];
        foreach ($this->crews as $index => $crew) {
            $classes[$crew['class']][] = $index;
        }
        krsort($classes);

        foreach ($classes as $class => $indexes) {
            usort($indexes, function (int $a, int $b) {
                $x = $this->crews[$a];
                $y = $this->crews[$b];
                return [$x['status'] !== 'finished', -$x['dnf_stage'], $x['total']] <=> [$y['status'] !== 'finished', -$y['dnf_stage'], $y['total']];
            });

            $count = count($indexes);
            foreach ($indexes as $position => $index) {
                $crew = &$this->crews[$index];
                $place = $position + 1;
                $crew['place'] = $place;
                $crew['points'] = self::POINTS[$position] ?? 0;

                if (!$crew['bot']) {
                    $crew['prize'] = $prizes[$position] ?? 0;
                    $bonus = $crew['status'] === 'finished'
                        ? ($count > 1 ? (int) round($xpWin * ($count - $place) / ($count - 1)) : $xpWin)
                        : 0;
                    $crew['xp'] = $xpParticipation + $bonus;
                }

                if ($place === 1 && $crew['status'] === 'finished') {
                    $this->event($this->duration, 0, count($this->stages), 'winner', sprintf('Победител в %s е %s с общо време %s.', Labels::classLabel($class), $crew['pilot'], self::formatTime($crew['total'])));
                }
                unset($crew);
            }
        }
    }

    private function save(int $seed): void
    {
        global $wpdb;
        $rallyId = (int) $this->rally['id'];

        foreach ($this->times as $row) {
            $wpdb->insert(Tables::name('stage_times'), ['rally_id' => $rallyId] + $row);
        }
        foreach ($this->events as $row) {
            $wpdb->insert(Tables::name('events'), ['rally_id' => $rallyId] + $row);
        }

        foreach ($this->crews as $crew) {
            $wpdb->update(Tables::name('entries'), [
                'status' => $crew['status'],
                'team_name' => $crew['team'],
                'pilot_name' => $crew['pilot'],
                'total_ms' => (int) round($crew['total'] * 1000),
                'dnf_stage' => $crew['dnf_stage'],
                'place' => $crew['place'],
                'points' => $crew['points'],
                'prize' => $crew['prize'],
                'xp' => $crew['xp'],
                'wear' => wp_json_encode((object) $crew['wear']),
                'effects' => wp_json_encode($crew['effects']),
            ], ['id' => $crew['entry_id']]);
        }

        $broadcast = max(1, min(Settings::int('broadcast_minutes') * 60, $this->duration));
        $wpdb->replace(Tables::name('rally_runs'), [
            'rally_id' => $rallyId,
            'seed' => $seed,
            'duration_s' => $this->duration,
            'broadcast_s' => $broadcast,
            'broadcast_end' => date('Y-m-d H:i:s', strtotime($this->rally['start_at']) + $broadcast),
            'published' => 0,
            'computed_at' => current_time('mysql'),
        ]);
    }

    private function event(int $offset, int $entryId, int $seq, string $type, string $text, int $penalty = 0): void
    {
        $this->events[] = ['offset_s' => $offset, 'entry_id' => $entryId, 'seq' => $seq, 'type' => $type, 'text' => mb_substr($text, 0, 255), 'penalty_s' => $penalty];
    }

    public static function formatTime(float $seconds): string
    {
        $minutes = (int) floor($seconds / 60);
        $rest = $seconds - $minutes * 60;
        if ($minutes >= 60) {
            return sprintf('%d:%02d:%04.1f', intdiv($minutes, 60), $minutes % 60, $rest);
        }
        return sprintf('%d:%04.1f', $minutes, $rest);
    }

    private static function ordinal(int $number): string
    {
        $lastTwo = $number % 100;
        $last = $number % 10;
        if ($lastTwo < 11 || $lastTwo > 19) {
            if ($last === 1) {
                return $number . '-вия';
            }
            if ($last === 2) {
                return $number . '-рия';
            }
            if ($last === 7 || $last === 8) {
                return $number . '-мия';
            }
        }
        return $number . '-ия';
    }
}
