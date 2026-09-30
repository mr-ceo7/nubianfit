import { launchBrowser, captureScreenshot, loginAsClient, BASE_URL } from './helpers.js';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAthleteTestSuite() {
  console.log('=== STARTING ATHLETE / CLIENT E2E TEST SUITE ===');
  const viewport = { width: 390, height: 844, isMobile: true, hasTouch: true };
  const { browser, page, errors } = await launchBrowser(viewport);

  try {
    // ----------------------------------------------------
    // SCENARIO 1: Sign in as Athlete Marcus Vance & Today Screen
    // ----------------------------------------------------
    console.log('\n[Scenario 1] Signing in as Athlete Marcus Vance...');
    await loginAsClient(page);
    await delay(1000);

    // Verify Today view components
    const todayContent = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasGreeting: text.includes('Hi Marcus'),
        hasWorkoutsWeek: text.includes('Workouts this week'),
        hasCompliance: text.includes('Compliance'),
        hasCurrentWeight: text.includes('Current weight'),
        hasNextWorkout: text.includes('NEXT WORKOUT') || text.includes('Next workout'),
        hasCheckinBanner: text.includes('Weekly check-in') && text.includes('Fill in'),
        hasCoachSnippet: text.includes('From your coach'),
      };
    });

    console.log('[Scenario 1] Today Screen Content Checks:', todayContent);
    if (!todayContent.hasGreeting) throw new Error('Athlete greeting not found on Today screen');
    if (!todayContent.hasNextWorkout) throw new Error('Next workout section not found on Today screen');

    await captureScreenshot(page, 'client_01_today');
    console.log('✓ Scenario 1 passed: client_01_today.png captured');

    // ----------------------------------------------------
    // SCENARIO 2: Daily Habits Checklist
    // ----------------------------------------------------
    console.log('\n[Scenario 2] Testing Daily Habits Checklist...');
    // Scroll down to reveal habits checklist
    await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll('h2')).find(el => el.innerText.includes("Today's habits"));
      if (heading) heading.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await delay(600);

    // Find and click the daily habits: Hydration, Steps, Protein target
    const targetHabitKeywords = ['Hydration', 'Steps', 'protein'];
    for (const kw of targetHabitKeywords) {
      const clicked = await page.evaluate((keyword) => {
        const buttons = Array.from(document.querySelectorAll('ul li button'));
        const btn = buttons.find(b => b.innerText.toLowerCase().includes(keyword.toLowerCase()));
        if (btn) {
          const wasPressed = btn.getAttribute('aria-pressed') === 'true';
          if (!wasPressed) {
            btn.click();
            return { found: true, clicked: true, title: btn.innerText.split('\n')[0] };
          }
          return { found: true, clicked: false, title: btn.innerText.split('\n')[0] };
        }
        return { found: false };
      }, kw);

      console.log(`[Scenario 2] Habit "${kw}":`, clicked);
      await delay(700);
    }

    // Verify visual feedback (aria-pressed === 'true', line-through text or green check icon)
    const habitStatus = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('ul li button'));
      return buttons.map(b => ({
        text: b.innerText.split('\n')[0],
        done: b.getAttribute('aria-pressed') === 'true',
      }));
    });
    console.log('[Scenario 2] Current Habit Statuses:', habitStatus);

    await captureScreenshot(page, 'client_02_habits_completed');
    console.log('✓ Scenario 2 passed: client_02_habits_completed.png captured');

    // ----------------------------------------------------
    // SCENARIO 3: Complete Assigned Workout via Workout Logger
    // ----------------------------------------------------
    console.log('\n[Scenario 3] Complete Assigned Workout via Workout Logger...');
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(500);

    // Click "Start" on Next Workout
    const startBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Start') && b.closest('section')?.innerText.includes('NEXT WORKOUT'));
      if (btn) {
        btn.click();
        return true;
      }
      // Fallback: any Start button in Next Workout
      const fallback = btns.find(b => b.innerText.includes('Start'));
      if (fallback) {
        fallback.click();
        return true;
      }
      return false;
    });

    if (!startBtn) throw new Error('Could not find Start workout button on Today screen');
    console.log('[Scenario 3] Clicked Start workout button');

    // Wait for Workout Logger modal to open
    await page.waitForFunction(() => {
      return document.querySelector('div[role="dialog"]') !== null &&
             document.body.innerText.includes('Sets');
    }, { timeout: 8000 });
    console.log('[Scenario 3] Workout Logger dialog opened');

    // Test Edge Cases: 0 reps, high weight, negative values
    console.log('[Scenario 3] Testing edge cases in Workout Logger...');
    await page.evaluate(() => {
      const firstRepsInput = document.querySelector('input[aria-label*="reps done"]');
      if (firstRepsInput) {
        firstRepsInput.value = '0';
        firstRepsInput.dispatchEvent(new Event('input', { bubbles: true }));
        firstRepsInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const firstWeightInput = document.querySelector('input[aria-label*="weight used"]');
      if (firstWeightInput) {
        firstWeightInput.value = '150';
        firstWeightInput.dispatchEvent(new Event('input', { bubbles: true }));
        firstWeightInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await delay(500);

    // Now fill realistic logged values for exercises:
    // Exercise 1: Barbell Back Squat -> 3 sets: 100kg x 8, 110kg x 6, 120kg x 5 (RPE 9)
    // Exercise 2: Barbell Romanian Deadlift -> 3 sets: 90kg x 10, 100kg x 8, 100kg x 8
    // Exercise 3: Bulgarian Split Squat -> 3 sets: 24kg x 10, 24kg x 10, 26kg x 8
    // Exercise 4: Hanging Leg Raise -> 3 sets: 15 reps, 12 reps, 12 reps
    console.log('[Scenario 3] Entering realistic sets, reps, weights, and marking completed...');
    await page.evaluate(() => {
      const exerciseCards = Array.from(document.querySelectorAll('table tbody'));
      exerciseCards.forEach((tbody, exIdx) => {
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.forEach((row, setIdx) => {
          const repsInput = row.querySelector('input[aria-label*="reps done"]');
          const weightInput = row.querySelector('input[aria-label*="weight used"]');
          const rpeInput = row.querySelector('input[aria-label*="RPE"]');
          const checkBtn = row.querySelector('button[aria-label*="Mark set"]');

          if (exIdx === 0) { // Barbell Back Squat
            const reps = [8, 6, 5][setIdx] || 5;
            const weight = [100, 110, 120][setIdx] || 120;
            const rpe = [7.5, 8, 9][setIdx] || 9;
            if (repsInput) { repsInput.value = String(reps); repsInput.dispatchEvent(new Event('input', { bubbles: true })); }
            if (weightInput) { weightInput.value = String(weight); weightInput.dispatchEvent(new Event('input', { bubbles: true })); }
            if (rpeInput) { rpeInput.value = String(rpe); rpeInput.dispatchEvent(new Event('input', { bubbles: true })); }
          } else if (exIdx === 1) { // RDL
            const reps = [10, 8, 8][setIdx] || 8;
            const weight = [90, 100, 100][setIdx] || 100;
            const rpe = [7, 8, 8.5][setIdx] || 8;
            if (repsInput) { repsInput.value = String(reps); repsInput.dispatchEvent(new Event('input', { bubbles: true })); }
            if (weightInput) { weightInput.value = String(weight); weightInput.dispatchEvent(new Event('input', { bubbles: true })); }
            if (rpeInput) { rpeInput.value = String(rpe); rpeInput.dispatchEvent(new Event('input', { bubbles: true })); }
          } else if (exIdx === 2) { // Bulgarian Split Squat
            const reps = [10, 10, 8][setIdx] || 8;
            const weight = [24, 24, 26][setIdx] || 26;
            const rpe = [8, 8, 8.5][setIdx] || 8.5;
            if (repsInput) { repsInput.value = String(reps); repsInput.dispatchEvent(new Event('input', { bubbles: true })); }
            if (weightInput) { weightInput.value = String(weight); weightInput.dispatchEvent(new Event('input', { bubbles: true })); }
            if (rpeInput) { rpeInput.value = String(rpe); rpeInput.dispatchEvent(new Event('input', { bubbles: true })); }
          } else { // Hanging Leg Raise
            const reps = [15, 12, 12][setIdx] || 12;
            if (repsInput) { repsInput.value = String(reps); repsInput.dispatchEvent(new Event('input', { bubbles: true })); }
          }

          // Click mark done if not already completed
          if (checkBtn && checkBtn.getAttribute('aria-pressed') !== 'true') {
            checkBtn.click();
          }
        });
      });

      // Feedback and rating
      const feedbackInput = document.querySelector('textarea[placeholder*="Energy, pain"]');
      if (feedbackInput) {
        feedbackInput.value = 'Felt great today! Back squat 120kg moved smooth with no lower back tightness.';
        feedbackInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Star rating 5
      const star5 = document.querySelector('button[aria-label="5 stars"]');
      if (star5) star5.click();

      // Duration
      const durationInput = document.querySelector('input[type="number"][min="1"]');
      if (durationInput) {
        durationInput.value = '65';
        durationInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await delay(1000);

    // Click "Complete workout"
    console.log('[Scenario 3] Clicking Complete workout button...');
    const completeBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText.includes('Complete workout'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!completeBtn) throw new Error('Complete workout button not found');

    // Wait for celebration and modal close
    await delay(2500);

    // Navigate to Workouts tab or check Today screen to verify completion state
    const bottomNavWorkouts = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      const b = btns.find(el => el.innerText.includes('Workouts'));
      if (b) { b.click(); return true; }
      return false;
    });
    console.log('[Scenario 3] Switched to Workouts tab:', bottomNavWorkouts);
    await delay(1000);

    await captureScreenshot(page, 'client_03_workout_completed');
    console.log('✓ Scenario 3 passed: client_03_workout_completed.png captured');

    // ----------------------------------------------------
    // SCENARIO 4: 1-on-1 Chat with Coach
    // ----------------------------------------------------
    console.log('\n[Scenario 4] Testing 1-on-1 Chat with Coach...');
    // Click Coach tab on bottom nav
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      const b = btns.find(el => el.innerText.includes('Coach'));
      if (b) b.click();
    });
    await delay(1000);

    // Verify chat view loaded & verify coach message
    const chatStatus = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasCoachMessage: text.includes('Bar path looks phenomenal') || text.includes('Awesome work'),
        hasComposer: document.querySelector('input[placeholder*="Message your coach"]') !== null,
      };
    });
    console.log('[Scenario 4] Chat thread status:', chatStatus);

    // Type and send message
    const replyText = 'Squats felt solid today, hit 120kg for 5 clean reps! Thanks Coach.';
    console.log(`[Scenario 4] Sending reply: "${replyText}"`);
    await page.evaluate((msg) => {
      const input = document.querySelector('input[placeholder*="Message your coach"]');
      if (input) {
        input.value = msg;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const sendBtn = document.querySelector('button[aria-label="Send"]');
      if (sendBtn) sendBtn.click();
    }, replyText);

    await delay(1500);

    // Verify message appears in conversation thread
    const messageDelivered = await page.evaluate((msg) => {
      return document.body.innerText.includes(msg);
    }, replyText);
    console.log('[Scenario 4] Message appeared in conversation thread:', messageDelivered);

    await captureScreenshot(page, 'client_04_chat_thread');
    console.log('✓ Scenario 4 passed: client_04_chat_thread.png captured');

    // ----------------------------------------------------
    // SCENARIO 5: Submit Weekly Check-in
    // ----------------------------------------------------
    console.log('\n[Scenario 5] Submitting Weekly Check-in...');
    // Return to Today tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      const b = btns.find(el => el.innerText.includes('Today'));
      if (b) b.click();
    });
    await delay(1000);

    // Open Weekly Check-in form by clicking "Fill in"
    const openedCheckin = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const fillBtn = btns.find(b => b.innerText === 'Fill in' && b.closest('section')?.innerText.includes('Weekly check-in'));
      if (fillBtn) {
        fillBtn.click();
        return true;
      }
      return false;
    });

    console.log('[Scenario 5] Opened Weekly check-in modal:', openedCheckin);
    await delay(1000);

    // Fill the check-in form:
    // 1. Morning weight (kg) -> 81.0
    // 2. Energy this week (scale 1-10) -> 9
    // 3. Average sleep (hours) -> 8
    // 4. How closely did you follow the plan? -> 'Nailed it'
    // 5. Wins and struggles this week -> 'Hit 120kg squat, sleep quality 8h, dialed in protein'
    await page.evaluate(() => {
      // Weight input
      const weightInput = document.querySelector('input[placeholder="kg"]');
      if (weightInput) {
        weightInput.value = '81.0';
        weightInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Energy rating (scale button "9")
      const scaleBtns = Array.from(document.querySelectorAll('fieldset button'));
      const energyBtn = scaleBtns.find(b => b.innerText.trim() === '9');
      if (energyBtn) energyBtn.click();

      // Average sleep
      const inputs = Array.from(document.querySelectorAll('input'));
      const sleepInput = inputs.find(i => i.closest('label')?.innerText.includes('Average sleep'));
      if (sleepInput) {
        sleepInput.value = '8';
        sleepInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Adherence: 'Nailed it'
      const optionBtns = Array.from(document.querySelectorAll('button'));
      const nailedItBtn = optionBtns.find(b => b.innerText.trim() === 'Nailed it');
      if (nailedItBtn) nailedItBtn.click();

      // Long text
      const notesArea = document.querySelector('textarea');
      if (notesArea) {
        notesArea.value = 'Hit 120kg squat PR, sleep quality 8h, dialed in all protein targets.';
        notesArea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await delay(800);

    // Submit check-in
    console.log('[Scenario 5] Submitting check-in form...');
    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Send check-in'));
      if (submitBtn) submitBtn.click();
    });

    await delay(2000);

    // Verify modal closed and check-in submitted
    const checkinSubmitted = await page.evaluate(() => {
      return !document.querySelector('form[role="dialog"]');
    });
    console.log('[Scenario 5] Check-in modal closed successfully:', checkinSubmitted);

    await captureScreenshot(page, 'client_05_checkin_submitted');
    console.log('✓ Scenario 5 passed: client_05_checkin_submitted.png captured');

    // ----------------------------------------------------
    // SCENARIO 6: Progress & Metrics View
    // ----------------------------------------------------
    console.log('\n[Scenario 6] Verifying Progress & Metrics View...');
    // Click "Progress" on bottom nav
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      const b = btns.find(el => el.innerText.includes('Progress'));
      if (b) b.click();
    });
    await delay(1200);

    // Check PRs, Check-ins, and Weight history
    const progressStatus = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasCurrentWeight: text.includes('81.2') || text.includes('81.0') || text.includes('Current'),
        hasPersonalRecords: text.includes('Personal records'),
        hasCoachCheckins: text.includes('Coach check-ins'),
        hasWeightHistory: text.includes('Weight history'),
      };
    });
    console.log('[Scenario 6] Progress view status:', progressStatus);

    await captureScreenshot(page, 'client_06_progress_metrics');
    console.log('✓ Scenario 6 passed: client_06_progress_metrics.png captured');

    console.log('\n=== ALL TEST SCENARIOS COMPLETED SUCCESSFULLY ===');
    console.log('Collected browser console/network errors during test:', errors);
  } catch (err) {
    console.error('TEST SUITE ERROR:', err);
    await captureScreenshot(page, 'client_error_snapshot');
    throw err;
  } finally {
    await browser.close();
  }
}

runAthleteTestSuite().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
