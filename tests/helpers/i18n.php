<?php
$_SERVER['HTTP_HOST'] = getenv('BGR_HOST') ?: 'bg-race.local';
$_SERVER['REQUEST_URI'] = '/';
require (getenv('BGR_WP_ROOT') ?: 'C:/Users/Admin/Local Sites/bg-race/app/public') . '/wp-load.php';

use BgRally\I18n;

switch ($argv[1] ?? '') {
    case 'render':
        $stored = I18n::encode(
            I18n::msg('server.chronicle.start', ['rally' => ['name', 'Рали София'], 'count' => 8, 'weather' => ['label', 'WEATHER', 'rain', true]]),
            I18n::text('{пилот} сгреши на {завой} завой и загуби {секунди} сек.', ['pilot' => 'Иван', 'turn' => ['ordinal', 2], 'seconds' => 7]),
            I18n::msg('server.chronicle.stage', ['seq' => 1, 'stage' => ['name', 'Плана'], 'class' => ['class', 3], 'pilot' => 'Иван', 'time' => '9:01.2'])
        );
        echo wp_json_encode(['bg' => I18n::render($stored, 'bg'), 'en' => I18n::render($stored, 'en'), 'plain' => I18n::render('Стар текст', 'en')], JSON_UNESCAPED_UNICODE);
        break;
    case 'rumor':
        BgRally\Game\Rumors::add((int) $argv[2], 'fined', ['money' => ['money', 300], 'team' => 'X']);
        global $wpdb;
        echo (int) $wpdb->insert_id;
        break;
}
