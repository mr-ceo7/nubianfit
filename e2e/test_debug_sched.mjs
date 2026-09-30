import { launchBrowser, BASE_URL } from './helpers.js';

async function test() {
  const { browser, page, errors } = await launchBrowser();
  page.on('console', msg => console.log('[Browser Console]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[Browser PageError]', err.message));

  try {
    await page.goto(`${BASE_URL}/?portal=coach`, { waitUntil: 'networkidle2' });
    const devBtn = await page.$('button::-p-text("Sign in as coach")');
    if (devBtn) await devBtn.click();
    await page.waitForFunction(() => document.body.innerText.includes('Athlete Performance Overview'));
    
    // Go to calendar
    await page.evaluate(() => document.getElementById('nav-link-calendar')?.click());
    await page.waitForSelector('button::-p-text("Schedule workout")');

    // Click Schedule workout
    const schedBtn = await page.$('button::-p-text("Schedule workout")');
    await schedBtn.click();
    await page.waitForSelector('div[role="dialog"][aria-label="Schedule workout"]');
    console.log('Dialog open');

    // Click Build a new workout
    const buildBtn = await page.$('div[role="dialog"] button::-p-text("Build a new workout")');
    await buildBtn.click();
    console.log('Build new clicked');

    // Wait for WorkoutEditorSheet
    await page.waitForSelector('input[placeholder*="Upper Body Strength"]');
    console.log('WorkoutEditorSheet open');

    // Type workout name
    const titleInput = await page.$('input[placeholder*="Upper Body Strength"]');
    await titleInput.click();
    await titleInput.type('Heavy Squat Session');
    console.log('Typed workout name');

    // Click Schedule button
    const scheduleBtn = await page.$('footer button.bg-emerald-500');
    console.log('Schedule button text:', await page.evaluate(el => el?.innerText, scheduleBtn));
    await scheduleBtn.click();
    console.log('Clicked schedule button');

    // Wait a bit and check state
    await new Promise(r => setTimeout(r, 2000));
    const stillOpen = await page.$('input[placeholder*="Upper Body Strength"]');
    console.log('Is sheet still open?', !!stillOpen);
    if (stillOpen) {
      const errorText = await page.evaluate(() => document.querySelector('footer p[role="alert"]')?.innerText);
      console.log('Footer alert text:', errorText);
    }
  } finally {
    await browser.close();
  }
}

test().catch(console.error);
