<?php

namespace BgRally\Database;

use BgRally\Catalog\Registry;

final class Schema
{
    private const VERSION = '15';
    private const OPTION = 'bgr_db_version';

    public static function maybeUpgrade(): void
    {
        if (get_option(self::OPTION) !== self::VERSION) {
            self::install();
        }
    }

    public static function install(): void
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset = $wpdb->get_charset_collate();
        $from = (string) get_option(self::OPTION, '');

        if ($from === '4') {
            self::repairEventsTable();
        }

        foreach (self::tables() as $name => $columns) {
            dbDelta("CREATE TABLE " . Tables::name($name) . " (\n$columns\n) $charset;");
        }

        foreach (Registry::entities() as $entity) {
            dbDelta($entity->createTableSql($charset));
        }

        Seeder::run($from);
        update_option(self::OPTION, self::VERSION);
    }

    private static function repairEventsTable(): void
    {
        global $wpdb;
        $table = Tables::name('events');
        $columns = $wpdb->get_col("SHOW COLUMNS FROM $table");

        foreach (['name', 'chance', 'penalty_min', 'penalty_max', 'surface', 'weather', 'part_type', 'active'] as $column) {
            if (in_array($column, $columns, true)) {
                $wpdb->query("ALTER TABLE $table DROP COLUMN $column");
            }
        }
    }

    private static function tables(): array
    {
        return [
            'managers' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  user_id bigint(20) unsigned NOT NULL,
  city_id bigint(20) unsigned NOT NULL,
  money bigint(20) NOT NULL DEFAULT 0,
  xp bigint(20) unsigned NOT NULL DEFAULT 0,
  level smallint(5) unsigned NOT NULL DEFAULT 1,
  energy smallint(5) unsigned NOT NULL DEFAULT 0,
  energy_date date DEFAULT NULL,
  garage_level smallint(5) unsigned NOT NULL DEFAULT 1,
  active_car_id bigint(20) unsigned NOT NULL DEFAULT 0,
  payroll_week varchar(10) NOT NULL DEFAULT '',
  training_date date DEFAULT NULL,
  job_id bigint(20) unsigned NOT NULL DEFAULT 0,
  job_season int(11) NOT NULL DEFAULT 0,
  job_date date DEFAULT NULL,
  track_status varchar(10) NOT NULL DEFAULT '',
  track_ready_at datetime DEFAULT NULL,
  track_ban_season int(11) NOT NULL DEFAULT 0,
  banned_at datetime DEFAULT NULL,
  ban_reason varchar(255) NOT NULL DEFAULT '',
  muted_until datetime DEFAULT NULL,
  ad_retry tinyint(1) NOT NULL DEFAULT 0,
  shop_discount smallint(5) unsigned NOT NULL DEFAULT 0,
  notify_off varchar(100) NOT NULL DEFAULT '',
  city_season int(11) NOT NULL DEFAULT 0,
  xp_date date DEFAULT NULL,
  xp_today smallint(5) unsigned NOT NULL DEFAULT 0,
  tired_days smallint(5) unsigned NOT NULL DEFAULT 0,
  energy_pct smallint(5) unsigned NOT NULL DEFAULT 100,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY user_id (user_id),
  KEY city_id (city_id)",

            'ledger' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  manager_id bigint(20) unsigned NOT NULL,
  amount bigint(20) NOT NULL,
  balance bigint(20) NOT NULL,
  reason varchar(64) NOT NULL,
  note varchar(255) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY manager_id (manager_id)",

            'player_cars' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  manager_id bigint(20) unsigned NOT NULL,
  car_id bigint(20) unsigned NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY manager_id (manager_id)",

            'items' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  manager_id bigint(20) unsigned NOT NULL,
  kind varchar(10) NOT NULL,
  catalog_id bigint(20) unsigned NOT NULL,
  player_car_id bigint(20) unsigned NOT NULL DEFAULT 0,
  health double NOT NULL DEFAULT 100,
  max_health double NOT NULL DEFAULT 100,
  defect tinyint(1) NOT NULL DEFAULT 0,
  equipped tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY manager_id (manager_id),
  KEY player_car_id (player_car_id)",

            'staff' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  manager_id bigint(20) unsigned NOT NULL,
  role varchar(20) NOT NULL,
  name varchar(100) NOT NULL,
  skill smallint(5) unsigned NOT NULL DEFAULT 30,
  morale smallint(5) unsigned NOT NULL DEFAULT 70,
  reputation smallint(5) unsigned NOT NULL DEFAULT 20,
  physical smallint(5) unsigned NOT NULL DEFAULT 30,
  fitness_date date DEFAULT NULL,
  unpaid tinyint(1) NOT NULL DEFAULT 0,
  energy smallint(5) unsigned NOT NULL DEFAULT 0,
  energy_date date DEFAULT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY manager_id (manager_id)",

            'bots' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  name varchar(100) NOT NULL,
  class varchar(5) NOT NULL,
  car_id bigint(20) unsigned NOT NULL,
  skill smallint(5) unsigned NOT NULL DEFAULT 40,
  nav_skill smallint(5) unsigned NOT NULL DEFAULT 40,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY class (class)",

            'entries' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  rally_id bigint(20) unsigned NOT NULL,
  manager_id bigint(20) unsigned NOT NULL DEFAULT 0,
  bot_id bigint(20) unsigned NOT NULL DEFAULT 0,
  class varchar(5) NOT NULL,
  player_car_id bigint(20) unsigned NOT NULL DEFAULT 0,
  start_number int(11) NOT NULL DEFAULT 0,
  recon tinyint(1) NOT NULL DEFAULT 0,
  styles varchar(255) NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'registered',
  team_name varchar(100) NOT NULL DEFAULT '',
  pilot_name varchar(100) NOT NULL DEFAULT '',
  total_ms bigint(20) NOT NULL DEFAULT 0,
  dnf_stage int(11) NOT NULL DEFAULT 0,
  place int(11) NOT NULL DEFAULT 0,
  points int(11) NOT NULL DEFAULT 0,
  prize int(11) NOT NULL DEFAULT 0,
  xp int(11) NOT NULL DEFAULT 0,
  costs int(11) NOT NULL DEFAULT 0,
  wear text NULL,
  spares text NULL,
  effects text NULL,
  sabotage_report tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY rally_competitor (rally_id,manager_id,bot_id),
  KEY manager_id (manager_id)",

            'stage_times' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  rally_id bigint(20) unsigned NOT NULL,
  entry_id bigint(20) unsigned NOT NULL,
  stage_id bigint(20) unsigned NOT NULL,
  seq int(11) NOT NULL,
  start_s int(11) NOT NULL,
  time_ms int(11) NOT NULL,
  penalty_ms int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY  (id),
  KEY rally_id (rally_id),
  KEY entry_id (entry_id)",

            'events' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  rally_id bigint(20) unsigned NOT NULL,
  offset_s int(11) NOT NULL,
  entry_id bigint(20) unsigned NOT NULL DEFAULT 0,
  seq int(11) NOT NULL DEFAULT 0,
  type varchar(20) NOT NULL,
  penalty_s int(11) NOT NULL DEFAULT 0,
  text varchar(255) NOT NULL,
  PRIMARY KEY  (id),
  KEY rally_offset (rally_id,offset_s)",

            'rally_runs' => "  rally_id bigint(20) unsigned NOT NULL,
  seed bigint(20) unsigned NOT NULL,
  duration_s int(11) NOT NULL,
  broadcast_s int(11) NOT NULL,
  broadcast_end datetime NOT NULL,
  published tinyint(1) NOT NULL DEFAULT 0,
  computed_at datetime NOT NULL,
  PRIMARY KEY  (rally_id)",

            'candidates' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  city_id bigint(20) unsigned NOT NULL,
  week varchar(10) NOT NULL,
  role varchar(20) NOT NULL,
  name varchar(100) NOT NULL,
  skill smallint(5) unsigned NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY city_week (city_id,week)",

            'contracts' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  manager_id bigint(20) unsigned NOT NULL,
  sponsor_id bigint(20) unsigned NOT NULL,
  slot varchar(20) NOT NULL,
  status varchar(20) NOT NULL,
  progress smallint(5) unsigned NOT NULL DEFAULT 0,
  payment int(11) NOT NULL,
  goal_place int(11) NOT NULL,
  bonus int(11) NOT NULL,
  weeks int(11) NOT NULL,
  local tinyint(1) NOT NULL DEFAULT 0,
  misses int(11) NOT NULL DEFAULT 0,
  starts_at datetime DEFAULT NULL,
  ends_at datetime DEFAULT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY manager_id (manager_id),
  KEY sponsor_id (sponsor_id)",

            'bribes' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  manager_id bigint(20) unsigned NOT NULL,
  institution varchar(10) NOT NULL,
  status varchar(10) NOT NULL,
  week varchar(10) NOT NULL,
  expires_at datetime DEFAULT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY manager_id (manager_id)",

            'street_races' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  city_id bigint(20) unsigned NOT NULL,
  stage_id bigint(20) unsigned NOT NULL,
  challenger_id bigint(20) unsigned NOT NULL,
  opponent_id bigint(20) unsigned NOT NULL DEFAULT 0,
  bot_name varchar(100) NOT NULL DEFAULT '',
  bet int(11) NOT NULL,
  status varchar(10) NOT NULL,
  winner_id bigint(20) unsigned NOT NULL DEFAULT 0,
  challenger_ms int(11) NOT NULL DEFAULT 0,
  opponent_ms int(11) NOT NULL DEFAULT 0,
  challenger_caught tinyint(1) NOT NULL DEFAULT 0,
  opponent_caught tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  resolved_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  KEY city_status (city_id,status),
  KEY challenger_id (challenger_id)",

            'mayor_requests' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  manager_id bigint(20) unsigned NOT NULL,
  kind varchar(10) NOT NULL,
  status varchar(10) NOT NULL,
  request_date date NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY manager_kind (manager_id,kind)",

            'seasons' => "  season int(11) NOT NULL,
  closed_at datetime NOT NULL,
  PRIMARY KEY  (season)",

            'listings' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  seller_id bigint(20) unsigned NOT NULL,
  city_id bigint(20) unsigned NOT NULL,
  kind varchar(10) NOT NULL,
  item_id bigint(20) unsigned NOT NULL,
  name varchar(150) NOT NULL,
  details text NOT NULL,
  base_price int(11) NOT NULL,
  price int(11) NOT NULL,
  status varchar(10) NOT NULL,
  buyer_id bigint(20) unsigned NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  expires_at datetime NOT NULL,
  closed_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  KEY status_kind (status,kind),
  KEY seller_id (seller_id)",

            'loans' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  manager_id bigint(20) unsigned NOT NULL,
  principal int(11) NOT NULL,
  interest int(11) NOT NULL,
  weeks smallint(5) unsigned NOT NULL,
  installment int(11) NOT NULL,
  remaining int(11) NOT NULL,
  overdue int(11) NOT NULL DEFAULT 0,
  missed smallint(5) unsigned NOT NULL DEFAULT 0,
  weeks_passed smallint(5) unsigned NOT NULL DEFAULT 0,
  status varchar(10) NOT NULL,
  created_at datetime NOT NULL,
  closed_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  KEY manager_status (manager_id,status)",

            'messages' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  channel varchar(20) NOT NULL,
  manager_id bigint(20) unsigned NOT NULL,
  text text NOT NULL,
  reports smallint(5) unsigned NOT NULL DEFAULT 0,
  deleted tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY channel (channel,id),
  KEY manager_id (manager_id)",

            'topics' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  section varchar(20) NOT NULL,
  manager_id bigint(20) unsigned NOT NULL,
  title varchar(150) NOT NULL,
  posts int(11) NOT NULL DEFAULT 0,
  last_post_at datetime NOT NULL,
  deleted tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY section (section,last_post_at)",

            'sabotages' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  rally_id bigint(20) unsigned NOT NULL,
  manager_id bigint(20) unsigned NOT NULL,
  target_id bigint(20) unsigned NOT NULL,
  kind varchar(10) NOT NULL,
  status varchar(10) NOT NULL,
  warned tinyint(1) NOT NULL DEFAULT 0,
  suspects text NULL,
  caught tinyint(1) NOT NULL DEFAULT 0,
  week varchar(10) NOT NULL,
  created_at datetime NOT NULL,
  resolved_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  KEY rally_id (rally_id),
  KEY target_id (target_id),
  KEY manager_week (manager_id,week)",

            'rumors' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  city_id bigint(20) unsigned NOT NULL,
  named varchar(255) NOT NULL,
  anon varchar(255) NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY city_id (city_id,id)",

            'ad_views' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  manager_id bigint(20) unsigned NOT NULL,
  reward varchar(10) NOT NULL,
  provider varchar(10) NOT NULL,
  token varchar(64) NOT NULL,
  status varchar(10) NOT NULL,
  created_at datetime NOT NULL,
  claimed_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  KEY manager_created (manager_id,created_at)",

            'app_tokens' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  user_id bigint(20) unsigned NOT NULL,
  token_hash char(64) NOT NULL,
  device varchar(100) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  last_used_at datetime DEFAULT NULL,
  expires_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY token_hash (token_hash),
  KEY user_id (user_id)",

            'push_devices' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  user_id bigint(20) unsigned NOT NULL,
  token varchar(255) NOT NULL,
  platform varchar(10) NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY token (token),
  KEY user_id (user_id)",

            'push_queue' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  user_id bigint(20) unsigned NOT NULL,
  type varchar(20) NOT NULL,
  title varchar(150) NOT NULL,
  body varchar(255) NOT NULL,
  url varchar(255) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  PRIMARY KEY  (id)",

            'inbox' => "  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  manager_id bigint(20) unsigned NOT NULL,
  text varchar(255) NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY manager_id (manager_id)",
        ];
    }
}
