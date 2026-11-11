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

async function openHall(page) {
  await page.goto(`${SITE}/#/city/hall`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.bgr-hall-topics button:not([disabled])', { timeout: 20000 });
  await sleep(300);
}

const topic = (page, name) => page.$eval(`.bgr-hall-topics button[data-topic="${name}"]`, (el) => el.click());
const panel = (page) =>
  page.$eval('.bgr-scene-list', (el) => ({
    topic: el.dataset.topic,
    title: el.querySelector('h2')?.textContent.trim() ?? '',
    text: el.textContent,
    focused: document.activeElement === el.querySelector('.bgr-scene-close'),
  }));

try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('bgr-lang', 'bg');
    } catch {}
  });
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
  const name = `hall${stamp}`;
  const state = await page.evaluate(async (user) => {
    const base = document.getElementById('app').dataset.restUrl;
    const res = await fetch(base + 'bgrally/v1/auth/register', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, email: `${user}@example.com`, password: 'testtest123', city_id: 1 }) });
    return res.json();
  }, name);
  userId = state.user.id;
  managerId = state.player.id;
  await page.reload({ waitUntil: 'networkidle0' });

  await openHall(page);
  check('the city hall is the mayor’s office', Boolean(await page.$('.bgr-hall-scene svg')) && (await page.$eval('.bgr-hall-title', (el) => el.textContent)) === 'Кмет');
  const talk = await page.$eval('.bgr-hall-scene .bgr-scene-talk', (el) => el.textContent.trim());
  check('the mayor greets the player by name', talk === `Добре дошъл, ${name}! За какво искаш да си говорим?`, talk);
  check('the window shows day or night', ['day', 'night'].includes(await page.$eval('.bgr-hall-window', (el) => el.dataset.time)));
  const labels = await page.$$eval('.bgr-hall-topics button', (list) => list.map((el) => el.textContent.trim()));
  check('four topics sit below the picture', labels.join(',') === 'За гаража,За тренировъчна писта,За дарения,За смяна на града', labels.join(','));
  const below = await page.evaluate(() => document.querySelector('.bgr-hall-topics').getBoundingClientRect().top >= document.querySelector('.bgr-hall-scene svg').getBoundingClientRect().bottom);
  check('the topics are under the picture', below);
  check('no list is open at first', !(await page.$('.bgr-scene-list')) && !(await page.$('.bgr-card h2')));
  await page.screenshot({ path: `${OUTPUT}/hall-office.png` });

  await topic(page, 'garage');
  await page.waitForSelector('.bgr-scene-list');
  let box = await panel(page);
  check('the garage topic opens the permit window', box.topic === 'garage' && box.title === 'Разрешение за гаража' && box.text.includes('Шанс'), box.title);
  check('the close button gets the focus', box.focused);
  check('the office waits behind the window', await page.$eval('.bgr-hall-scene', (el) => el.inert));
  const energy = Number(sql(`SELECT energy FROM wp_bgr_managers WHERE id = ${managerId}`));
  await page.$eval('.bgr-scene-list button:not(.bgr-scene-close)', (el) => el.click());
  await page.waitForSelector('.bgr-toast', { timeout: 8000 });
  check('asking for a permit answers in a popup', (await page.$eval('.bgr-toast p', (el) => el.textContent)).length > 0);
  check('asking for a permit costs energy', Number(sql(`SELECT energy FROM wp_bgr_managers WHERE id = ${managerId}`)) < energy);
  await page.screenshot({ path: `${OUTPUT}/hall-garage.png` });

  await topic(page, 'track');
  await sleep(200);
  box = await panel(page);
  check('the track topic opens the track window', box.topic === 'track' && box.title === 'Собствена тренировъчна писта' && box.text.includes('Отключва се от ниво'), box.title);

  await topic(page, 'funding');
  await sleep(200);
  box = await panel(page);
  check('the funding topic opens the mayor’s bribe', box.topic === 'funding' && box.title.startsWith('Подкуп на кмета') && box.text.includes('Кметът приема подкупи от ниво'), box.title);

  await topic(page, 'move');
  await sleep(200);
  box = await panel(page);
  check('the move topic opens the city change', box.topic === 'move' && box.title === 'Смяна на града' && Boolean(await page.$('.bgr-scene-list select')), box.title);
  const cityId = await page.$eval('.bgr-scene-list select option:not([disabled])', (el) => el.value);
  await page.select('.bgr-scene-list select', cityId);
  await sleep(200);
  check('picking a city shows its privileges', (await page.$eval('.bgr-scene-list', (el) => el.textContent)).includes('Цени в магазина'));
  await page.$eval('.bgr-scene-list .bgr-filters button', (el) => el.click());
  await page.waitForSelector('.bgr-dialog');
  await page.$$eval('.bgr-dialog button', (buttons) => buttons[buttons.length - 1].click());
  await sleep(300);
  check('cancelling keeps the player in the city', sql(`SELECT city_id FROM wp_bgr_managers WHERE id = ${managerId}`) === '1');

  await page.click('.bgr-scene-close');
  await sleep(200);
  check('the ✕ closes the window', !(await page.$('.bgr-scene-list')) && !(await page.$eval('.bgr-hall-scene', (el) => el.inert)));
  await topic(page, 'track');
  await topic(page, 'track');
  await sleep(200);
  check('the same topic again closes it', !(await page.$('.bgr-scene-list')));

  await page.$eval('.bgr-hall-topics button[data-topic="garage"]', (el) => el.focus());
  await page.keyboard.press('Enter');
  await sleep(400);
  check('Enter on a topic opens it and keeps it open', Boolean(await page.$('.bgr-scene-list[data-topic="garage"]')));

  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await phone.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
  await phone.evaluate(() => localStorage.setItem('bgr-lang', 'bg'));
  await openHall(phone);
  const columns = await phone.$eval('.bgr-hall-topics', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  check('on a phone the topics are two by two', columns === 2, `${columns}`);
  const order = await phone.evaluate(() => {
    const picture = document.querySelector('.bgr-hall-scene svg').getBoundingClientRect();
    const talk = document.querySelector('.bgr-hall-scene .bgr-scene-talk').getBoundingClientRect();
    const topics = document.querySelector('.bgr-hall-topics').getBoundingClientRect();
    return talk.top >= picture.bottom && topics.top >= talk.bottom;
  });
  check('on a phone the balloon is under the picture and the topics under it', order);
  check('no sideways scrolling on a phone', (await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  await phone.screenshot({ path: `${OUTPUT}/hall-phone.png`, fullPage: true });
} catch (error) {
  console.error('ERROR', error);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (managerId) {
    sql(`DELETE FROM wp_bgr_items WHERE player_car_id IN (SELECT pc.id FROM wp_bgr_player_cars pc WHERE pc.manager_id = ${managerId})`);
    for (const t of ['items', 'staff', 'player_cars', 'ledger', 'contracts', 'inbox', 'bribes', 'mayor_requests']) sql(`DELETE FROM wp_bgr_${t} WHERE manager_id = ${managerId}`);
    sql(`DELETE FROM wp_bgr_managers WHERE id = ${managerId}`);
  }
  if (userId) {
    sql(`DELETE FROM wp_usermeta WHERE user_id = ${userId}`);
    sql(`DELETE FROM wp_users WHERE ID = ${userId}`);
  }
}
