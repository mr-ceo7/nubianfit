import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  Plus, 
  Dumbbell, 
  UserPlus, 
  CheckCircle2, 
  X,
  Download,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';

import { localDateStr, timeAgo } from '../../utils/dates';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ClientAvatar } from '../common/ClientAvatar';
import { NubianFitLogo } from '../common/NubianFitLogo';


interface HeaderProps {
  onOpenNewClient: () => void;
  onOpenNewProgram: () => void;
  onOpenExerciseModal: () => void;
  onOpenInstallModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onOpenNewClient, 
  onOpenNewProgram, 
  onOpenExerciseModal,
  onOpenInstallModal
}) => {
  const { 
    activeTab, 
    setActiveTab, 
    clients, 
    exercises, 
    programs, 
    activityFeed, 
    toastMessage, 
    setSelectedClientId,
    scheduledWorkouts,
    openWorkoutLogger,
    theme,
    toggleTheme
  } = useApp();
  const { user, logout } = useAuth();


  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);


  // Filter search items
  const filteredClients = searchQuery.trim() 
    ? clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.goal.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const filteredExercises = searchQuery.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.primaryMuscle.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const filteredPrograms = searchQuery.trim()
    ? programs.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.goal.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const unreadActivity = activityFeed.slice(0, 5);

  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Coach Overview';
      case 'clients': return 'Athletes & Roster';
      case 'programs': return 'Program Builder';
      case 'workouts': return 'Workout Library';
      case 'exercises': return 'Exercise Database';
      case 'calendar': return 'Workout Schedule';
      case 'nutrition': return 'Nutrition & Habits';
      case 'progress': return 'Metric Tracking';
      case 'messenger': return 'Coach Messenger';
      default: return 'NubianFit';
    }
  };

  const handleStartTodayWorkout = () => {
    const todayStr = localDateStr();
    const todayWorkout = scheduledWorkouts.find(w => w.date === todayStr && w.status === 'Scheduled') || scheduledWorkouts[0];
    if (todayWorkout) {
      openWorkoutLogger(todayWorkout);
    }
  };

  return (
    <header className="relative z-20 flex h-14 items-center justify-between border border-slate-800/80 bg-slate-950/90 px-3.5 md:px-5 backdrop-blur-md rounded-xl mt-1.5 mx-1.5 shadow-lg shadow-slate-950/20">



      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Left: Mobile Brand Logo */}
      <div className="flex items-center">
        <button
          onClick={() => setActiveTab('dashboard')}
          className="md:hidden shrink-0 active:scale-95 transition-transform text-left flex flex-col items-stretch"
          title="Go to Dashboard"
        >
          <span className="font-logo text-[15px] tracking-wide text-logo-nubian lowercase block leading-none">
            nubian<span className="text-logo-fit">fit</span>
          </span>
          <div className="flex justify-between text-[7px] text-slate-400 font-bold tracking-normal lowercase mt-1.5 w-full leading-none">
            <span>strength</span>
            <span>and</span>
            <span>strategy</span>
          </div>
        </button>
      </div>

      {/* Center on mobile, Left on desktop: View Title */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none md:pointer-events-auto md:static md:translate-x-0 md:translate-y-0 text-center md:text-left flex flex-col">
        <h1 className="text-sm md:text-base font-bold text-white tracking-tight flex items-center justify-center md:justify-start gap-1.5 truncate max-w-[130px] sm:max-w-none">
          {getBreadcrumbTitle()}
        </h1>
        <span className="text-[10px] sm:text-[11px] text-slate-400 hidden sm:inline-block">
          NubianFit Coaching Suite
        </span>
      </div>


      {/* Center / Right: Global Search & Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Global Search Bar */}
        <div className="relative hidden xs:block">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 pointer-events-none" />
            <input
              id="global-search-input"
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(e.target.value.length > 0);
              }}
              onFocus={() => searchQuery.length > 0 && setIsSearchOpen(true)}
              className="h-9 w-32 sm:w-48 md:w-72 rounded-xl bg-slate-900/90 pl-8 sm:pl-9 pr-7 text-xs text-slate-100 placeholder-slate-400 border border-slate-700/80 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
                className="absolute right-2 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Search Dropdown Results */}
          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute top-11 right-0 w-80 md:w-96 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-3 z-50 text-xs max-h-96 overflow-y-auto space-y-3">
              {/* Clients Results */}
              {filteredClients.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                    Athletes & Clients ({filteredClients.length})
                  </div>
                  <div className="space-y-1">
                    {filteredClients.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedClientId(c.id);
                          setActiveTab('clients');
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-800 cursor-pointer text-slate-200"
                      >
                        <ClientAvatar client={c} className="h-6 w-6 rounded-full" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white truncate">{c.name}</div>
                          <div className="text-[10px] text-slate-400">{c.goal} • {c.status}</div>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-bold">{c.complianceRate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exercises Results */}
              {filteredExercises.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                    Exercises ({filteredExercises.length})
                  </div>
                  <div className="space-y-1">
                    {filteredExercises.map(e => (
                      <div
                        key={e.id}
                        onClick={() => {
                          setActiveTab('exercises');
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800 cursor-pointer text-slate-200"
                      >
                        <div>
                          <div className="font-medium text-white truncate">{e.name}</div>
                          <div className="text-[10px] text-slate-400">{e.primaryMuscle} • {e.equipment}</div>
                        </div>
                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-emerald-400">{e.difficulty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Programs Results */}
              {filteredPrograms.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
                    Programs ({filteredPrograms.length})
                  </div>
                  <div className="space-y-1">
                    {filteredPrograms.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setActiveTab('programs');
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="p-2 rounded-lg hover:bg-slate-800 cursor-pointer text-slate-200"
                      >
                        <div className="font-medium text-white">{p.title}</div>
                        <div className="text-[10px] text-slate-400">{p.durationWeeks} Weeks • {p.daysPerWeek} Days/wk • {p.goal}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredClients.length === 0 && filteredExercises.length === 0 && filteredPrograms.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-xs">
                  No matching clients, exercises, or programs found for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* PWA Install Button (Desktop Only) */}
        {onOpenInstallModal && (
          <button
            id="header-install-pwa-btn"
            onClick={onOpenInstallModal}
            className="hidden md:flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-colors"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Install App</span>
          </button>
        )}


        {/* Theme Toggle Button (Desktop Only) */}
        <button
          id="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <Moon className="h-4.5 w-4.5 text-slate-400" /> : <Sun className="h-4.5 w-4.5 text-amber-500" />}
        </button>

        {/* Notifications Popover (Visible on Mobile & Desktop) */}
        <div className="relative">
          <button
            id="notifications-btn"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-slate-950" />
          </button>

          {isNotificationsOpen && (
            <div className="absolute top-11 right-0 w-80 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-3 z-50 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-2">
                <span className="text-xs font-bold text-white">Live Coaching Feed</span>
                <span className="text-[10px] text-emerald-400 font-semibold">{unreadActivity.length} Recent</span>
              </div>
              <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto">
                {unreadActivity.map((act) => (
                  <div 
                    key={act.id} 
                    className="py-2.5 px-2 flex items-start gap-2.5 hover:bg-slate-800/60 rounded-lg cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedClientId(act.clientId);
                      if (act.type === 'new_message') setActiveTab('messenger');
                      else if (act.type === 'workout_completed') setActiveTab('calendar');
                      else setActiveTab('clients');
                      setIsNotificationsOpen(false);
                    }}
                  >
                    <ClientAvatar client={{ name: act.clientName, avatar: act.clientAvatar }} className="h-7 w-7 rounded-full shrink-0 mt-0.5 border border-slate-700" />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-xs font-semibold text-slate-100 truncate">{act.title}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{act.description}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{act.createdAt ? timeAgo(act.createdAt) : act.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Workout Logger Button (Desktop Only) */}
        <button
          id="quick-log-workout-btn"
          onClick={handleStartTodayWorkout}
          className="hidden lg:flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-800 text-slate-100 border border-slate-700 text-xs font-semibold hover:bg-slate-700 hover:text-white transition-colors"
        >
          <Dumbbell className="h-3.5 w-3.5 text-emerald-400" />
          <span>Log Workout</span>
        </button>

        {/* Action Button Dropdown (Desktop Only) */}
        <div className="relative hidden md:block">
          <button
            id="quick-action-menu-btn"
            onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span className="hidden sm:inline">Create</span>
          </button>

          {isQuickActionsOpen && (
            <div className="absolute top-11 right-0 w-52 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 space-y-1">
              <button
                onClick={() => {
                  setIsQuickActionsOpen(false);
                  onOpenNewClient();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white rounded-xl text-left transition-colors"
              >
                <UserPlus className="h-4 w-4 text-emerald-400" />
                <span>Onboard New Client</span>
              </button>

              <button
                onClick={() => {
                  setIsQuickActionsOpen(false);
                  onOpenNewProgram();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white rounded-xl text-left transition-colors"
              >
                <Dumbbell className="h-4 w-4 text-cyan-400" />
                <span>Build New Program</span>
              </button>

              <button
                onClick={() => {
                  setIsQuickActionsOpen(false);
                  onOpenExerciseModal();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white rounded-xl text-left transition-colors"
              >
                <Plus className="h-4 w-4 text-amber-400" />
                <span>Add Custom Exercise</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Profile Settings Menu Trigger */}
        <div className="relative md:hidden">
          <button
            id="mobile-profile-menu-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Account menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 overflow-hidden active:scale-95 transition-transform"
          >
            <ClientAvatar client={{ name: user?.fullName ?? 'Coach', avatar: user?.avatar }} className="h-full w-full" />
          </button>

          {isMobileMenuOpen && (
            <div className="absolute top-11 right-0 w-56 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 space-y-1">
              <div className="px-3 py-2 border-b border-slate-800/80 mb-1.5 text-left">
                <div className="text-xs font-bold text-white truncate">{user?.fullName}</div>
                <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
              </div>
              
              {/* Theme Toggle (Mobile) */}
              <button
                onClick={() => {
                  toggleTheme();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <span className="font-semibold">App Theme</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 capitalize">
                  {theme} mode
                </span>
              </button>

              {/* Install PWA (Mobile) */}
              {onOpenInstallModal && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenInstallModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs text-slate-200 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <Download className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="font-semibold">Install App</span>
                </button>
              )}

              <button
                onClick={logout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs text-red-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="font-semibold">Sign out</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
