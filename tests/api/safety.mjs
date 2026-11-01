import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { BASE, MU, option, php, settings, sql } from '../env.mjs';

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

async function call(method, path, { body, token, headers = {} } = {}) {
  const all = { ...headers };
  if (token) all.Authorization = `Bearer ${token}`;
  if (body) all['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers: all, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text.slice(0, 200) };
  }
  return { status: res.status, data };
}

const stamp = Date.now();
const password = 'testtest123';
const local = "ip IN ('127.0.0.1', '::1', '0.0.0.0', '203.0.113.5', '198.51.100.7')";
const users = [];
const managers = [];
const rallies = [];
const seasons = [92];
let restore = null, restoreAds, muCreated = false;

async function player(prefix) {
  const name = `${prefix}${stamp}`;
  const r = await call('POST', 'auth/register', { body: { username: name, email: `${name}@example.com`, password, city_id: 1, mode: 'token', device: 'test' } });
  users.push(r.data.user.id);
  managers.push(r.data.player.id);
  return { name, id: r.data.player.id, user: r.data.user.id, token: r.data.token, confirmed: r.data.user.email_confirmed };
}

function rally(label, season, status, extra = '') {
  sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, stage_ids, entry_fee, prizes, status${extra ? ', computing_at' : ''}) VALUES ('${label} ${stamp}', 1, DATE_SUB(NOW(), INTERVAL 1 DAY), ${season}, 'dry', '1', 0, '0', '${status}'${extra ? `, ${extra}` : ''})`);
  const id = Number(sql(`SELECT id FROM wp_bgr_rallies WHERE name = '${label} ${stamp}'`));
  rallies.push(id);
  return id;
}

function hold(season) {
  sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, stage_ids, entry_fee, prizes, status) VALUES ('Hold${season} ${stamp}', 1, DATE_ADD(NOW(), INTERVAL 30 DAY), ${season}, 'dry', '1', 0, '0', 'scheduled')`);
  rallies.push(Number(sql(`SELECT id FROM wp_bgr_rallies WHERE name = 'Hold${season} ${stamp}'`)));
}

function entry(rallyId, managerId, place, prize, points, pending) {
  sql(`INSERT INTO wp_bgr_entries (rally_id, manager_id, class, start_number, status, place, points, prize, reward_pending, created_at) VALUES (${rallyId}, ${managerId}, '3', ${place}, 'finished', ${place}, ${points}, ${prize}, ${pending}, NOW())`);
}

function run(rallyId, published) {
  sql(`INSERT INTO wp_bgr_rally_runs (rally_id, seed, duration_s, broadcast_s, broadcast_end, published, computed_at) VALUES (${rallyId}, 777, 60, 60, DATE_SUB(NOW(), INTERVAL 1 DAY), ${published}, NOW())`);
}

const tick = () => php('run_job.php', 'tick');
const money = (id) => Number(sql(`SELECT money FROM wp_bgr_managers WHERE id = ${id}`));
const count = (table, where) => Number(sql(`SELECT COUNT(*) FROM wp_bgr_${table} WHERE ${where}`));
const status = (id) => sql(`SELECT status FROM wp_bgr_rallies WHERE id = ${id}`);
const mail = (...args) => JSON.parse(php('recovery.php', ...args));

