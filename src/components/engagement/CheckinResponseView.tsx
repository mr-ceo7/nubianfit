import React from 'react';
import { MessageSquare } from 'lucide-react';
import { CheckinAnswer, CheckinResponse } from '../../types';

const formatAnswer = (value: CheckinAnswer | undefined, type: string): string => {
  if (value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (type === 'weight') return `${value} kg`;
  return String(value);
};

/** Answers of one submitted check-in (with photos and the coach's comment). */
export const CheckinResponseView: React.FC<{ response: CheckinResponse }> = ({ response }) => (
  <div className="space-y-3">
    <dl className="space-y-3">
      {response.questions.map(q => {
        const value = response.answers[q.id];
        const fileId = value && typeof value === 'object' && !Array.isArray(value) ? (value as { fileId: string }).fileId : null;
        return (
          <div key={q.id}>
            <dt className="text-xs font-semibold text-slate-400">{q.label}</dt>
            <dd className="text-sm text-white whitespace-pre-wrap break-words">
              {fileId && response.photoUrls[fileId]
                ? <img src={response.photoUrls[fileId]} alt={q.label} loading="lazy" className="mt-1 max-h-64 rounded-xl bg-black object-contain" />
                : formatAnswer(value, q.type)}
            </dd>
          </div>
        );
      })}
    </dl>
    {response.coachComment && (
      <div className="flex gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <MessageSquare className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-100 whitespace-pre-wrap">{response.coachComment}</p>
      </div>
    )}
  </div>
);
