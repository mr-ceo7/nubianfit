import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Link2, PlayCircle, Plus, Trash2, Unlink, X } from 'lucide-react';
import { ExerciseGroup, GroupKind, TrackingType, WorkoutContent, WorkoutExerciseItem, WorkoutSection, WorkoutSet } from '../../types';
import {
  buildSections, formatDuration, GROUP_KINDS, groupLabel, parseDuration, SECTIONS, TRACKING, trackingOf,
} from '../../utils/workout';
import {
  addExercises, addSet, changeTracking, groupExercises, moveBlock, moveWithinGroup, removeExercise, removeSet,
  ungroup, updateExercise, updateGroup,
} from '../../utils/workoutEdit';
import { ExercisePicker } from './ExercisePicker';
import { VideoEmbed } from './VideoEmbed';

export interface WorkoutDraft extends WorkoutContent {
  title: string;
  description?: string;
  estimatedDurationMin?: number;
}

interface WorkoutEditorProps {
  draft: WorkoutDraft;
  onChange: (draft: WorkoutDraft) => void;
}

const inputCls =
  'w-full h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500';

/** Structured workout editor: sections, supersets/circuits/AMRAP/EMOM blocks, per-exercise tracking. */
export const WorkoutEditor: React.FC<WorkoutEditorProps> = ({ draft, onChange }) => {
  const [pickerSection, setPickerSection] = useState<WorkoutSection | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [openVideo, setOpenVideo] = useState<string | null>(null);

  const apply = (next: WorkoutDraft) => {
    setSelected([]);
    onChange(next);
  };
  const sections = buildSections(draft);
  const selectedSections = new Set(selected.map(i => draft.exercises[i]?.section ?? 'main'));

  const toggleSelect = (index: number) =>
    setSelected(prev => (prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]));

  return (
    <div className="space-y-5">
      {/* Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Workout name
          <input
            value={draft.title}
            onChange={e => onChange({ ...draft, title: e.target.value })}
            placeholder="e.g. Upper Body Strength"
            className={`${inputCls} h-10 text-sm mt-1 normal-case tracking-normal font-semibold`}
          />
        </label>
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Duration (min)
          <input
            type="number"
            min={0}
            value={draft.estimatedDurationMin ?? ''}
            onChange={e => onChange({ ...draft, estimatedDurationMin: e.target.value ? Number(e.target.value) : undefined })}
            className={`${inputCls} h-10 text-sm mt-1`}
          />
        </label>
      </div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
        Instructions for the athlete
        <textarea
          rows={2}
          value={draft.description ?? ''}
          onChange={e => onChange({ ...draft, description: e.target.value })}
          placeholder="Focus, intent, warm-up notes…"
          className="mt-1 w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white normal-case tracking-normal font-normal placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </label>

      {/* Grouping toolbar */}
      {selected.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-slate-800 border border-slate-700">
          <span className="text-xs font-semibold text-white mr-1">{selected.length} selected</span>
          {selected.length >= 2 && selectedSections.size === 1 ? (
            GROUP_KINDS.map(k => (
              <button
                key={k.id}
                title={k.hint}
                onClick={() => apply(groupExercises(draft, selected, k.id))}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
              >
                <Link2 className="inline h-3 w-3 mr-1" />
                {k.label}
              </button>
            ))
          ) : (
            <span className="text-xs text-slate-100">Select two or more exercises in the same section to group them.</span>
          )}
          <button onClick={() => setSelected([])} className="ml-auto text-xs font-semibold text-slate-100 hover:text-white">
            Clear
          </button>
        </div>
      )}

      {/* Sections */}
      {SECTIONS.map(({ id: sectionId, label }) => {
        const sec = sections.find(s => s.section === sectionId);
        return (
          <section key={sectionId} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</h4>
              <button
                onClick={() => setPickerSection(sectionId)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100"
              >
                <Plus className="h-3.5 w-3.5" /> Add exercise
              </button>
            </div>

            {!sec && (
              <p className="text-xs text-slate-400 px-3 py-4 rounded-xl border border-dashed border-slate-800 text-center">
                {sectionId === 'main' ? 'Add the exercises for this workout.' : `No ${label.toLowerCase()} exercises.`}
              </p>
            )}

            {sec?.blocks.map((block, blockIndex) => {
              const blockControls = (
                <div className="flex items-center gap-0.5">
                  <IconButton label="Move block up" disabled={blockIndex === 0} onClick={() => apply(moveBlock(draft, sectionId, blockIndex, -1))}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton label="Move block down" disabled={blockIndex === sec.blocks.length - 1} onClick={() => apply(moveBlock(draft, sectionId, blockIndex, 1))}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              );

              const cards = block.items.map(({ exercise, index }, i) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  inGroup={!!block.group}
                  selected={selected.includes(index)}
                  onToggleSelect={() => toggleSelect(index)}
                  videoOpen={openVideo === exercise.id}
                  onToggleVideo={() => setOpenVideo(openVideo === exercise.id ? null : exercise.id)}
                  controls={
                    block.group ? (
                      <div className="flex items-center gap-0.5">
                        <IconButton label="Move up in group" disabled={i === 0} onClick={() => apply(moveWithinGroup(draft, index, -1))}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton label="Move down in group" disabled={i === block.items.length - 1} onClick={() => apply(moveWithinGroup(draft, index, 1))}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    ) : (
                      blockControls
                    )
                  }
                  onRemove={() => apply(removeExercise(draft, index))}
                  onChange={patch => onChange(updateExercise(draft, index, patch))}
                  onTracking={t => onChange(changeTracking(draft, index, t))}
                  onAddSet={() => onChange(addSet(draft, index))}
                  onRemoveSet={s => onChange(removeSet(draft, index, s))}
                />
              ));

              if (!block.group) return <React.Fragment key={block.items[0].exercise.id}>{cards}</React.Fragment>;
              return (
                <GroupBlock
                  key={block.group.id}
                  group={block.group}
                  controls={blockControls}
                  onChange={patch => onChange(updateGroup(draft, block.group!.id, patch))}
                  onUngroup={() => apply(ungroup(draft, block.group!.id))}
                >
                  {cards}
                </GroupBlock>
              );
            })}
          </section>
        );
      })}

      {pickerSection && (
        <ExercisePicker
          title={`Add to ${SECTIONS.find(s => s.id === pickerSection)?.label.toLowerCase()}`}
          onClose={() => setPickerSection(null)}
          onPick={picked => apply(addExercises(draft, picked, pickerSection))}
        />
      )}
    </div>
  );
};

