import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { BASE, CHROME, HOST, MU, OUTPUT, SITE, WP_LOAD, option, php, settings, sql } from '../env.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, path, { body, token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 300); }
  return { status: res.status, data };
}

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const stamp = Date.now();
const users = [];
const managers = [];
const rallies = [];
let restorePush, muCreated = false;
const log = () => option('bgr_push_test_log') ?? [];

async function registerApp(prefix) {
  const r = await call('POST', 'auth/register', { body: { username: `${prefix}${stamp}`, email: `${prefix}${stamp}@example.com`, password: 'testtest123', city_id: 1, mode: 'token', device: 'test' } });
  users.push(r.data.user.id);
  managers.push(r.data.player.id);
  return r.data.token;
}

function createRally(label, minutes) {
  sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, stage_ids, entry_fee, prizes, status) VALUES ('${label} ${stamp}', 1, DATE_ADD(NOW(), INTERVAL ${minutes} MINUTE), 95, 'dry', '1', 0, '0', 'scheduled')`);
  const id = Number(sql(`SELECT id FROM wp_bgr_rallies WHERE name = '${label} ${stamp}'`));
  rallies.push(id);
  return id;
}

async function sell(seller, buyer) {
  const part = Number(sql('SELECT id FROM wp_bgr_parts WHERE active = 1 AND min_level <= 1 ORDER BY price LIMIT 1'));
  await call('POST', 'shop/buy', { token: seller, body: { kind: 'part', id: part } });
  const market = await call('GET', 'market', { token: seller });
  const item = market.data.market.sellable[0];
  const listed = await call('POST', 'market/list', { token: seller, body: { kind: item.kind, id: item.id, price: item.min } });
  const listing = listed.data.market.mine[0];
  return call('POST', 'market/buy', { token: buyer, body: { id: listing.id } });
}

try {
  restorePush = option('bgr_push');
  option('bgr_push', null);
  option('bgr_push_test_log', null);

  const a = await registerApp('pa');
  const b = await registerApp('pb');
  sql(`UPDATE wp_bgr_managers SET level = 5, money = 50000 WHERE id IN (${managers.join(',')})`);

  let r = await call('GET', 'notifications', { token: a });
  check('notifications off without Firebase', r.status === 200 && r.data.notifications.enabled === false && r.data.notifications.types.length === 5);

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  option('bgr_push', {
    service_account: JSON.stringify({ type: 'service_account', project_id: 'bgr-test', client_email: 'push@bgr-test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    api_key: 'AIzaTest', sender_id: '123456', app_id: '1:123456:web:abc', vapid_key: 'BTestVapid',
  });
  mkdirSync(MU, { recursive: true });
  muCreated = true;
  writeFileSync(`${MU}/bgr-push-test.php`, `<?php
