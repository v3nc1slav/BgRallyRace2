import puppeteer from 'puppeteer-core';
import { CHROME, OUTPUT, SITE, sql } from '../env.mjs';

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = Date.now();
let userId = 0;
let managerId = 0;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });

async function openMall(page) {
  await page.goto(`${SITE}/#/city/mall`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.bgr-mall-shop', { timeout: 20000 });
  await sleep(300);
}

const tap = (page, shop) => page.$eval(`.bgr-mall-shop[data-shop="${shop}"]`, (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const listTitle = (page) => page.$eval('.bgr-scene-list h2', (el) => el.textContent.trim());
const slots = (page) => page.$$eval('.bgr-scene-list tbody td:first-child small', (list) => [...new Set(list.map((el) => el.textContent.trim()))]);

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
  }, `mal${stamp}`);
  userId = state.user.id;
  managerId = state.player.id;
  sql(`UPDATE wp_bgr_managers SET level = 10, money = 50000 WHERE id = ${managerId}`);
  await page.reload({ waitUntil: 'networkidle0' });

  await openMall(page);
  check('the mall has the gym and three clothes shops to enter', (await page.$$eval('.bgr-mall-shop', (list) => list.map((el) => el.dataset.shop).join(','))) === 'fitness,clothes,shoes,accessories');
  const decor = await page.$$eval('.bgr-mall-decor', (list) => list.map((el) => `${el.dataset.shop}:${el.getAttribute('role') ?? ''}`));
  check('the restaurant, fast food, pet shop and electronics are only to look at', decor.join(',') === 'restaurant:,food:,zoo:,electronics:', decor.join(','));
  check('there is an escalator with three riders', Boolean(await page.$('.bgr-mall-escalator')) && (await page.$$('[clip-path="url(#bgr-mall-below)"] .bgr-mall-rider')).length === 3);
  const order = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.bgr-mall-scene svg *')];
    const index = (selector) => all.indexOf(document.querySelector(selector));
    return { railing: index('.bgr-mall-railing'), above: index('[clip-path="url(#bgr-mall-above)"]'), glass: index('.bgr-mall-glass'), below: index('[clip-path="url(#bgr-mall-below)"]') };
  });
  check('on the upper floor the riders walk behind the railing', order.above >= 0 && order.above < order.railing, JSON.stringify(order));
  check('on the escalator the glass is not drawn over the riders', order.glass >= 0 && order.glass < order.below, JSON.stringify(order));
  const riders = () => page.$$eval('.bgr-mall-rider', (list) => list.map((el) => el.getBoundingClientRect()).map((box) => ({ x: Math.round(box.x), y: Math.round(box.y) })));
  const start = await riders();
  await sleep(1500);
  const later = await riders();
  check('the riders move', start.every((point, index) => point.x !== later[index].x || point.y !== later[index].y), JSON.stringify([start, later]));
  check('a rider walks from the ground floor up the escalator to the upper floor', (await page.$eval('.bgr-mall-rider', (el) => getComputedStyle(el).animationName)) === 'bgr-mall-ride');
  check('people walk around the mall', (await page.$$('.bgr-mall-path')).length >= 4);
  check('the walkers do not block clicks', (await page.$eval('.bgr-mall-walker', (el) => getComputedStyle(el).pointerEvents)) === 'none');
  check('the clothes bonus is below the picture', (await page.$eval('.bgr-mall-info', (el) => el.getBoundingClientRect().top)) >= (await page.$eval('.bgr-mall-scene svg', (el) => el.getBoundingClientRect().bottom)) - 1);
  await page.screenshot({ path: `${OUTPUT}/mall-scene.png` });

  await tap(page, 'fitness');
  await page.waitForSelector('.bgr-scene-list .bgr-row');
  check('the gym opens the crew training', (await listTitle(page)) === 'Фитнес' && (await page.$$('.bgr-scene-list .bgr-row')).length >= 2, await listTitle(page));
  check('the close button takes the keyboard focus', await page.$eval('.bgr-scene-close', (el) => document.activeElement === el));
  await page.$eval('.bgr-scene-list .bgr-row button:not(:disabled)', (el) => el.click());
  await page.waitForSelector('.bgr-toast.ok', { timeout: 8000 });
  check('a crew member can train in the gym', (await page.$eval('.bgr-toast.ok', (el) => el.textContent)).length > 0);
  await close(page);
  check('the close button closes the list', !(await page.$('.bgr-scene-list')));

  await tap(page, 'clothes');
  await page.waitForSelector('.bgr-scene-list tbody tr');
  check('the clothes shop sells suits only', (await listTitle(page)) === 'Дрехи' && (await slots(page)).join(',') === 'Костюм', (await slots(page)).join(','));
  await close(page);

  await tap(page, 'accessories');
  await page.waitForSelector('.bgr-scene-list tbody tr');
  check('the accessories shop sells watches and accessories', (await slots(page)).sort().join(',') === 'Аксесоар,Часовник', (await slots(page)).join(','));
  await close(page);

  await tap(page, 'shoes');
  await page.waitForSelector('.bgr-scene-list tbody tr');
  check('the shoe shop sells shoes only', (await slots(page)).join(',') === 'Обувки', (await slots(page)).join(','));
  await page.$$eval('.bgr-toast-close', (list) => list.forEach((el) => el.click()));
  await sleep(400);
  const before = Number(sql(`SELECT money FROM wp_bgr_managers WHERE id = ${managerId}`));
  await page.$eval('.bgr-scene-list tbody tr:not(.bgr-locked) button:not(.bgr-secondary)', (el) => el.click());
  await page.waitForSelector('.bgr-toast.ok', { timeout: 8000 });
  check('shoes can be bought and are put on', Number(sql(`SELECT money FROM wp_bgr_managers WHERE id = ${managerId}`)) < before && Boolean(await page.$('.bgr-scene-list tr.bgr-me')));
  check('the list stays open after buying', (await listTitle(page)) === 'Обувки');
  await close(page);

  await page.$eval('.bgr-mall-shop[data-shop="clothes"]', (el) => el.focus());
  await page.keyboard.press('Enter');
  await sleep(200);
  check('the keyboard opens a shop', Boolean(await page.$('.bgr-scene-list')));

  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await phone.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
  await phone.evaluate(() => localStorage.setItem('bgr-lang', 'bg'));
  await openMall(phone);
  await tap(phone, 'shoes');
  await phone.waitForSelector('.bgr-scene-list tbody tr');
  check('on a phone the list is not squeezed into the picture', (await phone.$eval('.bgr-scene-list', (el) => el.getBoundingClientRect().height)) > 300);
  check('no sideways scrolling on a phone', (await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  await phone.screenshot({ path: `${OUTPUT}/mall-phone.png` });
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (managerId) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${managerId})`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'contracts', 'inbox']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${managerId}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${managerId}`);
  }
  if (userId) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${userId}`);
    sql(`DELETE FROM wp_users WHERE ID = ${userId}`);
  }
}
