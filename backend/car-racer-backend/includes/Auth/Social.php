<?php

namespace BgRally\Auth;

use BgRally\I18n;
use WP_Error;

final class Social
{
    public const OPTION = 'bgr_auth';
    private const GRAPH = 'https://graph.facebook.com/v19.0/';

    public static function config(): array
    {
        $config = (array) get_option(self::OPTION, []);
        return [
            'google_client_ids' => array_values(array_filter(array_map('trim', explode(',', (string) ($config['google_client_ids'] ?? ''))))),
            'facebook_app_id' => (string) ($config['facebook_app_id'] ?? ''),
            'facebook_secret' => (string) ($config['facebook_secret'] ?? ''),
            'facebook_client_token' => (string) ($config['facebook_client_token'] ?? ''),
        ];
    }

    public static function providers(): array
    {
        $config = self::config();
        $facebook = $config['facebook_app_id'] !== '' && $config['facebook_secret'] !== '';
        return [
            'google' => $config['google_client_ids'][0] ?? null,
            'facebook' => $facebook ? $config['facebook_app_id'] : null,
            'facebook_token' => $facebook && $config['facebook_client_token'] !== '' ? $config['facebook_client_token'] : null,
        ];
    }

    public static function login(string $provider, string $token): int|WP_Error
    {
        if ($token === '') {
            return new WP_Error('bgr_social', I18n::t('server.social.noResponse'), ['status' => 400]);
        }
        $profile = match ($provider) {
            'google' => self::google($token),
            'facebook' => self::facebook($token),
            default => new WP_Error('bgr_social', I18n::t('server.social.unknown'), ['status' => 400]),
        };
        return is_wp_error($profile) ? $profile : self::findOrCreate($provider, $profile);
    }

    private static function fetch(string $url): ?array
    {
        $response = wp_remote_get($url, ['timeout' => 10]);
        if (is_wp_error($response)) {
            return null;
        }
        $data = json_decode((string) wp_remote_retrieve_body($response), true);
        return is_array($data) && wp_remote_retrieve_response_code($response) === 200 ? $data : null;
    }

    private static function google(string $token): array|WP_Error
    {
        $clients = self::config()['google_client_ids'];
        if (!$clients) {
            return new WP_Error('bgr_social', I18n::t('server.social.googleOff'), ['status' => 400]);
        }
        $data = self::fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode($token));
        $valid = $data
            && in_array($data['aud'] ?? '', $clients, true)
            && in_array($data['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
            && (int) ($data['exp'] ?? 0) > time()
            && !empty($data['sub']);
        if (!$valid) {
            return new WP_Error('bgr_social', I18n::t('server.social.googleFailed'), ['status' => 401]);
        }

        return [
            'subject' => (string) $data['sub'],
            'email' => (string) ($data['email'] ?? ''),
            'verified' => in_array($data['email_verified'] ?? false, [true, 'true'], true),
            'name' => (string) ($data['name'] ?? ''),
        ];
    }

    private static function facebook(string $token): array|WP_Error
    {
        $config = self::config();
        if ($config['facebook_app_id'] === '' || $config['facebook_secret'] === '') {
            return new WP_Error('bgr_social', I18n::t('server.social.facebookOff'), ['status' => 400]);
        }
        $debug = self::fetch(self::GRAPH . 'debug_token?' . http_build_query([
            'input_token' => $token,
            'access_token' => $config['facebook_app_id'] . '|' . $config['facebook_secret'],
        ]));
        $info = $debug['data'] ?? [];
        if (empty($info['is_valid']) || (string) ($info['app_id'] ?? '') !== $config['facebook_app_id']) {
            return new WP_Error('bgr_social', I18n::t('server.social.facebookFailed'), ['status' => 401]);
        }
        $me = self::fetch(self::GRAPH . 'me?' . http_build_query(['fields' => 'id,name,email', 'access_token' => $token]));
        if (!$me || empty($me['id']) || (string) $me['id'] !== (string) ($info['user_id'] ?? '')) {
            return new WP_Error('bgr_social', I18n::t('server.social.facebookProfile'), ['status' => 401]);
        }

        return ['subject' => (string) $me['id'], 'email' => (string) ($me['email'] ?? ''), 'verified' => false, 'name' => (string) ($me['name'] ?? '')];
    }

    private static function metaKey(string $provider): string
    {
        return 'bgr_' . $provider . '_id';
    }

    private static function findOrCreate(string $provider, array $profile): int|WP_Error
    {
        $found = get_users([
            'blog_id' => 0,
            'meta_key' => self::metaKey($provider),
            'meta_value' => $profile['subject'],
            'number' => 1,
            'fields' => 'ID',
        ]);
        if ($found) {
            return (int) $found[0];
        }

        $email = sanitize_email($profile['email']);
        $existing = $email !== '' ? get_user_by('email', $email) : false;
        if ($existing) {
            if (!$profile['verified']) {
                return new WP_Error('bgr_social', I18n::t('server.social.emailUsed'), ['status' => 409]);
            }
            update_user_meta($existing->ID, self::metaKey($provider), $profile['subject']);
            return (int) $existing->ID;
        }

        $userId = wp_insert_user([
            'user_login' => self::username($profile),
            'user_email' => $email,
            'user_pass' => wp_generate_password(32, true, true),
            'display_name' => $profile['name'] !== '' ? mb_substr(sanitize_text_field($profile['name']), 0, 60) : '',
            'role' => get_option('default_role', 'subscriber'),
            'show_admin_bar_front' => 'false',
        ]);
        if (is_wp_error($userId)) {
            return new WP_Error('bgr_social', I18n::t('server.social.createFailed'), ['status' => 400]);
        }
        update_user_meta($userId, self::metaKey($provider), $profile['subject']);
        return (int) $userId;
    }

    private static function username(array $profile): string
    {
        $base = sanitize_user(strstr($profile['email'], '@', true) ?: remove_accents($profile['name']), true);
        $base = substr(preg_replace('/[^a-z0-9_.-]/i', '', $base) ?: 'player', 0, 40);
        $name = $base;
        for ($i = 2; username_exists($name); $i++) {
            $name = $base . $i;
        }
        return $name;
    }
}
