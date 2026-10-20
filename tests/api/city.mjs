import { execFileSync } from 'node:child_process';
import { BASE, CHROME, HOST, MU, OUTPUT, SITE, WP_LOAD, option, php, settings, sql } from '../env.mjs';

const cookies = {};
let nonce = '';

async function api(method, path, body) {
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
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 800);
  }
  if (data?.nonce) nonce = data.nonce;
  return { status: res.status, data };
}

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}
const u = `city${Date.now()}`;
await api('GET', 'me');
let r = await api('POST', 'auth/register', { username: u, email: `${u}@example.com`, password: 'testtest123', city_id: 3 });
const m = r.data.player.id, uid = r.data.user.id;
r = await api('GET', 'city');
check('city endpoint', r.status === 200 && r.data.city.privileges.length === 2, `${r.data.city.name}: ${r.data.city.privileges.join('; ')}`);
r = await api('GET', 'garage');
check('garage without privileges', r.status === 200 && !('privileges' in r.data.garage));
for (const t of ['items', 'staff', 'player_cars', 'ledger', 'inbox']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${m}`);
sql(`DELETE FROM wp_bgr_managers WHERE id = ${m}`); sql(`DELETE FROM wp_usermeta WHERE user_id = ${uid}`); sql(`DELETE FROM wp_users WHERE ID = ${uid}`);
