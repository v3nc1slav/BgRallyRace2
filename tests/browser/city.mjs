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
const errors = [];

async function open(width, height, scale, touch, night = '') {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('bgr-lang', 'bg');
    } catch {}
  });
  if (night) {
    await page.emulateTimezone(night);
  }
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
  const logs = [];
  page.on('console', (message) => message.type() === 'error' && logs.push(message.text()));
  page.on('requestfailed', (request) => logs.push(`failed ${request.url()} ${request.failure()?.errorText}`));
  try {
    await page.waitForSelector('.bgr-city-canvas canvas', { timeout: 30000 });
  } catch (error) {
    const list = (await page.$('.bgr-building')).length;
    throw new Error(`map did not start (list view: ${list}): ${[...errors, ...logs].join(' | ')}`);
  }
  await sleep(800);
  return page;
}

const CORE = { left: -960, top: -278, width: 2112, height: 1140 };
const AREA = { left: -1280, top: -358, width: 2752, height: 1486 };

async function screenPoint(page, wx, wy) {
  const rect = await page.$eval('.bgr-city-canvas canvas', (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  const phone = rect.width < 640;
  const fit = Math.min(rect.width / CORE.width, rect.height / CORE.height) * (phone ? PHONE.zoom : 1);
  const center = (c, area0, areaSize, view) => (view >= areaSize ? area0 + areaSize / 2 : Math.min(Math.max(c, area0 + view / 2), area0 + areaSize - view / 2));
  const cx = center(phone ? PHONE.x : CORE.left + CORE.width / 2, AREA.left, AREA.width, rect.width / fit);
  const cy = center(phone ? PHONE.y : CORE.top + CORE.height / 2, AREA.top, AREA.height, rect.height / fit);
  return { x: rect.left + rect.width / 2 + (wx - cx) * fit, y: rect.top + rect.height / 2 + (wy - cy) * fit };
}

const PHONE = { zoom: 2.6, x: -22.4, y: 243.2 };

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
  const sign = await screenPoint(desk, 827.2, 515);
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
  await desk.waitForSelector('.bgr-city-canvas canvas');
  await sleep(800);
  const official = await screenPoint(desk, -232, 656);
  await desk.mouse.click(official.x, official.y);
  await sleep(500);
  check('the road sign opens the official track', (await desk.evaluate(() => location.hash)) === '#/city/track');

  await desk.goto(`${SITE}/#/city`, { waitUntil: 'networkidle0' });
  await desk.waitForSelector('.bgr-city-canvas canvas');
  await sleep(800);
  const box = await desk.$eval('.bgr-city-canvas canvas', (el) => el.getBoundingClientRect().toJSON());
  const black = await screenPoint(desk, 793.6, 678.4);
  const [plus] = await desk.$$('xpath/.//button[normalize-space()="+"]');
  await plus.click();
  await sleep(900);
  const zoomed = { x: box.x + box.width / 2 + (black.x - box.x - box.width / 2) * 1.3, y: box.y + box.height / 2 + (black.y - box.y - box.height / 2) * 1.3 };
  await desk.mouse.move(zoomed.x, zoomed.y);
  await sleep(250);
  check('the zoom button zooms in and keeps the zoom', (await desk.$eval('.bgr-city-canvas canvas', (el) => el.style.cursor)) === 'pointer');

  const [list] = await desk.$$('xpath/.//button[normalize-space()="Списък"]');
  await list.click();
  await sleep(300);
  check('list view shows all buildings', (await desk.$$('.bgr-building')).length === 12);
  await desk.reload({ waitUntil: 'networkidle0' });
  await sleep(500);
  check('list choice is remembered', (await desk.$$('.bgr-building')).length === 12 && !(await desk.$('.bgr-city-canvas')));

  const phone = await open(390, 844, 2, true, process.env.BGR_NIGHT_TZ || 'America/Sao_Paulo');
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
  check('no script errors on the map', errors.length === 0, errors.join(' | '));
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
