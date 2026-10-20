<?php

namespace BgRally\Rest;

use BgRally\Game\Bank;
use BgRally\Game\Finance;
use BgRally\Game\Market;
use WP_REST_Request;

final class TradeController
{
    public static function market(WP_REST_Request $request)
    {
        return self::marketView($request);
    }

    public static function listItem(WP_REST_Request $request)
    {
        $result = Market::list(Auth::manager(), (string) $request->get_param('kind'), absint($request->get_param('id')), absint($request->get_param('price')));
        return is_wp_error($result) ? $result : self::marketView($request, $result);
    }

    public static function cancel(WP_REST_Request $request)
    {
        $result = Market::cancel(Auth::manager(), absint($request->get_param('id')));
        return is_wp_error($result) ? $result : self::marketView($request, $result);
    }

    public static function buy(WP_REST_Request $request)
    {
        $result = Market::buy(Auth::manager(), absint($request->get_param('id')));
        return is_wp_error($result) ? $result : self::marketView($request, $result);
    }

    public static function dealer(WP_REST_Request $request)
    {
        $result = Market::dealer(Auth::manager(), (string) $request->get_param('kind'), absint($request->get_param('id')));
        return is_wp_error($result) ? $result : self::marketView($request, $result);
    }

    private static function marketView(WP_REST_Request $request, string $message = '')
    {
        $scope = $request->get_param('scope') === 'city' ? 'city' : 'all';
        return Auth::respond(['market' => Market::view(Auth::manager(), $scope, (string) $request->get_param('filter'))], $message);
    }

    public static function finance(WP_REST_Request $request)
    {
        $season = $request->get_param('season');
        return Auth::respond(['finance' => Finance::view(Auth::manager(), $season === null || $season === '' ? -1 : (int) $season)]);
    }

    public static function bank()
    {
        return Auth::respond(['bank' => Bank::view(Auth::manager())]);
    }

    public static function loan(WP_REST_Request $request)
    {
        return self::bankResult(Bank::take(Auth::manager(), absint($request->get_param('amount')), absint($request->get_param('weeks'))));
    }

    public static function repay()
    {
        return self::bankResult(Bank::repay(Auth::manager()));
    }

    public static function payOverdue()
    {
        return self::bankResult(Bank::payOverdue(Auth::manager()));
    }

    private static function bankResult($result)
    {
        return is_wp_error($result) ? $result : Auth::respond(['bank' => Bank::view(Auth::manager())], $result);
    }
}
