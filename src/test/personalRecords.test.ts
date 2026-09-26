import { describe, test, expect } from 'vitest';
import { findNewRecords } from '../components/programs/WorkoutLoggerModal';
import { PersonalRecord, ScheduledWorkout, WorkoutExerciseItem } from '../types';

const workout = { id: 'w1', clientId: 'c1', date: '2026-09-26' } as ScheduledWorkout;

const exercise = (name: string, sets: [number, number, boolean][]): WorkoutExerciseItem => ({
  id: name,
  exerciseId: name,
  exerciseName: name,
  primaryMuscle: 'Chest',
  equipment: 'Barbell',
  sets: sets.map(([w, r, done], i) => ({
    id: `${name}-${i}`,
    setNumber: i + 1,
    targetReps: '5',
    completedWeightKg: w,
    completedReps: r,
    isCompleted: done,
  })),
});

const pr = (exerciseName: string, weightKg: number, reps: number, clientId = 'c1'): PersonalRecord => ({
  id: `${exerciseName}-${weightKg}`,
  clientId,
  exerciseName,
  weightKg,
  reps,
  estimated1RmKg: Math.round(weightKg * (1 + reps / 30)),
  date: '2026-01-01',
});

describe('findNewRecords', () => {
  test('first logged lift is a record; the best set wins', () => {
    const records = findNewRecords(workout, [exercise('Bench', [[60, 5, true], [70, 5, true]])], []);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ exerciseName: 'Bench', weightKg: 70, reps: 5, estimated1RmKg: 82 });
  });

  test('only beats of the previous best count, and only for this client', () => {
    const history = [pr('Bench', 100, 5), pr('Squat', 200, 1, 'someone-else')];
    const records = findNewRecords(workout, [
      exercise('Bench', [[90, 5, true]]),
      exercise('Squat', [[120, 3, true]]),
    ], history);
    expect(records.map(r => r.exerciseName)).toEqual(['Squat']);
  });

  test('incomplete sets are ignored and the previous weight is recorded', () => {
    expect(findNewRecords(workout, [exercise('Row', [[200, 5, false]])], [])).toEqual([]);
    const [record] = findNewRecords(workout, [exercise('Bench', [[110, 5, true]])], [pr('Bench', 100, 5)]);
    expect(record.previousWeightKg).toBe(100);
  });
});
