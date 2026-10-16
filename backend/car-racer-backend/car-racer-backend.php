<?php
/**
 * Plugin Name: Car Racer Backend
 * Description: Сървърът на BG Rally: игрова логика, админ и REST API.
 * Version: 0.1.0
 * Requires PHP: 8.1
 */

defined('ABSPATH') || exit;

define('BGR_VERSION', '0.1.0');
define('BGR_FILE', __FILE__);
define('BGR_DIR', __DIR__);

spl_autoload_register(function ($class) {
    if (!str_starts_with($class, 'BgRally\\')) {
        return;
    }
    $path = __DIR__ . '/includes/' . str_replace('\\', '/', substr($class, 8)) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

register_activation_hook(__FILE__, [BgRally\Database\Schema::class, 'install']);
register_deactivation_hook(__FILE__, [BgRally\Cron::class, 'unschedule']);

BgRally\Plugin::boot();
