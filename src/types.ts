export type ClientStatus = 'Active' | 'Inactive' | 'Onboarding' | 'Needs Check-in';
export type FitnessGoal = 'Fat Loss' | 'Hypertrophy' | 'Strength & Power' | 'Athletic Conditioning' | 'Endurance' | 'Rehabilitation';
export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite Athlete';

export interface Client {
  id: string;
  name: string;
  avatar: string;
  email: string;
  phone: string;
  age: number;
  gender: string;
  status: ClientStatus;
  goal: FitnessGoal;
  experienceLevel: ExperienceLevel;
  startDate: string;
  currentProgramId?: string;
  currentProgramName?: string;
  complianceRate: number; // percentage 0 - 100
  workoutsCompleted: number;
  totalWorkoutsAssigned: number;
  lastActive: string;
  targetWeightKg: number;
  currentWeightKg: number;
  startingWeightKg: number;
  heightCm: number;
  bodyFatPercentage: number;
  targetBodyFat: number;
  injuriesAndHealth: string[];
  medicalAlerts?: string;
  customCoachNotes: string[];
  onboardingSurvey: {
    gymAccess: string;
    weeklyAvailabilityDays: number;
    dietaryRestrictions: string;
    sleepAvgHours: number;
    stressLevel: string;
    favoriteExercises: string;
    leastFavoriteExercises: string;
  };
}

export type MuscleGroup = 
  | 'Chest' 
  | 'Back' 
  | 'Quads' 
  | 'Hamstrings' 
  | 'Glutes' 
  | 'Shoulders' 
  | 'Biceps' 
  | 'Triceps' 
  | 'Core' 
  | 'Full Body' 
  | 'Calves' 
  | 'Cardio';

export type Equipment = 
  | 'Barbell' 
  | 'Dumbbell' 
  | 'Cable' 
  | 'Machine' 
  | 'Bodyweight' 
  | 'Kettlebell' 
  | 'Resistance Band' 
  | 'Trap Bar' 
  | 'Smith Machine';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  difficulty: Difficulty;
  description: string;
  instructions: string[];
  formCues: string[];
  demoVideoPlaceholderUrl?: string;
  thumbnailUrl: string;
  category: 'Strength' | 'Hypertrophy' | 'Cardio' | 'Mobility' | 'Olympic';
  isCustom?: boolean;
}

export interface WorkoutSet {
  id: string;
  setNumber: number;
  targetReps: string; // e.g. "8-10" or "12"
  targetRpe?: number; // e.g. 8
  targetWeightKg?: number;
  restSeconds?: number;
  completedReps?: number;
  completedWeightKg?: number;
  completedRpe?: number;
  isCompleted?: boolean;
  notes?: string;
}

export interface WorkoutExerciseItem {
  id: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: MuscleGroup;
  equipment: Equipment;
  sets: WorkoutSet[];
  tempo?: string; // e.g. "3-0-1-0"
  coachNotes?: string;
  isSupersetWithNext?: boolean;
}

export interface WorkoutDay {
  id: string;
  dayNumber: number;
  name: string; // e.g. "Day 1: Upper Body Power"
  focus: string;
  estimatedDurationMin: number;
  warmupNotes?: string;
  cooldownNotes?: string;
  exercises: WorkoutExerciseItem[];
}

export interface TrainingProgram {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  difficulty: Difficulty;
  goal: FitnessGoal;
  durationWeeks: number;
  daysPerWeek: number;
  days: WorkoutDay[];
  tags: string[];
  assignedClientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledWorkout {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar: string;
  programId?: string;
  programName?: string;
  workoutDayId: string;
  workoutTitle: string;
  date: string; // YYYY-MM-DD
  time?: string;
  status: 'Scheduled' | 'Completed' | 'Missed' | 'In-Progress';
  durationMin?: number;
  rating?: number; // 1-5
  clientFeedback?: string;
  coachFeedback?: string;
  totalVolumeKg?: number;
  prCount?: number;
  exercises: WorkoutExerciseItem[];
}

export interface MetricEntry {
  id: string;
  clientId: string;
  date: string;
  weightKg: number;
  bodyFatPercentage?: number;
  chestCm?: number;
  waistCm?: number;
  armsCm?: number;
  thighsCm?: number;
  notes?: string;
}

export interface PersonalRecord {
  id: string;
  clientId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  estimated1RmKg: number;
  date: string;
  previousWeightKg?: number;
}

export interface HabitItem {
  id: string;
  title: string;
  targetValue: string;
  unit: string;
  iconName: string;
  category: 'Nutrition' | 'Recovery' | 'Activity' | 'Mindset';
}

export interface ClientDailyHabitLog {
  id: string;
  clientId: string;
  date: string; // YYYY-MM-DD
  habits: {
    habitId: string;
    title: string;
    completed: boolean;
    currentValue?: number | string;
    targetValue: string;
    unit: string;
  }[];
}

export interface ProgressPhoto {
  id: string;
  clientId: string;
  date: string;
  view: 'Front' | 'Side' | 'Back';
  photoUrl: string;
  weightKg: number;
  bodyFatPercentage?: number;
  notes?: string;
}

export interface ChatAttachment {
  type: 'workout_link' | 'video_form_check' | 'progress_photo' | 'audio_note';
  title: string;
  url?: string;
  workoutId?: string;
  durationSeconds?: number;
  feedbackGiven?: boolean;
}

export interface ChatMessage {
  id: string;
  clientId: string;
  sender: 'coach' | 'client';
  text: string;
  timestamp: string;
  isRead: boolean;
  attachment?: ChatAttachment;
}

export interface ActivityFeedItem {
  id: string;
  type: 'workout_completed' | 'pr_achieved' | 'check_in_submitted' | 'new_message' | 'streak_milestone';
  clientId: string;
  clientName: string;
  clientAvatar: string;
  title: string;
  description: string;
  timestamp: string;
  metadata?: {
    weightKg?: number;
    exerciseName?: string;
    compliance?: number;
  };
}
