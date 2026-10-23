import puppeteer from 'puppeteer-core';
import { BASE, CHROME, SITE, sql } from '../env.mjs';

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const name = `lg${Date.now()}`;
let userId = 0;
let managerId = 0;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });

try {
  const created = await (await fetch(BASE + 'auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email: `${name}@example.com`, password: 'testtest123', city_id: 1 }),
  })).json();
  userId = created.user.id;
  managerId = created.player.id;

  const firstOpen = async (zone) => {
    const tab = await browser.newPage();
    await tab.emulateTimezone(zone);
    await tab.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
    const code = await tab.evaluate(() => document.documentElement.lang);
    await tab.close();
    return code;
  };
  check('first open in a Bulgarian time zone is in Bulgarian', (await firstOpen('Europe/Sofia')) === 'bg');
  check('first open elsewhere is in English', (await firstOpen('Europe/London')) === 'en');

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('bgr-lang', 'bg');
    } catch {}
  });
  const rejected = [];
  let sessions = 0;
  page.on('request', (req) => req.url().includes('/bgrally/v1/me') && sessions++);
  page.on('response', async (res) => {
    if (res.status() === 403 && res.url().includes('/wp-json/')) rejected.push(await res.text().catch(() => ''));
  });

  await page.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
  await page.type('input[autocomplete=username]', name);
  await page.type('input[type=password]', 'testtest123');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#/', { timeout: 15000 });
  await sleep(1000);

  const tapped = await page.evaluate(() => {
    const link = [...document.querySelectorAll('a')].find((el) => (el.getAttribute('href') ?? '').endsWith('/city') && el.offsetParent);
    link?.click();
    return Boolean(link);
  });
  check('city tab is shown after login', tapped);
  await page.waitForSelector('.bgr-city-canvas canvas', { timeout: 30000 }).catch(() => null);
  await sleep(1500);
  check('player stays logged in after opening the city', (await page.evaluate(() => location.hash)) === '#/city', await page.evaluate(() => location.hash));
  check('the city map loads', Boolean(await page.$('.bgr-city-canvas canvas')));
  check('the game starts only once', sessions === 1, `${sessions} session requests`);
  check('no rejected requests', rejected.length === 0, rejected.join(' | ').slice(0, 200));
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (managerId) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${managerId})`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${managerId}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${managerId}`);
  }
  if (userId) {
    for (const t of ['app_tokens', 'push_devices', 'push_queue']) sql(`DELETE FROM wp_bgr_${t} WHERE user_id = ${userId}`);
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${userId}`);
    sql(`DELETE FROM wp_users WHERE ID = ${userId}`);
  }
  console.log('cleanup done');
}
