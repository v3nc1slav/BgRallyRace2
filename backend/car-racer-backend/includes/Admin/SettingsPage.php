<?php

namespace BgRally\Admin;

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
        echo '</form></div>';
    }
}
