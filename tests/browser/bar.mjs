import puppeteer from 'puppeteer-core';
import { BASE, CHROME, OUTPUT, SITE, sql } from '../env.mjs';

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = Date.now();
let userId = 0;
let managerId = 0;
let friend = null;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });

async function openBar(page) {
  await page.goto(`${SITE}/#/city/bar`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.bgr-bar-table', { timeout: 20000 });
  await sleep(300);
}

const tap = (page, selector) => page.$eval(selector, (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const listTitle = (page) => page.$eval('.bgr-scene-list h2', (el) => el.textContent.trim());

async function answer(page, accept) {
  await page.waitForSelector('.bgr-dialog', { timeout: 5000 });
  await page.$$eval('.bgr-dialog button', (buttons, yes) => buttons[yes ? 0 : buttons.length - 1].click(), accept);
  await sleep(300);
}

async function close(page) {
  await page.click('.bgr-scene-close');
  await sleep(200);
}

try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('bgr-lang', 'bg');
    } catch {}
  });
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
  const state = await page.evaluate(async (name) => {
    const base = document.getElementById('app').dataset.restUrl;
    const res = await fetch(base + 'bgrally/v1/auth/register', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: name, email: `${name}@example.com`, password: 'testtest123', city_id: 1 }) });
    return res.json();
  }, `bar${stamp}`);
  userId = state.user.id;
  managerId = state.player.id;
  await page.reload({ waitUntil: 'networkidle0' });
  sql(`INSERT INTO wp_bgr_candidates (city_id, week, role, name, skill, created_at) VALUES (1, DATE_FORMAT(NOW(), '%x-%v'), 'pilot', 'Test ${stamp}', 40, NOW())`);

  await openBar(page);
  check('there is a table for each of the 8 roles', (await page.$$('.bgr-bar-table')).length === 8);
  const talks = await page.$$eval('.bgr-scene-talk', (list) => list.map((el) => el.textContent));
  check('the bartender and the chat table have balloons', talks.length === 2 && talks[0].includes('слуховете') && talks[1].includes('поговорим'), JSON.stringify(talks));
  const locked = (await page.$$('.bgr-bar-table[data-locked]')).length;
  check('locked roles are reserved tables', locked > 0 && (await page.$$('.bgr-bar-plate.locked')).length === locked && (await page.$$eval('.bgr-bar-plate.locked', (list) => list.every((el) => el.textContent.includes('Резервирано')))), `${locked}`);
  check('a hired role has a check mark', Boolean(await page.$('.bgr-bar-hired')));
  check('there are 4 bar stools with a guest on the second', (await page.$$eval('.bgr-bar-stool', (list) => list.map((el) => (el.querySelector('.bgr-bar-guest') ? 1 : 0)).join(''))) === '0100');

  sql(`UPDATE wp_bgr_managers SET chat_seen = (SELECT IFNULL(MAX(id), 0) FROM wp_bgr_messages) WHERE id = ${managerId}`);
  await openBar(page);
  check('no unread mark without new messages', !(await page.$('.bgr-bar-unread')));
  const reg = await (await fetch(`${BASE}auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: `fr${stamp}`, email: `fr${stamp}@example.com`, password: 'testtest123', city_id: 1, mode: 'token', device: 'test' }) })).json();
  friend = { user: reg.user.id, id: reg.player.id };
  await fetch(`${BASE}chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${reg.token}` }, body: JSON.stringify({ text: `hello ${stamp}` }) });
  await openBar(page);
  check('a red mark shows unread chat messages', Boolean(await page.$('.bgr-bar-unread')));
  const [, chatBalloon] = await page.$$('.bgr-scene-talk');
  await chatBalloon.click();
  await page.waitForSelector('.bgr-scene-list .bgr-chat-form', { timeout: 8000 });
  await close(page);
  check('reading the chat clears the mark', !(await page.$('.bgr-bar-unread')));
  await openBar(page);
  check('the mark stays cleared after a reload', !(await page.$('.bgr-bar-unread')));
  check('the text about new candidates is below the picture', (await page.$eval('.bgr-bar-info', (el) => el.getBoundingClientRect().top)) >= (await page.$eval('.bgr-bar-scene svg', (el) => el.getBoundingClientRect().bottom)) - 1);
  check('no list is open at first', !(await page.$('.bgr-scene-list')));
  await page.screenshot({ path: `${OUTPUT}/bar-scene.png` });

  await tap(page, '.bgr-bar-table[data-role="pilot"]');
  await page.waitForSelector('.bgr-scene-list tbody tr');
  check('a table opens its candidates', (await listTitle(page)) === 'Пилот' && (await page.$$('.bgr-scene-list tbody tr')).length > 0, await listTitle(page));
  check('the close button takes the keyboard focus', await page.$eval('.bgr-scene-close', (el) => document.activeElement === el));
  check('the balloons hide behind the open list', (await page.$eval('.bgr-scene-talk', (el) => getComputedStyle(el).visibility)) === 'hidden');
  await page.$$eval('.bgr-scene-list tbody tr', (rows, name) => rows.find((row) => row.textContent.includes(name)).querySelector('button').click(), `Test ${stamp}`);
  await answer(page, true);
  await page.waitForSelector('.bgr-scene-list .bgr-ok', { timeout: 8000 });
  check('a candidate can be hired from the list', (await page.$eval('.bgr-scene-list .bgr-ok', (el) => el.textContent)).length > 0);
  check('the list stays open after hiring', (await listTitle(page)) === 'Пилот');
  await close(page);
  check('the close button closes the list', !(await page.$('.bgr-scene-list')));

  await tap(page, '.bgr-bar-table[data-locked]');
  await page.waitForSelector('.bgr-dialog');
  check('a reserved table tells when it opens', (await page.$eval('.bgr-dialog', (el) => el.textContent)).includes('Отключва се с гараж ниво'));
  await answer(page, true);
  check('a reserved table opens no list', !(await page.$('.bgr-scene-list')));

  await page.click('.bgr-scene-talk[data-tail]');
  await page.waitForSelector('.bgr-scene-list h2');
  check('the bartender opens the rumors', (await listTitle(page)) === 'Слухове');
  await close(page);
  await tap(page, '[data-spot="rumors"]');
  await page.waitForSelector('.bgr-scene-list h2');
  check('the bar itself opens the rumors too', (await listTitle(page)) === 'Слухове');
  await close(page);

  const [, chatTalk] = await page.$$('.bgr-scene-talk');
  await chatTalk.click();
  await page.waitForSelector('.bgr-scene-list .bgr-chat-form', { timeout: 8000 });
  check('the chat table opens the city chat', (await listTitle(page)) === 'Чат на града');
  await close(page);

  await page.$eval('.bgr-bar-table[data-role="navigator"]', (el) => el.focus());
  await page.keyboard.press('Space');
  await sleep(200);
  check('the keyboard opens a table', Boolean(await page.$('.bgr-scene-list')));

  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await phone.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
  await phone.evaluate(() => localStorage.setItem('bgr-lang', 'bg'));
  await openBar(phone);
  const layout = await phone.evaluate(() => {
    const svg = document.querySelector('.bgr-bar-scene svg').getBoundingClientRect();
    const talks = [...document.querySelectorAll('.bgr-scene-talk')].map((el) => el.getBoundingClientRect().top);
    const plates = [...document.querySelectorAll('.bgr-bar-plate')].map((el) => el.getBoundingClientRect().bottom);
    return { bottom: svg.bottom, talks, plates };
  });
  check('on a phone the balloons sit under the picture', layout.talks.every((top) => top >= layout.bottom), JSON.stringify(layout));
  check('on a phone the plates stay on the picture', layout.plates.every((bottom) => bottom <= layout.bottom + 1), JSON.stringify(layout.plates));
  check('no sideways scrolling on a phone', (await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  await phone.screenshot({ path: `${OUTPUT}/bar-phone.png` });
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (friend) {
    sql(`DELETE FROM wp_bgr_messages WHERE manager_id = ${friend.id}`);
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${friend.id})`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'inbox']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${friend.id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${friend.id}`);
    sql(`DELETE FROM wp_bgr_app_tokens WHERE user_id = ${friend.user}`);
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${friend.user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${friend.user}`);
  }
  if (managerId) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${managerId})`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'contracts', 'inbox']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${managerId}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${managerId}`);
  }
  sql(`DELETE FROM wp_bgr_candidates WHERE name = 'Test ${stamp}'`);
  if (userId) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${userId}`);
    sql(`DELETE FROM wp_users WHERE ID = ${userId}`);
  }
}
