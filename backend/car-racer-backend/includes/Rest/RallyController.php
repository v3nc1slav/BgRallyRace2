<?php

namespace BgRally\Rest;

use BgRally\Game\Rallies;
use WP_REST_Request;

final class RallyController
{
    public static function index()
    {
        return Auth::respond(Rallies::list(Auth::manager()));
    }

    public static function show(WP_REST_Request $request)
    {
        $rally = Rallies::detail(Auth::manager(), (int) $request['id']);
        return is_wp_error($rally) ? $rally : Auth::respond(['rally' => $rally]);
    }

    public static function register(WP_REST_Request $request)
    {
        return self::act($request, Rallies::register(Auth::manager(), (int) $request['id'], (array) $request->get_param('styles'), (array) $request->get_param('spares')));
    }

    public static function styles(WP_REST_Request $request)
    {
        return self::act($request, Rallies::setStyles(Auth::manager(), (int) $request['id'], (array) $request->get_param('styles'), (array) $request->get_param('spares')));
    }

    public static function recon(WP_REST_Request $request)
    {
        return self::act($request, Rallies::recon(Auth::manager(), (int) $request['id']));
    }

    public static function standings(WP_REST_Request $request)
    {
        return Auth::respond(Rallies::standings((int) Auth::manager()['id'], absint($request->get_param('season'))));
    }

    private static function act(WP_REST_Request $request, $result)
    {
        if (is_wp_error($result)) {
            return $result;
        }
        return Auth::respond(['rally' => Rallies::detail(Auth::manager(), (int) $request['id'])], $result);
    }
}
