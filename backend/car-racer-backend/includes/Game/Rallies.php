<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Catalog\Texts;
use BgRally\Database\Tables;
use BgRally\I18n;
use BgRally\Settings;
use WP_Error;

final class Rallies
{
    public static function now(): int
    {
        return strtotime(current_time('mysql'));
    }

    public static function week(): string
    {
        return date('o-W', self::now());
    }

    public static function hasUpcomingEntry(int $managerId): bool
    {
        global $wpdb;
        return (bool) $wpdb->get_var($wpdb->prepare(
            'SELECT 1 FROM ' . Tables::name('entries') . ' e JOIN ' . self::table() . " r ON r.id = e.rally_id WHERE e.manager_id = %d AND r.status IN ('scheduled', 'computing') LIMIT 1",
            $managerId
        ));
    }

    private static function table(): string
    {
        return Registry::get('rallies')->table();
    }

    public static function stages(array $rally): array
    {
        global $wpdb;
        $ids = array_values(array_filter(array_map('intval', explode(',', (string) $rally['stage_ids']))));
        if (!$ids) {
            return [];
        }

        $table = Registry::get('stages')->table();
        $placeholders = implode(',', array_fill(0, count($ids), '%d'));
        return $wpdb->get_results($wpdb->prepare("SELECT * FROM $table WHERE id IN ($placeholders) ORDER BY position, id", ...$ids), ARRAY_A);
    }

    public static function runRow(int $rallyId): ?array
    {
        global $wpdb;
        $runs = Tables::name('rally_runs');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $runs WHERE rally_id = %d", $rallyId), ARRAY_A);
    }

    public static function runDue(): void
    {
        global $wpdb;
        $runs = Tables::name('rally_runs');
        $now = current_time('mysql');

        foreach ($wpdb->get_col($wpdb->prepare('SELECT id FROM ' . self::table() . " WHERE status = 'scheduled' AND start_at <= %s", $now)) as $id) {
            Simulator::run((int) $id);
        }
        foreach ($wpdb->get_col($wpdb->prepare("SELECT rally_id FROM $runs WHERE published = 0 AND broadcast_end <= %s", $now)) as $id) {
            Simulator::publish((int) $id);
        }
        Sponsors::expire();
        Work::runDaily();
        Market::expire();
        Push::reminders();
        Push::flush();
        Inactivity::mark();
        Payroll::runAll();
    }

    public static function adminRun(int $id): string
    {
        global $wpdb;
        $rally = Registry::get('rallies')->find($id);

        if (!$rally) {
            return 'Няма такова рали.';
        }
        if ($rally['status'] !== 'scheduled') {
            return 'Ралито вече е изчислено. Първо го нулирайте.';
        }

        if (strtotime($rally['start_at']) > self::now()) {
            $wpdb->update(self::table(), ['start_at' => current_time('mysql')], ['id' => $id]);
        }
        Simulator::run($id);

        return sprintf('Ралито „%s“ е изчислено и стартът е преместен на сега. Предаването трае до %d мин.', $rally['name'], Settings::int('broadcast_minutes'));
    }

    public static function adminReset(int $id): string
    {
        global $wpdb;
        $entries = Tables::name('entries');

        $wpdb->delete(Tables::name('stage_times'), ['rally_id' => $id]);
        $wpdb->delete(Tables::name('events'), ['rally_id' => $id]);
        $wpdb->delete(Tables::name('rally_runs'), ['rally_id' => $id]);
        $wpdb->query($wpdb->prepare("DELETE FROM $entries WHERE rally_id = %d AND bot_id > 0", $id));
        $wpdb->query($wpdb->prepare(
            "UPDATE $entries SET status = 'registered', team_name = '', pilot_name = '', total_ms = 0, dnf_stage = 0, place = 0, points = 0, prize = 0, xp = 0, wear = NULL WHERE rally_id = %d",
            $id
        ));
        $wpdb->update(self::table(), ['status' => 'scheduled'], ['id' => $id]);

        return 'Резултатите са изтрити и ралито отново предстои. Вече раздадените пари, опит и износване не се връщат.';
    }

