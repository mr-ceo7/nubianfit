import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  Paperclip, 
  Play, 
  Pause, 
  Dumbbell, 
  CheckCheck, 
  Search, 
  Phone, 
  Video, 
  Zap, 
  Mic, 
  User, 
  ExternalLink,
  Plus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ChatMessage, Client } from '../../types';

export const CoachMessenger: React.FC = () => {
  const { 
    clients, 
    selectedClientId, 
    setSelectedClientId, 
    messages, 
    sendMessage,
    openWorkoutLogger,
    scheduledWorkouts,
    setActiveTab
  } = useApp();

  const [inputMessage, setInputMessage] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  // Active client conversation
  const activeClient = clients.find(c => c.id === selectedClientId) || clients[0];
  const activeMessages = messages.filter(m => m.clientId === activeClient?.id);

  const quickSnippets = [
    "Great depth on those squats! Keep your chest proud throughout the eccentric.",
    "Remember to hit your 180g protein target today!",
    "Your weekly progress check-in is reviewed and looking on point. Keep it up!",
    "Let me know how the fatigue levels feel after today's heavy bench sets."
  ];

  const handleSendText = (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || !activeClient) return;

    sendMessage({
      clientId: activeClient.id,
      sender: 'coach',
      messageType: 'text',
      content: text.trim()
    });

    setInputMessage('');
    setShowAttachmentMenu(false);
  };

  const handleSendWorkoutAttachment = () => {
    if (!activeClient) return;
    sendMessage({
      clientId: activeClient.id,
      sender: 'coach',
      messageType: 'workout_assignment',
      content: `I've updated your next training session: Day 1 - Upper Body Hypertrophy. Focus on controlled eccentric tempo!`,
      attachmentData: {
        title: 'Day 1: Upper Body Hypertrophy Split',
        workoutId: 'w-1',
        dayNumber: 1
      }
    });
    setShowAttachmentMenu(false);
  };

  const handleSendFormCheckReview = () => {
    if (!activeClient) return;
    sendMessage({
      clientId: activeClient.id,
      sender: 'coach',
      messageType: 'form_check',
      content: `Form analysis completed for your Barbell Squat set (140kg x 5): Notice how your hips rise slightly before your chest on rep 4. Focus on simultaneous knee and hip drive!`,
      attachmentData: {
        exerciseName: 'Barbell Back Squat (140kg)',
        videoUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format&fit=crop&q=80',
        rating: 4.5
      }
    });
    setShowAttachmentMenu(false);
  };

  // Filter clients by search
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.goal.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-2xl">
      {/* Left Sidebar: Conversations List */}
      <div className="w-full md:w-80 border-r border-slate-800 flex flex-col bg-slate-950/60 shrink-0">
        {/* Header & Search */}
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-400" />
              Athlete Chats
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
              {clients.length} Active
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Client chat list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {filteredClients.map((client) => {
            const isSelected = client.id === activeClient?.id;
            const clientMsgList = messages.filter(m => m.clientId === client.id);
            const lastMsg = clientMsgList[clientMsgList.length - 1];

            return (
              <div
                key={client.id}
                onClick={() => setSelectedClientId(client.id)}
                className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-slate-800/80 border-l-4 border-emerald-500' : 'hover:bg-slate-900/60'
                }`}
              >
                <div className="relative shrink-0">
                  <img src={client.avatar} alt={client.name} className="h-10 w-10 rounded-xl object-cover" />
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 ${
                    client.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
                      {client.name}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {lastMsg ? lastMsg.timestamp.split('T')[1]?.substring(0, 5) || '10:30' : '10:30'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {lastMsg ? lastMsg.content : `Goal: ${client.goal}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Stream Container */}
      {activeClient ? (
        <div className="flex-1 flex flex-col bg-slate-900/50 min-w-0">
          {/* Active Chat Header */}
          <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src={activeClient.avatar} 
                alt={activeClient.name} 
                className="h-10 w-10 rounded-xl object-cover border border-slate-700" 
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">{activeClient.name}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {activeClient.goal}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Program: <strong className="text-slate-300">{activeClient.currentProgramName || 'Hypertrophy'}</strong> • Compliance: {activeClient.complianceRate}%
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('progress')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                View Metrics
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
            {activeMessages.map((msg) => {
              const isCoach = msg.sender === 'coach';

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-[85%] sm:max-w-[75%] ${
                    isCoach ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  }`}
                >
                  <img
                    src={isCoach 
                      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                      : activeClient.avatar
                    }
                    alt={isCoach ? 'Coach' : activeClient.name}
                    className="h-8 w-8 rounded-xl object-cover shrink-0 self-end"
                  />

                  <div className={`space-y-2 ${isCoach ? 'items-end' : 'items-start'}`}>
                    {/* Standard Text Message Bubble */}
                    <div className={`p-3.5 rounded-2xl ${
                      isCoach 
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-none shadow-md shadow-emerald-950/20'
                        : 'bg-slate-800/90 text-slate-100 rounded-bl-none border border-slate-700'
                    }`}>
                      <p className="leading-relaxed text-xs">{msg.content}</p>

                      {/* Workout Assignment Card Attachment */}
                      {msg.messageType === 'workout_assignment' && msg.attachmentData && (
                        <div className="mt-2.5 p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                          <div className="flex items-center gap-2 text-emerald-300 font-bold">
                            <Dumbbell className="h-4 w-4" />
                            <span>{msg.attachmentData.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-300">Tap below to view full workout structure & log sets.</p>
                          <button
                            onClick={() => setActiveTab('calendar')}
                            className="w-full py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-[11px] hover:bg-emerald-400 transition-colors flex items-center justify-center gap-1"
                          >
                            <span>Open in Calendar</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {/* Form Check Review Attachment Card */}
                      {msg.messageType === 'form_check' && msg.attachmentData && (
                        <div className="mt-2.5 p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                          <div className="relative h-32 rounded-lg overflow-hidden bg-slate-950">
                            <img
                              src={msg.attachmentData.videoUrl}
                              alt="Form Check Video Preview"
                              className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <div className="h-10 w-10 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg">
                                <Play className="h-4 w-4 ml-0.5 fill-current" />
                              </div>
                            </div>
                            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[9px] font-bold text-white">
                              {msg.attachmentData.exerciseName}
                            </span>
                          </div>
                          <div className="text-[10px] text-emerald-300 font-bold">
                            Coach Technique Rating: ★★★★☆ (4.5/5)
                          </div>
                        </div>
                      )}

                      {/* Voice Note Audio Bubble Simulator */}
                      {msg.messageType === 'audio' && (
                        <div className="mt-2 flex items-center gap-3 p-2 rounded-xl bg-black/30">
                          <button
                            onClick={() => setIsPlayingAudio(isPlayingAudio === msg.id ? null : msg.id)}
                            className="h-8 w-8 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0"
                          >
                            {isPlayingAudio === msg.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5 fill-current" />}
                          </button>
                          <div className="flex-1 flex items-center gap-1 h-6">
                            {[12, 24, 18, 28, 14, 20, 32, 16, 26, 12, 18, 22, 10].map((h, i) => (
                              <div
                                key={i}
                                className={`w-1 rounded-full ${
                                  isPlayingAudio === msg.id ? 'bg-emerald-300 animate-pulse' : 'bg-slate-400'
                                }`}
                                style={{ height: `${h}px` }}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] font-mono text-slate-300">0:42</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span>{msg.timestamp.split('T')[1]?.substring(0, 5) || '10:30'}</span>
                      {isCoach && <CheckCheck className="h-3 w-3 text-emerald-400" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Coach Snippets Bar */}
          <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0 flex items-center gap-1">
              <Zap className="h-3 w-3 text-emerald-400" />
              Quick Cues:
            </span>
            {quickSnippets.map((snippet, idx) => (
              <button
                key={idx}
                onClick={() => handleSendText(snippet)}
                className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 whitespace-nowrap transition-colors truncate max-w-xs"
              >
                {snippet}
              </button>
            ))}
          </div>

          {/* Message Input Box & Attachments */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 relative">
            {/* Attachment Menu Popup */}
            {showAttachmentMenu && (
              <div className="absolute bottom-16 left-4 p-2 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl space-y-1 text-xs animate-in slide-in-from-bottom-2">
                <button
                  onClick={handleSendWorkoutAttachment}
                  className="w-full px-3 py-2 rounded-xl text-left font-bold text-slate-200 hover:bg-slate-800 hover:text-emerald-400 flex items-center gap-2 transition-colors"
                >
                  <Dumbbell className="h-4 w-4 text-emerald-400" />
                  Attach Workout Split
                </button>
                <button
                  onClick={handleSendFormCheckReview}
                  className="w-full px-3 py-2 rounded-xl text-left font-bold text-slate-200 hover:bg-slate-800 hover:text-cyan-400 flex items-center gap-2 transition-colors"
                >
                  <Video className="h-4 w-4 text-cyan-400" />
                  Attach Form Check Video Review
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendText();
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className={`p-2.5 rounded-xl border transition-colors ${
                  showAttachmentMenu 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400' 
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Attach Program or Video Review"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <input
                type="text"
                placeholder={`Message ${activeClient.name}...`}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 h-10 px-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
              />

              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
              >
                <span>Send</span>
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
          Select an athlete on the left to start messaging.
        </div>
      )}
    </div>
  );
};
