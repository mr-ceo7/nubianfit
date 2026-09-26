import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AppNotification, Autoflow, AutoflowAssignment, CheckinAnswer, CheckinAssignment, CheckinForm, CheckinResponse,
  CommunityGroup, GroupMessage, GroupPost,
} from '../types';
import { autoflowsApi, checkinsApi, communityApi, notificationsApi } from '../services/apiClient';
import { RealtimeConnection } from '../services/realtime';
import { currentPushSubscription, disablePush, enablePush, pushSupported } from '../utils/push';
import { useAuth } from './AuthContext';
import { useApp } from './AppContext';

type FormBody = Pick<CheckinForm, 'title' | 'description' | 'questions'>;
type FlowBody = Pick<Autoflow, 'title' | 'description' | 'steps'>;

interface EngagementContextType {
  // Notifications
  notifications: AppNotification[];
  unreadCount: number;
  markNotificationsRead: (ids?: string[]) => Promise<void>;
  connected: boolean;

  // Preferences
  pushAvailable: boolean;
  pushEnabled: boolean;
  setPushEnabled: (on: boolean) => Promise<void>;
  emailDigest: boolean;
  setEmailDigest: (on: boolean) => Promise<void>;

  // Community
  groups: CommunityGroup[];
  postsByGroup: Record<string, GroupPost[]>;
  messagesByGroup: Record<string, GroupMessage[]>;
  loadGroup: (groupId: string) => Promise<void>;
  saveGroup: (g: { name: string; description: string; clientIds: string[] }, id?: string) => Promise<CommunityGroup | null>;
  deleteGroup: (id: string) => Promise<boolean>;
  createPost: (groupId: string, body: string) => Promise<boolean>;
  deletePost: (post: GroupPost) => Promise<void>;
  toggleLike: (post: GroupPost) => Promise<void>;
  togglePin: (post: GroupPost) => Promise<void>;
  addComment: (post: GroupPost, body: string) => Promise<boolean>;
  deleteComment: (post: GroupPost, commentId: string) => Promise<void>;
  sendGroupMessage: (groupId: string, text: string) => Promise<boolean>;

  // Check-ins
  forms: CheckinForm[];
  checkinAssignments: CheckinAssignment[];
  checkinResponses: CheckinResponse[];
  saveForm: (f: FormBody, id?: string) => Promise<CheckinForm | null>;
  deleteForm: (id: string) => Promise<boolean>;
  assignForm: (body: { formId: string; clientId: string; frequency: 'once' | 'weekly'; startDate: string }) => Promise<boolean>;
  setAssignmentActive: (id: string, active: boolean) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;
  submitCheckin: (body: { assignmentId: string; dueDate: string; answers: Record<string, CheckinAnswer> }) => Promise<boolean>;
  reviewCheckin: (id: string, comment: string) => Promise<boolean>;
  uploadPhoto: (clientId: string, file: Blob) => Promise<{ id: string; url: string } | null>;

  // Autoflow (coach)
  autoflows: Autoflow[];
  autoflowAssignments: AutoflowAssignment[];
  saveAutoflow: (f: FlowBody, id?: string) => Promise<Autoflow | null>;
  deleteAutoflow: (id: string) => Promise<boolean>;
  assignAutoflow: (id: string, clientId: string, startDate: string) => Promise<boolean>;
  cancelAutoflow: (assignmentId: string) => Promise<void>;
}

const EngagementContext = createContext<EngagementContextType | undefined>(undefined);

