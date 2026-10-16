<?php

namespace BgRally\Database;

use BgRally\Catalog\Registry;
use DateTimeImmutable;

final class Seeder
{
    private const PRIVILEGES = [
        'София' => ['travel', 20, 'parts', 5],
        'Пловдив' => ['tyres', 10, 'repair', 10],
        'Смолян' => ['home_fee', 50, 'repair', 15],
        'Велико Търново' => ['sponsor_local', 10, 'parts', 10],
        'Благоевград' => ['tyres', 15, 'travel', 10],
        'Габрово' => ['parts', 15, 'repair', 10],
    ];

    public static function run(string $from): void
    {
        $fresh = $from === '';
        self::seed('cities', [
            ['name' => 'София', 'lat' => 42.6977, 'lng' => 23.3219, 'active' => 1],
            ['name' => 'Пловдив', 'lat' => 42.1354, 'lng' => 24.7453, 'active' => 1],
            ['name' => 'Смолян', 'lat' => 41.5774, 'lng' => 24.7011, 'active' => 1],
            ['name' => 'Велико Търново', 'lat' => 43.0757, 'lng' => 25.6172, 'active' => 1],
            ['name' => 'Благоевград', 'lat' => 42.0209, 'lng' => 23.0943, 'active' => 1],
            ['name' => 'Габрово', 'lat' => 42.8742, 'lng' => 25.3187, 'active' => 1],
        ]);

        self::seed('stages', self::stages());
        self::seed('cars', self::cars());
        self::seed('parts', self::parts());
        self::seed('tyres', self::tyres());
        self::seed('rallies', self::rallies());
        self::seed('garage_levels', self::garageLevels());
        self::seed('sponsors', self::sponsors());
        self::seed('incidents', self::incidents());

        if ($fresh || (int) $from < 4) {
            self::addPrivileges();
            self::addForecasts();
        }
    }

    private static function addPrivileges(): void
    {
        global $wpdb;
        $table = Registry::get('cities')->table();

        foreach (self::PRIVILEGES as $city => [$first, $firstValue, $second, $secondValue]) {
            $wpdb->query($wpdb->prepare(
                "UPDATE $table SET privilege_1 = %s, privilege_1_value = %d, privilege_2 = %s, privilege_2_value = %d
                 WHERE name = %s AND privilege_1 = '' AND privilege_2 = ''",
                $first,
                $firstValue,
                $second,
                $secondValue,
                $city
            ));
        }
    }

    private static function addForecasts(): void
    {
        global $wpdb;
        $table = Registry::get('rallies')->table();

        $wpdb->query("UPDATE $table SET weather_change = 'rain', change_chance = 30 WHERE status = 'scheduled' AND weather = 'dry' AND weather_change = ''");
        $wpdb->query("UPDATE $table SET weather_change = 'dry', change_chance = 40 WHERE status = 'scheduled' AND weather = 'rain' AND weather_change = ''");
        $wpdb->query("UPDATE $table SET weather_change = 'dry', change_chance = 25 WHERE status = 'scheduled' AND weather = 'snow' AND weather_change = ''");
    }

