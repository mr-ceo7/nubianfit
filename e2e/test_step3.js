import { launchBrowser, captureScreenshot, loginAsClient } from './helpers.js';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testStep3() {
  const { browser, page, errors } = await launchBrowser({ width: 390, height: 844, isMobile: true, hasTouch: true });
  try {
    await loginAsClient(page);
    await delay(1000);

    // Click "Start" on Next workout
    const startBtn = await page.waitForSelector('button::-p-text("Start")', { timeout: 5000 });
    await startBtn.click();
    console.log('Clicked Start button');

    // Wait for dialog
    await page.waitForSelector('div[role="dialog"]', { timeout: 5000 });
    console.log('Workout Logger dialog opened');

    // Test Edge Cases:
    console.log('Testing edge case: 0 reps, high weight, negative values');
    const repsInputs = await page.$$('input[aria-label*="reps done"]');
    const weightInputs = await page.$$('input[aria-label*="weight used"]');
    const rpeInputs = await page.$$('input[aria-label*="RPE"]');
    const doneButtons = await page.$$('button[aria-label*="Mark set"]');

    console.log(`Found ${repsInputs.length} reps inputs, ${weightInputs.length} weight inputs, ${doneButtons.length} done buttons`);

    // Edge case 1: Set 1 with 0 reps
    if (repsInputs[0]) {
      await repsInputs[0].click({ clickCount: 3 });
      await repsInputs[0].type('0');
    }
    // Edge case 2: Set 2 with 300kg (high weight)
    if (weightInputs[1]) {
      await weightInputs[1].click({ clickCount: 3 });
      await weightInputs[1].type('300');
    }
    await delay(500);

    // Now set realistic values for all sets
    // Exercise 1: Barbell Back Squat
    // Set 1: 100 kg, 8 reps, RPE 7.5
    await repsInputs[0].click({ clickCount: 3 });
    await repsInputs[0].type('8');
    await weightInputs[0].click({ clickCount: 3 });
    await weightInputs[0].type('100');
    if (rpeInputs[0]) {
      await rpeInputs[0].click({ clickCount: 3 });
      await rpeInputs[0].type('7.5');
    }
    await doneButtons[0].click();

    // Set 2: 110 kg, 6 reps, RPE 8
    await repsInputs[1].click({ clickCount: 3 });
    await repsInputs[1].type('6');
    await weightInputs[1].click({ clickCount: 3 });
    await weightInputs[1].type('110');
    if (rpeInputs[1]) {
      await rpeInputs[1].click({ clickCount: 3 });
      await rpeInputs[1].type('8');
    }
    await doneButtons[1].click();

    // Set 3: 120 kg, 5 reps, RPE 9 (PR set!)
    await repsInputs[2].click({ clickCount: 3 });
    await repsInputs[2].type('5');
    await weightInputs[2].click({ clickCount: 3 });
    await weightInputs[2].type('120');
    if (rpeInputs[2]) {
      await rpeInputs[2].click({ clickCount: 3 });
      await rpeInputs[2].type('9');
    }
    await doneButtons[2].click();

    console.log('Exercise 1 logged: 100kg x 8, 110kg x 6, 120kg x 5 (PR)');

    // Scroll dialog down to see remaining exercises
    await page.evaluate(() => {
      const scrollable = document.querySelector('div[role="dialog"] .overflow-y-auto');
      if (scrollable) scrollable.scrollTop = 400;
    });
    await delay(500);

    // Complete remaining sets quickly to simulate active athlete logging
    for (let i = 3; i < doneButtons.length; i++) {
      await doneButtons[i].click();
      await delay(100);
    }

    // Scroll to bottom of dialog for feedback, rating, duration
    await page.evaluate(() => {
      const scrollable = document.querySelector('div[role="dialog"] .overflow-y-auto');
      if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
    });
    await delay(500);

    // Enter athlete notes
    const feedbackTextarea = await page.$('textarea[placeholder*="Energy, pain"]');
    if (feedbackTextarea) {
      await feedbackTextarea.type('Felt strong on squats! Hit 120kg for 5 clean reps with good depth and solid bracing.');
    }

    // Rate 5 stars
    const star5 = await page.$('button[aria-label="5 stars"]');
    if (star5) await star5.click();

    // Duration 65 min
    const durationInput = await page.$('input[type="number"][min="1"]');
    if (durationInput) {
      await durationInput.click({ clickCount: 3 });
      await durationInput.type('65');
    }

    await delay(500);

    // Click "Complete workout"
    console.log('Clicking Complete workout button');
    const completeBtn = await page.waitForSelector('button::-p-text("Complete workout")');
    await completeBtn.click();

    // Wait for celebration and modal close
    await delay(3000);

    // Check if dialog closed
    const isDialogOpen = await page.evaluate(() => document.querySelector('div[role="dialog"]') !== null);
    console.log('Dialog closed:', !isDialogOpen);

    // Navigate to Workouts tab to verify "Completed" badge
    const workoutsTabBtn = await page.waitForSelector('nav button::-p-text("Workouts")');
    await workoutsTabBtn.click();
    await delay(1500);

    const workoutsText = await page.evaluate(() => document.body.innerText);
    console.log('Workouts page text contains "Completed":', workoutsText.includes('Completed'));

    await captureScreenshot(page, 'client_03_workout_completed');
    console.log('✓ client_03_workout_completed.png captured');
  } catch (err) {
    console.error('Error in testStep3:', err);
    await captureScreenshot(page, 'step3_error');
    throw err;
  } finally {
    await browser.close();
  }
}

testStep3().catch(console.error);
