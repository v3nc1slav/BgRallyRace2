<?php

namespace BgRally\Rest;

use BgRally\Game\Badges;
use BgRally\Game\Bar;
use BgRally\Game\Inbox;
use BgRally\Game\Mayor;
use BgRally\Game\Privileges;
use BgRally\Game\Rallies;
use BgRally\Game\Sponsors;
use BgRally\Settings;
use WP_REST_Request;

final class CityController
{
    public static function bar()
    {
        $manager = Auth::manager();
        Badges::seenBar($manager);
        return Auth::respond(['bar' => Bar::view($manager)]);
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
        $manager = Mayor::refreshTrack(Auth::manager());
        $total = Settings::int('track_weeks') * WEEK_IN_SECONDS;
        $left = $manager['track_ready_at'] ? max(0, strtotime($manager['track_ready_at']) - Rallies::now()) : 0;

        return Auth::respond(['city' => [
            'name' => $manager['city'] ?? '',
            'privileges' => Privileges::describe((int) $manager['city_id']),
            'perks' => Privileges::sentence((int) $manager['city_id']),
            'own_track' => [
                'status' => (string) $manager['track_status'],
                'ready_at' => $manager['track_ready_at'] ? str_replace(' ', 'T', $manager['track_ready_at']) : null,
                'progress' => $manager['track_status'] === 'building' && $total > 0 ? round(1 - $left / $total, 3) : ($manager['track_status'] === '' ? 0 : 1),
            ],
            'badges' => Badges::forManager($manager),
        ]]);
    }

    public static function inbox()
    {
        return Auth::respond(['inbox' => Inbox::latest((int) Auth::manager()['id'])]);
    }
}