const IconButton: React.FC<{ label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({
  label, onClick, disabled, children,
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
  >
    {children}
  </button>
);

const GroupBlock: React.FC<{
  group: ExerciseGroup;
  controls: React.ReactNode;
  onChange: (patch: Partial<ExerciseGroup>) => void;
  onUngroup: () => void;
  children: React.ReactNode;
}> = ({ group, controls, onChange, onUngroup, children }) => (
  <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/5 p-2.5 space-y-2">
    <div className="flex flex-wrap items-center gap-2 px-1">
      <Link2 className="h-4 w-4 text-emerald-400" />
      <select
        aria-label="Block type"
        value={group.kind}
        onChange={e => onChange({ kind: e.target.value as GroupKind })}
        className="h-7 px-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-emerald-400"
      >
        {GROUP_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
      </select>
      {(group.kind === 'superset' || group.kind === 'circuit') && (
        <NumberField label="Rounds" value={group.rounds} onChange={v => onChange({ rounds: v ?? 1 })} />
      )}
      {(group.kind === 'amrap' || group.kind === 'emom') && (
        <NumberField label="Minutes" value={group.timeCapMin} onChange={v => onChange({ timeCapMin: v })} />
      )}
      {group.kind === 'emom' && (
        <NumberField label="Every (s)" value={group.intervalSec} onChange={v => onChange({ intervalSec: v })} />
      )}
      <span className="text-[11px] text-slate-400 hidden sm:inline">{groupLabel(group)}</span>
      <div className="ml-auto flex items-center gap-0.5">
        {controls}
        <IconButton label="Ungroup" onClick={onUngroup}>
          <Unlink className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
    <input
      value={group.notes ?? ''}
      onChange={e => onChange({ notes: e.target.value })}
      placeholder="Block notes (e.g. rest 90s between rounds)"
      aria-label="Block notes"
      className={inputCls}
    />
    <div className="space-y-2">{children}</div>
  </div>
);

const NumberField: React.FC<{ label: string; value?: number; onChange: (v: number | undefined) => void }> = ({ label, value, onChange }) => (
  <label className="flex items-center gap-1 text-[11px] text-slate-400">
    {label}
    <input
      type="number"
      min={1}
      value={value ?? ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)}
      className="w-14 h-7 px-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
    />
  </label>
);

interface ExerciseCardProps {
  exercise: WorkoutExerciseItem;
  inGroup: boolean;
  selected: boolean;
  videoOpen: boolean;
  controls: React.ReactNode;
  onToggleSelect: () => void;
  onToggleVideo: () => void;
  onRemove: () => void;
  onChange: (patch: Partial<WorkoutExerciseItem>) => void;
  onTracking: (t: TrackingType) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise, inGroup, selected, videoOpen, controls, onToggleSelect, onToggleVideo, onRemove, onChange, onTracking, onAddSet, onRemoveSet,
}) => {
  const tracking = trackingOf(exercise);
  const fields = TRACKING[tracking].fields;

  const setField = (setIndex: number, patch: Partial<WorkoutSet>) =>
    onChange({ sets: exercise.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)) });

  return (
    <div className={`rounded-xl border p-3 space-y-2.5 ${selected ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-800 bg-slate-900'}`}>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${exercise.exerciseName} for grouping`}
          className="mt-1 accent-emerald-500"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{exercise.exerciseName}</p>
          <p className="text-[11px] text-slate-400">{exercise.primaryMuscle} · {exercise.equipment}</p>
        </div>
        {exercise.videoUrl && (
          <IconButton label={videoOpen ? 'Hide video' : 'Show video'} onClick={onToggleVideo}>
            <PlayCircle className="h-4 w-4 text-emerald-400" />
          </IconButton>
        )}
        {controls}
        <IconButton label="Remove exercise" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      {videoOpen && <VideoEmbed url={exercise.videoUrl} title={exercise.exerciseName} />}

      <div className="grid grid-cols-2 sm:grid-cols-[160px_1fr] gap-2">
        <select
          aria-label="Tracking type"
          value={tracking}
          onChange={e => onTracking(e.target.value as TrackingType)}
          className={inputCls}
        >
          {(Object.keys(TRACKING) as TrackingType[]).map(t => <option key={t} value={t}>{TRACKING[t].label}</option>)}
        </select>
        <input
          value={exercise.coachNotes ?? ''}
          onChange={e => onChange({ coachNotes: e.target.value })}
          placeholder="Coaching cue (e.g. 3s lowering)"
          aria-label="Coaching cue"
          className={inputCls}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-400">
              <th className="text-left font-bold py-1 pr-2 w-8">{inGroup ? 'Rnd' : 'Set'}</th>
              {fields.includes('reps') && <th className="text-left font-bold py-1 pr-2">Reps</th>}
              {fields.includes('weight') && <th className="text-left font-bold py-1 pr-2">Kg</th>}
              {fields.includes('time') && <th className="text-left font-bold py-1 pr-2">Time</th>}
              {fields.includes('distance') && <th className="text-left font-bold py-1 pr-2">Metres</th>}
              <th className="text-left font-bold py-1 pr-2">Rest (s)</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {exercise.sets.map((set, s) => (
              <tr key={set.id}>
                <td className="py-1 pr-2 font-bold text-slate-300">{s + 1}</td>
                {fields.includes('reps') && (
                  <td className="py-1 pr-2">
                    <input aria-label={`Set ${s + 1} reps`} value={set.targetReps} onChange={e => setField(s, { targetReps: e.target.value })} placeholder="8-10" className={`${inputCls} min-w-14`} />
                  </td>
                )}
                {fields.includes('weight') && (
                  <td className="py-1 pr-2">
                    <input aria-label={`Set ${s + 1} weight`} type="number" inputMode="decimal" value={set.targetWeightKg ?? ''} onChange={e => setField(s, { targetWeightKg: e.target.value ? Number(e.target.value) : undefined })} className={`${inputCls} min-w-14`} />
                  </td>
                )}
                {fields.includes('time') && (
                  <td className="py-1 pr-2">
                    <DurationInput label={`Set ${s + 1} time`} value={set.targetDurationSec} onChange={v => setField(s, { targetDurationSec: v })} />
                  </td>
                )}
                {fields.includes('distance') && (
                  <td className="py-1 pr-2">
                    <input aria-label={`Set ${s + 1} distance`} type="number" inputMode="numeric" value={set.targetDistanceM ?? ''} onChange={e => setField(s, { targetDistanceM: e.target.value ? Number(e.target.value) : undefined })} className={`${inputCls} min-w-16`} />
                  </td>
                )}
                <td className="py-1 pr-2">
                  <input aria-label={`Set ${s + 1} rest`} type="number" inputMode="numeric" value={set.restSeconds ?? ''} onChange={e => setField(s, { restSeconds: e.target.value ? Number(e.target.value) : undefined })} className={`${inputCls} min-w-14`} />
                </td>
                <td className="py-1">
                  <IconButton label={`Remove set ${s + 1}`} disabled={exercise.sets.length <= 1} onClick={() => onRemoveSet(s)}>
                    <X className="h-3.5 w-3.5" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={onAddSet} className="text-xs font-semibold text-emerald-400 hover:underline">
        + Add {inGroup ? 'round' : 'set'}
      </button>
    </div>
  );
};

/** Text input that accepts "1:30" or seconds and shows m:ss. */
const DurationInput: React.FC<{ label: string; value?: number; onChange: (v: number | undefined) => void }> = ({ label, value, onChange }) => {
  const [text, setText] = useState(formatDuration(value));
  return (
    <input
      aria-label={label}
      value={text}
      placeholder="1:00"
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        const parsed = parseDuration(text);
        onChange(parsed);
        setText(formatDuration(parsed));
      }}
      className={`${inputCls} min-w-16`}
    />
  );
};
