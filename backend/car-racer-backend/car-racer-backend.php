<?php
/**
 * Plugin Name: Car Racer Backend
 */

add_shortcode('car_racer', function () {
    $url = plugin_dir_url(__FILE__) . 'game/';
    wp_enqueue_script('car-racer', $url . 'game.js', [], '1.0', true);
    wp_enqueue_style('car-racer', $url . 'game.css', [], '1.0');
    return '<div id="app" style="width:100%;height:80vh"></div>';
});

add_filter('script_loader_tag', function ($tag, $handle) {
    if ($handle === 'car-racer') {
        return str_replace('<script ', '<script type="module" ', $tag);
    }
    return $tag;
}, 10, 2);