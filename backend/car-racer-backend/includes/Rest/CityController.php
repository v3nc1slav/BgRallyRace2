<?php

namespace BgRally\Rest;

use BgRally\Game\Bar;
use BgRally\Game\Inbox;
use BgRally\Game\Privileges;
use BgRally\Game\Sponsors;
use WP_REST_Request;

final class CityController
{
    public static function bar()
    {
        return Auth::respond(['bar' => Bar::view(Auth::manager())]);
    }

    public static function hire(WP_REST_Request $request)
    {
        $result = Bar::hire(Auth::manager(), absint($request->get_param('candidate_id')));
        if (is_wp_error($result)) {
            return $result;
        }
        return Auth::respond(['bar' => Bar::view(Auth::manager())], $result);
    }

    public static function sponsors()
    {
        return Auth::respond(['sponsors' => Sponsors::view(Auth::manager())]);
    }

    public static function negotiate(WP_REST_Request $request)
    {
        $result = Sponsors::negotiate(Auth::manager(), (int) $request['id']);
        if (is_wp_error($result)) {
            return $result;
        }
        return Auth::respond(['sponsors' => Sponsors::view(Auth::manager())], $result);
    }

    public static function city()
    {
        $manager = Auth::manager();
        return Auth::respond(['city' => [
            'name' => $manager['city'] ?? '',
            'privileges' => Privileges::describe((int) $manager['city_id']),
        ]]);
    }

    public static function inbox()
    {
        return Auth::respond(['inbox' => Inbox::latest((int) Auth::manager()['id'])]);
    }
}