export const EngagementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, user } = useAuth();
  const { showToast, reloadMessages } = useApp();
  const isCoach = user?.role === 'coach';

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [emailDigest, setEmailDigestState] = useState(true);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [postsByGroup, setPostsByGroup] = useState<Record<string, GroupPost[]>>({});
  const [messagesByGroup, setMessagesByGroup] = useState<Record<string, GroupMessage[]>>({});
  const [forms, setForms] = useState<CheckinForm[]>([]);
  const [checkinAssignments, setCheckinAssignments] = useState<CheckinAssignment[]>([]);
  const [checkinResponses, setCheckinResponses] = useState<CheckinResponse[]>([]);
  const [autoflows, setAutoflows] = useState<Autoflow[]>([]);
  const [autoflowAssignments, setAutoflowAssignments] = useState<AutoflowAssignment[]>([]);

  // Groups whose feed is open, so live "community" events know what to refresh.
  const loadedGroups = useRef(new Set<string>());

  const run = async <T,>(action: () => Promise<T>, success?: string): Promise<T | null> => {
    try {
      const result = await action();
      if (success) showToast(success);
      return result;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      return null;
    }
  };

  const loadNotifications = useCallback(async () => {
    try {
      const res = await notificationsApi.list();
      setNotifications(res.items);
      setUnreadCount(res.unreadCount);
    } catch {
      // retried on next reconnect
    }
  }, []);

  const loadCheckins = useCallback(async () => {
    const [f, a, r] = await Promise.all([checkinsApi.forms(), checkinsApi.assignments(), checkinsApi.responses()]);
    setForms(f);
    setCheckinAssignments(a);
    setCheckinResponses(r);
  }, []);

  const reset = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setGroups([]);
    setPostsByGroup({});
    setMessagesByGroup({});
    setForms([]);
    setCheckinAssignments([]);
    setCheckinResponses([]);
    setAutoflows([]);
    setAutoflowAssignments([]);
    loadedGroups.current.clear();
  }, []);

  const refreshPosts = useCallback(async (groupId: string) => {
    const posts = await communityApi.posts(groupId);
    setPostsByGroup(prev => ({ ...prev, [groupId]: posts }));
  }, []);

  // Initial load + live connection while signed in.
  useEffect(() => {
    if (status !== 'signed_in') {
      if (status === 'signed_out') reset();
      return;
    }
    let cancelled = false;
    (async () => {
      await loadNotifications();
      try {
        const loads: Promise<unknown>[] = [
          communityApi.groups().then(g => !cancelled && setGroups(g)),
          loadCheckins(),
          notificationsApi.preferences().then(p => !cancelled && setEmailDigestState(p.emailDigest)),
          currentPushSubscription().then(s => !cancelled && setPushOn(!!s)).catch(() => undefined),
        ];
        if (isCoach) {
          loads.push(autoflowsApi.list().then(f => !cancelled && setAutoflows(f)));
          loads.push(autoflowsApi.assignments().then(a => !cancelled && setAutoflowAssignments(a)));
        }
        await Promise.all(loads);
      } catch {
        // individual features show empty states
      }
    })();

    let firstConnect = true;
    const connection = new RealtimeConnection(
      {
        notification: data => {
          const n = data as AppNotification;
          setNotifications(prev => [n, ...prev.filter(x => x.id !== n.id)].slice(0, 100));
          setUnreadCount(c => c + 1);
          showToast(n.title);
          if (n.type === 'checkin_submitted' || n.type === 'checkin_reviewed' || n.type === 'checkin_due') loadCheckins().catch(() => undefined);
        },
        message: () => { reloadMessages(); },
        group_message: data => {
          const m = data as GroupMessage;
          setMessagesByGroup(prev => prev[m.groupId]
            ? { ...prev, [m.groupId]: [...prev[m.groupId].filter(x => x.id !== m.id), m] }
            : prev);
        },
        community: data => {
          const { groupId } = data as { groupId: string };
          if (loadedGroups.current.has(groupId)) refreshPosts(groupId).catch(() => undefined);
        },
      },
      () => {
        setConnected(true);
        // After a drop, catch up on anything missed while disconnected.
        if (!firstConnect) {
          loadNotifications();
          reloadMessages();
        }
        firstConnect = false;
      }
    );
    connection.connect();
    return () => {
      cancelled = true;
      connection.close();
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.id]);

  const loadGroup = async (groupId: string) => {
    loadedGroups.current.add(groupId);
    const [posts, msgs] = await Promise.all([communityApi.posts(groupId), communityApi.messages(groupId)]);
    setPostsByGroup(prev => ({ ...prev, [groupId]: posts }));
    setMessagesByGroup(prev => ({ ...prev, [groupId]: msgs }));
  };

  const replacePost = (post: GroupPost) =>
    setPostsByGroup(prev => ({ ...prev, [post.groupId]: (prev[post.groupId] ?? []).map(p => (p.id === post.id ? post : p)) }));

  const value: EngagementContextType = {
    notifications,
    unreadCount,
    connected,
    markNotificationsRead: async ids => {
      const now = new Date().toISOString();
      setNotifications(prev => prev.map(n => (!ids || ids.includes(n.id) ? { ...n, readAt: n.readAt ?? now } : n)));
      setUnreadCount(c => (ids ? Math.max(0, c - notifications.filter(n => ids.includes(n.id) && !n.readAt).length) : 0));
      await notificationsApi.markRead(ids).catch(() => undefined);
    },

    pushAvailable: pushSupported(),
    pushEnabled: pushOn,
    setPushEnabled: async on => {
      const ok = await run(async () => {
        if (on) await enablePush();
        else await disablePush();
        return true;
      }, on ? 'Push notifications turned on.' : 'Push notifications turned off.');
      if (ok) setPushOn(on);
    },
    emailDigest,
    setEmailDigest: async on => {
      const res = await run(() => notificationsApi.setPreferences({ emailDigest: on }));
      if (res) setEmailDigestState(res.emailDigest);
    },

    groups,
    postsByGroup,
    messagesByGroup,
    loadGroup,
    saveGroup: (g, id) =>
      run(async () => {
        const saved = id ? await communityApi.updateGroup(id, g) : await communityApi.createGroup(g);
        setGroups(prev => (id ? prev.map(x => (x.id === id ? saved : x)) : [...prev, saved]).sort((a, b) => a.name.localeCompare(b.name)));
        return saved;
      }, `Group "${g.name}" saved.`),
    deleteGroup: async id =>
      (await run(async () => {
        await communityApi.deleteGroup(id);
        setGroups(prev => prev.filter(g => g.id !== id));
        return true;
      }, 'Group deleted.')) !== null,
    createPost: async (groupId, body) =>
      (await run(async () => {
        const post = await communityApi.createPost(groupId, body);
        setPostsByGroup(prev => ({ ...prev, [groupId]: [post, ...(prev[groupId] ?? []).filter(p => p.id !== post.id)] }));
        return post;
      })) !== null,
    deletePost: async post => {
      await run(async () => {
        await communityApi.deletePost(post.id);
        setPostsByGroup(prev => ({ ...prev, [post.groupId]: (prev[post.groupId] ?? []).filter(p => p.id !== post.id) }));
      });
    },
    toggleLike: async post => {
      const updated = await run(() => communityApi.toggleLike(post.id));
      if (updated) replacePost(updated);
    },
    togglePin: async post => {
      const updated = await run(() => communityApi.togglePin(post.id));
      if (updated) await refreshPosts(post.groupId);
    },
    addComment: async (post, body) =>
      (await run(async () => {
        const c = await communityApi.comment(post.id, body);
        replacePost({ ...post, comments: [...post.comments, c] });
        return c;
      })) !== null,
    deleteComment: async (post, commentId) => {
      await run(async () => {
        await communityApi.deleteComment(commentId);
        replacePost({ ...post, comments: post.comments.filter(c => c.id !== commentId) });
      });
    },
    sendGroupMessage: async (groupId, text) =>
      (await run(async () => {
        const m = await communityApi.sendMessage(groupId, text);
        setMessagesByGroup(prev => ({ ...prev, [groupId]: [...(prev[groupId] ?? []).filter(x => x.id !== m.id), m] }));
        return m;
      })) !== null,

    forms,
    checkinAssignments,
    checkinResponses,
    saveForm: (f, id) =>
      run(async () => {
        const saved = id ? await checkinsApi.updateForm(id, f) : await checkinsApi.createForm(f);
        setForms(prev => (id ? prev.map(x => (x.id === id ? saved : x)) : [...prev, saved]));
        return saved;
      }, `Form "${f.title}" saved.`),
    deleteForm: async id =>
      (await run(async () => {
        await checkinsApi.deleteForm(id);
        setForms(prev => prev.filter(f => f.id !== id));
        setCheckinAssignments(prev => prev.filter(a => a.formId !== id));
        return true;
      }, 'Form deleted.')) !== null,
    assignForm: async body =>
      (await run(async () => {
        const a = await checkinsApi.assign(body);
        setCheckinAssignments(prev => [...prev, a]);
        return a;
      }, 'Check-in scheduled.')) !== null,
    setAssignmentActive: async (id, active) => {
      const a = await run(() => checkinsApi.setActive(id, active));
      if (a) setCheckinAssignments(prev => prev.map(x => (x.id === id ? a : x)));
    },
    deleteAssignment: async id => {
      const ok = await run(() => checkinsApi.deleteAssignment(id), 'Check-in schedule removed.');
      if (ok) setCheckinAssignments(prev => prev.filter(a => a.id !== id));
    },
    submitCheckin: async body =>
      (await run(async () => {
        const r = await checkinsApi.submit(body);
        setCheckinResponses(prev => [r, ...prev]);
        setCheckinAssignments(await checkinsApi.assignments());
        return r;
      }, 'Check-in sent to your coach.')) !== null,
    reviewCheckin: async (id, comment) =>
      (await run(async () => {
        const r = await checkinsApi.review(id, comment);
        setCheckinResponses(prev => prev.map(x => (x.id === id ? r : x)));
        return r;
      }, 'Review saved.')) !== null,
    uploadPhoto: (clientId, file) => run(() => checkinsApi.upload(clientId, file)),

    autoflows,
    autoflowAssignments,
    saveAutoflow: (f, id) =>
      run(async () => {
        const saved = id ? await autoflowsApi.update(id, f) : await autoflowsApi.create(f);
        setAutoflows(prev => (id ? prev.map(x => (x.id === id ? saved : x)) : [...prev, saved]));
        return saved;
      }, `Autoflow "${f.title}" saved.`),
    deleteAutoflow: async id =>
      (await run(async () => {
        await autoflowsApi.delete(id);
        setAutoflows(prev => prev.filter(f => f.id !== id));
        setAutoflowAssignments(prev => prev.filter(a => a.autoflowId !== id));
        return true;
      }, 'Autoflow deleted.')) !== null,
    assignAutoflow: async (id, clientId, startDate) =>
      (await run(async () => {
        const a = await autoflowsApi.assign(id, clientId, startDate);
        setAutoflowAssignments(prev => [a, ...prev]);
        // Steps due today ran immediately; pull in their effects.
        reloadMessages();
        return a;
      }, 'Autoflow started.')) !== null,
    cancelAutoflow: async assignmentId => {
      const ok = await run(() => autoflowsApi.cancel(assignmentId), 'Autoflow stopped.');
      if (ok) setAutoflowAssignments(prev => prev.map(a => (a.id === assignmentId ? { ...a, active: false } : a)));
    },
  };

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
};

export const useEngagement = () => {
  const context = useContext(EngagementContext);
  if (!context) throw new Error('useEngagement must be used within an EngagementProvider');
  return context;
};
