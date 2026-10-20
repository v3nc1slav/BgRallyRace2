<?php
$_SERVER['HTTP_HOST'] = getenv('BGR_HOST') ?: 'bg-race.local';
$_SERVER['REQUEST_URI'] = '/';
require (getenv('BGR_WP_ROOT') ?: 'C:/Users/Admin/Local Sites/bg-race/app/public') . '/wp-load.php';

$settings = get_option(BgRally\Settings::OPTION, []);
$defaults = BgRally\Settings::defaults();
$old = [];
foreach (array_slice($argv, 1) as $pair) {
    [$key, $value] = explode('=', $pair, 2);
    $old[$key] = $settings[$key] ?? $defaults[$key];
    $settings[$key] = (float) $value;
}
update_option(BgRally\Settings::OPTION, $settings);
echo json_encode($old);
