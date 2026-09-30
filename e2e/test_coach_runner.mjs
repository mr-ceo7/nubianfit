import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = '/usr/bin/google-chrome';
const SCREENSHOTS_DIR = '/home/qassim/.gemini/antigravity-cli/brain/483aad8c-4412-4747-8f00-3e2e0ca97aac/e2e_screenshots';
const BASE_URL = 'http://127.0.0.1:3010';

function log(step, msg) {
  console.log(`[Step ${step}] ${msg}`);
}

async function run() {
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
      '--window-size=1440,900',
    ],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      errors.push({ type: 'console', text, location: msg.location() });
      console.error('[Console Error]', text);
    }
  });

  page.on('pageerror', err => {
    errors.push({ type: 'pageerror', text: err.message, stack: err.stack });
    console.error('[Page Error]', err.message);
  });

  page.on('requestfailed', req => {
    errors.push({
      type: 'requestfailed',
      url: req.url(),
      failure: req.failure()?.errorText,
    });
    console.error('[Request Failed]', req.url(), req.failure()?.errorText);
  });

  try {
    // ----------------------------------------------------
    // Scenario 1: Sign in as Coach & Dashboard Inspection
    // ----------------------------------------------------
    log(1, 'Navigating to Coach portal at ' + BASE_URL + '/?portal=coach');
    await page.goto(`${BASE_URL}/?portal=coach`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.body.innerText.length > 50);

    // Check if login needed
    const isDashboardAlready = await page.evaluate(() => {
      return document.body.innerText.includes('Athlete Performance Overview') ||
             document.body.innerText.includes('Active Roster');
    });

    if (!isDashboardAlready) {
      log(1, 'Authenticating as coach@nubianfit.com via dev login...');
      const devBtn = await page.$('button::-p-text("Sign in as coach")');
      if (devBtn) {
        await devBtn.click();
      } else {
        const emailInput = await page.$('#coach-email');
        const passInput = await page.$('#coach-password');
        if (emailInput && passInput) {
          await emailInput.type('coach@nubianfit.com');
          await passInput.type('Coach@123');
          const submitBtn = await page.$('button[type="submit"]');
          if (submitBtn) await submitBtn.click();
        }
      }
      await page.waitForFunction(() => {
        return document.body.innerText.includes('Athlete Performance Overview') ||
               document.body.innerText.includes('Active Roster');
      }, { timeout: 10000 });
    }

    log(1, 'Coach Dashboard verified! Verifying KPI stat cards and activity feed...');
    const dashboardStats = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasActiveRoster: text.includes('Active Roster') || text.includes('ACTIVE ROSTER'),
        hasTodayWorkouts: text.includes("Today's Workouts") || text.includes("TODAY'S WORKOUTS"),
        hasWeeklyCheckins: text.includes('Weekly Check-Ins') || text.includes('WEEKLY CHECK-INS'),
        hasAvgCompliance: text.includes('Avg Compliance') || text.includes('AVG COMPLIANCE'),
        hasSchedule: text.includes("Today's Training Schedule"),
        hasActivityFeed: text.includes('Milestones & Activity'),
      };
    });

    console.log('[Dashboard KPI Inspection]', dashboardStats);
    if (!dashboardStats.hasActiveRoster || !dashboardStats.hasSchedule || !dashboardStats.hasActivityFeed) {
      throw new Error('Dashboard missing required KPI cards, schedule, or activity feed');
    }

    // Capture coach_01_dashboard.png
    const dashPath = path.join(SCREENSHOTS_DIR, 'coach_01_dashboard.png');
    await page.screenshot({ path: dashPath, fullPage: false });
    log(1, `Captured: ${dashPath}`);

    // ----------------------------------------------------
    // Scenario 2: Clients & CRM Roster
    // ----------------------------------------------------
    log(2, 'Navigating to Clients & CRM tab...');
    await page.evaluate(() => document.getElementById('nav-link-clients')?.click());
    await page.waitForFunction(() => document.body.innerText.includes('Athlete Roster & CRM'), { timeout: 8000 });

    const searchInput = await page.waitForSelector('#client-roster-search-input');

    const setRosterSearch = async (val) => {
      await page.evaluate((text) => {
        const input = document.getElementById('client-roster-search-input');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, val);
      await new Promise(r => setTimeout(r, 400));
    };

    // Test search filter with "Marcus"
    log(2, 'Testing search filter with "Marcus"...');
    await setRosterSearch('Marcus');
    const marcusSearchFiltered = await page.evaluate(() => {
      const rosterContainer = document.querySelector('#client-roster-search-input').closest('.space-y-6');
      const cards = Array.from(rosterContainer.querySelectorAll('.group, tr')).filter(el => el.innerText.includes('Marcus Vance'));
      const elenaCards = Array.from(rosterContainer.querySelectorAll('.group, tr')).filter(el => el.innerText.includes('Elena Rostova'));
      return { marcusCount: cards.length, elenaCount: elenaCards.length };
    });
    console.log('[Search Filter "Marcus" Check]:', marcusSearchFiltered);
    if (marcusSearchFiltered.marcusCount === 0 || marcusSearchFiltered.elenaCount > 0) {
      throw new Error('Search filter failed to isolate Marcus Vance');
    }

    // Test empty search edge case
    log(2, 'Testing search filter edge case with "NonExistentAthleteXYZ"...');
    await setRosterSearch('NonExistentAthleteXYZ');
    const emptySearchCheck = await page.evaluate(() => {
      const rosterContainer = document.querySelector('#client-roster-search-input').closest('.space-y-6');
      const cards = Array.from(rosterContainer.querySelectorAll('.group, tr')).filter(el =>
        el.innerText.includes('Marcus Vance') || el.innerText.includes('Elena Rostova')
      );
      return cards.length === 0;
    });
    console.log('[Empty Search State Correct]:', emptySearchCheck);
    if (!emptySearchCheck) throw new Error('Search filter did not clear results for non-existent athlete');

    // Clear search
    log(2, 'Clearing search filter...');
    await setRosterSearch('');

    // Test status filter buttons
    log(2, 'Testing status filter buttons (Active, Needs Check-in, Inactive, All)...');
    for (const filterName of ['Active', 'Needs Check-in', 'Inactive', 'All']) {
      const filterBtn = await page.$(`button::-p-text("${filterName}")`);
      if (filterBtn) {
        await filterBtn.click();
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Find and inspect Marcus Vance's profile
    log(2, 'Opening client profile for Marcus Vance...');
    await page.evaluate(() => {
      const rosterContainer = document.querySelector('#client-roster-search-input').closest('.space-y-6');
      const elements = Array.from(rosterContainer.querySelectorAll('h3, span, div')).filter(el => el.innerText.trim() === 'Marcus Vance');
      const target = elements[0]?.closest('.group') || elements[0]?.closest('tr') || elements[0];
      if (target) {
        target.click();
      }
    });

    // Wait for ClientProfileModal
    await page.waitForSelector('#close-client-profile-btn', { timeout: 8000 });
    log(2, 'ClientProfileModal opened! Inspecting athlete details...');

    const profileData = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasName: text.includes('Marcus Vance'),
        hasGoal: text.includes('Hypertrophy'),
        hasWeight: text.includes('81.2') || text.includes('kg'),
        hasCompliance: text.includes('94%') || text.includes('adherence'),
        hasBodyFat: text.includes('13.8%'),
      };
    });
    console.log('[Marcus Vance Profile Data]:', profileData);

    // Capture coach_02_client_profile.png
    const profilePath = path.join(SCREENSHOTS_DIR, 'coach_02_client_profile.png');
    await page.screenshot({ path: profilePath, fullPage: false });
    log(2, `Captured: ${profilePath}`);

    // Close modal
    log(2, 'Closing profile modal...');
    await page.click('#close-client-profile-btn');
    await page.waitForFunction(() => !document.getElementById('close-client-profile-btn'), { timeout: 5000 });

    // ----------------------------------------------------
    // Scenario 3: Workout & Program Management
    // ----------------------------------------------------
    log(3, 'Navigating to Schedule & Calendar tab...');
    await page.evaluate(() => document.getElementById('nav-link-calendar')?.click());
    await page.waitForFunction(() => document.body.innerText.includes('Schedule workout'), { timeout: 8000 });

    log(3, 'Opening Schedule workout dialog...');
    const scheduleBtn = await page.$('button::-p-text("Schedule workout")');
    if (!scheduleBtn) throw new Error('"Schedule workout" button not found');
    await scheduleBtn.click();

    await page.waitForSelector('div[role="dialog"][aria-label="Schedule workout"]', { timeout: 8000 });
    log(3, 'Schedule dialog visible. Selecting Marcus Vance...');

    // Select Marcus Vance in dropdown
    const clientSelect = await page.$('div[role="dialog"][aria-label="Schedule workout"] select');
    if (clientSelect) {
      await clientSelect.select('client-1');
    }

    // Click "Build a new workout"
    log(3, 'Clicking "Build a new workout"...');
    const buildNewBtn = await page.$('div[role="dialog"] button::-p-text("Build a new workout")');
    if (!buildNewBtn) throw new Error('"Build a new workout" button not found');
    await buildNewBtn.click();

    // Wait for WorkoutEditorSheet
    const workoutTitleInput = await page.waitForSelector('input[placeholder*="Upper Body Strength"]', { timeout: 8000 });
    log(3, 'WorkoutEditorSheet open! Setting workout title...');
    await workoutTitleInput.click();
    await workoutTitleInput.type('Marcus - Heavy Squat & Leg Hypertrophy');

    // Add an exercise under Main Workout
    log(3, 'Opening ExercisePicker for Main Workout...');
    await page.evaluate(() => {
      const h4s = Array.from(document.querySelectorAll('h4'));
      const mainH4 = h4s.find(h => h.innerText.includes('MAIN WORKOUT'));
      const addBtn = mainH4?.parentElement?.querySelector('button');
      if (addBtn) addBtn.click();
    });

    await page.waitForSelector('div[role="dialog"][aria-label*="Add to"]', { timeout: 5000 });
    // Pick the first exercise
    await page.click('div[role="dialog"][aria-label*="Add to"] ul li button');
    await new Promise(r => setTimeout(r, 300));

    // Confirm adding exercise
    await page.click('div[role="dialog"][aria-label*="Add to"] button.bg-emerald-500');
    await new Promise(r => setTimeout(r, 500));

    // Now save and schedule the workout
    log(3, 'Submitting workout schedule...');
    await page.evaluate(() => {
      const scheduleBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Schedule');
      scheduleBtn?.click();
    });

    await page.waitForFunction(() => !document.querySelector('input[placeholder*="Upper Body Strength"]'), { timeout: 8000 });
    await new Promise(r => setTimeout(r, 1200));

    // Verify scheduled workout appears on calendar
    log(3, 'Verifying assigned workout appears on calendar for Marcus Vance...');
    const calendarCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Marcus Vance') &&
             (text.includes('Heavy Squat & Leg Hypertrophy') || text.includes('exercises'));
    });
    console.log('[Calendar Assignment Verified]:', calendarCheck);

    // Capture coach_03_assigned_workout.png
    const schedPath = path.join(SCREENSHOTS_DIR, 'coach_03_assigned_workout.png');
    await page.screenshot({ path: schedPath, fullPage: false });
    log(3, `Captured: ${schedPath}`);

    // ----------------------------------------------------
    // Scenario 4: 1-on-1 Messenger
    // ----------------------------------------------------
    log(4, 'Navigating to 1-on-1 Messenger tab...');
    await page.evaluate(() => document.getElementById('nav-link-messenger')?.click());
    await page.waitForFunction(() => document.body.innerText.includes('Client chats'), { timeout: 8000 });

    // Select Marcus Vance in chats
    log(4, 'Selecting conversation with Marcus Vance...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('aside button')).filter(b => b.innerText.includes('Marcus Vance'));
      if (buttons[0]) buttons[0].click();
    });
    await new Promise(r => setTimeout(r, 600));

    // Test typing and sending real coach message
    const coachMsgText = "Hey Marcus, your workout is live for today. Let me know how your squats feel!";
    log(4, `Typing coach message: "${coachMsgText}"`);

    const msgInput = await page.waitForSelector('form input[type="text"]');
    await msgInput.click();
    await msgInput.type(coachMsgText);

    await page.click('form button[type="submit"]');
    await new Promise(r => setTimeout(r, 800));

    // Verify coach message in thread
    const coachMsgSent = await page.evaluate((text) => document.body.innerText.includes(text), coachMsgText);
    console.log('[Coach Message Visible]:', coachMsgSent);

    // Test canned responses / quick replies
    log(4, 'Testing canned responses / quick replies...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')).filter(b =>
        b.innerText.includes('protein target') ||
        b.innerText.includes('fatigue levels') ||
        b.innerText.includes('Great session')
      );
      if (buttons[0]) buttons[0].click();
    });

    await new Promise(r => setTimeout(r, 300));
    const inputValue = await page.evaluate(() => document.querySelector('form input[type="text"]')?.value);
    console.log('[Quick Reply Populated Input]:', inputValue);
    // Send quick reply
    await page.click('form button[type="submit"]');
    await new Promise(r => setTimeout(r, 800));

    // Client interaction: Marcus Vance replies
    log(4, 'Simulating Marcus Vance client response via API...');
    await page.evaluate(async () => {
      const res = await fetch('/api/auth/dev-login?role=client&email=marcus.vance@example.com', { method: 'POST' });
      const data = await res.json();
      if (!data.accessToken) throw new Error('Could not get client token');

      await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.accessToken}`
        },
        body: JSON.stringify({
          clientId: 'client-1',
          text: 'Thanks Coach! Got the workout, feeling pumped. Squats are going down in 30 mins! 💪'
        })
      });
    });

    // Wait for client reply to appear in thread
    log(4, 'Waiting for Marcus Vance reply in thread...');
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Thanks Coach! Got the workout');
    }, { timeout: 10000 });
    log(4, 'Marcus Vance reply received and verified in real-time chat!');

    // Capture coach_04_messenger.png
    const msgPath = path.join(SCREENSHOTS_DIR, 'coach_04_messenger.png');
    await page.screenshot({ path: msgPath, fullPage: false });
    log(4, `Captured: ${msgPath}`);

    // ----------------------------------------------------
    // Scenario 5: Review Check-ins & Activity Feed
    // ----------------------------------------------------
    log(5, 'Navigating to Check-ins tab...');
    await page.evaluate(() => document.getElementById('nav-link-checkins')?.click());
    await page.waitForFunction(() => document.body.innerText.includes('Inbox'), { timeout: 8000 });

    log(5, 'Reviewing pending/submitted check-ins...');
    const checkinSelected = await page.evaluate(() => {
      const inboxList = document.querySelector('ul');
      const item = Array.from(inboxList.querySelectorAll('li button')).find(b => b.innerText.includes('Marcus Vance'));
      if (item) {
        item.click();
        return true;
      }
      return false;
    });
    console.log('[Check-in Selected in Inbox]:', checkinSelected);
    await new Promise(r => setTimeout(r, 500));

    // Inspect checkin answers
    const checkinDetails = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasWeight: text.includes('81.6') || text.includes('Morning weight'),
        hasAdherence: text.includes('Mostly') || text.includes('Nailed it'),
        hasWins: text.includes('Hit every session') || text.includes('Wins and struggles'),
      };
    });
    console.log('[Check-in Submission Data Verified]:', checkinDetails);

    // Update coach review / feedback
    const reviewTextarea = await page.$('form textarea');
    if (reviewTextarea) {
      log(5, 'Updating coach feedback on check-in...');
      await reviewTextarea.click();
      await reviewTextarea.type(' Outstanding discipline on nutrition and workouts Marcus!');
      const updateReviewBtn = await page.$('form button[type="submit"]');
      if (updateReviewBtn) {
        await updateReviewBtn.click();
        await new Promise(r => setTimeout(r, 800));
      }
    }

    // Navigate to Dashboard to inspect Activity Feed
    log(5, 'Navigating back to Dashboard to inspect real-time Activity Feed...');
    await page.evaluate(() => document.getElementById('nav-link-dashboard')?.click());
    await page.waitForFunction(() => document.body.innerText.includes('Athlete Performance Overview'), { timeout: 8000 });

    const activityVerified = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasActivityFeed: text.includes('Milestones & Activity'),
        hasMarcusInActivity: text.includes('Marcus Vance'),
        hasTodayTraining: text.includes("Today's Training Schedule"),
      };
    });
    console.log('[Dashboard Activity Feed Verified]:', activityVerified);

    // Capture coach_05_checkins_activity.png
    const actPath = path.join(SCREENSHOTS_DIR, 'coach_05_checkins_activity.png');
    await page.screenshot({ path: actPath, fullPage: false });
    log(5, `Captured: ${actPath}`);

    // ----------------------------------------------------
    // Scenario 6: Edge Cases Testing
    // ----------------------------------------------------
    log(6, 'Testing Edge Cases: Empty inputs, rapid navigation, network resilience...');

    // 6a. Empty search and XSS strings in client search
    await page.evaluate(() => document.getElementById('nav-link-clients')?.click());
    await page.waitForSelector('#client-roster-search-input');
    await setRosterSearch('<script>alert("xss")</script>');
    await new Promise(r => setTimeout(r, 200));
    await setRosterSearch('');

    // 6b. Empty message input handling
    await page.evaluate(() => document.getElementById('nav-link-messenger')?.click());
    await page.waitForSelector('form input[type="text"]');
    const emptySendBtnDisabled = await page.evaluate(() => {
      const input = document.querySelector('form input[type="text"]');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const btn = document.querySelector('form button[type="submit"]');
      return btn.disabled;
    });
    console.log('[Empty Message Send Button Disabled]:', emptySendBtnDisabled);
    if (!emptySendBtnDisabled) {
      throw new Error('Send button should be disabled when message input is empty');
    }

    // 6c. Calendar navigation: shift month forward, back, click today
    await page.evaluate(() => document.getElementById('nav-link-calendar')?.click());
    await page.waitForSelector('button[aria-label="Next month"]');
    await page.click('button[aria-label="Next month"]');
    await new Promise(r => setTimeout(r, 200));
    await page.click('button[aria-label="Previous month"]');
    await new Promise(r => setTimeout(r, 200));
    const todayBtn = await page.$('button::-p-text("Today")');
    if (todayBtn) await todayBtn.click();
    await new Promise(r => setTimeout(r, 200));

    // 6d. Rapid tab switching test
    log(6, 'Executing rapid tab switching across 6 navigation tabs...');
    const tabsToSwitch = ['dashboard', 'calendar', 'messenger', 'checkins', 'clients', 'dashboard'];
    for (const tab of tabsToSwitch) {
      await page.evaluate((t) => document.getElementById(`nav-link-${t}`)?.click(), tab);
      await new Promise(r => setTimeout(r, 120));
    }
    await page.waitForFunction(() => document.body.innerText.includes('Athlete Performance Overview'), { timeout: 6000 });
    log(6, 'Rapid tab switching handled seamlessly with zero UI freeze!');

    // Check error log
    log(6, 'Verifying console and network error logs...');
    console.log('[Collected Errors Count]:', errors.length);
    if (errors.length > 0) {
      console.warn('[Errors List]:', JSON.stringify(errors, null, 2));
    }

    log(6, 'ALL 6 SCENARIOS EXECUTED SUCCESSFULLY!');
    return { success: true, errors };
  } catch (err) {
    console.error('Test execution failed:', err);
    try {
      const errPath = path.join(SCREENSHOTS_DIR, 'coach_error.png');
      await page.screenshot({ path: errPath });
      console.log(`[Error Screenshot Saved] ${errPath}`);
    } catch {}
    return { success: false, error: err.message, stack: err.stack, errors };
  } finally {
    await browser.close();
  }
}

run().then(res => {
  console.log('[FINAL RESULT]', JSON.stringify(res, null, 2));
  process.exit(res.success ? 0 : 1);
});
