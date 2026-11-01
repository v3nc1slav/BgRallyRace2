<?php
$_SERVER['HTTP_HOST'] = getenv('BGR_HOST') ?: 'bg-race.local';
$_SERVER['REQUEST_URI'] = '/';
require (getenv('BGR_WP_ROOT') ?: 'C:/Users/Admin/Local Sites/bg-race/app/public') . '/wp-load.php';

global $wpdb;
$current = get_option('bgr_db_version');
$lock = $wpdb->prefix . 'bgr_upgrade';
$other = new wpdb(DB_USER, DB_PASSWORD, DB_NAME, DB_HOST);
$result = [];

update_option('bgr_db_version', 'old');
$other->get_var($other->prepare('SELECT GET_LOCK(%s, 0)', $lock));
BgRally\Database\Schema::maybeUpgrade();
$result['while_locked'] = get_option('bgr_db_version');
$other->get_var($other->prepare('SELECT RELEASE_LOCK(%s)', $lock));
update_option('bgr_db_version', 'old');
BgRally\Database\Schema::maybeUpgrade();
$result['after_release'] = get_option('bgr_db_version');
$result['current'] = $current;

echo wp_json_encode($result);
