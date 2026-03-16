import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import PageHead from '../../components/PageHead';
import CoachLayout from '../../components/CoachLayout';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { db } from '../../api/firebase/config';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { convertFirestoreTimestamp } from '../../utils/formatDate';
import {
  FaBell,
  FaCheck,
  FaTrash,
  FaFilter,
  FaCheckCircle,
  FaInfoCircle,
  FaExclamationTriangle,
  FaArrowRight,
} from 'react-icons/fa';

type CoachNotificationCategory = 'athlete' | 'revenue' | 'system' | 'alert';

type CoachNotificationDoc = {
  id: string;
  coachId: string;
  athleteId?: string;
  type: string;
  category?: CoachNotificationCategory;
  title?: string;
  message?: string;
  createdAt?: number;
  updatedAt?: number;
  read?: boolean;
  readAt?: number;
  archived?: boolean;
  actionRequired?: boolean;
  webUrl?: string;
  target?: string;
  metadata?: Record<string, any>;
};

const relativeTimestamp = (timestamp?: number) => {
  if (!timestamp) return 'Just now';

  const date = convertFirestoreTimestamp(timestamp);
  const now = Date.now();
  const deltaMs = now - date.getTime();
  const deltaMinutes = Math.floor(deltaMs / (1000 * 60));
  const deltaHours = Math.floor(deltaMinutes / 60);
  const deltaDays = Math.floor(deltaHours / 24);

  if (deltaMinutes < 1) return 'Just now';
  if (deltaMinutes < 60) return `${deltaMinutes} min ago`;
  if (deltaHours < 24) return `${deltaHours} hr${deltaHours === 1 ? '' : 's'} ago`;
  if (deltaDays < 7) return `${deltaDays} day${deltaDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
};

const resolveCategory = (notification: CoachNotificationDoc): CoachNotificationCategory => {
  if (notification.category) return notification.category;
  if (notification.type.includes('pulsecheck') || notification.type.includes('athlete')) return 'athlete';
  return 'system';
};

const getNotificationIcon = (notification: CoachNotificationDoc) => {
  if (notification.actionRequired) {
    return <FaExclamationTriangle className="h-5 w-5 text-orange-400" />;
  }

  const category = resolveCategory(notification);
  switch (category) {
    case 'athlete':
      return <FaCheckCircle className="h-5 w-5 text-blue-400" />;
    case 'revenue':
      return <FaBell className="h-5 w-5 text-[#E0FE10]" />;
    case 'system':
      return <FaInfoCircle className="h-5 w-5 text-purple-400" />;
    case 'alert':
      return <FaExclamationTriangle className="h-5 w-5 text-orange-400" />;
    default:
      return <FaBell className="h-5 w-5 text-zinc-400" />;
  }
};

const getNotificationBorder = (notification: CoachNotificationDoc) => {
  if (notification.actionRequired) return 'border-l-orange-400';

  const category = resolveCategory(notification);
  switch (category) {
    case 'athlete':
      return 'border-l-blue-400';
    case 'revenue':
      return 'border-l-[#E0FE10]';
    case 'system':
      return 'border-l-purple-400';
    case 'alert':
      return 'border-l-orange-400';
    default:
      return 'border-l-zinc-600';
  }
};

const CoachNotifications: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const userLoading = useUserLoading();

  const [notifications, setNotifications] = useState<CoachNotificationDoc[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'action' | 'athlete' | 'revenue' | 'system'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!currentUser?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'coach-notifications'),
      where('coachId', '==', currentUser.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as CoachNotificationDoc))
          .filter((notification) => notification.archived !== true)
          .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
        setNotifications(docs);
        setLoading(false);
      },
      (error) => {
        console.error('Failed to load coach notifications:', error);
        setNotifications([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.id, userLoading]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const category = resolveCategory(notification);
      if (filter === 'all') return true;
      if (filter === 'unread') return !notification.read;
      if (filter === 'action') return Boolean(notification.actionRequired);
      return category === filter;
    });
  }, [filter, notifications]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const actionCount = notifications.filter((notification) => notification.actionRequired && !notification.read).length;
  const readyToReviewCount = notifications.filter((notification) => !notification.read && resolveCategory(notification) === 'athlete').length;

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'coach-notifications', id), {
      read: true,
      readAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((notification) => !notification.read);
    await Promise.all(
      unread.map((notification) =>
        updateDoc(doc(db, 'coach-notifications', notification.id), {
          read: true,
          readAt: Date.now(),
          updatedAt: Date.now(),
        })
      )
    );
  };

  const archiveNotification = async (id: string) => {
    try {
      await updateDoc(doc(db, 'coach-notifications', id), {
        archived: true,
        archivedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to archive coach notification, deleting instead:', error);
      await deleteDoc(doc(db, 'coach-notifications', id));
    }
  };

  const openNotificationTarget = async (notification: CoachNotificationDoc) => {
    try {
      if (!notification.read) {
        await markAsRead(notification.id);
      }
    } catch (error) {
      console.error('Failed to mark notification read before navigation:', error);
    }

    if (!notification.webUrl) return;

    if (notification.webUrl.startsWith('http')) {
      const normalized = notification.webUrl.replace('https://fitwithpulse.ai', '');
      await router.push(normalized || '/coach/mentalGames');
      return;
    }

    await router.push(notification.webUrl);
  };

  if (loading || userLoading) {
    return (
      <CoachLayout>
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 text-center text-zinc-400">
              Loading notifications...
            </div>
          </div>
        </div>
      </CoachLayout>
    );
  }

  return (
    <>
      <PageHead
        metaData={{
          pageId: 'coach-notifications',
          pageTitle: 'Notifications - Coach Dashboard',
          metaDescription: 'Review athlete updates, Nora auto-assignments, and follow-up items that need coach attention.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://fitwithpulse.ai/coach/notifications"
      />

      <CoachLayout>
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-white">Notifications</h1>
                  <p className="mt-2 text-zinc-400">
                    {unreadCount > 0
                      ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'} need your attention.`
                      : 'You are caught up on athlete and Nora updates.'}
                  </p>
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-white transition-colors hover:bg-zinc-700"
                  >
                    <FaCheck className="h-4 w-4" />
                    Mark All Read
                  </button>
                )}
              </div>
            </div>

            <div className="mb-8 rounded-2xl border border-[#E0FE10]/15 bg-gradient-to-br from-[#E0FE10]/10 via-zinc-900 to-sky-500/10 p-6">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#E0FE10]">Coach Follow-Up Queue</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">See what changed, why it matters, and where to step in.</h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                  This page keeps Nora auto-assignments, athlete session updates, and follow-up prompts in one place so you can quickly review what happened and decide whether to intervene.
                </p>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Needs Your Attention</p>
                <p className="mt-3 text-3xl font-semibold text-white">{actionCount}</p>
                <p className="mt-2 text-sm text-zinc-400">Unread items where Nora or the runtime suggests coach review.</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Ready To Review</p>
                <p className="mt-3 text-3xl font-semibold text-white">{readyToReviewCount}</p>
                <p className="mt-2 text-sm text-zinc-400">Athlete updates waiting for a quick read, even if no override is needed.</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Caught Up Status</p>
                <p className="mt-3 text-3xl font-semibold text-white">{Math.max(notifications.length - unreadCount, 0)}</p>
                <p className="mt-2 text-sm text-zinc-400">Items you have already cleared from the current follow-up loop.</p>
              </div>
            </div>

            <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-4 flex items-center gap-2">
                <FaFilter className="h-4 w-4 text-zinc-400" />
                <span className="font-medium text-white">Filter notifications</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All', count: notifications.length },
                  { key: 'unread', label: 'Unread', count: unreadCount },
                  { key: 'action', label: 'Needs Attention', count: actionCount },
                  { key: 'athlete', label: 'Athletes', count: notifications.filter((n) => resolveCategory(n) === 'athlete').length },
                  { key: 'revenue', label: 'Revenue', count: notifications.filter((n) => resolveCategory(n) === 'revenue').length },
                  { key: 'system', label: 'System', count: notifications.filter((n) => resolveCategory(n) === 'system').length },
                ].map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key as typeof filter)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      filter === key
                        ? 'bg-[#E0FE10] text-black'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                    }`}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-xl border border-zinc-800 border-l-4 ${getNotificationBorder(notification)} ${
                    notification.read ? 'bg-zinc-900' : 'bg-zinc-800/50'
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-1 items-start gap-4">
                        <div className="rounded-lg bg-zinc-800 p-2">{getNotificationIcon(notification)}</div>

                        <div className="flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className={`font-semibold ${notification.read ? 'text-zinc-300' : 'text-white'}`}>
                              {notification.title || 'Coach update'}
                            </h3>
                            {!notification.read && <div className="h-2 w-2 rounded-full bg-[#E0FE10]" />}
                            {notification.actionRequired && (
                              <span className="rounded-full bg-orange-500/10 px-2 py-1 text-xs text-orange-400">
                                Action Suggested
                              </span>
                            )}
                          </div>

                          <p className={`mb-2 text-sm ${notification.read ? 'text-zinc-400' : 'text-zinc-300'}`}>
                            {notification.message || 'A new coach update is ready.'}
                          </p>

                          <p className="text-xs text-zinc-500">{relativeTimestamp(notification.createdAt)}</p>

                          {notification.webUrl ? (
                            <button
                              type="button"
                              onClick={() => openNotificationTarget(notification)}
                              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#E0FE10]/20 bg-[#E0FE10]/10 px-3 py-2 text-sm font-medium text-[#E0FE10] transition-colors hover:border-[#E0FE10]/35 hover:bg-[#E0FE10]/15"
                            >
                              Open Related Surface
                              <FaArrowRight className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="rounded-lg p-2 transition-colors hover:bg-zinc-700"
                            title="Mark as read"
                          >
                            <FaCheck className="h-4 w-4 text-zinc-400 hover:text-white" />
                          </button>
                        )}

                        <button
                          onClick={() => archiveNotification(notification.id)}
                          className="rounded-lg p-2 transition-colors hover:bg-zinc-700"
                          title="Archive notification"
                        >
                          <FaTrash className="h-4 w-4 text-zinc-400 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredNotifications.length === 0 && (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
                    <FaBell className="h-8 w-8 text-zinc-400" />
                  </div>
                  <p className="text-lg text-zinc-400">Nothing new to review right now</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    {filter === 'all'
                      ? 'New athlete and Nora updates will appear here as the day unfolds.'
                      : `There are no ${filter === 'action' ? 'coach action' : filter} notifications waiting right now.`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CoachLayout>
    </>
  );
};

export default CoachNotifications;
