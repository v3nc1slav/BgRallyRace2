<?php
$_SERVER['HTTP_HOST'] = getenv('BGR_HOST') ?: 'bg-race.local';
$_SERVER['REQUEST_URI'] = '/';
require (getenv('BGR_WP_ROOT') ?: 'C:/Users/Admin/Local Sites/bg-race/app/public') . '/wp-load.php';

$name = $argv[1];
$value = $argv[2] ?? '';
echo json_encode(get_option($name, null));
if ($value === 'delete') {
    delete_option($name);
} elseif ($value !== '') {
    update_option($name, json_decode($value, true), false);
}
