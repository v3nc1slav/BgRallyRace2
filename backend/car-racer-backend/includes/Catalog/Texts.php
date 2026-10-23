<?php

namespace BgRally\Catalog;

use BgRally\I18n;

final class Texts
{
    public const FIELDS = [
        'cities' => 'name',
        'stages' => 'name',
        'parts' => 'name',
        'tyres' => 'name',
        'clothes' => 'name',
        'jobs' => 'name',
        'rallies' => 'name',
        'incidents' => 'text',
    ];

    private static array $maps = [];

    public static function of(?string $value, ?string $lang = null): string
    {
        $value = (string) $value;
        $lang ??= I18n::lang();
        if ($value === '' || $lang === I18n::DEFAULT) {
            return $value;
        }
        self::$maps[$lang] ??= self::load($lang);
        return self::$maps[$lang][$value] ?? $value;
    }

    public static function fields(string $field, string $label, bool $long = false): array
    {
        return array_map(
            fn(string $lang) => new Field($field . '_' . $lang, $label . ' (' . $lang . ')', $long ? 'textarea' : 'text', inList: false),
            array_values(array_diff(I18n::LANGS, [I18n::DEFAULT]))
        );
    }

    public static function forget(): void
    {
        self::$maps = [];
    }

    private static function load(string $lang): array
    {
        global $wpdb;
        $map = [];
        foreach (self::FIELDS as $slug => $field) {
            $entity = Registry::get($slug);
            $column = $field . '_' . $lang;
            if (!$entity || !$entity->hasField($column)) {
                continue;
            }
            foreach ($wpdb->get_results("SELECT $field AS source, $column AS target FROM {$entity->table()} WHERE $column <> ''", ARRAY_A) as $row) {
                $map[$row['source']] ??= $row['target'];
            }
        }
        return $map;
    }
}
