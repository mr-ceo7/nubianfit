import { describe, test, expect } from 'vitest';
import { Exercise, WorkoutContent } from '../types';
import {
  addExercises, addSet, changeTracking, groupExercises, moveBlock, removeExercise, setGroupRounds, ungroup,
} from '../utils/workoutEdit';
import { buildSections, cloneContent, groupLabel, parseDuration, videoEmbedUrl } from '../utils/workout';

const ex = (id: string, trackingType?: Exercise['trackingType']): Exercise => ({
  id, name: id, primaryMuscle: 'Chest', secondaryMuscles: [], equipment: 'Barbell', difficulty: 'Intermediate',
  description: '', instructions: [], formCues: [], thumbnailUrl: '', category: 'Strength', trackingType,
});
const names = (c: WorkoutContent) => c.exercises.map(e => e.exerciseName);
const empty: WorkoutContent = { exercises: [], groups: [] };

describe('workout editing', () => {
  test('exercises land in their section, which stays in warm-up → main → cool-down order', () => {
    let c = addExercises(empty, [ex('bench'), ex('row')], 'main');
    c = addExercises(c, [ex('stretch')], 'cooldown');
    c = addExercises(c, [ex('bands')], 'warmup');
    c = addExercises(c, [ex('dips')], 'main');
    expect(names(c)).toEqual(['bands', 'bench', 'row', 'dips', 'stretch']);
    expect(buildSections(c).map(s => s.section)).toEqual(['warmup', 'main', 'cooldown']);
  });

  test('grouping makes members contiguous and syncs rounds to sets', () => {
    let c = addExercises(empty, [ex('a'), ex('b'), ex('c')], 'main');
    c = addSet(c, 2); // c has 4 sets, a has 3
    c = groupExercises(c, [0, 2], 'superset');
    expect(names(c)).toEqual(['a', 'c', 'b']);
    const group = c.groups![0];
    expect(group.rounds).toBe(4);
    expect(c.exercises[0].sets).toHaveLength(4);
    const blocks = buildSections(c)[0].blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].group?.id).toBe(group.id);
    expect(groupLabel(group)).toBe('Superset · 4 rounds');

    c = setGroupRounds(c, group.id, 2);
    expect(c.exercises.filter(e => e.groupId).every(e => e.sets.length === 2)).toBe(true);
  });

  test('removing a member dissolves a two-exercise group; ungroup keeps exercises', () => {
    let c = groupExercises(addExercises(empty, [ex('a'), ex('b'), ex('c')], 'main'), [0, 1, 2], 'circuit');
    c = removeExercise(c, 0);
    expect(c.groups).toHaveLength(1);
    c = removeExercise(c, 0);
    expect(c.groups).toHaveLength(0);
    expect(c.exercises[0].groupId).toBeUndefined();

    let d = groupExercises(addExercises(empty, [ex('a'), ex('b')], 'main'), [0, 1], 'amrap');
    expect(d.groups![0].timeCapMin).toBe(12);
    d = ungroup(d, d.groups![0].id);
    expect(d.exercises.every(e => !e.groupId)).toBe(true);
  });

  test('moving a block moves a whole group', () => {
    let c = addExercises(empty, [ex('a'), ex('b'), ex('c')], 'main');
    c = groupExercises(c, [1, 2], 'superset');
    c = moveBlock(c, 'main', 1, -1);
    expect(names(c)).toEqual(['b', 'c', 'a']);
  });

  test('changing tracking rebuilds targets but keeps set count', () => {
    let c = addExercises(empty, [ex('run')], 'main');
    c = changeTracking(c, 0, 'time_distance');
    expect(c.exercises[0].sets).toHaveLength(3);
    expect(c.exercises[0].sets[0]).toMatchObject({ targetDurationSec: 60, targetDistanceM: 1000 });
    expect(c.exercises[0].sets[0].targetWeightKg).toBeUndefined();
  });

  test('cloning gives fresh ids but keeps group links and clears logged results', () => {
    let c = groupExercises(addExercises(empty, [ex('a'), ex('b')], 'main'), [0, 1], 'superset');
    c.exercises[0].sets[0] = { ...c.exercises[0].sets[0], isCompleted: true, completedReps: 8 };
    const copy = cloneContent(c);
    expect(copy.groups![0].id).not.toBe(c.groups![0].id);
    expect(copy.exercises.every(e => e.groupId === copy.groups![0].id)).toBe(true);
    expect(copy.exercises[0].sets[0].isCompleted).toBe(false);
    expect(copy.exercises[0].sets[0].completedReps).toBeUndefined();
  });
});

describe('workout helpers', () => {
  test('video links become embeddable players', () => {
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=abc123&t=5')).toBe('https://www.youtube-nocookie.com/embed/abc123');
    expect(videoEmbedUrl('https://youtu.be/abc123')).toBe('https://www.youtube-nocookie.com/embed/abc123');
    expect(videoEmbedUrl('https://youtube.com/shorts/xyz')).toBe('https://www.youtube-nocookie.com/embed/xyz');
    expect(videoEmbedUrl('https://vimeo.com/76979871')).toBe('https://player.vimeo.com/video/76979871');
    expect(videoEmbedUrl('https://example.com/video.mp4')).toBeNull();
    expect(videoEmbedUrl('not a url')).toBeNull();
  });

  test('durations parse from m:ss or seconds', () => {
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('45s')).toBe(45);
    expect(parseDuration('')).toBeUndefined();
  });
});