    private static function incidents(): array
    {
        $events = [
            ['Грешка в завой', 'mistake', 10, 5, 15, '', '', '', '{пилот} сгреши на {завой} завой и загуби {секунди} сек.'],
            ['Завъртане', 'mistake', 3, 15, 30, '', '', '', '{пилот} се завъртя на {завой} завой и загуби {секунди} сек.'],
            ['Излизане от пътя', 'mistake', 2, 20, 45, '', '', '', '{пилот} излезе от пътя след {завой} завой и загуби {секунди} сек.'],
            ['Пропусната бележка', 'mistake', 2, 5, 10, '', '', '', 'Навигаторът на {пилот} пропусна бележка преди {завой} завой – {секунди} сек. загуба.'],
            ['Спукана гума на чакъл', 'puncture', 4, 90, 90, 'gravel', '', '', '{пилот} спука гума на {завой} завой.'],
            ['Спукана гума', 'puncture', 1.5, 90, 90, '', '', '', '{пилот} спука гума след {завой} завой.'],
            ['Повреда', 'breakdown', 1, 10, 60, '', '', '', '{пилот} има повреда – {част}.'],
            ['Катастрофа', 'crash', 0.8, 0, 0, '', '', '', '{пилот} катастрофира на {завой} завой!'],
            ['Изкривено шаси', 'chassis', 0.15, 0, 0, '', '', '', '{пилот} удари скала на {завой} завой и изкриви шасито.'],
            ['Започна да вали', 'weather', 0, 0, 0, '', 'rain', '', 'Започна да вали. Пътят става хлъзгав.'],
            ['Започна да вали сняг', 'weather', 0, 0, 0, '', 'snow', '', 'Заваля сняг!'],
            ['Пътят изсъхна', 'weather', 0, 0, 0, '', 'dry', '', 'Дъждът спря и пътят изсъхва.'],
        ];

        return array_map(fn($event) => array_combine(
            ['name', 'type', 'chance', 'penalty_min', 'penalty_max', 'surface', 'weather', 'part_type', 'text'],
            $event
        ) + ['active' => 1], $events);
    }

    private static function garageLevels(): array
    {
        $levels = [
            [1, 0, 1, '', 2, 0, 1, 0],
            [2, 15000, 5, 'mechanic', 4, 2, 1, 0],
            [3, 40000, 10, 'engineer,psychologist', 6, 3, 1, 1],
            [4, 100000, 25, 'chemist,informant', 6, 4, 1, 1],
            [5, 250000, 40, 'saboteur', 6, 5, 2, 1],
        ];

        return array_map(fn($level) => array_combine(
            ['level', 'price', 'min_level', 'staff_roles', 'spare_tyres', 'spare_parts', 'cars', 'security'],
            $level
        ), $levels);
    }

    private static function sponsors(): array
    {
        $data = [
            ['Витоша Ойл', 'София', 'doors', 600, 5, 400, 25, 10, 5],
            ['Сердика Финанс', 'София', 'hood', 1500, 3, 1000, 20, 16, 15],
            ['Тракия Логистик', 'Пловдив', 'doors', 550, 6, 350, 30, 8, 5],
            ['Марица Агро', 'Пловдив', 'roof', 2500, 3, 1500, 15, 20, 30],
            ['Родопа Фууд', 'Смолян', 'doors', 500, 6, 300, 30, 8, 5],
            ['Перелик Спорт', 'Смолян', 'suits', 3000, 2, 2000, 15, 20, 40],
            ['Царевец Строй', 'Велико Търново', 'doors', 600, 5, 400, 25, 10, 5],
            ['Янтра Ауто', 'Велико Търново', 'hood', 1400, 4, 900, 20, 12, 15],
            ['Пирин Енерджи', 'Благоевград', 'doors', 650, 5, 450, 25, 10, 5],
            ['Струма Транс', 'Благоевград', 'hood', 1300, 4, 800, 20, 12, 15],
            ['Балкан Текстил', 'Габрово', 'doors', 500, 6, 300, 30, 8, 5],
            ['Узана Тех', 'Габрово', 'roof', 2400, 3, 1400, 15, 16, 30],
        ];

        $cities = self::cityIds();
        $rows = [];
        foreach ($data as [$name, $city, $slot, $payment, $goal, $bonus, $rate, $weeks, $level]) {
            if (!isset($cities[$city])) {
                continue;
            }
            $rows[] = [
                'name' => $name,
                'city_id' => $cities[$city],
                'slot' => $slot,
                'payment' => $payment,
                'goal_place' => $goal,
                'bonus' => $bonus,
                'progress_rate' => $rate,
                'duration_weeks' => $weeks,
                'min_level' => $level,
                'active' => 1,
            ];
        }
        return $rows;
    }

    private static function seed(string $slug, array $rows): void
    {
        global $wpdb;
        $table = Registry::get($slug)->table();

        if (!$rows || (int) $wpdb->get_var("SELECT COUNT(*) FROM $table") > 0) {
            return;
        }

        foreach ($rows as $row) {
            $wpdb->insert($table, $row);
        }
    }

    private static function cityIds(): array
    {
        return array_flip(Registry::get('cities')->options());
    }