try {
  const a = await player('sa');
  const b = await player('sb');
  const c = await player('sc');
  const d = await player('sd');
  const e = await player('se');

  hold(93);
  hold(94);
  let r = JSON.parse(php('upgrade.php'));
  check('a second request does not run the database upgrade', r.while_locked === 'old', JSON.stringify(r));
  check('the upgrade runs when nothing else is upgrading', r.after_release === r.current, JSON.stringify(r));

  const stuck = rally('Stuck', 93, 'computing', 'DATE_SUB(NOW(), INTERVAL 1 DAY)');
  sql(`INSERT INTO wp_bgr_entries (rally_id, manager_id, class, start_number, created_at) VALUES (${stuck}, ${a.id}, '3', 1, NOW())`);
  const fresh = rally('Fresh', 93, 'computing', 'DATE_ADD(NOW(), INTERVAL 1 DAY)');
  const saved = rally('Saved', 93, 'computing', 'DATE_SUB(NOW(), INTERVAL 1 DAY)');
  run(saved, 1);

  await call('GET', 'rallies', { token: a.token });
  check('opening the rallies does not run the background work', status(stuck) === 'computing');
  const started = Math.floor(Date.now() / 1000);
  tick();
  check('a stuck rally is computed again', status(stuck) === 'finished' && count('rally_runs', `rally_id = ${stuck}`) === 1, status(stuck));
  check('a rally still computing is left alone', status(fresh) === 'computing', status(fresh));
  check('a rally with saved results only gets its status', status(saved) === 'finished' && sql(`SELECT seed FROM wp_bgr_rally_runs WHERE rally_id = ${saved}`) === '777');
  check('the background run is stamped', Number(sql("SELECT option_value FROM wp_options WHERE option_name = 'bgr_last_tick'")) >= started - 1);
  sql(`UPDATE wp_bgr_rallies SET status = 'finished' WHERE id = ${fresh}`);

  const paid = rally('Paid', 94, 'finished');
  entry(paid, a.id, 1, 1000, 25, 1);
  entry(paid, b.id, 2, 700, 18, 0);
  run(paid, 1);
  let before = [money(a.id), money(b.id)];
  tick();
  check('an interrupted payout continues', money(a.id) === before[0] + 1000 && count('entries', `rally_id = ${paid} AND reward_pending = 1`) === 0, `${before[0]} -> ${money(a.id)}`);
  check('a player already paid gets nothing more', money(b.id) === before[1]);
  tick();
  check('a second run pays nothing', money(a.id) === before[0] + 1000);

  const due = rally('Due', 94, 'finished');
  entry(due, b.id, 1, 500, 25, 0);
  run(due, 0);
  before = money(b.id);
  await Promise.all(Array.from({ length: 5 }, () => call('GET', 'rallies', { token: b.token })));
  check('results are paid once with parallel requests', money(b.id) === before + 500 && sql(`SELECT published FROM wp_bgr_rally_runs WHERE rally_id = ${due}`) === '1', `${before} -> ${money(b.id)}`);

  const last = rally('Last', 92, 'finished');
  entry(last, a.id, 1, 0, 25, 0);
  entry(last, b.id, 2, 0, 18, 0);
  run(last, 1);
  sql(`INSERT INTO wp_bgr_season_prizes (season, manager_id, class, place, paid) VALUES (92, ${a.id}, '3', 1, 1)`);
  tick();
  const prizes = (id) => count('ledger', `manager_id = ${id} AND reason = 'season_prize'`);
  check('season prizes continue after an interruption', prizes(a.id) === 0 && prizes(b.id) === 1, `${prizes(a.id)}/${prizes(b.id)}`);
  check('the season is marked as closed', count('seasons', 'season = 92') === 1 && count('season_prizes', 'season = 92 AND paid = 0') === 0);
  tick();
  check('a closed season pays nothing more', prizes(b.id) === 1);

  sql(`UPDATE wp_bgr_managers SET energy = 500, level = 10 WHERE id = ${c.id}`);
  r = await call('GET', 'bank', { token: c.token });
  const terms = r.data.bank.terms[0].weeks;
  const loans = await Promise.all(Array.from({ length: 5 }, () => call('POST', 'bank/loan', { token: c.token, body: { amount: r.data.bank.min, weeks: terms } })));
  check('parallel requests give only one loan', count('loans', `manager_id = ${c.id} AND status = 'active'`) === 1, loans.map((x) => x.status).join(','));

  const stage = Number(sql('SELECT id FROM wp_bgr_stages WHERE city_id = 1 AND active = 1 ORDER BY position, id LIMIT 1'));
  sql(`INSERT INTO wp_bgr_street_races (city_id, stage_id, challenger_id, bet, status, created_at) VALUES (1, ${stage}, ${e.id}, 100, 'open', NOW())`);
  const challenge = Number(sql(`SELECT id FROM wp_bgr_street_races WHERE challenger_id = ${e.id}`));
  sql(`DELETE FROM wp_bgr_items WHERE manager_id = ${e.id} AND kind = 'tyre'`);
  before = money(e.id);
  await Promise.all([c, d].map((rival) => call('POST', 'black/accept', { token: rival.token, body: { challenge_id: challenge } })));
  check('the bet of an unready rival returns once', money(e.id) === before + 100 && sql(`SELECT status FROM wp_bgr_street_races WHERE id = ${challenge}`) === 'cancelled', `${before} -> ${money(e.id)}`);

  sql(`INSERT INTO wp_bgr_staff (manager_id, role, name, skill, created_at) VALUES (${d.id}, 'chemist', 'Test', 30, NOW())`);
  const staff = Number(sql(`SELECT id FROM wp_bgr_staff WHERE manager_id = ${d.id} AND role = 'chemist'`));
  r = await call('POST', 'staff/fire', { token: d.token, body: { staff_id: staff } });
  check('a crew member can be fired', r.status === 200 && count('staff', `id = ${staff}`) === 0, r.data.message);
  r = await call('POST', 'staff/fire', { token: d.token, body: { staff_id: staff } });
  check('firing an unknown member is refused', r.status === 404);

  restore = settings({ guard_local: 0, guard_proxy: 2, guard_proxy_hops: 1, guard_mail_limit: 2 });
  r = php('guard.php', 'ip', '203.0.113.5, 198.51.100.7');
  check('the proxy address is the last in the header', r === '198.51.100.7', r);
  settings({ guard_proxy_hops: 2 });
  r = php('guard.php', 'ip', '192.0.2.1, 203.0.113.5, 198.51.100.7');
  check('with two proxies the address before the last is taken', r === '203.0.113.5', r);
  settings({ guard_proxy: 0 });
  const unknown = await call('POST', 'auth/forgot', { body: { login: `nobody${stamp}` } });
  const known = await call('POST', 'auth/forgot', { body: { login: e.name } });
  check('forgot password does not reveal accounts', unknown.status === 200 && known.status === 200 && unknown.data.message === known.data.message, known.data.message);
  r = await call('POST', 'auth/forgot', { body: { login: e.name } });
  check('email requests are limited', r.status === 429, r.data.message);
  settings(restore);
  restore = null;

  check('a new email is not confirmed', a.confirmed === false);
  const [resetMail] = mail('forgot', a.name);
  const reset = new URLSearchParams(resetMail.message.match(/#\/reset\?(\S+)/)[1]);
  r = await call('POST', 'auth/reset', { body: { login: a.name, key: 'wrong', password: 'newpass1234' } });
  check('a wrong reset key is refused', r.status === 400, r.data.message);
  r = await call('POST', 'auth/reset', { body: { login: a.name, key: reset.get('key'), password: 'short' } });
  check('a short new password is refused', r.status === 400 && !!r.data.data?.fields?.password, r.data.message);
  r = await call('POST', 'auth/reset', { body: { login: a.name, key: reset.get('key'), password: 'newpass1234' } });
  check('the password is reset', r.status === 200, r.data.message);
  r = await call('POST', 'auth/reset', { body: { login: a.name, key: reset.get('key'), password: 'newpass5678' } });
  check('a reset link works once', r.status === 400);
  r = await call('POST', 'auth/login', { body: { login: a.name, password, mode: 'token' } });
  check('the old password stops working', r.status === 401);
  check('a reset logs out the app', (await call('GET', 'me', { token: a.token })).data.user === null);
  r = await call('POST', 'auth/login', { body: { login: a.name, password: 'newpass1234', mode: 'token' } });
  check('the new password works and confirms the email', r.status === 200 && r.data.user.email_confirmed === true, r.data.message);
  a.token = r.data.token;

  const [confirmMail] = mail('confirm', b.user);
  const link = new URLSearchParams(confirmMail.message.match(/#\/confirm\?(\S+)/)[1]);
  r = await call('POST', 'auth/confirm', { body: { id: b.user, exp: link.get('exp'), sig: 'wrong' } });
  check('a wrong confirmation link is refused', r.status === 400, r.data.message);
  r = await call('POST', 'auth/confirm', { body: { id: b.user, exp: Number(link.get('exp')) + 1, sig: link.get('sig') } });
  check('a changed expiry is refused', r.status === 400);
  r = await call('POST', 'auth/confirm', { body: { id: b.user, exp: link.get('exp'), sig: link.get('sig') } });
  check('the email is confirmed', r.status === 200 && (await call('GET', 'me', { token: b.token })).data.user.email_confirmed === true, r.data.message);
  r = await call('POST', 'account/confirm', { token: b.token });
  check('a confirmed email needs no new link', r.status === 400);
  r = await call('POST', 'account/confirm', { token: c.token });
  check('an unconfirmed player can ask for a new link', r.status === 200, r.data.message);

  const social = (user, mailbox) => mail('social', `google-${stamp}-${user}`, mailbox);
  r = social(c.user, `${c.name}@example.com`);
  check('Google does not take over an unconfirmed account', !!r.error, JSON.stringify(r));
  r = social(b.user, `${b.name}@example.com`);
  check('Google links to a confirmed account', r.user === b.user, JSON.stringify(r));

  r = await call('POST', 'account/password', { token: d.token, body: { current: 'wrong', password: 'newpass1234' } });
  check('changing the password needs the current one', r.status === 400 && !!r.data.data?.fields?.current, r.data.message);
  r = await call('POST', 'account/password', { token: d.token, body: { current: password, password: 'short' } });
  check('a short password is refused', r.status === 400);
  const other = (await call('POST', 'auth/login', { body: { login: d.name, password, mode: 'token' } })).data.token;
  r = await call('POST', 'account/password', { token: d.token, body: { current: password, password: 'newpass1234', mode: 'token', device: 'test' } });
  check('the password is changed with a new token', r.status === 200 && !!r.data.token && r.data.player?.id === d.id, r.data.message);
  check('the current device stays in', (await call('GET', 'me', { token: r.data.token })).data.user?.id === d.user);
  check('other devices are logged out', (await call('GET', 'me', { token: other })).data.user === null);

  restoreAds = option('bgr_ads');
  mkdirSync(MU, { recursive: true });
  muCreated = true;
  writeFileSync(`${MU}/bgr-ads-test.php`, "<?php\nadd_filter('bgrally_test_ads', '__return_false');\n");
  option('bgr_ads', { provider: 'test', gpt_unit: '', publisher: '', admob_unit: '', admob_ssv: true });
  r = await call('GET', 'ads?platform=web', { token: c.token });
  check('no test ads on a real site', r.data.ads.rewards.length === 0, JSON.stringify(r.data.ads).slice(0, 100));
  r = await call('POST', 'ads/start', { token: c.token, body: { reward: 'energy', platform: 'web' } });
  check('a test ad cannot be started on a real site', r.status === 400, r.data.message);
  r = await call('POST', 'ads/start', { token: c.token, body: { reward: 'energy', platform: 'app' } });
  check('an app without AdMob has no ads on a real site', r.status === 400, r.data.message);
  option('bgr_ads', { provider: 'gpt', gpt_unit: '/1/test', publisher: '', admob_unit: '', admob_ssv: true });
  r = await call('GET', 'ads?platform=web', { token: c.token });
  check('web ads give no money', !r.data.ads.rewards.some((reward) => reward.key === 'money') && r.data.ads.rewards.some((reward) => reward.key === 'energy'), JSON.stringify(r.data.ads.rewards.map((reward) => reward.key)));
  r = await call('POST', 'ads/start', { token: c.token, body: { reward: 'money', platform: 'web' } });
  check('a money ad cannot be started on the web', r.status === 400, r.data.message);
  r = await call('POST', 'ads/start', { token: c.token, body: { reward: 'energy', platform: 'web' } });
  check('other rewards still work on the web', r.status === 200 && r.data.ad.provider === 'gpt', r.data.message);
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (restore) settings(restore);
  if (muCreated) rmSync(`${MU}/bgr-ads-test.php`, { force: true });
  if (restoreAds !== undefined) option('bgr_ads', restoreAds === null ? null : restoreAds);
  sql(`DELETE FROM wp_bgr_guard WHERE ${local}`);
  for (const id of rallies) {
    for (const t of ['stage_times', 'events', 'entries']) sql(`DELETE FROM wp_bgr_${t} WHERE rally_id = ${id}`);
    sql(`DELETE FROM wp_bgr_rally_runs WHERE rally_id = ${id}`);
    sql(`DELETE FROM wp_bgr_rallies WHERE id = ${id}`);
  }
  for (const season of seasons) {
    sql(`DELETE FROM wp_bgr_seasons WHERE season = ${season}`);
    sql(`DELETE FROM wp_bgr_season_prizes WHERE season = ${season}`);
  }
  for (const id of managers) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${id})`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'loans', 'ad_views']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_street_races WHERE challenger_id = ${id} OR opponent_id = ${id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${id}`);
  }
  for (const user of users) {
    for (const t of ['app_tokens', 'push_devices', 'push_queue']) sql(`DELETE FROM wp_bgr_${t} WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${user}`);
  }
  console.log('cleanup done');
}
