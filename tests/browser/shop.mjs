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

async function openShop(page) {
  await page.goto(`${SITE}/#/shop`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.bgr-shop-section', { timeout: 20000 });
  await sleep(300);
}

const section = (page, key) => page.$eval(`.bgr-shop-section[data-section="${key}"]`, (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));

async function answer(page, accept) {
  await page.waitForSelector('.bgr-dialog', { timeout: 5000 });
  await page.$$eval('.bgr-dialog button', (buttons, yes) => buttons[yes ? buttons.length - 1 : 0].click(), accept);
  await sleep(300);
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
  }, `shp${stamp}`);
  userId = state.user.id;
  managerId = state.player.id;
  await page.reload({ waitUntil: 'networkidle0' });

  await openShop(page);
  check('the shop is a scene with three sections', (await page.$$('.bgr-shop-section')).length === 3);
  check('the tab buttons are gone', !(await page.$('.bgr-tabs')));
  check('the seller greets the player', (await page.$eval('.bgr-shop-talk', (el) => el.textContent)).includes('Добре дошли'));
  const scene = await page.$eval('.bgr-shop-scene', (el) => el.getBoundingClientRect().toJSON());
  const info = await page.$eval('.bgr-shop-info', (el) => ({ top: el.getBoundingClientRect().top, text: el.textContent }));
  check('the prices are below the picture', info.top >= scene.bottom - 1 && info.text.includes('Цени в магазина'), `${info.top} / ${scene.bottom}`);
  check('no list is open at first', !(await page.$('.bgr-shop-list')));
  await page.screenshot({ path: `${OUTPUT}/shop-scene.png` });

  await section(page, 'parts');
  await page.waitForSelector('.bgr-shop-list tbody tr');
  const list = await page.$eval('.bgr-shop-list', (el) => {
    const box = el.getBoundingClientRect();
    const close = el.querySelector('.bgr-shop-close').getBoundingClientRect();
    return { top: box.top, right: box.right, closeTop: close.top, closeRight: close.right, color: getComputedStyle(el).backgroundColor, title: el.querySelector('h2').textContent };
  });
  check('the list opens over the picture', Math.abs(list.top - scene.top) <= 2, `${list.top} / ${scene.top}`);
  check('the list is see-through', /rgba\(.*, 0\.\d+\)/.test(list.color), list.color);
  check('the close button is in the top right corner', list.right - list.closeRight < 30 && list.closeTop - list.top < 30, JSON.stringify(list));
  check('the list has the section title', list.title === 'Авто части', list.title);
  check('the balloon hides behind the open list', (await page.$eval('.bgr-shop-talk', (el) => getComputedStyle(el).visibility)) === 'hidden');
  check('the close button takes the keyboard focus', await page.$eval('.bgr-shop-close', (el) => document.activeElement === el));
  await page.screenshot({ path: `${OUTPUT}/shop-parts.png` });
  await page.click('.bgr-shop-close');
  await sleep(200);
  check('the close button closes the list', !(await page.$('.bgr-shop-list')));

  await section(page, 'tyres');
  await page.waitForSelector('.bgr-shop-list tbody tr');
  const before = Number(sql(`SELECT money FROM wp_bgr_managers WHERE id = ${managerId}`));
  await page.$eval('.bgr-shop-list tbody tr:not(.bgr-locked) button:not(:disabled)', (el) => el.click());
  await page.waitForSelector('.bgr-shop-list .bgr-ok', { timeout: 8000 });
  check('tyres can be bought from the list', Number(sql(`SELECT money FROM wp_bgr_managers WHERE id = ${managerId}`)) < before);
  check('the list stays open after a purchase', Boolean(await page.$('.bgr-shop-list tbody tr')));
  await page.click('.bgr-shop-close');

  await section(page, 'cars');
  await page.waitForSelector('.bgr-shop-list tbody tr');
  check('the cars list opens', (await page.$eval('.bgr-shop-list h2', (el) => el.textContent)) === 'Коли');
  await page.$eval('.bgr-shop-list tbody tr:not(.bgr-locked) button:not(:disabled)', (el) => el.click()).catch(() => undefined);
  if (await page.$('.bgr-dialog')) {
    await answer(page, false);
  }
  await page.click('.bgr-shop-close');
  await page.$eval('.bgr-shop-section[data-section="parts"]', (el) => el.focus());
  await page.keyboard.press('Space');
  await sleep(200);
  check('the keyboard opens a section', Boolean(await page.$('.bgr-shop-list')));

  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await phone.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
  await phone.evaluate(() => localStorage.setItem('bgr-lang', 'bg'));
  await openShop(phone);
  const talk = await phone.$eval('.bgr-shop-talk', (el) => ({ position: getComputedStyle(el).position, top: el.getBoundingClientRect().top, svg: el.previousElementSibling.getBoundingClientRect().bottom }));
  check('on a phone the balloon sits under the picture', talk.position === 'relative' && talk.top >= talk.svg, JSON.stringify(talk));
  await section(phone, 'parts');
  await phone.waitForSelector('.bgr-shop-list tbody tr');
  check('on a phone the list is not squeezed into the picture', (await phone.$eval('.bgr-shop-list', (el) => el.getBoundingClientRect().height)) > 400);
  check('no sideways scrolling on a phone', (await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  await phone.screenshot({ path: `${OUTPUT}/shop-phone.png` });
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
