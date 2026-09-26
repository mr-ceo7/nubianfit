import React, { useState } from 'react';
import { ArrowLeft, MessageSquare, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ChatThread } from './ChatThread';
import { timeAgo } from '../../utils/dates';
import { ClientAvatar } from '../common/ClientAvatar';

const QUICK_REPLIES = [
  'Great session! Keep your chest proud through the eccentric.',
  'Remember to hit your protein target today.',
  'Your check-in looks on point. Keep it up!',
  "How are the fatigue levels after today's session?",
];

export const CoachMessenger: React.FC = () => {
  const { clients, messages, selectedClientId, setSelectedClientId, setActiveTab } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  // On phones the list and the thread are separate screens.
  const [showThreadOnMobile, setShowThreadOnMobile] = useState(false);

  const activeClient = clients.find(c => c.id === selectedClientId) || clients[0];

  const filteredClients = clients
    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .map(c => {
      const thread = messages.filter(m => m.clientId === c.id);
      return {
        client: c,
        last: thread[thread.length - 1],
        unread: thread.filter(m => m.sender === 'client' && !m.isRead).length,
      };
    });

  if (clients.length === 0) {
    return (
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-10 text-center">
        <MessageSquare className="h-8 w-8 text-slate-500 mx-auto" />
        <p className="mt-3 text-sm text-slate-300">Add your first client to start messaging.</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-170px)] md:h-[calc(100vh-140px)] flex rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden">
      {/* Conversation list */}
      <aside className={`${showThreadOnMobile ? 'hidden' : 'flex'} md:flex w-full md:w-80 flex-col border-r border-slate-800 bg-slate-950/60 shrink-0`}>
        <div className="p-4 border-b border-slate-800 space-y-3">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-400" />
            Client chats
          </h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-hidden"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {filteredClients.map(({ client, last, unread }) => (
            <button
              key={client.id}
              onClick={() => { setSelectedClientId(client.id); setShowThreadOnMobile(true); }}
              className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors ${
                client.id === activeClient?.id ? 'bg-slate-800/80' : 'hover:bg-slate-900/60'
              }`}
            >
              <ClientAvatar client={client} className="h-10 w-10 rounded-xl" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">{client.name}</span>
                  {last && <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(last.createdAt)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-[11px] text-slate-400 truncate">{last ? last.text : `Goal: ${client.goal}`}</p>
                  {unread > 0 && (
                    <span className="shrink-0 px-1.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold">{unread}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Active thread */}
      {activeClient && (
        <section className={`${showThreadOnMobile ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
          <header className="p-3 sm:p-4 bg-slate-950/90 border-b border-slate-800 flex items-center gap-3">
            <button onClick={() => setShowThreadOnMobile(false)} className="md:hidden p-1 text-slate-400" aria-label="Back to chats">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <ClientAvatar client={activeClient} className="h-9 w-9 rounded-xl" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-white truncate">{activeClient.name}</h3>
              <p className="text-[11px] text-slate-400 truncate">
                {activeClient.currentProgramName || 'No program assigned'} • {activeClient.complianceRate}% compliance
              </p>
            </div>
            <button
              onClick={() => setActiveTab('progress')}
              className="hidden sm:block px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold"
            >
              View progress
            </button>
          </header>
          <ChatThread
            clientId={activeClient.id}
            viewer="coach"
            placeholder={`Message ${activeClient.name}...`}
            quickReplies={QUICK_REPLIES}
          />
        </section>
      )}
    </div>
  );
};
