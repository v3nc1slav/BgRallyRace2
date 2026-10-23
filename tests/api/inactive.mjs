import { BASE, php, settings, sql } from '../env.mjs';

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
let restore = null;
const job = (...args) => php('run_job.php', ...args.map(String));
const day = (offset) => sql(`SELECT DATE_ADD(CURDATE(), INTERVAL ${offset} DAY)`);
const row = (id) => {
  const [money, seen, inactive, payroll, jobDate, energyDate] = sql(`SELECT money, seen_date, IFNULL(inactive_since, ''), payroll_week, IFNULL(job_date, ''), IFNULL(energy_date, '') FROM wp_bgr_managers WHERE id = ${id}`).split('\t');
  return { money: Number(money), seen, inactive, payroll, jobDate, energyDate };
};

try {
  restore = settings({ inactive_days: 14, fresh_days: 30, fresh_cooldown: 180, fresh_base: 5000, fresh_per_level: 500, fresh_loan_weeks: 4, black_bet_min: 100 });
  const r0 = await call('POST', 'auth/register', { body: { username: `in${stamp}`, email: `in${stamp}@example.com`, password: 'testtest123', city_id: 1, mode: 'token', device: 'test' } });
  users.push(r0.data.user.id);
  const id = r0.data.player.id;
  managers.push(id);
  const token = r0.data.token;

  await call('GET', 'garage', { token });
  check('last login is recorded', row(id).seen === day(0));

  const jobId = Number(sql('SELECT id FROM wp_bgr_jobs WHERE active = 1 AND min_level <= 1 ORDER BY pay LIMIT 1'));
  await call('POST', 'jobs/take', { token, body: { id: jobId } });
  const stage = Number(sql('SELECT id FROM wp_bgr_stages WHERE city_id = 1 AND active = 1 ORDER BY position, id LIMIT 1'));
  const before = row(id).money;
  await call('POST', 'black/challenge', { token, body: { stage_id: stage, bet: 100 } });
  sql(`INSERT INTO wp_bgr_loans (manager_id, principal, interest, weeks, installment, remaining, overdue, status, created_at) VALUES (${id}, 1000, 50, 4, 263, 1050, 0, 'active', NOW())`);
  const sponsor = sql('SELECT id, slot FROM wp_bgr_sponsors ORDER BY id LIMIT 1').split('\t');
  sql(`INSERT INTO wp_bgr_contracts (manager_id, sponsor_id, slot, status, payment, goal_place, bonus, weeks, created_at, ends_at) VALUES (${id}, ${sponsor[0]}, '${sponsor[1]}', 'active', 500, 5, 300, 10, NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY))`);

  sql(`UPDATE wp_bgr_managers SET seen_date = '${day(-15)}' WHERE id = ${id}`);
  job('mark');
  let state = row(id);
  check('player becomes inactive after 14 days', state.inactive !== '');
  check('open black-track challenge is cancelled and refunded', sql(`SELECT COUNT(*) FROM wp_bgr_street_races WHERE challenger_id = ${id} AND status = 'open'`) === '0' && state.money === before, `${before} -> ${state.money}`);

  const staffBefore = sql(`SELECT COUNT(*) FROM wp_bgr_staff WHERE manager_id = ${id}`);
  sql(`UPDATE wp_bgr_managers SET payroll_week = '2000-01' WHERE id = ${id}`);
  job('payroll', id);
  state = row(id);
  check('no salaries or loan payments while inactive', state.money === before && sql(`SELECT CONCAT(remaining, '/', weeks_passed) FROM wp_bgr_loans WHERE manager_id = ${id}`) === '1050/0', `${state.money}`);
  check('staff stay while inactive', sql(`SELECT COUNT(*) FROM wp_bgr_staff WHERE manager_id = ${id}`) === staffBefore && state.payroll !== '2000-01');

  sql(`UPDATE wp_bgr_managers SET energy_date = '${day(-1)}', job_date = '${day(-3)}' WHERE id = ${id}`);
  job('daily');
  check('no job pay while inactive', row(id).money === before && row(id).energyDate === day(-1));

  sql(`UPDATE wp_bgr_contracts SET ends_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE manager_id = ${id}`);
  job('expire');
  check('sponsor contracts do not expire while inactive', sql(`SELECT status FROM wp_bgr_contracts WHERE manager_id = ${id}`) === 'active');

  const ends = sql(`SELECT UNIX_TIMESTAMP(ends_at) FROM wp_bgr_contracts WHERE manager_id = ${id}`);
  sql(`UPDATE wp_bgr_managers SET inactive_since = DATE_SUB(inactive_since, INTERVAL 10 DAY) WHERE id = ${id}`);
  let r = await call('GET', 'garage', { token });
  let comeback = r.data.player.comeback;
  state = row(id);
  check('return shows the welcome back info', comeback && comeback.days === 15 && comeback.fresh === null, JSON.stringify(comeback));
  check('welcome back lists what was frozen', comeback.notes.length === 5, comeback.notes.join(' | '));
  check('player is active again', state.inactive === '' && state.seen === day(0) && state.jobDate === day(0));
  const shift = Number(sql(`SELECT UNIX_TIMESTAMP(ends_at) FROM wp_bgr_contracts WHERE manager_id = ${id}`)) - Number(ends);
  check('sponsor contracts extended by the frozen time', Math.abs(shift - 10 * 86400) < 7200, `${shift}s`);
  check('money unchanged on return', state.money === before, `${state.money}`);
  r = await call('POST', 'comeback', { token, body: { choice: 'continue' } });
  check('continue closes the dialog', r.status === 200 && r.data.player.comeback === null, r.data.message);

  sql(`UPDATE wp_bgr_managers SET seen_date = '${day(-40)}', inactive_since = DATE_SUB(NOW(), INTERVAL 25 DAY), money = -3000 WHERE id = ${id}`);
  sql(`UPDATE wp_bgr_loans SET overdue = 500 WHERE manager_id = ${id}`);
  r = await call('GET', 'garage', { token });
  const level = r.data.player.level;
  comeback = r.data.player.comeback;
  check('fresh start offered after 30+ days in debt', comeback?.fresh === 5000 + 500 * (level - 1), JSON.stringify(comeback));
  r = await call('POST', 'comeback', { token, body: { choice: 'fresh' } });
  state = row(id);
  check('fresh start resets money and clears the loan', state.money === 5000 + 500 * (level - 1) && sql(`SELECT status FROM wp_bgr_loans WHERE manager_id = ${id}`) === 'forgiven', `${state.money} ${r.data.message}`);
  check('fresh start is in the ledger', sql(`SELECT COUNT(*) FROM wp_bgr_ledger WHERE manager_id = ${id} AND reason = 'fresh_start'`) === '1');
  r = await call('POST', 'bank/loan', { token, body: { amount: 500, weeks: 4 } });
  check('no loan right after a fresh start', r.status === 400 && r.data.message.includes('ново начало'), r.data.message);

  sql(`UPDATE wp_bgr_managers SET seen_date = '${day(-40)}', inactive_since = DATE_SUB(NOW(), INTERVAL 25 DAY), money = -100 WHERE id = ${id}`);
  r = await call('GET', 'garage', { token });
  check('second fresh start within 180 days is not offered', r.data.player.comeback?.fresh === null, JSON.stringify(r.data.player.comeback));
  await call('POST', 'comeback', { token, body: { choice: 'fresh' } });
  check('choosing fresh without an offer changes nothing', row(id).money === -100);
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (restore) settings(restore);
  for (const id of managers) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${id})`);
    sql(`DELETE FROM wp_bgr_street_races WHERE challenger_id = ${id}`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'loans']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${id}`);
  }
  for (const user of users) {
    for (const t of ['app_tokens', 'push_devices', 'push_queue']) sql(`DELETE FROM wp_bgr_${t} WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${user}`);
  }
  console.log('cleanup done');
}
