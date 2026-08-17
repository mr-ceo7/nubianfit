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
  ClientDailyHabitLog
} from '../types';
import { 
  INITIAL_CLIENTS, 
  INITIAL_EXERCISES, 
  INITIAL_PROGRAMS, 
  INITIAL_SCHEDULED_WORKOUTS, 
  INITIAL_METRICS, 
  INITIAL_PRS, 
  INITIAL_PHOTOS, 
  INITIAL_MESSAGES, 
  INITIAL_ACTIVITY_FEED,
  INITIAL_HABIT_LOGS
} from '../data/mockData';
import {
  authApi,
  clientsApi,
  exercisesApi,
  programsApi,
  workoutsApi,
  metricsApi,
  prsApi,
  habitsApi,
  photosApi,
  messagesApi,
  activityApi,
} from '../services/apiClient';

export type NavigationTab = 
  | 'dashboard' 
  | 'clients' 
  | 'programs' 
  | 'exercises' 
  | 'calendar' 
  | 'progress' 
  | 'messenger';

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
  habitLogs: ClientDailyHabitLog[];
  
  // Backend Connection State
  isBackendConnected: boolean;
  
  // Selected state
  selectedClientId: string | null;
  setSelectedClientId: (id: string | null) => void;
  selectedClient: Client | undefined;
  
  // Modals & Active actions
  isWorkoutLoggerOpen: boolean;
  activeWorkoutToLog: ScheduledWorkout | null;
  openWorkoutLogger: (workout: ScheduledWorkout) => void;
  closeWorkoutLogger: () => void;
  
  // Actions
  addClient: (client: Omit<Client, 'id' | 'workoutsCompleted' | 'totalWorkoutsAssigned' | 'complianceRate' | 'lastActive'>) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  addCoachNote: (clientId: string, note: string) => void;
  addExercise: (exercise: Omit<Exercise, 'id'>) => void;
  saveProgram: (program: TrainingProgram) => void;
  deleteProgram: (id: string) => void;
  assignProgramToClient: (programId: string, clientId: string) => void;
  scheduleWorkout: (workout: Omit<ScheduledWorkout, 'id'>) => void;
  updateWorkoutLog: (workoutId: string, updates: Partial<ScheduledWorkout>) => void;
  completeWorkout: (workoutId: string, feedback: { clientFeedback?: string; coachFeedback?: string; rating?: number; durationMin?: number }) => void;
  addMetricEntry: (entry: Omit<MetricEntry, 'id'>) => void;
  addPersonalRecord: (pr: Omit<PersonalRecord, 'id'>) => void;
  addProgressPhoto: (photo: Omit<ProgressPhoto, 'id'>) => void;
  sendMessage: (clientId: string, text: string, attachment?: ChatMessage['attachment']) => void;
  toggleHabitCompletion: (clientId: string, date: string, habitId: string) => void;
  
  // Refresh data from API
  refreshFromBackend: () => Promise<void>;

  // Theme State
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Toast notifications
  toastMessage: string | null;
  showToast: (msg: string) => void;
}


