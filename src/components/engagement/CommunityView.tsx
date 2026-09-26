import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Heart, MessageCircle, Pencil, Pin, Plus, Send, Trash2, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useEngagement } from '../../context/EngagementContext';
import { CommunityGroup, GroupPost } from '../../types';
import { clockTime, timeAgo } from '../../utils/dates';

/** Groups list + a group's feed and chat. Coaches also create groups and manage members. */
export const CommunityView: React.FC<{ initialGroupId?: string | null }> = ({ initialGroupId }) => {
  const { user } = useAuth();
  const { groups, loadGroup, deleteGroup } = useEngagement();
  const isCoach = user?.role === 'coach';
  const [groupId, setGroupId] = useState<string | null>(initialGroupId ?? null);
  const [editing, setEditing] = useState<CommunityGroup | 'new' | null>(null);
  const [view, setView] = useState<'feed' | 'chat'>('feed');

  const group = groups.find(g => g.id === groupId) ?? null;

  useEffect(() => {
    if (groupId) loadGroup(groupId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Desktop shows the first group by default.
  useEffect(() => {
    if (!groupId && groups.length && window.matchMedia('(min-width: 768px)').matches) setGroupId(groups[0].id);
  }, [groups, groupId]);

  return (
    <div className="md:h-[calc(100vh-140px)] flex rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden min-h-[70vh]">
      <aside className={`${group ? 'hidden md:flex' : 'flex'} w-full md:w-72 flex-col border-r border-slate-800 bg-slate-950/60 shrink-0`}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2"><Users className="h-4 w-4 text-emerald-400" /> Groups</h3>
          {isCoach && (
            <button onClick={() => setEditing('new')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold">
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          )}
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {groups.length === 0 && (
            <li className="p-5 text-sm text-slate-400">{isCoach ? 'Create a group for a challenge or cohort.' : "You're not in any groups yet."}</li>
          )}
          {groups.map(g => (
            <li key={g.id}>
              <button onClick={() => setGroupId(g.id)} className={`w-full text-left px-4 py-3 ${g.id === groupId ? 'bg-slate-800/80' : 'hover:bg-slate-900/60'}`}>
                <span className="block text-sm font-bold text-white truncate">{g.name}</span>
                <span className="block text-[11px] text-slate-400">{g.clientIds.length} member{g.clientIds.length === 1 ? '' : 's'}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {group && (
        <section className="flex-1 flex flex-col min-w-0">
          <header className="p-3 sm:p-4 border-b border-slate-800 flex items-center gap-2">
            <button onClick={() => setGroupId(null)} className="md:hidden p-1 text-slate-400" aria-label="Back to groups">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{group.name}</h3>
              {group.description && <p className="text-[11px] text-slate-400 truncate">{group.description}</p>}
            </div>
            <div className="grid grid-cols-2 rounded-xl bg-slate-950 border border-slate-800 p-0.5 text-xs">
              {(['feed', 'chat'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
                  className={`px-3 py-1 rounded-lg font-bold capitalize ${view === v ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'}`}>
                  {v}
                </button>
              ))}
            </div>
            {isCoach && (
              <>
                <button onClick={() => setEditing(group)} aria-label="Edit group" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={async () => { if (window.confirm(`Delete "${group.name}" and all its posts?`) && await deleteGroup(group.id)) setGroupId(null); }}
                  aria-label="Delete group"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </header>
          {view === 'feed' ? <GroupFeed groupId={group.id} /> : <GroupChat groupId={group.id} />}
        </section>
      )}

      {editing && <GroupEditor group={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={g => setGroupId(g.id)} />}
    </div>
  );
};

const GroupFeed: React.FC<{ groupId: string }> = ({ groupId }) => {
  const { postsByGroup, createPost } = useEngagement();
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const posts = postsByGroup[groupId];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setPosting(true);
    if (await createPost(groupId, draft.trim())) setDraft('');
    setPosting(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <form onSubmit={submit} className="rounded-2xl bg-slate-950 border border-slate-800 p-3 space-y-2">
        <textarea
          rows={2}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Share a win, a question or an update…"
          aria-label="New post"
          className="w-full bg-transparent text-sm text-white placeholder-slate-500 resize-none focus:outline-none"
        />
        <div className="flex justify-end">
          <button type="submit" disabled={!draft.trim() || posting} className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold">
            Post
          </button>
        </div>
      </form>
      {!posts && <p className="text-sm text-slate-400">Loading…</p>}
      {posts?.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No posts yet. Start the conversation.</p>}
      {posts?.map(p => <PostCard key={p.id} post={p} />)}
    </div>
  );
};

const PostCard: React.FC<{ post: GroupPost }> = ({ post }) => {
  const { user } = useAuth();
  const { toggleLike, togglePin, deletePost, addComment, deleteComment } = useEngagement();
  const [showComments, setShowComments] = useState(post.comments.length > 0 && post.comments.length <= 3);
  const [comment, setComment] = useState('');
  const isCoach = user?.role === 'coach';
  const canDelete = isCoach || post.authorUserId === user?.id;

  return (
    <article className={`rounded-2xl border p-4 space-y-2 ${post.pinned ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800 bg-slate-950/40'}`}>
      <header className="flex items-center gap-2">
        <span className="text-sm font-bold text-white">{post.authorName}</span>
        {post.authorRole === 'coach' && <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-bold">Coach</span>}
        {post.pinned && <Pin className="h-3.5 w-3.5 text-emerald-400" aria-label="Pinned" />}
        <span className="ml-auto text-[11px] text-slate-400">{timeAgo(post.createdAt)}</span>
      </header>
      <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{post.body}</p>
      <div className="flex items-center gap-1 pt-1">
        <button onClick={() => toggleLike(post)} aria-pressed={post.likedByMe} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${post.likedByMe ? 'text-red-400' : 'text-slate-400 hover:text-white'}`}>
          <Heart className={`h-4 w-4 ${post.likedByMe ? 'fill-current' : ''}`} /> {post.likeCount || ''}
        </button>
        <button onClick={() => setShowComments(s => !s)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white">
          <MessageCircle className="h-4 w-4" /> {post.comments.length || ''}
        </button>
        {isCoach && (
          <button onClick={() => togglePin(post)} className="px-2 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white">
            {post.pinned ? 'Unpin' : 'Pin'}
          </button>
        )}
        {canDelete && (
          <button onClick={() => window.confirm('Delete this post?') && deletePost(post)} aria-label="Delete post" className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {showComments && (
        <div className="space-y-2 pt-1 border-t border-slate-800">
          {post.comments.map(c => (
            <div key={c.id} className="flex items-start gap-2 pt-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs">
                  <span className="font-bold text-white">{c.authorName}</span>
                  {c.authorRole === 'coach' && <span className="ml-1 text-[10px] font-bold text-emerald-400">Coach</span>}
                  <span className="ml-2 text-slate-400">{timeAgo(c.createdAt)}</span>
                </p>
                <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
              {(isCoach || c.authorUserId === user?.id) && (
                <button onClick={() => deleteComment(post, c.id)} aria-label="Delete comment" className="p-1 text-slate-400 hover:text-red-400">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <form
            onSubmit={async e => {
              e.preventDefault();
              if (comment.trim() && await addComment(post, comment.trim())) setComment('');
            }}
            className="flex gap-2 pt-1"
          >
            <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Write a comment…" aria-label="Comment"
              className="flex-1 h-8 px-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500" />
            <button type="submit" disabled={!comment.trim()} className="px-3 rounded-lg bg-slate-800 text-xs font-bold text-slate-100 disabled:opacity-40">Reply</button>
          </form>
        </div>
      )}
    </article>
  );
};

const GroupChat: React.FC<{ groupId: string }> = ({ groupId }) => {
  const { user } = useAuth();
  const { messagesByGroup, sendGroupMessage } = useEngagement();
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const messages = messagesByGroup[groupId] ?? [];

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {messages.length === 0 && <p className="text-center text-xs text-slate-400 py-10">No messages yet.</p>}
        {messages.map(m => {
          const mine = m.authorUserId === user?.id;
          return (
            <div key={m.id} className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${mine ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
              {!mine && (
                <span className="text-[11px] font-semibold text-slate-400 mb-0.5">
                  {m.authorName}{m.authorRole === 'coach' && <span className="ml-1 text-emerald-400">Coach</span>}
                </span>
              )}
              <div className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${mine ? 'bg-emerald-500 text-slate-950 rounded-br-md' : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-md'}`}>
                {m.text}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5">{clockTime(m.createdAt)}</span>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form
        onSubmit={async e => {
          e.preventDefault();
          if (draft.trim() && await sendGroupMessage(groupId, draft.trim())) setDraft('');
        }}
        className="p-3 border-t border-slate-800 flex gap-2 bg-slate-950"
      >
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message the group…" aria-label="Group message"
          className="flex-1 h-10 px-4 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500" />
        <button type="submit" disabled={!draft.trim()} aria-label="Send" className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

const GroupEditor: React.FC<{ group: CommunityGroup | null; onClose: () => void; onSaved: (g: CommunityGroup) => void }> = ({ group, onClose, onSaved }) => {
  const { clients } = useApp();
  const { saveGroup } = useEngagement();
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [members, setMembers] = useState<string[]>(group?.clientIds ?? []);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const saved = await saveGroup({ name: name.trim(), description, clientIds: members }, group?.id);
    setSaving(false);
    if (saved) {
      onSaved(saved);
      onClose();
    }
  };

  const field = 'w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-label={group ? 'Edit group' : 'New group'} onSubmit={submit} onClick={e => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-800">
        <div className="p-5 space-y-3 overflow-y-auto">
          <h3 className="text-sm font-bold text-white">{group ? 'Edit group' : 'New group'}</h3>
          <label className="block text-xs font-semibold text-slate-300">Name
            <input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 12-Week Challenge" className={`${field} mt-1`} />
          </label>
          <label className="block text-xs font-semibold text-slate-300">Description
            <input value={description} onChange={e => setDescription(e.target.value)} className={`${field} mt-1`} />
          </label>
          <fieldset>
            <legend className="text-xs font-semibold text-slate-300 mb-1.5">Members ({members.length})</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {clients.map(c => (
                <label key={c.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white min-w-0">
                  <input type="checkbox" className="accent-emerald-500" checked={members.includes(c.id)}
                    onChange={e => setMembers(m => (e.target.checked ? [...m, c.id] : m.filter(x => x !== c.id)))} />
                  <span className="truncate">{c.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="p-4 border-t border-slate-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={saving || !name.trim()} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-sm font-bold">
            {saving ? 'Saving…' : 'Save group'}
          </button>
        </div>
      </form>
    </div>
  );
};
