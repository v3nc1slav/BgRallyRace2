<?php

namespace BgRally\Admin;

use BgRally\Catalog\Registry;

final class Menu
{
    public const SLUG = 'bgrally';

    public static function register(): void
    {
        add_action('admin_menu', [self::class, 'addPages']);
        add_action('admin_init', [SettingsPage::class, 'registerSettings']);
        add_action('admin_post_bgr_ban', [PlayersPage::class, 'handleBan']);
        add_action('admin_post_bgr_unban', [PlayersPage::class, 'handleUnban']);
    }

    public static function addPages(): void
    {
        add_menu_page('BG Rally', 'BG Rally', 'manage_options', self::SLUG, [PlayersPage::class, 'render'], 'dashicons-car', 30);
        add_submenu_page(self::SLUG, 'Играчи', 'Играчи', 'manage_options', self::SLUG, [PlayersPage::class, 'render']);

        foreach (Registry::entities() as $entity) {
            $page = new CrudPage($entity);
            $hook = add_submenu_page(self::SLUG, $entity->plural, $entity->plural, 'manage_options', 'bgrally-' . $entity->slug, [$page, 'render']);
            add_action("load-$hook", [$page, 'handle']);
        }

        add_submenu_page(self::SLUG, 'Настройки', 'Настройки', 'manage_options', 'bgrally-settings', [SettingsPage::class, 'render']);
    }
}
