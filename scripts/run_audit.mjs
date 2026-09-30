import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/home/qassim/.gemini/antigravity-cli/brain/483aad8c-4412-4747-8f00-3e2e0ca97aac/audit_screenshots';
const BASE_URL = 'http://127.0.0.1:3010';
const CHROME_PATH = '/usr/bin/google-chrome';

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const auditLog = {
  consoleErrors: [],
  failedRequests: [],
  antiAiSlopIssues: [],
  responsiveIssues: [],
  placeholdersFound: [],
  functionalIssues: [],
  screenshotsTaken: []
};

async function inspectPage(page, name) {
  // 1. Check placeholders
  const placeholders = await page.$$eval('.border-dashed, [class*="amber-500/60"], [class*="border-amber-500"]', els => {
    return els.map(el => el.textContent.trim()).filter(Boolean);
  }).catch(() => []);
  if (placeholders.length > 0) {
    auditLog.placeholdersFound.push({ page: name, placeholders });
  }

  // 2. Anti-AI Slop: Multi-stop pastel text gradients
  const gradients = await page.$$eval('[class*="bg-gradient-to-r"][class*="bg-clip-text"], [class*="text-transparent"][class*="bg-gradient"]', els => {
    return els.map(el => ({ text: el.textContent.trim(), classes: el.className }));
  }).catch(() => []);
  if (gradients.length > 0) {
    auditLog.antiAiSlopIssues.push({ page: name, type: 'text-gradient', items: gradients });
  }

  // 3. Anti-AI Slop: Status indicator dots before headlines/subtitles
  const statusDots = await page.$$eval('h1, h2, h3, p', heads => {
    const found = [];
    for (const h of heads) {
      const dot = h.querySelector('span.rounded-full, div.rounded-full');
      if (dot && (dot.className.includes('w-2') || dot.className.includes('w-1.5') || dot.className.includes('h-2'))) {
        found.push({ heading: h.textContent.trim().slice(0, 50), dotClass: dot.className });
      }
    }
    return found;
  }).catch(() => []);
  if (statusDots.length > 0) {
    auditLog.antiAiSlopIssues.push({ page: name, type: 'status-dot-kicker', items: statusDots });
  }

  // 4. Anti-AI Slop: Buzzwords
  const buzzwords = ['pioneering', 'unprecedented', 'state-of-the-art', 'revolutionary', 'seamless', 'delve', 'tapestry', 'game-changer', 'testament', 'beacon'];
  const textContent = await page.evaluate(() => document.body.innerText.toLowerCase()).catch(() => '');
  for (const word of buzzwords) {
    if (textContent.includes(word)) {
      auditLog.antiAiSlopIssues.push({ page: name, type: 'buzzword', word });
    }
  }

  // 5. Mobile horizontal overflow
  const viewport = page.viewport();
  if (viewport && viewport.width < 500) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth).catch(() => false);
    if (overflow) {
      auditLog.responsiveIssues.push({ page: name, error: 'Horizontal scroll overflow detected' });
    }
  }
}

