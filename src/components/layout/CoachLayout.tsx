import React, { lazy, Suspense, useEffect, useState } from 'react';
import { isNavigationTab, useApp } from '../../context/AppContext';
import { consumeDeepLink } from '../../utils/deepLink';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CoachDashboard } from '../dashboard/CoachDashboard';
// The dashboard loads with the shell; other tabs load when first opened.
const ClientRoster = lazy(() => import('../clients/ClientRoster').then(m => ({ default: m.ClientRoster })));
const ProgramBuilder = lazy(() => import('../programs/ProgramBuilder').then(m => ({ default: m.ProgramBuilder })));
const WorkoutLibrary = lazy(() => import('../training/WorkoutLibrary').then(m => ({ default: m.WorkoutLibrary })));
const NutritionHub = lazy(() => import('../nutrition/NutritionHub').then(m => ({ default: m.NutritionHub })));
const CommunityView = lazy(() => import('../engagement/CommunityView').then(m => ({ default: m.CommunityView })));
const CheckinsHub = lazy(() => import('../engagement/CheckinsHub').then(m => ({ default: m.CheckinsHub })));
const AutoflowHub = lazy(() => import('../engagement/AutoflowHub').then(m => ({ default: m.AutoflowHub })));
const BusinessHub = lazy(() => import('../business/BusinessHub').then(m => ({ default: m.BusinessHub })));
const AdminHub = lazy(() => import('../business/AdminHub').then(m => ({ default: m.AdminHub })));
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
  const { activeTab, setActiveTab, isLoading, loadError, refreshData, clients, setSelectedClientId } = useApp();
  const [deepLinkGroup, setDeepLinkGroup] = useState<string | null>(null);
  const { user } = useAuth();

  // Notification taps (push or email) open the app with ?open=<tab>&clientId=…&groupId=…
  useEffect(() => {
    const link = consumeDeepLink();
    if (!link) return;
    if (link.clientId) setSelectedClientId(link.clientId);
    if (link.groupId) setDeepLinkGroup(link.groupId);
    if (isNavigationTab(link.tab)) setActiveTab(link.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
                {activeTab === 'community' && <CommunityView initialGroupId={deepLinkGroup} />}
                {activeTab === 'checkins' && <CheckinsHub />}
                {activeTab === 'autoflow' && <AutoflowHub />}
                {activeTab === 'business' && <BusinessHub />}
                {activeTab === 'admin' && user?.isAdmin && <AdminHub />}
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

