<?php

namespace BgRally\Auth;

use BgRally\Game\Managers;
use BgRally\I18n;
use WP_Error;
use WP_User;

final class Bans
{
    public static function register(): void
    {
        add_filter('authenticate', [self::class, 'blockLogin'], 100);
    }

    public static function blockLogin($user)
    {
        if ($user instanceof WP_User && Managers::isBannedUser($user->ID)) {
            return new WP_Error('bgr_banned', I18n::t('server.auth.banned'));
        }
        return $user;
    }
}
