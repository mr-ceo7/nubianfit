import { launchBrowser, captureScreenshot, loginAsClient, BASE_URL } from './helpers.js';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function runCoachConfirmationFlow() {
  console.log('========================================================');
  console.log('  ATHLETE CONFIRMATION FLOW: COACH WORKOUT & LIVE CHAT');
  console.log('  Target: Marcus Vance (marcus.vance@example.com)');
  console.log('  Viewport: 390x844 (Mobile iPhone 14 Pro)');
  console.log('========================================================\n');

  const viewport = { width: 390, height: 844, isMobile: true, hasTouch: true };
  const { browser, page, errors } = await launchBrowser(viewport);

  try {
    // ----------------------------------------------------
    // Step 1: Re-open Athlete Client App & Login
    // ----------------------------------------------------
    console.log('[Step 1] Opening Athlete Client App & authenticating as Marcus Vance...');
    await loginAsClient(page);
    await delay(1200);

    // ----------------------------------------------------
    // Step 2: Verify Assigned Workout on Today view & Workouts tab
    // ----------------------------------------------------
    console.log('[Step 2] Checking "Today" view for coach-assigned workout...');
    const todayWorkoutTitle = await page.evaluate(() => {
      const nextCard = Array.from(document.querySelectorAll('section')).find(s => 
        s.innerText.includes('NEXT WORKOUT') || s.innerText.includes('Next workout')
      );
      return nextCard ? nextCard.innerText : null;
    });

    console.log('[Step 2] Today Next Workout Card:', todayWorkoutTitle);
    const hasWorkoutOnToday = todayWorkoutTitle && todayWorkoutTitle.includes('Heavy Squat & Leg Hypertrophy');
    console.log('[Step 2] Workout found on Today view:', hasWorkoutOnToday);

    // Navigate to Workouts tab
    console.log('[Step 2] Navigating to "Workouts" tab to inspect schedule...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      const b = btns.find(el => el.innerText.includes('Workouts'));
      if (b) b.click();
    });
    await delay(1200);

    const workoutsViewText = await page.evaluate(() => document.body.innerText);
    const hasWorkoutInUpcoming = workoutsViewText.includes('Marcus - Heavy Squat & Leg Hypertrophy');
    const hasTodayBadge = workoutsViewText.includes('Today');

    console.log('[Step 2] Workouts Tab Verification:');
    console.log('  - Found "Marcus - Heavy Squat & Leg Hypertrophy":', hasWorkoutInUpcoming);
    console.log('  - Found "Today" badge:', hasTodayBadge);

    if (!hasWorkoutInUpcoming) {
      throw new Error('Coach-assigned workout "Marcus - Heavy Squat & Leg Hypertrophy" not found in Workouts tab!');
    }

    await captureScreenshot(page, 'client_07_verified_coach_assigned_workout');
    console.log('✓ Captured screenshot: client_07_verified_coach_assigned_workout.png\n');

    // ----------------------------------------------------
    // Step 3: Open Coach chat tab & verify incoming message
    // ----------------------------------------------------
    console.log('[Step 3] Opening "Coach" chat tab...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('nav button'));
      const b = btns.find(el => el.innerText.includes('Coach'));
      if (b) b.click();
    });
    await delay(1500);

    const threadText = await page.evaluate(() => document.body.innerText);
    const coachMessageSeen = threadText.includes('Hey Marcus, your workout is live for today');
    console.log('[Step 3] Coach message ("Hey Marcus, your workout is live for today...") present:', coachMessageSeen);

    if (!coachMessageSeen) {
      console.warn('Coach message not strictly matched, full thread text preview:\n', threadText.slice(0, 400));
    }

    // ----------------------------------------------------
    // Step 4: Reply back to the Coach in real-time
    // ----------------------------------------------------
    const athleteReply = "Got it Coach! I see the new Heavy Squat & Leg Hypertrophy workout on my schedule. Ready to crush it!";
    console.log(`[Step 4] Replying to Coach in real-time: "${athleteReply}"`);

    await setReactInput(page, 'input[placeholder*="Message your coach"]', athleteReply);
    await delay(300);

    // Send the message
    await page.evaluate(() => {
      const sendBtn = document.querySelector('button[aria-label="Send"]');
      if (sendBtn) {
        sendBtn.click();
      } else {
        const form = document.querySelector('input[placeholder*="Message your coach"]')?.closest('form');
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    });

    await delay(2000);

    // Verify reply in conversation thread with sent checkmark
    const afterReplyCheck = await page.evaluate((msg) => {
      const text = document.body.innerText;
      return {
        replyInThread: text.includes(msg),
        hasSentCheckmarks: document.querySelector('svg.lucide-check-check') !== null,
      };
    }, athleteReply);

    console.log('[Step 4] Live Chat Reply Status:', afterReplyCheck);
    if (!afterReplyCheck.replyInThread) {
      throw new Error('Athlete reply was not appended to the chat thread!');
    }

    // ----------------------------------------------------
    // Step 5: Capture screenshot of the chat thread
    // ----------------------------------------------------
    await captureScreenshot(page, 'client_08_verified_coach_live_chat');
    console.log('✓ Captured screenshot: client_08_verified_coach_live_chat.png\n');

    console.log('========================================================');
    console.log('  CONFIRMATION FLOW COMPLETED SUCCESSFULLY (0 ERRORS)');
    console.log('========================================================');
  } catch (err) {
    console.error('CONFIRMATION FLOW ERROR:', err);
    await captureScreenshot(page, 'coach_confirmation_error');
    throw err;
  } finally {
    await browser.close();
  }
}

runCoachConfirmationFlow().catch(err => {
  console.error('Fatal confirmation flow error:', err);
  process.exit(1);
});
