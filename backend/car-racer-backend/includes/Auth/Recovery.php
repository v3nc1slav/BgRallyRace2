<?php

namespace BgRally\Auth;

use BgRally\Database\Tables;
use BgRally\Frontend;
use BgRally\I18n;
use WP_Error;
use WP_User;

final class Recovery
{
    public const MAIL_ERROR = 'bgr_mail_error';
    private const CONFIRMED = 'bgr_email_confirmed';
    private const CONFIRM_DAYS = 7;
    private const MIN_LENGTH = 8;

    private static array $outbox = [];

    public static function register(): void
    {
        add_action('shutdown', [self::class, 'send']);
        add_action('wp_mail_failed', [self::class, 'failed']);
    }

    private static function lang(int $userId): string
    {
        global $wpdb;
        $lang = $wpdb->get_var($wpdb->prepare('SELECT lang FROM ' . Tables::name('managers') . ' WHERE user_id = %d', $userId));
        return $lang ? I18n::of((string) $lang) : I18n::lang();
    }

    private static function name(WP_User $user): string
    {
        return $user->display_name !== '' ? $user->display_name : $user->user_login;
    }

    private static function queue(WP_User $user, string $kind, string $link): void
    {
        $lang = self::lang($user->ID);
        self::$outbox[] = [
            'to' => $user->user_email,
            'subject' => I18n::t('server.mail.' . $kind . 'Subject', [], $lang),
            'body' => I18n::t('server.mail.' . $kind . 'Body', ['name' => self::name($user), 'link' => $link], $lang),
        ];
    }

    public static function send(): void
    {
        if (!self::$outbox) {
            return;
        }
        $outbox = self::$outbox;
        self::$outbox = [];
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
        foreach ($outbox as $mail) {
            wp_mail($mail['to'], $mail['subject'], $mail['body']);
        }
    }

    public static function failed(WP_Error $error): void
    {
        update_option(self::MAIL_ERROR, ['at' => time(), 'message' => mb_substr($error->get_error_message(), 0, 200)], false);
    }

    public static function forgot(string $login): void
    {
        $login = trim($login);
        $user = is_email($login) ? get_user_by('email', $login) : get_user_by('login', $login);
        $due = Guard::mailDue($user ? $user->user_login : '');
        if (!$user || !$due || $user->user_email === '') {
            return;
        }
        $key = get_password_reset_key($user);
        if (!is_wp_error($key)) {
            self::queue($user, 'reset', Frontend::gameUrl() . '#/reset?' . http_build_query(['login' => $user->user_login, 'key' => $key]));
        }
    }

    private static function tooShort(string $password): ?WP_Error
    {
        if (mb_strlen($password) >= self::MIN_LENGTH) {
            return null;
        }
        $text = I18n::t('server.auth.password');
        return new WP_Error('bgr_invalid', $text, ['status' => 400, 'fields' => ['password' => $text]]);
    }

    private static function store(int $userId, string $password): void
    {
        wp_set_password($password, $userId);
        Tokens::revokeAll($userId);
    }

    public static function reset(string $login, string $key, string $password): true|WP_Error
    {
        $user = check_password_reset_key($key, $login);
        if (is_wp_error($user)) {
            return new WP_Error('bgr_reset', I18n::t('server.auth.resetInvalid'), ['status' => 400]);
        }
        $short = self::tooShort($password);
        if ($short) {
            return $short;
        }
        self::store($user->ID, $password);
        self::markConfirmed($user);
        return true;
    }

    public static function change(int $userId, string $current, string $password): true|WP_Error
    {
        $user = get_userdata($userId);
        $checked = $user ? wp_authenticate($user->user_login, $current) : null;
        if (is_wp_error($checked) && $checked->get_error_code() === 'bgr_locked') {
            return $checked;
        }
        if (!$checked instanceof WP_User) {
            $text = I18n::t('server.auth.wrongCurrent');
            return new WP_Error('bgr_password', $text, ['status' => 400, 'fields' => ['current' => $text]]);
        }
        $short = self::tooShort($password);
        if ($short) {
            return $short;
        }
        self::store($userId, $password);
        return true;
    }

    private static function signature(WP_User $user, int $expires): string
    {
        return hash_hmac('sha256', $user->ID . '|' . strtolower($user->user_email) . '|' . $expires, wp_salt('nonce'));
    }

    public static function sendConfirmation(WP_User $user): void
    {
        if ($user->user_email === '') {
            return;
        }
        $expires = time() + self::CONFIRM_DAYS * DAY_IN_SECONDS;
        self::queue($user, 'confirm', Frontend::gameUrl() . '#/confirm?' . http_build_query(['id' => $user->ID, 'exp' => $expires, 'sig' => self::signature($user, $expires)]));
    }

    public static function resend(int $userId): true|WP_Error
    {
        $user = get_userdata($userId);
        if (!$user || self::isConfirmed($userId)) {
            return new WP_Error('bgr_confirmed', I18n::t('server.auth.alreadyConfirmed'), ['status' => 400]);
        }
        $limited = Guard::mailLimit();
        if ($limited) {
            return $limited;
        }
        if (Guard::mailDue($user->user_login)) {
            self::sendConfirmation($user);
        }
        return true;
    }

    public static function confirm(int $userId, int $expires, string $signature): true|WP_Error
    {
        $user = get_userdata($userId);
        if (!$user || $expires < time() || !hash_equals(self::signature($user, $expires), $signature)) {
            return new WP_Error('bgr_confirm', I18n::t('server.auth.confirmInvalid'), ['status' => 400]);
        }
        self::markConfirmed($user);
        return true;
    }

    public static function markConfirmed(WP_User $user): void
    {
        update_user_meta($user->ID, self::CONFIRMED, strtolower($user->user_email));
    }

    public static function isConfirmed(int $userId): bool
    {
        $user = get_userdata($userId);
        return $user && $user->user_email !== '' && get_user_meta($userId, self::CONFIRMED, true) === strtolower($user->user_email);
    }
}
