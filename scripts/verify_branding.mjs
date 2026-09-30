import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOTS_DIR = '/home/qassim/.gemini/antigravity-cli/brain/483aad8c-4412-4747-8f00-3e2e0ca97aac/branding_screenshots';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });

  // 1. Auth Shell (Coach login)
  await page.goto('http://127.0.0.1:3010/?portal=coach', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_auth_shell_coach.png') });

  // 2. Landing Page
  await page.goto('http://127.0.0.1:3010/?portal=landing', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_landing_header.png') });

  // 3. Client Sign in
  await page.goto('http://127.0.0.1:3010/?portal=client', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_auth_shell_client.png') });

  // 4. Client App (login as client)
  const clientRes = await fetch('http://127.0.0.1:8010/api/auth/dev-login?role=client', { method: 'POST' });
  const clientData = await clientRes.json();
  await page.evaluate((tok) => {
    localStorage.setItem('nubianfit_token', tok);
  }, clientData.accessToken);
  await page.goto('http://127.0.0.1:3010/?portal=client', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_client_app_desktop.png') });

  // Mobile client header
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto('http://127.0.0.1:3010/?portal=client', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_client_app_mobile.png') });

  // 5. Coach App
  const coachRes = await fetch('http://127.0.0.1:8010/api/auth/dev-login?role=coach', { method: 'POST' });
  const coachData = await coachRes.json();
  await page.evaluate((tok) => {
    localStorage.setItem('nubianfit_token', tok);
  }, coachData.accessToken);
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.goto('http://127.0.0.1:3010/?portal=coach', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_coach_app_desktop.png') });

  await browser.close();
  console.log('Branding verification screenshots captured successfully!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
