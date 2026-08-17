import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Dumbbell, 
  CheckCircle2, 
  Clock, 
  Filter, 
  X,
  Play
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ScheduledWorkout } from '../../types';

export const CalendarScheduler: React.FC = () => {
  const { 
    scheduledWorkouts, 
    clients, 
    programs, 
    scheduleWorkout, 
    openWorkoutLogger,
    setSelectedClientId,
    setActiveTab
  } = useApp();

  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('All');
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 16)); // August 2026
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'list' | 'grid'>('list');
  const [selectedDate, setSelectedDate] = useState('2026-08-16');
  
  // Schedule Modal form state
  const [schedClientId, setSchedClientId] = useState(clients[0]?.id || '');
  const [schedProgramId, setSchedProgramId] = useState(programs[0]?.id || '');
  const [schedWorkoutTitle, setSchedWorkoutTitle] = useState('Day 1: Upper Body Power');
  const [schedDate, setSchedDate] = useState('2026-08-16');
  const [schedTime, setSchedTime] = useState('09:00 AM');

  // Days in month calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleOpenScheduleForDate = (dayNum: number) => {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    setSchedDate(dayStr);
    setIsScheduleModalOpen(true);
  };

  const handleCreateScheduledWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    const targetClient = clients.find(c => c.id === schedClientId);
    const targetProgram = programs.find(p => p.id === schedProgramId);
    if (!targetClient) return;

    const matchedDay = targetProgram?.days.find(d => d.name === schedWorkoutTitle) || targetProgram?.days[0];

    scheduleWorkout({
      clientId: targetClient.id,
      clientName: targetClient.name,
      clientAvatar: targetClient.avatar,
      programId: targetProgram?.id,
      programName: targetProgram?.title,
      workoutDayId: matchedDay?.id || 'day-custom',
      workoutTitle: schedWorkoutTitle,
      date: schedDate,
      time: schedTime,
      status: 'Scheduled',
      exercises: matchedDay?.exercises || []
    });

    setIsScheduleModalOpen(false);
  };

  // Filter workouts
  const filteredWorkouts = scheduledWorkouts.filter(w => {
    return selectedClientFilter === 'All' || w.clientId === selectedClientFilter;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-emerald-400" />
            Athlete Workout Scheduler & Calendar
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Assign workout splits, manage athlete daily schedules, and track session completion.
          </p>
        </div>

        <button
          id="schedule-new-workout-btn"
          onClick={() => setIsScheduleModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
          <span>+ Schedule Workout</span>
        </button>
      </div>

      {/* Calendar Controls & Filter Strip */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Month Navigator & Mobile Switcher */}
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-extrabold text-white min-w-40">
              {monthNames[month]} {year}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mobile View Mode Switcher (Mobile Only) */}
          <div className="flex md:hidden bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setMobileViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-colors ${
                mobileViewMode === 'list' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setMobileViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-colors ${
                mobileViewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Month
            </button>
          </div>
        </div>

        {/* Filter by Client */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-slate-400 font-bold uppercase text-[10px]">Filter Athlete:</span>
          <select
            value={selectedClientFilter}
            onChange={(e) => setSelectedClientFilter(e.target.value)}
            className="h-8 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
          >
            <option value="All">All Athletes ({clients.length})</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Monthly Calendar Grid (Desktop Only) */}
      <div className="hidden md:block rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
        {/* Day of week headers */}
        <div className="grid grid-cols-7 bg-slate-950/80 border-b border-slate-800 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-400 py-3">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-800/60 bg-slate-900/40">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-28 p-2 bg-slate-950/30 opacity-40" />
          ))}

          {/* Days of month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayWorkouts = filteredWorkouts.filter(w => w.date === dayDateStr);
            const isToday = dayDateStr === '2026-08-16';

            return (
              <div
                key={`day-${dayNum}`}
                className={`min-h-32 p-2 transition-colors relative flex flex-col justify-between group ${
                  isToday ? 'bg-emerald-950/20 ring-1 ring-emerald-500/40' : 'hover:bg-slate-800/30'
                }`}
              >
                {/* Date header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-extrabold h-6 w-6 rounded-full flex items-center justify-center ${
                    isToday ? 'bg-emerald-500 text-slate-950 shadow-xs' : 'text-slate-300'
                  }`}>
                    {dayNum}
                  </span>

                  <button
                    onClick={() => handleOpenScheduleForDate(dayNum)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-opacity"
                    title={`Schedule workout for ${dayDateStr}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Scheduled workouts in this cell */}
                <div className="space-y-1.5 flex-1 overflow-y-auto max-h-28">
                  {dayWorkouts.map((w) => {
                    const isDone = w.status === 'Completed';

                    return (
                      <div
                        key={w.id}
                        onClick={() => openWorkoutLogger(w)}
                        className={`p-1.5 rounded-lg border text-[11px] cursor-pointer transition-all ${
                          isDone
                            ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300 hover:border-emerald-400'
                            : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-cyan-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <img src={w.clientAvatar} alt={w.clientName} className="h-4 w-4 rounded-full object-cover shrink-0" />
                          <span className="font-bold truncate text-[10px]">{w.clientName}</span>
                          {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 ml-auto" />}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {w.workoutTitle}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Calendar Grid (Mobile Only - Compact & Scroll-Free) */}
      <div className={`md:hidden ${mobileViewMode === 'grid' ? 'block' : 'hidden'} rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl`}>
        {/* Day of week headers */}
        <div className="grid grid-cols-7 bg-slate-950/80 border-b border-slate-800 text-center text-[9px] font-extrabold uppercase tracking-wider text-slate-400 py-2">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-800/60 bg-slate-900/40">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-mobile-${i}`} className="min-h-12 bg-slate-950/30 opacity-40" />
          ))}

          {/* Days of month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayWorkouts = filteredWorkouts.filter(w => w.date === dayDateStr);
            const isSelected = dayDateStr === selectedDate;
            const isToday = dayDateStr === '2026-08-16';

            // Dots counts
            const completedCount = dayWorkouts.filter(w => w.status === 'Completed').length;
            const scheduledCount = dayWorkouts.filter(w => w.status === 'Scheduled').length;

            return (
              <button
                key={`day-mobile-${dayNum}`}
                onClick={() => setSelectedDate(dayDateStr)}
                className={`min-h-12 p-1 flex flex-col items-center justify-between transition-colors focus:outline-hidden ${
                  isSelected 
                    ? 'bg-emerald-950/40 ring-1 ring-emerald-500/60' 
                    : isToday 
                      ? 'bg-slate-800/40' 
                      : 'hover:bg-slate-800/20'
                }`}
              >
                <span className={`text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center ${
                  isSelected 
                    ? 'bg-emerald-500 text-slate-950 font-extrabold' 
                    : isToday
                      ? 'border border-emerald-500/50 text-emerald-400 font-extrabold'
                      : 'text-slate-300'
                }`}>
                  {dayNum}
                </span>

                {/* Workout Dots */}
                <div className="flex items-center justify-center gap-0.5 mt-0.5 h-1.5">
                  {Array.from({ length: completedCount }).map((_, idx) => (
                    <span key={`comp-dot-${idx}`} className="h-1 w-1 rounded-full bg-emerald-400 shrink-0" />
                  ))}
                  {Array.from({ length: scheduledCount }).map((_, idx) => (
                    <span key={`sched-dot-${idx}`} className="h-1 w-1 rounded-full bg-cyan-400 shrink-0" />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Workouts List for Mobile Month View */}
      <div className={`md:hidden ${mobileViewMode === 'grid' ? 'block' : 'hidden'} space-y-3 mt-4`}>
        <div className="flex items-center justify-between px-2">
          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Schedule for {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
          </h4>
          <button
            onClick={() => {
              setSchedDate(selectedDate);
              setIsScheduleModalOpen(true);
            }}
            className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 hover:underline"
          >
            <Plus className="h-3 w-3" /> Add Split
          </button>
        </div>

        {(() => {
          const dayWorkouts = filteredWorkouts.filter(w => w.date === selectedDate);
          if (dayWorkouts.length === 0) {
            return (
              <div className="p-6 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
                No workouts scheduled for this day.
              </div>
            );
          }
          return (
            <div className="space-y-2">
              {dayWorkouts.map(w => {
                const isDone = w.status === 'Completed';
                return (
                  <div
                    key={w.id}
                    onClick={() => openWorkoutLogger(w)}
                    className="p-3.5 rounded-2xl border flex items-center justify-between gap-3 bg-slate-900 border-slate-800/80 hover:border-slate-700 transition-colors active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={w.clientAvatar}
                        alt={w.clientName}
                        className="h-8 w-8 rounded-full object-cover shrink-0 border border-slate-800"
                      />
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs truncate">{w.clientName}</span>
                          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 shrink-0">
                            {w.time || '09:00 AM'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {w.workoutTitle}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-950 text-cyan-400 border border-slate-800">
                          Scheduled
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Mobile-Only List View Feed */}
      <div className={`md:hidden ${mobileViewMode === 'list' ? 'block' : 'hidden'} space-y-4`}>
        {(() => {
          // Get all workouts for the current month
          const monthWorkouts = filteredWorkouts.filter(w => {
            const wDate = new Date(w.date);
            return wDate.getFullYear() === year && wDate.getMonth() === month;
          });

          // Sort workouts chronologically
          monthWorkouts.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

          // Group by date string
          const groupedByDate: Record<string, ScheduledWorkout[]> = {};
          monthWorkouts.forEach(w => {
            if (!groupedByDate[w.date]) {
              groupedByDate[w.date] = [];
            }
            groupedByDate[w.date].push(w);
          });

          const sortedDates = Object.keys(groupedByDate).sort();

          if (sortedDates.length === 0) {
            return (
              <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 text-slate-500" />
                <p className="font-bold text-xs">No sessions scheduled for this month.</p>
                <button
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="mt-3 text-xs text-emerald-400 font-bold hover:underline"
                >
                  Schedule a workout
                </button>
              </div>
            );
          }

          return sortedDates.map(dateStr => {
            const dateObj = new Date(dateStr);
            const formattedDate = dateObj.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric'
            });
            const workoutsForDate = groupedByDate[dateStr];

            return (
              <div key={dateStr} className="space-y-2">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 pl-2">
                  {formattedDate}
                </h4>
                <div className="space-y-2">
                  {workoutsForDate.map(w => {
                    const isDone = w.status === 'Completed';

                    return (
                      <div
                        key={w.id}
                        onClick={() => openWorkoutLogger(w)}
                        className="p-3.5 rounded-2xl border flex items-center justify-between gap-3 bg-slate-900 border-slate-800/80 hover:border-slate-700 transition-colors active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={w.clientAvatar}
                            alt={w.clientName}
                            className="h-10 w-10 rounded-full object-cover shrink-0 border border-slate-800"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs truncate">{w.clientName}</span>
                              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 uppercase tracking-widest shrink-0">
                                {w.time || '09:00 AM'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {w.workoutTitle}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                              Done
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-950 text-cyan-400 border border-slate-800">
                              Scheduled
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Schedule Workout Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-emerald-400" />
                Schedule Athlete Session
              </h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateScheduledWorkout} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Athlete</label>
                <select
                  value={schedClientId}
                  onChange={(e) => setSchedClientId(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.goal})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Training Program</label>
                <select
                  value={schedProgramId}
                  onChange={(e) => {
                    setSchedProgramId(e.target.value);
                    const p = programs.find(pr => pr.id === e.target.value);
                    if (p && p.days.length > 0) {
                      setSchedWorkoutTitle(p.days[0].name);
                    }
                  }}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                >
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Workout Template / Day</label>
                <select
                  value={schedWorkoutTitle}
                  onChange={(e) => setSchedWorkoutTitle(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                >
                  {programs.find(p => p.id === schedProgramId)?.days.map(d => (
                    <option key={d.id} value={d.name}>{d.name} ({d.focus})</option>
                  )) || (
                    <option value="Custom Training Session">Custom Training Session</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Date</label>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Time</label>
                  <input
                    type="text"
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold shadow-md"
                >
                  Schedule Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
