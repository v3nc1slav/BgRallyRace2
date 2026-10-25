<?php

namespace BgRally\Admin;

use BgRally\Auth\Guard;
use BgRally\Settings;

final class SettingsPage
{
    private const GROUP = 'bgr_settings';

    public static function registerSettings(): void
    {
        register_setting(self::GROUP, Settings::OPTION, [
            'type' => 'array',
            'default' => Settings::defaults(),
            'sanitize_callback' => [self::class, 'sanitize'],
        ]);
    }

    public static function sanitize($input): array
    {
        $clean = [];
        foreach (Settings::defaults() as $key => $default) {
            $value = isset($input[$key]) ? (float) str_replace(',', '.', (string) $input[$key]) : $default;
            $clean[$key] = max(0, $value);
        }
        return $clean;
    }

    public static function render(): void
    {
        echo '<div class="wrap bgr-settings"><h1>Настройки</h1>';
        settings_errors();

        echo '<div class="bgr-settings-tools">
            <input type="search" data-role="search" placeholder="Търси настройка…">
            <button type="button" class="button" data-role="expand">Отвори всички</button>
            <button type="button" class="button" data-role="collapse">Затвори всички</button>
        </div>';

        echo '<form method="post" action="options.php">';
        settings_fields(self::GROUP);

        foreach (Settings::SECTIONS as $section => $fields) {
            printf(
                '<details class="bgr-section" data-section="%s"><summary>%s <span class="bgr-count">(%d)</span></summary><div class="bgr-admin-grid bgr-cols-3">',
                esc_attr($section),
                esc_html($section),
                count($fields)
            );
            foreach ($fields as $key => [$label]) {
                printf(
                    '<div class="bgr-admin-field"><label for="bgr-%1$s">%2$s</label><input type="number" min="0" step="any" id="bgr-%1$s" name="%3$s[%1$s]" value="%4$s"></div>',
                    esc_attr($key),
                    esc_html($label),
                    esc_attr(Settings::OPTION),
                    esc_attr((string) Settings::get($key))
                );
            }
            echo '</div></details>';
        }

        submit_button('Запази');
        echo '</form>';
        self::locks();
        echo '</div>';
    }

    private static function locks(): void
    {
        echo '<h2>Заключени входове</h2>';
        if (!empty($_GET['unlocked'])) {
            echo '<div class="notice notice-success"><p>Входът е отключен.</p></div>';
        }
        $locks = Guard::locks();
        if (!$locks) {
            echo '<p>Няма заключени профили или IP адреси.</p>';
            return;
        }
        echo '<table class="widefat striped"><thead><tr><th>IP адрес</th><th>Профил</th><th>Заключен до</th><th></th></tr></thead><tbody>';
        foreach ($locks as $lock) {
            printf(
                '<tr><td>%s</td><td>%s</td><td>%s</td><td><form method="post" action="%s"><input type="hidden" name="action" value="bgr_guard_unlock"><input type="hidden" name="ip" value="%s"><input type="hidden" name="login" value="%s">%s<button class="button">Отключи</button></form></td></tr>',
                esc_html($lock['ip']),
                esc_html($lock['login'] ?? 'всички профили'),
                esc_html(wp_date('d.m.Y H:i', $lock['until'])),
                esc_url(admin_url('admin-post.php')),
                esc_attr($lock['ip']),
                esc_attr($lock['login'] ?? ''),
                wp_nonce_field('bgr_guard_unlock', '_wpnonce', true, false)
            );
        }
        echo '</tbody></table>';
    }

    public static function handleUnlock(): void
    {
        check_admin_referer('bgr_guard_unlock');
        if (!current_user_can('manage_options')) {
            wp_die('Нямате права за това действие.', 403);
        }
        $login = sanitize_text_field(wp_unslash($_POST['login'] ?? ''));
        Guard::clear(sanitize_text_field(wp_unslash($_POST['ip'] ?? '')), $login === '' ? null : $login);
        wp_safe_redirect(admin_url('admin.php?page=bgrally-settings&unlocked=1'));
        exit;
    }
}
