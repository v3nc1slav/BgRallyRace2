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
        TalkPage::register();
        AdsPage::register();
        AuthPage::register();
        LevelsPage::register();
        add_action('admin_post_bgr_guard_unlock', [SettingsPage::class, 'handleUnlock']);
        add_action('admin_post_bgr_revoke_tokens', [PlayersPage::class, 'handleRevoke']);
        add_action('admin_enqueue_scripts', [self::class, 'assets']);
    }

    public static function assets(string $hook): void
    {
        if (!str_contains($hook, self::SLUG)) {
            return;
        }
        $version = fn(string $file) => file_exists(BGR_DIR . '/assets/' . $file) ? filemtime(BGR_DIR . '/assets/' . $file) : false;
        wp_enqueue_style('bgr-admin', plugin_dir_url(BGR_FILE) . 'assets/admin.css', [], $version('admin.css'));
        wp_enqueue_script('bgr-admin', plugin_dir_url(BGR_FILE) . 'assets/admin.js', [], $version('admin.js'), true);
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

        add_submenu_page(self::SLUG, 'Чат и форум', 'Чат и форум', 'manage_options', TalkPage::SLUG, [TalkPage::class, 'render']);
        add_submenu_page(self::SLUG, 'Вход и приложение', 'Вход и приложение', 'manage_options', AuthPage::SLUG, [AuthPage::class, 'render']);
        add_submenu_page(self::SLUG, 'Реклами', 'Реклами', 'manage_options', AdsPage::SLUG, [AdsPage::class, 'render']);
        add_submenu_page(self::SLUG, 'Нива', 'Нива', 'manage_options', LevelsPage::SLUG, [LevelsPage::class, 'render']);
        add_submenu_page(self::SLUG, 'Настройки', 'Настройки', 'manage_options', 'bgrally-settings', [SettingsPage::class, 'render']);
    }
}
