<?php

namespace BgRally\Game;

use BgRally\I18n;

final class Labels
{
    public const CLASSES = [3 => 'Клас 3', 2 => 'Клас 2', 1 => 'Клас 1'];

    public const SURFACES = ['asphalt' => 'Асфалт', 'gravel' => 'Чакъл', 'snow' => 'Сняг'];

    public const PROFILES = ['fast' => 'Бърз', 'technical' => 'Технически'];

    public const WEATHER = ['dry' => 'Сухо', 'rain' => 'Дъжд', 'snow' => 'Сняг'];

    public const PART_TYPES = [
        'engine' => 'Двигател',
        'turbo' => 'Турбо',
        'gearbox' => 'Скоростна кутия',
        'suspension' => 'Окачване',
        'brakes' => 'Спирачки',
        'chassis' => 'Шаси',
    ];

    public const TYRE_TYPES = [
        'asphalt_dry' => 'Сух асфалт',
        'asphalt_wet' => 'Мокър асфалт',
        'gravel' => 'Чакъл',
        'snow' => 'Сняг',
    ];

    public const COMPOUNDS = ['soft' => 'Мека', 'hard' => 'Твърда'];

    public const STYLES = ['safe' => 'Пестеливо', 'normal' => 'Нормално', 'attack' => 'Атака'];

    public const ROLES = [
        'pilot' => 'Пилот',
        'navigator' => 'Навигатор',
        'mechanic' => 'Майстор',
        'engineer' => 'Инженер',
        'psychologist' => 'Психолог',
        'chemist' => 'Химик',
        'informant' => 'Информатор',
        'saboteur' => 'Саботьор',
    ];

    public const UNLOCKABLE_ROLES = [
        'mechanic' => 'Майстор',
        'engineer' => 'Инженер',
        'psychologist' => 'Психолог',
        'chemist' => 'Химик',
        'informant' => 'Информатор',
        'saboteur' => 'Саботьор',
    ];

    public const SPONSOR_SLOTS = ['doors' => 'Врати', 'hood' => 'Преден капак', 'roof' => 'Таван', 'suits' => 'Екипи'];

    public const CONTRACT_STATUSES = [
        'negotiating' => 'Преговори',
        'active' => 'Активен',
        'failed' => 'Провалени преговори',
        'ended' => 'Изтекъл',
        'terminated' => 'Прекратен',
    ];

    public const EVENT_TYPES = [
        'mistake' => 'Грешка',
        'puncture' => 'Спукана гума',
        'breakdown' => 'Повреда на част',
        'crash' => 'Катастрофа',
        'chassis' => 'Изкривено шаси',
        'weather' => 'Промяна на времето',
    ];

    public const PRIVILEGES = [
        '' => 'Няма',
        'parts' => 'Отстъпка за части',
        'tyres' => 'Отстъпка за гуми',
        'repair' => 'Отстъпка за ремонт',
        'travel' => 'Отстъпка за път',
        'home_fee' => 'Отстъпка за таксата на местното рали',
        'sponsor_local' => 'По-бързи преговори с местни спонсори',
    ];

    public const CLOTHING_SLOTS = ['suit' => 'Костюм', 'shoes' => 'Обувки', 'watch' => 'Часовник', 'accessory' => 'Аксесоар'];

    public const BUILDINGS = [
        'bar' => 'Бар',
        'mall' => 'МОЛ',
        'market' => 'Пазар',
        'shop' => 'Магазин за авто части',
        'track' => 'Официална писта',
        'bank' => 'Банка',
        'hall' => 'Кметство',
        'police' => 'Полиция',
    ];

    public const TRACK_STATUSES = ['' => 'Няма', 'building' => 'Строи се', 'open' => 'Отворена', 'closed' => 'Затворена'];

    public const MARKET_KINDS = ['part' => 'Част', 'tyre' => 'Гуми', 'spare_tyre' => 'Резервна гума', 'car' => 'Кола'];

    public const SABOTAGE_KINDS = ['tyres' => 'Гуми', 'engine' => 'Двигател'];

    public const SABOTAGE_STATUSES = ['planned' => 'Подготвя се', 'success' => 'Успя', 'failed' => 'Не успя'];

    public const FORUM_SECTIONS =['general' => 'Общи', 'rallies' => 'Ралита', 'market' => 'Пазар', 'ideas' => 'Предложения и грешки'];

    public const RALLY_STATUSES = ['scheduled' => 'Предстои', 'computing' => 'Изчислява се', 'finished' => 'Изчислено'];

    public static function text(string $group, int|string|null $key): string
    {
        $key = (string) $key;
        $list = constant(self::class . '::' . $group);
        if (!array_key_exists($key, $list)) {
            return $key;
        }
        $path = 'server.labels.' . strtolower($group) . '.' . ($key === '' ? 'none' : $key);
        return I18n::has($path) ? I18n::t($path) : (string) $list[$key];
    }

    public static function all(string $group): array
    {
        $list = constant(self::class . '::' . $group);
        foreach ($list as $key => $label) {
            $list[$key] = self::text($group, $key);
        }
        return $list;
    }

    public static function classLabel(int|string $class): string
    {
        return isset(self::CLASSES[(int) $class]) ? self::text('CLASSES', (int) $class) : I18n::t('server.labels.allClasses');
    }
}
