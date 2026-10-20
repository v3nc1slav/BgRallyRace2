<?php

namespace BgRally\Admin;

use BgRally\Auth\Social;
use BgRally\Game\Push;
use BgRally\Pages;

final class AuthPage
{
    public const SLUG = 'bgrally-auth';

    public static function register(): void
    {
        add_action('admin_post_bgr_auth_save', [self::class, 'handleSave']);
        add_action('admin_post_bgr_push_test', [self::class, 'handleTest']);
    }

    public static function render(): void
    {
        $config = Social::config();
        $links = Pages::links();

        echo '<div class="wrap"><h1>Вход и приложение</h1>';
        Notices::render();
        echo '<p>Бутоните „Вход с Google“ и „Вход с Facebook“ се показват в играта само когато съответният вход е настроен.</p>';

        printf('<form method="post" action="%s"><input type="hidden" name="action" value="bgr_auth_save">', esc_url(admin_url('admin-post.php')));
        wp_nonce_field('bgr_auth_save');
        echo '<div class="bgr-admin-grid">';
        printf(
            '<div class="bgr-admin-field bgr-wide"><label for="bgr-google">Google: OAuth Client ID</label><input type="text" id="bgr-google" name="google_client_ids" value="%s" placeholder="1234-abc.apps.googleusercontent.com"><p class="description">Уеб клиентът от Google Cloud. Ако има няколко (уеб и приложение), разделете ги със запетая – първият се използва за бутона.</p></div>',
            esc_attr(implode(', ', $config['google_client_ids']))
        );
        printf(
            '<div class="bgr-admin-field"><label for="bgr-fb-id">Facebook: App ID</label><input type="text" id="bgr-fb-id" name="facebook_app_id" value="%s"></div>',
            esc_attr($config['facebook_app_id'])
        );
        printf(
            '<div class="bgr-admin-field"><label for="bgr-fb-secret">Facebook: App Secret</label><input type="password" id="bgr-fb-secret" name="facebook_secret" value="" placeholder="%s" autocomplete="new-password"><p class="description">Оставете празно, за да запазите текущия.</p></div>',
            $config['facebook_secret'] !== '' ? esc_attr('запазен') : ''
        );
        printf(
            '<div class="bgr-admin-field"><label for="bgr-fb-token">Facebook: Client Token</label><input type="text" id="bgr-fb-token" name="facebook_client_token" value="%s"><p class="description">Нужен е за входа в приложението за Android (Settings → Advanced в Meta for Developers).</p></div>',
            esc_attr($config['facebook_client_token'])
        );
        echo '</div>';

        $push = Push::config();
        $web = $push['web'];
        echo '<h2>Известия (Firebase Cloud Messaging)</h2><div class="bgr-admin-grid">';
        printf(
            '<div class="bgr-admin-field bgr-wide"><label for="bgr-sa">Service account (JSON)</label><textarea id="bgr-sa" name="push_account" rows="4" placeholder="%s"></textarea><p class="description">Firebase → Project settings → Service accounts → Generate new private key. Поставете целия файл. Оставете празно, за да запазите текущия.</p></div>',
            esc_attr($push['account'] ? sprintf('запазен – проект %s', $push['account']['project_id']) : '{ "type": "service_account", ... }')
        );
        foreach (['api_key' => ['apiKey', 'Web: apiKey'], 'sender_id' => ['messagingSenderId', 'Web: messagingSenderId'], 'app_id' => ['appId', 'Web: appId'], 'vapid_key' => ['vapidKey', 'Web Push: VAPID ключ (Cloud Messaging → Web Push certificates)']] as $name => [$key, $label]) {
            printf(
                '<div class="bgr-admin-field"><label for="bgr-%1$s">%2$s</label><input type="text" id="bgr-%1$s" name="%1$s" value="%3$s"></div>',
                esc_attr($name),
                esc_html($label),
                esc_attr($web[$key])
            );
        }
        echo '</div><p class="description">За Android приложението свалете google-services.json от Firebase и го сложете в android/app/.</p>';
        submit_button('Запази');
        echo '</form>';

        if ($push['account']) {
            printf(
                '<form method="post" action="%s"><input type="hidden" name="action" value="bgr_push_test">%s<p><button class="button">Изпрати пробно известие до моите устройства (%d)</button></p></form>',
                esc_url(admin_url('admin-post.php')),
                wp_nonce_field('bgr_push_test', '_wpnonce', true, false),
                Push::deviceCount(get_current_user_id())
            );
        }

        echo '<h2>Адреси за Google Play, Google и Facebook</h2><table class="widefat striped" style="max-width:900px"><tbody>';
        printf('<tr><th>Политика за поверителност</th><td>%s</td></tr>', $links['privacy'] ? sprintf('<a href="%1$s">%1$s</a>', esc_url($links['privacy'])) : 'няма');
        printf('<tr><th>Изтриване на профила (Facebook „Data deletion instructions URL“)</th><td>%s</td></tr>', $links['deletion'] ? sprintf('<a href="%1$s">%1$s</a>', esc_url($links['deletion'])) : 'няма');
        printf('<tr><th>Сайт (Authorized JavaScript origin)</th><td><code>%s</code></td></tr>', esc_html(untrailingslashit(home_url())));
        echo '</tbody></table>';
        echo '<p class="description">Текстовете на двете страници са шаблон – попълнете полетата в [квадратни скоби] от Страници в WordPress.</p></div>';
    }

