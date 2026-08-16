import React, { useState } from 'react';
import { 
  X, 
  User, 
  Dumbbell, 
  Calendar, 
  AlertTriangle, 
  FileText, 
  TrendingUp, 
  MessageSquare, 
  CheckCircle2, 
  Plus, 
  ShieldAlert, 
  Activity, 
  Award, 
  Phone, 
  Mail, 
  Target
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Client } from '../../types';

interface ClientProfileModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
}

export const ClientProfileModal: React.FC<ClientProfileModalProps> = ({ client, isOpen, onClose }) => {
  const { 
    updateClient, 
    addCoachNote, 
    programs, 
    assignProgramToClient, 
    scheduledWorkouts, 
    metrics, 
    personalRecords,
    setActiveTab,
    setSelectedClientId,
    openWorkoutLogger
  } = useApp();

  const [activeTab, setActiveModalTab] = useState<'overview' | 'health' | 'notes' | 'program' | 'metrics'>('overview');
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedProgramToAssign, setSelectedProgramToAssign] = useState<string>(client.currentProgramId || '');
  const [editStatus, setEditStatus] = useState(client.status);

  if (!isOpen) return null;

  const clientWorkouts = scheduledWorkouts.filter(w => w.clientId === client.id);
  const clientMetrics = metrics.filter(m => m.clientId === client.id);
  const clientPRs = personalRecords.filter(pr => pr.clientId === client.id);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    addCoachNote(client.id, newNoteText.trim());
    setNewNoteText('');
  };

  const handleAssignProgram = () => {
    if (!selectedProgramToAssign) return;
    assignProgramToClient(selectedProgramToAssign, client.id);
  };

  const handleStatusChange = (newStatus: Client['status']) => {
    setEditStatus(newStatus);
    updateClient(client.id, { status: newStatus });
  };

  const weightDelta = (client.currentWeightKg - client.startingWeightKg).toFixed(1);
  const isWeightDown = Number(weightDelta) < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header with Athlete Profile Banner */}
        <div className="relative p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 border-b border-slate-800">
          <button 
            id="close-client-profile-btn"
            onClick={onClose}
            className="absolute top-5 right-5 h-8 w-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img 
                src={client.avatar} 
                alt={client.name} 
                className="h-16 w-16 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-lg"
              />
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-extrabold text-white tracking-tight">{client.name}</h2>
                  {/* Status selector */}
                  <select
                    value={editStatus}
                    onChange={(e) => handleStatusChange(e.target.value as Client['status'])}
                    className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 focus:outline-hidden cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Needs Check-in">Needs Check-in</option>
                    <option value="Onboarding">Onboarding</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                  <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-slate-400" /> {client.email}</span>
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-400" /> {client.phone}</span>
                  <span>Age {client.age} • {client.gender}</span>
                </div>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedClientId(client.id);
                  setActiveTab('messenger');
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                <span>Message</span>
              </button>

              <button
                onClick={() => {
                  setSelectedClientId(client.id);
                  setActiveTab('progress');
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Metrics</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Current Goal</span>
              <div className="font-bold text-emerald-400 text-sm truncate">{client.goal}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Weight Progress</span>
              <div className="font-bold text-white text-sm">
                {client.currentWeightKg} kg <span className={`text-xs ${isWeightDown ? 'text-emerald-400' : 'text-cyan-400'}`}>({isWeightDown ? '' : '+'}{weightDelta} kg)</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Compliance</span>
              <div className="font-bold text-emerald-400 text-sm">{client.complianceRate}% adherence</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400">Body Fat</span>
              <div className="font-bold text-white text-sm">{client.bodyFatPercentage}% <span className="text-slate-400 text-xs">(Goal: {client.targetBodyFat}%)</span></div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveModalTab('overview')}
            className={`py-3 px-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview & Survey
          </button>
          <button
            onClick={() => setActiveModalTab('health')}
            className={`py-3 px-3 border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'health' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            Injuries & Health ({client.injuriesAndHealth.length})
          </button>
          <button
            onClick={() => setActiveModalTab('program')}
            className={`py-3 px-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'program' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Program & Workouts ({clientWorkouts.length})
          </button>
          <button
            onClick={() => setActiveModalTab('notes')}
            className={`py-3 px-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'notes' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Coach Notes ({client.customCoachNotes.length})
          </button>
          <button
            onClick={() => setActiveModalTab('metrics')}
            className={`py-3 px-3 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'metrics' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            PRs & History
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Tab: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Current Active Program Card */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Training Program</span>
                  <h4 className="text-sm font-bold text-white mt-0.5">{client.currentProgramName || 'No program assigned currently'}</h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {client.workoutsCompleted} completed out of {client.totalWorkoutsAssigned} assigned workouts.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedProgramToAssign}
                    onChange={(e) => setSelectedProgramToAssign(e.target.value)}
                    className="h-8 px-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-hidden"
                  >
                    <option value="">Select template...</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignProgram}
                    className="h-8 px-3 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold hover:bg-emerald-500/30 transition-colors"
                  >
                    Assign
                  </button>
                </div>
              </div>

              {/* Onboarding Survey Card */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                  <FileText className="h-4 w-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Onboarding Intake Survey</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 font-semibold">Gym Access & Equipment:</span>
                    <p className="text-slate-200 mt-0.5">{client.onboardingSurvey.gymAccess}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Weekly Availability:</span>
                    <p className="text-slate-200 mt-0.5">{client.onboardingSurvey.weeklyAvailabilityDays} Days / Week</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Dietary Restrictions & Nutrition:</span>
                    <p className="text-slate-200 mt-0.5">{client.onboardingSurvey.dietaryRestrictions}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Average Sleep & Stress:</span>
                    <p className="text-slate-200 mt-0.5">{client.onboardingSurvey.sleepAvgHours} hrs/night • Stress: {client.onboardingSurvey.stressLevel}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Favorite Exercises:</span>
                    <p className="text-emerald-400 mt-0.5">{client.onboardingSurvey.favoriteExercises}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Least Favorite / Disliked:</span>
                    <p className="text-amber-400 mt-0.5">{client.onboardingSurvey.leastFavoriteExercises}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Injuries & Medical Alerts */}
          {activeTab === 'health' && (
            <div className="space-y-4">
              {client.medicalAlerts && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Coach Safety Alert</h4>
                    <p className="text-slate-200 mt-1">{client.medicalAlerts}</p>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Reported Health & Injury History</h4>
                {client.injuriesAndHealth.length === 0 ? (
                  <p className="text-slate-400">No injuries or health constraints reported.</p>
                ) : (
                  <div className="space-y-2">
                    {client.injuriesAndHealth.map((injury, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200">
                        <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                        <span>{injury}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Program & Workouts */}
          {activeTab === 'program' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Scheduled & Logged Sessions</h4>
                <button
                  onClick={() => {
                    setActiveTab('calendar');
                    onClose();
                  }}
                  className="text-xs font-bold text-emerald-400 hover:underline"
                >
                  Schedule in Calendar →
                </button>
              </div>

              <div className="space-y-2.5">
                {clientWorkouts.length === 0 ? (
                  <p className="text-slate-400 p-4 text-center">No workouts assigned yet. Assign a program from the Overview tab.</p>
                ) : (
                  clientWorkouts.map(w => (
                    <div key={w.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{w.workoutTitle}</div>
                        <div className="text-[11px] text-slate-400">{w.date} • {w.programName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          w.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {w.status}
                        </span>
                        <button
                          onClick={() => {
                            openWorkoutLogger(w);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
                        >
                          Open Log
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab: Notes */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <form onSubmit={handleAddNote} className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Add Private Coach Note</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Adjusted high-bar squat foot stance; client responded well..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-4 h-10 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors shrink-0"
                  >
                    Add Note
                  </button>
                </div>
              </form>

              <div className="space-y-2 pt-2">
                {client.customCoachNotes.map((note, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200">
                    <p className="leading-relaxed">{note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: PRs & History */}
          {activeTab === 'metrics' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">Personal Records (PRs)</h4>
                  </div>
                </div>

                {clientPRs.length === 0 ? (
                  <p className="text-slate-400">No PRs logged yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {clientPRs.map(pr => (
                      <div key={pr.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                        <div className="font-bold text-white">{pr.exerciseName}</div>
                        <div className="text-emerald-400 font-extrabold text-sm mt-0.5">
                          {pr.weightKg} kg × {pr.reps} reps
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                          <span>Est 1RM: {pr.estimated1RmKg} kg</span>
                          <span>{pr.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
