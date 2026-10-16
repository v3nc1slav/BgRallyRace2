<?php

namespace BgRally\Rest;

use BgRally\Catalog\Cities;
use BgRally\Game\Managers;
use WP_Error;
use WP_REST_Request;

final class AuthController
{
    public static function register(WP_REST_Request $request)
    {
        if (is_user_logged_in()) {
            return new WP_Error('bgr_logged_in', 'Вече сте влезли в профила си.', ['status' => 400]);
        }

        $rawUsername = trim((string) $request->get_param('username'));
        $username = sanitize_user($rawUsername, true);
        $email = sanitize_email((string) $request->get_param('email'));
        $password = (string) $request->get_param('password');
        $cityId = absint($request->get_param('city_id'));

        $fields = [];
        if ($username === '' || $username !== $rawUsername || !validate_username($username)) {
            $fields['username'] = 'Използвайте само латински букви, цифри и знаците _ . - @';
        } elseif (username_exists($username)) {
            $fields['username'] = 'Това потребителско име е заето.';
        }
        if (!is_email($email)) {
            $fields['email'] = 'Невалиден имейл.';
        } elseif (email_exists($email)) {
            $fields['email'] = 'Този имейл вече е регистриран.';
        }
        if (mb_strlen($password) < 8) {
            $fields['password'] = 'Паролата трябва да е поне 8 символа.';
        }
        if (!Cities::isActive($cityId)) {
            $fields['city_id'] = 'Изберете град.';
        }
        if ($fields) {
            return new WP_Error('bgr_invalid', 'Проверете въведените данни.', ['status' => 400, 'fields' => $fields]);
        }

        $userId = wp_insert_user([
            'user_login' => $username,
            'user_email' => $email,
            'user_pass' => $password,
            'role' => get_option('default_role', 'subscriber'),
            'show_admin_bar_front' => 'false',
        ]);
        if (is_wp_error($userId)) {
            return new WP_Error('bgr_register_failed', $userId->get_error_message(), ['status' => 400]);
        }

        Managers::create($userId, $cityId);

        self::captureLoginCookie();
        wp_set_auth_cookie($userId, true, is_ssl());
        wp_set_current_user($userId);

        return PlayerController::state();
    }

    public static function login(WP_REST_Request $request)
    {
        self::captureLoginCookie();

        $user = wp_signon([
            'user_login' => (string) $request->get_param('login'),
            'user_password' => (string) $request->get_param('password'),
            'remember' => (bool) $request->get_param('remember'),
        ], is_ssl());

        if (is_wp_error($user)) {
            $message = $user->get_error_code() === 'bgr_banned'
                ? $user->get_error_message()
                : 'Грешно потребителско име или парола.';
            return new WP_Error('bgr_login_failed', $message, ['status' => 401]);
        }

        wp_set_current_user($user->ID);
        return PlayerController::state();
    }

    public static function logout()
    {
        wp_logout();
        unset($_COOKIE[LOGGED_IN_COOKIE]);
        return PlayerController::state();
    }

    private static function captureLoginCookie(): void
    {
        add_action('set_logged_in_cookie', function (string $cookie) {
            $_COOKIE[LOGGED_IN_COOKIE] = $cookie;
        });
    }
}
