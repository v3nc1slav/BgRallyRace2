<?php

namespace BgRally\Rest;

use BgRally\Game\BlackTrack;
use BgRally\Game\Clothes;
use BgRally\Game\Mayor;
use BgRally\Game\Police;
use BgRally\Game\Sabotage;
use BgRally\Game\Staff;
use BgRally\Game\Training;
use BgRally\Game\Work;
use WP_REST_Request;

final class TownController
{
    public static function track()
    {
        return Auth::respond(['track' => Training::view(Auth::manager())]);
    }

    public static function trackTrain(WP_REST_Request $request)
    {
        $result = Training::official(Auth::manager(), absint($request->get_param('stage_id')));
        return is_wp_error($result) ? $result : Auth::respond(['track' => Training::view(Auth::manager())], $result);
    }

    public static function police()
    {
        return Auth::respond(['police' => Police::view(Auth::manager())]);
    }

    public static function bribe(WP_REST_Request $request)
    {
        $result = Police::bribe(Auth::manager(), (string) $request->get_param('institution'));
        return is_wp_error($result) ? $result : Auth::respond(['police' => Police::view(Auth::manager())], $result);
    }

    public static function report(WP_REST_Request $request)
    {
        $result = Sabotage::report(Auth::manager(), absint($request->get_param('rally_id')));
        return is_wp_error($result) ? $result : Auth::respond(['police' => Police::view(Auth::manager())], $result);
    }

    public static function black()
    {
        return Auth::respond(['black' => BlackTrack::view(Auth::manager())]);
    }

    public static function blackChallenge(WP_REST_Request $request)
    {
        return self::blackResult(BlackTrack::challenge(Auth::manager(), absint($request->get_param('stage_id')), absint($request->get_param('bet'))));
    }

    public static function blackAccept(WP_REST_Request $request)
    {
        return self::blackResult(BlackTrack::accept(Auth::manager(), absint($request->get_param('challenge_id'))));
    }

    public static function blackCancel(WP_REST_Request $request)
    {
        return self::blackResult(BlackTrack::cancel(Auth::manager(), absint($request->get_param('challenge_id'))));
    }

    public static function blackBot(WP_REST_Request $request)
    {
        return self::blackResult(BlackTrack::botRace(Auth::manager(), absint($request->get_param('stage_id')), absint($request->get_param('bet'))));
    }

    public static function blackTrain(WP_REST_Request $request)
    {
        return self::blackResult(Training::black(Auth::manager(), absint($request->get_param('stage_id'))));
    }

    public static function mall()
    {
        return self::mallView();
    }

    public static function fitness(WP_REST_Request $request)
    {
        $result = Staff::fitness(Auth::manager(), absint($request->get_param('staff_id')));
        return is_wp_error($result) ? $result : self::mallView($result);
    }

    private static function blackResult($result)
    {
        return is_wp_error($result) ? $result : Auth::respond(['black' => BlackTrack::view(Auth::manager())], $result);
    }

    private static function mallView(string $message = '')
    {
        $manager = Auth::manager();
        $crew = array_values(array_filter(Staff::list((int) $manager['id']), fn($member) => $member['physical'] !== null));
        return Auth::respond(['mall' => [
            'crew' => $crew,
            'energy' => \BgRally\Settings::int('fitness_energy'),
            'price' => \BgRally\Settings::int('fitness_price'),
            'gain' => \BgRally\Settings::int('fitness_gain'),
            'clothes' => Clothes::view($manager),
        ]], $message);
    }

    public static function buyClothes(WP_REST_Request $request)
    {
        $result = Clothes::buy(Auth::manager(), absint($request->get_param('id')));
        return is_wp_error($result) ? $result : self::mallView($result);
    }

    public static function wearClothes(WP_REST_Request $request)
    {
        $result = Clothes::wear(Auth::manager(), absint($request->get_param('item_id')));
        return is_wp_error($result) ? $result : self::mallView($result);
    }

    public static function hall()
    {
        return self::hallView();
    }

    public static function negotiate(WP_REST_Request $request)
    {
        $result = Mayor::negotiate(Auth::manager(), (string) $request->get_param('kind'));
        return is_wp_error($result) ? $result : self::hallView($result);
    }

    private static function hallView(string $message = '')
    {
        $manager = Auth::manager();
        return Auth::respond(['hall' => Mayor::view($manager) + ['bribe' => Police::view($manager)['mayor']]], $message);
    }

    public static function trackOwn()
    {
        $result = Training::own(Auth::manager());
        return is_wp_error($result) ? $result : Auth::respond(['track' => Training::view(Auth::manager())], $result);
    }

    public static function jobs()
    {
        return Auth::respond(['jobs' => Work::view(Auth::manager())]);
    }

    public static function takeJob(WP_REST_Request $request)
    {
        $result = Work::take(Auth::manager(), absint($request->get_param('id')));
        return is_wp_error($result) ? $result : Auth::respond(['jobs' => Work::view(Auth::manager())], $result);
    }

    public static function quitJob()
    {
        $result = Work::quit(Auth::manager());
        return is_wp_error($result) ? $result : Auth::respond(['jobs' => Work::view(Auth::manager())], $result);
    }
}
