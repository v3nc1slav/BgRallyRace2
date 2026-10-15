<?php
/**
 * Plugin Name: Car Racer Backend
 */

add_shortcode('car_racer', function () {
    $dir = plugin_dir_path(__FILE__) . 'game/';
    $url = plugin_dir_url(__FILE__) . 'game/';

    $ver = fn($file) => file_exists($dir . $file) ? filemtime($dir . $file) : false;

    wp_enqueue_script('car-racer', $url . 'game.js', [], $ver('game.js'), true);
    wp_enqueue_style('car-racer', $url . 'game.css', [], $ver('game.css'));

    return sprintf(
        '<div id="app" data-rest-url="%s" data-nonce="%s" style="width:100%%;height:80vh"></div>',
        esc_url(rest_url()),
        esc_attr(wp_create_nonce('wp_rest'))
    );
});

add_filter('script_loader_tag', function ($tag, $handle) {
    if ($handle === 'car-racer') {
        return str_replace('<script ', '<script type="module" ', $tag);
    }
    return $tag;
}, 10, 2);