    public static function currentSeason(): int
    {
        global $wpdb;
        $season = $wpdb->get_var($wpdb->prepare('SELECT season FROM ' . self::table() . ' WHERE start_at >= %s ORDER BY start_at LIMIT 1', current_time('mysql')));
        $season ??= $wpdb->get_var('SELECT MAX(season) FROM ' . self::table());
        return max(1, (int) $season);
    }

    private static function deadline(array $rally): int
    {
        return strtotime($rally['start_at']) - Settings::int('registration_close_minutes') * 60;
    }

    private static function reconDate(array $rally): string
    {
        return date('Y-m-d', strtotime($rally['start_at']) - DAY_IN_SECONDS);
    }

    public static function state(array $rally): string
    {
        $now = self::now();

        if ($rally['status'] === 'scheduled') {
            return $now < self::deadline($rally) ? 'open' : 'closed';
        }

        $run = self::runRow((int) $rally['id']);
        if (!$run || $now < strtotime($rally['start_at'])) {
            return 'closed';
        }
        return $now < strtotime($run['broadcast_end']) ? 'live' : 'finished';
    }

    public static function fuelForKm(float $km, int $managerId): int
    {
        $car = Garage::car($managerId);
        return $car ? self::fuelCost($km, Garage::consumption($car), $managerId) : 0;
    }

    public static function seasonPosition(int $managerId): ?int
    {
        foreach (self::standings($managerId)['classes'] as $class) {
            foreach ($class['rows'] as $row) {
                if ($row['is_me']) {
                    return $row['position'];
                }
            }
        }
        return null;
    }

    private static function fuelCost(float $km, float $consumption, int $managerId): int
    {
        return (int) round($km * $consumption / 100 * Settings::get('fuel_price') * Staff::chemistFuelFactor($managerId));
    }

    private static function entry(int $rallyId, int $managerId): ?array
    {
        global $wpdb;
        $entries = Tables::name('entries');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $entries WHERE rally_id = %d AND manager_id = %d", $rallyId, $managerId), ARRAY_A);
    }

    private static function summary(array $rally, array $manager, ?array $car, bool $registered): array
    {
        $stages = self::stages($rally);
        $km = array_sum(array_map(fn($stage) => (float) $stage['length_km'], $stages));
        $fee = (int) $rally['entry_fee'];
        if ((int) $manager['city_id'] === (int) $rally['city_id']) {
            $fee = (int) round($fee * Privileges::factor((int) $manager['city_id'], 'home_fee'));
        }
        $travel = Travel::cost((int) $manager['city_id'], (int) $rally['city_id']);
        $fuel = $car ? self::fuelCost($km, Garage::consumption($car), (int) $manager['id']) : 0;
        $cities = Registry::get('cities')->options();

        return [
            'id' => (int) $rally['id'],
            'name' => Texts::of($rally['name']),
            'season' => (int) $rally['season'],
            'city' => Texts::of($cities[$rally['city_id']] ?? ''),
            'home' => (int) $manager['city_id'] === (int) $rally['city_id'],
            'start_at' => str_replace(' ', 'T', $rally['start_at']),
            'deadline' => date('Y-m-d\TH:i:s', self::deadline($rally)),
            'recon_date' => self::reconDate($rally),
            'status' => self::state($rally),
            'stages' => array_map(fn($stage) => [
                'id' => (int) $stage['id'],
                'name' => Texts::of($stage['name']),
                'length_km' => (float) $stage['length_km'],
                'surface' => $stage['surface'],
                'surface_label' => Labels::text('SURFACES', $stage['surface']),
                'profile_label' => Labels::text('PROFILES', $stage['profile']),
                'difficulty' => (int) $stage['difficulty'],
                'turns' => (int) $stage['turns'],
            ], $stages),
            'total_km' => round($km, 1),
            'costs' => ['entry_fee' => $fee, 'travel' => $travel, 'fuel' => $fuel, 'total' => $fee + $travel + $fuel],
            'registered' => $registered,
        ];
    }

