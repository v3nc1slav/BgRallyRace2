<?php

namespace BgRally;

final class Frontend
{
    public static function register(): void
    {
        add_shortcode('car_racer', [self::class, 'shortcode']);
        add_filter('script_loader_tag', [self::class, 'moduleTag'], 10, 2);
    }

    public static function shortcode(): string
    {
        $dir = BGR_DIR . '/game/';
        $url = plugin_dir_url(BGR_FILE) . 'game/';

        $ver = fn($file) => file_exists($dir . $file) ? filemtime($dir . $file) : false;

        wp_enqueue_script('car-racer', $url . 'game.js', [], $ver('game.js'), true);
        wp_enqueue_style('car-racer', $url . 'game.css', [], $ver('game.css'));
        add_filter('body_class', [self::class, 'bodyClass']);

        return sprintf(
            '<div id="app" data-rest-url="%s" data-nonce="%s"></div>',
            esc_url(rest_url()),
            esc_attr(wp_create_nonce('wp_rest'))
        );
    }

    public static function bodyClass(array $classes): array
    {
        $classes[] = 'bgr-game';
        return $classes;
    }

    public static function moduleTag(string $tag, string $handle): string
    {
        if ($handle === 'car-racer') {
            return str_replace('<script ', '<script type="module" ', $tag);
        }
        return $tag;
    }
}
