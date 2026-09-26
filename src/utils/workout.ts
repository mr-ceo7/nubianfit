import {
  Exercise,
  ExerciseGroup,
  GroupKind,
  ScheduledWorkout,
  TrackingType,
  WorkoutContent,
  WorkoutExerciseItem,
  WorkoutSection,
  WorkoutSet,
} from '../types';

let counter = 0;
/** Client-side id for items inside workout JSON (never used as a database key). */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const SECTIONS: { id: WorkoutSection; label: string }[] = [
  { id: 'warmup', label: 'Warm-up' },
  { id: 'main', label: 'Main workout' },
  { id: 'cooldown', label: 'Cool-down' },
];

type SetField = 'reps' | 'weight' | 'time' | 'distance';

export const TRACKING: Record<TrackingType, { label: string; fields: SetField[] }> = {
  reps_weight: { label: 'Reps × weight', fields: ['reps', 'weight'] },
  reps: { label: 'Reps only', fields: ['reps'] },
  time: { label: 'Time', fields: ['time'] },
  distance: { label: 'Distance', fields: ['distance'] },
  time_distance: { label: 'Time + distance', fields: ['time', 'distance'] },
};

export const GROUP_KINDS: { id: GroupKind; label: string; hint: string }[] = [
  { id: 'superset', label: 'Superset', hint: 'Back-to-back, rest after the pair' },
  { id: 'circuit', label: 'Circuit', hint: 'Rotate through for set rounds' },
  { id: 'amrap', label: 'AMRAP', hint: 'As many rounds as possible in a time cap' },
  { id: 'emom', label: 'EMOM', hint: 'Every minute on the minute' },
];

export const sectionOf = (ex: WorkoutExerciseItem): WorkoutSection => ex.section ?? 'main';
export const trackingOf = (ex: WorkoutExerciseItem): TrackingType => ex.trackingType ?? 'reps_weight';

export function groupLabel(group: ExerciseGroup): string {
  switch (group.kind) {
    case 'superset':
      return `Superset${group.rounds ? ` · ${group.rounds} rounds` : ''}`;
    case 'circuit':
      return `Circuit${group.rounds ? ` · ${group.rounds} rounds` : ''}`;
    case 'amrap':
      return `AMRAP${group.timeCapMin ? ` · ${group.timeCapMin} min` : ''}`;
    case 'emom':
      return `EMOM${group.timeCapMin ? ` · ${group.timeCapMin} min` : ''}${group.intervalSec && group.intervalSec !== 60 ? ` (every ${group.intervalSec}s)` : ''}`;
  }
}

export interface WorkoutBlock {
  group?: ExerciseGroup;
  /** Exercises with their index in the flat `exercises` array. */
  items: { exercise: WorkoutExerciseItem; index: number }[];
}

/**
 * Arrange the flat exercise list for display: by section (warm-up, main, cool-down), then into
 * blocks where consecutive exercises sharing a groupId form one superset/circuit/AMRAP/EMOM.
 */
export function buildSections(content: WorkoutContent): { section: WorkoutSection; label: string; blocks: WorkoutBlock[] }[] {
  const groups = new Map((content.groups ?? []).map(g => [g.id, g]));
  return SECTIONS.map(({ id, label }) => {
    const blocks: WorkoutBlock[] = [];
    content.exercises.forEach((exercise, index) => {
      if (sectionOf(exercise) !== id) return;
      const group = exercise.groupId ? groups.get(exercise.groupId) : undefined;
      const last = blocks[blocks.length - 1];
      if (group && last?.group?.id === group.id) {
        last.items.push({ exercise, index });
      } else {
        blocks.push({ group, items: [{ exercise, index }] });
      }
    });
    return { section: id, label, blocks };
  }).filter(s => s.blocks.length > 0);
}

export function makeSet(tracking: TrackingType, setNumber: number, previous?: WorkoutSet): WorkoutSet {
  const base: WorkoutSet = { id: newId('set'), setNumber, targetReps: '', restSeconds: previous?.restSeconds ?? 90 };
  const fields = TRACKING[tracking].fields;
  if (fields.includes('reps')) base.targetReps = previous?.targetReps || (tracking === 'reps' ? '12' : '8-10');
  if (fields.includes('weight')) base.targetWeightKg = previous?.targetWeightKg;
  if (fields.includes('time')) base.targetDurationSec = previous?.targetDurationSec ?? 60;
  if (fields.includes('distance')) base.targetDistanceM = previous?.targetDistanceM ?? 1000;
  return base;
}

