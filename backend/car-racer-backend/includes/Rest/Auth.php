<?php

namespace BgRally\Rest;

use BgRally\Game\Managers;
use BgRally\I18n;
use WP_Error;

final class Auth
{
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
