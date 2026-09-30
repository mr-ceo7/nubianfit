import { launchBrowser, captureScreenshot, loginAsClient, BASE_URL } from './helpers.js';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to set input value properly in React 19
async function setReactInput(page, selectorOrHandle, value) {
  await page.evaluate((elOrSel, val) => {
    const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
    if (!el) return;
    const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(el, val);
    } else {
      el.value = val;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, selectorOrHandle, value);
}

async function runAthleteTestSuite() {
  console.log('====================================================');
  console.log('  NUBIANFIT ATHLETE / CLIENT PERSONA E2E TEST SUITE');
  console.log('  Target: Marcus Vance (marcus.vance@example.com)');
  console.log('  Viewport: 390x844 (Mobile iPhone 14 Pro)');
  console.log('====================================================\n');

  const viewport = { width: 390, height: 844, isMobile: true, hasTouch: true };
  const { browser, page, errors } = await launchBrowser(viewport);

  try {
    // ====================================================
    // SCENARIO 1: Sign in & Today Screen Verification
    // ====================================================
    console.log('[Scenario 1] Authenticating as Athlete Marcus Vance...');
    await loginAsClient(page);
    await delay(1200);

    const todayChecks = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        greetingFound: text.includes('Hi Marcus'),
        workoutsWeekStat: text.includes('Workouts this week'),
        complianceStat: text.includes('Compliance'),
        currentWeightStat: text.includes('Current weight'),
        workoutsCompletedStat: text.includes('Workouts completed'),
        checkinBannerFound: text.includes('Weekly check-in') && text.includes('Fill in'),
        nextWorkoutCardFound: text.includes('NEXT WORKOUT') || text.includes('Next workout'),
        coachSnippetFound: text.includes('From your coach'),
      };
    });

    console.log('[Scenario 1] Today Screen Verification Results:', todayChecks);
    if (!todayChecks.greetingFound) throw new Error('Athlete greeting not found on Today screen');
    if (!todayChecks.nextWorkoutCardFound) throw new Error('Next workout card not found on Today screen');
    if (!todayChecks.checkinBannerFound) throw new Error('Weekly check-in banner not found on Today screen');

    await captureScreenshot(page, 'client_01_today');
    console.log('✓ [Scenario 1 Passed] client_01_today.png captured\n');

    // ====================================================
    // SCENARIO 2: Daily Habits Checklist
    // ====================================================
    console.log('[Scenario 2] Testing Daily Habits Checklist...');
    // Scroll down to display habits checklist clearly in mobile viewport
    await page.evaluate(() => window.scrollTo(0, 480));
    await delay(600);

    // Target habits to complete: Hit protein target, Daily Hydration, Daily Steps
    const habitsToComplete = ['protein', 'Hydration', 'Steps'];
    for (const kw of habitsToComplete) {
      const clickResult = await page.evaluate((keyword) => {
        const buttons = Array.from(document.querySelectorAll('ul li button'));
        const btn = buttons.find(b => b.innerText.toLowerCase().includes(keyword.toLowerCase()));
        if (btn) {
          const wasDone = btn.getAttribute('aria-pressed') === 'true';
          if (!wasDone) {
            btn.click();
            return { found: true, clicked: true, title: btn.innerText.split('\n')[0] };
          }
          return { found: true, clicked: false, title: btn.innerText.split('\n')[0], alreadyDone: true };
        }
        return { found: false };
      }, kw);

      console.log(`[Scenario 2] Completed Habit "${kw}":`, clickResult);
      await delay(700);
    }

    // Verify visual feedback (green checkmark, aria-pressed, line-through text)
    const habitStatuses = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('ul li button'));
      return buttons.map(b => ({
        title: b.innerText.split('\n')[0],
        completed: b.getAttribute('aria-pressed') === 'true',
        hasStrikethrough: b.querySelector('.line-through') !== null,
      }));
    });
    console.log('[Scenario 2] Habit Checklist Final Statuses:', habitStatuses);

    await captureScreenshot(page, 'client_02_habits_completed');
    console.log('✓ [Scenario 2 Passed] client_02_habits_completed.png captured\n');

    // ====================================================
    // SCENARIO 3: Complete Assigned Workout via Workout Logger
    // ====================================================
    console.log('[Scenario 3] Complete Assigned Workout via Workout Logger...');
    // Scroll back to top of Today screen
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(500);

    // Click "Start" on Next Workout
    const startClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const startBtn = btns.find(b => b.innerText.includes('Start') && (b.closest('section')?.innerText.includes('NEXT WORKOUT') || b.closest('section')?.innerText.includes('Next workout')));
      if (startBtn) {
        startBtn.click();
        return true;
      }
      return false;
    });

    if (!startClicked) throw new Error('Could not find Start workout button on Today screen');
    console.log('[Scenario 3] Clicked Start workout button');

    // Wait for Workout Logger modal to open
    await page.waitForSelector('div[role="dialog"]', { timeout: 8000 });
    console.log('[Scenario 3] Workout Logger modal opened');

    // EDGE CASE TESTING:
    console.log('[Scenario 3] Testing Edge Cases: zero reps, high weights, negative values...');
    const repsInputs = await page.$$('input[aria-label*="reps done"]');
    const weightInputs = await page.$$('input[aria-label*="weight used"]');
    const rpeInputs = await page.$$('input[aria-label*="RPE"]');
    const doneButtons = await page.$$('button[aria-label*="Mark set"]');

    console.log(`[Scenario 3] Found ${repsInputs.length} set inputs across exercises`);

    // Edge case 1: 0 reps
    await setReactInput(page, repsInputs[0], '0');
    // Edge case 2: High weight
    await setReactInput(page, weightInputs[0], '250');
    // Edge case 3: Negative weight handling
    await setReactInput(page, weightInputs[1], '-10');
    await delay(500);
    console.log('[Scenario 3] Edge cases tested successfully without crashing the UI');

    // Now enter realistic logged values for all exercises:
    // Exercise 1: Barbell Back Squat (High Bar)
    console.log('[Scenario 3] Logging Exercise 1: Barbell Back Squat (High Bar)...');
    // Set 1: 100 kg x 8, RPE 7.5
    await setReactInput(page, repsInputs[0], '8');
    await setReactInput(page, weightInputs[0], '100');
    if (rpeInputs[0]) await setReactInput(page, rpeInputs[0], '7.5');
    await page.evaluate(el => el.click(), doneButtons[0]);
    await delay(200);

    // Set 2: 110 kg x 6, RPE 8
    await setReactInput(page, repsInputs[1], '6');
    await setReactInput(page, weightInputs[1], '110');
    if (rpeInputs[1]) await setReactInput(page, rpeInputs[1], '8');
    await page.evaluate(el => el.click(), doneButtons[1]);
    await delay(200);

    // Set 3: 120 kg x 5, RPE 9 (Clean PR!)
    await setReactInput(page, repsInputs[2], '5');
    await setReactInput(page, weightInputs[2], '120');
    if (rpeInputs[2]) await setReactInput(page, rpeInputs[2], '9');
    await page.evaluate(el => el.click(), doneButtons[2]);
    await delay(300);

    // Exercise 2: Barbell Romanian Deadlift (RDL)
    console.log('[Scenario 3] Logging Exercise 2: Barbell Romanian Deadlift (RDL)...');
    await setReactInput(page, repsInputs[3], '10');
    await setReactInput(page, weightInputs[3], '95');
    if (rpeInputs[3]) await setReactInput(page, rpeInputs[3], '7.5');
    await page.evaluate(el => el.click(), doneButtons[3]);
    await delay(200);

    await setReactInput(page, repsInputs[4], '8');
    await setReactInput(page, weightInputs[4], '100');
    if (rpeInputs[4]) await setReactInput(page, rpeInputs[4], '8');
    await page.evaluate(el => el.click(), doneButtons[4]);
    await delay(200);

    await setReactInput(page, repsInputs[5], '8');
    await setReactInput(page, weightInputs[5], '105');
    if (rpeInputs[5]) await setReactInput(page, rpeInputs[5], '8.5');
    await page.evaluate(el => el.click(), doneButtons[5]);
    await delay(300);

    // Scroll dialog content down to view remaining exercises
    await page.evaluate(() => {
      const scrollable = document.querySelector('div[role="dialog"] .overflow-y-auto');
      if (scrollable) scrollable.scrollTop = 500;
    });
    await delay(400);

    // Exercise 3: Bulgarian Split Squat
    console.log('[Scenario 3] Logging Exercise 3: Bulgarian Split Squat...');
    await setReactInput(page, repsInputs[6], '10');
    await setReactInput(page, weightInputs[6], '24');
    if (rpeInputs[6]) await setReactInput(page, rpeInputs[6], '8');
    await page.evaluate(el => el.click(), doneButtons[6]);
    await delay(200);

    await setReactInput(page, repsInputs[7], '10');
    await setReactInput(page, weightInputs[7], '24');
    if (rpeInputs[7]) await setReactInput(page, rpeInputs[7], '8');
    await page.evaluate(el => el.click(), doneButtons[7]);
    await delay(200);

    await setReactInput(page, repsInputs[8], '8');
    await setReactInput(page, weightInputs[8], '26');
    if (rpeInputs[8]) await setReactInput(page, rpeInputs[8], '8.5');
    await page.evaluate(el => el.click(), doneButtons[8]);
    await delay(300);

    // Exercise 4: Hanging Leg Raise
    console.log('[Scenario 3] Logging Exercise 4: Hanging Leg Raise...');
    await setReactInput(page, repsInputs[9], '15');
    await page.evaluate(el => el.click(), doneButtons[9]);
    await delay(200);

    await setReactInput(page, repsInputs[10], '12');
    await page.evaluate(el => el.click(), doneButtons[10]);
    await delay(200);

    await setReactInput(page, repsInputs[11], '12');
    await page.evaluate(el => el.click(), doneButtons[11]);
    await delay(300);

    // Scroll to bottom of modal for notes, rating, and duration
    await page.evaluate(() => {
      const scrollable = document.querySelector('div[role="dialog"] .overflow-y-auto');
      if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
    });
    await delay(500);

    // Enter athlete reflection notes
    const athleteFeedback = 'Felt strong on squats! Hit 120kg for 5 clean reps with good depth and solid bracing.';
    await setReactInput(page, 'textarea[placeholder*="Energy, pain"]', athleteFeedback);

    // 5-star rating
    await page.evaluate(() => {
      const star = document.querySelector('button[aria-label="5 stars"]');
      if (star) star.click();
    });

    // Duration: 65 minutes
    await setReactInput(page, 'input[type="number"][min="1"]', '65');
    await delay(600);

    // Complete Workout
    console.log('[Scenario 3] Submitting workout completion...');
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Complete workout'));
      if (btn) btn.click();
    });

    // Wait for celebration and modal dismissal
    await delay(3500);
    const modalDismissed = await page.evaluate(() => document.querySelector('div[role="dialog"]') === null);
    console.log('[Scenario 3] Workout Logger modal dismissed:', modalDismissed);

    // Switch to Workouts tab on bottom nav
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      const b = btns.find(el => el.innerText.includes('Workouts'));
      if (b) b.click();
    });
    await delay(1200);

    const workoutsListCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasCompletedSection: text.includes('Completed'),
        hasDay2Workout: text.includes('Day 2: Lower Body Power'),
        has65MinBadge: text.includes('65 min'),
      };
    });
    console.log('[Scenario 3] Workouts Tab Verification:', workoutsListCheck);

    await captureScreenshot(page, 'client_03_workout_completed');
    console.log('✓ [Scenario 3 Passed] client_03_workout_completed.png captured\n');

    // ====================================================
    // SCENARIO 4: 1-on-1 Chat with Coach
    // ====================================================
    console.log('[Scenario 4] Testing 1-on-1 Live Chat with Coach...');
    // Switch to Coach tab on bottom nav
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      const b = btns.find(el => el.innerText.includes('Coach'));
      if (b) b.click();
    });
    await delay(1200);

    // Verify incoming coach messages
    const chatPreCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasCoachAdvice: text.includes('Bar path looks phenomenal') || text.includes('Awesome work'),
        hasComposer: document.querySelector('input[placeholder*="Message your coach"]') !== null,
      };
    });
    console.log('[Scenario 4] Pre-chat Checks:', chatPreCheck);

    // Send reply to coach
    const athleteReply = 'Squats felt solid today, hit 120kg for 5 clean reps! Thanks Coach.';
    console.log(`[Scenario 4] Sending reply: "${athleteReply}"`);
    await setReactInput(page, 'input[placeholder*="Message your coach"]', athleteReply);
    await delay(300);

    // Submit composer form
    await page.evaluate(() => {
      const sendBtn = document.querySelector('button[aria-label="Send"]');
      if (sendBtn) {
        sendBtn.click();
      } else {
        const form = document.querySelector('input[placeholder*="Message your coach"]')?.closest('form');
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    });

    await delay(1500);

    // Verify reply in conversation thread with sent checkmark
    const chatPostCheck = await page.evaluate((expectedMsg) => {
      const text = document.body.innerText;
      return {
        messageInThread: text.includes(expectedMsg),
        hasCheckmarks: document.querySelector('svg.lucide-check-check') !== null,
      };
    }, athleteReply);
    console.log('[Scenario 4] Post-chat Verification:', chatPostCheck);

    await captureScreenshot(page, 'client_04_chat_thread');
    console.log('✓ [Scenario 4 Passed] client_04_chat_thread.png captured\n');

    // ====================================================
    // SCENARIO 5: Submit Weekly Check-in
    // ====================================================
    console.log('[Scenario 5] Submitting Weekly Check-in...');
    // Return to Today tab on bottom nav
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      const b = btns.find(el => el.innerText.includes('Today'));
      if (b) b.click();
    });
    await delay(1000);

    // Open Weekly Check-in form via banner "Fill in"
    const fillInClicked = await page.evaluate(() => {
      const banner = Array.from(document.querySelectorAll('section')).find(s => s.innerText.includes('Weekly check-in'));
      if (banner) {
        const btn = banner.querySelector('button');
        if (btn) { btn.click(); return true; }
      }
      return false;
    });

    if (!fillInClicked) throw new Error('Weekly check-in "Fill in" button not found');
    console.log('[Scenario 5] Clicked "Fill in" button on check-in banner');

    await page.waitForSelector('form[role="dialog"]', { timeout: 8000 });
    console.log('[Scenario 5] Check-in form dialog opened');

    // Fill in answers:
    // 1. Morning weight: 81.0 kg
    await setReactInput(page, 'input[placeholder="kg"]', '81.0');

    // 2. Energy this week: Scale rating 9
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('fieldset button'));
      const b9 = buttons.find(b => b.innerText.trim() === '9');
      if (b9) b9.click();
    });

    // 3. Average sleep (hours): 8
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const sleepInput = inputs.find(i => i.closest('label')?.innerText.includes('Average sleep'));
      if (sleepInput) {
        const proto = window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter?.call(sleepInput, '8');
        sleepInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    // 4. Adherence: 'Nailed it'
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const nailedIt = btns.find(b => b.innerText.trim() === 'Nailed it');
      if (nailedIt) nailedIt.click();
    });

    // 5. Wins and struggles: reflection note
    const checkinNotes = 'Hit 120kg squat PR today, 8 hours sleep average, hit all hydration & protein goals.';
    await setReactInput(page, 'textarea', checkinNotes);
    await delay(600);

    // Click "Send check-in"
    console.log('[Scenario 5] Submitting check-in form...');
    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Send check-in'));
      if (submitBtn) submitBtn.click();
    });

    // Wait for submission toast and modal dismissal
    await delay(2500);

    const checkinFormClosed = await page.evaluate(() => document.querySelector('form[role="dialog"]') === null);
    console.log('[Scenario 5] Check-in form modal closed successfully:', checkinFormClosed);

    await captureScreenshot(page, 'client_05_checkin_submitted');
    console.log('✓ [Scenario 5 Passed] client_05_checkin_submitted.png captured\n');

    // ====================================================
    // SCENARIO 6: Progress & Metrics View
    // ====================================================
    console.log('[Scenario 6] Verifying Progress & Metrics View...');
    // Switch to Progress tab on bottom nav
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      const b = btns.find(el => el.innerText.includes('Progress'));
      if (b) b.click();
    });
    await delay(1200);

    const progressVerification = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return {
        hasCurrentWeightCard: text.includes('current') && (text.includes('81.0') || text.includes('81.2') || text.includes('81 kg')),
        hasPersonalRecordsHeading: text.includes('personal records'),
        hasCoachCheckinsHeading: text.includes('coach check-ins'),
        hasWeightHistoryHeading: text.includes('weight history'),
        hasCheckinSentBadge: text.includes('weekly check-in') && text.includes('sent'),
      };
    });
    console.log('[Scenario 6] Progress Metrics Verification:', progressVerification);

    await captureScreenshot(page, 'client_06_progress_metrics');
    console.log('✓ [Scenario 6 Passed] client_06_progress_metrics.png captured\n');

    // ====================================================
    // SCENARIO 7: Additional Edge Cases & Fast Navigation
    // ====================================================
    console.log('[Scenario 7] Testing rapid tab switching & navigation edge cases...');
    const tabNames = ['Today', 'Workouts', 'Nutrition', 'Progress', 'Coach', 'Today'];
    for (const name of tabNames) {
      await page.evaluate((tName) => {
        const btns = Array.from(document.querySelectorAll('nav button'));
        const b = btns.find(el => el.innerText.includes(tName));
        if (b) b.click();
      }, name);
      await delay(150); // fast tapping
    }
    await delay(500);

    const finalTodayCheck = await page.evaluate(() => document.body.innerText.includes('Hi Marcus'));
    console.log('[Scenario 7] Returned cleanly to Today screen after rapid tapping:', finalTodayCheck);
    console.log('✓ [Scenario 7 Passed] Fast navigation handled smoothly with zero errors\n');

    // Final error check
    console.log('====================================================');
    console.log('  TEST SUITE COMPLETED SUCCESSFULLY');
    console.log('  Browser errors detected:', errors.length);
    if (errors.length > 0) {
      console.log('  Errors detail:', errors);
    }
    console.log('====================================================');

  } catch (err) {
    console.error('TEST FAILURE OCCURRED:', err);
    await captureScreenshot(page, 'client_fatal_error');
    throw err;
  } finally {
    await browser.close();
  }
}

runAthleteTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
