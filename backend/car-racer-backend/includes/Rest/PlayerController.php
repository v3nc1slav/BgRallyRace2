<?php

namespace BgRally\Rest;

use BgRally\Auth\Social;
use BgRally\Catalog\Cities;
use BgRally\Pages;
use BgRally\Game\Managers;
use WP_Error;
use WP_REST_Request;

final class PlayerController
{
    public static function state(): array
    {
        $user = wp_get_current_user();
        $manager = $user->exists() ? Managers::findByUser($user->ID) : null;

        return [
            'user' => $user->exists() ? ['id' => $user->ID, 'name' => $user->display_name] : null,
            'player' => $manager ? Managers::toApi($manager) : null,
            'nonce' => wp_create_nonce('wp_rest'),
            'providers' => Social::providers(),
            'links' => Pages::links(),
        ];
    }

    public static function me()
    {
        return self::state();
    }

    public static function create(WP_REST_Request $request)
    {
        if (Managers::findByUser(get_current_user_id())) {
            return new WP_Error('bgr_player_exists', 'Вече имате профил на мениджър.', ['status' => 400]);
        }

        $cityId = absint($request->get_param('city_id'));
        if (!Cities::isActive($cityId)) {
            return new WP_Error('bgr_invalid', 'Изберете град.', ['status' => 400, 'fields' => ['city_id' => 'Изберете град.']]);
        }

        Managers::create(get_current_user_id(), $cityId);
        return self::state();
    }
}
