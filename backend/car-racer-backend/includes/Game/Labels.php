<?php

namespace BgRally\Game;

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

    public const RALLY_STATUSES =['scheduled' => 'Предстои', 'computing' => 'Изчислява се', 'finished' => 'Изчислено'];

    public static function classLabel(int|string $class): string
    {
        return self::CLASSES[(int) $class] ?? 'Всички класове';
    }
}
