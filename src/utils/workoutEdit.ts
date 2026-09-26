/**
 * Pure edit operations on workout content. Every function returns new content and keeps these rules:
 * - exercises in a group are contiguous and share one section;
 * - a group always has at least two exercises (otherwise it is dissolved);
 * - superset/circuit rounds equal the member exercises' set count.
 */
import { Exercise, ExerciseGroup, GroupKind, TrackingType, WorkoutContent, WorkoutExerciseItem, WorkoutSection } from '../types';
import { buildSections, createWorkoutItem, makeSet, newId, sectionOf, trackingOf } from './workout';

const withExercises = <T extends WorkoutContent>(content: T, exercises: WorkoutExerciseItem[], groups = content.groups ?? []): T =>
  normalizeGroups({ ...content, exercises, groups });

/** Drop groups with fewer than two members, and member references to missing groups. */
export function normalizeGroups<T extends WorkoutContent>(content: T): T {
  const counts = new Map<string, number>();
  content.exercises.forEach(ex => ex.groupId && counts.set(ex.groupId, (counts.get(ex.groupId) ?? 0) + 1));
  const groups = (content.groups ?? []).filter(g => (counts.get(g.id) ?? 0) >= 2);
  const alive = new Set(groups.map(g => g.id));
  return {
    ...content,
    groups,
    exercises: content.exercises.map(ex => (ex.groupId && !alive.has(ex.groupId) ? { ...ex, groupId: undefined } : ex)),
  };
}

export function addExercises<T extends WorkoutContent>(content: T, picked: Exercise[], section: WorkoutSection): T {
  const items = picked.map(ex => createWorkoutItem(ex, section));
  // Insert after the last exercise of that section so sections stay in order.
  const order: WorkoutSection[] = ['warmup', 'main', 'cooldown'];
  let insertAt = content.exercises.length;
  for (let i = content.exercises.length - 1; i >= 0; i--) {
    if (order.indexOf(sectionOf(content.exercises[i])) <= order.indexOf(section)) {
      insertAt = i + 1;
      break;
    }
    insertAt = i;
  }
  const exercises = [...content.exercises];
  exercises.splice(insertAt, 0, ...items);
  return withExercises(content, exercises);
}

export function removeExercise<T extends WorkoutContent>(content: T, index: number): T {
  return withExercises(content, content.exercises.filter((_, i) => i !== index));
}

export function updateExercise<T extends WorkoutContent>(content: T, index: number, patch: Partial<WorkoutExerciseItem>): T {
  return withExercises(content, content.exercises.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)));
}

/** Switch what is tracked, rebuilding the set targets but keeping the number of sets and rest. */
export function changeTracking<T extends WorkoutContent>(content: T, index: number, tracking: TrackingType): T {
  const ex = content.exercises[index];
  const sets = ex.sets.map((s, i) => ({ ...makeSet(tracking, i + 1), restSeconds: s.restSeconds }));
  return updateExercise(content, index, { trackingType: tracking, sets });
}

export function addSet<T extends WorkoutContent>(content: T, index: number): T {
  const ex = content.exercises[index];
  const last = ex.sets[ex.sets.length - 1];
  const sets = [...ex.sets, makeSet(trackingOf(ex), ex.sets.length + 1, last)];
  return syncGroupRoundsFrom(updateExercise(content, index, { sets }), index);
}

export function removeSet<T extends WorkoutContent>(content: T, index: number, setIndex: number): T {
  const ex = content.exercises[index];
  if (ex.sets.length <= 1) return content;
  const sets = ex.sets.filter((_, i) => i !== setIndex).map((s, i) => ({ ...s, setNumber: i + 1 }));
  return syncGroupRoundsFrom(updateExercise(content, index, { sets }), index);
}

