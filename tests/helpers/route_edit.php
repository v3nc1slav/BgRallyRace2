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
$entity = BgRally\Catalog\Registry::get('stages');
$page = new BgRally\Admin\CrudPage($entity);
$_GET = ['view' => 'edit', 'id' => 19];
ob_start();
$page->render();
$html = ob_get_clean();
echo 'editor present: ', str_contains($html, 'bgr-route-editor') ? 'yes' : 'no', "\n";
echo 'route json in form: ', preg_match('/&quot;points&quot;/', $html) ? 'yes' : 'no', "\n";
$field = null;
foreach ($entity->fields as $f) { if ($f->name === 'route') $field = $f; }
echo 'sanitize bad json: [', $field->sanitize('{"points":[[0.1]]}'), "]\n";
echo 'sanitize clamps: ', $field->sanitize('{"aspect":2,"points":[[-1,0.5],[2,0.3]],"labels":[{"name":"<b>Село</b>","x":0.5,"y":0.5}]}'), "\n";
echo 'list display: ', $field->display($entity->find(19)['route']), "\n";
