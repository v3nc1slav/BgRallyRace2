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
    try {
      data = JSON.parse(text);
    } catch {
      data = text.slice(0, 800);
    }
    if (data?.nonce) nonce = data.nonce;
    return { status: res.status, data };
  };
}

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const stamp = Date.now();
const players = [];

async function register(name) {
  const api = client();
  await api('GET', 'me');
  const r = await api('POST', 'auth/register', { username: name, email: `${name}@example.com`, password: 'testtest123', city_id: 1 });
  const player = { api, id: r.data.player.id, user: r.data.user.id, name };
  players.push(player);
  return player;
}

const money = async (p) => (await p.api('GET', 'me')).data.player;

try {
  const a = await register(`b4a${stamp}`);
  const b = await register(`b4b${stamp}`);
  check('two players in Sofia', a.id && b.id);

  let r = await a.api('GET', 'track');
  const track = r.data.track;
  check('track view', r.status === 200 && track.stages.length === 3, `weekday ${track.weekday}, risk ${track.risk}%, energy ${track.energy}, fuel ${track.stages[0].fuel} €`);
  r = await a.api('POST', 'track/train', { stage_id: track.stages[0].id });
  if (track.weekday) {
    check('official training on weekday', r.status === 200, r.data.message);
  } else {
    check('official training refused on weekend', r.status === 400, r.data.message);
  }

  r = await a.api('GET', 'black');
  const black = r.data.black;
  check('black track view', r.status === 200 && black.limits.min === 100 && black.limits.max === 1000, `risk ${black.risk}%, limits ${JSON.stringify(black.limits)}`);
  const stage = black.stages[1];

  if (!track.weekday) {
    const before = await money(a);
    r = await a.api('POST', 'black/train', { stage_id: stage.id });
    check('black track training', r.status === 200 && r.data.player.energy === before.energy - 20, r.data.message);
    r = await a.api('POST', 'black/train', { stage_id: stage.id });
    check('only one training per day', r.status === 400, r.data.message);
  }

  r = await a.api('GET', 'mall');
  const pilot = r.data.mall.crew.find((c) => c.role === 'pilot');
  const before = await money(a);
  r = await a.api('POST', 'mall/fitness', { staff_id: pilot.id });
  const trained = r.data.mall?.crew.find((c) => c.id === pilot.id);
  check('fitness +2 physical, -10 energy, -50 €', r.status === 200 && trained.physical === pilot.physical + 2 && r.data.player.energy === before.energy - 10 && r.data.player.money === before.money - 50, r.data.message);
  r = await a.api('POST', 'mall/fitness', { staff_id: pilot.id });
  check('fitness once per day per member', r.status === 400, r.data.message);

  r = await a.api('GET', 'police');
  const police = r.data.police;
  check('police view with chances', r.status === 200 && police.police.chance >= 50, `police ${police.police.chance}%, mayor ${police.mayor.chance}% (от ниво ${police.mayor.level}), risks ${JSON.stringify(police.risks)}`);
  r = await a.api('POST', 'police/bribe', { institution: 'mayor' });
  check('mayor bribe needs level 20', r.status === 400, r.data.message);
  const beforeBribe = await money(a);
  r = await a.api('POST', 'police/bribe', { institution: 'police' });
  const accepted = r.data.message?.includes('прие');
  check('police bribe answered', r.status === 200, r.data.message);
  r = await a.api('GET', 'police');
  if (accepted) {
    check('accepted bribe protects', r.data.police.police.active_until && r.data.police.risks.black === 2 && r.data.police.risks.official === 20, JSON.stringify(r.data.police.risks));
    check('accepted bribe cost 100 € + 15 energy', r.data.player.money === beforeBribe.money - 100 && r.data.player.energy === beforeBribe.energy - 15);
  } else {
    check('refused bribe keeps money, blocks retry', r.data.police.police.refused && r.data.player.money === beforeBribe.money);
  }

  r = await a.api('POST', 'black/challenge', { stage_id: stage.id, bet: 5000 });
  check('bet above limit refused', r.status === 400, r.data.message);

  const a0 = await money(a);
  const b0 = await money(b);
  r = await a.api('POST', 'black/challenge', { stage_id: stage.id, bet: 200 });
  check('post challenge', r.status === 200, r.data.message);
  r = await b.api('GET', 'black');
  const open = r.data.black.challenges.find((c) => !c.mine);
  check('other player sees the challenge', !!open, open && `${open.team} ${open.bet} € ${open.stage}`);
  r = await a.api('POST', 'black/accept', { challenge_id: open.id });
  check('cannot accept own challenge', r.status === 400, r.data.message);
  r = await b.api('POST', 'black/accept', { challenge_id: open.id });
  check('accept challenge and race', r.status === 200, r.data.message);
  r = await b.api('POST', 'black/accept', { challenge_id: open.id });
  check('challenge cannot be accepted twice', r.status === 404, r.data.message);

  const race = sql(`SELECT CONCAT(winner_id, ',', challenger_caught, ',', opponent_caught) FROM wp_bgr_street_races WHERE id = ${open.id}`).split(',').map(Number);
  const [winner, aCaught, bCaught] = race;
  const payout = { [a.id]: 0, [b.id]: 0 };
  const caught = { [a.id]: aCaught, [b.id]: bCaught };
  const loser = winner === a.id ? b.id : a.id;
  if (!caught[winner]) payout[winner] = caught[loser] ? 200 : 400;
  else if (!caught[loser]) payout[loser] = 200;
  const a1 = await money(a);
  const b1 = await money(b);
  const expectedA = a0.money - 200 + payout[a.id] - (aCaught ? 300 : 0);
  const expectedB = b0.money - 200 + payout[b.id] - (bCaught ? 300 : 0);
  check('money settled correctly', a1.money === expectedA && b1.money === expectedB, `winner ${winner === a.id ? 'A' : 'B'}, caught A ${aCaught} B ${bCaught}, A ${a0.money}→${a1.money}, B ${b0.money}→${b1.money}`);
  check('both paid energy', a1.energy === a0.energy - 20 && b1.energy === b0.energy - 20);
  r = await a.api('GET', 'inbox');
  check('challenger notified', r.data.inbox[0]?.text.startsWith('Черна писта'), r.data.inbox[0]?.text);
  r = await a.api('GET', 'black');
  check('history recorded', r.data.black.history.length === 1, JSON.stringify(r.data.black.history[0]));

  const a2 = await money(a);
  r = await a.api('POST', 'black/challenge', { stage_id: stage.id, bet: 150 });
  const mine = (await a.api('GET', 'black')).data.black.challenges.find((c) => c.mine);
  r = await a.api('POST', 'black/cancel', { challenge_id: mine.id });
  const a3 = await money(a);
  check('cancel refunds the bet', r.status === 200 && a3.money === a2.money, r.data.message);

  r = await b.api('POST', 'black/bot', { stage_id: stage.id, bet: 100 });
  check('race against a bot', r.status === 200, r.data.message);

  sql(`UPDATE wp_bgr_managers SET level = 25, money = 50000 WHERE id = ${b.id}`);
  r = await b.api('POST', 'police/bribe', { institution: 'mayor' });
  check('mayor bribe answered at level 25', r.status === 200, r.data.message);
  r = await b.api('GET', 'police');
  console.log('     B risks:', JSON.stringify(r.data.police.risks), 'mayor until', r.data.police.mayor.active_until);

  r = await a.api('GET', 'garage');
  console.log('     A crew:', r.data.garage.crew.map((c) => `${c.role_label} умение ${c.skill} физ. ${c.physical}`).join('; '), '| tyres', r.data.garage.tyre?.health);
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  for (const p of players) {
    sql(`DELETE FROM wp_bgr_street_races WHERE challenger_id = ${p.id} OR opponent_id = ${p.id}`);
    for (const table of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'bribes']) sql(`DELETE FROM wp_bgr_${table} WHERE manager_id = ${p.id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${p.id}`);
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${p.user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${p.user}`);
  }
  console.log('cleanup done');
}
