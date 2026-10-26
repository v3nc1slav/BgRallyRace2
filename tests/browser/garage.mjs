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
const errors = [];
const dialogs = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });

async function openGarage(page) {
  await page.goto(`${SITE}/#/garage`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  try {
    await page.waitForSelector('.bgr-garage svg', { timeout: 20000 });
  } catch {
    await page.screenshot({ path: `${OUTPUT}/garage-failed.png` });
    const text = await page.evaluate(() => document.body.innerText.slice(0, 300));
    throw new Error(`garage did not open at ${await page.evaluate(() => location.hash)}: ${text} ${errors.join(' | ')}`);
  }
  await sleep(500);
}

try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    dialog.accept();
  });
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
  }, `gar${stamp}`);
  userId = state.user.id;
  managerId = state.player.id;
  await page.reload({ waitUntil: 'networkidle0' });

  await openGarage(page);
  check('the garage scene is shown', Boolean(await page.$('.bgr-garage svg')));
  check('every part and the tyres have a balloon', (await page.$$('.bgr-gs-balloon')).length === 7);
  check('the trunk tells what fits for the rally', (await page.$eval('.bgr-gs-trunk', (el) => el.textContent)).includes('2 резервни гуми'));
  check('the window, the clock, the first-aid kit and the extinguisher are there from level 1', Boolean((await page.$('.bgr-gs-window')) && (await page.$('.bgr-gs-clock')) && (await page.$('.bgr-gs-firstaid')) && (await page.$('.bgr-gs-extinguisher'))));
  check('the window follows the time of day', ['day', 'dusk', 'night'].includes(await page.$eval('.bgr-gs-window', (el) => el.dataset.daylight)));
  check('there is no workbench at level 1', !(await page.$('.bgr-gs-bench')));
  const arrow = await page.$('.bgr-gs-up');
  check('the upgrade arrow is inactive without level, money and permit', arrow && !(await arrow.evaluate((el) => el.classList.contains('ready'))));
  await arrow.click();
  await sleep(200);
  const needs = await page.$$eval('.bgr-gs-needs li.bgr-error', (items) => items.map((item) => item.textContent));
  check('pressing it lists what is missing', needs.length === 3, needs.join(' | '));
  await page.screenshot({ path: `${OUTPUT}/garage-level1.png` });

  const feedback = () => page.$eval('.bgr-feedback', (el) => el.textContent).catch(() => '');
  const answer = async (accept = true) => {
    await page.waitForSelector('.bgr-dialog', { timeout: 5000 });
    const text = await page.$eval('.bgr-dialog p', (el) => el.textContent);
    const buttons = await page.$$('.bgr-dialog button');
    await buttons[accept ? 0 : buttons.length - 1].click();
    await sleep(1200);
    return text;
  };
  const tap = (selector) => page.$eval(selector, (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));

  await tap('.bgr-gs-trophies');
  let text = await answer();
  check('the empty trophy shelf explains itself', text.includes('Тук ще стоят купите'), text);

  await (await page.$$('.bgr-gs-balloon'))[1].click();
  text = await answer();
  check('a part in good shape needs no repair', text.includes('Ремонтът няма да подобри'), text);

  sql(`UPDATE wp_bgr_items i JOIN wp_bgr_parts p ON p.id = i.catalog_id SET i.health = 60 WHERE i.manager_id = ${managerId} AND i.kind = 'part' AND i.player_car_id > 0 AND p.type = 'engine'`);
  await openGarage(page);
  await (await page.$$('.bgr-gs-balloon'))[0].click();
  await page.waitForSelector('.bgr-dialog');
  await sleep(400);
  await page.screenshot({ path: `${OUTPUT}/garage-dialog.png` });
  text = await answer();
  check('repairing asks in the game dialog with the price and the energy', text.includes('ремонтираш') && text.includes('енергия') && text.includes('€'), text);
  const engine = Number(sql(`SELECT ROUND(i.health) FROM wp_bgr_items i JOIN wp_bgr_parts p ON p.id = i.catalog_id WHERE i.manager_id = ${managerId} AND i.kind = 'part' AND i.player_car_id > 0 AND p.type = 'engine'`));
  check('the confirmed repair fixes the part', engine > 60, `${engine}% · ${await feedback()}`);
  check('the repair tables are gone', !(await page.$('#garage-slots')) && !(await page.$('#garage-storage')));

  await (await page.$$('.bgr-gs-balloon'))[1].click();
  await page.waitForSelector('.bgr-dialog');
  await page.keyboard.press('Escape');
  await sleep(300);
  check('Escape closes the dialog', !(await page.$('.bgr-dialog')));

  const tyres = sql('SELECT id FROM wp_bgr_tyres ORDER BY id LIMIT 3').split('\n').map(Number);
  const parts = sql('SELECT id FROM wp_bgr_parts ORDER BY id LIMIT 5').split('\n').map(Number);
  const cars = sql(`SELECT id FROM wp_bgr_cars WHERE id <> (SELECT car_id FROM wp_bgr_player_cars WHERE manager_id = ${managerId} LIMIT 1) ORDER BY price LIMIT 1`);
  const sponsors = sql('SELECT id FROM wp_bgr_sponsors ORDER BY id LIMIT 3').split('\n').map(Number);
  sql(`UPDATE wp_bgr_managers SET garage_level = 5, level = 40, money = 300000 WHERE id = ${managerId}`);
  const rows = [
    ...tyres.map((id) => `(${managerId}, 'tyre', ${id}, 0, 100, 100, NOW())`),
    `(${managerId}, 'spare_tyre', ${tyres[0]}, 0, 100, 100, NOW())`,
    `(${managerId}, 'spare_tyre', ${tyres[1]}, 0, 100, 100, NOW())`,
    ...parts.map((id) => `(${managerId}, 'part', ${id}, 0, 100, 100, NOW())`),
  ];
  sql(`INSERT INTO wp_bgr_items (manager_id, kind, catalog_id, player_car_id, health, max_health, created_at) VALUES ${rows.join(', ')}`);
  sql(`INSERT INTO wp_bgr_player_cars (manager_id, car_id, created_at) VALUES (${managerId}, ${cars}, NOW())`);
  const published = sql('SELECT rally_id FROM wp_bgr_rally_runs WHERE published = 1 ORDER BY rally_id LIMIT 3').split('\n').map(Number);
  sql(`INSERT INTO wp_bgr_entries (rally_id, manager_id, class, status, place, created_at) VALUES ${published.map((id, index) => `(${id}, ${managerId}, '3', 'finished', ${index + 1}, NOW())`).join(', ')}`);
  ['doors', 'hood', 'roof'].forEach((slot, index) => {
    sql(`INSERT INTO wp_bgr_contracts (manager_id, sponsor_id, slot, status, progress, payment, goal_place, bonus, weeks, created_at) VALUES (${managerId}, ${sponsors[index]}, '${slot}', 'active', 100, 500, 5, 300, 10, NOW())`);
  });

  await openGarage(page);
  check('the tyre rack shows every stored tyre', (await page.$$('.bgr-gs-tyre')).length === 14, `${(await page.$$('.bgr-gs-tyre')).length}`);
  check('the shelves show every stored part', (await page.$$('.bgr-gs-box')).length === 5, `${(await page.$$('.bgr-gs-box')).length}`);
  check('active sponsors are painted on the car', (await page.$$('.bgr-garage .bgr-gs-sponsor')).length === 3);
  check('the security camera appears with security', Boolean(await page.$('.bgr-gs-led')));
  check('there is no upgrade arrow at the top level', !(await page.$('.bgr-gs-up')));
  check('the second car is parked under the window', Boolean(await page.$('.bgr-gs-parked')));
  check('the trophy shelf shows a cup and two medals', (await page.$$('.bgr-gs-trophy')).length === 3, `${(await page.$$('.bgr-gs-trophy')).length}`);
  check('the workbench has grown to the diagnostic screen', Boolean((await page.$('.bgr-gs-bench')) && (await page.$('.bgr-gs-monitor'))));
  await tap('.bgr-gs-trophies');
  text = await answer();
  check('the trophy shelf sums up the results', text.includes('Победи: 1') && text.includes('Втори места: 1'), text);
  await page.screenshot({ path: `${OUTPUT}/garage-level5.png` });

  await tap('.bgr-gs-box:not(.bgr-gs-dim)');
  text = await answer();
  check('a shelf part asks before it replaces the fitted one', text.includes('смениш') && text.includes('енергия'), text);
  check('the confirmed part is fitted', /монтира|Монтирано/.test(await feedback()), await feedback());

  await tap('.bgr-gs-tyre:not(.bgr-gs-dim)');
  text = await answer(false);
  check('a tyre set on the rack asks before it is fitted', text.includes('смениш'), text);
  await tap('.bgr-gs-tyre.bgr-gs-dim');
  text = await answer();
  check('a spare tyre is explained, not fitted', text.includes('резервна гума'), text);

  const before = await page.$eval('h1', (el) => el.textContent);
  await page.$eval('.bgr-gs-parked', (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await sleep(1200);
  const after = await page.$eval('h1', (el) => el.textContent);
  check('clicking the parked car puts it on the jack', before !== after, `${before} → ${after}`);

  await page.click('.bgr-gs-door');
  await sleep(800);
  check('the staff door opens the staff view', (await page.evaluate(() => location.hash)) === '#/garage/staff' && (await page.$$('.bgr-table tbody tr')).length >= 2);

  const phone = await browser.newPage();
  phone.on('pageerror', (error) => errors.push(error.message));
  await phone.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('bgr-lang', 'bg');
    } catch {}
  });
  await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await openGarage(phone);
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('no horizontal overflow on phone', overflow <= 0, `${overflow}px`);
  check('balloons are compact on phone', Boolean(await phone.$('.bgr-garage-compact')));
  await phone.screenshot({ path: `${OUTPUT}/garage-phone.png` });
  check('no browser pop-ups were used', dialogs.length === 0, dialogs.join(' | '));
  check('no script errors', errors.length === 0, errors.join(' | '));
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
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${userId}`);
    sql(`DELETE FROM wp_users WHERE ID = ${userId}`);
  }
  console.log('cleanup done');
}
