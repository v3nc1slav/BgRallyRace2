<?php

namespace BgRally;

use BgRally\Database\Tables;

final class I18n
{
    public const LANGS = ['bg', 'en'];
    public const DEFAULT = 'bg';

    private static ?string $current = null;
    private static ?string $player = null;
    private static array $messages = [];
    private static array $managers = [];

    public static function register(): void
    {
        add_filter('rest_allowed_cors_headers', fn(array $headers) => array_values(array_unique([...$headers, 'X-BGR-Lang', 'X-BGR-Lang-Set', 'X-BGR-Token'])));
    }

    public static function requested(): ?string
    {
        $value = strtolower((string) ($_SERVER['HTTP_X_BGR_LANG'] ?? ''));
        return in_array($value, self::LANGS, true) ? $value : null;
    }

    public static function remember(array $manager): array
    {
        global $wpdb;
        $lang = self::chosen();
        if ($lang && ($manager['lang'] ?? self::DEFAULT) !== $lang) {
            $wpdb->update(Tables::name('managers'), ['lang' => $lang], ['id' => $manager['id']]);
            $manager['lang'] = $lang;
        }
        self::$managers[(int) $manager['id']] = self::$player = self::of((string) ($manager['lang'] ?? self::DEFAULT));
        return $manager;
    }

    private static function chosen(): ?string
    {
        return ($_SERVER['HTTP_X_BGR_LANG_SET'] ?? '') === '1' ? self::requested() : null;
    }

    public static function browser(): string
    {
        $accept = strtolower((string) ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''));
        return $accept === '' || preg_match('/(^|,)\s*bg\b/', $accept) ? 'bg' : 'en';
    }

    public static function lang(): string
    {
        return self::$current ?? self::chosen() ?? self::$player ?? self::requested() ?? self::DEFAULT;
    }

    public static function of(int|array|string $who): string
    {
        if (is_string($who)) {
            return in_array($who, self::LANGS, true) ? $who : self::DEFAULT;
        }
        if (is_array($who)) {
            return self::of((string) ($who['lang'] ?? self::DEFAULT));
        }
        if (!isset(self::$managers[$who])) {
            global $wpdb;
            self::$managers[$who] = self::of((string) $wpdb->get_var($wpdb->prepare('SELECT lang FROM ' . Tables::name('managers') . ' WHERE id = %d', $who)));
        }
        return self::$managers[$who];
    }

    public static function as(int|array|string $who, callable $task): mixed
    {
        $previous = self::$current;
        self::$current = self::of($who);
        try {
            return $task();
        } finally {
            self::$current = $previous;
        }
    }

    public static function t(string $key, array $params = [], ?string $lang = null): string
    {
        $text = self::find($lang ?? self::lang(), $key) ?? self::find(self::DEFAULT, $key) ?? $key;
        if (str_contains($text, '|')) {
            $choices = array_map('trim', explode('|', $text));
            $count = (int) ($params['count'] ?? 0);
            $text = count($choices) === 2 ? $choices[$count === 1 ? 0 : 1] : $choices[max(0, min($count, count($choices) - 1))];
        }
        return preg_replace_callback('/\{(\w+)\}/', fn($match) => array_key_exists($match[1], $params) ? (string) $params[$match[1]] : $match[0], $text);
    }

    public static function has(string $key, ?string $lang = null): bool
    {
        return self::find($lang ?? self::lang(), $key) !== null;
    }

    public static function money(int|float $amount): string
    {
        $amount = (int) round($amount);
        if (self::lang() === 'bg') {
            return number_format($amount, 0, ',', "\u{00A0}") . "\u{00A0}€";
        }
        return ($amount < 0 ? '-' : '') . '€' . number_format(abs($amount));
    }

    public static function date(int $timestamp, bool $time = false): string
    {
        return date((self::lang() === 'bg' ? 'd.m.Y' : 'j M Y') . ($time ? ' H:i' : ''), $timestamp);
    }

    public static function join(array $parts): string
    {
        $last = array_pop($parts);
        return $parts ? implode(', ', $parts) . ' ' . self::t('server.common.and') . ' ' . $last : (string) $last;
    }

    public static function ordinal(int $number): string
    {
        $lastTwo = $number % 100;
        $last = $number % 10;
        $teen = $lastTwo >= 11 && $lastTwo <= 19;
        if (self::lang() === 'bg') {
            $suffix = match (true) {
                !$teen && $last === 1 => 'вия',
                !$teen && $last === 2 => 'рия',
                !$teen && ($last === 7 || $last === 8) => 'мия',
                default => 'ия',
            };
            return $number . '-' . $suffix;
        }
        $suffix = $teen ? 'th' : (['th', 'st', 'nd', 'rd'][$last] ?? 'th');
        return $number . $suffix;
    }

    public static function msg(string $key, array $params = []): array
    {
        return [$key, $params];
    }

    public static function text(string $text, array $params = []): array
    {
        return ['=', $text, $params];
    }

    public static function encode(array ...$segments): string
    {
        return (string) wp_json_encode($segments, JSON_UNESCAPED_UNICODE);
    }

    public static function render(string $stored, ?string $lang = null): string
    {
        $segments = str_starts_with($stored, '[') ? json_decode($stored, true) : null;
        if (!is_array($segments)) {
            return $stored;
        }
        return self::as($lang ?? self::lang(), function () use ($segments) {
            $parts = [];
            foreach ($segments as $segment) {
                $parts[] = self::segment((array) $segment);
            }
            return implode(' ', array_filter($parts, 'strlen'));
        });
    }

    private static function segment(array $segment): string
    {
        if (($segment[0] ?? '') === '=') {
            $params = self::values((array) ($segment[2] ?? []));
            $aliases = ['pilot' => ['driver', 'пилот'], 'turn' => ['завой'], 'seconds' => ['секунди'], 'part' => ['част']];
            $pairs = [];
            foreach ($params as $name => $value) {
                foreach ([$name, ...($aliases[$name] ?? [])] as $alias) {
                    $pairs['{' . $alias . '}'] = (string) $value;
                }
            }
            return strtr(Catalog\Texts::of((string) ($segment[1] ?? '')), $pairs);
        }
        return self::t((string) ($segment[0] ?? ''), self::values((array) ($segment[1] ?? [])));
    }

    private static function values(array $params): array
    {
        foreach ($params as $name => $value) {
            if (is_array($value)) {
                $params[$name] = self::value($value);
            }
        }
        return $params;
    }

    private static function value(array $value): string
    {
        switch ($value[0] ?? '') {
            case 'label':
                $text = Game\Labels::text((string) ($value[1] ?? ''), $value[2] ?? '');
                return empty($value[3]) ? $text : mb_strtolower($text);
            case 'class':
                return Game\Labels::classLabel($value[1] ?? 0);
            case 'ordinal':
                return self::ordinal((int) ($value[1] ?? 0));
            case 'name':
                return Catalog\Texts::of((string) ($value[1] ?? ''));
            case 'money':
                return self::money((int) ($value[1] ?? 0));
        }
        return '';
    }

    private static function find(string $lang, string $key): ?string
    {
        if (!isset(self::$messages[$lang])) {
            $file = BGR_DIR . '/locales/' . $lang . '.json';
            self::$messages[$lang] = is_file($file) ? (array) json_decode((string) file_get_contents($file), true) : [];
        }
        $node = self::$messages[$lang];
        foreach (explode('.', $key) as $part) {
            if (!is_array($node) || !array_key_exists($part, $node)) {
                return null;
            }
            $node = $node[$part];
        }
        return is_string($node) ? $node : null;
    }
}