    public static function list(array $manager): array
    {
        global $wpdb;
        self::runDue();

        $season = self::currentSeason();
        $rallies = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE season = %d ORDER BY start_at', $season), ARRAY_A);
        $mine = array_flip($wpdb->get_col($wpdb->prepare('SELECT rally_id FROM ' . Tables::name('entries') . ' WHERE manager_id = %d', $manager['id'])));
        $car = Garage::car((int) $manager['id']);

        return [
            'season' => $season,
            'rallies' => array_map(fn($rally) => self::summary($rally, $manager, $car, isset($mine[$rally['id']])), $rallies),
        ];
    }

    public static function detail(array $manager, int $id): array|WP_Error
    {
        self::runDue();

        $rally = Registry::get('rallies')->find($id);
        if (!$rally) {
            return new WP_Error('bgr_not_found', I18n::t('server.rallies.noRally'), ['status' => 404]);
        }

        $managerId = (int) $manager['id'];
        $entry = self::entry($id, $managerId);
        $summary = self::summary($rally, $manager, Garage::car($managerId), (bool) $entry);
        $state = $summary['status'];
        $scheduled = $rally['status'] === 'scheduled';
        $weatherKnown = ($entry && $entry['recon']) || in_array($state, ['live', 'finished'], true);

        return $summary + [
            'weather' => $weatherKnown ? self::forecastText($rally) : null,
            'spares' => self::sparesView($manager, $entry),
            'entry' => $entry ? [
                'start_number' => (int) $entry['start_number'],
                'recon' => (bool) $entry['recon'],
                'styles' => (object) (json_decode((string) $entry['styles'], true) ?: []),
                'costs' => (int) $entry['costs'],
            ] : null,
            'can_register' => !$entry && $state === 'open',
            'can_recon' => $entry && !$entry['recon'] && $scheduled && date('Y-m-d', self::now()) === self::reconDate($rally),
            'can_change_styles' => $entry && $scheduled && self::now() < strtotime($rally['start_at']),
            'style_options' => Labels::all('STYLES'),
            'start_list' => self::startList($id, $scheduled, $managerId),
            'intel' => Intel::view($manager, $rally, $entry),
            'broadcast' => Broadcast::view($rally, $managerId),
        ];
    }

    private static function startList(int $rallyId, bool $scheduled, int $managerId): array
    {
        global $wpdb;
        $entries = Tables::name('entries');
        $managers = Tables::name('managers');

        $rows = $scheduled
            ? $wpdb->get_results($wpdb->prepare(
                "SELECT e.start_number, e.class, e.manager_id, u.display_name AS team_name
                 FROM $entries e JOIN $managers m ON m.id = e.manager_id JOIN {$wpdb->users} u ON u.ID = m.user_id
                 WHERE e.rally_id = %d ORDER BY e.start_number",
                $rallyId
            ), ARRAY_A)
            : $wpdb->get_results($wpdb->prepare("SELECT start_number, class, manager_id, team_name FROM $entries WHERE rally_id = %d ORDER BY start_number", $rallyId), ARRAY_A);

        return array_map(fn($row) => [
            'start_number' => (int) $row['start_number'],
            'team' => Account::team($row['team_name']),
            'class_label' => Labels::classLabel($row['class']),
            'is_me' => (int) $row['manager_id'] === $managerId,
        ], $rows);
    }

    private static function sanitizeStyles(array $rally, array $input): array
    {
        $styles = [];
        foreach (self::stages($rally) as $stage) {
            $style = (string) ($input[$stage['id']] ?? 'normal');
            $styles[$stage['id']] = isset(Labels::STYLES[$style]) ? $style : 'normal';
        }
        return $styles;
    }

    private static function forecastText(array $rally): string
    {
        $text = Labels::text('WEATHER', $rally['weather']);
        $change = (string) ($rally['weather_change'] ?? '');
        if ($change !== '' && $change !== $rally['weather'] && (int) $rally['change_chance'] > 0) {
            $text = I18n::t('server.rallies.forecastChange', ['weather' => $text, 'pct' => $rally['change_chance'], 'change' => mb_strtolower(Labels::text('WEATHER', $change))]);
        }
        return $text;
    }

