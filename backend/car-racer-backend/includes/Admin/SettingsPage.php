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
        echo '<div class="wrap"><h1>Настройки</h1>';
        settings_errors();

        echo '<form method="post" action="options.php">';
        settings_fields(self::GROUP);

        foreach (Settings::SECTIONS as $section => $fields) {
            printf('<h2>%s</h2><table class="form-table" role="presentation">', esc_html($section));
            foreach ($fields as $key => [$label]) {
                printf(
                    '<tr><th scope="row"><label for="bgr-%1$s">%2$s</label></th><td><input type="number" min="0" step="any" id="bgr-%1$s" name="%3$s[%1$s]" value="%4$s" class="small-text"></td></tr>',
                    esc_attr($key),
                    esc_html($label),
                    esc_attr(Settings::OPTION),
                    esc_attr((string) Settings::get($key))
                );
            }
            echo '</table>';
        }

        submit_button('Запази');
        echo '</form></div>';
    }
}