    private static function stages(): array
    {
        $data = [
            'София' => [
                ['Витоша – Бояна', 12.4, 'asphalt', 'technical', 6, 58],
                ['Плана', 14.1, 'gravel', 'fast', 5, 44],
                ['Железница', 9.8, 'asphalt', 'fast', 4, 36],
            ],
            'Пловдив' => [
                ['Бачково', 11.2, 'asphalt', 'technical', 7, 64],
                ['Белащица', 10.5, 'gravel', 'technical', 6, 52],
                ['Кричим', 13.6, 'asphalt', 'fast', 5, 40],
            ],
            'Смолян' => [
                ['Пампорово', 15.3, 'asphalt', 'technical', 8, 77],
                ['Перелик', 12.8, 'gravel', 'technical', 7, 60],
                ['Момчиловци', 9.6, 'snow', 'fast', 6, 45],
            ],
            'Велико Търново' => [
                ['Арбанаси', 10.2, 'asphalt', 'fast', 4, 34],
                ['Килифарево', 13.9, 'gravel', 'fast', 5, 41],
                ['Беляковец', 8.7, 'asphalt', 'technical', 6, 47],
            ],
            'Благоевград' => [
                ['Покровник', 11.8, 'asphalt', 'fast', 5, 39],
                ['Бачиново', 12.1, 'gravel', 'technical', 7, 58],
                ['Предела', 14.4, 'asphalt', 'technical', 7, 66],
            ],
            'Габрово' => [
                ['Узана', 13.5, 'asphalt', 'technical', 7, 63],
                ['Шипка', 16.2, 'asphalt', 'fast', 6, 55],
                ['Боженци', 9.9, 'gravel', 'technical', 6, 49],
            ],
        ];

        $cities = self::cityIds();
        $rows = [];
        foreach ($data as $city => $stages) {
            if (!isset($cities[$city])) {
                continue;
            }
            foreach ($stages as $i => [$name, $km, $surface, $profile, $difficulty, $turns]) {
                $rows[] = [
                    'city_id' => $cities[$city],
                    'name' => $name,
                    'position' => $i + 1,
                    'length_km' => $km,
                    'surface' => $surface,
                    'profile' => $profile,
                    'difficulty' => $difficulty,
                    'turns' => $turns,
                    'active' => 1,
                ];
            }
        }
        return $rows;
    }

    private static function cars(): array
    {
        $cars = [
            ['Ласка R4', '3', 190, 55, 52, 60, 32, 18000, 1],
            ['Комета R4', '3', 205, 50, 55, 55, 34, 24000, 3],
            ['Сокол R2', '2', 290, 65, 62, 58, 40, 90000, 10],
            ['Вихър R2', '2', 300, 62, 66, 55, 42, 110000, 15],
            ['Титан WRC', '1', 375, 75, 72, 52, 48, 350000, 30],
            ['Мълния WRC', '1', 385, 72, 75, 50, 50, 400000, 35],
        ];

        return array_map(fn($car) => array_combine(
            ['name', 'class', 'power', 'handling', 'braking', 'reliability', 'fuel_consumption', 'price', 'min_level'],
            $car
        ) + ['active' => 1], $cars);
    }

