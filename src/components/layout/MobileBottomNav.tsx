import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Plus, 
  CalendarDays, 
  MessageSquare, 
  Dumbbell, 
  TrendingUp, 
  BookOpen, 
  X, 
  Download,
  UserPlus,
  Play
} from 'lucide-react';
import { useApp, NavigationTab } from '../../context/AppContext';

interface MobileBottomNavProps {
  onOpenNewClient: () => void;
  onOpenInstallModal: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenNewClient,
  onOpenInstallModal,
}) => {
  const { 
    activeTab, 
    setActiveTab, 
    messages, 
    scheduledWorkouts, 
    programs,
    openWorkoutLogger,
    toastMessage
  } = useApp();

  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  // Unread message count
  const unreadMessagesCount = messages.filter(m => m.sender === 'client' && !m.isRead).length;

  // Today's scheduled workouts count
  const todayStr = new Date().toISOString().split('T')[0];
  const todayPendingCount = scheduledWorkouts.filter(w => w.date === todayStr && w.status === 'Scheduled').length;

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // Ignore fallback
      }
    }
  };

  const handleTabClick = (tab: NavigationTab) => {
    triggerHaptic();
    setActiveTab(tab);
  };

  const handleOpenActionSheet = () => {
    triggerHaptic();
    setIsActionSheetOpen(true);
  };

  const handleQuickLogFirstWorkout = () => {
    setIsActionSheetOpen(false);
    triggerHaptic();
    if (scheduledWorkouts.length > 0) {
      openWorkoutLogger(scheduledWorkouts[0]);
    } else if (programs.length > 0 && programs[0].weeks[0]?.days[0]?.workout) {
      openWorkoutLogger({
        id: 'quick-' + Date.now(),
        clientId: 'c1',
        programId: programs[0].id,
        workout: programs[0].weeks[0].days[0].workout,
        date: todayStr,
        status: 'Scheduled'
      });
    } else {
      toastMessage('Please create a workout or schedule first in Program Builder');
      setActiveTab('programs');
    }
  };

  return (
    <>
      {/* Mobile Bottom Navigation Bar (Hidden on desktop md+) */}
      <nav 
        id="mobile-bottom-nav"
        className="md:hidden fixed bottom-1.5 left-1.5 right-1.5 z-40 bg-slate-950/90 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl transition-transform duration-200"



      >
        <div className="flex items-center justify-around px-2 py-1.5 h-16 max-w-lg mx-auto">
          {/* 1. Dashboard */}
          <button
            id="mobile-nav-dashboard"
            onClick={() => handleTabClick('dashboard')}
            className="flex-1 flex flex-col items-center justify-center py-1 relative touch-manipulation active:scale-95 transition-transform"
          >
            <div className={`relative p-1 rounded-xl transition-colors ${
              activeTab === 'dashboard' ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              <LayoutDashboard className="w-5 h-5" />
              {activeTab === 'dashboard' && (
                <motion.div 
                  layoutId="mobileNavIndicator"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-emerald-400 rounded-full"
                />
              )}
            </div>
            <span className={`text-[10px] font-medium tracking-tight mt-0.5 ${
              activeTab === 'dashboard' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
            }`}>
              Overview
            </span>
          </button>

          {/* 2. Clients */}
          <button
            id="mobile-nav-clients"
            onClick={() => handleTabClick('clients')}
            className="flex-1 flex flex-col items-center justify-center py-1 relative touch-manipulation active:scale-95 transition-transform"
          >
            <div className={`relative p-1 rounded-xl transition-colors ${
              activeTab === 'clients' ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              <Users className="w-5 h-5" />
              {activeTab === 'clients' && (
                <motion.div 
                  layoutId="mobileNavIndicator"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-emerald-400 rounded-full"
                />
              )}
            </div>
            <span className={`text-[10px] font-medium tracking-tight mt-0.5 ${
              activeTab === 'clients' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
            }`}>
              Athletes
            </span>
          </button>

          {/* 3. Center Quick Action Trigger */}
          <div className="flex-1 flex items-center justify-center -mt-5">
            <button
              id="mobile-quick-action-trigger"
              onClick={handleOpenActionSheet}
              className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-md border-2 border-slate-950 active:scale-90 transition-transform focus:outline-none"
              title="Quick Actions"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          {/* 4. Schedule */}
          <button
            id="mobile-nav-calendar"
            onClick={() => handleTabClick('calendar')}
            className="flex-1 flex flex-col items-center justify-center py-1 relative touch-manipulation active:scale-95 transition-transform"
          >
            <div className={`relative p-1 rounded-xl transition-colors ${
              activeTab === 'calendar' ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              <CalendarDays className="w-5 h-5" />
              {todayPendingCount > 0 && (
                <span className="absolute top-0.5 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
              )}
              {activeTab === 'calendar' && (
                <motion.div 
                  layoutId="mobileNavIndicator"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-emerald-400 rounded-full"
                />
              )}
            </div>
            <span className={`text-[10px] font-medium tracking-tight mt-0.5 ${
              activeTab === 'calendar' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
            }`}>
              Schedule
            </span>
          </button>

          {/* 5. Messenger */}
          <button
            id="mobile-nav-messenger"
            onClick={() => handleTabClick('messenger')}
            className="flex-1 flex flex-col items-center justify-center py-1 relative touch-manipulation active:scale-95 transition-transform"
          >
            <div className={`relative p-1 rounded-xl transition-colors ${
              activeTab === 'messenger' ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              <MessageSquare className="w-5 h-5" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-0.5 -right-1 px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-cyan-500 text-slate-950 ring-2 ring-slate-950">
                  {unreadMessagesCount}
                </span>
              )}
              {activeTab === 'messenger' && (
                <motion.div 
                  layoutId="mobileNavIndicator"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-emerald-400 rounded-full"
                />
              )}
            </div>
            <span className={`text-[10px] font-medium tracking-tight mt-0.5 ${
              activeTab === 'messenger' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
            }`}>
              Chat
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile Quick Action Sheet Modal */}
      <AnimatePresence>
        {isActionSheetOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm">
            {/* Dismiss backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => setIsActionSheetOpen(false)}
            />

            {/* Action Sheet Card */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="relative w-full bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 pb-safe z-10 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              {/* Sheet Drag Handle */}
              <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto" />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-white tracking-tight">Coach Quick Actions</h4>
                  <p className="text-xs text-slate-400">Gym floor shortcuts</p>
                </div>
                <button
                  onClick={() => setIsActionSheetOpen(false)}
                  className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Primary Action Tiles */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. Live Workout Logger */}
                <button
                  onClick={handleQuickLogFirstWorkout}
                  className="p-3.5 rounded-2xl bg-slate-800/80 border border-emerald-500/30 flex flex-col items-start gap-2 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-emerald-500 text-slate-950 font-bold">
                    <Play className="w-4 h-4 fill-slate-950" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-400 block">Log Workout</span>
                    <span className="text-[11px] text-slate-400">Sets, reps, & RPE</span>
                  </div>
                </button>

                {/* 2. Add New Athlete */}
                <button
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    onOpenNewClient();
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col items-start gap-2 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-slate-700 text-slate-200">
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Add Athlete</span>
                    <span className="text-[11px] text-slate-400">Client intake</span>
                  </div>
                </button>

                {/* 3. Program Builder */}
                <button
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    handleTabClick('programs');
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col items-start gap-2 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-slate-700 text-slate-200">
                    <Dumbbell className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Program Builder</span>
                    <span className="text-[11px] text-slate-400">Training splits</span>
                  </div>
                </button>

                {/* 4. Exercise Database */}
                <button
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    handleTabClick('exercises');
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col items-start gap-2 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-slate-700 text-slate-200">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Exercise Catalog</span>
                    <span className="text-[11px] text-slate-400">60+ movements & cues</span>
                  </div>
                </button>

                {/* 5. Metric Progress */}
                <button
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    handleTabClick('progress');
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col items-start gap-2 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-slate-700 text-slate-200">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Progress Charts</span>
                    <span className="text-[11px] text-slate-400">Body comp & PR logs</span>
                  </div>
                </button>

                {/* 6. Install PWA Shortcut */}
                <button
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    onOpenInstallModal();
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col items-start gap-2 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-slate-700 text-slate-200">
                    <Download className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Install PWA</span>
                    <span className="text-[11px] text-slate-400">Add to home screen</span>
                  </div>
                </button>
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => setIsActionSheetOpen(false)}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
