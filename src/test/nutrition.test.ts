import { describe, test, expect } from 'vitest';
import { FoodResult, Habit, HabitCheckin, MealPlan } from '../types';
import {
  addDays, habitAppliesOn, habitCompletionRate, habitStreak, isoWeekday, mealPlanDayFor, portionOf, sumNutrients, targetsFor,
} from '../utils/nutrition';

const chapati: FoodResult = {
  source: 'custom', sourceId: 'food-chapati', name: 'Chapati', brand: '',
  per100g: { calories: 300, protein: 8, carbs: 46, fat: 9, fiber: 3 },
  servings: [{ label: '100 g', grams: 100 }, { label: '1 piece', grams: 70 }],
};

const habit = (days: number[] = []): Habit => ({ id: 'h', clientId: 'c', title: 'x', unit: '', daysOfWeek: days, active: true, sortOrder: 0 });
const done = (...dates: string[]): HabitCheckin[] => dates.map((date, i) => ({ id: `c${i}`, habitId: 'h', clientId: 'c', date, completed: true }));

describe('nutrition helpers', () => {
  test('portions scale per-100 g values', () => {
    const item = portionOf(chapati, chapati.servings[1], 2);
    expect(item).toMatchObject({ calories: 420, protein: 11.2, carbs: 64.4, servingGrams: 70, quantity: 2 });
    expect(sumNutrients([item, item]).calories).toBe(840);
  });

  test('rest-day targets override only what the coach set', () => {
    const goals = { clientId: 'c', calories: 2700, protein: 180, carbs: 300, fat: 80, restDayCalories: 2400, restDayCarbs: 225, notes: '' };
    expect(targetsFor(goals, true)).toMatchObject({ calories: 2700, carbs: 300, isRestDay: false });
    expect(targetsFor(goals, false)).toMatchObject({ calories: 2400, carbs: 225, protein: 180, isRestDay: true });
  });

  test('weekdays and habit schedules', () => {
    expect(isoWeekday('2026-09-28')).toBe(1); // Monday
    expect(isoWeekday('2026-09-27')).toBe(7); // Sunday
    expect(habitAppliesOn(habit([1, 3, 5]), '2026-09-29')).toBe(false); // Tuesday
    expect(habitAppliesOn(habit(), '2026-09-29')).toBe(true);
  });

  test('streaks skip unscheduled days and forgive an unfinished today', () => {
    const today = '2026-10-02'; // Friday
    expect(habitStreak(habit(), done('2026-09-30', '2026-10-01'), today)).toBe(2);
    expect(habitStreak(habit(), done('2026-09-30', '2026-10-01', today), today)).toBe(3);
    expect(habitStreak(habit(), done('2026-09-29', '2026-10-01'), today)).toBe(1); // gap on the 30th
    // Mon/Wed/Fri habit: Mon 28 and Wed 30 done, Fri today not yet → 2
    expect(habitStreak(habit([1, 3, 5]), done('2026-09-28', '2026-09-30'), today)).toBe(2);
  });

  test('completion rate over the last week', () => {
    const today = '2026-10-02';
    const dates = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
    expect(habitCompletionRate([habit()], done(...dates.slice(0, 5)), today)).toBe(71);
    expect(habitCompletionRate([], [], today)).toBeNull();
  });

  test('meal plans repeat from the start date', () => {
    const plan = { id: 'p', title: 'x', description: '', createdAt: '', updatedAt: '',
      days: [1, 2, 3].map(n => ({ id: `d${n}`, dayNumber: n, meals: [] })) } as MealPlan;
    const a = { clientId: 'c', mealPlanId: 'p', startDate: '2026-09-28' };
    expect(mealPlanDayFor(plan, a, '2026-09-28')?.dayNumber).toBe(1);
    expect(mealPlanDayFor(plan, a, '2026-09-30')?.dayNumber).toBe(3);
    expect(mealPlanDayFor(plan, a, '2026-10-01')?.dayNumber).toBe(1);
    expect(mealPlanDayFor(plan, a, '2026-09-27')).toBeNull();
  });
});
