import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { BASE, CHROME, HOST, MU, OUTPUT, SITE, WP_LOAD, option, php, settings, sql } from '../env.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function client() {
  const cookies = {};
  let nonce = '';
  return async function api(method, path, body) {
    const headers = { Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') };
    if (nonce) headers['X-WP-Nonce'] = nonce;
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const cookie of res.headers.getSetCookie()) {
      const [pair, ...attrs] = cookie.split(';');
      const [name, ...rest] = pair.split('=');
      const expires = attrs.find((a) => a.trim().toLowerCase().startsWith('expires='));
      if (expires && Date.parse(expires.split('=')[1]) < Date.now()) delete cookies[name.trim()];
      else cookies[name.trim()] = rest.join('=');
    }
    if (res.headers.get('x-wp-nonce')) nonce = res.headers.get('x-wp-nonce');
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text.slice(0, 800); }
    if (data?.nonce) nonce = data.nonce;
    return { status: res.status, data };
  };
}

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const stamp = Date.now();
const api = client();
let id = 0, user = 0, restore = null;

async function watch(reward) {
  const start = await api('POST', 'ads/start', { reward });
  if (start.status !== 200) return start;
  await sleep(3100);
  return api('POST', 'ads/claim', { view_id: start.data.ad.view_id, token: start.data.ad.token });
}

try {
  restore = settings({ ad_test_seconds: 3, ad_cooldown: 0 });
  await api('GET', 'me');
  let r = await api('POST', 'auth/register', { username: `ad${stamp}`, email: `ad${stamp}@example.com`, password: 'testtest123', city_id: 1 });
  id = r.data.player.id;
  user = r.data.user.id;

  r = await api('GET', 'ads');
  check('ads view', r.status === 200 && r.data.ads.rewards.length === 4 && r.data.ads.rewards.find((x) => x.key === 'energy').left === 3, r.data.ads.rewards.map((x) => `${x.key}:${x.left}`).join(' '));

  r = await api('POST', 'ads/start', { reward: 'energy' });
  check('ad started with provider config', r.status === 200 && r.data.ad.provider === 'test' && r.data.ad.token.length === 32, JSON.stringify(r.data.ad).slice(0, 120));
  const early = await api('POST', 'ads/claim', { view_id: r.data.ad.view_id, token: r.data.ad.token });
  check('claim before the end refused', early.status === 400, early.data.message);
  const bad = await api('POST', 'ads/claim', { view_id: r.data.ad.view_id, token: 'x'.repeat(32) });
  check('wrong token refused', bad.status === 400, bad.data.message);
  await sleep(3100);
  const energy = (await api('GET', 'me')).data.player.energy;
  r = await api('POST', 'ads/claim', { view_id: r.data.ad.view_id, token: r.data.ad.token });
  check('energy reward', r.status === 200 && r.data.player.energy === energy + 20, `${r.data.message} ${energy} -> ${r.data.player.energy}`);
  check('energy left 2', (await api('GET', 'ads')).data.ads.rewards.find((x) => x.key === 'energy').left === 2);

  const money = (await api('GET', 'me')).data.player.money;
  r = await watch('money');
  check('money reward', r.status === 200 && r.data.player.money === money + 100, r.data.message);
  r = await api('POST', 'ads/start', { reward: 'money' });
  check('money only once a day', r.status === 400, r.data.message);

  r = await watch('discount');
  check('discount perk', r.status === 200 && r.data.player.perks.discount === 10, r.data.message);
  const shop = (await api('GET', 'shop')).data;
  const part = shop.parts.filter((p) => !p.locked).sort((a, b) => b.price - a.price)[0];
  const before = shop.player.money;
  r = await api('POST', 'shop/buy', { kind: 'part', id: part.id });
  const paid = before - r.data.player.money;
  check('next purchase discounted once', r.status === 200 && paid === Math.round(part.price * 0.9) && r.data.player.perks.discount === 0, `shop price ${part.price}, paid ${paid}`);

  sql(`INSERT INTO wp_bgr_mayor_requests (manager_id, kind, status, request_date, created_at) VALUES (${id}, 'garage', 'refused', CURDATE(), NOW())`);
  sql(`UPDATE wp_bgr_managers SET level = 10 WHERE id = ${id}`);
  r = await api('POST', 'hall/negotiate', { kind: 'garage' });
  check('mayor refused without retry', r.status === 400, r.data.message);
  r = await watch('retry');
  check('retry perk', r.status === 200 && r.data.player.perks.retry === true, r.data.message);
  r = await api('POST', 'ads/start', { reward: 'retry' });
  check('retry cannot stack', r.status === 400, r.data.message);
  r = await api('POST', 'hall/negotiate', { kind: 'garage' });
  check('second attempt at the mayor', r.status === 200 && r.data.player.perks.retry === false, r.data.message);

  sql(`INSERT INTO wp_bgr_bribes (manager_id, institution, week, status, created_at) VALUES (${id}, 'police', DATE_FORMAT(NOW(), '%x-%v'), 'refused', NOW())`);
  r = await api('POST', 'police/bribe', { institution: 'police' });
  check('bribe refused this week', r.status === 400, r.data.message);
  sql(`UPDATE wp_bgr_managers SET ad_retry = 1 WHERE id = ${id}`);
  r = await api('POST', 'police/bribe', { institution: 'police' });
  check('second bribe attempt with retry', r.status === 200 && r.data.player.perks.retry === false, r.data.message);

  settings({ ad_cooldown: 1 });
  r = await api('POST', 'ads/start', { reward: 'energy' });
  check('cooldown between ads', r.status === 400 && r.data.message.includes('сек'), r.data.message);
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (restore) settings(restore);
  if (id) {
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'bribes', 'mayor_requests', 'ad_views']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${id}`);
  }
  if (user) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${user}`);
  }
  console.log('cleanup done');
}
