<?php

namespace BgRally\Rest;

use BgRally\Game\Push;
use BgRally\I18n;
use WP_REST_Request;

final class NotifyController
{
    private static function view(string $message = '')
    {
        return Auth::respond(['notifications' => Push::view(Auth::manager())], $message);
    }

    public static function show()
    {
        return self::view();
    }

    public static function preferences(WP_REST_Request $request)
    {
        Push::setPreferences(Auth::manager(), (array) $request->get_param('on'));
        return self::view(I18n::t('server.notify.saved'));
    }

    public static function addDevice(WP_REST_Request $request)
    {
        $result = Push::addDevice(get_current_user_id(), (string) $request->get_param('token'), (string) $request->get_param('platform'));
        return is_wp_error($result) ? $result : self::view(I18n::t('server.notify.on'));
    }

    public static function removeDevice(WP_REST_Request $request)
    {
        Push::removeDevice(get_current_user_id(), (string) $request->get_param('token'));
        return self::view(I18n::t('server.notify.off'));
    }
}