/** Resize every member's sets to `rounds` (supersets/circuits track one set per round). */
export function setGroupRounds<T extends WorkoutContent>(content: T, groupId: string, rounds: number): T {
  const n = Math.max(1, Math.min(50, Math.round(rounds) || 1));
  const exercises = content.exercises.map(ex => {
    if (ex.groupId !== groupId) return ex;
    const sets = ex.sets.slice(0, n);
    while (sets.length < n) sets.push(makeSet(trackingOf(ex), sets.length + 1, sets[sets.length - 1]));
    return { ...ex, sets };
  });
  const groups = (content.groups ?? []).map(g => (g.id === groupId ? { ...g, rounds: n } : g));
  return withExercises(content, exercises, groups);
}

function syncGroupRoundsFrom<T extends WorkoutContent>(content: T, index: number): T {
  const ex = content.exercises[index];
  const group = content.groups?.find(g => g.id === ex.groupId);
  if (!group || (group.kind !== 'superset' && group.kind !== 'circuit')) return content;
  return setGroupRounds(content, group.id, ex.sets.length);
}

export function updateGroup<T extends WorkoutContent>(content: T, groupId: string, patch: Partial<ExerciseGroup>): T {
  if (patch.rounds !== undefined) content = setGroupRounds(content, groupId, patch.rounds);
  const { rounds: _rounds, ...rest } = patch;
  return { ...content, groups: (content.groups ?? []).map(g => (g.id === groupId ? { ...g, ...rest } : g)) };
}

/**
 * Link the given exercises into one block. They move to where the first of them was, keep their
 * relative order, and adopt its section. Any previous grouping of those exercises is replaced.
 */
export function groupExercises<T extends WorkoutContent>(content: T, indices: number[], kind: GroupKind): T {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  if (sorted.length < 2) return content;
  const section = sectionOf(content.exercises[sorted[0]]);
  const group: ExerciseGroup = { id: newId('grp'), kind };
  const members = sorted.map(i => ({ ...content.exercises[i], groupId: group.id, section }));
  if (kind === 'superset' || kind === 'circuit') group.rounds = Math.max(...members.map(m => m.sets.length));
  if (kind === 'amrap') group.timeCapMin = 12;
  if (kind === 'emom') {
    group.timeCapMin = 10;
    group.intervalSec = 60;
  }

  const rest = content.exercises.filter((_, i) => !sorted.includes(i));
  const insertAt = content.exercises.slice(0, sorted[0]).filter((_, i) => !sorted.includes(i)).length;
  const exercises = [...rest.slice(0, insertAt), ...members, ...rest.slice(insertAt)];
  let next = withExercises(content, exercises, [...(content.groups ?? []), group]);
  if (group.rounds) next = setGroupRounds(next, group.id, group.rounds);
  return next;
}

export function ungroup<T extends WorkoutContent>(content: T, groupId: string): T {
  return withExercises(
    content,
    content.exercises.map(ex => (ex.groupId === groupId ? { ...ex, groupId: undefined } : ex)),
    (content.groups ?? []).filter(g => g.id !== groupId)
  );
}

/** Move a whole block (single exercise or group) up or down within its section. */
export function moveBlock<T extends WorkoutContent>(content: T, section: WorkoutSection, blockIndex: number, direction: -1 | 1): T {
  const sec = buildSections(content).find(s => s.section === section);
  if (!sec) return content;
  const target = blockIndex + direction;
  if (target < 0 || target >= sec.blocks.length) return content;
  const blocks = [...sec.blocks];
  [blocks[blockIndex], blocks[target]] = [blocks[target], blocks[blockIndex]];
  const reordered = blocks.flatMap(b => b.items.map(it => it.exercise));
  const positions = sec.blocks.flatMap(b => b.items.map(it => it.index)).sort((a, b) => a - b);
  const exercises = [...content.exercises];
  positions.forEach((pos, i) => { exercises[pos] = reordered[i]; });
  return withExercises(content, exercises);
}

/** Swap an exercise with its neighbour inside the same group. */
export function moveWithinGroup<T extends WorkoutContent>(content: T, index: number, direction: -1 | 1): T {
  const target = index + direction;
  const a = content.exercises[index];
  const b = content.exercises[target];
  if (!a?.groupId || !b || b.groupId !== a.groupId) return content;
  const exercises = [...content.exercises];
  [exercises[index], exercises[target]] = [b, a];
  return withExercises(content, exercises);
}
