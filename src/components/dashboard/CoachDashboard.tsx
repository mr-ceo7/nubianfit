import React from 'react';
import { 
  Users, 
  Dumbbell, 
  CheckCircle2, 
  TrendingUp, 
  Calendar, 
  AlertCircle, 
  Trophy, 
  MessageSquare, 
  Flame, 
  Play, 
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { ClientAvatar } from '../common/ClientAvatar';
import { localDateStr, timeAgo } from '../../utils/dates';
import { useApp } from '../../context/AppContext';

export const CoachDashboard: React.FC<{
  onOpenNewClient: () => void;
  onOpenNewProgram: () => void;
}> = ({ onOpenNewClient, onOpenNewProgram }) => {
  const { 
    clients, 
    scheduledWorkouts, 
    activityFeed, 
    setActiveTab, 
    setSelectedClientId,
    openWorkoutLogger
  } = useApp();

  const todayStr = localDateStr();
  const [activeMobileSection, setActiveMobileSection] = React.useState<'schedule' | 'activity' | 'watchlist'>('schedule');


  // Calculated metrics
  const activeClientsCount = clients.filter(c => c.status === 'Active').length;
  const todayWorkouts = scheduledWorkouts.filter(w => w.date === todayStr);
  const completedTodayCount = todayWorkouts.filter(w => w.status === 'Completed').length;
  const pendingCheckinClients = clients.filter(c => c.status === 'Needs Check-in');
  const pendingCheckinsCount = pendingCheckinClients.length;
  const onboardingCount = clients.filter(c => c.status === 'Onboarding').length;
  
  const avgCompliance = Math.round(
    clients.reduce((acc, c) => acc + c.complianceRate, 0) / (clients.length || 1)
  );

  const totalCompletedWorkoutsAllTime = clients.reduce((acc, c) => acc + c.workoutsCompleted, 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-slate-400 font-medium">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Athlete Performance Overview
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              You have <strong className="text-emerald-400 font-semibold">{todayWorkouts.length} sessions</strong> scheduled today with {completedTodayCount} logged. {pendingCheckinsCount > 0 ? `${pendingCheckinsCount} ${pendingCheckinsCount === 1 ? 'client needs' : 'clients need'} a check-in review.` : 'All client check-ins are up to date.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              id="dashboard-onboard-client-btn"
              onClick={onOpenNewClient}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Users className="h-4 w-4 text-emerald-400" />
              <span>Add Athlete</span>
            </button>

            <button
              id="dashboard-build-program-btn"
              onClick={onOpenNewProgram}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-sm"
            >
              <Dumbbell className="h-4 w-4" />
              <span>Create Program</span>
            </button>
          </div>
        </div>
      </div>
      {/* 4 Primary Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Active Athletes */}
        <div 
          onClick={() => setActiveTab('clients')}
          className="p-3.5 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Active Roster</span>
            <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3 flex items-baseline gap-1 sm:gap-2">
            <span className="text-xl sm:text-3xl font-extrabold text-white">{activeClientsCount}</span>
            <span className="text-[10px] sm:text-xs text-slate-400">/ {clients.length}</span>
          </div>
          <div className="mt-1 sm:mt-2 flex items-center text-[10px] sm:text-xs text-emerald-400 font-medium">
            <span className="truncate">{onboardingCount} onboarding • {pendingCheckinsCount} to review</span>
          </div>
        </div>

        {/* Card 2: Workouts Completed Today */}
        <div 
          onClick={() => setActiveTab('calendar')}
          className="p-3.5 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Today's Workouts</span>
            <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
              <Dumbbell className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3 flex items-baseline gap-1 sm:gap-2">
            <span className="text-xl sm:text-3xl font-extrabold text-white">{completedTodayCount}</span>
            <span className="text-[10px] sm:text-xs text-slate-400">/ {todayWorkouts.length}</span>
          </div>
          <div className="mt-1 sm:mt-2 flex items-center text-[10px] sm:text-xs text-cyan-400 font-medium">
            <span className="truncate">{todayWorkouts.length - completedTodayCount} scheduled</span>
          </div>
        </div>

        {/* Card 3: Pending Check-ins */}
        <div 
          onClick={() => setActiveTab('clients')}
          className="p-3.5 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Weekly Check-Ins</span>
            <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3 flex items-baseline gap-1 sm:gap-2">
            <span className="text-xl sm:text-3xl font-extrabold text-white">{pendingCheckinsCount}</span>
            <span className="text-[10px] sm:text-xs text-amber-400 font-medium">to review</span>
          </div>
          <div className="mt-1 sm:mt-2 flex items-center text-[10px] sm:text-xs text-slate-400 font-medium truncate">
            <span className="truncate">{pendingCheckinClients[0]?.name ?? 'None waiting'}{pendingCheckinClients.length > 1 ? ` +${pendingCheckinClients.length - 1}` : ''}</span>
          </div>
        </div>

        {/* Card 4: Weekly Compliance Rate */}
        <div 
          onClick={() => setActiveTab('progress')}
          className="p-3.5 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Avg Compliance</span>
            <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3 flex items-baseline gap-1 sm:gap-2">
            <span className="text-xl sm:text-3xl font-extrabold text-emerald-400">{avgCompliance}%</span>
            <span className="text-[10px] sm:text-xs text-slate-400">rate</span>
          </div>
          <div className="mt-1 sm:mt-2 flex items-center text-[10px] sm:text-xs text-slate-400 font-medium truncate">
            <span className="truncate">{totalCompletedWorkoutsAllTime} done</span>
          </div>
        </div>
      </div>

      {/* Mobile Segmented Control */}
      <div className="lg:hidden flex p-1 bg-slate-900 border border-slate-800 rounded-xl mb-4">
        <button
          onClick={() => setActiveMobileSection('schedule')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeMobileSection === 'schedule'
              ? 'bg-emerald-500 text-slate-950 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Today's Schedule
        </button>
        <button
          onClick={() => setActiveMobileSection('activity')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeMobileSection === 'activity'
              ? 'bg-emerald-500 text-slate-950 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Activity Feed
        </button>
        <button
          onClick={() => setActiveMobileSection('watchlist')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeMobileSection === 'watchlist'
              ? 'bg-emerald-500 text-slate-950 shadow-xs'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Watchlist
        </button>
      </div>

      {/* Main Grid: Today's Workouts + Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2 Cols: Today's Scheduled Workouts */}
        <div className={`lg:col-span-2 space-y-4 ${activeMobileSection === 'schedule' ? 'block' : 'hidden lg:block'}`}>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white tracking-tight">Today's Training Schedule</h3>
            </div>
            <button
              onClick={() => setActiveTab('calendar')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              Full Calendar <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {todayWorkouts.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
                No workouts scheduled for today. Click "Schedule Workout" to assign a session.
              </div>
            ) : (
              todayWorkouts.map((workout) => {
                const isDone = workout.status === 'Completed';

                return (
                  <div
                    key={workout.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isDone 
                        ? 'bg-slate-900/60 border-emerald-500/30' 
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Client info & workout title */}
                      <div className="flex items-center gap-3">
                        <ClientAvatar client={{ name: workout.clientName, avatar: workout.clientAvatar }} className="h-11 w-11 rounded-xl border border-slate-700" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span 
                              onClick={() => {
                                setSelectedClientId(workout.clientId);
                                setActiveTab('clients');
                              }}
                              className="text-sm font-bold text-white hover:text-emerald-400 cursor-pointer"
                            >
                              {workout.clientName}
                            </span>
                            <span className="text-[10px] text-slate-100 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                              {workout.time || 'All Day'}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-slate-300 mt-0.5">
                            {workout.workoutTitle}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {workout.programName || 'Custom Coaching Split'}
                          </div>
                        </div>
                      </div>

                      {/* Status & Action */}
                      <div className="flex items-center gap-2.5 sm:self-center">
                        {isDone ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Completed ({workout.durationMin}m)
                            </span>
                            <button
                              onClick={() => openWorkoutLogger(workout)}
                              className="px-2.5 py-1 text-xs text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 font-medium"
                            >
                              Review Log
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold">
                              Scheduled
                            </span>
                            <button
                              id={`log-workout-${workout.id}`}
                              onClick={() => openWorkoutLogger(workout)}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-xs"
                            >
                              <Play className="h-3 w-3 fill-slate-950" />
                              <span>Log Session</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Feedback preview if completed */}
                    {isDone && workout.clientFeedback && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-start gap-2 text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-xl">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-200">Athlete Note:</strong> "{workout.clientFeedback}"
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Roster At-A-Glance Bar */}
        </div>

        {/* Right 1 Col: Live Activity Feed & Milestone Alerts */}
        <div className={`space-y-6 ${activeMobileSection !== 'schedule' ? 'block' : 'hidden lg:block'}`}>
          
          {/* Milestones & Activity Feed */}
          <div className={`space-y-4 ${activeMobileSection === 'activity' ? 'block' : 'hidden lg:block'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-white tracking-tight">Milestones & Activity</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-semibold">Live stream</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 divide-y divide-slate-800/80">
              {activityFeed.slice(0, 6).map((item) => (
                <div 
                  key={item.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-start gap-3 hover:bg-slate-800/30 p-2 rounded-xl transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedClientId(item.clientId);
                    if (item.type === 'new_message') setActiveTab('messenger');
                    else if (item.type === 'pr_achieved') setActiveTab('progress');
                    else setActiveTab('clients');
                  }}
                >
                  <div className="relative shrink-0">
                    <ClientAvatar client={{ name: item.clientName, avatar: item.clientAvatar }} className="h-8 w-8 rounded-full border border-slate-700" />
                    {item.type === 'pr_achieved' && (
                      <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center text-[9px] text-slate-950 font-black">
                        ★
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-white truncate">{item.clientName}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{item.createdAt ? timeAgo(item.createdAt) : item.timestamp}</span>
                    </div>
                    <div className="text-xs font-medium text-emerald-400 truncate mt-0.5">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1">
                      {item.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Injury & Health Watchlist Widget */}
          <div className={`p-4 rounded-2xl bg-slate-900/90 border border-slate-800 ${activeMobileSection === 'watchlist' ? 'block' : 'hidden lg:block'}`}>
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Athlete Health Watchlist</h4>
            </div>
            
            <div className="space-y-2">
              {clients.filter(c => c.injuriesAndHealth.length > 0).slice(0, 2).map(c => (
                <div 
                  key={c.id}
                  onClick={() => {
                    setSelectedClientId(c.id);
                    setActiveTab('clients');
                  }}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-amber-500/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{c.name}</span>
                    <span className="text-[10px] text-amber-400 font-semibold">{c.injuriesAndHealth.length} condition</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                    {c.medicalAlerts || c.injuriesAndHealth[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