    private static function parts(): array
    {
        $types = [
            'engine' => [['Стандартен двигател', 'Спортен двигател', 'Състезателен двигател'], 1200, [0, 15, 30], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
            'turbo' => [['Стандартно турбо', 'Спортно турбо', 'Състезателно турбо'], 600, [0, 10, 20], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
            'gearbox' => [['Стандартна скоростна кутия', 'Спортна скоростна кутия', 'Състезателна скоростна кутия'], 800, [0, 5, 10], [0, 0, 0], [0, 0, 0], [0, 5, 8]],
            'suspension' => [['Стандартно окачване', 'Спортно окачване', 'Състезателно окачване'], 700, [0, 0, 0], [0, 6, 12], [0, 0, 0], [0, 0, 0]],
            'brakes' => [['Стандартни спирачки', 'Спортни спирачки', 'Състезателни спирачки'], 400, [0, 0, 0], [0, 0, 0], [0, 6, 12], [0, 0, 0]],
            'chassis' => [['Стандартно шаси', 'Спортно шаси', 'Състезателно шаси'], 1500, [0, 0, 0], [0, 3, 6], [0, 0, 0], [0, 5, 10]],
        ];
        $tiers = [[1, 8, 1], [3, 10, 3], [8, 12, 8]];

        $rows = [];
        foreach ($types as $type => [$names, $price, $power, $handling, $braking, $reliability]) {
            foreach ($tiers as $tier => [$priceFactor, $wear, $level]) {
                $rows[] = [
                    'name' => $names[$tier],
                    'type' => $type,
                    'class' => '',
                    'power_bonus' => $power[$tier],
                    'handling_bonus' => $handling[$tier],
                    'braking_bonus' => $braking[$tier],
                    'reliability_bonus' => $reliability[$tier],
                    'wear_per_100km' => $wear,
                    'price' => $price * $priceFactor,
                    'min_level' => $level,
                    'active' => 1,
                ];
            }
        }
        return $rows;
    }

    private static function tyres(): array
    {
        $tyres = [
            ['Асфалт сухо – мека', 'asphalt_dry', 'soft', 1.0, 0.78, 0.7, 0.5, 30, 800],
            ['Асфалт сухо – твърда', 'asphalt_dry', 'hard', 0.96, 0.75, 0.72, 0.5, 18, 700],
            ['Асфалт мокро – мека', 'asphalt_wet', 'soft', 0.88, 1.0, 0.72, 0.6, 28, 850],
            ['Асфалт мокро – твърда', 'asphalt_wet', 'hard', 0.85, 0.96, 0.74, 0.6, 17, 750],
            ['Чакъл – мека', 'gravel', 'soft', 0.8, 0.75, 1.0, 0.65, 26, 900],
            ['Чакъл – твърда', 'gravel', 'hard', 0.78, 0.72, 0.96, 0.62, 16, 800],
            ['Сняг – мека', 'snow', 'soft', 0.7, 0.75, 0.8, 1.0, 24, 1000],
            ['Сняг – твърда', 'snow', 'hard', 0.68, 0.72, 0.78, 0.96, 15, 900],
        ];

        return array_map(fn($tyre) => array_combine(
            ['name', 'type', 'compound', 'grip_asphalt_dry', 'grip_asphalt_wet', 'grip_gravel', 'grip_snow', 'wear_per_100km', 'price'],
            $tyre
        ) + ['min_level' => 1, 'active' => 1], $tyres);
    }

    private static function rallies(): array
    {
        global $wpdb;
        $stagesTable = Registry::get('stages')->table();
        $cities = Registry::get('cities')->options();
        if (!$cities) {
            return [];
        }

        $order = ['София', 'Пловдив', 'Смолян', 'Велико Търново', 'Благоевград', 'Габрово'];
        $cityIds = array_values(array_filter(array_map(fn($name) => array_search($name, $cities, true), $order)));
        $weather = ['dry', 'dry', 'rain', 'dry', 'rain', 'dry', 'dry', 'snow', 'dry', 'rain'];

        $sunday = new DateTimeImmutable('next sunday 20:00', wp_timezone());
        $rows = [];
        $count = [];

        for ($i = 0; $i < 10; $i++) {
            $cityId = $cityIds[$i % count($cityIds)];
            $count[$cityId] = ($count[$cityId] ?? 0) + 1;
            $stageIds = $wpdb->get_col($wpdb->prepare("SELECT id FROM $stagesTable WHERE city_id = %d AND active = 1 ORDER BY position", $cityId));

            $rows[] = [
                'name' => 'Рали ' . $cities[$cityId] . ($count[$cityId] > 1 ? ' ' . $count[$cityId] : ''),
                'city_id' => $cityId,
                'start_at' => $sunday->modify("+$i week")->format('Y-m-d H:i:00'),
                'season' => 1,
                'weather' => $weather[$i],
                'stage_ids' => implode(',', $stageIds),
                'entry_fee' => 200,
                'prizes' => '3000,2000,1500,1000,800,600,400,300,200,100',
                'status' => 'scheduled',
            ];
        }
        return $rows;
    }
}