export function createWorkoutItem(exercise: Exercise, section: WorkoutSection = 'main'): WorkoutExerciseItem {
  const tracking = exercise.trackingType ?? 'reps_weight';
  const setCount = section === 'main' ? 3 : 1;
  const sets: WorkoutSet[] = [];
  for (let i = 1; i <= setCount; i++) sets.push(makeSet(tracking, i, sets[i - 2]));
  return {
    id: newId('we'),
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    equipment: exercise.equipment,
    section,
    trackingType: tracking,
    videoUrl: exercise.videoUrl ?? undefined,
    sets,
  };
}

/** Deep copy with fresh item/set/group ids, e.g. when dropping a library workout into a program. */
export function cloneContent<T extends WorkoutContent>(content: T): T {
  const groupIds = new Map<string, string>();
  const groups = (content.groups ?? []).map(g => {
    const id = newId('grp');
    groupIds.set(g.id, id);
    return { ...g, id, completedRounds: undefined };
  });
  return {
    ...structuredClone(content),
    groups,
    exercises: content.exercises.map(ex => ({
      ...structuredClone(ex),
      id: newId('we'),
      groupId: ex.groupId ? groupIds.get(ex.groupId) : undefined,
      sets: ex.sets.map(s => ({
        ...s,
        id: newId('set'),
        isCompleted: false,
        completedReps: undefined,
        completedWeightKg: undefined,
        completedRpe: undefined,
        completedDurationSec: undefined,
        completedDistanceM: undefined,
      })),
    })),
  };
}

/** "1:30" for 90 seconds; "45s" under a minute. */
export function formatDuration(totalSec?: number): string {
  if (totalSec === undefined || totalSec === null || Number.isNaN(totalSec)) return '';
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Parse "1:30", "90" or "90s" into seconds. */
export function parseDuration(value: string): number | undefined {
  const v = value.trim().replace(/s$/, '');
  if (!v) return undefined;
  if (v.includes(':')) {
    const [m, s] = v.split(':').map(Number);
    return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : undefined;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function formatDistance(m?: number): string {
  if (m === undefined || m === null) return '';
  return m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 2)} km` : `${m} m`;
}

/** Prescription for one set, e.g. "8-10 × 60 kg", "1:00", "4 km in 20:00". */
export function describeTarget(set: WorkoutSet, tracking: TrackingType): string {
  const parts: string[] = [];
  const f = TRACKING[tracking].fields;
  if (f.includes('reps') && set.targetReps) parts.push(`${set.targetReps} reps`);
  if (f.includes('weight') && set.targetWeightKg) parts.push(`${set.targetWeightKg} kg`);
  if (f.includes('distance') && set.targetDistanceM) parts.push(formatDistance(set.targetDistanceM));
  if (f.includes('time') && set.targetDurationSec) parts.push(formatDuration(set.targetDurationSec));
  return parts.join(' × ') || '—';
}

/** What was actually done in a set, same format as describeTarget. */
export function describeResult(set: WorkoutSet, tracking: TrackingType): string {
  const parts: string[] = [];
  const f = TRACKING[tracking].fields;
  if (f.includes('reps') && set.completedReps) parts.push(`${set.completedReps}`);
  if (f.includes('weight') && set.completedWeightKg) parts.push(`${set.completedWeightKg} kg`);
  if (f.includes('distance') && set.completedDistanceM) parts.push(formatDistance(set.completedDistanceM));
  if (f.includes('time') && set.completedDurationSec) parts.push(formatDuration(set.completedDurationSec));
  return parts.join(' × ');
}

/**
 * The athlete's most recent completed performance of an exercise before this workout,
 * e.g. "Last time (12 Sep): 60 kg × 8, 62.5 kg × 8".
 */
export function lastPerformance(
  workouts: ScheduledWorkout[],
  current: ScheduledWorkout,
  exerciseName: string
): { date: string; sets: string[] } | null {
  const previous = workouts
    .filter(w => w.clientId === current.clientId && w.id !== current.id && w.status === 'Completed' && w.date <= current.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  for (const w of previous) {
    const ex = w.exercises.find(e => e.exerciseName === exerciseName);
    if (!ex) continue;
    const sets = ex.sets.filter(s => s.isCompleted).map(s => describeResult(s, trackingOf(ex))).filter(Boolean);
    if (sets.length) return { date: w.date, sets };
  }
  return null;
}

/**
 * Embeddable player URL for a YouTube or Vimeo link, or null if the link isn't one we can embed.
 * Uses youtube-nocookie.com so no tracking cookies are set until the video plays.
 */
export function videoEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'youtube.com') {
    const id = parsed.searchParams.get('v') || parsed.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/)?.[1];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = parsed.pathname.match(/(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}
