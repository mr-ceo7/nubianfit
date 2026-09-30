import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

export const CHROME_PATH = '/usr/bin/google-chrome';
export const SCREENSHOTS_DIR = '/home/qassim/.gemini/antigravity-cli/brain/483aad8c-4412-4747-8f00-3e2e0ca97aac/e2e_screenshots';
export const BASE_URL = 'http://127.0.0.1:3010';

export async function launchBrowser(viewport = { width: 390, height: 844, isMobile: true, hasTouch: true }) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      `--window-size=${viewport.width},${viewport.height}`,
    ],
    defaultViewport: viewport,
  });

  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.setViewport(viewport);

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console', text: msg.text(), location: msg.location() });
    }
  });

  page.on('pageerror', err => {
    errors.push({ type: 'pageerror', text: err.message, stack: err.stack });
  });

  page.on('requestfailed', req => {
    errors.push({
      type: 'requestfailed',
      url: req.url(),
      failure: req.failure()?.errorText,
    });
  });

  return { browser, page, errors };
}

export async function captureScreenshot(page, filename) {
  const fullPath = path.join(SCREENSHOTS_DIR, `${filename}.png`);
  await page.screenshot({ path: fullPath, fullPage: false });
  console.log(`[Screenshot Captured] ${fullPath}`);
  return fullPath;
}

export async function loginAsClient(page) {
  // Clear any existing session to ensure clean athlete state
  await page.goto(`${BASE_URL}/?portal=client`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.body.innerText.length > 20);

  // Authenticate as client directly via dev login
  await page.evaluate(async () => {
    localStorage.clear();
    const res = await fetch('/api/auth/dev-login?role=client', { method: 'POST' });
    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem('nubianfit_token', data.accessToken);
    }
  });

  // Reload page into client app
  await page.goto(`${BASE_URL}/?portal=client`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => {
    return document.body.innerText.includes('Marcus') ||
           document.body.innerText.includes('Today') ||
           document.body.innerText.includes('Hi Marcus');
  }, { timeout: 10000 });
}