    public static function handleSave(): void
    {
        check_admin_referer('bgr_auth_save');
        if (!current_user_can('manage_options')) {
            wp_die('Нямате права за това действие.', 403);
        }

        $current = Social::config();
        $secret = trim((string) wp_unslash($_POST['facebook_secret'] ?? ''));
        update_option(Social::OPTION, [
            'google_client_ids' => sanitize_text_field(wp_unslash($_POST['google_client_ids'] ?? '')),
            'facebook_app_id' => preg_replace('/\D/', '', (string) wp_unslash($_POST['facebook_app_id'] ?? '')),
            'facebook_secret' => $secret !== '' ? preg_replace('/[^a-f0-9]/i', '', $secret) : $current['facebook_secret'],
            'facebook_client_token' => preg_replace('/[^a-f0-9]/i', '', (string) wp_unslash($_POST['facebook_client_token'] ?? '')),
        ], false);

        $push = (array) get_option(Push::OPTION, []);
        $account = trim((string) wp_unslash($_POST['push_account'] ?? ''));
        $decoded = json_decode($account, true);
        $clean = fn(string $name) => preg_replace('/[^A-Za-z0-9:_\-]/', '', (string) wp_unslash($_POST[$name] ?? ''));
        update_option(Push::OPTION, [
            'service_account' => is_array($decoded) && !empty($decoded['private_key']) ? wp_json_encode($decoded) : (string) ($push['service_account'] ?? ''),
            'api_key' => $clean('api_key'),
            'sender_id' => $clean('sender_id'),
            'app_id' => $clean('app_id'),
            'vapid_key' => $clean('vapid_key'),
        ], false);
        delete_transient('bgr_fcm_token');

        wp_safe_redirect(add_query_arg('bgr_msg', $account !== '' && !is_array($decoded) ? 'push_invalid' : 'auth_saved', admin_url('admin.php?page=' . self::SLUG)));
        exit;
    }

    public static function handleTest(): void
    {
        check_admin_referer('bgr_push_test');
        if (!current_user_can('manage_options')) {
            wp_die('Нямате права за това действие.', 403);
        }
        $sent = Push::test(get_current_user_id());
        Notices::flash($sent ? sprintf('Изпратено до %d устройства.', $sent) : 'Не беше изпратено. Включи известията от играта (Настройки) и провери ключовете.', $sent ? 'success' : 'error');
        wp_safe_redirect(admin_url('admin.php?page=' . self::SLUG));
        exit;
    }
}
