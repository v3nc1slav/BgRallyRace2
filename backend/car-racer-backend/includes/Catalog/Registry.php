<?php

namespace BgRally\Catalog;

use BgRally\Database\Tables;
use BgRally\Game\Labels;
use BgRally\Game\Managers;
use BgRally\Game\Rallies;

final class Registry
{
    /**
     * @return Entity[]
     */
    public static function entities(): array
    {
        static $entities = null;

        return $entities ??= [
            new Entity('cities', 'Градове', [
                new Field('name', 'Име', required: true),
                new Field('lat', 'Географска ширина', 'float'),
                new Field('lng', 'Географска дължина', 'float'),
                new Field('privilege_1', 'Привилегия 1', 'select', options: Labels::PRIVILEGES),
                new Field('privilege_1_value', 'Привилегия 1: стойност (%)', 'int', inList: false),
                new Field('privilege_2', 'Привилегия 2', 'select', options: Labels::PRIVILEGES),
                new Field('privilege_2_value', 'Привилегия 2: стойност (%)', 'int', inList: false),
                new Field('active', 'Активен', 'bool', default: 1),
            ], inUse: fn(int $id) => Managers::countInCity($id) > 0 || self::countWhere('stages', 'city_id', $id) > 0),

            new Entity('stages', 'Етапи', [
                new Field('city_id', 'Град', 'ref', required: true, ref: 'cities'),
                new Field('name', 'Име', required: true),
                new Field('position', 'Ред', 'int'),
                new Field('length_km', 'Дължина (км)', 'float', default: 10),
                new Field('surface', 'Настилка', 'select', options: Labels::SURFACES),
                new Field('profile', 'Характер', 'select', options: Labels::PROFILES),
                new Field('difficulty', 'Трудност (1–10)', 'int', default: 5),
                new Field('turns', 'Брой завои', 'int', default: 40),
                new Field('route', 'Маршрут на картата', 'route', inList: false),
                new Field('active', 'Активен', 'bool', default: 1),
            ], label: fn(array $row) => self::cityName((int) $row['city_id']) . ': ' . $row['name'], orderBy: 'city_id, position, id'),

            new Entity('cars', 'Коли', [
                new Field('name', 'Модел', required: true),
                new Field('class', 'Клас', 'select', options: Labels::CLASSES),
                new Field('power', 'Мощност (к.с.)', 'int', default: 200),
                new Field('handling', 'Управление (0–100)', 'int', default: 50),
                new Field('braking', 'Спирачки (0–100)', 'int', default: 50),
                new Field('reliability', 'Надеждност (0–100)', 'int', default: 50),
                new Field('fuel_consumption', 'Разход (л/100 км)', 'float', default: 35),
                new Field('price', 'Цена (€)', 'int'),
                new Field('min_level', 'Нужно ниво', 'int', default: 1),
                new Field('active', 'Активна', 'bool', default: 1),
            ], inUse: fn(int $id) => self::countWhere('player_cars', 'car_id', $id) > 0 || self::countWhere('bots', 'car_id', $id) > 0, orderBy: 'class DESC, price'),

            new Entity('parts', 'Части', [
                new Field('name', 'Име', required: true),
                new Field('type', 'Вид', 'select', options: Labels::PART_TYPES),
                new Field('class', 'Клас', 'select', options: ['' => 'Всички класове'] + Labels::CLASSES),
                new Field('power_bonus', 'Бонус мощност (к.с.)', 'int'),
                new Field('handling_bonus', 'Бонус управление', 'int'),
                new Field('braking_bonus', 'Бонус спирачки', 'int'),
                new Field('reliability_bonus', 'Бонус надеждност', 'int'),
                new Field('wear_per_100km', 'Износване (% на 100 км)', 'float', default: 8, inList: false),
                new Field('price', 'Цена (€)', 'int'),
                new Field('min_level', 'Нужно ниво', 'int', default: 1),
                new Field('active', 'Активна', 'bool', default: 1),
            ], inUse: fn(int $id) => self::countItems('part', $id) > 0, orderBy: 'type, price'),

            new Entity('tyres', 'Гуми', [
                new Field('name', 'Име', required: true),
                new Field('type', 'Тип', 'select', options: Labels::TYRE_TYPES),
                new Field('compound', 'Смес', 'select', options: Labels::COMPOUNDS),
                new Field('grip_asphalt_dry', 'Сцепление: сух асфалт', 'float', default: 1, inList: false),
                new Field('grip_asphalt_wet', 'Сцепление: мокър асфалт', 'float', default: 0.8, inList: false),
                new Field('grip_gravel', 'Сцепление: чакъл', 'float', default: 0.8, inList: false),
                new Field('grip_snow', 'Сцепление: сняг', 'float', default: 0.6, inList: false),
                new Field('wear_per_100km', 'Износване (% на 100 км)', 'float', default: 25),
                new Field('price', 'Цена за комплект (€)', 'int'),
                new Field('min_level', 'Нужно ниво', 'int', default: 1),
                new Field('active', 'Активна', 'bool', default: 1),
            ], inUse: fn(int $id) => self::countItems('tyre', $id) > 0, orderBy: 'type, compound'),

            new Entity('garage_levels', 'Нива на гаража', [
                new Field('level', 'Ниво', 'int', required: true, default: 1),
                new Field('price', 'Цена (€)', 'int'),
                new Field('min_level', 'Нужно ниво на мениджъра', 'int', default: 1),
                new Field('staff_roles', 'Отключва служители', 'multi', options: Labels::UNLOCKABLE_ROLES),
                new Field('spare_tyres', 'Резервни гуми', 'int'),
                new Field('spare_parts', 'Резервни части', 'int'),
                new Field('cars', 'Места за коли', 'int', default: 1),
                new Field('security', 'Охрана', 'bool'),
            ], label: fn(array $row) => 'Ниво ' . $row['level'], orderBy: 'level'),

            new Entity('sponsors', 'Спонсори', [
                new Field('name', 'Име', required: true),
                new Field('city_id', 'Град', 'ref', required: true, ref: 'cities'),
                new Field('slot', 'Място', 'select', options: Labels::SPONSOR_SLOTS),
                new Field('payment', 'Плащане за рали (€)', 'int', default: 500),
                new Field('goal_place', 'Цел: място в класа до', 'int', default: 5),
                new Field('bonus', 'Бонус при изпълнена цел (€)', 'int', default: 300),
                new Field('progress_rate', 'Напредък на преговорите за етап (%)', 'int', default: 25, inList: false),
                new Field('duration_weeks', 'Продължителност (седмици)', 'int', default: 10),
                new Field('min_level', 'Нужно ниво', 'int', default: 5),
                new Field('active', 'Активен', 'bool', default: 1),
            ], inUse: fn(int $id) => self::countWhere('contracts', 'sponsor_id', $id) > 0, orderBy: 'slot, min_level, payment'),

            new Entity('clothes', 'Дрехи', [
                new Field('name', 'Име', required: true),
                new Field('slot', 'Място', 'select', options: Labels::CLOTHING_SLOTS),
                new Field('bonus', 'Бонус в преговорите (%)', 'int', default: 1),
                new Field('price', 'Цена (€)', 'int'),
                new Field('min_level', 'Нужно ниво', 'int', default: 1),
                new Field('active', 'Активна', 'bool', default: 1),
            ], inUse: fn(int $id) => self::countItems('clothes', $id) > 0, orderBy: "FIELD(slot, 'suit', 'shoes', 'watch', 'accessory'), price"),

            new Entity('jobs', 'Работи', [
                new Field('name', 'Име', required: true),
                new Field('building', 'Сграда', 'select', options: Labels::BUILDINGS),
                new Field('pay', 'Заплата (€ на ден)', 'int', default: 60),
                new Field('energy', 'Енергия на ден', 'int', default: 25),
                new Field('min_level', 'Нужно ниво', 'int', default: 1),
                new Field('active', 'Активна', 'bool', default: 1),
            ], inUse: fn(int $id) => self::countWhere('managers', 'job_id', $id) > 0, orderBy: 'min_level, pay'),

            new Entity('incidents', 'Случайни събития', [
                new Field('name', 'Име', required: true),
                new Field('type', 'Вид', 'select', options: Labels::EVENT_TYPES),
                new Field('chance', 'Шанс на етап (%) – за времето се ползва прогнозата на ралито', 'float', default: 1),
                new Field('penalty_min', 'Наказание от (сек.)', 'int', default: 5),
                new Field('penalty_max', 'Наказание до (сек.)', 'int', default: 15),
                new Field('surface', 'Само на настилка', 'select', options: ['' => 'Всяка'] + Labels::SURFACES),
                new Field('weather', 'Само при време', 'select', options: ['' => 'Всяко'] + Labels::WEATHER),
                new Field('part_type', 'Част (за повреда)', 'select', options: ['' => 'Най-износената'] + Labels::PART_TYPES, inList: false),
                new Field('text', 'Текст за хрониката: {пилот}, {завой}, {секунди}, {част}', required: true, inList: false),
                new Field('active', 'Активно', 'bool', default: 1),
            ], orderBy: "FIELD(type, 'mistake', 'puncture', 'breakdown', 'crash', 'chassis', 'weather'), chance DESC"),

            new Entity('rallies', 'Ралита', [
                new Field('name', 'Име', required: true),
                new Field('city_id', 'Град', 'ref', required: true, ref: 'cities'),
                new Field('start_at', 'Старт', 'datetime', required: true),
                new Field('season', 'Сезон', 'int', default: 1),
                new Field('weather', 'Време в началото', 'select', options: Labels::WEATHER),
                new Field('weather_change', 'Възможна промяна на времето', 'select', options: ['' => 'Няма'] + Labels::WEATHER, inList: false),
                new Field('change_chance', 'Шанс за промяната (%)', 'int', inList: false),
                new Field('stage_ids', 'Етапи', 'refs', ref: 'stages', inList: false),
                new Field('entry_fee', 'Такса за участие (€)', 'int', default: 200),
                new Field('prizes', 'Награди по места (€, разделени със запетая)', default: '3000,2000,1500,1000,800,600,400,300,200,100', inList: false),
                new Field('status', 'Статус', 'select', options: Labels::RALLY_STATUSES),
            ], inUse: fn(int $id) => self::countWhere('entries', 'rally_id', $id) > 0, actions: [
                'run' => ['Изчисли сега', [Rallies::class, 'adminRun']],
                'reset' => ['Нулирай', [Rallies::class, 'adminReset']],
            ], orderBy: 'start_at'),
        ];
    }

    public static function get(string $slug): ?Entity
    {
        foreach (self::entities() as $entity) {
            if ($entity->slug === $slug) {
                return $entity;
            }
        }
        return null;
    }

    private static function cityName(int $id): string
    {
        static $names = null;
        $names ??= self::get('cities')->options();
        return $names[$id] ?? '—';
    }

    private static function countWhere(string $table, string $column, int $id): int
    {
        global $wpdb;
        $table = Tables::name($table);
        return (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $table WHERE $column = %d", $id));
    }

    private static function countItems(string $kind, int $id): int
    {
        global $wpdb;
        $table = Tables::name('items');
        return (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $table WHERE kind = %s AND catalog_id = %d", $kind, $id));
    }
}
