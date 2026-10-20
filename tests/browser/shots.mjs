import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { BASE, CHROME, HOST, MU, OUTPUT, SITE, WP_LOAD, option, php, settings, sql } from '../env.mjs';

const routes = (process.argv[2] || 'home,garage,city,rallies,shop,market,bar,forum,profile').split(',');
const prefix = process.argv[3] || 'm';
const width = Number(process.argv[4] || 390);
const map = { home: '', garage: 'garage', city: 'city', rallies: 'rallies', shop: 'shop', market: 'city/market', bar: 'city/bar', forum: 'forum', profile: 'profile', bank: 'city/bank', mall: 'city/mall', hall: 'city/hall', sponsors: 'sponsors', standings: 'standings', track: 'city/track', black: 'city/black', jobs: 'city/jobs', police: 'city/police', rally: 'rallies/RALLY', login: 'login' };

const stamp = Date.now();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
let userId = 0;
let managerId = 0;
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height: Number(process.argv[5] || 844), deviceScaleFactor: 1, isMobile: width < 800, hasTouch: width < 800 });
  await page.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
  if (routes.includes('login')) {
    await page.screenshot({ path: `${OUTPUT}/${prefix}-login.png`, fullPage: true });
  }
  const state = await page.evaluate(async (name) => {
    const base = document.getElementById('app').dataset.restUrl;
    const res = await fetch(base + 'bgrally/v1/auth/register', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: name, email: `${name}@example.com`, password: 'testtest123', city_id: 1 }) });
    return res.json();
  }, `shot${stamp}`);
  userId = state.user.id;
  managerId = state.player.id;
  sql(`UPDATE wp_bgr_managers SET level = 12, money = 48000 WHERE id = ${managerId}`);
  await page.reload({ waitUntil: 'networkidle0' });
  const rally = sql("SELECT id FROM wp_bgr_rallies WHERE status = 'scheduled' ORDER BY start_at LIMIT 1") || sql('SELECT id FROM wp_bgr_rallies ORDER BY id DESC LIMIT 1');

  for (const route of routes.filter((r) => r !== 'login')) {
    const path = (map[route] ?? route).replace('RALLY', rally);
    await page.goto(`${SITE}/#/${path}`, { waitUntil: 'networkidle0' });
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise((resolve) => setTimeout(resolve, 600));
    await page.screenshot({ path: `${OUTPUT}/${prefix}-${route}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`${route}: saved${overflow > 0 ? `, horizontal overflow ${overflow}px` : ''}`);
  }
} finally {
  await browser.close();
  if (managerId) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${managerId})`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'ad_views']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${managerId}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${managerId}`);
  }
  if (userId) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${userId}`);
    sql(`DELETE FROM wp_users WHERE ID = ${userId}`);
  }
}