    private static function spareCandidates(array $manager): array
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $items = Tables::name('items');
        $tyres = Registry::get('tyres')->table();
        $parts = Registry::get('parts')->table();
        $car = Garage::car($managerId);
        $class = $car ? (string) $car['class'] : '';

        $tyreRows = $wpdb->get_results($wpdb->prepare(
            "SELECT i.id, i.health, i.catalog_id, t.name, t.type, t.compound, t.wear_per_100km, t.grip_asphalt_dry, t.grip_asphalt_wet, t.grip_gravel, t.grip_snow
             FROM $items i JOIN $tyres t ON t.id = i.catalog_id
             WHERE i.manager_id = %d AND i.kind = 'spare_tyre' AND i.player_car_id = 0
             ORDER BY i.health DESC, i.id",
            $managerId
        ), ARRAY_A);

        $partRows = $wpdb->get_results($wpdb->prepare(
            "SELECT i.id, i.health, i.defect, p.name, p.type, p.wear_per_100km
             FROM $items i JOIN $parts p ON p.id = i.catalog_id
             WHERE i.manager_id = %d AND i.kind = 'part' AND i.player_car_id = 0 AND i.health > 0 AND p.type <> 'chassis' AND (p.class = '' OR p.class = %s)
             ORDER BY i.health DESC, i.id",
            $managerId,
            $class
        ), ARRAY_A);

