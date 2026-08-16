import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  MessageSquare, 
  TrendingUp, 
  Dumbbell, 
  ShieldAlert, 
  ChevronRight, 
  LayoutGrid, 
  List, 
  Phone, 
  Mail, 
  CheckCircle2, 
  X, 
  Target
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Client, ClientStatus, FitnessGoal, ExperienceLevel } from '../../types';
import { ClientProfileModal } from './ClientProfileModal';

export const ClientRoster: React.FC<{
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
  onOpenAddModal: () => void;
}> = ({ isAddModalOpen, onCloseAddModal, onOpenAddModal }) => {
  const { 
    clients, 
    addClient, 
    selectedClientId, 
    setSelectedClientId, 
    setActiveTab 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [selectedGoalFilter, setSelectedGoalFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [viewingClientProfile, setViewingClientProfile] = useState<Client | null>(null);

  // New Client Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAge, setFormAge] = useState(28);
  const [formGender, setFormGender] = useState('Male');
  const [formStatus, setFormStatus] = useState<ClientStatus>('Active');
  const [formGoal, setFormGoal] = useState<FitnessGoal>('Hypertrophy');
  const [formExperience, setFormExperience] = useState<ExperienceLevel>('Intermediate');
  const [formWeight, setFormWeight] = useState(80);
  const [formTargetWeight, setFormTargetWeight] = useState(78);
  const [formHeight, setFormHeight] = useState(178);
  const [formBodyFat, setFormBodyFat] = useState(16);
  const [formTargetBodyFat, setFormTargetBodyFat] = useState(12);
  const [formInjuries, setFormInjuries] = useState('');
  const [formMedicalAlerts, setFormMedicalAlerts] = useState('');
  const [formGymAccess, setFormGymAccess] = useState('Full Commercial Gym');
  const [formWeeklyDays, setFormWeeklyDays] = useState(4);
  const [formDietary, setFormDietary] = useState('High protein, balanced');

  // Filter clients
  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.goal.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatusFilter === 'All' || c.status === selectedStatusFilter;
    const matchesGoal = selectedGoalFilter === 'All' || c.goal === selectedGoalFilter;
    return matchesSearch && matchesStatus && matchesGoal;
  });

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) return;

    const avatars = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80'
    ];
    const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];

    addClient({
      name: formName.trim(),
      email: formEmail.trim(),
      phone: formPhone.trim() || '+1 (555) 000-1234',
      avatar: randomAvatar,
      age: Number(formAge),
      gender: formGender,
      status: formStatus,
      goal: formGoal,
      experienceLevel: formExperience,
      startDate: new Date().toISOString().split('T')[0],
      startingWeightKg: Number(formWeight),
      currentWeightKg: Number(formWeight),
      targetWeightKg: Number(formTargetWeight),
      heightCm: Number(formHeight),
      bodyFatPercentage: Number(formBodyFat),
      targetBodyFat: Number(formTargetBodyFat),
      injuriesAndHealth: formInjuries.trim() ? formInjuries.split(',').map(s => s.trim()) : [],
      medicalAlerts: formMedicalAlerts.trim() || undefined,
      customCoachNotes: ['Initial onboarding assessment completed.'],
      onboardingSurvey: {
        gymAccess: formGymAccess,
        weeklyAvailabilityDays: Number(formWeeklyDays),
        dietaryRestrictions: formDietary,
        sleepAvgHours: 7.5,
        stressLevel: 'Moderate',
        favoriteExercises: 'Compound movements',
        leastFavoriteExercises: 'None reported'
      }
    });

    onCloseAddModal();
  };

  const getStatusBadge = (status: ClientStatus) => {
    switch (status) {
      case 'Active':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">● Active</span>;
      case 'Needs Check-in':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">● Check-in Due</span>;
      case 'Onboarding':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">● Onboarding</span>;
      case 'Inactive':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">● Inactive</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner with Summary & Add Client CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-400" />
            Athlete Roster & CRM ({clients.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage your personal training roster, intake data, program adherence, and coach notes.
          </p>
        </div>

        <button
          id="open-add-client-modal-btn"
          onClick={onOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
          <span>+ Onboard New Athlete</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="client-roster-search-input"
            type="text"
            placeholder="Search by athlete name, email, or goal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {['All', 'Active', 'Needs Check-in', 'Onboarding', 'Inactive'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                selectedStatusFilter === status
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-end md:self-auto">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg text-xs ${viewMode === 'table' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
            title="Table View"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg text-xs ${viewMode === 'grid' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
            title="Grid View"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Clients Display: Table View */}
      {viewMode === 'table' ? (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Athlete</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Goal & Split</th>
                  <th className="py-3.5 px-4">Weight / Delta</th>
                  <th className="py-3.5 px-4">Compliance</th>
                  <th className="py-3.5 px-4">Health Alerts</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No athletes found matching the filters.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    const weightDiff = (client.currentWeightKg - client.startingWeightKg).toFixed(1);

                    return (
                      <tr 
                        key={client.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => setViewingClientProfile(client)}
                      >
                        {/* Athlete Column */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img 
                              src={client.avatar} 
                              alt={client.name} 
                              className="h-10 w-10 rounded-xl object-cover border border-slate-700" 
                            />
                            <div>
                              <div className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                                {client.name}
                              </div>
                              <div className="text-[11px] text-slate-400">{client.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {getStatusBadge(client.status)}
                        </td>

                        {/* Goal & Program */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-200">{client.goal}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                            {client.currentProgramName || 'No program assigned'}
                          </div>
                        </td>

                        {/* Weight */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white">{client.currentWeightKg} kg</div>
                          <div className="text-[10px] text-slate-400">
                            {Number(weightDiff) < 0 ? (
                              <span className="text-emerald-400">{weightDiff} kg</span>
                            ) : (
                              <span className="text-cyan-400">+{weightDiff} kg</span>
                            )}{' '}
                            (Goal: {client.targetWeightKg}kg)
                          </div>
                        </td>

                        {/* Compliance Bar */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full" 
                                style={{ width: `${client.complianceRate}%` }}
                              />
                            </div>
                            <span className="font-bold text-emerald-400">{client.complianceRate}%</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {client.workoutsCompleted} / {client.totalWorkoutsAssigned} done
                          </div>
                        </td>

                        {/* Health alerts */}
                        <td className="py-3.5 px-4">
                          {client.injuriesAndHealth.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                              <ShieldAlert className="h-3 w-3" />
                              {client.injuriesAndHealth.length} condition
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Clear</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedClientId(client.id);
                                setActiveTab('messenger');
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                              title="Chat with client"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedClientId(client.id);
                                setActiveTab('progress');
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                              title="View Progress & PRs"
                            >
                              <TrendingUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setViewingClientProfile(client)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                            >
                              Profile
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              onClick={() => setViewingClientProfile(client)}
              className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img 
                      src={client.avatar} 
                      alt={client.name} 
                      className="h-12 w-12 rounded-2xl object-cover border border-slate-700" 
                    />
                    <div>
                      <h3 className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                        {client.name}
                      </h3>
                      <div className="text-[11px] text-slate-400">{client.email}</div>
                    </div>
                  </div>
                  {getStatusBadge(client.status)}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Goal</span>
                    <div className="font-bold text-emerald-400 truncate mt-0.5">{client.goal}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Compliance</span>
                    <div className="font-bold text-white truncate mt-0.5">{client.complianceRate}%</div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-300">
                  <span className="text-slate-400">Current Program: </span>
                  <span className="font-medium text-slate-200">{client.currentProgramName || 'Not assigned'}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Last active: {client.lastActive}</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  View Profile <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Client Profile Modal Drawer */}
      {viewingClientProfile && (
        <ClientProfileModal
          client={viewingClientProfile}
          isOpen={true}
          onClose={() => setViewingClientProfile(null)}
        />
      )}

      {/* Onboard New Client Modal Form */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-400" />
                  Onboard New Athlete
                </h3>
                <p className="text-xs text-slate-400">Enter client demographics, health intake, and training goals.</p>
              </div>
              <button onClick={onCloseAddModal} className="text-slate-400 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Marcus Vance"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. athlete@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Age</label>
                  <input
                    type="number"
                    value={formAge}
                    onChange={(e) => setFormAge(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Gender</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Fitness Goal</label>
                  <select
                    value={formGoal}
                    onChange={(e) => setFormGoal(e.target.value as FitnessGoal)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  >
                    <option value="Hypertrophy">Hypertrophy (Muscle Gain)</option>
                    <option value="Fat Loss">Fat Loss & Recomposition</option>
                    <option value="Strength & Power">Strength & Powerlifting</option>
                    <option value="Athletic Conditioning">Athletic Conditioning</option>
                    <option value="Rehabilitation">Rehabilitation & Recovery</option>
                    <option value="Endurance">Endurance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Experience Level</label>
                  <select
                    value={formExperience}
                    onChange={(e) => setFormExperience(e.target.value as ExperienceLevel)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  >
                    <option value="Beginner">Beginner (&lt;1 year)</option>
                    <option value="Intermediate">Intermediate (1-3 years)</option>
                    <option value="Advanced">Advanced (3-6 years)</option>
                    <option value="Elite Athlete">Elite Athlete (6+ years)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Current Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formWeight}
                    onChange={(e) => setFormWeight(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Target Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formTargetWeight}
                    onChange={(e) => setFormTargetWeight(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={formHeight}
                    onChange={(e) => setFormHeight(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">Body Fat %</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formBodyFat}
                    onChange={(e) => setFormBodyFat(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Injuries & Health Constraints (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mild right rotator cuff strain, tight hip flexors"
                  value={formInjuries}
                  onChange={(e) => setFormInjuries(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[10px] mb-1">
                  Coach Medical Alert / Safety Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Limit barbell axial loading; emphasize dumbbell presses"
                  value={formMedicalAlerts}
                  onChange={(e) => setFormMedicalAlerts(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCloseAddModal}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold hover:from-emerald-400 hover:to-teal-400 shadow-md shadow-emerald-500/20 transition-all"
                >
                  Save Athlete Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
