<?php

namespace BgRally\Rest;

use BgRally\Game\Managers;
use BgRally\I18n;
use WP_Error;

final class Auth
{
    private const LOCK_SECONDS = 5;

    public static function player(): bool|WP_Error
    {
        if (!is_user_logged_in()) {
            return new WP_Error('bgr_auth', I18n::t('server.auth.login'), ['status' => 401]);
        }
        if (!self::manager()) {
            return new WP_Error('bgr_no_player', I18n::t('server.auth.noPlayer'), ['status' => 403]);
        }
        return true;
    }

    public static function exclusive(callable $action): mixed
    {
        global $wpdb;
        $lock = $wpdb->prefix . 'bgr_user_' . get_current_user_id();
        if ((int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, %d)', $lock, self::LOCK_SECONDS)) !== 1) {
            return new WP_Error('bgr_busy', I18n::t('server.common.busy'), ['status' => 409]);
        }
        try {
            return $action();
        } finally {
            $wpdb->query($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
        }
    }

    public static function manager(): ?array
    {
        return Managers::findByUser(get_current_user_id());
    }

    public static function respond(array $data = [], string $message = ''): array
    {
        $manager = self::manager();
        return $data + ['message' => $message, 'player' => $manager ? Managers::toApi($manager) : null];
    }
}
