<?php

namespace BgRally\Admin;

use BgRally\Game\Ads;

final class AdsPage
{
    public const SLUG = 'bgrally-ads';

    public static function register(): void
    {
        add_action('admin_post_bgr_ads_save', [self::class, 'handleSave']);
    }

    public static function render(): void
    {
        $config = Ads::config();
        $stats = array_column(Ads::stats(), null, 'reward');

        echo '<div class="wrap"><h1>Реклами</h1>';
        Notices::render();
        echo '<p>Рекламите се пускат само по желание на играча, срещу награда. Наградите и лимитите са в <a href="' . esc_url(admin_url('admin.php?page=bgrally-settings')) . '">Настройки → Реклами</a>.</p>';

        printf('<form method="post" action="%s"><input type="hidden" name="action" value="bgr_ads_save">', esc_url(admin_url('admin-post.php')));
        wp_nonce_field('bgr_ads_save');
        echo '<table class="form-table" role="presentation">';

        $options = '';
        foreach (Ads::PROVIDERS as $key => $label) {
            $options .= sprintf('<option value="%s"%s>%s</option>', esc_attr($key), selected($config['provider'], $key, false), esc_html($label));
        }
        printf('<tr><th scope="row"><label for="bgr-provider">Рекламна мрежа</label></th><td><select id="bgr-provider" name="provider">%s</select><p class="description">Тестовата реклама е брояч без истинска реклама – за проверка на наградите.</p></td></tr>', $options);
        printf(
            '<tr><th scope="row"><label for="bgr-gpt">Ad Manager: рекламна единица</label></th><td><input id="bgr-gpt" name="gpt_unit" class="regular-text" value="%s" placeholder="/1234567/bgrally_rewarded"><p class="description">Пътят на rewarded единицата от Google Ad Manager.</p></td></tr>',
            esc_attr($config['gpt_unit'])
        );
        printf(
            '<tr><th scope="row"><label for="bgr-pub">Publisher ID за съгласието</label></th><td><input id="bgr-pub" name="publisher" class="regular-text" value="%s" placeholder="pub-1234567890123456"><p class="description">Зарежда прозореца за съгласие на Google (GDPR). Без него рекламите са с ограничени данни.</p></td></tr>',
            esc_attr($config['publisher'])
        );
        echo '</table>';
        submit_button('Запази');
        echo '</form>';

        echo '<h2>Днес</h2><table class="widefat striped" style="max-width:600px"><thead><tr><th>Награда</th><th>Започнати</th><th>Получени</th></tr></thead><tbody>';
        foreach (Ads::REWARDS as $reward) {
            printf(
                '<tr><td>%s</td><td>%d</td><td>%d</td></tr>',
                esc_html(Ads::label($reward)),
                (int) ($stats[$reward]['started'] ?? 0),
                (int) ($stats[$reward]['claimed'] ?? 0)
            );
        }
        echo '</tbody></table></div>';
    }

    public static function handleSave(): void
    {
        check_admin_referer('bgr_ads_save');
        if (!current_user_can('manage_options')) {
            wp_die('Нямате права за това действие.', 403);
        }

        $provider = sanitize_key(wp_unslash($_POST['provider'] ?? 'test'));
        update_option(Ads::OPTION, [
            'provider' => isset(Ads::PROVIDERS[$provider]) ? $provider : 'test',
            'gpt_unit' => sanitize_text_field(wp_unslash($_POST['gpt_unit'] ?? '')),
            'publisher' => preg_replace('/[^a-z0-9-]/', '', strtolower(wp_unslash($_POST['publisher'] ?? ''))),
        ], false);

        wp_safe_redirect(add_query_arg('bgr_msg', 'ads_saved', admin_url('admin.php?page=' . self::SLUG)));
        exit;
    }
}
