<?php

namespace BgRally\Game;

final class Names
{
    private const MALE = ['Иван', 'Георги', 'Димитър', 'Петър', 'Николай', 'Христо', 'Стефан', 'Тодор', 'Александър', 'Васил', 'Мартин', 'Калоян', 'Борис', 'Атанас', 'Виктор'];

    private const FEMALE = ['Мария', 'Елена', 'Ива', 'Десислава', 'Габриела', 'Петя', 'Милена', 'Теодора', 'Радост', 'Яна'];

    private const SURNAMES = ['Петров', 'Иванов', 'Георгиев', 'Димитров', 'Николов', 'Христов', 'Стоянов', 'Тодоров', 'Колев', 'Маринов', 'Ангелов', 'Попов', 'Василев', 'Йорданов', 'Михайлов', 'Костов', 'Атанасов', 'Илиев', 'Цветков', 'Бонев'];

    public static function person(): string
    {
        $female = mt_rand(1, 100) <= 25;
        $first = $female ? self::pick(self::FEMALE) : self::pick(self::MALE);
        return $first . ' ' . self::pick(self::SURNAMES) . ($female ? 'а' : '');
    }

    private static function pick(array $list): string
    {
        return $list[mt_rand(0, count($list) - 1)];
    }
}
