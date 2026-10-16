<?php

namespace BgRally;

use BgRally\Admin\Menu;
use BgRally\Auth\Bans;
use BgRally\Database\Schema;
use BgRally\Rest\Routes;

final class Plugin
{
    public static function boot(): void
    {
        add_action('plugins_loaded', [Schema::class, 'maybeUpgrade']);
        add_action('rest_api_init', [Routes::class, 'register']);
        Bans::register();
        Cron::register();
        Frontend::register();

        if (is_admin()) {
            Menu::register();
        }
    }
}
