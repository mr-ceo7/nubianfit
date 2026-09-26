import {
  ClientGoals, FoodItem, FoodResult, Habit, HabitCheckin, Meal, MealPlan, MealPlanAssignment, MealPlanDay, Nutrients,
  ScheduledWorkout, Serving,
} from '../types';
import { localDateStr } from './dates';

export const MEALS: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
];

export const EMPTY_NUTRIENTS: Nutrients = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

const round1 = (n: number) => Math.round(n * 10) / 10;

export function sumNutrients(items: Nutrients[]): Nutrients {
  return items.reduce(
    (acc, i) => ({
      calories: round1(acc.calories + (i.calories || 0)),
      protein: round1(acc.protein + (i.protein || 0)),
      carbs: round1(acc.carbs + (i.carbs || 0)),
      fat: round1(acc.fat + (i.fat || 0)),
      fiber: round1(acc.fiber + (i.fiber || 0)),
    }),
    EMPTY_NUTRIENTS
  );
}

/** A diary/meal-plan item for `quantity` × `serving` of a food. */
export function portionOf(food: FoodResult, serving: Serving, quantity: number): FoodItem {
  const factor = (serving.grams * quantity) / 100;
  return {
    source: food.source,
    sourceId: food.sourceId,
    name: food.name,
    servingLabel: serving.label,
    servingGrams: serving.grams,
    quantity,
    calories: round1(food.per100g.calories * factor),
    protein: round1(food.per100g.protein * factor),
    carbs: round1(food.per100g.carbs * factor),
    fat: round1(food.per100g.fat * factor),
    fiber: round1(food.per100g.fiber * factor),
  };
}

export function describePortion(item: Pick<FoodItem, 'quantity' | 'servingLabel' | 'servingGrams'>): string {
  if (!item.servingLabel) return '';
  const q = item.quantity === 1 ? '' : `${item.quantity} × `;
  const grams = item.servingGrams && !item.servingLabel.endsWith(' g') ? ` (${Math.round(item.servingGrams * item.quantity)} g)` : '';
  return `${q}${item.servingLabel}${grams}`;
}

export interface DayTargets {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  isRestDay: boolean;
}

/** A day with any scheduled workout counts as a training day. */
export const isTrainingDay = (date: string, workouts: ScheduledWorkout[]) => workouts.some(w => w.date === date);

/** Rest-day values override the training-day ones only where the coach set them. */
export function targetsFor(goals: ClientGoals | undefined, trainingDay: boolean): DayTargets {
  if (!goals) return { isRestDay: !trainingDay };
  if (trainingDay) return { calories: goals.calories, protein: goals.protein, carbs: goals.carbs, fat: goals.fat, isRestDay: false };
  return {
    calories: goals.restDayCalories ?? goals.calories,
    protein: goals.restDayProtein ?? goals.protein,
    carbs: goals.restDayCarbs ?? goals.carbs,
    fat: goals.restDayFat ?? goals.fat,
    isRestDay: true,
  };
}

/** ISO weekday (1 = Monday … 7 = Sunday) for a YYYY-MM-DD string. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return ((new Date(y, m - 1, d).getDay() + 6) % 7) + 1;
}

export const habitAppliesOn = (habit: Habit, date: string) =>
  habit.active && (habit.daysOfWeek.length === 0 || habit.daysOfWeek.includes(isoWeekday(date)));

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return localDateStr(new Date(y, m - 1, d + days));
}

/**
 * Consecutive scheduled days completed, counting back from today. Today only counts once it's
 * done, so an unfinished today doesn't break yesterday's streak.
 */
export function habitStreak(habit: Habit, checkins: HabitCheckin[], today: string): number {
  const done = new Set(checkins.filter(c => c.habitId === habit.id && c.completed).map(c => c.date));
  let streak = 0;
  let day = today;
  if (!done.has(day)) day = addDays(day, -1);
  for (let i = 0; i < 366; i++, day = addDays(day, -1)) {
    if (!habitAppliesOn(habit, day)) continue;
    if (!done.has(day)) break;
    streak++;
  }
  return streak;
}

/** Share of scheduled habit-days completed in the last `days` days (including today). */
export function habitCompletionRate(habits: Habit[], checkins: HabitCheckin[], today: string, days = 7): number | null {
  const done = new Set(checkins.filter(c => c.completed).map(c => `${c.habitId}:${c.date}`));
  let scheduled = 0;
  let completed = 0;
  for (let i = 0; i < days; i++) {
    const day = addDays(today, -i);
    for (const h of habits) {
      if (!habitAppliesOn(h, day)) continue;
      scheduled++;
      if (done.has(`${h.id}:${day}`)) completed++;
    }
  }
  return scheduled ? Math.round((completed / scheduled) * 100) : null;
}

/** The plan day that falls on `date`; plans repeat from their start date. */
export function mealPlanDayFor(plan: MealPlan | undefined, assignment: MealPlanAssignment | undefined, date: string): MealPlanDay | null {
  if (!plan || !assignment || plan.days.length === 0 || date < assignment.startDate) return null;
  const length = Math.max(...plan.days.map(d => d.dayNumber));
  const [sy, sm, sd] = assignment.startDate.split('-').map(Number);
  const [y, m, d] = date.split('-').map(Number);
  const elapsed = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(sy, sm - 1, sd)) / 86400000);
  const dayNumber = (elapsed % length) + 1;
  return plan.days.find(day => day.dayNumber === dayNumber) ?? null;
}

export const dayTotals = (day: MealPlanDay) => sumNutrients(day.meals.flatMap(m => m.items));
