import { execFileSync } from 'node:child_process';
import { BASE, CHROME, HOST, MU, OUTPUT, SITE, WP_LOAD, option, php, settings, sql } from '../env.mjs';

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
let id = 0, user = 0, rallyId = 0;

try {
  await api('GET', 'me');
  let r = await api('POST', 'auth/register', { username: `b4${stamp}`, email: `b4${stamp}@example.com`, password: 'testtest123', city_id: 1 });
  id = r.data.player.id;
  user = r.data.user.id;
  check('register', !!id);

  r = await api('GET', 'hall');
  check('hall view', r.status === 200 && r.data.hall.permit.has === false && r.data.hall.track.level === 45, `permit chance ${r.data.hall.permit.chance}%, track chance ${r.data.hall.track.chance}%`);

  sql(`UPDATE wp_bgr_managers SET level = 10, money = 300000 WHERE id = ${id}`);
  r = await api('POST', 'garage/upgrade');
  check('upgrade blocked without permit', r.status === 400 && r.data.message.includes('кмета'), r.data.message);
  r = await api('GET', 'garage');
  check('garage shows missing permit', r.data.garage.garage.permit === false);

  r = await api('POST', 'hall/negotiate', { kind: 'garage' });
  const approved = r.data.hall?.permit.has;
  check('permit negotiation answered', r.status === 200, r.data.message);
  if (!approved) {
    r = await api('POST', 'hall/negotiate', { kind: 'garage' });
    check('refused permit blocks retry today', r.status === 400, r.data.message);
    sql(`INSERT INTO wp_bgr_mayor_requests (manager_id, kind, status, request_date, created_at) VALUES (${id}, 'garage', 'approved', CURDATE(), NOW())`);
  }
  r = await api('POST', 'garage/upgrade');
  check('upgrade with permit', r.status === 200 && r.data.garage.garage.level === 2, r.data.message);
  r = await api('GET', 'hall');
  check('permit consumed', r.data.hall.permit.has === false);

  r = await api('GET', 'mall');
  const items = r.data.mall.clothes.items;
  check('clothes catalog', items.length === 12, `bonus now ${r.data.mall.clothes.bonus}%`);
  const find = (name) => items.find((i) => i.name === name);
  r = await api('POST', 'mall/buy', { id: find('Маратонки').id });
  r = await api('POST', 'mall/buy', { id: find('Спортно яке').id });
  check('buy and auto-wear clothes', r.data.mall.clothes.bonus === 3, r.data.message);
  r = await api('POST', 'mall/buy', { id: find('Костюм по поръчка').id });
  check('locked clothes refused', r.status === 400, r.data.message);
  r = await api('POST', 'mall/buy', { id: find('Кожени обувки').id });
  check('new shoes replace old in slot', r.data.mall.clothes.bonus === 5);
  const sneakers = r.data.mall.clothes.items.find((i) => i.name === 'Маратонки');
  r = await api('POST', 'mall/wear', { item_id: sneakers.item_id });
  check('wear old shoes again', r.data.mall.clothes.bonus === 3, r.data.message);
  r = await api('GET', 'hall');
  check('clothes bonus counts at the mayor', r.data.hall.clothes_bonus === 3);

  r = await api('GET', 'jobs');
  const waiter = r.data.jobs.jobs.find((j) => j.name === 'Сервитьор в бара');
  check('jobs list', r.data.jobs.jobs.length === 7 && r.data.jobs.can_take, `season ${r.data.jobs.season}`);
  r = await api('POST', 'jobs/take', { id: waiter.id });
  check('take a job', r.status === 200 && r.data.jobs.current?.id === waiter.id, r.data.message);
  r = await api('POST', 'jobs/take', { id: r.data.jobs.jobs[1].id });
  check('job locked for the season', r.status === 400, r.data.message);

  const before = (await api('GET', 'me')).data.player;
  sql(`UPDATE wp_bgr_managers SET job_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY), energy_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) WHERE id = ${id}`);
  r = await api('GET', 'me');
  check('daily shift pays and takes energy', r.data.player.money === before.money + 60 && r.data.player.energy === r.data.player.energy_max - 25, `money ${before.money} -> ${r.data.player.money}, energy ${r.data.player.energy}/${r.data.player.energy_max}`);
  const before3 = r.data.player;
  sql(`UPDATE wp_bgr_managers SET job_date = DATE_SUB(CURDATE(), INTERVAL 3 DAY), energy_date = DATE_SUB(CURDATE(), INTERVAL 3 DAY) WHERE id = ${id}`);
  r = await api('GET', 'me');
  check('missed days are paid too', r.data.player.money === before3.money + 180, `${before3.money} -> ${r.data.player.money}`);
  r = await api('POST', 'jobs/quit');
  check('quit job', r.status === 200 && !r.data.jobs.current && !r.data.jobs.can_take, r.data.message);

  sql(`UPDATE wp_bgr_managers SET level = 45, money = 300000, energy = 500 WHERE id = ${id}`);
  r = await api('POST', 'hall/negotiate', { kind: 'track' });
  check('track negotiation answered', r.status === 200, r.data.message);
  if (r.data.hall?.track.status !== 'building') {
    sql(`UPDATE wp_bgr_managers SET track_status = 'building', track_ready_at = DATE_ADD(NOW(), INTERVAL 21 DAY) WHERE id = ${id}`);
  } else {
    check('track building costs 100 000 €', r.data.player.money === 300000 - 100000 - 0, `money ${r.data.player.money}`);
  }
  r = await api('POST', 'track/own');
  check('cannot train while building', r.status === 400, r.data.message);
  sql(`UPDATE wp_bgr_managers SET track_ready_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ${id}`);
  r = await api('GET', 'track');
  check('track opens when ready', r.data.track.own.status === 'open');
  const crewBefore = (await api('GET', 'garage')).data.garage.crew;
  r = await api('POST', 'track/own');
  const crewAfter = (await api('GET', 'garage')).data.garage.crew;
  const skill = (crew, role) => crew.find((c) => c.role === role).skill;
  check('own track gives +1 to both', r.status === 200 && skill(crewAfter, 'pilot') === skill(crewBefore, 'pilot') + 1 && skill(crewAfter, 'navigator') === skill(crewBefore, 'navigator') + 1, r.data.message);

  sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, stage_ids, entry_fee, prizes, status) VALUES ('S98 ${stamp}', 1, DATE_ADD(NOW(), INTERVAL 3 DAY), 98, 'dry', '1', 0, '0', 'scheduled')`);
  rallyId = Number(sql(`SELECT id FROM wp_bgr_rallies WHERE name = 'S98 ${stamp}'`));
  r = await api('POST', `rallies/${rallyId}/register`, { styles: {}, spares: { tyres: [], parts: [] } });
  check('registered for the last rally of season 98', r.status === 200, r.data.message);
  sql(`UPDATE wp_bgr_rallies SET start_at = DATE_SUB(NOW(), INTERVAL 3 HOUR) WHERE id = ${rallyId}`);
  await api('GET', `rallies/${rallyId}`);
  sql(`UPDATE wp_bgr_rally_runs SET broadcast_end = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE rally_id = ${rallyId}`);
  r = await api('GET', `rallies/${rallyId}`);
  const me = r.data.rally.broadcast.classification[0].rows.find((x) => x.is_me);
  r = await api('GET', 'inbox');
  const seasonNote = r.data.inbox.find((x) => x.text.startsWith('Сезон 98'));
  check('season closed with award', !!seasonNote && sql('SELECT COUNT(*) FROM wp_bgr_seasons WHERE season = 98') === '1', `place ${me?.place}: ${seasonNote?.text}`);
  const place = Number(seasonNote?.text.match(/: (\d+) място/)?.[1] ?? 99);
  const track = sql(`SELECT track_status FROM wp_bgr_managers WHERE id = ${id}`);
  check('track kept only for top 5', place <= 5 ? track === 'open' : track === 'closed', `season place ${place}, track ${track}`);
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (rallyId) {
    for (const t of ['stage_times', 'events', 'rally_runs', 'entries']) sql(`DELETE FROM wp_bgr_${t} WHERE rally_id = ${rallyId}`);
    sql(`DELETE FROM wp_bgr_rallies WHERE id = ${rallyId}`);
  }
  sql('DELETE FROM wp_bgr_seasons WHERE season = 98');
  if (id) {
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'bribes', 'mayor_requests']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${id}`);
  }
  if (user) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${user}`);
  }
  sql('DELETE FROM wp_bgr_bots WHERE id NOT IN (SELECT bot_id FROM wp_bgr_entries)');
  console.log('cleanup done');
}
