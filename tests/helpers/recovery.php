<?php
$_SERVER['HTTP_HOST'] = getenv('BGR_HOST') ?: 'bg-race.local';
$_SERVER['REQUEST_URI'] = '/';
require (getenv('BGR_WP_ROOT') ?: 'C:/Users/Admin/Local Sites/bg-race/app/public') . '/wp-load.php';

$mails = [];
add_filter('pre_wp_mail', function ($result, array $mail) use (&$mails) {
    $mails[] = $mail;
    return true;
}, 10, 2);

switch ($argv[1] ?? '') {
    case 'forgot':
        BgRally\Auth\Recovery::forgot((string) $argv[2]);
        break;
    case 'confirm':
        BgRally\Auth\Recovery::sendConfirmation(get_userdata((int) $argv[2]));
        break;
    case 'social':
        $method = new ReflectionMethod(BgRally\Auth\Social::class, 'findOrCreate');
        $result = $method->invoke(null, 'google', ['subject' => (string) $argv[2], 'email' => (string) $argv[3], 'verified' => true, 'name' => 'Test']);
        echo wp_json_encode(is_wp_error($result) ? ['error' => $result->get_error_message()] : ['user' => $result]);
        exit;
}
BgRally\Auth\Recovery::send();
echo wp_json_encode($mails);
