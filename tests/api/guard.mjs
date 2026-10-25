import { BASE, SITE, php, settings, sql } from '../env.mjs';

async function call(method, path, { body, lang } = {}) {
  const headers = {};
  if (lang) headers['X-BGR-Lang'] = lang;
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
let restore = null;
const local = "ip IN ('127.0.0.1', '::1')";
const password = 'testtest123';
const login = (name, pass, lang) => call('POST', 'auth/login', { lang, body: { login: name, password: pass, mode: 'token', device: 'test' } });

async function register(name) {
  const r = await call('POST', 'auth/register', { body: { username: name, email: `${name}@example.com`, password, city_id: 1, mode: 'token', device: 'test' } });
  if (r.data?.user) {
    users.push(r.data.user.id);
    managers.push(r.data.player.id);
  }
  return r;
}

try {
  const first = `ga${stamp}`;
  const second = `gb${stamp}`;
  await register(first);
  await register(second);
  sql(`DELETE FROM wp_bgr_guard WHERE ${local}`);
  restore = settings({ guard_local: 0, guard_login_attempts: 3, guard_login_minutes: 15, guard_ip_attempts: 5, guard_ip_minutes: 60, guard_register_limit: 2 });

  for (let i = 0; i < 3; i++) {
    await login(first, 'wrong-password');
  }
  let r = await login(first, password);
  check('the account locks after 3 wrong passwords', r.status === 429, `${r.status} ${r.data?.message}`);
  check('the lock message says when to retry', /след 15 минути/.test(r.data?.message ?? ''), r.data?.message);
  r = await login(first, password, 'en');
  check('the lock message in English', /in 15 minutes/.test(r.data?.message ?? ''), r.data?.message);

  const form = new URLSearchParams({ log: first, pwd: password, testcookie: '1' });
  const page = await fetch(`${SITE}/wp-login.php`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: 'wordpress_test_cookie=WP%20Cookie%20check' }, body: form });
  const html = await page.text();
  check('wp-login.php is locked too', page.status === 200 && html.includes('Твърде много неуспешни опити'), `${page.status}`);

  r = await login(second, password);
  check('another account from the same IP still works', r.status === 200, `${r.status} ${r.data?.message}`);
  await login(`nobody${stamp}`, 'x1');
  await login(`nobody${stamp}`, 'x2');
  r = await login(second, password);
  check('the IP is blocked after 5 wrong passwords across accounts', r.status === 429, `${r.status} ${r.data?.message}`);

  const locks = JSON.parse(php('guard.php', 'locks'));
  check('the admin list shows the IP and the account', locks.some((lock) => lock.login === null) && locks.some((lock) => lock.login === first), JSON.stringify(locks).slice(0, 200));

  php('guard.php', 'clear', locks[0].ip);
  r = await login(first, password);
  check('unlocking lets the player in again', r.status === 200, `${r.status} ${r.data?.message}`);

  r = await register(`gc${stamp}`);
  check('first registration from the IP is allowed', r.status === 200, `${r.status} ${r.data?.message}`);
  r = await register(`gd${stamp}`);
  check('second registration from the IP is allowed', r.status === 200, `${r.status} ${r.data?.message}`);
  r = await register(`ge${stamp}`);
  check('the third registration within an hour is refused', r.status === 429 && /Твърде много нови профили/.test(r.data?.message ?? ''), `${r.status} ${r.data?.message}`);

  const xml = `<?xml version="1.0"?><methodCall><methodName>wp.getUsersBlogs</methodName><params><param><value>${second}</value></param><param><value>${password}</value></param></params></methodCall>`;
  const rpc = await (await fetch(`${SITE}/xmlrpc.php`, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml })).text();
  check('XML-RPC does not accept logins', rpc.includes('faultCode') && !rpc.includes('isAdmin'), rpc.replace(/\s+/g, ' ').slice(0, 120));

  const list = await fetch(`${SITE}/wp-json/wp/v2/users`);
  check('the user list is hidden', list.status === 404, `${list.status}`);
  const author = await fetch(`${SITE}/?author=1`, { redirect: 'manual' });
  const location = author.headers.get('location') ?? '';
  check('author pages do not reveal user names', author.status === 301 && !location.includes('/author/'), `${author.status} ${location}`);
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (restore) settings(restore);
  sql(`DELETE FROM wp_bgr_guard WHERE ${local}`);
  for (const id of managers) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${id})`);
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
