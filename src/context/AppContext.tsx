import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Client,
  Exercise,
  TrainingProgram,
  ScheduledWorkout,
  MetricEntry,
  PersonalRecord,
  ProgressPhoto,
  ChatMessage,
  ActivityFeedItem,
  WorkoutTemplate
} from '../types';
import {
  clientsApi,
  exercisesApi,
  programsApi,
  workoutsApi,
  metricsApi,
  prsApi,
  photosApi,
  messagesApi,
  activityApi,
  workoutTemplatesApi,
} from '../services/apiClient';
import { useAuth } from './AuthContext';

export type NavigationTab =
  | 'dashboard'
  | 'clients'
  | 'programs'
  | 'workouts'
  | 'exercises'
  | 'calendar'
  | 'nutrition'
  | 'progress'
  | 'messenger'
  | 'community'
  | 'checkins'
  | 'autoflow'
  | 'business'
  | 'admin';

const NAV_TABS: NavigationTab[] = [
  'dashboard', 'clients', 'programs', 'workouts', 'exercises', 'calendar', 'nutrition', 'progress', 'messenger',
  'community', 'checkins', 'autoflow', 'business', 'admin',
];
export const isNavigationTab = (tab: string): tab is NavigationTab => (NAV_TABS as string[]).includes(tab);

type NewClient = Omit<Client, 'id' | 'workoutsCompleted' | 'totalWorkoutsAssigned' | 'complianceRate' | 'lastActive'>;
type WorkoutFeedback = {
  clientFeedback?: string;
  coachFeedback?: string;
  rating?: number;
  durationMin?: number;
  exercises?: ScheduledWorkout['exercises'];
  groups?: ScheduledWorkout['groups'];
  totalVolumeKg?: number;
  prCount?: number;
};

type NewWorkoutTemplate = Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt'>;

interface AppContextType {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  clients: Client[];
  exercises: Exercise[];
  programs: TrainingProgram[];
  scheduledWorkouts: ScheduledWorkout[];
  metrics: MetricEntry[];
  personalRecords: PersonalRecord[];
  photos: ProgressPhoto[];
  messages: ChatMessage[];
  activityFeed: ActivityFeedItem[];
  workoutTemplates: WorkoutTemplate[];

  // Selected state
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  selectedClient: Client | undefined;

  // Modals & Active actions
  isWorkoutLoggerOpen: boolean;
  activeWorkoutToLog: ScheduledWorkout | null;
  openWorkoutLogger: (workout: ScheduledWorkout) => void;
  closeWorkoutLogger: () => void;

  // Actions. Each resolves true when the server accepted the change.
  addClient: (client: NewClient, options?: { sendInvite?: boolean }) => Promise<boolean>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<boolean>;
  addCoachNote: (clientId: string, note: string) => Promise<boolean>;
  inviteClient: (clientId: string) => Promise<boolean>;
  addExercise: (exercise: Omit<Exercise, 'id'>) => Promise<boolean>;
  saveProgram: (program: TrainingProgram) => Promise<TrainingProgram | null>;
  deleteProgram: (id: string) => Promise<boolean>;
  assignProgramToClient: (programId: string, clientId: string, startDate?: string) => Promise<boolean>;
  unassignProgram: (programId: string, clientId: string) => Promise<boolean>;
  saveWorkoutTemplate: (template: NewWorkoutTemplate & { id?: string }) => Promise<WorkoutTemplate | null>;
  deleteWorkoutTemplate: (id: string) => Promise<boolean>;
  scheduleWorkout: (workout: Omit<ScheduledWorkout, 'id'>) => Promise<boolean>;
  updateWorkoutLog: (workoutId: string, updates: Partial<ScheduledWorkout>) => Promise<boolean>;
  deleteWorkout: (workoutId: string) => Promise<boolean>;
  completeWorkout: (workoutId: string, feedback: WorkoutFeedback) => Promise<boolean>;
  addMetricEntry: (entry: Omit<MetricEntry, 'id'>) => Promise<boolean>;
  addPersonalRecord: (pr: Omit<PersonalRecord, 'id'>) => Promise<boolean>;
  addProgressPhoto: (photo: Omit<ProgressPhoto, 'id'>) => Promise<boolean>;
  sendMessage: (clientId: string, text: string, attachment?: ChatMessage['attachment']) => Promise<boolean>;
  markThreadRead: (clientId: string) => Promise<void>;
  /** Re-fetch chat messages (called when a live event says there's something new). */
  reloadMessages: () => Promise<void>;

