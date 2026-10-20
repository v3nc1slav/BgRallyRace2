import { BASE, sql } from '../env.mjs';

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

async function call(path, token) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, data: await res.json() };
}

const stamp = Date.now();
const keep = process.argv.includes('--keep');
let userId = 0, managerId = 0;

try {
  const reg = await fetch(BASE + 'auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `fin${stamp}`, email: `fin${stamp}@example.com`, password: 'testtest123', city_id: 1, mode: 'token' }),
  }).then((r) => r.json());
  userId = reg.user.id;
  managerId = reg.player.id;
  const token = reg.token;

  const weeks = ['2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23', '2026-08-30', '2026-09-06'];
  weeks.forEach((day, i) => sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, stage_ids, entry_fee, prizes, status) VALUES ('Fin${i + 1} ${stamp}', 1, '${day} 20:00:00', 0, 'dry', '1', 0, '0', 'finished')`));

  const plan = [
    [3000, 'prize', 1200, 'salary', 800, 'rally_entry'],
    [1500, 'sponsor', 2600, 'shop', 650, 'rally_entry'],
    [5000, 'prize', 1300, 'salary', 900, 'repair'],
    [800, 'job', 400, 'fine', 700, 'rally_entry'],
    [6500, 'prize', 1300, 'salary', 3200, 'car_purchase'],
    [2000, 'sponsor', 500, 'bribe', 750, 'rally_entry'],
  ];
  let balance = 10000;
  let income = 0, expense = 0;
  plan.forEach(([inAmount, inReason, outA, outReasonA, outB, outReasonB], i) => {
    const day = weeks[i];
    for (const [amount, reason, hour] of [[inAmount, inReason, '10'], [-outA, outReasonA, '11'], [-outB, outReasonB, '12']]) {
      balance += amount;
      sql(`INSERT INTO wp_bgr_ledger (manager_id, amount, balance, reason, note, created_at) VALUES (${managerId}, ${amount}, ${balance}, '${reason}', 'test', DATE_SUB('${day} ${hour}:00:00', INTERVAL 2 DAY))`);
    }
    income += inAmount;
    expense += outA + outB;
  });

  let r = await call('finance?season=0', token);
  const f = r.data.finance;
  check('finance view for a past season', r.status === 200 && f.season === 0 && f.seasons.includes(0) && f.seasons.includes(1), `seasons ${f?.seasons}`);
  check('totals match the ledger', f.totals.income === income && f.totals.expense === expense, `${f.totals.income}/${f.totals.expense}`);
  check('one point per rally', f.rallies.length === 6 && f.rallies.every((p, i) => p.income === plan[i][0] && p.expense === plan[i][2] + plan[i][4]), JSON.stringify(f.rallies.map((p) => [p.income, p.expense])));
  check('balance carried per rally', f.rallies.at(-1).balance === balance && f.totals.closing === balance);
  check('categories grouped and sorted', f.income[0].key === 'prize' && f.income[0].amount === 14500 && f.income[0].label === 'Награди от ралита' && f.expense[0].key === 'salary');

  r = await call('finance', token);
  check('current season by default', r.data.finance.season === 1 && r.data.finance.current === true);
  check('current season has the starting money', r.data.finance.income.some((c) => c.key === 'start' && c.amount === 5000), JSON.stringify(r.data.finance.income));
  check('current season ends at the current period', r.data.finance.rallies.length >= 1 && r.data.finance.rallies.at(-1).current === true);
  r = await call('finance?season=7', token);
  check('unknown season falls back to current', r.data.finance.season === 1);
  if (keep) {
    console.log(`kept user fin${stamp} / testtest123, manager ${managerId}`);
  }
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  if (!keep) {
    sql(`DELETE FROM wp_bgr_rallies WHERE name LIKE 'Fin% ${stamp}'`);
    if (managerId) {
      sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${managerId})`);
      for (const t of ['items', 'staff', 'player_cars', 'ledger', 'inbox']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${managerId}`);
      sql(`DELETE FROM wp_bgr_managers WHERE id = ${managerId}`);
    }
    if (userId) {
      for (const t of ['app_tokens']) sql(`DELETE FROM wp_bgr_${t} WHERE user_id = ${userId}`);
      sql(`DELETE FROM wp_usermeta WHERE user_id = ${userId}`);
      sql(`DELETE FROM wp_users WHERE ID = ${userId}`);
    }
  }
}
