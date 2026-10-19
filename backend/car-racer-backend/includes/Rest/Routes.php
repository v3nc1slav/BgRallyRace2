<?php

namespace BgRally\Rest;

final class Routes
{
    public const NAMESPACE = 'bgrally/v1';

    public static function register(): void
    {
        $public = '__return_true';
        $loggedIn = 'is_user_logged_in';
        $player = [Auth::class, 'player'];
        $rally = '/rallies/(?P<id>\d+)';

        self::route('/auth/register', 'POST', [AuthController::class, 'register'], $public);
        self::route('/auth/login', 'POST', [AuthController::class, 'login'], $public);
        self::route('/auth/logout', 'POST', [AuthController::class, 'logout'], $loggedIn);
        self::route('/me', 'GET', [PlayerController::class, 'me'], $public);
        self::route('/player', 'POST', [PlayerController::class, 'create'], $loggedIn);
        self::route('/cities', 'GET', [CatalogController::class, 'cities'], $public);

        self::route('/garage', 'GET', [GarageController::class, 'show'], $player);
        self::route('/garage/mount', 'POST', [GarageController::class, 'mount'], $player);
        self::route('/garage/repair', 'POST', [GarageController::class, 'repair'], $player);
        self::route('/garage/upgrade', 'POST', [GarageController::class, 'upgrade'], $player);
        self::route('/garage/active', 'POST', [GarageController::class, 'activeCar'], $player);
        self::route('/staff/fire', 'POST', [GarageController::class, 'fire'], $player);
        self::route('/shop', 'GET', [GarageController::class, 'shop'], $player);
        self::route('/shop/buy', 'POST', [GarageController::class, 'buy'], $player);
        self::route('/shop/buy-car', 'POST', [GarageController::class, 'buyCar'], $player);

        self::route('/bar', 'GET', [CityController::class, 'bar'], $player);
        self::route('/bar/hire', 'POST', [CityController::class, 'hire'], $player);
        self::route('/sponsors', 'GET', [CityController::class, 'sponsors'], $player);
        self::route('/sponsors/(?P<id>\d+)/negotiate', 'POST', [CityController::class, 'negotiate'], $player);
        self::route('/inbox', 'GET', [CityController::class, 'inbox'], $player);
        self::route('/city', 'GET', [CityController::class, 'city'], $player);

        self::route('/track', 'GET', [TownController::class, 'track'], $player);
        self::route('/track/train', 'POST', [TownController::class, 'trackTrain'], $player);
        self::route('/police', 'GET', [TownController::class, 'police'], $player);
        self::route('/police/bribe', 'POST', [TownController::class, 'bribe'], $player);
        self::route('/black', 'GET', [TownController::class, 'black'], $player);
        self::route('/black/challenge', 'POST', [TownController::class, 'blackChallenge'], $player);
        self::route('/black/accept', 'POST', [TownController::class, 'blackAccept'], $player);
        self::route('/black/cancel', 'POST', [TownController::class, 'blackCancel'], $player);
        self::route('/black/bot', 'POST', [TownController::class, 'blackBot'], $player);
        self::route('/black/train', 'POST', [TownController::class, 'blackTrain'], $player);
        self::route('/mall', 'GET', [TownController::class, 'mall'], $player);
        self::route('/mall/fitness', 'POST', [TownController::class, 'fitness'], $player);
        self::route('/mall/buy', 'POST', [TownController::class, 'buyClothes'], $player);
        self::route('/mall/wear', 'POST', [TownController::class, 'wearClothes'], $player);
        self::route('/hall', 'GET', [TownController::class, 'hall'], $player);
        self::route('/hall/negotiate', 'POST', [TownController::class, 'negotiate'], $player);
        self::route('/track/own', 'POST', [TownController::class, 'trackOwn'], $player);
        self::route('/jobs', 'GET', [TownController::class, 'jobs'], $player);
        self::route('/jobs/take', 'POST', [TownController::class, 'takeJob'], $player);
        self::route('/jobs/quit', 'POST', [TownController::class, 'quitJob'], $player);

        self::route('/market', 'GET', [TradeController::class, 'market'], $player);
        self::route('/market/list', 'POST', [TradeController::class, 'listItem'], $player);
        self::route('/market/cancel', 'POST', [TradeController::class, 'cancel'], $player);
        self::route('/market/buy', 'POST', [TradeController::class, 'buy'], $player);
        self::route('/market/dealer', 'POST', [TradeController::class, 'dealer'], $player);
        self::route('/bank', 'GET', [TradeController::class, 'bank'], $player);
        self::route('/bank/loan', 'POST', [TradeController::class, 'loan'], $player);
        self::route('/bank/repay', 'POST', [TradeController::class, 'repay'], $player);
        self::route('/bank/pay', 'POST', [TradeController::class, 'payOverdue'], $player);

        self::route('/ads', 'GET', [AdsController::class, 'show'], $player);
        self::route('/ads/start', 'POST', [AdsController::class, 'start'], $player);
        self::route('/ads/claim', 'POST', [AdsController::class, 'claim'], $player);

        self::route('/chat', 'GET', [TalkController::class, 'chat'], $player);
        self::route('/chat', 'POST', [TalkController::class, 'say'], $player);
        self::route('/talk/report', 'POST', [TalkController::class, 'report'], $player);
        self::route('/forum', 'GET', [TalkController::class, 'forum'], $player);
        self::route('/forum/topics', 'POST', [TalkController::class, 'createTopic'], $player);
        self::route('/forum/topics/(?P<id>\d+)', 'GET', [TalkController::class, 'topic'], $player);
        self::route('/forum/topics/(?P<id>\d+)/reply', 'POST', [TalkController::class, 'reply'], $player);

        self::route('/rallies', 'GET', [RallyController::class, 'index'], $player);
        self::route($rally, 'GET', [RallyController::class, 'show'], $player);
        self::route($rally . '/register', 'POST', [RallyController::class, 'register'], $player);
        self::route($rally . '/styles', 'POST', [RallyController::class, 'styles'], $player);
        self::route($rally . '/recon', 'POST', [RallyController::class, 'recon'], $player);
        self::route($rally . '/sabotage', 'POST', [RallyController::class, 'sabotage'], $player);
        self::route('/police/report', 'POST', [TownController::class, 'report'], $player);
        self::route('/standings', 'GET', [RallyController::class, 'standings'], $player);
    }

    private static function route(string $path, string $method, callable $callback, callable $permission): void
    {
        register_rest_route(self::NAMESPACE, $path, [
            'methods' => $method,
            'callback' => $callback,
            'permission_callback' => $permission,
        ]);
    }
}
