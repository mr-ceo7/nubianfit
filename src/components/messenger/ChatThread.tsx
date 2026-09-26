import React, { useEffect, useRef, useState } from 'react';
import { CheckCheck, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ChatMessage } from '../../types';
import { clockTime } from '../../utils/dates';

interface ChatThreadProps {
  clientId: string;
  /** Which side of the conversation the viewer is on. */
  viewer: 'coach' | 'client';
  placeholder: string;
  quickReplies?: string[];
}

/** One coach↔client conversation: message list plus composer. Marks incoming messages read. */
export const ChatThread: React.FC<ChatThreadProps> = ({ clientId, viewer, placeholder, quickReplies = [] }) => {
  const { messages, sendMessage, markThreadRead } = useApp();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const thread = messages.filter(m => m.clientId === clientId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
    markThreadRead(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, thread.length]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const ok = await sendMessage(clientId, trimmed);
    setSending(false);
    if (ok) setDraft('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {thread.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-10">No messages yet. Say hello 👋</p>
        )}
        {thread.map(msg => (
          <Bubble key={msg.id} message={msg} mine={msg.sender === viewer} />
        ))}
        <div ref={bottomRef} />
      </div>

      {quickReplies.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800 flex gap-2 overflow-x-auto">
          {quickReplies.map(reply => (
            <button
              key={reply}
              onClick={() => setDraft(reply)}
              className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 whitespace-nowrap max-w-xs truncate"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={e => { e.preventDefault(); send(draft); }}
        className="p-3 border-t border-slate-800 flex items-center gap-2 bg-slate-950"
      >
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={placeholder}
          aria-label="Message"
          className="flex-1 h-10 px-4 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-400 focus:outline-hidden focus:border-emerald-500"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim() || sending}
          className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5"
        >
          <span className="hidden sm:inline">Send</span>
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

const Bubble: React.FC<{ message: ChatMessage; mine: boolean }> = ({ message, mine }) => (
  <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${mine ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
    <div
      className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
        mine
          ? 'bg-emerald-500 text-slate-950 rounded-br-md'
          : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-md'
      }`}
    >
      {message.text}
    </div>
    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
      <span>{clockTime(message.createdAt)}</span>
      {mine && <CheckCheck className={`h-3 w-3 ${message.isRead ? 'text-emerald-400' : 'text-slate-500'}`} />}
    </div>
  </div>
);
