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
  Download,
  UserPlus,
  Play,
  ListChecks,
  Apple
} from 'lucide-react';

import { localDateStr } from '../../utils/dates';
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
    openWorkoutLogger,
    showToast
  } = useApp();

  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  // Unread message count
  const unreadMessagesCount = messages.filter(m => m.sender === 'client' && !m.isRead).length;

  // Today's scheduled workouts count
  const todayStr = localDateStr();
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
    const nextPending = scheduledWorkouts
      .filter(w => w.status !== 'Completed' && w.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (nextPending) {
      openWorkoutLogger(nextPending);
    } else {
      showToast('No upcoming workouts. Assign a program or schedule one first.');
      setActiveTab('calendar');
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
              onClick={isActionSheetOpen ? () => setIsActionSheetOpen(false) : handleOpenActionSheet}
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md border-2 border-slate-950 active:scale-90 transition-all duration-300 focus:outline-none ${
                isActionSheetOpen
                  ? 'bg-slate-700 text-white rotate-45'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 rotate-0'
              }`}
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 bottom-[76px] z-50 flex items-end justify-center bg-slate-950/85 backdrop-blur-xs cursor-pointer"
            onClick={() => setIsActionSheetOpen(false)}
          >
            {/* Action Sheet Card */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 pb-6 z-10 shadow-2xl space-y-4 max-h-[70vh] overflow-y-auto cursor-default"
              onClick={(e) => e.stopPropagation()}
            >

              {/* Sheet Drag Handle */}
              <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto" />

              <div>
                <h4 className="text-base font-bold text-white tracking-tight">Coach Quick Actions</h4>
                <p className="text-xs text-slate-400">Gym floor shortcuts</p>
              </div>

              {/* Primary Action Tiles */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. Live Workout Logger */}
                <button
                  onClick={handleQuickLogFirstWorkout}
                  className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/40 flex flex-col items-start gap-2 text-left active:scale-[0.97] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-emerald-500 text-slate-950">
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
                  className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/40 flex flex-col items-start gap-2 text-left active:scale-[0.97] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-emerald-900/60 text-emerald-400">
                    <UserPlus className="w-4 h-4" />
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
                  className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/40 flex flex-col items-start gap-2 text-left active:scale-[0.97] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-cyan-900/50 text-cyan-400">
                    <Dumbbell className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Program Builder</span>
                    <span className="text-[11px] text-slate-400">Training splits</span>
                  </div>
                </button>

                {/* 4. Workout Library */}
                <button
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    handleTabClick('workouts');
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/40 flex flex-col items-start gap-2 text-left active:scale-[0.97] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-amber-900/40 text-amber-400">
                    <ListChecks className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Workout Library</span>
                    <span className="text-[11px] text-slate-400">Reusable sessions</span>
                  </div>
                </button>

                {/* Exercise Database */}
                <button
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    handleTabClick('exercises');
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/40 flex flex-col items-start gap-2 text-left active:scale-[0.97] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-amber-900/40 text-amber-400">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Exercise Catalog</span>
                    <span className="text-[11px] text-slate-400">Movements & videos</span>
                  </div>
                </button>

                {/* Nutrition & Habits */}
                <button
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    handleTabClick('nutrition');
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/40 flex flex-col items-start gap-2 text-left active:scale-[0.97] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-emerald-900/50 text-emerald-400">
                    <Apple className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Nutrition</span>
                    <span className="text-[11px] text-slate-400">Targets, diary, habits</span>
                  </div>
                </button>

                {/* 5. Metric Progress */}
                <button
                  onClick={() => {
                    setIsActionSheetOpen(false);
                    handleTabClick('progress');
                  }}
                  className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/40 flex flex-col items-start gap-2 text-left active:scale-[0.97] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-emerald-900/50 text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
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
                  className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/40 flex flex-col items-start gap-2 text-left active:scale-[0.97] transition-transform"
                >
                  <div className="p-2 rounded-xl bg-slate-700/80 text-slate-300">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Install PWA</span>
                    <span className="text-[11px] text-slate-400">Add to home screen</span>
                  </div>
                </button>
              </div>




            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
