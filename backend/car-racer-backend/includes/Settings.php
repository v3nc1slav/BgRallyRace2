<?php

namespace BgRally;

final class Settings
{
    public const OPTION = 'bgr_settings';

    public const SECTIONS = [
        'Начало' => [
            'starting_money' => ['Стартови пари (€)', 5000],
        ],
        'Енергия' => [
            'energy_base' => ['Енергия на ден', 100],
            'energy_per_level' => ['Допълнителна енергия за всяко ниво', 1],
            'energy_tyres' => ['Смяна на гуми', 10],
            'energy_mount' => ['Монтаж на част', 15],
            'energy_repair' => ['Ремонт', 25],
            'energy_recon' => ['Тренировка', 30],
        ],
        'Разходи' => [
            'fuel_price' => ['Цена на горивото (€/л)', 1.6],
            'travel_price_per_km' => ['Цена на пътя (€/км)', 0.5],
        ],
        'Ремонт' => [
            'repair_cost_pct' => ['Цена на пълен ремонт (% от цената на частта)', 30],
            'repair_max_drop' => ['С колко пада максималното състояние при ремонт (%)', 10],
            'poor_repair_chance' => ['Шанс за некачествен ремонт от мениджъра (%)', 20],
        ],
        'Рали' => [
            'registration_close_minutes' => ['Записването спира преди старта (мин.)', 60],
            'grid_min_per_class' => ['Минимален брой коли в клас (допълва се с ботове)', 8],
            'broadcast_minutes' => ['Продължителност на предаването (мин.)', 25],
            'xp_participation' => ['Опит за участие', 50],
            'xp_win' => ['Допълнителен опит за първо място', 150],
            'level_xp_base' => ['Опит, нужен за ниво 2', 100],
            'service_penalty' => ['Смяна на счупена част в сервиза (сек.)', 120],
            'crash_extra' => ['Катастрофа: добавка към времето на най-бавния в класа (сек.)', 60],
            'crash_damage_suspension' => ['Катастрофа: повреда на окачването (%)', 30],
            'crash_damage_chassis' => ['Катастрофа: повреда на шасито (%)', 20],
            'spare_tyre_price_pct' => ['Цена на единична гума (% от комплекта)', 25],
        ],
        'Служители' => [
            'salary_pilot' => ['Заплата на пилот при умение 0 (€/седмица)', 100],
            'salary_navigator' => ['Заплата на навигатор при умение 0 (€/седмица)', 80],
            'salary_mechanic' => ['Заплата на майстор при умение 0 (€/седмица)', 100],
            'salary_engineer' => ['Заплата на инженер при умение 0 (€/седмица)', 150],
            'salary_psychologist' => ['Заплата на психолог при умение 0 (€/седмица)', 100],
            'salary_chemist' => ['Заплата на химик при умение 0 (€/седмица)', 120],
            'candidates_per_role' => ['Кандидати за всяка роля в бара всяка седмица', 3],
            'mechanic_energy' => ['Енергия на майстора на ден', 100],
        ],
        'Спонсори' => [
            'slot_level_doors' => ['Място „Врати“ се отключва на ниво', 5],
            'slot_level_hood' => ['Място „Преден капак“ се отключва на ниво', 15],
            'slot_level_roof' => ['Място „Таван“ се отключва на ниво', 30],
            'slot_level_suits' => ['Място „Екипи“ се отключва на ниво', 40],
            'energy_negotiation' => ['Енергия за започване на преговори', 20],
            'sponsor_chance_base' => ['Шанс за успех на етап: база (%)', 30],
            'sponsor_chance_level' => ['Шанс за успех на етап: за всяко ниво (%)', 2],
            'sponsor_chance_local' => ['Шанс за успех на етап: спонсор от твоя град (%)', 15],
            'sponsor_chance_max' => ['Шанс за успех на етап: максимум (%)', 90],
            'sponsor_risk_factor' => ['Каква част от неуспеха е реален риск на етап (%)', 25],
            'sponsor_progress_local' => ['Напредък: бонус за спонсор от твоя град (%)', 10],
            'sponsor_progress_reputation' => ['Напредък: бонус за всеки 10 точки харизма и репутация (%)', 1],
            'sponsor_local_payment' => ['Местен спонсор плаща повече (%)', 10],
            'sponsor_local_goal' => ['Местен спонсор: целта е с толкова места по-висока', 2],
            'sponsor_misses' => ['Неизпълнени цели поред до прекратяване', 3],
        ],
    ];

    public static function defaults(): array
    {
        $defaults = [];
        foreach (self::SECTIONS as $fields) {
            foreach ($fields as $key => [, $default]) {
                $defaults[$key] = $default;
            }
        }
        return $defaults;
    }

    public static function get(string $key): float
    {
        $values = get_option(self::OPTION, []);
        return (float) ($values[$key] ?? self::defaults()[$key]);
    }

    public static function int(string $key): int
    {
        return (int) round(self::get($key));
    }
}