add_filter('bgrally_push_send', function ($result, $message, $device) {
    $log = get_option('bgr_push_test_log', []);
    $log[] = $message['message'];
    update_option('bgr_push_test_log', $log, false);
    return str_starts_with($device['token'], 'dead') ? 'invalid' : 'ok';
}, 10, 3);
`);

  r = await call('GET', 'notifications', { token: a });
  check('web config exposed when configured', r.data.notifications.enabled === true && r.data.notifications.web?.projectId === 'bgr-test' && r.data.notifications.web?.vapidKey === 'BTestVapid');
  r = await call('POST', 'notifications/device', { token: a, body: { token: 'short', platform: 'web' } });
  check('invalid device token refused', r.status === 400);
  const deviceA = `fcm-${stamp}-aaaaaaaaaaaaaaaaaaaa`;
  r = await call('POST', 'notifications/device', { token: a, body: { token: deviceA, platform: 'app' } });
  check('device registered', r.status === 200 && r.data.notifications.devices === 1, r.data.message);

  r = await sell(a, b);
  await sleep(300);
  let entries = log();
  const sold = entries.find((m) => m.data?.type === 'market');
  check('sale sends a push to the seller', r.status === 200 && !!sold && sold.token === deviceA && sold.notification.title === 'Продадено на пазара', sold?.notification.body);
  check('push links to the market page', sold?.data.url.endsWith('#/city/market') && sold?.webpush.fcm_options.link === sold?.data.url);
  check('queue emptied after sending', sql('SELECT COUNT(*) FROM wp_bgr_push_queue') === '0');

  r = await call('POST', 'notifications/preferences', { token: a, body: { on: ['rally_start', 'results', 'sabotage', 'loan'] } });
  check('market notifications turned off', r.data.notifications.types.find((t) => t.key === 'market').on === false);
  const before = log().length;
  await sell(a, b);
  await sleep(300);
  check('no push when the type is off', log().length === before);

  const rally = createRally('Push', 4320);
  await call('POST', `rallies/${rally}/register`, { token: a, body: { styles: {}, spares: { tyres: [], parts: [] } } });
  await call('POST', `rallies/${rally}/register`, { token: b, body: { styles: {}, spares: { tyres: [], parts: [] } } });
  sql(`UPDATE wp_bgr_rallies SET start_at = DATE_ADD(NOW(), INTERVAL 20 MINUTE) WHERE id = ${rally}`);
  await call('GET', 'rallies', { token: b });
  await sleep(300);
  entries = log();
  const reminders = entries.filter((m) => m.data?.type === 'rally_start' && m.data.url.endsWith(`#/rallies/${rally}`));
  check('rally reminder sent 30 minutes before', reminders.length === 1 && reminders[0].token === deviceA, reminders[0]?.notification.title);
  await call('GET', 'rallies', { token: b });
  await sleep(300);
  check('reminder sent only once', log().filter((m) => m.data?.type === 'rally_start').length === 1);
  check('player without devices gets nothing', !log().some((m) => m.token?.includes('pb')));

  await call('POST', 'notifications/device', { token: a, body: { token: `dead-${stamp}-bbbbbbbbbbbbbbbbbb`, platform: 'web' } });
  const second = createRally('Push2', 4320);
  await call('POST', `rallies/${second}/register`, { token: a, body: { styles: {}, spares: { tyres: [], parts: [] } } });
  sql(`UPDATE wp_bgr_rallies SET start_at = DATE_ADD(NOW(), INTERVAL 25 MINUTE) WHERE id = ${second}`);
  await call('GET', 'rallies', { token: a });
  await sleep(300);
  check('invalid device removed after FCM says unregistered', sql(`SELECT COUNT(*) FROM wp_bgr_push_devices WHERE token LIKE 'dead-${stamp}%'`) === '0' && sql(`SELECT COUNT(*) FROM wp_bgr_push_devices WHERE token = '${deviceA}'`) === '1');

  r = await call('POST', 'notifications/device/remove', { token: a, body: { token: deviceA } });
  check('device removed', r.data.notifications.devices === 0);

  const html = php('-r', `define("WP_ADMIN", true); $_SERVER["HTTP_HOST"]="${HOST}"; $_SERVER["REQUEST_URI"]="/wp-admin/admin.php"; $_SERVER["REQUEST_METHOD"]="GET"; require "${WP_LOAD}"; require_once ABSPATH . "wp-admin/includes/admin.php"; wp_set_current_user(1); ob_start(); BgRally\\Admin\\AuthPage::render(); echo ob_get_clean();`);
  check('admin shows Firebase settings and test button', html.includes('bgr-test') && html.includes('bgr_push_test'));
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (muCreated) rmSync(`${MU}/bgr-push-test.php`, { force: true });
  if (restorePush !== undefined) option('bgr_push', restorePush === null ? null : restorePush);
  option('bgr_push_test_log', null);
  for (const id of rallies) {
    sql(`DELETE FROM wp_bgr_entries WHERE rally_id = ${id}`);
    sql(`DELETE FROM wp_bgr_rallies WHERE id = ${id}`);
    sql(`DELETE FROM wp_options WHERE option_name LIKE '%bgr_push_start_${id}'`);
  }
  for (const id of managers) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${id})`);
    sql(`DELETE FROM wp_bgr_listings WHERE seller_id = ${id}`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${id}`);
  }
  for (const user of users) {
    for (const t of ['app_tokens', 'push_devices', 'push_queue']) sql(`DELETE FROM wp_bgr_${t} WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${user}`);
  }
  console.log('cleanup done');
}
