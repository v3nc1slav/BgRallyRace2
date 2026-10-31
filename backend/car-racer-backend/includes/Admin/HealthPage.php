<?php

namespace BgRally\Admin;

use BgRally\Game\Health;

final class HealthPage
{
    public const SLUG = 'bgrally-health';

    public static function register(): void
    {
        add_action('admin_notices', [self::class, 'warning']);
    }

    public static function warning(): void
    {
        $screen = get_current_screen();
        if (!$screen || !str_contains($screen->id, Menu::SLUG) || str_contains($screen->id, self::SLUG) || !current_user_can('manage_options')) {
            return;
        }
        if (array_filter(Health::checks(), fn(array $check) => !$check['ok'])) {
            printf(
                '<div class="notice notice-warning"><p>BG Rally: има нещо за проверка в <a href="%s">Състояние</a>.</p></div>',
                esc_url(admin_url('admin.php?page=' . self::SLUG))
            );
        }
    }

    public static function render(): void
    {
        echo '<div class="wrap"><h1>Състояние</h1>';
        echo '<p>Проверки на фоновите задачи, ралитата, наградите и имейлите. Блокираните ралита и неизплатените награди се поправят сами при следващото изпълнение на задачите.</p>';
        echo '<table class="widefat striped" style="max-width:800px"><thead><tr><th>Проверка</th><th>Стойност</th><th>Статус</th></tr></thead><tbody>';
        foreach (Health::checks() as $check) {
            printf(
                '<tr><td>%s</td><td>%s</td><td>%s</td></tr>',
                esc_html($check['label']),
                esc_html($check['value']),
                $check['ok'] ? '✓ наред' : '<strong>✗ провери</strong>'
            );
        }
        echo '</tbody></table></div>';
    }
}
