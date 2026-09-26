import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  ClientGoals, DailyMetric, FoodLogEntry, FoodResult, Habit, HabitCheckin, MealPlan, MealPlanAssignment, Nutrients, Serving,
} from '../types';
import { foodsApi, habitsApi, mealPlansApi, nutritionApi } from '../services/apiClient';
import { useAuth } from './AuthContext';
import { useApp } from './AppContext';

type NewHabit = Omit<Habit, 'id' | 'active'>;
type NewFoodEntry = Omit<FoodLogEntry, 'id' | 'createdAt'>;
type CustomFoodBody = { name: string; brand?: string; per100g: Nutrients; servings: Serving[] };
type MealPlanBody = Pick<MealPlan, 'title' | 'description' | 'days'>;

interface NutritionContextType {
  goals: ClientGoals[];
  foodLog: FoodLogEntry[];
  daily: DailyMetric[];
  habits: Habit[];
  checkins: HabitCheckin[];
  customFoods: FoodResult[];
  mealPlans: MealPlan[];
  assignments: MealPlanAssignment[];
  isLoading: boolean;

  /** Fetch diary, water/steps and check-ins for a date range (merged into what's loaded). */
  loadRange: (from: string, to: string, clientId?: string) => Promise<void>;

  setGoals: (clientId: string, goals: Omit<ClientGoals, 'clientId'>) => Promise<boolean>;
  addFood: (entry: NewFoodEntry) => Promise<boolean>;
  updateFood: (id: string, updates: Partial<Pick<FoodLogEntry, 'meal' | 'quantity'>>) => Promise<boolean>;
  deleteFood: (id: string) => Promise<boolean>;
  setDaily: (clientId: string, date: string, values: { waterMl?: number; steps?: number }) => Promise<boolean>;

  createHabit: (habit: NewHabit) => Promise<boolean>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<boolean>;
  deleteHabit: (id: string) => Promise<boolean>;
  checkIn: (habitId: string, date: string, completed: boolean) => Promise<boolean>;

  saveCustomFood: (food: CustomFoodBody, id?: string) => Promise<FoodResult | null>;
  deleteCustomFood: (id: string) => Promise<boolean>;
  saveMealPlan: (plan: MealPlanBody, id?: string) => Promise<MealPlan | null>;
  deleteMealPlan: (id: string) => Promise<boolean>;
  assignMealPlan: (planId: string, clientId: string, startDate: string) => Promise<boolean>;
  unassignMealPlan: (clientId: string) => Promise<boolean>;
}

const NutritionContext = createContext<NutritionContextType | undefined>(undefined);

/** Merge rows by id, letting fresh rows replace stale ones. */
const mergeById = <T extends { id: string }>(prev: T[], fresh: T[]) => {
  const map = new Map(prev.map(r => [r.id, r]));
  fresh.forEach(r => map.set(r.id, r));
  return [...map.values()];
};