  refreshData: () => Promise<void>;
  isLoading: boolean;
  loadError: string | null;

  // Theme State
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Toast notifications
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Please try again.');

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, user } = useAuth();

  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkout[]>([]);
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [workoutTemplates, setWorkoutTemplates] = useState<WorkoutTemplate[]>([]);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isWorkoutLoggerOpen, setIsWorkoutLoggerOpen] = useState<boolean>(false);
  const [activeWorkoutToLog, setActiveWorkoutToLog] = useState<ScheduledWorkout | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('nubianfit_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // storage unavailable
    }
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem('nubianfit_theme', theme);
    } catch {
      // storage unavailable
    }
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const resetData = useCallback(() => {
    setClients([]);
    setExercises([]);
    setPrograms([]);
    setScheduledWorkouts([]);
    setMetrics([]);
    setPersonalRecords([]);
    setPhotos([]);
    setMessages([]);
    setActivityFeed([]);
    setWorkoutTemplates([]);
    setSelectedClientId(null);
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [c, ex, prog, w, m, pr, ph, msg, act] = await Promise.all([
        clientsApi.getAll(),
        exercisesApi.getAll(),
        programsApi.getAll(),
        workoutsApi.getAll(),
        metricsApi.getAll(),
        prsApi.getAll(),
        photosApi.getAll(),
        messagesApi.getAll(),
        activityApi.getAll(),
      ]);
      setClients(c);
      setExercises(ex);
      setPrograms(prog);
      setScheduledWorkouts(w);
      setMetrics(m);
      setPersonalRecords(pr);
      setPhotos(ph);
      setMessages(msg);
      setActivityFeed(act);
      // The workout library is coach-only.
      setWorkoutTemplates(user?.role === 'coach' ? await workoutTemplatesApi.getAll() : []);
      setSelectedClientId(prev => (prev && c.some(x => x.id === prev) ? prev : c[0]?.id ?? null));
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [user?.role]);

  // Load everything once signed in; drop it all on sign-out so nothing leaks between accounts.
  useEffect(() => {
    if (status === 'signed_in') {
      refreshData();
    } else if (status === 'signed_out') {
      resetData();
    }
  }, [status, user?.id, refreshData, resetData]);

  const reloadClients = async () => setClients(await clientsApi.getAll());
  const reloadActivity = async () => setActivityFeed(await activityApi.getAll());

  /** Run a server mutation; toast the outcome. */
  const mutate = async <T,>(action: () => Promise<T>, success?: string): Promise<T | null> => {
    try {
      const result = await action();
      if (success) showToast(success);
      return result;
    } catch (err) {
      showToast(errorMessage(err));
      return null;
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const openWorkoutLogger = (workout: ScheduledWorkout) => {
    setActiveWorkoutToLog(workout);
    setIsWorkoutLoggerOpen(true);
  };

  const closeWorkoutLogger = () => {
    setIsWorkoutLoggerOpen(false);
    setActiveWorkoutToLog(null);
  };

  const addClient = async (clientData: NewClient, options?: { sendInvite?: boolean }) => {
    const created = await mutate(async () => {
      const c = await clientsApi.create(clientData, options?.sendInvite);
      setClients(prev => [c, ...prev]);
      setSelectedClientId(c.id);
      await reloadActivity();
      return c;
    }, `Client ${clientData.name} added.`);
    return created !== null;
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    const updated = await mutate(async () => {
      const c = await clientsApi.update(id, updates);
      setClients(prev => prev.map(x => (x.id === id ? c : x)));
      return c;
    }, 'Client details updated.');
    return updated !== null;
  };

  const addCoachNote = async (clientId: string, note: string) => {
    const updated = await mutate(async () => {
      const c = await clientsApi.addNote(clientId, note);
      setClients(prev => prev.map(x => (x.id === clientId ? c : x)));
      return c;
    }, 'Coach note added.');
    return updated !== null;
  };

  const inviteClient = async (clientId: string) => {
    const res = await mutate(() => clientsApi.invite(clientId));
    if (res) showToast(res.message);
    return res !== null;
  };

  const addExercise = async (exerciseData: Omit<Exercise, 'id'>) => {
    const created = await mutate(async () => {
      const ex = await exercisesApi.create(exerciseData);
      setExercises(prev => [ex, ...prev]);
      return ex;
    }, `Exercise "${exerciseData.name}" added to library.`);
    return created !== null;
  };

  const saveProgram = async (prog: TrainingProgram) =>
    mutate(async () => {
      // Unsaved programs carry a client-side placeholder id; the server assigns the real one.
      const isExisting = programs.some(p => p.id === prog.id);
      const saved = await programsApi.save(isExisting ? prog : { ...prog, id: '' });
      setPrograms(prev => (isExisting ? prev.map(p => (p.id === prog.id ? saved : p)) : [saved, ...prev]));
      return saved;
    }, `Program "${prog.title}" saved!`);

  const deleteProgram = async (id: string) => {
    const res = await mutate(async () => {
      await programsApi.delete(id);
      setPrograms(prev => prev.filter(p => p.id !== id));
      return true;
    }, 'Program deleted.');
    return res !== null;
  };

  const reloadTraining = async () => {
    const [c, prog, w] = await Promise.all([clientsApi.getAll(), programsApi.getAll(), workoutsApi.getAll()]);
    setClients(c);
    setPrograms(prog);
    setScheduledWorkouts(w);
    await reloadActivity();
  };

  const assignProgramToClient = async (programId: string, clientId: string, startDate?: string) => {
    const res = await mutate(async () => {
      const r = await programsApi.assign(programId, clientId, startDate);
      await reloadTraining();
      return r;
    });
    if (res) showToast(res.message);
    return res !== null;
  };

  const unassignProgram = async (programId: string, clientId: string) => {
    const res = await mutate(async () => {
      const r = await programsApi.unassign(programId, clientId);
      await reloadTraining();
      return r;
    });
    if (res) showToast(res.message);
    return res !== null;
  };

  const saveWorkoutTemplate = async ({ id, ...template }: NewWorkoutTemplate & { id?: string }) =>
    mutate(async () => {
      const saved = id ? await workoutTemplatesApi.update(id, template) : await workoutTemplatesApi.create(template);
      setWorkoutTemplates(prev => (id ? prev.map(t => (t.id === id ? saved : t)) : [saved, ...prev]));
      return saved;
    }, `Workout "${template.title}" saved.`);

  const deleteWorkoutTemplate = async (id: string) => {
    const res = await mutate(async () => {
      await workoutTemplatesApi.delete(id);
      setWorkoutTemplates(prev => prev.filter(t => t.id !== id));
      return true;
    }, 'Workout deleted.');
    return res !== null;
  };

  const scheduleWorkout = async (workoutData: Omit<ScheduledWorkout, 'id'>) => {
    const created = await mutate(async () => {
      const w = await workoutsApi.create(workoutData);
      setScheduledWorkouts(prev => [w, ...prev]);
      await reloadClients();
      return w;
    }, `Workout "${workoutData.workoutTitle}" scheduled for ${workoutData.date}.`);
    return created !== null;
  };

  const updateWorkoutLog = async (workoutId: string, updates: Partial<ScheduledWorkout>) => {
    const updated = await mutate(async () => {
      const w = await workoutsApi.update(workoutId, updates);
      setScheduledWorkouts(prev => prev.map(x => (x.id === workoutId ? w : x)));
      return w;
    });
    return updated !== null;
  };

  const deleteWorkout = async (workoutId: string) => {
    const res = await mutate(async () => {
      await workoutsApi.delete(workoutId);
      setScheduledWorkouts(prev => prev.filter(w => w.id !== workoutId));
      await reloadClients();
      return true;
    }, 'Workout removed from the calendar.');
    return res !== null;
  };

  const completeWorkout = async (workoutId: string, feedback: WorkoutFeedback) => {
    const target = scheduledWorkouts.find(w => w.id === workoutId);
    if (!target) return false;
    const done = await mutate(async () => {
      const w = await workoutsApi.complete(workoutId, { exercises: target.exercises, ...feedback });
      setScheduledWorkouts(prev => prev.map(x => (x.id === workoutId ? w : x)));
      await Promise.all([reloadClients(), reloadActivity()]);
      return w;
    }, `Workout "${target.workoutTitle}" completed! 💪`);
    return done !== null;
  };

  const addMetricEntry = async (entryData: Omit<MetricEntry, 'id'>) => {
    const created = await mutate(async () => {
      const m = await metricsApi.create(entryData);
      setMetrics(prev => [m, ...prev]);
      await Promise.all([reloadClients(), reloadActivity()]);
      return m;
    }, `Check-in recorded: ${entryData.weightKg} kg.`);
    return created !== null;
  };

  const addPersonalRecord = async (prData: Omit<PersonalRecord, 'id'>) => {
    const created = await mutate(async () => {
      const pr = await prsApi.create(prData);
      setPersonalRecords(prev => [pr, ...prev]);
      await reloadActivity();
      return pr;
    }, `New personal record for ${prData.exerciseName}! 🔥`);
    return created !== null;
  };

  const addProgressPhoto = async (photoData: Omit<ProgressPhoto, 'id'>) => {
    const created = await mutate(async () => {
      const p = await photosApi.create(photoData);
      setPhotos(prev => [p, ...prev]);
      return p;
    }, 'Progress photo saved.');
    return created !== null;
  };

  const sendMessage = async (clientId: string, text: string, attachment?: ChatMessage['attachment']) => {
    const sent = await mutate(async () => {
      const msg = await messagesApi.send(clientId, text, attachment);
      setMessages(prev => [...prev, msg]);
      return msg;
    });
    return sent !== null;
  };

  const reloadMessages = useCallback(async () => {
    try {
      setMessages(await messagesApi.getAll());
    } catch {
      // next event or refresh will catch up
    }
  }, []);

  const markThreadRead = async (clientId: string) => {
    const other = user?.role === 'coach' ? 'client' : 'coach';
    const hasUnread = messages.some(m => m.clientId === clientId && m.sender === other && !m.isRead);
    if (!hasUnread) return;
    try {
      await messagesApi.markRead(clientId);
      setMessages(prev => prev.map(m => (m.clientId === clientId && m.sender === other ? { ...m, isRead: true } : m)));
    } catch {
      // non-critical
    }
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        clients,
        exercises,
        programs,
        scheduledWorkouts,
        metrics,
        personalRecords,
        photos,
        messages,
        activityFeed,
        workoutTemplates,
        selectedClientId,
        setSelectedClientId,
        selectedClient,
        isWorkoutLoggerOpen,
        activeWorkoutToLog,
        openWorkoutLogger,
        closeWorkoutLogger,
        addClient,
        updateClient,
        addCoachNote,
        inviteClient,
        addExercise,
        saveProgram,
        deleteProgram,
        assignProgramToClient,
        unassignProgram,
        saveWorkoutTemplate,
        deleteWorkoutTemplate,
        scheduleWorkout,
        updateWorkoutLog,
        deleteWorkout,
        completeWorkout,
        addMetricEntry,
        addPersonalRecord,
        addProgressPhoto,
        sendMessage,
        markThreadRead,
        reloadMessages,
        refreshData,
        isLoading,
        loadError,
        theme,
        toggleTheme,
        toastMessage,
        showToast
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
