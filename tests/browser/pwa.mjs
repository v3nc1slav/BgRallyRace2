import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { BASE, CHROME, HOST, MU, OUTPUT, SITE, WP_LOAD, option, php, settings, sql } from '../env.mjs';

function check(label, cond, extra = '') {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
}

const profile = mkdtempSync(join(tmpdir(), 'bgr-pwa-'));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  userDataDir: profile,
  args: ['--no-sandbox', `--unsafely-treat-insecure-origin-as-secure=${SITE}`],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`${SITE}/`, { waitUntil: 'networkidle0' });

  const scope = await page.evaluate(async () => {
    const registration = await Promise.race([navigator.serviceWorker.ready, new Promise((resolve) => setTimeout(() => resolve(null), 8000))]);
    return registration ? registration.scope : null;
  });
  check('service worker registered', scope === `${SITE}/`, String(scope));

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    return link ? (await fetch(link.href)).json() : null;
  });
  check('manifest linked and valid', manifest?.display === 'standalone' && manifest.icons.length === 3, manifest?.name);

  const client = await page.createCDPSession();
  const { installabilityErrors } = await client.send('Page.getInstallabilityErrors');
  check('Chrome sees the game as installable', installabilityErrors.length === 0, JSON.stringify(installabilityErrors));

  await page.reload({ waitUntil: 'networkidle0' });
  const worker = await browser.waitForTarget((target) => target.type() === 'service_worker');
  const workerSession = await worker.createCDPSession();
  await workerSession.send('Network.enable');
  await workerSession.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
  const text = await page.evaluate(() => document.body.innerText);
  check('offline page shown without internet', text.includes('Няма връзка с интернет'), text.slice(0, 80).replace(/\s+/g, ' '));
  const image = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  await page.screenshot({ path: `${OUTPUT}/pwa-offline.png` });
  check('offline page uses the crash photo', image.includes('error.jpg'));
  await page.setOfflineMode(false);
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
}
