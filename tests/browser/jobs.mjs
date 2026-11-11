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

async function openJobs(page) {
  await page.goto(`${SITE}/#/city/jobs`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.bgr-note-job', { timeout: 20000 });
  await sleep(300);
}

const toast = async (page, kind) => {
  await page.waitForSelector(`.bgr-toast.${kind}`, { timeout: 8000 });
  return page.$eval(`.bgr-toast.${kind} p`, (el) => el.textContent);
};
const clearToasts = (page) => page.$$eval('.bgr-toast-close', (list) => list.forEach((el) => el.click()));

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
  }, `job${stamp}`);
  userId = state.user.id;
  managerId = state.player.id;
  await page.reload({ waitUntil: 'networkidle0' });

  await openJobs(page);
  const jobs = Number(sql('SELECT COUNT(*) FROM wp_bgr_jobs WHERE active = 1'));
  check('the job centre is a notice board', Boolean(await page.$('.bgr-board')) && (await page.$eval('.bgr-board-title h1', (el) => el.textContent)).includes('Бюро по труда'));
  check('the board has notices and vacancies', (await page.$$eval('.bgr-board-label', (list) => list.map((el) => el.textContent.trim()).join(','))) === 'Съобщения,Свободни места');
  check('every job is a pinned note', (await page.$$('.bgr-note-job')).length === jobs, `${jobs}`);
  check('there is no table any more', !(await page.$('.bgr-table')));
  const locked = await page.$$eval('.bgr-note-locked', (list) => list.map((el) => el.querySelector('.bgr-stamp')?.textContent ?? ''));
  check('jobs above the level carry a stamp', locked.length > 0 && locked.every((text) => text.includes('от ниво')), JSON.stringify(locked));
  check('free jobs have a start button', (await page.$$('.bgr-note-job:not(.bgr-note-locked) button')).length > 0);
  await page.screenshot({ path: `${OUTPUT}/jobs-board.png` });

  await page.$eval('.bgr-note-job:not(.bgr-note-locked) button', (el) => el.click());
  check('taking a job shows a message', (await toast(page, 'ok')).length > 0);
  check('the taken job is stamped as yours', Boolean(await page.$('.bgr-note-job.bgr-note-yours .bgr-stamp-ok')));
  check('the notices show the current job with a quit button', Boolean(await page.$('.bgr-board-section .bgr-note-yours:not(.bgr-note-job) button')));

  await clearToasts(page);
  await page.click('.bgr-board-section .bgr-note-yours:not(.bgr-note-job) button');
  await page.waitForSelector('.bgr-dialog');
  await page.$$eval('.bgr-dialog button', (buttons) => buttons[0].click());
  check('quitting shows a message', (await toast(page, 'ok')).length > 0);
  await sleep(300);
  check('after quitting a notice says why no job can be taken', Boolean(await page.$('.bgr-note-warning')) && !(await page.$('.bgr-note-job button')));

  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await phone.goto(`${SITE}/#/login`, { waitUntil: 'networkidle0' });
  await phone.evaluate(() => localStorage.setItem('bgr-lang', 'bg'));
  await openJobs(phone);
  const columns = await phone.$eval('.bgr-board-grid', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  check('on a phone the notes sit in two columns', columns === 2, `${columns}`);
  check('no sideways scrolling on a phone', (await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
  await phone.screenshot({ path: `${OUTPUT}/jobs-phone.png`, fullPage: true });
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
