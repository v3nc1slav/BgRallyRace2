<?php

namespace BgRally\Rest;

use BgRally\Game\Ads;
use WP_REST_Request;

final class AdsController
{
    public static function show()
    {
        return Auth::respond(['ads' => Ads::view(Auth::manager())]);
    }

    public static function start(WP_REST_Request $request)
    {
        $result = Ads::start(Auth::manager(), (string) $request->get_param('reward'));
        return is_wp_error($result) ? $result : ['ad' => $result];
    }

    public static function claim(WP_REST_Request $request)
    {
        $result = Ads::claim(Auth::manager(), absint($request->get_param('view_id')), (string) $request->get_param('token'));
        return is_wp_error($result) ? $result : Auth::respond(['ads' => Ads::view(Auth::manager())], $result);
    }
}
