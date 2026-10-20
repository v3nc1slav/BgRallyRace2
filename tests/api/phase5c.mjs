import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { BASE, CHROME, HOST, MU, OUTPUT, SITE, WP_LOAD, option, php, settings, sql } from '../env.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, path, { body, token, header = 'Authorization', cookies } = {}) {
  const headers = {};
  if (token) headers[header] = header === 'Authorization' ? `Bearer ${token}` : token;
  if (cookies) headers.Cookie = cookies;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text.slice(0, 300); }
  return { status: res.status, data, setCookie: res.headers.getSetCookie() };
}

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const stamp = Date.now();
const users = [];
const managers = [];
let restoreAuth, restoreAds, rallyId = 0, muCreated = false;

async function registerApp(prefix, city = 1) {
  const r = await call('POST', 'auth/register', { body: { username: `${prefix}${stamp}`, email: `${prefix}${stamp}@example.com`, password: 'testtest123', city_id: city, mode: 'token', device: 'test app' } });
  if (r.data?.user) users.push(r.data.user.id);
  if (r.data?.player) managers.push(r.data.player.id);
  return r;
}

try {
  restoreAuth = option('bgr_auth');
  restoreAds = option('bgr_ads');
  option('bgr_auth', null);

  let r = await registerApp('ta');
  const token = r.data.token;
  const links = r.data.links;
  check('register in app mode returns a token', r.status === 200 && /^[a-f0-9]{64}$/.test(token ?? ''), `user ${r.data.user?.id}`);
  check('no login cookie in app mode', !r.setCookie.some((c) => c.startsWith('wordpress_logged_in')));
  check('state has links and providers', !!r.data.links?.privacy && !!r.data.links?.deletion && r.data.providers?.google === null, JSON.stringify(r.data.links));

  r = await call('GET', 'me', { token });
  check('bearer token authenticates', r.data.user?.name === `ta${stamp}` && !!r.data.player);
  r = await call('GET', 'me', { token, header: 'X-BGR-Token' });
  check('X-BGR-Token header works too', !!r.data.user);
  r = await call('GET', 'me', { token: 'f'.repeat(64) });
  check('unknown token is anonymous', r.data.user === null);
  r = await call('GET', 'garage', { token });
  check('game endpoints work with the token', r.status === 200 && !!r.data.garage);
  check('token stored only as a hash', sql(`SELECT COUNT(*) FROM wp_bgr_app_tokens WHERE token_hash = SHA2('${token}', 256)`) === '1' && sql(`SELECT COUNT(*) FROM wp_bgr_app_tokens WHERE token_hash = '${token}'`) === '0');

  r = await call('POST', 'auth/login', { body: { login: `ta${stamp}`, password: 'testtest123', mode: 'token', device: 'second phone' } });
  const second = r.data.token;
  check('login in app mode issues a second token', r.status === 200 && !!second && second !== token);
  r = await call('POST', 'auth/login', { body: { login: `ta${stamp}`, password: 'wrong', mode: 'token' } });
  check('wrong password refused', r.status === 401, r.data.message);

  r = await call('POST', 'auth/logout', { token: second });
  check('logout revokes only that token', r.data.user === null && (await call('GET', 'me', { token: second })).data.user === null && !!(await call('GET', 'me', { token })).data.user);

  sql(`UPDATE wp_bgr_managers SET banned_at = UTC_TIMESTAMP() WHERE id = ${managers[0]}`);
  r = await call('GET', 'me', { token });
  check('banned player token refused', r.data.user === null);
  sql(`UPDATE wp_bgr_managers SET banned_at = NULL WHERE id = ${managers[0]}`);

  r = await call('POST', 'auth/social', { body: { provider: 'google', token: 'abc', mode: 'token' } });
  check('google login needs configuration', r.status === 400 && r.data.message.includes('не е настроен'), r.data.message);
  option('bgr_auth', { google_client_ids: 'test-client.apps.googleusercontent.com', facebook_app_id: '123456', facebook_secret: 'abcdef', facebook_client_token: 'fedcba' });
  r = await call('GET', 'me');
  check('providers exposed when configured', r.data.providers?.google === 'test-client.apps.googleusercontent.com' && r.data.providers?.facebook === '123456' && r.data.providers?.facebook_token === 'fedcba');
  r = await call('POST', 'auth/social', { body: { provider: 'google', token: 'not-a-real-token', mode: 'token' } });
  check('fake google token rejected', r.status === 401, r.data.message);
  r = await call('POST', 'auth/social', { body: { provider: 'facebook', token: 'not-a-real-token', mode: 'token' } });
  check('fake facebook token rejected', r.status === 401, r.data.message);

  const pages = await fetch(links.privacy);
  const html = await pages.text();
  check('privacy page is public', pages.status === 200 && html.includes('Политика за поверителност'));

  const b = await registerApp('tb');
  const tokenB = b.data.token;
  sql(`UPDATE wp_bgr_managers SET level = 5 WHERE id = ${managers[1]}`);
  r = await call('POST', 'chat', { token: tokenB, body: { text: `Здрасти ${stamp}` } });
  const messageId = r.data.chat?.messages.at(-1)?.id;
  sql(`UPDATE wp_bgr_messages SET created_at = DATE_SUB(created_at, INTERVAL 1 MINUTE) WHERE manager_id = ${managers[1]}`);
  r = await call('POST', 'forum/topics', { token: tokenB, body: { section: 'general', title: `Тема ${stamp}`, text: 'Текст' } });
  const topicId = r.data.topic?.topic.id;
  sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, stage_ids, entry_fee, prizes, status) VALUES ('Del ${stamp}', 1, DATE_SUB(NOW(), INTERVAL 7 DAY), 96, 'dry', '1', 0, '0', 'finished')`);
  rallyId = Number(sql(`SELECT id FROM wp_bgr_rallies WHERE name = 'Del ${stamp}'`));
  sql(`INSERT INTO wp_bgr_entries (rally_id, manager_id, class, start_number, team_name, status, created_at) VALUES (${rallyId}, ${managers[1]}, '3', 1, 'tb${stamp}', 'finished', NOW())`);
  check('second player has chat, topic and a past result', !!messageId && !!topicId);

  r = await call('POST', 'account/delete', { token: tokenB, body: { confirm: 'да' } });
  check('delete needs the confirmation word', r.status === 400, r.data.message);
  r = await call('POST', 'account/delete', { token: tokenB, body: { confirm: 'ИЗТРИЙ' } });
  check('account deleted', r.status === 200 && r.data.user === null, r.data.message);
  const deletedUser = users[1];
  check('user and manager rows gone', sql(`SELECT COUNT(*) FROM wp_users WHERE ID = ${deletedUser}`) === '0' && sql(`SELECT COUNT(*) FROM wp_bgr_managers WHERE id = ${managers[1]}`) === '0');
  check('game data and tokens gone', ['items', 'staff', 'player_cars', 'ledger', 'inbox'].every((t) => sql(`SELECT COUNT(*) FROM wp_bgr_${t} WHERE manager_id = ${managers[1]}`) === '0') && sql(`SELECT COUNT(*) FROM wp_bgr_app_tokens WHERE user_id = ${deletedUser}`) === '0');
  r = await call('GET', 'chat', { token });
  const kept = r.data.chat.messages.find((m) => m.id === messageId);
  check('chat message kept as deleted player', kept?.author === 'Изтрит играч', kept?.author);
  r = await call('GET', `forum/topics/${topicId}`, { token });
  check('forum topic kept as deleted player', r.data.topic?.topic.author === 'Изтрит играч' && r.data.topic.posts[0]?.author === 'Изтрит играч');
  check('past result anonymised', sql(`SELECT HEX(team_name) FROM wp_bgr_entries WHERE rally_id = ${rallyId}`) === Buffer.from('Изтрит играч').toString('hex').toUpperCase());
  r = await call('GET', 'me', { token: tokenB });
  check('deleted token no longer works', r.data.user === null);

  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  mkdirSync(MU, { recursive: true });
  muCreated = true;
  writeFileSync(`${MU}/bgr-ssv-test.php`, `<?php\nadd_filter('bgrally_admob_keys', fn($keys) => $keys + ['999' => ${JSON.stringify(pem)}]);\n`);

  option('bgr_ads', { provider: 'test', gpt_unit: '', publisher: '', admob_unit: 'ca-app-pub-3940256099942544/5224354917', admob_ssv: true });
  r = await call('POST', 'ads/start', { body: { reward: 'energy', platform: 'web' }, token });
  check('web still uses the web provider', r.data.ad?.provider === 'test', JSON.stringify(r.data).slice(0, 120));
  r = await call('POST', 'ads/start', { token, body: { reward: 'money', platform: 'app' } });
  const ad = r.data.ad;
  check('app ad uses AdMob with SSV data', ad?.provider === 'admob' && ad.ssv_data === `${ad.view_id}.${ad.token}` && ad.user === String(managers[0]), JSON.stringify(ad).slice(0, 160));
  r = await call('POST', 'ads/claim', { token, body: { view_id: ad.view_id, token: ad.token } });
  check('claim waits for Google confirmation', r.status === 409, r.data.message);

  const message = new URLSearchParams({ ad_network: '5450213213286189855', ad_unit: '5224354917', custom_data: ad.ssv_data, reward_amount: '1', reward_item: 'Reward', timestamp: String(Date.now()), transaction_id: `t${stamp}`, user_id: ad.user }).toString();
  const signature = sign('sha256', Buffer.from(message), privateKey).toString('base64url');
  r = await call('GET', `ads/admob-ssv?${message}&signature=${signature.slice(0, -4)}AAAA&key_id=999`);
  check('bad SSV signature rejected', r.status === 400);
  r = await call('GET', `ads/admob-ssv?${message}&signature=${signature}&key_id=999`);
  check('valid SSV accepted', r.status === 200 && r.data.ok === true);
  const before = Number(sql(`SELECT money FROM wp_bgr_managers WHERE id = ${managers[0]}`));
  r = await call('POST', 'ads/claim', { token, body: { view_id: ad.view_id, token: ad.token } });
  check('claim after SSV gives the reward', r.status === 200 && Number(sql(`SELECT money FROM wp_bgr_managers WHERE id = ${managers[0]}`)) === before + 100, r.data.message);
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (muCreated) rmSync(`${MU}/bgr-ssv-test.php`, { force: true });
  if (restoreAuth !== undefined) option('bgr_auth', restoreAuth === null ? null : restoreAuth);
  if (restoreAds !== undefined) option('bgr_ads', restoreAds === null ? null : restoreAds);
  if (rallyId) {
    sql(`DELETE FROM wp_bgr_entries WHERE rally_id = ${rallyId}`);
    sql(`DELETE FROM wp_bgr_rallies WHERE id = ${rallyId}`);
  }
  sql(`DELETE FROM wp_bgr_messages WHERE text LIKE '%${stamp}%' OR channel IN (SELECT CONCAT('topic-', id) FROM wp_bgr_topics WHERE title LIKE '%${stamp}%')`);
  sql(`DELETE FROM wp_bgr_topics WHERE title LIKE '%${stamp}%'`);
  for (const id of managers) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${id})`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'bribes', 'mayor_requests', 'ad_views', 'messages']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${id}`);
  }
  for (const user of users) {
    sql(`DELETE FROM wp_bgr_app_tokens WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${user}`);
  }
  console.log('cleanup done');
}