async function takeShot(page, filename, label) {
  const filepath = path.join(ARTIFACTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  auditLog.screenshotsTaken.push({ name: label, filename, path: filepath });
  console.log(`[Captured] ${label} -> ${filename}`);
}

async function run() {
  console.log('🚀 Launching Chrome Headless for NubianFit Audit...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const setupPage = async (viewport) => {
    const page = await browser.newPage();
    await page.setViewport(viewport);

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon.ico')) {
          auditLog.consoleErrors.push({ url: page.url(), text });
        }
      }
    });

    page.on('requestfailed', req => {
      const url = req.url();
      if (!url.includes('favicon')) {
        auditLog.failedRequests.push({ url, failure: req.failure()?.errorText });
      }
    });

    return page;
  };

  try {
    // 1. LANDING PAGE
    console.log('\n--- 1. Auditing Landing Page ---');
    {
      const dPage = await setupPage({ width: 1280, height: 800 });
      await dPage.goto(`${BASE_URL}/?portal=landing`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 1000));
      await inspectPage(dPage, 'Landing Desktop');
      await takeShot(dPage, '01_landing_desktop.png', 'Landing Page Desktop');
      await dPage.close();

      const mPage = await setupPage({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await mPage.goto(`${BASE_URL}/?portal=landing`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 1000));
      await inspectPage(mPage, 'Landing Mobile');
      await takeShot(mPage, '01_landing_mobile.png', 'Landing Page Mobile');
      await mPage.close();
    }

    // 2. PUBLIC PAY PAGE
    console.log('\n--- 2. Auditing Public Pay Page ---');
    {
      const payUrl = `${BASE_URL}/?portal=client&pay=demo-pay-link-damon`;
      const dPage = await setupPage({ width: 1280, height: 800 });
      await dPage.goto(payUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 1000));
      await inspectPage(dPage, 'Pay Page Desktop');
      await takeShot(dPage, '02_pay_desktop.png', 'Pay Page Desktop');
      await dPage.close();

      const mPage = await setupPage({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await mPage.goto(payUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 1000));
      await inspectPage(mPage, 'Pay Page Mobile');
      await takeShot(mPage, '02_pay_mobile.png', 'Pay Page Mobile');
      await mPage.close();

      // Check root ?pay= link without portal query parameter
      const rawPayUrl = `${BASE_URL}/?pay=demo-pay-link-damon`;
      const rawPage = await setupPage({ width: 1280, height: 800 });
      await rawPage.goto(rawPayUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 800));
      const hasCheckoutHeading = await rawPage.evaluate(() => {
        return Array.from(document.querySelectorAll('h1, h2')).some(h => h.textContent.includes('checkout') || h.textContent.includes('Pay') || h.textContent.includes('Complete your payment'));
      });
      if (!hasCheckoutHeading) {
        auditLog.functionalIssues.push({
          issue: 'Pay link without portal param renders landing page instead of PayPage on non-production host',
          url: rawPayUrl
        });
      }
      await rawPage.close();
    }

    // 3. COACH OS
    console.log('\n--- 3. Auditing Coach OS ---');
    let coachToken = '';
    {
      // A. Login screen
      const loginPage = await setupPage({ width: 1280, height: 800 });
      await loginPage.goto(`${BASE_URL}/?portal=coach`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 800));
      await inspectPage(loginPage, 'Coach Login Desktop');
      await takeShot(loginPage, '03_coach_login_desktop.png', 'Coach Login Desktop');

      // Perform Coach Login
      console.log('Logging in as coach@nubianfit.com...');
      await loginPage.waitForSelector('input[type="email"]');
      await loginPage.type('input[type="email"]', 'coach@nubianfit.com');
      await loginPage.type('input[type="password"]', 'Coach@123');
      await loginPage.click('button[type="submit"]');

      await loginPage.waitForSelector('#sidebar-navigation', { timeout: 8000 });
      await new Promise(r => setTimeout(r, 1500));

      await inspectPage(loginPage, 'Coach Dashboard Desktop');
      await takeShot(loginPage, '04_coach_dashboard_desktop.png', 'Coach Dashboard Desktop');

      coachToken = await loginPage.evaluate(() => localStorage.getItem('nubianfit_auth_token'));

      // Audit tabs on Desktop
      const coachTabs = [
        { id: 'clients', label: 'Clients' },
        { id: 'programs', label: 'Programs' },
        { id: 'workouts', label: 'Workout Library' },
        { id: 'exercises', label: 'Exercise Library' },
        { id: 'calendar', label: 'Calendar' },
        { id: 'nutrition', label: 'Nutrition & Habits' },
        { id: 'progress', label: 'Progress & Metrics' },
        { id: 'messenger', label: '1-on-1 Messenger' },
        { id: 'community', label: 'Community' },
        { id: 'checkins', label: 'Check-ins' },
        { id: 'autoflow', label: 'Autoflow' },
        { id: 'business', label: 'Billing & Packages' },
        { id: 'admin', label: 'Admin Hub' }
      ];

      for (const tab of coachTabs) {
        console.log(`Auditing Coach Tab: ${tab.label}...`);
        const navSelector = `#nav-link-${tab.id}`;
        await loginPage.evaluate((sel) => {
          const btn = document.querySelector(sel);
          if (btn) btn.click();
        }, navSelector);
        await new Promise(r => setTimeout(r, 1200));

        await inspectPage(loginPage, `Coach ${tab.label} Desktop`);
        await takeShot(loginPage, `05_coach_${tab.id}_desktop.png`, `Coach ${tab.label} Desktop`);

        // If on clients tab, view Marcus Vance profile modal
        if (tab.id === 'clients') {
          await loginPage.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tbody tr, .cursor-pointer'));
            const marcus = rows.find(r => r.textContent.includes('Marcus Vance'));
            if (marcus) marcus.click();
          });
          await new Promise(r => setTimeout(r, 1000));
          await takeShot(loginPage, `05_coach_clients_detail_desktop.png`, `Coach Client Detail Desktop`);
          await loginPage.keyboard.press('Escape');
          await new Promise(r => setTimeout(r, 500));
        }
      }

      await loginPage.close();

      // Mobile Coach OS
      console.log('Auditing Coach OS on Mobile Viewport...');
      const mCoach = await setupPage({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await mCoach.goto(`${BASE_URL}/?portal=coach`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await mCoach.evaluate((tok) => {
        localStorage.setItem('nubianfit_auth_token', tok);
      }, coachToken);
      await mCoach.goto(`${BASE_URL}/?portal=coach`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 1500));

      await inspectPage(mCoach, 'Coach Dashboard Mobile');
      await takeShot(mCoach, '04_coach_dashboard_mobile.png', 'Coach Dashboard Mobile');

      // Click Activity Feed tab on mobile dashboard
      await mCoach.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const actBtn = btns.find(b => b.textContent.includes('Activity Feed'));
        if (actBtn) actBtn.click();
      });
      await new Promise(r => setTimeout(r, 600));
      await takeShot(mCoach, '04_coach_dashboard_mobile_activity.png', 'Coach Dashboard Mobile Activity Tab');

      // Click Athletes in mobile bottom nav
      await mCoach.evaluate(() => {
        const btn = document.querySelector('#mobile-nav-clients');
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 1000));
      await inspectPage(mCoach, 'Coach Clients Mobile');
      await takeShot(mCoach, '05_coach_clients_mobile.png', 'Coach Clients Mobile');

      // Click Calendar in mobile bottom nav
      await mCoach.evaluate(() => {
        const btn = document.querySelector('#mobile-nav-calendar');
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 1000));
      await inspectPage(mCoach, 'Coach Schedule Mobile');
      await takeShot(mCoach, '05_coach_calendar_mobile.png', 'Coach Schedule Mobile');

      // Click Messenger in mobile bottom nav
      await mCoach.evaluate(() => {
        const btn = document.querySelector('#mobile-nav-messenger');
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 1000));
      await inspectPage(mCoach, 'Coach Messenger Mobile');
      await takeShot(mCoach, '05_coach_messenger_mobile.png', 'Coach Messenger Mobile');

      await mCoach.close();
    }

    // 4. CLIENT PWA
    console.log('\n--- 4. Auditing Client PWA ---');
    {
      const clientContext = await browser.createBrowserContext();
      const setupClientPage = async (viewport) => {
        const page = await clientContext.newPage();
        await page.setViewport(viewport);
        page.on('console', msg => {
          if (msg.type() === 'error' && !msg.text().includes('favicon.ico')) {
            auditLog.consoleErrors.push({ url: page.url(), text: msg.text() });
          }
        });
        page.on('requestfailed', req => {
          if (!req.url().includes('favicon')) {
            auditLog.failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
          }
        });
        return page;
      };

      const clientMobile = await setupClientPage({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await clientMobile.goto(`${BASE_URL}/?portal=client`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise(r => setTimeout(r, 1000));
      await inspectPage(clientMobile, 'Client Login Mobile');
      await takeShot(clientMobile, '06_client_login_mobile.png', 'Client Login Mobile');

      // Request OTP
      console.log('Requesting OTP for marcus.vance@example.com...');
      await clientMobile.waitForSelector('input[type="email"]');
      await clientMobile.type('input[type="email"]', 'marcus.vance@example.com');
      await clientMobile.click('button[type="submit"]');
      await new Promise(r => setTimeout(r, 1200));
      await takeShot(clientMobile, '06_client_otp_prompt_mobile.png', 'Client OTP Prompt Mobile');

      // Perform dev-login to get client session
      console.log('Logging in client via dev token (?role=client)...');
      const devLoginRes = await clientMobile.evaluate(async () => {
        const res = await fetch('/api/auth/dev-login?role=client', {
          method: 'POST'
        });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('nubianfit_token', data.accessToken);
          return { ok: true, data };
        }
        return { ok: false, status: res.status };
      });

      if (devLoginRes.ok) {
        console.log('Client session established for Marcus Vance.');
        await clientMobile.goto(`${BASE_URL}/?portal=client`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await new Promise(r => setTimeout(r, 1500));

        await inspectPage(clientMobile, 'Client Today Mobile');
        await takeShot(clientMobile, '07_client_today_mobile.png', 'Client Today Mobile');

        // Audit Client Mobile Tabs: workouts, nutrition, progress, chat, profile
        const clientTabs = [
          { id: 'workouts', label: 'Workouts' },
          { id: 'nutrition', label: 'Nutrition' },
          { id: 'progress', label: 'Progress' },
          { id: 'chat', label: 'Coach & Groups' }
        ];

        for (const ctab of clientTabs) {
          console.log(`Auditing Client Tab: ${ctab.label}...`);
          await clientMobile.evaluate((tid) => {
            const btns = Array.from(document.querySelectorAll('nav button'));
            const target = btns.find(b => b.textContent.toLowerCase().includes(tid.toLowerCase()));
            if (target) target.click();
          }, ctab.id);
          await new Promise(r => setTimeout(r, 1200));
          await inspectPage(clientMobile, `Client ${ctab.label} Mobile`);
          await takeShot(clientMobile, `08_client_${ctab.id}_mobile.png`, `Client ${ctab.label} Mobile`);

          // Open workout logger if on workouts
          if (ctab.id === 'workouts') {
            await clientMobile.evaluate(() => {
              const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start') || b.textContent.includes('Log') || b.textContent.includes('View'));
              if (startBtn) startBtn.click();
            });
            await new Promise(r => setTimeout(r, 1000));
            await takeShot(clientMobile, `08_client_workout_logger_mobile.png`, `Client Workout Logger Mobile`);
            await clientMobile.keyboard.press('Escape');
          }
        }

        // Test Client on Desktop
        console.log('Auditing Client PWA on Desktop Viewport...');
        const clientDesktop = await setupClientPage({ width: 1280, height: 800 });
        await clientDesktop.goto(`${BASE_URL}/?portal=client`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await clientDesktop.evaluate((tok) => {
          localStorage.setItem('nubianfit_token', tok);
        }, devLoginRes.data.accessToken);
        await clientDesktop.goto(`${BASE_URL}/?portal=client`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await new Promise(r => setTimeout(r, 1500));

        await inspectPage(clientDesktop, 'Client Today Desktop');
        await takeShot(clientDesktop, '07_client_today_desktop.png', 'Client Today Desktop');

        // Test desktop tabs
        for (const ctab of clientTabs) {
          await clientDesktop.evaluate((tid) => {
            const btns = Array.from(document.querySelectorAll('aside nav button'));
            const target = btns.find(b => b.textContent.toLowerCase().includes(tid.toLowerCase()));
            if (target) target.click();
          }, ctab.id);
          await new Promise(r => setTimeout(r, 1200));
          await inspectPage(clientDesktop, `Client ${ctab.label} Desktop`);
          await takeShot(clientDesktop, `08_client_${ctab.id}_desktop.png`, `Client ${ctab.label} Desktop`);
        }

        await clientDesktop.close();
      }

      await clientMobile.close();
      await clientContext.close();
    }

  } catch (err) {
    console.error('Fatal audit error:', err);
    auditLog.functionalIssues.push({ error: err.message, stack: err.stack });
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'audit_summary.json'),
      JSON.stringify(auditLog, null, 2)
    );
    console.log('\n✅ Audit execution completed successfully! Summary saved to audit_summary.json');
  }
}

run();
