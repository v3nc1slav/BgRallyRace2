<?php
$_SERVER['HTTP_HOST'] = getenv('BGR_HOST') ?: 'bg-race.local';
$_SERVER['REQUEST_URI'] = '/';
require (getenv('BGR_WP_ROOT') ?: 'C:/Users/Admin/Local Sites/bg-race/app/public') . '/wp-load.php';

switch ($argv[1] ?? '') {
    case 'locks':
        echo wp_json_encode(BgRally\Auth\Guard::locks());
        break;
    case 'clear':
        BgRally\Auth\Guard::clear((string) $argv[2]);
        echo 'ok';
        break;
}
