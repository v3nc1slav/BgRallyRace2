<?php
define('WP_ADMIN', true);
$_SERVER['HTTP_HOST'] = getenv('BGR_HOST') ?: 'bg-race.local';
$_SERVER['REQUEST_URI'] = '/wp-admin/admin.php';
$_SERVER['REQUEST_METHOD'] = 'GET';
require (getenv('BGR_WP_ROOT') ?: 'C:/Users/Admin/Local Sites/bg-race/app/public') . '/wp-load.php';
require_once ABSPATH . 'wp-admin/includes/admin.php';
error_reporting(E_ALL);
ini_set('display_errors', '1');
wp_set_current_user(1);
foreach ([[], ['filter' => 'all']] as $get) {
    $_GET = $get;
    ob_start(); BgRally\Admin\TalkPage::render(); $html = ob_get_clean();
    echo 'talk ', $get ? 'all' : 'reported', ' ', strlen($html), ' rows ', substr_count($html, '<tr>') - 1, "\n";
}
$_GET = [];
ob_start(); BgRally\Admin\PlayersPage::render(); $html = ob_get_clean();
echo 'players ', strlen($html), ' mute forms ', substr_count($html, 'bgr_talk_mute'), "\n";
ob_start(); BgRally\Admin\SettingsPage::render(); $html = ob_get_clean();
echo 'settings ', strlen($html), ' bank ', substr_count($html, 'loan_'), "\n";
