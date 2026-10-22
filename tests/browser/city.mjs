import puppeteer from 'puppeteer-core';
import { CHROME, OUTPUT, SITE, sql } from '../env.mjs';

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = Date.now();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const users = [];
const managers = [];

async function open(width, height, scale, touch) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale, isMobile: touch, hasTouch: touch });
  await page.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
  const state = await page.evaluate(async (name) => {
    const base = document.getElementById('app').dataset.restUrl;
    const res = await fetch(base + 'bgrally/v1/auth/register', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: name, email: `${name}@example.com`, password: 'testtest123', city_id: 1 }) });
    return res.json();
  }, `city${touch ? 'm' : 'd'}${stamp}`);
  users.push(state.user.id);
  managers.push(state.player.id);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.removeItem('bgr-city-mode'));
  await page.goto(`${SITE}/#/city`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.bgr-city-canvas canvas', { timeout: 15000 });
  await sleep(800);
  return page;
}

const CORE = { left: -576, top: -86, width: 1344, height: 756 };
const AREA = { left: -736, top: -166, width: 1664, height: 942 };

async function screenPoint(page, wx, wy) {
  const rect = await page.$eval('.bgr-city-canvas canvas', (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  const fit = Math.min(rect.width / CORE.width, rect.height / CORE.height);
  const center = (core0, coreSize, area0, areaSize, view) => {
    const c = core0 + coreSize / 2;
    if (view >= areaSize) {
      return area0 + areaSize / 2;
    }
    return Math.min(Math.max(c, area0 + view / 2), area0 + areaSize - view / 2);
  };
  const cx = center(CORE.left, CORE.width, AREA.left, AREA.width, rect.width / fit);
  const cy = center(CORE.top, CORE.height, AREA.top, AREA.height, rect.height / fit);
  return { x: rect.left + rect.width / 2 + (wx - cx) * fit, y: rect.top + rect.height / 2 + (wy - cy) * fit };
}

const hallPoint = (page) => screenPoint(page, 20.8, 236.6);

try {
  const desk = await open(1280, 1000, 1, false);
  check('map is shown by default', !!(await desk.$('.bgr-city-canvas canvas')));
  let point = await hallPoint(desk);
  await desk.mouse.move(point.x, point.y);
  await sleep(250);
  const cursor = await desk.$eval('.bgr-city-canvas canvas', (el) => el.style.cursor);
  check('hovering the city hall shows a hand cursor', cursor === 'pointer', cursor);
  await desk.screenshot({ path: `${OUTPUT}/city-hover.png` });
  const sign = await screenPoint(desk, 641.6, 422);
  await desk.mouse.move(sign.x, sign.y);
  await sleep(250);
  check('the entrance sign reacts to hover', (await desk.$eval('.bgr-city-canvas canvas', (el) => el.style.cursor)) === 'pointer');
  await desk.screenshot({ path: `${OUTPUT}/city-sign.png` });
  await desk.mouse.move(point.x, point.y);
  await sleep(250);
  await desk.mouse.click(point.x, point.y);
  await sleep(500);
  check('click opens the city hall', (await desk.evaluate(() => location.hash)) === '#/city/hall');

  await desk.goto(`${SITE}/#/city`, { waitUntil: 'networkidle0' });
  await sleep(500);
  const [list] = await desk.$$('xpath/.//button[normalize-space()="Списък"]');
  await list.click();
  await sleep(300);
  check('list view shows all buildings', (await desk.$$('.bgr-building')).length === 12);
  await desk.reload({ waitUntil: 'networkidle0' });
  await sleep(500);
  check('list choice is remembered', (await desk.$$('.bgr-building')).length === 12 && !(await desk.$('.bgr-city-canvas')));

  const phone = await open(390, 844, 2, true);
  point = await hallPoint(phone);
  await phone.touchscreen.tap(point.x, point.y);
  await sleep(400);
  check('first tap only selects', (await phone.evaluate(() => location.hash)) === '#/city');
  await phone.screenshot({ path: `${OUTPUT}/city-tap.png` });
  await phone.touchscreen.tap(point.x, point.y);
  await sleep(500);
  check('second tap opens the city hall', (await phone.evaluate(() => location.hash)) === '#/city/hall');
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no horizontal overflow on phone', overflow <= 0, `${overflow}px`);
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  await browser.close();
  for (const id of managers) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${id})`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${id}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${id}`);
  }
  for (const user of users) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${user}`);
    sql(`DELETE FROM wp_users WHERE ID = ${user}`);
  }
  console.log('cleanup done');
}
