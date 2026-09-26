import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Dumbbell, 
  BookOpen, 
  CalendarDays, 
  TrendingUp, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  ListChecks,
  Apple,
  UsersRound,
  ClipboardCheck,
  Sparkles,
  Wallet,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEngagement } from '../../context/EngagementContext';
import { ClientAvatar } from '../common/ClientAvatar';
import { localDateStr } from '../../utils/dates';
import { useApp, NavigationTab } from '../../context/AppContext';
import { NubianFitLogo } from '../common/NubianFitLogo';


export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, clients, messages, scheduledWorkouts, setSelectedClientId } = useApp();
  const { user, logout } = useAuth();
  const { checkinResponses } = useEngagement();
  const unreviewedCheckins = checkinResponses.filter(r => !r.reviewedAt).length;
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Unread messages count
  const unreadCount = messages.filter(m => m.sender === 'client' && !m.isRead).length;

  // Today's pending workouts count
  const todayStr = localDateStr();
  const todayPendingCount = scheduledWorkouts.filter(w => w.date === todayStr && w.status === 'Scheduled').length;

  const navItems: { id: NavigationTab; label: string; icon: React.FC<{ className?: string }>; badge?: number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients & CRM', icon: Users, badge: clients.filter(c => c.status === 'Active').length },
    { id: 'programs', label: 'Program Builder', icon: Dumbbell },
    { id: 'workouts', label: 'Workout Library', icon: ListChecks },
    { id: 'exercises', label: 'Exercise Library', icon: BookOpen },
    { id: 'calendar', label: 'Schedule', icon: CalendarDays, badge: todayPendingCount > 0 ? todayPendingCount : undefined, badgeColor: 'bg-emerald-500' },
    { id: 'nutrition', label: 'Nutrition & Habits', icon: Apple },
    { id: 'progress', label: 'Metric Tracker', icon: TrendingUp },
    { id: 'messenger', label: '1-on-1 Messenger', icon: MessageSquare, badge: unreadCount > 0 ? unreadCount : undefined, badgeColor: 'bg-cyan-500' },
    { id: 'community', label: 'Community', icon: UsersRound },
    { id: 'checkins', label: 'Check-ins', icon: ClipboardCheck, badge: unreviewedCheckins > 0 ? unreviewedCheckins : undefined, badgeColor: 'bg-amber-500' },
    { id: 'autoflow', label: 'Autoflow', icon: Sparkles },
    { id: 'business', label: 'Business', icon: Wallet },
    ...(user?.isAdmin ? [{ id: 'admin' as NavigationTab, label: 'Platform admin', icon: ShieldCheck }] : [])
  ];

  return (
    <aside 
      id="sidebar-navigation"
      className={`relative hidden md:flex flex-col border-r border-slate-800 bg-slate-950 text-slate-200 transition-all duration-300 z-30 shrink-0 ${

        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between p-4 h-16 border-b border-slate-800/80">
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          {isCollapsed ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center font-logo text-lg lowercase">
              <span className="text-logo-nubian">n</span>
              <span className="text-logo-fit">f</span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="flex flex-col items-stretch">
                <span className="font-logo text-[17px] tracking-wide text-logo-nubian lowercase block leading-none">
                  nubian<span className="text-logo-fit">fit</span>
                </span>
                <div className="flex justify-between text-[8px] text-slate-400 font-bold tracking-normal lowercase mt-1.5 w-full leading-none">
                  <span>strength</span>
                  <span>and</span>
                  <span>strategy</span>
                </div>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 leading-none self-start mt-0.5">
                Coach
              </span>
            </div>


          )}
        </div>


        {/* Collapse Button */}
        <button 
          id="sidebar-toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        <div className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${isCollapsed ? 'text-center' : ''}`}>
          {isCollapsed ? '•' : 'Main Menu'}
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-link-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative ${
                isActive 
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-950/50' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <div className={`flex items-center justify-center ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                <Icon className="h-5 w-5 shrink-0" />
              </div>

              {!isCollapsed && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}

              {!isCollapsed && item.badge !== undefined && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  item.badgeColor || 'bg-slate-800 text-slate-100'
                } text-white shadow-xs`}>
                  {item.badge}
                </span>
              )}

              {/* Collapsed Badge indicator */}
              {isCollapsed && item.badge !== undefined && (
                <span className={`absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full ${
                  item.badgeColor || 'bg-emerald-500'
                } ring-2 ring-slate-950`} />
              )}

            </button>
          );
        })}

        {/* Quick Client Jump List */}
        {!isCollapsed && (
          <div className="pt-6 pb-2">
            <div className="px-3 pb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Top Athletes
              </span>
              <button 
                onClick={() => setActiveTab('clients')}
                className="text-[11px] text-emerald-400 hover:underline font-medium"
              >
                View all
              </button>
            </div>
            <div className="space-y-1">
              {clients.slice(0, 3).map(client => (
                <div 
                  key={client.id}
                  onClick={() => {
                    setSelectedClientId(client.id);
                    setActiveTab('clients');
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs hover:bg-slate-800/60 cursor-pointer text-slate-300 hover:text-white transition-colors"
                >
                  <ClientAvatar client={client} className="h-6 w-6 rounded-full" />
                  <span className="truncate flex-1 font-medium">{client.name}</span>
                  <span className="text-[10px] text-emerald-400 font-bold">{client.complianceRate}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Coach Profile Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/60">
        <div className="flex items-center gap-3">
          <ClientAvatar client={{ name: user?.fullName ?? 'Coach', avatar: user?.avatar }} className="h-10 w-10 rounded-xl" />
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-white truncate">{user?.fullName}</span>
              <span className="text-[11px] text-slate-400 truncate">{user?.email}</span>
            </div>
          )}
          {!isCollapsed && (
            <button onClick={logout} title="Sign out" aria-label="Sign out" className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
