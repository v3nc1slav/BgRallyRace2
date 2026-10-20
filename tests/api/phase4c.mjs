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
const A = client();
const B = client();
const ids = [];
const users = [];
const money = (id) => Number(sql(`SELECT money FROM wp_bgr_managers WHERE id = ${id}`));
const oldWeek = (id) => sql(`UPDATE wp_bgr_managers SET payroll_week = '2000-01' WHERE id = ${id}`);

async function register(api, prefix, city) {
  await api('GET', 'me');
  const r = await api('POST', 'auth/register', { username: `${prefix}${stamp}`, email: `${prefix}${stamp}@example.com`, password: 'testtest123', city_id: city });
  ids.push(r.data.player.id);
  users.push(r.data.user.id);
  return r.data.player.id;
}

try {
  const a = await register(A, 'ma', 1);
  const b = await register(B, 'mb', 2);
  check('two players in different cities', !!a && !!b);
  const partId = Number(sql('SELECT id FROM wp_bgr_parts WHERE active = 1 AND min_level <= 1 ORDER BY price LIMIT 1'));
  const carId = Number(sql("SELECT id FROM wp_bgr_cars WHERE active = 1 AND class = '3' ORDER BY price LIMIT 1"));

  let r = await A('POST', 'shop/buy', { kind: 'part', id: partId });
  r = await A('GET', 'market');
  const offer = r.data.market.sellable[0];
  check('market view with sellable item', r.status === 200 && r.data.market.sellable.length === 1 && !r.data.market.rules.can_sell, `${offer?.name} base ${offer?.base} range ${offer?.min}-${offer?.max} dealer ${offer?.dealer}`);
  r = await A('POST', 'market/list', { kind: offer.kind, id: offer.id, price: offer.max });
  check('selling refused below level 3', r.status === 400, r.data.message);

  sql(`UPDATE wp_bgr_managers SET level = 5, money = 100000 WHERE id = ${a}`);
  r = await A('POST', 'market/list', { kind: offer.kind, id: offer.id, price: offer.max + 1 });
  check('price above max refused', r.status === 400, r.data.message);
  const energyBefore = (await A('GET', 'me')).data.player.energy;
  r = await A('POST', 'market/list', { kind: offer.kind, id: offer.id, price: offer.max });
  check('item listed', r.status === 200 && r.data.market.mine.length === 1 && r.data.market.sellable.length === 0 && r.data.player.energy === energyBefore - 5, r.data.message);
  const listingId = r.data.market.mine[0].id;
  r = await A('GET', 'garage');
  check('listed item left the storage', r.data.garage.storage.length === 0);

  r = await B('GET', 'market?scope=city');
  check('other city listing hidden in city scope', !r.data.market.listings.some((l) => l.id === listingId));
  r = await B('GET', 'market');
  const seen = r.data.market.listings.find((l) => l.id === listingId);
  check('buyer sees listing with delivery, defect hidden', !!seen && seen.delivery > 0 && seen.details.defect === null, `price ${seen?.price} delivery ${seen?.delivery} seller ${seen?.seller} ${seen?.city}`);
  const aBefore = money(a);
  const bBefore = money(b);
  r = await B('POST', 'market/buy', { id: listingId });
  const fee = Math.round(seen.price * 0.05);
  check('buy pays price and delivery', r.status === 200 && money(b) === bBefore - seen.price - seen.delivery, r.data.message);
  check('seller paid minus 5%', money(a) === aBefore + seen.price - fee, `${aBefore} -> ${money(a)}`);
  r = await B('GET', 'garage');
  check('bought item in buyer storage', r.data.garage.storage.length === 1);
  r = await A('POST', 'market/buy', { id: listingId });
  check('sold listing cannot be bought again', r.status === 404, r.data.message);

  await A('POST', 'shop/buy', { kind: 'part', id: partId });
  r = await A('GET', 'market');
  let item = r.data.market.sellable[0];
  r = await A('POST', 'market/list', { kind: item.kind, id: item.id, price: item.min });
  r = await A('POST', 'market/cancel', { id: r.data.market.mine[0].id });
  check('cancel returns item', r.status === 200 && r.data.market.sellable.length === 1, r.data.message);
  const before = money(a);
  r = await A('POST', 'market/dealer', { kind: item.kind, id: item.id });
  check('dealer buys at 25%', r.status === 200 && money(a) === before + item.dealer && r.data.market.sellable.length === 0, r.data.message);

  await A('POST', 'shop/buy', { kind: 'part', id: partId });
  r = await A('GET', 'market');
  item = r.data.market.sellable[0];
  r = await A('POST', 'market/list', { kind: item.kind, id: item.id, price: item.min });
  sql(`UPDATE wp_bgr_listings SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE seller_id = ${a} AND status = 'active'`);
  r = await A('GET', 'market');
  check('expired listing returns item', r.data.market.mine.length === 0 && r.data.market.sellable.length === 1);

  sql(`UPDATE wp_bgr_managers SET garage_level = 5 WHERE id = ${a}`);
  r = await A('POST', 'shop/buy-car', { id: carId });
  r = await A('GET', 'garage');
  const active = r.data.garage.cars.find((c) => c.active);
  const spare = r.data.garage.cars.find((c) => !c.active);
  r = await A('POST', 'market/list', { kind: 'car', id: active.player_car_id, price: 1000 });
  check('active car cannot be sold', r.status === 400, r.data.message);
  r = await A('GET', 'market');
  const carOffer = r.data.market.sellable.find((s) => s.kind === 'car');
  r = await A('POST', 'market/list', { kind: 'car', id: spare.player_car_id, price: carOffer.min });
  check('second car listed', r.status === 200, `${r.data.message} base ${carOffer.base}`);
  const carListing = r.data.market.mine.find((l) => l.kind === 'car');
  sql(`UPDATE wp_bgr_managers SET money = 100000 WHERE id = ${b}`);
  r = await B('POST', 'market/buy', { id: carListing.id });
  check('car refused without garage space', r.status === 400, r.data.message);
  sql(`UPDATE wp_bgr_managers SET garage_level = 5 WHERE id = ${b}`);
  r = await B('POST', 'market/buy', { id: carListing.id });
  const parts = Number(sql(`SELECT COUNT(*) FROM wp_bgr_items WHERE player_car_id = ${spare.player_car_id} AND manager_id = ${b}`));
  check('car bought with its parts', r.status === 200 && parts >= 6, `${r.data.message} parts ${parts}`);

  r = await B('GET', 'bank');
  check('bank view', r.status === 200 && r.data.bank.max === 2000 && !r.data.bank.loan, `terms ${r.data.bank.terms.map((t) => `${t.weeks}w ${t.rate}%`).join(', ')}`);
  r = await B('POST', 'bank/loan', { amount: 3000, weeks: 4 });
  check('loan above max refused', r.status === 400, r.data.message);
  const bMoney = money(b);
  r = await B('POST', 'bank/loan', { amount: 2000, weeks: 4 });
  check('loan taken', r.status === 200 && money(b) === bMoney + 2000 && r.data.bank.loan.remaining === 2100 && r.data.bank.loan.installment === 525, r.data.message);
  r = await B('POST', 'bank/loan', { amount: 500, weeks: 8 });
  check('second loan refused', r.status === 400, r.data.message);

  oldWeek(b);
  r = await B('GET', 'bank');
  check('monday installment paid', r.data.bank.loan.remaining === 1575 && r.data.player.loan.remaining === 1575, `remaining ${r.data.bank.loan.remaining}`);

  sql(`UPDATE wp_bgr_managers SET money = 0 WHERE id = ${b}`);
  oldWeek(b);
  r = await B('GET', 'bank');
  const loan = r.data.bank.loan;
  check('missed installment adds penalty', loan.overdue === 525 + 53 && loan.missed === 1 && loan.remaining === 1575 + 53, `overdue ${loan.overdue} remaining ${loan.remaining}`);
  r = await B('POST', 'shop/buy', { kind: 'part', id: partId });
  check('shop blocked while overdue', r.status === 400, r.data.message);
  r = await B('GET', 'market');
  check('market shows block', r.data.market.rules.blocked === true);

  sql(`UPDATE wp_bgr_managers SET money = 1000 WHERE id = ${b}`);
  r = await B('POST', 'bank/pay');
  check('pay overdue unblocks', r.status === 200 && r.data.bank.loan.overdue === 0 && r.data.bank.loan.remaining === 1050, r.data.message);

  sql(`UPDATE wp_bgr_managers SET money = 0 WHERE id = ${b}`);
  oldWeek(b);
  await B('GET', 'me');
  sql(`UPDATE wp_bgr_managers SET money = 0 WHERE id = ${b}`);
  oldWeek(b);
  r = await B('GET', 'bank');
  const seized = (await B('GET', 'inbox')).data.inbox.find((x) => x.text.startsWith('Запор'));
  check('second miss triggers seizure', !!seized && r.data.bank.loan?.overdue !== undefined ? r.data.bank.loan.overdue === 0 : !!seized, seized?.text);
  r = await B('GET', 'garage');
  check('seized assets removed', r.data.garage.storage.length === 0 || r.data.garage.cars.length === 1, `storage ${r.data.garage.storage.length}, cars ${r.data.garage.cars.length}, money ${r.data.player.money}`);

  r = await A('POST', 'bank/loan', { amount: 8000, weeks: 8 });
  oldWeek(a);
  r = await A('GET', 'bank');
  const early = r.data.bank.loan;
  const aMoney = money(a);
  r = await A('POST', 'bank/repay');
  check('early repay skips future interest', r.status === 200 && !r.data.bank.loan && money(a) === aMoney - early.payoff && early.payoff < early.remaining, `remaining ${early.remaining}, payoff ${early.payoff}`);

  r = await A('POST', 'chat', { text: 'Здравейте от София!' });
  check('chat message posted', r.status === 200 && r.data.chat.messages.some((m) => m.text === 'Здравейте от София!' && m.own), JSON.stringify(r.data).slice(0, 200));
  const messageId = r.data.chat.messages.at(-1).id;
  r = await A('POST', 'chat', { text: 'пак' });
  check('cooldown between messages', r.status === 429, r.data.message);
  r = await B('GET', 'chat');
  check('other city does not see the chat', !r.data.chat.messages.some((m) => m.id === messageId));
  r = await A('GET', `chat?after=${messageId - 1}`);
  check('polling returns new messages only', r.data.chat.messages.length === 1);

  const word = `CONVERT(X'${Buffer.from('глупак').toString('hex')}' USING utf8mb4)`;
  sql(`INSERT INTO wp_options (option_name, option_value, autoload) VALUES ('bgr_bad_words', ${word}, 'no') ON DUPLICATE KEY UPDATE option_value = ${word}`);
  sql(`UPDATE wp_bgr_messages SET created_at = DATE_SUB(created_at, INTERVAL 1 MINUTE) WHERE manager_id = ${a}`);
  r = await A('POST', 'chat', { text: 'Ти си Глупак!' });
  check('bad words filtered', r.data.chat?.messages.at(-1).text === 'Ти си ***!', r.data.chat?.messages.at(-1).text);
  sql(`UPDATE wp_bgr_messages SET created_at = DATE_SUB(created_at, INTERVAL 1 MINUTE) WHERE manager_id = ${a}`);
  r = await A('POST', 'chat', { text: 'x'.repeat(301) });
  check('long message refused', r.status === 400, r.data.message);

  r = await B('POST', 'talk/report', { id: messageId });
  check('report message', r.status === 200 && sql(`SELECT reports FROM wp_bgr_messages WHERE id = ${messageId}`) === '1', r.data.message);

  r = await B('POST', 'forum/topics', { section: 'general', title: 'Тема', text: 'Текст' });
  check('topic needs level 3', r.status === 400, r.data.message);
  r = await A('POST', 'forum/topics', { section: 'rallies', title: 'Кой кара в неделя?', text: 'Пишете тук.' });
  const topicId = r.data.topic?.topic.id;
  check('topic created', r.status === 200 && r.data.topic.posts.length === 1, r.data.message);
  r = await B('POST', `forum/topics/${topicId}/reply`, { text: 'Аз съм записан.' });
  check('reply posted', r.status === 200 && r.data.topic.posts.length === 2 && r.data.topic.topic.posts === 2, r.data.message);
  r = await B('GET', 'forum?section=rallies');
  check('forum index lists topic', r.data.forum.topics.some((t) => t.id === topicId) && r.data.forum.sections.find((s) => s.key === 'rallies').topics >= 1);

  sql(`UPDATE wp_bgr_managers SET muted_until = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ${b}`);
  r = await B('POST', `forum/topics/${topicId}/reply`, { text: 'Още' });
  check('muted player cannot post', r.status === 403, r.data.message);
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  sql("DELETE FROM wp_options WHERE option_name = 'bgr_bad_words'");
  for (const id of ids) {
    sql(`DELETE FROM wp_bgr_messages WHERE channel IN (SELECT CONCAT('topic-', t.id) FROM wp_bgr_topics t WHERE t.manager_id = ${id})`);
    sql(`DELETE FROM wp_bgr_topics WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_messages WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_listings WHERE seller_id = ${id}`);
    sql(`DELETE FROM wp_bgr_loans WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${id})`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'bribes', 'mayor_requests']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${id}`);
  }
  for (const user of users) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${user}`);
  }
  console.log('cleanup done');
}