        $byId = fn(array $rows) => array_column($rows, null, 'id');
        return ['tyres' => $byId($tyreRows), 'parts' => $byId($partRows)];
    }

    private static function sanitizeSpares(array $manager, array $input, ?array $candidates = null): array
    {
        $capacity = GarageLevels::spares((int) $manager['garage_level']);
        $candidates ??= self::spareCandidates($manager);

        $tyres = [];
        foreach ((array) ($input['tyres'] ?? []) as $id) {
            if (isset($candidates['tyres'][(int) $id]) && count($tyres) < $capacity['tyres']) {
                $tyres[(int) $id] = (int) $id;
            }
        }

        $parts = [];
        foreach ((array) ($input['parts'] ?? []) as $id) {
            $part = $candidates['parts'][(int) $id] ?? null;
            if ($part && !isset($parts[$part['type']]) && count($parts) < $capacity['parts']) {
                $parts[$part['type']] = (int) $id;
            }
        }

        return ['tyres' => array_values($tyres), 'parts' => array_values($parts)];
    }

    private static function defaultSpares(array $manager, array $candidates): array
    {
        $car = Garage::car((int) $manager['id']);
        $mounted = $car ? Garage::mountedParts((int) $car['player_car_id']) : [];

        $best = [];
        foreach ($candidates['parts'] as $part) {
            $best[$part['type']] ??= $part;
        }
        uasort($best, fn($a, $b) => ($mounted[$a['type']]['health'] ?? 0) <=> ($mounted[$b['type']]['health'] ?? 0));

        return self::sanitizeSpares($manager, [
            'tyres' => array_keys($candidates['tyres']),
            'parts' => array_column($best, 'id'),
        ], $candidates);
    }

    private static function sparesView(array $manager, ?array $entry): array
    {
        $candidates = self::spareCandidates($manager);
        $selected = $entry
            ? self::sanitizeSpares($manager, json_decode((string) $entry['spares'], true) ?: [], $candidates)
            : self::defaultSpares($manager, $candidates);

        return [
            'capacity' => GarageLevels::spares((int) $manager['garage_level']),
            'selected' => $selected,
            'tyres' => array_values(array_map(fn($row) => [
                'id' => (int) $row['id'],
                'name' => Texts::of($row['name']),
                'type_label' => Labels::text('TYRE_TYPES', $row['type']),
                'health' => round((float) $row['health'], 1),
            ], $candidates['tyres'])),
            'parts' => array_values(array_map(fn($row) => [
                'id' => (int) $row['id'],
                'name' => Texts::of($row['name']),
                'type_label' => Labels::text('PART_TYPES', $row['type']),
                'health' => round((float) $row['health'], 1),
            ], $candidates['parts'])),
        ];
    }

    public static function loadout(array $manager, array $entry, ?array $snapshot): array
    {
        $candidates = self::spareCandidates($manager);
        $selected = self::sanitizeSpares($manager, json_decode((string) $entry['spares'], true) ?: [], $candidates);

        return [
            'tyres' => array_map(fn($id) => $candidates['tyres'][$id], $selected['tyres']),
            'parts' => array_map(fn($id) => $candidates['parts'][$id], $selected['parts']),
        ];
    }

    public static function register(array $manager, int $id, array $styles, array $spares = []): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $rally = Registry::get('rallies')->find($id);

        if (!$rally) {
            return new WP_Error('bgr_not_found', I18n::t('server.rallies.noRally'), ['status' => 404]);
        }
        if (self::state($rally) !== 'open') {
            return new WP_Error('bgr_closed', I18n::t('server.rallies.closed'), ['status' => 400]);
        }
        if (self::entry($id, $managerId)) {
            return new WP_Error('bgr_registered', I18n::t('server.rallies.registered'), ['status' => 400]);
        }

        Garage::ensureStarterPack($managerId);
        $car = Garage::car($managerId);
        $snapshot = $car ? Garage::snapshot((int) $car['player_car_id']) : null;
        if (!$snapshot) {
            return new WP_Error('bgr_no_car', I18n::t('server.garage.noOwnCar'), ['status' => 400]);
        }
        $problems = array_merge($snapshot['problems'], Staff::problems($managerId));
        if ($problems) {
            return new WP_Error('bgr_not_ready', I18n::t('server.rallies.notReady', ['list' => implode(', ', $problems)]), ['status' => 400]);
        }

        $costs = self::summary($rally, $manager, $car, false)['costs'];
        $entries = Tables::name('entries');
        $startNumber = (int) $wpdb->get_var($wpdb->prepare("SELECT MAX(start_number) FROM $entries WHERE rally_id = %d", $id)) + 1;

        $inserted = $wpdb->insert($entries, [
            'rally_id' => $id,
            'manager_id' => $managerId,
            'class' => (string) $car['class'],
            'player_car_id' => (int) $car['player_car_id'],
            'start_number' => $startNumber,
            'styles' => wp_json_encode((object) self::sanitizeStyles($rally, $styles)),
            'spares' => wp_json_encode(self::sanitizeSpares($manager, $spares)),
            'costs' => $costs['total'],
            'created_at' => current_time('mysql', true),
        ]);
        if (!$inserted) {
            return new WP_Error('bgr_registered', I18n::t('server.rallies.registered'), ['status' => 400]);
        }

        if (!Ledger::add($managerId, -$costs['total'], 'rally_entry', Texts::of($rally['name']))) {
            $wpdb->delete($entries, ['id' => $wpdb->insert_id]);
            return new WP_Error('bgr_money', I18n::t('server.common.moneyNeed', ['money' => I18n::money($costs['total'])]), ['status' => 400]);
        }

        return I18n::t('server.rallies.joined', ['rally' => Texts::of($rally['name']), 'number' => $startNumber]);
    }

    public static function setStyles(array $manager, int $id, array $styles, array $spares = []): string|WP_Error
    {
        global $wpdb;
        $rally = Registry::get('rallies')->find($id);
        $entry = $rally ? self::entry($id, (int) $manager['id']) : null;

        if (!$entry) {
            return new WP_Error('bgr_not_registered', I18n::t('server.rallies.notRegistered'), ['status' => 400]);
        }
        if ($rally['status'] !== 'scheduled' || self::now() >= strtotime($rally['start_at'])) {
            return new WP_Error('bgr_started', I18n::t('server.rallies.started'), ['status' => 400]);
        }

        $wpdb->update(Tables::name('entries'), [
            'styles' => wp_json_encode((object) self::sanitizeStyles($rally, $styles)),
            'spares' => wp_json_encode(self::sanitizeSpares($manager, $spares)),
        ], ['id' => $entry['id']]);
        return I18n::t('server.rallies.saved');
    }

    public static function recon(array $manager, int $id): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $rally = Registry::get('rallies')->find($id);
        $entry = $rally ? self::entry($id, $managerId) : null;

        if (!$entry) {
            return new WP_Error('bgr_not_registered', I18n::t('server.rallies.registerFirst'), ['status' => 400]);
        }
        if ($entry['recon']) {
            return new WP_Error('bgr_recon_done', I18n::t('server.rallies.reconDone'), ['status' => 400]);
        }
        if ($rally['status'] !== 'scheduled') {
            return new WP_Error('bgr_started', I18n::t('server.rallies.started'), ['status' => 400]);
        }
        if (date('Y-m-d', self::now()) !== self::reconDate($rally)) {
            return new WP_Error('bgr_recon_day', I18n::t('server.rallies.reconDay', ['date' => I18n::date(strtotime(self::reconDate($rally)))]), ['status' => 400]);
        }

        $snapshot = Garage::snapshot((int) $entry['player_car_id']);
        if (!$snapshot || $snapshot['problems']) {
            return new WP_Error('bgr_not_ready', I18n::t('server.rallies.carNotReady'), ['status' => 400]);
        }

        $stages = self::stages($rally);
        $km = array_sum(array_map(fn($stage) => (float) $stage['length_km'], $stages));
        $fuel = self::fuelCost($km, Garage::consumption($snapshot['car'], $snapshot['parts']), $managerId);
        $energy = Settings::int('energy_recon');

        if ((int) $manager['money'] < $fuel) {
            return new WP_Error('bgr_money', I18n::t('server.rallies.fuelNeed', ['money' => I18n::money($fuel)]), ['status' => 400]);
        }
        if (!Energy::spend($managerId, $energy)) {
            return new WP_Error('bgr_energy', I18n::t('server.common.energyNeed', ['energy' => $energy]), ['status' => 400]);
        }
        if (!Ledger::add($managerId, -$fuel, 'recon', Texts::of($rally['name']))) {
            Energy::refund($managerId, $energy);
            return new WP_Error('bgr_money', I18n::t('server.rallies.fuel'), ['status' => 400]);
        }

        Garage::applyWear(Simulator::reconWear($snapshot, $stages));
        $wpdb->update(Tables::name('entries'), ['recon' => 1], ['id' => $entry['id']]);

        return I18n::t('server.rallies.reconOk', ['forecast' => mb_strtolower(self::forecastText($rally))]);
    }

    public static function standings(int $managerId, int $season = 0): array
    {
        global $wpdb;
        self::runDue();

        $season = $season ?: self::currentSeason();
        $entries = Tables::name('entries');
        $runs = Tables::name('rally_runs');

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT e.class, e.manager_id, e.bot_id, MAX(e.team_name) AS team, SUM(e.points) AS points, COUNT(*) AS rallies, SUM(e.place = 1) AS wins
             FROM $entries e
             JOIN " . self::table() . " r ON r.id = e.rally_id
             JOIN $runs ru ON ru.rally_id = e.rally_id
             WHERE r.season = %d AND ru.published = 1
             GROUP BY e.class, e.manager_id, e.bot_id
             ORDER BY e.class DESC, points DESC, wins DESC",
            $season
        ), ARRAY_A);

        $classes = [];
        foreach ($rows as $row) {
            $class = (int) $row['class'];
            $classes[$class] ??= ['class' => $class, 'label' => Labels::classLabel($class), 'rows' => []];
            $classes[$class]['rows'][] = [
                'position' => count($classes[$class]['rows']) + 1,
                'team' => Account::team($row['team']),
                'points' => (int) $row['points'],
                'rallies' => (int) $row['rallies'],
                'wins' => (int) $row['wins'],
                'is_me' => (int) $row['manager_id'] === $managerId,
            ];
        }

        $seasons = array_map('intval', $wpdb->get_col('SELECT DISTINCT season FROM ' . self::table() . ' ORDER BY season DESC'));

        return ['season' => $season, 'seasons' => $seasons, 'classes' => array_values($classes)];
    }
}
