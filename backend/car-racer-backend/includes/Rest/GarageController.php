<?php

namespace BgRally\Rest;

use BgRally\Game\Garage;
use BgRally\Game\Shop;
use BgRally\Game\Staff;
use WP_REST_Request;

final class GarageController
{
    public static function show()
    {
        $manager = Auth::manager();
        Garage::ensureStarterPack((int) $manager['id']);
        return self::garage();
    }

    public static function mount(WP_REST_Request $request)
    {
        return self::act(Garage::mount(Auth::manager(), absint($request->get_param('item_id'))));
    }

    public static function repair(WP_REST_Request $request)
    {
        return self::act(Garage::repair(Auth::manager(), absint($request->get_param('item_id'))));
    }

    public static function upgrade()
    {
        return self::act(Garage::upgrade(Auth::manager()));
    }

    public static function activeCar(WP_REST_Request $request)
    {
        return self::act(Garage::setActiveCar(Auth::manager(), absint($request->get_param('player_car_id'))));
    }

    public static function fire(WP_REST_Request $request)
    {
        return self::act(Staff::fire((int) Auth::manager()['id'], absint($request->get_param('staff_id'))));
    }

    public static function shop()
    {
        return Auth::respond(Shop::catalog(Auth::manager()));
    }

    public static function buy(WP_REST_Request $request)
    {
        $kind = in_array($request->get_param('kind'), ['tyre', 'spare_tyre'], true) ? $request->get_param('kind') : 'part';
        $result = Garage::buy(Auth::manager(), $kind, absint($request->get_param('id')));
        if (is_wp_error($result)) {
            return $result;
        }
        return Auth::respond([], 'Купено. Ще го намериш в склада на гаража.');
    }

    public static function buyCar(WP_REST_Request $request)
    {
        $result = Garage::buyCar(Auth::manager(), absint($request->get_param('id')));
        if (is_wp_error($result)) {
            return $result;
        }
        return Auth::respond(Shop::catalog(Auth::manager()), $result);
    }

    private static function act($result)
    {
        return is_wp_error($result) ? $result : self::garage($result);
    }

    private static function garage(string $message = '')
    {
        return Auth::respond(['garage' => Garage::view(Auth::manager())], $message);
    }
}
