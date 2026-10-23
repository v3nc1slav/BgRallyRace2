<?php
$_SERVER['HTTP_HOST'] = getenv('BGR_HOST') ?: 'bg-race.local';
$_SERVER['REQUEST_URI'] = '/';
require (getenv('BGR_WP_ROOT') ?: 'C:/Users/Admin/Local Sites/bg-race/app/public') . '/wp-load.php';

switch ($argv[1] ?? '') {
    case 'mark':
        BgRally\Game\Inactivity::mark();
        break;
    case 'payroll':
        BgRally\Game\Payroll::process(BgRally\Game\Managers::find((int) $argv[2]));
        break;
    case 'daily':
        BgRally\Game\Work::runDaily();
        break;
    case 'expire':
        BgRally\Game\Sponsors::expire();
        break;
}
echo 'ok';
