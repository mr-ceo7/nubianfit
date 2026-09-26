import React, { useState } from 'react';
import {
  TrendingUp,
  Award,
  Plus,
  CheckCircle2,
  Camera,
  Target,
  X,
  Scale
} from 'lucide-react';
import { ClientAvatar } from '../common/ClientAvatar';
import { localDateStr } from '../../utils/dates';
import { useNutrition } from '../../context/NutritionContext';
import { habitCompletionRate } from '../../utils/nutrition';
import { HabitsManager } from '../nutrition/HabitsManager';
import { useApp } from '../../context/AppContext';
import { MetricEntry, PersonalRecord, ProgressPhoto } from '../../types';

export const ProgressTracker: React.FC = () => {
  const { clients } = useApp();
  if (clients.length === 0) {
    return (
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-10 text-center">
        <p className="text-sm text-slate-300">Add a client to start tracking their progress.</p>
      </div>
    );
  }
  return <ProgressTrackerContent />;
};

const ProgressTrackerContent: React.FC = () => {
  const { 
    clients, 
    selectedClientId, 
    setSelectedClientId, 
    metrics, 
    personalRecords, 
    photos, 
    addMetricEntry,
    addPersonalRecord,
    addProgressPhoto
  } = useApp();
  const { habits, checkins } = useNutrition();

  const [activeTab, setActiveTab] = useState<'metrics' | 'habits' | 'photos' | 'prs'>('metrics');
  const [selectedRange, setSelectedRange] = useState<'1M' | '3M' | '6M' | 'All'>('All');

  // Active athlete
  const activeClient = clients.find(c => c.id === selectedClientId) || clients[0];
  const clientMetrics = metrics.filter(m => m.clientId === activeClient?.id);
  const clientPRs = personalRecords.filter(pr => pr.clientId === activeClient?.id);
  const clientPhotos = photos.filter(p => p.clientId === activeClient?.id);

  const todayStr = localDateStr();
  const clientHabits = habits.filter(h => h.clientId === activeClient?.id);
  const habitRate = habitCompletionRate(clientHabits, checkins, todayStr, 7);

  // Photo comparison viewer state
  const [beforePhotoId, setBeforePhotoId] = useState<string>(clientPhotos[0]?.id || '');
  const [afterPhotoId, setAfterPhotoId] = useState<string>(clientPhotos[1]?.id || clientPhotos[0]?.id || '');

  // Modals state
  const [isMetricModalOpen, setIsMetricModalOpen] = useState(false);
  const [isPrModalOpen, setIsPrModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  // New Metric Form State
  const [formDate, setFormDate] = useState('2026-08-16');
  const [formWeight, setFormWeight] = useState(activeClient?.currentWeightKg || 80);
  const [formBodyFat, setFormBodyFat] = useState(activeClient?.bodyFatPercentage || 14);
  const [formChest, setFormChest] = useState(105);
  const [formWaist, setFormWaist] = useState(82);
  const [formArms, setFormArms] = useState(38.5);
  const [formNotes, setFormNotes] = useState('');

  // New PR Form State
  const [formPrExercise, setFormPrExercise] = useState('Barbell Back Squat');
  const [formPrWeight, setFormPrWeight] = useState(140);
  const [formPrReps, setFormPrReps] = useState(5);

  // New Photo Form State
  const [formPhotoView, setFormPhotoView] = useState<'Front' | 'Side' | 'Back'>('Front');
  const [formPhotoUrl, setFormPhotoUrl] = useState('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80');
  const [formPhotoNotes, setFormPhotoNotes] = useState('Progress check-in.');

  const handleCreateMetric = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient) return;

    addMetricEntry({
      clientId: activeClient.id,
      date: formDate,
      weightKg: Number(formWeight),
      bodyFatPercentage: Number(formBodyFat),
      chestCm: Number(formChest),
      waistCm: Number(formWaist),
      armsCm: Number(formArms),
      notes: formNotes.trim() || undefined
    });

    setIsMetricModalOpen(false);
  };

  const handleCreatePR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient) return;

    const est1Rm = Math.round(formPrWeight * (1 + formPrReps / 30));
    addPersonalRecord({
      clientId: activeClient.id,
      exerciseName: formPrExercise,
      weightKg: Number(formPrWeight),
      reps: Number(formPrReps),
      estimated1RmKg: est1Rm,
      date: localDateStr()
    });

    setIsPrModalOpen(false);
  };

  const handleCreatePhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient) return;

    addProgressPhoto({
      clientId: activeClient.id,
      date: localDateStr(),
      view: formPhotoView,
      photoUrl: formPhotoUrl,
      weightKg: activeClient.currentWeightKg,
      bodyFatPercentage: activeClient.bodyFatPercentage,
      notes: formPhotoNotes
    });

    setIsPhotoModalOpen(false);
  };

  // SVG Chart rendering calculations for Weight Trend
  const sortedMetrics = [...clientMetrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const weights = sortedMetrics.map(m => m.weightKg);
  const minWeight = Math.min(...(weights.length ? weights : [70]), (activeClient?.targetWeightKg || 70)) - 1;
  const maxWeight = Math.max(...(weights.length ? weights : [85]), (activeClient?.startingWeightKg || 85)) + 1;

  const chartWidth = 600;
  const chartHeight = 200;
  const padding = 40;

  const points = sortedMetrics.map((m, idx) => {
    const x = padding + (idx / Math.max(1, sortedMetrics.length - 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((m.weightKg - minWeight) / (maxWeight - minWeight || 1)) * (chartHeight - padding * 2);
    return { x, y, data: m };
  });

  const pathD = points.length > 0 
    ? `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}` 
    : '';

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`
    : '';

  const targetY = chartHeight - padding - (((activeClient?.targetWeightKg || 80) - minWeight) / (maxWeight - minWeight || 1)) * (chartHeight - padding * 2);

  const beforePhoto = clientPhotos.find(p => p.id === beforePhotoId) || clientPhotos[0];
  const afterPhoto = clientPhotos.find(p => p.id === afterPhotoId) || clientPhotos[clientPhotos.length - 1] || clientPhotos[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Athlete Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-400" />
            Client Progress, Habits & Metrics
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Analyze body composition trends, milestone PRs, daily adherence habits, and transformation photos.
          </p>
        </div>

        {/* Athlete selector pill */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
          <span className="text-[10px] uppercase font-bold text-slate-400 pl-2">Athlete:</span>
          <select
            value={activeClient?.id}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="h-8 px-3 rounded-xl bg-slate-950 text-xs font-bold text-emerald-400 focus:outline-hidden"
          >
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Athlete Metric Summary Card */}
      {activeClient && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/30 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
          <div className="flex items-center gap-4">
            <ClientAvatar client={activeClient} className="h-16 w-16 rounded-2xl border-2 border-emerald-500/40 shadow-lg" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white">{activeClient.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {activeClient.goal}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Started on {activeClient.startDate} • {activeClient.workoutsCompleted} sessions logged
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Current Weight</span>
              <div className="text-base font-extrabold text-white mt-0.5">{activeClient.currentWeightKg} kg</div>
              <span className="text-[10px] text-emerald-400 font-bold">Goal: {activeClient.targetWeightKg} kg</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Body Fat %</span>
              <div className="text-base font-extrabold text-cyan-400 mt-0.5">{activeClient.bodyFatPercentage}%</div>
              <span className="text-[10px] text-slate-400">Target: {activeClient.targetBodyFat}%</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Change</span>
              <div className="text-base font-extrabold text-emerald-400 mt-0.5">
                {(activeClient.currentWeightKg - activeClient.startingWeightKg).toFixed(1)} kg
              </div>
              <span className="text-[10px] text-slate-400">Since Day 1</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Habit Adherence</span>
              <div className="text-base font-extrabold text-amber-400 mt-0.5">
                {habitRate === null ? '—' : `${habitRate}%`}
              </div>
              <span className="text-[10px] text-slate-400">{clientHabits.length ? 'Last 7 days' : 'No habits set'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Sub-tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`py-3 px-4 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'metrics' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="h-4 w-4" />
          Body Weight & Composition
        </button>
        <button
          onClick={() => setActiveTab('habits')}
          className={`py-3 px-4 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'habits' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          Daily Habit Tracker
        </button>
        <button
          onClick={() => setActiveTab('prs')}
          className={`py-3 px-4 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'prs' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="h-4 w-4 text-emerald-400" />
          Personal Records (PRs)
        </button>
        <button
          onClick={() => setActiveTab('photos')}
          className={`py-3 px-4 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'photos' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="h-4 w-4" />
          Progress Photo Gallery
        </button>
      </div>

      {/* Subtab 1: Body Weight & Composition Chart */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {/* Main Chart Container */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Scale className="h-4 w-4 text-emerald-400" />
                  Body Weight Progression Trend (kg)
                </h3>
                <p className="text-xs text-slate-400">
                  Target goal line: <strong className="text-emerald-400">{activeClient?.targetWeightKg} kg</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMetricModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/30"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Log Weigh-In</span>
                </button>
              </div>
            </div>

            {/* SVG Interactive Chart */}
            <div className="w-full overflow-x-auto">
              <svg 
                viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                className="w-full h-64 overflow-visible"
              >
                <defs>
                  <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid lines */}
                <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#1e293b" strokeWidth="1" />
                <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />

                {/* Target Weight Goal Line */}
                <line 
                  x1={padding} 
                  y1={targetY} 
                  x2={chartWidth - padding} 
                  y2={targetY} 
                  stroke="#06b6d4" 
                  strokeWidth="1.5" 
                  strokeDasharray="6 4" 
                />
                <text x={chartWidth - padding + 5} y={targetY + 4} fill="#06b6d4" fontSize="9" fontWeight="bold">
                  Goal ({activeClient?.targetWeightKg}kg)
                </text>

                {/* Area fill */}
                {areaD && (
                  <path d={areaD} fill="url(#emeraldGradient)" />
                )}

                {/* Line Path */}
                {pathD && (
                  <path d={pathD} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
                )}

                {/* Data Points */}
                {points.map((pt, i) => (
                  <g key={i} className="group cursor-pointer">
                    <circle 
                      cx={pt.x} 
                      cy={pt.y} 
                      r="5" 
                      fill="#090d16" 
                      stroke="#10b981" 
                      strokeWidth="2.5" 
                      className="group-hover:r-7 transition-all"
                    />
                    <text 
                      x={pt.x} 
                      y={pt.y - 10} 
                      textAnchor="middle" 
                      fill="#e2e8f0" 
                      fontSize="10" 
                      fontWeight="bold"
                    >
                      {pt.data.weightKg}kg
                    </text>
                    <text 
                      x={pt.x} 
                      y={chartHeight - padding + 15} 
                      textAnchor="middle" 
                      fill="#64748b" 
                      fontSize="9"
                    >
                      {pt.data.date.substring(5)}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Metric Entries History Table */}
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Weigh-in & Measurement Log History</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Weight (kg)</th>
                    <th className="py-2.5 px-3">Body Fat %</th>
                    <th className="py-2.5 px-3">Waist (cm)</th>
                    <th className="py-2.5 px-3">Chest (cm)</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {clientMetrics.map(m => (
                    <tr key={m.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold text-white">{m.date}</td>
                      <td className="py-2.5 px-3 font-extrabold text-emerald-400">{m.weightKg} kg</td>
                      <td className="py-2.5 px-3 text-cyan-400">{m.bodyFatPercentage ? `${m.bodyFatPercentage}%` : '--'}</td>
                      <td className="py-2.5 px-3">{m.waistCm || '--'}</td>
                      <td className="py-2.5 px-3">{m.chestCm || '--'}</td>
                      <td className="py-2.5 px-3 text-slate-400">{m.notes || 'Routine check-in'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Habits */}
      {activeTab === 'habits' && activeClient && <HabitsManager clientId={activeClient.id} />}

      {/* Subtab 3: Personal Records (PRs) */}
      {activeTab === 'prs' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-400" />
                  Personal Records (PR) Hall of Fame
                </h3>
                <p className="text-xs text-slate-400">
                  Strength milestones, estimated 1RM calculations, and historical load progression.
                </p>
              </div>

              <button
                onClick={() => setIsPrModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/30 self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                <span>+ Log New PR</span>
              </button>
            </div>

            {/* PR Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientPRs.map((pr) => (
                <div key={pr.id} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white">{pr.exerciseName}</h4>
                    <span className="text-[10px] text-slate-400">{pr.date}</span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-emerald-400">{pr.weightKg} kg</span>
                    <span className="text-xs text-slate-300 font-bold">× {pr.reps} reps</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>Est 1RM: <strong className="text-emerald-400">{pr.estimated1RmKg} kg</strong></span>
                    {pr.previousWeightKg && (
                      <span className="text-emerald-400 font-bold">
                        +{pr.weightKg - pr.previousWeightKg}kg PR
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 4: Progress Photo Gallery */}
      {activeTab === 'photos' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Camera className="h-5 w-5 text-emerald-400" />
                  Side-by-Side Physique Comparison
                </h3>
                <p className="text-xs text-slate-400">
                  Visual transformation tracking with automatic delta weight and body fat calculations.
                </p>
              </div>

              <button
                onClick={() => setIsPhotoModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold shadow-md self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                <span>+ Upload Check-in Photo</span>
              </button>
            </div>

            {/* Side-by-side photo comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Before Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Baseline Photo (Before)</span>
                    <h4 className="text-xs font-bold text-white">{beforePhoto?.date || 'Day 1 Baseline'}</h4>
                  </div>
                  <span className="text-xs font-bold text-slate-300">
                    {beforePhoto?.weightKg} kg • {beforePhoto?.bodyFatPercentage}% BF
                  </span>
                </div>

                <div className="relative h-80 rounded-xl overflow-hidden bg-slate-900">
                  <img
                    src={beforePhoto?.photoUrl}
                    alt="Before Check-in"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[10px] font-bold text-white">
                    {beforePhoto?.view || 'Front'} View
                  </div>
                </div>
              </div>

              {/* After Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400">Latest Progress (After)</span>
                    <h4 className="text-xs font-bold text-white">{afterPhoto?.date || 'Week 16 Check-in'}</h4>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">
                    {afterPhoto?.weightKg} kg • {afterPhoto?.bodyFatPercentage}% BF
                  </span>
                </div>

                <div className="relative h-80 rounded-xl overflow-hidden bg-slate-900">
                  <img
                    src={afterPhoto?.photoUrl}
                    alt="After Check-in"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-bold text-emerald-300">
                    {afterPhoto?.view || 'Front'} View
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Metric Modal */}
      {isMetricModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Scale className="h-5 w-5 text-emerald-400" />
                Log Athlete Body Metric
              </h3>
              <button onClick={() => setIsMetricModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMetric} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formWeight}
                    onChange={(e) => setFormWeight(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Body Fat %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formBodyFat}
                    onChange={(e) => setFormBodyFat(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[9px] mb-1">Waist (cm)</label>
                  <input
                    type="number"
                    value={formWaist}
                    onChange={(e) => setFormWaist(Number(e.target.value))}
                    className="w-full h-9 px-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[9px] mb-1">Chest (cm)</label>
                  <input
                    type="number"
                    value={formChest}
                    onChange={(e) => setFormChest(Number(e.target.value))}
                    className="w-full h-9 px-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[9px] mb-1">Arms (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formArms}
                    onChange={(e) => setFormArms(Number(e.target.value))}
                    className="w-full h-9 px-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Coach Assessment Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Visual serratus definition, lower waist measurement..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMetricModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold shadow-md"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log PR Modal */}
      {isPrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-emerald-400" />
                Log Personal Record
              </h3>
              <button onClick={() => setIsPrModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePR} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Exercise</label>
                <input
                  type="text"
                  required
                  value={formPrExercise}
                  onChange={(e) => setFormPrExercise(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formPrWeight}
                    onChange={(e) => setFormPrWeight(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Reps</label>
                  <input
                    type="number"
                    value={formPrReps}
                    onChange={(e) => setFormPrReps(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold shadow-md"
                >
                  Log PR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Photo Modal */}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Camera className="h-5 w-5 text-emerald-400" />
                Upload Progress Photo
              </h3>
              <button onClick={() => setIsPhotoModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePhoto} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Pose / Angle View</label>
                <select
                  value={formPhotoView}
                  onChange={(e) => setFormPhotoView(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="Front">Front Relaxed / Flexed</option>
                  <option value="Side">Side Profile</option>
                  <option value="Back">Back Lat Spread</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Photo Image URL</label>
                <input
                  type="text"
                  value={formPhotoUrl}
                  onChange={(e) => setFormPhotoUrl(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Check-in Notes</label>
                <textarea
                  rows={2}
                  value={formPhotoNotes}
                  onChange={(e) => setFormPhotoNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPhotoModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold shadow-md"
                >
                  Save Photo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
