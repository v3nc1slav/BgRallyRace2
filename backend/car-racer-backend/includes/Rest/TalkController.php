<?php

namespace BgRally\Rest;

use BgRally\Game\Chat;
use BgRally\Game\Forum;
use BgRally\I18n;
use WP_REST_Request;

final class TalkController
{
    public static function chat(WP_REST_Request $request)
    {
        return ['chat' => Chat::view(Auth::manager(), absint($request->get_param('after')))];
    }

    public static function say(WP_REST_Request $request)
    {
        $manager = Auth::manager();
        $result = Chat::say($manager, (string) $request->get_param('text'));
        return is_wp_error($result) ? $result : ['chat' => Chat::view($manager, absint($request->get_param('after')))];
    }

    public static function report(WP_REST_Request $request)
    {
        $result = Chat::report(Auth::manager(), absint($request->get_param('id')));
        return is_wp_error($result) ? $result : ['message' => $result];
    }

    public static function forum(WP_REST_Request $request)
    {
        return ['forum' => Forum::index(Auth::manager(), (string) $request->get_param('section'))];
    }

    public static function topic(WP_REST_Request $request)
    {
        $result = Forum::topic(Auth::manager(), absint($request['id']), absint($request->get_param('page')) ?: 1);
        return is_wp_error($result) ? $result : ['topic' => $result];
    }

    public static function createTopic(WP_REST_Request $request)
    {
        $manager = Auth::manager();
        $id = Forum::create($manager, (string) $request->get_param('section'), (string) $request->get_param('title'), (string) $request->get_param('text'));
        return is_wp_error($id) ? $id : ['topic' => Forum::topic($manager, $id, 1), 'message' => I18n::t('server.forum.posted')];
    }

    public static function reply(WP_REST_Request $request)
    {
        $manager = Auth::manager();
        $id = absint($request['id']);
        $result = Forum::reply($manager, $id, (string) $request->get_param('text'));
        return is_wp_error($result) ? $result : ['topic' => Forum::topic($manager, $id, Forum::lastPage($id)), 'message' => $result];
    }
}
