<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Database\Tables;
use BgRally\Settings;
use WP_Error;

final class Garage
{
    private const TRADE_IN = 0.5;

    public static function ensureStarterPack(int $managerId): void
    {
        global $wpdb;

        if (self::car($managerId)) {
            return;
        }

        $cars = Registry::get('cars')->table();
        $tyres = Registry::get('tyres')->table();

        $car = $wpdb->get_row("SELECT id, class FROM $cars WHERE active = 1 AND class = '3' ORDER BY price, id LIMIT 1", ARRAY_A);
        if (!$car) {
            return;
        }

        $playerCarId = self::addCar($managerId, (int) $car['id'], (string) $car['class']);

        $tyreId = (int) $wpdb->get_var("SELECT id FROM $tyres WHERE active = 1 ORDER BY price, id LIMIT 1");
        if ($tyreId) {
            self::addItem($managerId, 'tyre', $tyreId, $playerCarId);
        }

        Staff::hireStarterCrew($managerId);
    }

    private static function addCar(int $managerId, int $carId, string $class): int
    {
        global $wpdb;
        $parts = Registry::get('parts')->table();

        $wpdb->insert(Tables::name('player_cars'), [
            'manager_id' => $managerId,
            'car_id' => $carId,
            'created_at' => current_time('mysql', true),
        ]);
        $playerCarId = (int) $wpdb->insert_id;

        foreach (array_keys(Labels::PART_TYPES) as $type) {
            $partId = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM $parts WHERE active = 1 AND type = %s AND class IN ('', %s) ORDER BY price, id LIMIT 1",
                $type,
                $class
            ));
            if ($partId) {
                self::addItem($managerId, 'part', $partId, $playerCarId);
            }
        }

        $wpdb->update(Tables::name('managers'), ['active_car_id' => $playerCarId], ['id' => $managerId]);
        return $playerCarId;
    }

    private static function addItem(int $managerId, string $kind, int $catalogId, int $playerCarId = 0): void
    {
        global $wpdb;
        $wpdb->insert(Tables::name('items'), [
            'manager_id' => $managerId,
            'kind' => $kind,
            'catalog_id' => $catalogId,
            'player_car_id' => $playerCarId,
            'health' => 100,
            'max_health' => 100,
            'created_at' => current_time('mysql', true),
        ]);
    }

    public static function car(int $managerId): ?array
    {
        global $wpdb;
        $playerCars = Tables::name('player_cars');
        $managers = Tables::name('managers');
        $cars = Registry::get('cars')->table();

        return $wpdb->get_row($wpdb->prepare(
            "SELECT c.*, pc.id AS player_car_id FROM $playerCars pc
             JOIN $cars c ON c.id = pc.car_id
             JOIN $managers m ON m.id = pc.manager_id
             WHERE pc.manager_id = %d
             ORDER BY pc.id = m.active_car_id DESC, pc.id LIMIT 1",
            $managerId
        ), ARRAY_A);
    }

    public static function cars(int $managerId): array
    {
        global $wpdb;
        $playerCars = Tables::name('player_cars');
        $cars = Registry::get('cars')->table();

        return $wpdb->get_results($wpdb->prepare(
            "SELECT pc.id AS player_car_id, c.id AS car_id, c.name, c.class, c.price FROM $playerCars pc JOIN $cars c ON c.id = pc.car_id WHERE pc.manager_id = %d ORDER BY pc.id",
            $managerId
        ), ARRAY_A);
    }

    public static function carById(int $playerCarId): ?array
    {
        global $wpdb;
        $playerCars = Tables::name('player_cars');
        $cars = Registry::get('cars')->table();

        return $wpdb->get_row($wpdb->prepare(
            "SELECT c.*, pc.id AS player_car_id, pc.manager_id FROM $playerCars pc JOIN $cars c ON c.id = pc.car_id WHERE pc.id = %d",
            $playerCarId
        ), ARRAY_A);
    }

    public static function mountedParts(int $playerCarId): array
    {
        global $wpdb;
        $items = Tables::name('items');
        $parts = Registry::get('parts')->table();

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT i.id, i.health, i.max_health, i.defect, p.name, p.type, p.class, p.power_bonus, p.handling_bonus, p.braking_bonus, p.reliability_bonus, p.wear_per_100km, p.price
             FROM $items i JOIN $parts p ON p.id = i.catalog_id
             WHERE i.kind = 'part' AND i.player_car_id = %d",
            $playerCarId
        ), ARRAY_A);

        $byType = [];
        foreach ($rows as $row) {
            $byType[$row['type']] = $row;
        }
        return $byType;
    }

    public static function mountedTyre(int $playerCarId): ?array
    {
        global $wpdb;
        $items = Tables::name('items');
        $tyres = Registry::get('tyres')->table();

        return $wpdb->get_row($wpdb->prepare(
            "SELECT i.id, i.health, t.name, t.type, t.compound, t.grip_asphalt_dry, t.grip_asphalt_wet, t.grip_gravel, t.grip_snow, t.wear_per_100km, t.price
             FROM $items i JOIN $tyres t ON t.id = i.catalog_id
             WHERE i.kind = 'tyre' AND i.player_car_id = %d LIMIT 1",
            $playerCarId
        ), ARRAY_A);
    }

    public static function snapshot(int $playerCarId): ?array
    {
        $car = self::carById($playerCarId);
        if (!$car) {
            return null;
        }

        $parts = self::mountedParts($playerCarId);
        $tyre = self::mountedTyre($playerCarId);

        $stats = [
            'power' => (int) $car['power'],
            'handling' => (int) $car['handling'],
            'braking' => (int) $car['braking'],
            'reliability' => (int) $car['reliability'],
        ];
        foreach ($parts as $part) {
            foreach (array_keys($stats) as $stat) {
                $stats[$stat] += (int) $part[$stat . '_bonus'];
            }
        }

        $problems = [];
        $health = 0;
        foreach (Labels::PART_TYPES as $type => $label) {
            if (!isset($parts[$type])) {
                $problems[] = 'липсва ' . mb_strtolower($label);
            } elseif ((float) $parts[$type]['health'] <= 0) {
                $problems[] = 'счупена част: ' . mb_strtolower($label);
            } else {
                $health += (float) $parts[$type]['health'];
            }
        }
        if (!$tyre) {
            $problems[] = 'няма гуми';
        } elseif ((float) $tyre['health'] <= 0) {
            $problems[] = 'гумите са износени';
        }

        return [
            'car' => $car,
            'class' => (string) $car['class'],
            'stats' => $stats,
            'parts' => $parts,
            'tyre' => $tyre,
            'health' => $health / count(Labels::PART_TYPES),
            'problems' => $problems,
        ];
    }

    public static function view(array $manager): array
    {
        $managerId = (int) $manager['id'];
        $car = self::car($managerId);
        $snapshot = $car ? self::snapshot((int) $car['player_car_id']) : null;

        $slots = [];
        foreach (Labels::PART_TYPES as $type => $label) {
            $part = $snapshot['parts'][$type] ?? null;
            $slots[] = ['type' => $type, 'label' => $label, 'item' => $part ? self::partView($part, (int) $manager['city_id']) : null];
        }

        $mechanic = Staff::member($managerId, 'mechanic');

        return [
            'car' => $snapshot ? [
                'player_car_id' => (int) $car['player_car_id'],
                'name' => $car['name'],
                'class' => (int) $car['class'],
                'class_label' => Labels::classLabel($car['class']),
                'base' => [
                    'power' => (int) $car['power'],
                    'handling' => (int) $car['handling'],
                    'braking' => (int) $car['braking'],
                    'reliability' => (int) $car['reliability'],
                ],
                'stats' => $snapshot['stats'],
                'fuel_consumption' => (float) $car['fuel_consumption'],
                'health' => round($snapshot['health'], 1),
                'problems' => array_merge($snapshot['problems'], Staff::problems($managerId)),
            ] : null,
            'cars' => array_map(fn($row) => [
                'player_car_id' => (int) $row['player_car_id'],
                'name' => $row['name'],
                'class_label' => Labels::classLabel($row['class']),
                'active' => $car && (int) $row['player_car_id'] === (int) $car['player_car_id'],
            ], self::cars($managerId)),
            'garage' => GarageLevels::view((int) $manager['garage_level']) + ['permit' => Mayor::hasPermit($managerId)],
            'spares' => GarageLevels::spares((int) $manager['garage_level']),
            'slots' => $slots,
            'tyre' => $snapshot && $snapshot['tyre'] ? self::tyreView($snapshot['tyre']) : null,
            'storage' => self::storage($managerId, $car ? (string) $car['class'] : ''),
            'crew' => Staff::list($managerId),
            'worker' => $mechanic ? sprintf('Майсторът %s (%d енергия)', $mechanic['name'], $mechanic['energy']) : 'Ти (майстор още няма)',
            'energy_costs' => [
                'mount' => Settings::int('energy_mount'),
                'tyres' => Settings::int('energy_tyres'),
                'repair' => Settings::int('energy_repair'),
            ],
        ];
    }

    private static function partView(array $part, int $cityId): array
    {
        $newMax = self::repairedMax((float) $part['max_health']);
        return [
            'id' => (int) $part['id'],
            'name' => $part['name'],
            'type' => $part['type'],
            'type_label' => Labels::PART_TYPES[$part['type']] ?? $part['type'],
            'health' => round((float) $part['health'], 1),
            'max_health' => round((float) $part['max_health'], 1),
            'defect' => (bool) $part['defect'],
            'bonuses' => [
                'power' => (int) $part['power_bonus'],
                'handling' => (int) $part['handling_bonus'],
                'braking' => (int) $part['braking_bonus'],
                'reliability' => (int) $part['reliability_bonus'],
            ],
            'can_repair' => $newMax > (float) $part['health'],
            'repair_cost' => self::repairCost((int) $part['price'], (float) $part['health'], (float) $part['max_health'], $cityId),
        ];
    }

    private static function tyreView(array $tyre): array
    {
        return [
            'id' => (int) $tyre['id'],
            'name' => $tyre['name'],
            'type_label' => Labels::TYRE_TYPES[$tyre['type']] ?? $tyre['type'],
            'compound_label' => Labels::COMPOUNDS[$tyre['compound']] ?? $tyre['compound'],
            'health' => round((float) $tyre['health'], 1),
            'grip' => [
                'asphalt_dry' => (float) $tyre['grip_asphalt_dry'],
                'asphalt_wet' => (float) $tyre['grip_asphalt_wet'],
                'gravel' => (float) $tyre['grip_gravel'],
                'snow' => (float) $tyre['grip_snow'],
            ],
        ];
    }

    private static function storage(int $managerId, string $carClass): array
    {
        global $wpdb;
        $items = Tables::name('items');
        $parts = Registry::get('parts')->table();
        $tyres = Registry::get('tyres')->table();

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT i.id, i.kind, i.health, i.max_health, i.defect,
                    COALESCE(p.name, t.name) AS name, p.type AS part_type, p.class AS part_class,
                    t.type AS tyre_type, t.compound
             FROM $items i
             LEFT JOIN $parts p ON i.kind = 'part' AND p.id = i.catalog_id
             LEFT JOIN $tyres t ON i.kind IN ('tyre', 'spare_tyre') AND t.id = i.catalog_id
             WHERE i.manager_id = %d AND i.player_car_id = 0 AND i.kind IN ('part', 'tyre', 'spare_tyre')
             ORDER BY i.kind, i.id",
            $managerId
        ), ARRAY_A);

        return array_map(fn(array $row) => [
            'id' => (int) $row['id'],
            'kind' => $row['kind'],
            'name' => $row['name'],
            'type_label' => $row['kind'] === 'part'
                ? (Labels::PART_TYPES[$row['part_type']] ?? '')
                : ($row['kind'] === 'spare_tyre' ? 'Резервна гума · ' : '') . (Labels::TYRE_TYPES[$row['tyre_type']] ?? '') . ', ' . mb_strtolower(Labels::COMPOUNDS[$row['compound']] ?? ''),
            'health' => round((float) $row['health'], 1),
            'max_health' => round((float) $row['max_health'], 1),
            'compatible' => $row['kind'] === 'tyre' || ($row['kind'] === 'part' && ($row['part_class'] === '' || $row['part_class'] === $carClass)),
            'spare' => $row['kind'] === 'spare_tyre',
        ], $rows);
    }

    private static function repairedMax(float $maxHealth): float
    {
        return max(0, $maxHealth - Settings::get('repair_max_drop'));
    }

    private static function repairCost(int $price, float $health, float $maxHealth, int $cityId): int
    {
        $gain = max(0, self::repairedMax($maxHealth) - $health);
        return (int) round($price * Settings::get('repair_cost_pct') / 100 * $gain / 100 * Privileges::factor($cityId, 'repair'));
    }

    private static function spendWork(int $managerId, int $energy): array|WP_Error
    {
        $mechanic = Staff::member($managerId, 'mechanic');
        if ($mechanic && Staff::spendEnergy((int) $mechanic['id'], $energy)) {
            return ['mechanic' => $mechanic];
        }
        if (Energy::spend($managerId, $energy)) {
            return ['mechanic' => null];
        }
        return new WP_Error('bgr_energy', sprintf('Няма достатъчно енергия (нужни са %d).', $energy), ['status' => 400]);
    }

    private static function refundWork(int $managerId, array $worker, int $energy): void
    {
        if ($worker['mechanic']) {
            global $wpdb;
            $wpdb->query($wpdb->prepare('UPDATE ' . Tables::name('staff') . ' SET energy = energy + %d WHERE id = %d', $energy, $worker['mechanic']['id']));
        } else {
            Energy::refund($managerId, $energy);
        }
    }

    public static function buy(array $manager, string $kind, int $catalogId): true|WP_Error
    {
        $entity = Registry::get($kind === 'part' ? 'parts' : 'tyres');
        $item = $entity->find($catalogId);

        if (!$item || !$item['active']) {
            return new WP_Error('bgr_not_found', 'Няма такъв артикул.', ['status' => 404]);
        }
        if ((int) $item['min_level'] > (int) $manager['level']) {
            return new WP_Error('bgr_level', sprintf('Нужно е ниво %d.', $item['min_level']), ['status' => 400]);
        }
        if (Bank::blocked((int) $manager['id'])) {
            return new WP_Error('bgr_bank', Bank::BLOCKED, ['status' => 400]);
        }
        $price = Shop::price($kind, $item, $manager);
        $label = $kind === 'spare_tyre' ? 'Резервна гума ' . $item['name'] : $item['name'];
        if (!Ledger::add((int) $manager['id'], -$price, 'shop', $label)) {
            return new WP_Error('bgr_money', 'Нямате достатъчно пари.', ['status' => 400]);
        }

        self::addItem((int) $manager['id'], $kind, $catalogId);
        return true;
    }

    public static function applyEffects(int $managerId, int $playerCarId, array $effects): void
    {
        global $wpdb;
        $items = Tables::name('items');

        foreach ($effects['unmount'] ?? [] as $id) {
            $wpdb->update($items, ['player_car_id' => 0], ['id' => (int) $id, 'manager_id' => $managerId]);
        }
        foreach ($effects['mount'] ?? [] as $id) {
            $wpdb->update($items, ['player_car_id' => $playerCarId], ['id' => (int) $id, 'manager_id' => $managerId]);
        }
        foreach ($effects['remove'] ?? [] as $id) {
            $wpdb->delete($items, ['id' => (int) $id, 'manager_id' => $managerId]);
        }
        if (!empty($effects['tyre_set'])) {
            $wpdb->insert($items, [
                'manager_id' => $managerId,
                'kind' => 'tyre',
                'catalog_id' => (int) $effects['tyre_set']['catalog_id'],
                'player_car_id' => $playerCarId,
                'health' => max(0, (float) $effects['tyre_set']['health']),
                'max_health' => 100,
                'created_at' => current_time('mysql', true),
            ]);
        }
    }

    public static function buyCar(array $manager, int $carId): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $car = Registry::get('cars')->find($carId);

        if (!$car || !$car['active']) {
            return new WP_Error('bgr_not_found', 'Няма такава кола.', ['status' => 404]);
        }
        if ((int) $car['min_level'] > (int) $manager['level']) {
            return new WP_Error('bgr_level', sprintf('Нужно е ниво %d.', $car['min_level']), ['status' => 400]);
        }
        if (Rallies::hasUpcomingEntry($managerId)) {
            return new WP_Error('bgr_registered', 'Не можеш да сменяш коли, докато си записан за предстоящо рали.', ['status' => 400]);
        }
        if (Bank::blocked($managerId)) {
            return new WP_Error('bgr_bank', Bank::BLOCKED, ['status' => 400]);
        }

        $owned = self::cars($managerId);
        $tradeIn = count($owned) >= GarageLevels::carSlots((int) $manager['garage_level']) ? self::car($managerId) : null;
        $tradeInValue = $tradeIn ? (int) round((int) $tradeIn['price'] * self::TRADE_IN) : 0;
        $price = (int) $car['price'];

        if ((int) $manager['money'] + $tradeInValue < $price) {
            return new WP_Error('bgr_money', sprintf('Нямате достатъчно пари (нужни са още %d €).', $price - $tradeInValue - (int) $manager['money']), ['status' => 400]);
        }

        if ($tradeIn) {
            $wpdb->update(Tables::name('items'), ['player_car_id' => 0], ['player_car_id' => $tradeIn['player_car_id']]);
            $wpdb->delete(Tables::name('player_cars'), ['id' => $tradeIn['player_car_id']]);
            Ledger::add($managerId, $tradeInValue, 'car_sale', $tradeIn['name']);
        }

        if (!Ledger::add($managerId, -$price, 'car_purchase', $car['name'])) {
            return new WP_Error('bgr_money', 'Нямате достатъчно пари.', ['status' => 400]);
        }

        self::addCar($managerId, $carId, (string) $car['class']);
        Rumors::about($managerId, '%s купи ' . $car['name'] . '.', sprintf('Отбор от града купи %s.', $car['name']));

        $message =sprintf('Купи %s. Колата е със стандартни части – монтирай ѝ гуми от склада.', $car['name']);
        return $tradeIn ? $message . sprintf(' %s е продадена за %d €, а частите и гумите от нея са в склада.', $tradeIn['name'], $tradeInValue) : $message;
    }

    public static function setActiveCar(array $manager, int $playerCarId): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $car = self::carById($playerCarId);

        if (!$car || (int) $car['manager_id'] !== $managerId) {
            return new WP_Error('bgr_not_found', 'Нямате такава кола.', ['status' => 404]);
        }
        if (Rallies::hasUpcomingEntry($managerId)) {
            return new WP_Error('bgr_registered', 'Не можеш да сменяш колата, докато си записан за предстоящо рали.', ['status' => 400]);
        }

        $wpdb->update(Tables::name('managers'), ['active_car_id' => $playerCarId], ['id' => $managerId]);
        return sprintf('%s е избрана за състезания.', $car['name']);
    }

    public static function upgrade(array $manager): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $next = GarageLevels::get((int) $manager['garage_level'] + 1);

        if (!$next) {
            return new WP_Error('bgr_max', 'Гаражът е на максимално ниво.', ['status' => 400]);
        }
        if ((int) $manager['level'] < (int) $next['min_level']) {
            return new WP_Error('bgr_level', sprintf('Нужно е ниво на мениджъра %d.', $next['min_level']), ['status' => 400]);
        }
        if (!Mayor::hasPermit($managerId)) {
            return new WP_Error('bgr_permit', 'Нужно е разрешение от кмета. Поискай го в Кметството.', ['status' => 400]);
        }
        if (!Ledger::add($managerId, -(int) $next['price'], 'garage', 'Гараж ниво ' . $next['level'])) {
            return new WP_Error('bgr_money', sprintf('Нямате достатъчно пари (нужни са %d €).', $next['price']), ['status' => 400]);
        }

        $wpdb->update(Tables::name('managers'), ['garage_level' => (int) $next['level']], ['id' => $managerId]);
        Mayor::usePermit($managerId);
        return sprintf('Гаражът е подобрен до ниво %d. Отключено: %s.', $next['level'], GarageLevels::describe($next) ?: 'нищо ново');
    }

    public static function mount(array $manager, int $itemId): string|WP_Error
    {
        global $wpdb;
        $items = Tables::name('items');
        $managerId = (int) $manager['id'];

        $item = $wpdb->get_row($wpdb->prepare("SELECT * FROM $items WHERE id = %d AND manager_id = %d", $itemId, $managerId), ARRAY_A);
        if (!$item || (int) $item['player_car_id'] !== 0) {
            return new WP_Error('bgr_item', 'Артикулът не е в склада.', ['status' => 400]);
        }
        if ($item['kind'] === 'spare_tyre') {
            return new WP_Error('bgr_item', 'Резервните гуми се вземат на ралито и не се монтират като комплект.', ['status' => 400]);
        }

        $car = self::car($managerId);
        if (!$car) {
            return new WP_Error('bgr_no_car', 'Нямате кола.', ['status' => 400]);
        }
        $playerCarId = (int) $car['player_car_id'];

        if ($item['kind'] === 'part') {
            $part = Registry::get('parts')->find((int) $item['catalog_id']);
            if (!$part) {
                return new WP_Error('bgr_item', 'Частта не съществува.', ['status' => 400]);
            }
            if ($part['class'] !== '' && $part['class'] !== (string) $car['class']) {
                return new WP_Error('bgr_class', 'Частта не е за класа на колата.', ['status' => 400]);
            }
            $current = self::mountedParts($playerCarId)[$part['type']]['id'] ?? 0;
            $cost = Settings::int('energy_mount');
        } else {
            $current = self::mountedTyre($playerCarId)['id'] ?? 0;
            $cost = Settings::int('energy_tyres');
        }

        $worker = self::spendWork($managerId, $cost);
        if (is_wp_error($worker)) {
            return $worker;
        }

        if ($current) {
            $wpdb->update($items, ['player_car_id' => 0], ['id' => $current]);
        }
        $wpdb->update($items, ['player_car_id' => $playerCarId], ['id' => $itemId]);

        return $worker['mechanic'] ? sprintf('Майсторът %s монтира артикула.', $worker['mechanic']['name']) : 'Монтирано.';
    }

    public static function repair(array $manager, int $itemId): string|WP_Error
    {
        global $wpdb;
        $items = Tables::name('items');
        $parts = Registry::get('parts')->table();
        $managerId = (int) $manager['id'];

        $item = $wpdb->get_row($wpdb->prepare(
            "SELECT i.*, p.price, p.name FROM $items i JOIN $parts p ON p.id = i.catalog_id WHERE i.id = %d AND i.manager_id = %d AND i.kind = 'part'",
            $itemId,
            $managerId
        ), ARRAY_A);
        if (!$item) {
            return new WP_Error('bgr_item', 'Няма такава част.', ['status' => 400]);
        }

        $health = (float) $item['health'];
        $newMax = self::repairedMax((float) $item['max_health']);
        if ($newMax <= $health) {
            return new WP_Error('bgr_repair', 'Частта не може да се ремонтира повече. Сменете я с нова.', ['status' => 400]);
        }

        $energy = Settings::int('energy_repair');
        $worker = self::spendWork($managerId, $energy);
        if (is_wp_error($worker)) {
            return $worker;
        }

        $cost = self::repairCost((int) $item['price'], $health, (float) $item['max_health'], (int) $manager['city_id']);
        if (!Ledger::add($managerId, -$cost, 'repair', $item['name'])) {
            self::refundWork($managerId, $worker, $energy);
            return new WP_Error('bgr_money', 'Нямате достатъчно пари.', ['status' => 400]);
        }

        $risk = $worker['mechanic'] ? Staff::mechanicRepairRisk((int) $worker['mechanic']['skill']) : Settings::get('poor_repair_chance');
        $poor = mt_rand(1, 1000) <= $risk * 10;
        $newHealth = $poor ? $health + ($newMax - $health) / 2 : $newMax;

        $wpdb->update($items, ['health' => $newHealth, 'max_health' => $newMax, 'defect' => $poor ? 1 : 0], ['id' => $itemId]);

        $who = $worker['mechanic'] ? 'Майсторът ' . $worker['mechanic']['name'] : 'Ти';
        return $poor
            ? sprintf('%s направи некачествен ремонт: частта е възстановена само до %d%%.', $who, round($newHealth))
            : sprintf('%s ремонтира частта до %d%%.', $who, round($newHealth));
    }

    public static function applyWear(array $wear): void
    {
        global $wpdb;
        $items = Tables::name('items');

        foreach ($wear as $itemId => $amount) {
            $wpdb->query($wpdb->prepare("UPDATE $items SET health = GREATEST(0, health - %f) WHERE id = %d", $amount, $itemId));
        }
    }
}