const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('nubianfit_clients');
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });
  
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const saved = localStorage.getItem('nubianfit_exercises');
    return saved ? JSON.parse(saved) : INITIAL_EXERCISES;
  });
  
  const [programs, setPrograms] = useState<TrainingProgram[]>(() => {
    const saved = localStorage.getItem('nubianfit_programs');
    return saved ? JSON.parse(saved) : INITIAL_PROGRAMS;
  });
  
  const [scheduledWorkouts, setScheduledWorkouts] = useState<ScheduledWorkout[]>(() => {
    const saved = localStorage.getItem('nubianfit_workouts');
    return saved ? JSON.parse(saved) : INITIAL_SCHEDULED_WORKOUTS;
  });
  
  const [metrics, setMetrics] = useState<MetricEntry[]>(() => {
    const saved = localStorage.getItem('nubianfit_metrics');
    return saved ? JSON.parse(saved) : INITIAL_METRICS;
  });
  
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>(() => {
    const saved = localStorage.getItem('nubianfit_prs');
    return saved ? JSON.parse(saved) : INITIAL_PRS;
  });
  
  const [photos, setPhotos] = useState<ProgressPhoto[]>(() => {
    const saved = localStorage.getItem('nubianfit_photos');
    return saved ? JSON.parse(saved) : INITIAL_PHOTOS;
  });
  
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('nubianfit_messages');
    return saved ? JSON.parse(saved) : INITIAL_MESSAGES;
  });
  
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>(INITIAL_ACTIVITY_FEED);
  
  const [habitLogs, setHabitLogs] = useState<ClientDailyHabitLog[]>(() => {
    const saved = localStorage.getItem('nubianfit_habits');
    return saved ? JSON.parse(saved) : INITIAL_HABIT_LOGS;
  });

  const [selectedClientId, setSelectedClientId] = useState<string | null>('client-1');
  const [isWorkoutLoggerOpen, setIsWorkoutLoggerOpen] = useState<boolean>(false);
  const [activeWorkoutToLog, setActiveWorkoutToLog] = useState<ScheduledWorkout | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('nubianfit_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light';
  });


  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    localStorage.setItem('nubianfit_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);


  // Sync to localStorage as backup
  useEffect(() => {
    localStorage.setItem('nubianfit_clients', JSON.stringify(clients));
  }, [clients]);
  
  useEffect(() => {
    localStorage.setItem('nubianfit_exercises', JSON.stringify(exercises));
  }, [exercises]);
  
  useEffect(() => {
    localStorage.setItem('nubianfit_programs', JSON.stringify(programs));
  }, [programs]);
  
  useEffect(() => {
    localStorage.setItem('nubianfit_workouts', JSON.stringify(scheduledWorkouts));
  }, [scheduledWorkouts]);

  useEffect(() => {
    localStorage.setItem('nubianfit_metrics', JSON.stringify(metrics));
  }, [metrics]);

  useEffect(() => {
    localStorage.setItem('nubianfit_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('nubianfit_habits', JSON.stringify(habitLogs));
  }, [habitLogs]);

  // Fetch initial data from FastAPI backend
  const refreshFromBackend = useCallback(async () => {
    try {
      // Check auth / log in if needed
      const token = localStorage.getItem('nubianfit_token');
      if (!token) {
        try {
          await authApi.login('coach@nubianfit.com', 'Coach@123');
        } catch {
          // continue even if login fails
        }
      }

      const [
        fetchedClients,
        fetchedExercises,
        fetchedPrograms,
        fetchedWorkouts,
        fetchedMetrics,
        fetchedPrs,
        fetchedHabits,
        fetchedPhotos,
        fetchedMessages,
        fetchedActivity
      ] = await Promise.all([
        clientsApi.getAll().catch(() => null),
        exercisesApi.getAll().catch(() => null),
        programsApi.getAll().catch(() => null),
        workoutsApi.getAll().catch(() => null),
        metricsApi.getAll().catch(() => null),
        prsApi.getAll().catch(() => null),
        habitsApi.getAll().catch(() => null),
        photosApi.getAll().catch(() => null),
        messagesApi.getAll().catch(() => null),
        activityApi.getAll().catch(() => null),
      ]);

      if (fetchedClients && fetchedClients.length > 0) {
        setClients(fetchedClients);
        setIsBackendConnected(true);
      }
      if (fetchedExercises && fetchedExercises.length > 0) setExercises(fetchedExercises);
      if (fetchedPrograms && fetchedPrograms.length > 0) setPrograms(fetchedPrograms);
      if (fetchedWorkouts && fetchedWorkouts.length > 0) setScheduledWorkouts(fetchedWorkouts);
      if (fetchedMetrics && fetchedMetrics.length > 0) setMetrics(fetchedMetrics);
      if (fetchedPrs && fetchedPrs.length > 0) setPersonalRecords(fetchedPrs);
      if (fetchedHabits && fetchedHabits.length > 0) setHabitLogs(fetchedHabits);
      if (fetchedPhotos && fetchedPhotos.length > 0) setPhotos(fetchedPhotos);
      if (fetchedMessages && fetchedMessages.length > 0) setMessages(fetchedMessages);
      if (fetchedActivity && fetchedActivity.length > 0) setActivityFeed(fetchedActivity);
    } catch (err) {
      console.warn('FastAPI backend not reachable, using offline store:', err);
      setIsBackendConnected(false);
    }
  }, []);

  useEffect(() => {
    refreshFromBackend();
  }, [refreshFromBackend]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const openWorkoutLogger = (workout: ScheduledWorkout) => {
    setActiveWorkoutToLog(workout);
    setIsWorkoutLoggerOpen(true);
  };

  const closeWorkoutLogger = () => {
    setIsWorkoutLoggerOpen(false);
    setActiveWorkoutToLog(null);
  };

  const addClient = async (clientData: Omit<Client, 'id' | 'workoutsCompleted' | 'totalWorkoutsAssigned' | 'complianceRate' | 'lastActive'>) => {
    const tempId = `client-${Date.now()}`;
    const newClient: Client = {
      ...clientData,
      id: tempId,
      workoutsCompleted: 0,
      totalWorkoutsAssigned: 0,
      complianceRate: 100,
      lastActive: 'Just registered'
    };
    
    // Optimistic UI update
    setClients(prev => [newClient, ...prev]);
    setSelectedClientId(newClient.id);
    
    // Activity feed item
    setActivityFeed(prev => [
      {
        id: `act-${Date.now()}`,
        type: 'check_in_submitted',
        clientId: newClient.id,
        clientName: newClient.name,
        clientAvatar: newClient.avatar,
        title: 'New Client Onboarded',
        description: `Enrolled for ${newClient.goal} coaching`,
        timestamp: 'Just now'
      },
      ...prev
    ]);
    showToast(`Client ${newClient.name} added successfully!`);

    // Sync to Backend
    try {
      const created = await clientsApi.create(clientData);
      if (created?.id) {
        setClients(prev => prev.map(c => c.id === tempId ? created : c));
        setSelectedClientId(created.id);
      }
    } catch (err) {
      console.warn('Backend sync failed for addClient:', err);
    }
  };

  const updateClient = async (id: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    showToast('Client details updated.');

    try {
      await clientsApi.update(id, updates);
    } catch (err) {
      console.warn('Backend sync failed for updateClient:', err);
    }
  };

  const addCoachNote = async (clientId: string, note: string) => {
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        return {
          ...c,
          customCoachNotes: [note, ...c.customCoachNotes]
        };
      }
      return c;
    }));
    showToast('Coach note added.');

    try {
      await clientsApi.addNote(clientId, note);
    } catch (err) {
      console.warn('Backend sync failed for addCoachNote:', err);
    }
  };

  const addExercise = async (exerciseData: Omit<Exercise, 'id'>) => {
    const tempId = `ex-${Date.now()}`;
    const newEx: Exercise = {
      ...exerciseData,
      id: tempId,
      isCustom: true
    };
    setExercises(prev => [newEx, ...prev]);
    showToast(`Exercise "${newEx.name}" added to library.`);

    try {
      const created = await exercisesApi.create(exerciseData);
      if (created?.id) {
        setExercises(prev => prev.map(e => e.id === tempId ? created : e));
      }
    } catch (err) {
      console.warn('Backend sync failed for addExercise:', err);
    }
  };

  const saveProgram = async (prog: TrainingProgram) => {
    setPrograms(prev => {
      const idx = prev.findIndex(p => p.id === prog.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prog, updatedAt: new Date().toISOString().split('T')[0] };
        return next;
      } else {
        return [{ ...prog, id: prog.id || `prog-${Date.now()}`, createdAt: new Date().toISOString().split('T')[0], updatedAt: new Date().toISOString().split('T')[0] }, ...prev];
      }
    });
    showToast(`Program "${prog.title}" saved!`);

    try {
      await programsApi.save(prog);
    } catch (err) {
      console.warn('Backend sync failed for saveProgram:', err);
    }
  };

  const deleteProgram = async (id: string) => {
    setPrograms(prev => prev.filter(p => p.id !== id));
    showToast('Program deleted.');

    try {
      await programsApi.delete(id);
    } catch (err) {
      console.warn('Backend sync failed for deleteProgram:', err);
    }
  };

  const assignProgramToClient = async (programId: string, clientId: string) => {
    const targetProgram = programs.find(p => p.id === programId);
    const targetClient = clients.find(c => c.id === clientId);
    if (!targetProgram || !targetClient) return;

    setClients(prev => prev.map(c => c.id === clientId ? {
      ...c,
      currentProgramId: targetProgram.id,
      currentProgramName: targetProgram.title
    } : c));

    setPrograms(prev => prev.map(p => p.id === programId ? {
      ...p,
      assignedClientCount: p.assignedClientCount + 1
    } : p));

    const today = new Date();
    const newWorkouts: ScheduledWorkout[] = targetProgram.days.map((day, idx) => {
      const scheduledDate = new Date(today);
      scheduledDate.setDate(today.getDate() + (idx * 2));
      const dateStr = scheduledDate.toISOString().split('T')[0];

      return {
        id: `sched-${Date.now()}-${idx}`,
        clientId: targetClient.id,
        clientName: targetClient.name,
        clientAvatar: targetClient.avatar,
        programId: targetProgram.id,
        programName: targetProgram.title,
        workoutDayId: day.id,
        workoutTitle: day.name,
        date: dateStr,
        time: '09:00 AM',
        status: 'Scheduled',
        exercises: day.exercises
      };
    });

    setScheduledWorkouts(prev => [...newWorkouts, ...prev]);

    setActivityFeed(prev => [
      {
        id: `act-${Date.now()}`,
        type: 'check_in_submitted',
        clientId: targetClient.id,
        clientName: targetClient.name,
        clientAvatar: targetClient.avatar,
        title: `Assigned: ${targetProgram.title}`,
        description: `Program assigned with ${targetProgram.days.length} training days`,
        timestamp: 'Just now'
      },
      ...prev
    ]);

    showToast(`Assigned "${targetProgram.title}" to ${targetClient.name}!`);

    try {
      await programsApi.assign(programId, clientId);
    } catch (err) {
      console.warn('Backend sync failed for assignProgramToClient:', err);
    }
  };

  const scheduleWorkout = async (workoutData: Omit<ScheduledWorkout, 'id'>) => {
    const tempId = `sched-${Date.now()}`;
    const newSched: ScheduledWorkout = {
      ...workoutData,
      id: tempId
    };
    setScheduledWorkouts(prev => [newSched, ...prev]);
    showToast(`Workout "${newSched.workoutTitle}" scheduled for ${newSched.date}.`);

    try {
      const created = await workoutsApi.create(workoutData);
      if (created?.id) {
        setScheduledWorkouts(prev => prev.map(w => w.id === tempId ? created : w));
      }
    } catch (err) {
      console.warn('Backend sync failed for scheduleWorkout:', err);
    }
  };

  const updateWorkoutLog = async (workoutId: string, updates: Partial<ScheduledWorkout>) => {
    setScheduledWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, ...updates } : w));

    try {
      await workoutsApi.update(workoutId, updates);
    } catch (err) {
      console.warn('Backend sync failed for updateWorkoutLog:', err);
    }
  };

  const completeWorkout = async (workoutId: string, feedback: { clientFeedback?: string; coachFeedback?: string; rating?: number; durationMin?: number }) => {
    const target = scheduledWorkouts.find(w => w.id === workoutId);
    if (!target) return;

    const updatedWorkout: ScheduledWorkout = {
      ...target,
      status: 'Completed',
      durationMin: feedback.durationMin || target.durationMin || 55,
      rating: feedback.rating || 5,
      clientFeedback: feedback.clientFeedback || target.clientFeedback || 'Great workout completed!',
      coachFeedback: feedback.coachFeedback || target.coachFeedback || 'Excellent consistency.'
    };

    setScheduledWorkouts(prev => prev.map(w => w.id === workoutId ? updatedWorkout : w));

    setClients(prev => prev.map(c => {
      if (c.id === target.clientId) {
        const completed = c.workoutsCompleted + 1;
        const total = c.totalWorkoutsAssigned || completed;
        const compliance = Math.min(100, Math.round((completed / total) * 100));
        return {
          ...c,
          workoutsCompleted: completed,
          complianceRate: compliance,
          lastActive: 'Just now'
        };
      }
      return c;
    }));

    setActivityFeed(prev => [
      {
        id: `act-${Date.now()}`,
        type: 'workout_completed',
        clientId: target.clientId,
        clientName: target.clientName,
        clientAvatar: target.clientAvatar,
        title: `Workout Logged: ${target.workoutTitle}`,
        description: `Completed with ${feedback.rating || 5}/5 intensity rating`,
        timestamp: 'Just now'
      },
      ...prev
    ]);

    showToast(`Workout "${target.workoutTitle}" marked completed! 💪`);

    try {
      await workoutsApi.complete(workoutId, {
        clientFeedback: updatedWorkout.clientFeedback,
        coachFeedback: updatedWorkout.coachFeedback,
        rating: updatedWorkout.rating,
        durationMin: updatedWorkout.durationMin,
        exercises: target.exercises,
      });
    } catch (err) {
      console.warn('Backend sync failed for completeWorkout:', err);
    }
  };

  const addMetricEntry = async (entryData: Omit<MetricEntry, 'id'>) => {
    const tempId = `m-${Date.now()}`;
    const newEntry: MetricEntry = {
      ...entryData,
      id: tempId
    };

    setMetrics(prev => [newEntry, ...prev]);

    setClients(prev => prev.map(c => {
      if (c.id === entryData.clientId) {
        return {
          ...c,
          currentWeightKg: entryData.weightKg,
          bodyFatPercentage: entryData.bodyFatPercentage || c.bodyFatPercentage,
          lastActive: 'Just now'
        };
      }
      return c;
    }));

    const client = clients.find(c => c.id === entryData.clientId);
    if (client) {
      setActivityFeed(prev => [
        {
          id: `act-${Date.now()}`,
          type: 'check_in_submitted',
          clientId: client.id,
          clientName: client.name,
          clientAvatar: client.avatar,
          title: 'Weight Logged',
          description: `${entryData.weightKg} kg (${entryData.weightKg < client.currentWeightKg ? 'Weight reduced' : 'Measurement recorded'})`,
          timestamp: 'Just now',
          metadata: { weightKg: entryData.weightKg }
        },
        ...prev
      ]);
    }

    showToast(`Biometric log recorded: ${entryData.weightKg} kg.`);

    try {
      const created = await metricsApi.create(entryData);
      if (created?.id) {
        setMetrics(prev => prev.map(m => m.id === tempId ? created : m));
      }
    } catch (err) {
      console.warn('Backend sync failed for addMetricEntry:', err);
    }
  };

  const addPersonalRecord = async (prData: Omit<PersonalRecord, 'id'>) => {
    const tempId = `pr-${Date.now()}`;
    const newPr: PersonalRecord = {
      ...prData,
      id: tempId
    };

    setPersonalRecords(prev => [newPr, ...prev]);

    const client = clients.find(c => c.id === prData.clientId);
    if (client) {
      setActivityFeed(prev => [
        {
          id: `act-${Date.now()}`,
          type: 'pr_achieved',
          clientId: client.id,
          clientName: client.name,
          clientAvatar: client.avatar,
          title: `New PR: ${prData.exerciseName}`,
          description: `${prData.weightKg} kg for ${prData.reps} reps (Est 1RM: ${prData.estimated1RmKg}kg)`,
          timestamp: 'Just now',
          metadata: { weightKg: prData.weightKg, exerciseName: prData.exerciseName }
        },
        ...prev
      ]);
    }

    showToast(`New Personal Record added for ${prData.exerciseName}! 🔥`);

    try {
      const created = await prsApi.create(prData);
      if (created?.id) {
        setPersonalRecords(prev => prev.map(p => p.id === tempId ? created : p));
      }
    } catch (err) {
      console.warn('Backend sync failed for addPersonalRecord:', err);
    }
  };

  const addProgressPhoto = async (photoData: Omit<ProgressPhoto, 'id'>) => {
    const tempId = `photo-${Date.now()}`;
    const newPhoto: ProgressPhoto = {
      ...photoData,
      id: tempId
    };

    setPhotos(prev => [newPhoto, ...prev]);
    showToast('Progress photo uploaded successfully.');

    try {
      const created = await photosApi.create(photoData);
      if (created?.id) {
        setPhotos(prev => prev.map(p => p.id === tempId ? created : p));
      }
    } catch (err) {
      console.warn('Backend sync failed for addProgressPhoto:', err);
    }
  };

  const sendMessage = async (clientId: string, text: string, attachment?: ChatMessage['attachment']) => {
    const tempId = `msg-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const newMsg: ChatMessage = {
      id: tempId,
      clientId,
      sender: 'coach',
      text,
      timestamp: nowTime,
      isRead: true,
      attachment
    };

    setMessages(prev => [...prev, newMsg]);

    try {
      await messagesApi.send(clientId, text, attachment);
    } catch (err) {
      console.warn('Backend sync failed for sendMessage:', err);
    }

    // Auto simulate client reply after short delay
    setTimeout(() => {
      const client = clients.find(c => c.id === clientId);
      if (!client) return;

      const clientReplies = [
        'Thanks Coach! Crushed the session today. Feeling motivated!',
        'Got it, will increase the tempo on the eccentric reps next time.',
        'Submitted my weight check-in for this morning!',
        'Shoulder felt 100% with the neutral grip adjustments. Appreciate you!'
      ];
      const randomReply = clientReplies[Math.floor(Math.random() * clientReplies.length)];

      const clientMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        clientId,
        sender: 'client',
        text: randomReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: false
      };

      setMessages(prev => [...prev, clientMsg]);

      setActivityFeed(af => [
        {
          id: `act-${Date.now()}`,
          type: 'new_message',
          clientId: client.id,
          clientName: client.name,
          clientAvatar: client.avatar,
          title: `Reply from ${client.name}`,
          description: `"${randomReply.substring(0, 45)}..."`,
          timestamp: 'Just now'
        },
        ...af
      ]);
    }, 2800);

    showToast('Message sent to client.');
  };

  const toggleHabitCompletion = async (clientId: string, date: string, habitId: string) => {
    setHabitLogs(prev => {
      const existingLog = prev.find(l => l.clientId === clientId && l.date === date);
      if (existingLog) {
        return prev.map(log => {
          if (log.id === existingLog.id) {
            return {
              ...log,
              habits: log.habits.map(h => h.habitId === habitId ? { ...h, completed: !h.completed } : h)
            };
          }
          return log;
        });
      } else {
        const newLog: ClientDailyHabitLog = {
          id: `hl-${Date.now()}`,
          clientId,
          date,
          habits: [
            { habitId: 'h-1', title: 'Daily Water Intake', completed: habitId === 'h-1', currentValue: '3.5', targetValue: '3.5', unit: 'Liters' },
            { habitId: 'h-2', title: 'Protein Target', completed: habitId === 'h-2', currentValue: '180', targetValue: '180', unit: 'Grams' },
            { habitId: 'h-3', title: 'Daily Step Goal', completed: habitId === 'h-3', currentValue: '10,000', targetValue: '10,000', unit: 'Steps' },
            { habitId: 'h-4', title: 'Sleep Duration', completed: habitId === 'h-4', currentValue: '8.0', targetValue: '7.5+', unit: 'Hours' },
            { habitId: 'h-5', title: 'Mobility / Foam Rolling', completed: habitId === 'h-5', currentValue: '10', targetValue: '10', unit: 'Minutes' }
          ]
        };
        return [newLog, ...prev];
      }
    });

    try {
      await habitsApi.toggle(clientId, date, habitId);
    } catch (err) {
      console.warn('Backend sync failed for toggleHabitCompletion:', err);
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
        habitLogs,
        isBackendConnected,
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
        addExercise,
        saveProgram,
        deleteProgram,
        assignProgramToClient,
        scheduleWorkout,
        updateWorkoutLog,
        completeWorkout,
        addMetricEntry,
        addPersonalRecord,
        addProgressPhoto,
        sendMessage,
        toggleHabitCompletion,
        refreshFromBackend,
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
