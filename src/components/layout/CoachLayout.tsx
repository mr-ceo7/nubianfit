import React, { lazy, Suspense, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CoachDashboard } from '../dashboard/CoachDashboard';
// The dashboard loads with the shell; other tabs load when first opened.
const ClientRoster = lazy(() => import('../clients/ClientRoster').then(m => ({ default: m.ClientRoster })));
const ProgramBuilder = lazy(() => import('../programs/ProgramBuilder').then(m => ({ default: m.ProgramBuilder })));
const WorkoutLibrary = lazy(() => import('../training/WorkoutLibrary').then(m => ({ default: m.WorkoutLibrary })));
const NutritionHub = lazy(() => import('../nutrition/NutritionHub').then(m => ({ default: m.NutritionHub })));
const ExerciseLibrary = lazy(() => import('../programs/ExerciseLibrary').then(m => ({ default: m.ExerciseLibrary })));
const CalendarScheduler = lazy(() => import('../programs/CalendarScheduler').then(m => ({ default: m.CalendarScheduler })));
const ProgressTracker = lazy(() => import('../progress/ProgressTracker').then(m => ({ default: m.ProgressTracker })));
const CoachMessenger = lazy(() => import('../messenger/CoachMessenger').then(m => ({ default: m.CoachMessenger })));

import { WorkoutLoggerModal } from '../programs/WorkoutLoggerModal';
import { MobileBottomNav } from './MobileBottomNav';
import { PwaInstallPrompt } from '../common/PwaInstallPrompt';
import { Loader } from '../common/Loader';

/** Coach OS, served at coach.<domain>. */
export const CoachLayout: React.FC = () => {
  const { activeTab, setActiveTab, isLoading, loadError, refreshData, clients } = useApp();
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // The add-client/add-exercise modals live inside their tabs, so switch there first.
  const openAddClient = () => {
    setActiveTab('clients');
    setIsAddClientModalOpen(true);
  };
  const openAddExercise = () => {
    setActiveTab('exercises');
    setIsAddExerciseModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          onOpenNewClient={openAddClient}
          onOpenNewProgram={() => setActiveTab('programs')}
          onOpenExerciseModal={openAddExercise}
          onOpenInstallModal={() => setIsInstallModalOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 md:pb-6 touch-pan-y">
          <div className="max-w-7xl mx-auto">
            {loadError && (
              <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                <span>Couldn't load your data: {loadError}</span>
                <button onClick={refreshData} className="font-bold text-white">Retry</button>
              </div>
            )}

            {isLoading && clients.length === 0 ? (
              <div className="py-24 flex justify-center">
                <Loader text="Loading" size="md" />
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="py-24 flex justify-center">
                    <Loader text="Loading" size="md" />
                  </div>
                }
              >
                {activeTab === 'dashboard' && <CoachDashboard onOpenNewClient={openAddClient} onOpenNewProgram={() => setActiveTab('programs')} />}
                {activeTab === 'clients' && (
                  <ClientRoster
                    isAddModalOpen={isAddClientModalOpen}
                    onOpenAddModal={openAddClient}
                    onCloseAddModal={() => setIsAddClientModalOpen(false)}
                  />
                )}
                {activeTab === 'programs' && <ProgramBuilder />}
                {activeTab === 'workouts' && <WorkoutLibrary />}
                {activeTab === 'exercises' && (
                  <ExerciseLibrary
                    isAddModalOpen={isAddExerciseModalOpen}
                    onOpenAddModal={() => setIsAddExerciseModalOpen(true)}
                    onCloseAddModal={() => setIsAddExerciseModalOpen(false)}
                  />
                )}
                {activeTab === 'calendar' && <CalendarScheduler />}
                {activeTab === 'nutrition' && <NutritionHub />}
                {activeTab === 'progress' && <ProgressTracker />}
                {activeTab === 'messenger' && <CoachMessenger />}
              </Suspense>
            )}
          </div>
        </main>
      </div>

      <MobileBottomNav
        onOpenNewClient={openAddClient}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
      />
      <PwaInstallPrompt isOpen={isInstallModalOpen} onClose={() => setIsInstallModalOpen(false)} />
      <WorkoutLoggerModal />
    </div>
  );
};

