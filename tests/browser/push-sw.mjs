import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { BASE, CHROME, HOST, MU, OUTPUT, SITE, WP_LOAD, option, php, settings, sql } from '../env.mjs';
function check(label, cond, extra = '') { console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); if (!cond) process.exitCode = 1; }
const profile = mkdtempSync(join(tmpdir(), 'bgr-push-'));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: profile, args: ['--no-sandbox', `--unsafely-treat-insecure-origin-as-secure=${SITE}`] });
try {
  await browser.defaultBrowserContext().overridePermissions(`${SITE}`, ['notifications']);
  const page = await browser.newPage();
  await page.goto(`${SITE}/`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  const client = await page.createCDPSession();
  await client.send('ServiceWorker.enable');
  const registrationId = await new Promise((resolve) => {
    client.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => registrations[0] && resolve(registrations[0].registrationId));
  });
  const payload = { notification: { title: 'Резултати от ралито', body: 'Тест: 1 място' }, data: { url: `${SITE}/#/rallies/1`, type: 'results' } };
  await client.send('ServiceWorker.deliverPushMessage', { origin: `${SITE}`, registrationId, data: JSON.stringify(payload) });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const notes = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, url: n.data?.url, icon: n.icon })));
  check('service worker shows the push notification', notes.some((n) => n.title === 'Резултати от ралито' && n.body === 'Тест: 1 място'), JSON.stringify(notes));
  check('notification keeps the link and icon', notes.some((n) => n.url === `${SITE}/#/rallies/1` && n.icon.includes('icon-192.png')));
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
}
