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

foreach (BgRally\Catalog\Registry::entities() as $entity) {
    $page = new BgRally\Admin\CrudPage($entity);
    $_GET = [];
    ob_start();
    $page->render();
    $list = ob_get_clean();
    $_GET = ['view' => 'new'];
    ob_start();
    $page->render();
    $form = ob_get_clean();
    $first = $entity->all()[0]['id'] ?? 0;
    $_GET = ['view' => 'edit', 'id' => $first];
    ob_start();
    $page->render();
    $edit = ob_get_clean();
    printf("%-8s list %6d  new %6d  edit %6d  rows %d\n", $entity->slug, strlen($list), strlen($form), strlen($edit), substr_count($list, '<tr>') - 1);
}
$_GET = [];
ob_start(); BgRally\Admin\PlayersPage::render(); echo 'players  ', strlen(ob_get_clean()), "\n";
ob_start(); BgRally\Admin\SettingsPage::render(); $settings = ob_get_clean(); echo 'settings ', strlen($settings), ' fields ', substr_count($settings, 'type="number"'), "\n";
echo 'cron next: ', wp_next_scheduled('bgr_tick') ? 'scheduled' : 'missing', "\n";
ob_start(); BgRally\Admin\LevelsPage::render(); $levels = ob_get_clean(); echo 'levels   ', strlen($levels), ' fields ', substr_count($levels, 'type="number"'), "\n";