export const NutritionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, user } = useAuth();
  const { showToast } = useApp();

  const [goals, setGoalsState] = useState<ClientGoals[]>([]);
  const [foodLog, setFoodLog] = useState<FoodLogEntry[]>([]);
  const [daily, setDailyState] = useState<DailyMetric[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkins, setCheckins] = useState<HabitCheckin[]>([]);
  const [customFoods, setCustomFoods] = useState<FoodResult[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [assignments, setAssignments] = useState<MealPlanAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reset = useCallback(() => {
    setGoalsState([]);
    setFoodLog([]);
    setDailyState([]);
    setHabits([]);
    setCheckins([]);
    setCustomFoods([]);
    setMealPlans([]);
    setAssignments([]);
  }, []);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [g, log, d, h, c, foods, plans, a] = await Promise.all([
        nutritionApi.goals(),
        nutritionApi.log(),
        nutritionApi.daily(),
        habitsApi.getAll(),
        habitsApi.checkins(),
        foodsApi.custom(),
        mealPlansApi.getAll(),
        mealPlansApi.assignments(),
      ]);
      setGoalsState(g);
      setFoodLog(log);
      setDailyState(d);
      setHabits(h);
      setCheckins(c);
      setCustomFoods(foods);
      setMealPlans(plans);
      setAssignments(a);
    } catch {
      // AppContext surfaces load errors; nutrition data stays empty until the next refresh.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'signed_in') loadAll();
    else if (status === 'signed_out') reset();
  }, [status, user?.id, loadAll, reset]);

  const run = async <T,>(action: () => Promise<T>, success?: string): Promise<T | null> => {
    try {
      const result = await action();
      if (success) showToast(success);
      return result;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      return null;
    }
  };

  const loadRange = async (from: string, to: string, clientId?: string) => {
    const params = { from, to, clientId };
    const [log, d, c] = await Promise.all([nutritionApi.log(params), nutritionApi.daily(params), habitsApi.checkins(params)]);
    setFoodLog(prev => mergeById(prev, log));
    setDailyState(prev => mergeById(prev, d));
    setCheckins(prev => mergeById(prev, c));
  };

  const value: NutritionContextType = {
    goals, foodLog, daily, habits, checkins, customFoods, mealPlans, assignments, isLoading, loadRange,

    setGoals: async (clientId, body) =>
      (await run(async () => {
        const saved = await nutritionApi.setGoals(clientId, body);
        setGoalsState(prev => [saved, ...prev.filter(g => g.clientId !== clientId)]);
        return saved;
      }, 'Goals saved.')) !== null,

    addFood: async entry =>
      (await run(async () => {
        const saved = await nutritionApi.addFood(entry);
        setFoodLog(prev => [...prev, saved]);
        return saved;
      }, `${entry.name} logged.`)) !== null,

    updateFood: async (id, updates) =>
      (await run(async () => {
        const saved = await nutritionApi.updateFood(id, updates);
        setFoodLog(prev => prev.map(e => (e.id === id ? saved : e)));
        return saved;
      })) !== null,

    deleteFood: async id =>
      (await run(async () => {
        await nutritionApi.deleteFood(id);
        setFoodLog(prev => prev.filter(e => e.id !== id));
        return true;
      })) !== null,

    setDaily: async (clientId, date, values) =>
      (await run(async () => {
        const saved = await nutritionApi.setDaily({ clientId, date, ...values });
        setDailyState(prev => mergeById(prev, [saved]));
        return saved;
      })) !== null,

    createHabit: async habit =>
      (await run(async () => {
        const saved = await habitsApi.create(habit);
        setHabits(prev => [...prev, saved]);
        return saved;
      }, `Habit "${habit.title}" added.`)) !== null,

    updateHabit: async (id, updates) =>
      (await run(async () => {
        const saved = await habitsApi.update(id, updates);
        setHabits(prev => prev.map(h => (h.id === id ? saved : h)));
        return saved;
      })) !== null,

    deleteHabit: async id =>
      (await run(async () => {
        await habitsApi.delete(id);
        setHabits(prev => prev.filter(h => h.id !== id));
        setCheckins(prev => prev.filter(c => c.habitId !== id));
        return true;
      }, 'Habit removed.')) !== null,

    checkIn: async (habitId, date, completed) =>
      (await run(async () => {
        const saved = await habitsApi.checkIn(habitId, date, completed);
        setCheckins(prev => mergeById(prev, [saved]));
        return saved;
      })) !== null,

    saveCustomFood: (food, id) =>
      run(async () => {
        const saved = id ? await foodsApi.updateCustom(id, food) : await foodsApi.createCustom(food);
        setCustomFoods(prev => [saved, ...prev.filter(f => f.sourceId !== saved.sourceId)].sort((a, b) => a.name.localeCompare(b.name)));
        return saved;
      }, `Food "${food.name}" saved.`),

    deleteCustomFood: async id =>
      (await run(async () => {
        await foodsApi.deleteCustom(id);
        setCustomFoods(prev => prev.filter(f => f.sourceId !== id));
        return true;
      }, 'Food deleted.')) !== null,

    saveMealPlan: (plan, id) =>
      run(async () => {
        const saved = id ? await mealPlansApi.update(id, plan) : await mealPlansApi.create(plan);
        setMealPlans(prev => (id ? prev.map(p => (p.id === id ? saved : p)) : [saved, ...prev]));
        return saved;
      }, `Meal plan "${plan.title}" saved.`),

    deleteMealPlan: async id =>
      (await run(async () => {
        await mealPlansApi.delete(id);
        setMealPlans(prev => prev.filter(p => p.id !== id));
        setAssignments(prev => prev.filter(a => a.mealPlanId !== id));
        return true;
      }, 'Meal plan deleted.')) !== null,

    assignMealPlan: async (planId, clientId, startDate) =>
      (await run(async () => {
        const saved = await mealPlansApi.assign(planId, clientId, startDate);
        setAssignments(prev => [saved, ...prev.filter(a => a.clientId !== clientId)]);
        return saved;
      }, 'Meal plan assigned.')) !== null,

    unassignMealPlan: async clientId =>
      (await run(async () => {
        await mealPlansApi.unassign(clientId);
        setAssignments(prev => prev.filter(a => a.clientId !== clientId));
        return true;
      }, 'Meal plan removed.')) !== null,
  };

  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>;
};

export const useNutrition = () => {
  const context = useContext(NutritionContext);
  if (!context) throw new Error('useNutrition must be used within a NutritionProvider');
  return context;
};
