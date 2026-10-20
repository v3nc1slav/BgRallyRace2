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
  const header = res.headers.get('x-wp-nonce');
  if (header) nonce = header;
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 500);
  }
  if (data?.nonce) nonce = data.nonce;
  return { status: res.status, data };
}

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const stamp = Date.now();
const OFFSET = Number(sql("SELECT option_value FROM wp_options WHERE option_name = 'gmt_offset'")) || 0;
const username = `smoke${stamp}`;
let testRallyId = 0;
let managerId = 0;
let userId = 0;

try {
  await api('GET', 'me');
  let r = await api('POST', 'auth/register', { username, email: `${username}@example.com`, password: 'testtest123', city_id: 1 });
  check('register', r.status === 200 && r.data.player, `status ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
  managerId = r.data.player?.id;
  userId = r.data.user?.id;
  check('starting money 5000', r.data.player?.money === 5000, `money ${r.data.player?.money}`);

  r = await api('GET', 'garage');
  const g = r.data.garage;
  check('garage has car', r.status === 200 && g?.car?.name, `${g?.car?.name} ${g?.car?.class_label}`);
  check('6 parts mounted', g?.slots?.every((s) => s.item), g?.slots?.map((s) => s.item?.name).join(', '));
  check('tyres mounted', !!g?.tyre, g?.tyre?.name);
  check('crew of 2', g?.crew?.length === 2, g?.crew?.map((c) => `${c.role_label} ${c.name} ${c.skill}`).join('; '));
  check('no problems', g?.car?.problems?.length === 0, JSON.stringify(g?.car?.problems));

  r = await api('GET', 'shop');
  const gravel = r.data.tyres?.find((t) => t.type_label === 'Чакъл' && t.compound_label === 'Твърда');
  const sportEngine = r.data.parts?.find((p) => p.name === 'Спортен двигател');
  check('shop lists items for the city', r.data.parts?.length === 18 && r.data.tyres?.length === 6 && !r.data.tyres.some((t) => t.type_label === 'Сняг'), `${r.data.parts?.length} parts, ${r.data.tyres?.length} tyres`);
  check('sport engine locked at level 1', sportEngine?.locked === true);

  r = await api('POST', 'shop/buy', { kind: 'part', id: sportEngine.id });
  check('buying locked part fails', r.status === 400, r.data?.message);

  r = await api('POST', 'shop/buy', { kind: 'tyre', id: gravel.id });
  check('buy gravel tyres', r.status === 200, `${r.data?.message} money ${r.data?.player?.money}`);

  r = await api('GET', 'garage');
  const stored = r.data.garage.storage.find((s) => s.kind === 'tyre');
  check('tyres in storage', !!stored, stored?.name);

  r = await api('POST', 'garage/mount', { item_id: stored.id });
  check('mount tyres', r.status === 200 && r.data.garage.tyre.name === gravel.name, `energy ${r.data.player?.energy}`);

  const engine = r.data.garage.slots[0].item;
  r = await api('POST', 'garage/repair', { item_id: engine.id });
  check('repair of 100% part is refused', r.status === 400, r.data?.message);

  r = await api('GET', 'rallies');
  check('rally list', r.status === 200 && r.data.rallies?.length >= 10, `season ${r.data.season}, first: ${r.data.rallies?.[0]?.name} ${r.data.rallies?.[0]?.status}`);

  sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, stage_ids, entry_fee, prizes, status)
       VALUES ('Тестово рали ${stamp}', 2, DATE_ADD(NOW(), INTERVAL 3 DAY), 99, 'rain', '4,5,6', 100, '3000,2000,1500,1000,800,600,400,300,200,100', 'scheduled')`);
  testRallyId = Number(sql(`SELECT id FROM wp_bgr_rallies WHERE name = 'Тестово рали ${stamp}'`));

  r = await api('GET', `rallies/${testRallyId}`);
  const rally = r.data.rally;
  check('test rally open', rally?.status === 'open' && rally?.can_register, `costs ${JSON.stringify(rally?.costs)} weather ${rally?.weather}`);

  const styles = Object.fromEntries(rally.stages.map((s, i) => [s.id, ['safe', 'normal', 'attack'][i % 3]]));
  r = await api('POST', `rallies/${testRallyId}/register`, { styles });
  check('register for rally', r.status === 200 && r.data.rally?.entry, `${r.data?.message} money ${r.data?.player?.money}`);
  const moneyAfterEntry = r.data.player?.money;

  r = await api('POST', `rallies/${testRallyId}/register`, { styles });
  check('double registration refused', r.status === 400, r.data?.message);

  r = await api('POST', `rallies/${testRallyId}/recon`);
  check('recon refused on wrong day', r.status === 400, r.data?.message);

  sql(`UPDATE wp_bgr_rallies SET start_at = DATE_SUB(NOW(), INTERVAL 20 SECOND) WHERE id = ${testRallyId}`);
  r = await api('GET', `rallies/${testRallyId}`);
  const live = r.data.rally;
  check('simulated, broadcast live', live?.status === 'live' && live?.broadcast?.state === 'live', `progress ${live?.broadcast?.progress}% events ${live?.broadcast?.events?.length}`);
  check('weather revealed while live', live?.weather === 'Дъжд', live?.weather);
  check('no classification while live', !live?.broadcast?.classification);
  check('grid filled with bots', live?.start_list?.length === 8, `${live?.start_list?.length} entries`);
  console.log('     latest events:', live?.broadcast?.events?.slice(0, 3).map((e) => e.text));

  sql(`UPDATE wp_bgr_rallies SET start_at = DATE_SUB(NOW(), INTERVAL 3 HOUR) WHERE id = ${testRallyId}`);
  sql(`UPDATE wp_bgr_rally_runs SET broadcast_end = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE rally_id = ${testRallyId}`);
  r = await api('GET', `rallies/${testRallyId}`);
  const done = r.data.rally;
  const cls = done?.broadcast?.classification?.[0];
  check('broadcast finished with classification', done?.status === 'finished' && cls?.rows?.length === 8);
  const me = cls?.rows?.find((x) => x.is_me);
  console.log('     classification:', cls?.rows?.map((x) => `${x.place}. ${x.pilot} (${x.team}) ${(x.total_ms / 1000).toFixed(1)}s ${x.points}т ${x.prize}€`).join(' | '));
  check('player classified', !!me, `place ${me?.place}, points ${me?.points}, prize ${me?.prize}`);
  check('money credited after publish', r.data.player?.money === moneyAfterEntry + (me?.prize ?? 0), `${moneyAfterEntry} -> ${r.data.player?.money}`);
  check('xp credited', r.data.player?.xp > 0, `xp ${r.data.player?.xp}, level ${r.data.player?.level}`);
  console.log('     chronicle sample:', done?.broadcast?.events?.filter((e) => e.type !== 'finish').slice(0, 5).map((e) => e.text));

  r = await api('GET', 'garage');
  check('wear applied', r.data.garage.slots.some((s) => s.item.health < 100) && r.data.garage.tyre.health < 100,
    `tyres ${r.data.garage.tyre.health}%, engine ${r.data.garage.slots[0].item.health}%, crew ${r.data.garage.crew.map((c) => c.skill).join('/')}`);

  const worn = r.data.garage.slots.find((s) => s.item.can_repair)?.item;
  if (worn) {
    r = await api('POST', 'garage/repair', { item_id: worn.id });
    check('repair worn part', r.status === 200, `${r.data?.message} cost ${worn.repair_cost} energy ${r.data?.player?.energy}`);
  } else {
    console.log('     (no part worn enough to repair: max drops by 10)');
  }

  r = await api('GET', 'standings?season=99');
  check('season standings', r.status === 200 && r.data.classes?.[0]?.rows?.length === 8, `leader ${r.data.classes?.[0]?.rows?.[0]?.team} ${r.data.classes?.[0]?.rows?.[0]?.points}т`);

  r = await api('POST', 'auth/logout');
  check('logout', r.status === 200 && r.data.user === null);
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (testRallyId) {
    sql(`DELETE FROM wp_bgr_stage_times WHERE rally_id = ${testRallyId}`);
    sql(`DELETE FROM wp_bgr_events WHERE rally_id = ${testRallyId}`);
    sql(`DELETE FROM wp_bgr_rally_runs WHERE rally_id = ${testRallyId}`);
    sql(`DELETE FROM wp_bgr_entries WHERE rally_id = ${testRallyId}`);
    sql(`DELETE FROM wp_bgr_rallies WHERE id = ${testRallyId}`);
  }
  if (managerId) {
    for (const table of ['items', 'staff', 'player_cars', 'ledger', 'entries']) {
      sql(`DELETE FROM wp_bgr_${table} WHERE manager_id = ${managerId}`);
    }
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${managerId}`);
  }
  if (userId) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${userId}`);
    sql(`DELETE FROM wp_users WHERE ID = ${userId}`);
  }
  console.log('cleanup done');
}
