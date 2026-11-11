import puppeteer from 'puppeteer-core';
import { CHROME, OUTPUT, SITE, sql } from '../env.mjs';

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stamp = Date.now();
const rallyName = `Police test ${stamp}`;
let userId = 0;
let managerId = 0;
let rallyId = 0;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });

async function openPolice(page) {
  await page.goto(`${SITE}/#/city/police`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.bgr-police-notice', { timeout: 20000 });
  await sleep(300);
}

async function dialog(page) {
  await page.waitForSelector('.bgr-dialog', { timeout: 8000 });
  return page.$eval('.bgr-dialog', (el) => ({
    title: el.querySelector('h2')?.textContent ?? '',
    text: el.querySelector('p').textContent,
    buttons: [...el.querySelectorAll('button')].map((button) => button.textContent.trim()),
  }));
}

async function answer(page, yes) {
  await page.$$eval('.bgr-dialog button', (buttons, ok) => buttons[ok ? 0 : buttons.length - 1].click(), yes);
  await page.waitForFunction(() => !document.querySelector('.bgr-dialog'));
}

const click = (page, selector) => page.$eval(selector, (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const toast = async (page) => {
  await page.waitForSelector('.bgr-toast', { timeout: 8000 });
  return page.$eval('.bgr-toast p', (el) => el.textContent);
};
const clearToasts = async (page) => {
  await page.$$eval('.bgr-toast-close', (list) => list.forEach((el) => el.click()));
  await page.waitForFunction(() => !document.querySelector('.bgr-toast'));
};

try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('bgr-lang', 'bg');
    } catch {}
  });
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
  const name = `pol${stamp}`;
  const state = await page.evaluate(async (user) => {
    const base = document.getElementById('app').dataset.restUrl;
    const res = await fetch(base + 'bgrally/v1/auth/register', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, email: `${user}@example.com`, password: 'testtest123', city_id: 1 }) });
    return res.json();
  }, name);
  userId = state.user.id;
  managerId = state.player.id;
  await page.reload({ waitUntil: 'networkidle0' });

  await openPolice(page);
  const talks = await page.$$eval('.bgr-police-scene .bgr-scene-talk', (list) => list.map((el) => el.textContent.trim()));
  check('the clerk greets the player by name', talks[0]?.startsWith(`Добре дошли, ${name}!`) && talks[0].includes('саботаж'), talks[0]);
  check('the chief inspector offers help', talks[1]?.includes('без полицията да те закача'), talks[1]);
  const notice = await page.$eval('.bgr-police-notice', (el) => el.textContent);
  check('the board next to the flag shows both risks', notice.includes('Полицията следи') && /официалната писта: \d+%/.test(notice) && /черната писта: \d+%/.test(notice), notice);
  check('the old lists are gone', !(await page.$('.bgr-panel')) && !(await page.$('.bgr-stats-list')));
  await page.screenshot({ path: `${OUTPUT}/police-scene.png` });

  await click(page, '[data-spot="clerk"]');
  let box = await dialog(page);
  check('without a recent rally the clerk says so', box.text.includes('Няма скорошни ралита') && box.buttons.length === 1, JSON.stringify(box));
  await answer(page, true);

  const season = sql('SELECT MAX(season) FROM wp_bgr_seasons');
  sql(`INSERT INTO wp_bgr_rallies (name, city_id, start_at, season, weather, stage_ids, entry_fee, prizes, status) VALUES ('${rallyName}', 1, DATE_SUB(NOW(), INTERVAL 1 DAY), ${season}, 'dry', '1', 0, '0', 'finished')`);
  rallyId = Number(sql(`SELECT id FROM wp_bgr_rallies WHERE name = '${rallyName}'`));
  sql(`INSERT INTO wp_bgr_entries (rally_id, manager_id, class, status, created_at) VALUES (${rallyId}, ${managerId}, 'A', 'finished', NOW())`);
  await openPolice(page);

  await page.$eval('[data-spot="clerk"]', (el) => el.focus());
  await page.keyboard.press('Enter');
  box = await dialog(page);
  await sleep(300);
  check('Enter on the clerk opens the question and leaves it open', Boolean(await page.$('.bgr-dialog')));
  check('the clerk asks about the last rally', box.text.includes(`„${rallyName}“`) && box.text.includes('енергия') && box.title === 'Сигнал за саботаж', JSON.stringify(box));
  check('the question has Да and Не', box.buttons.join(',') === 'Да,Не', box.buttons.join(','));
  await answer(page, false);
  await sleep(300);
  check('Не sends nothing', sql(`SELECT sabotage_report FROM wp_bgr_entries WHERE rally_id = ${rallyId}`) === '0');

  const energy = Number(sql(`SELECT energy FROM wp_bgr_managers WHERE id = ${managerId}`));
  await click(page, '.bgr-police-scene .bgr-scene-talk');
  await dialog(page);
  await answer(page, true);
  const result = await toast(page);
  check('the result of the check comes in a popup', result.includes('саботаж'), result);
  check('the complaint is recorded', sql(`SELECT sabotage_report FROM wp_bgr_entries WHERE rally_id = ${rallyId}`) === '1');
  check('the complaint costs energy', Number(sql(`SELECT energy FROM wp_bgr_managers WHERE id = ${managerId}`)) < energy);

  await clearToasts(page);
  await click(page, '[data-spot="inspector"]');
  box = await dialog(page);
  check('the inspector shows the bribe offer', box.title === 'Подкуп на полицията – до края на деня' && box.text.includes('Шанс да го приеме:') && box.text.includes('Ако откаже, губиш енергията, но не и парите.') && /Подкупи \(.+, \d+ енергия\)\?/.test(box.text), JSON.stringify(box));
  check('the bribe question has Да and Не', box.buttons.join(',') === 'Да,Не');
  await answer(page, false);
  await sleep(300);
  check('Не gives no bribe', sql(`SELECT COUNT(*) FROM wp_bgr_bribes WHERE manager_id = ${managerId}`) === '0');

  sql(`INSERT INTO wp_bgr_bribes (manager_id, institution, status, week, created_at) VALUES (${managerId}, 'police', 'refused', DATE_FORMAT(NOW(), '%x-%v'), NOW())`);
  await openPolice(page);
  await click(page, '.bgr-police-scene .bgr-scene-talk[data-tail="right"]');
  box = await dialog(page);
  check('after a refusal the inspector offers an ad for a second try', box.text.includes('Отказа подкуп') && box.buttons.join(',') === 'Гледай реклама за втори опит,Затвори', JSON.stringify(box));
  await answer(page, true);
  await page.waitForSelector('.bgr-ad-overlay button:not(.bgr-secondary)', { timeout: 60000 });
  await click(page, '.bgr-ad-overlay button');
  box = await dialog(page);
  check('after the ad the second try is offered', box.text.startsWith('Използваш втория си опит.') && box.text.includes('Подкупи (') && box.buttons.join(',') === 'Да,Не', JSON.stringify(box));
  await clearToasts(page);
  await answer(page, true);
  check('the bribe answer comes in a popup', (await toast(page)).length > 0);
  const status = sql(`SELECT status FROM wp_bgr_bribes WHERE manager_id = ${managerId} ORDER BY id DESC LIMIT 1`);
  check('the second try is recorded', sql(`SELECT COUNT(*) FROM wp_bgr_bribes WHERE manager_id = ${managerId}`) === '2' && ['active', 'refused'].includes(status), status);
  await click(page, '[data-spot="inspector"]');
  box = await dialog(page);
  check('a later visit shows the outcome', status === 'active' ? box.text.startsWith('Действа до') && box.buttons.length === 1 : box.text.includes('Отказа подкуп'), JSON.stringify(box));
  await answer(page, false);

  for (const [label, moment, time, hour, minute] of [
    ['a July noon', [2026, 6, 1, 12, 15], 'day', 7.5, 90],
    ['a November evening', [2026, 10, 11, 18, 40], 'night', 200, 240],
  ]) {
    const clockPage = await browser.newPage();
    await clockPage.evaluateOnNewDocument((parts) => {
      const Real = Date;
      const fixed = new Real(...parts).getTime();
      globalThis.Date = class extends Real {
        constructor(...args) {
          super(...(args.length ? args : [fixed]));
        }
        static now() {
          return fixed;
        }
      };
      try {
        localStorage.setItem('bgr-lang', 'bg');
      } catch {}
    }, moment);
    await clockPage.setViewport({ width: 1280, height: 900 });
    await clockPage.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
    await openPolice(clockPage);
    const seen = await clockPage.evaluate(() => ({
      time: document.querySelector('.bgr-police-window').dataset.time,
      hour: document.querySelector('.bgr-police-hour').getAttribute('transform'),
      minute: document.querySelector('.bgr-police-minute').getAttribute('transform'),
    }));
    check(`on ${label} the window shows the ${time}`, seen.time === time, seen.time);
    check(`on ${label} the clock shows the time`, seen.hour.startsWith(`rotate(${hour} `) && seen.minute.startsWith(`rotate(${minute} `), JSON.stringify(seen));
    await clockPage.screenshot({ path: `${OUTPUT}/police-${time}.png` });
    await clockPage.close();
  }
  const board = await page.evaluate(() => {
    const frame = document.querySelector('.bgr-police-board').getBoundingClientRect();
    const paper = document.querySelector('.bgr-police-notice').getBoundingClientRect();
    return { wide: frame.width > frame.height, inside: paper.bottom <= frame.bottom && paper.right <= frame.right };
  });
  check('the board is wider than tall and holds the notice', board.wide && board.inside, JSON.stringify(board));

  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await phone.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
  await phone.evaluate(() => localStorage.setItem('bgr-lang', 'bg'));
  await openPolice(phone);
  const below = await phone.evaluate(() => {
    const picture = document.querySelector('.bgr-police-scene svg').getBoundingClientRect();
    return [...document.querySelectorAll('.bgr-police-scene .bgr-scene-talk, .bgr-police-notice')].every((el) => el.getBoundingClientRect().top >= picture.bottom);
  });
  check('on a phone the balloons and the board sit below the picture', below);
  check('no sideways scrolling on a phone', (await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  await phone.screenshot({ path: `${OUTPUT}/police-phone.png`, fullPage: true });
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (rallyId) {
    sql(`DELETE FROM wp_bgr_entries WHERE rally_id = ${rallyId}`);
    sql(`DELETE FROM wp_bgr_rallies WHERE id = ${rallyId}`);
  }
  if (managerId) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${managerId})`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'entries', 'contracts', 'inbox', 'bribes', 'sabotages']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${managerId}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${managerId}`);
  }
  if (userId) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${userId}`);
    sql(`DELETE FROM wp_users WHERE ID = ${userId}`);
  }
}
