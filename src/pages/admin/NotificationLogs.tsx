import React, { useEffect, useState } from 'react';
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../api/firebase/config';

interface NotificationError {
  code?: string;
  message?: string;
}

interface NotificationRecipient {
  userId?: string;
  username?: string;
  displayName?: string;
  email?: string;
  profileImageUrl?: string;
  tokenPreview?: string;
  requestedTokenPreview?: string;
  resolvedFromUserRecord?: boolean;
  deliveryChannel?: string;
  success?: boolean;
  messageId?: string | null;
  error?: NotificationError | string | null;
}

interface NotificationLog {
  id: string;
  fcmToken?: string;
  title?: string;
  body?: string;
  notificationType?: string;
  type?: string;
  functionName?: string;
  success?: boolean;
  messageId?: string | null;
  error?: NotificationError | null;
  timestamp?: Timestamp;
  timestampEpoch?: number;
  createdAt?: Timestamp | Date | number;
  sentAt?: Timestamp | Date | number;
  multicast?: boolean;
  totalTokens?: number;
  successCount?: number;
  failureCount?: number;
  recipients?: Array<NotificationRecipient | string>;
  individualResults?: Array<{
    tokenPreview: string;
    success: boolean;
    messageId?: string | null;
    error?: NotificationError | null;
  }>;
  dataPayload?: Record<string, unknown>;
  additionalContext?: Record<string, unknown>;
  userId?: string;
}

interface UserDirectoryEntry {
  userId: string;
  username?: string;
  displayName?: string;
  email?: string;
  profileImageUrl?: string;
}

interface DisplayRecipient extends NotificationRecipient {
  profileImageUrl?: string;
}

type NotificationSource = 'fitwithpulse' | 'pulsecheck' | 'unknown';

interface NotificationSourceMeta {
  label: string;
  badgeClassName: string;
  cardClassName: string;
  selectedCardClassName: string;
  panelClassName: string;
  titleClassName: string;
}

const NOTIFICATION_SOURCE_META: Record<NotificationSource, NotificationSourceMeta> = {
  fitwithpulse: {
    label: 'FitWithPulse',
    badgeClassName: 'border border-[#d7ff00]/35 bg-[#d7ff00]/10 text-[#f2ff9a]',
    cardClassName: 'bg-[#262a30] border border-[#343941] border-l-4 border-l-[#d7ff00] hover:bg-[#2a2e34] hover:border-[#48515c]',
    selectedCardClassName: 'bg-[#2a2e34] border border-[#d7ff00] border-l-4 border-l-[#d7ff00]',
    panelClassName: 'border border-[#d7ff00]/20',
    titleClassName: 'text-[#d7ff00]',
  },
  pulsecheck: {
    label: 'PulseCheck',
    badgeClassName: 'border border-cyan-400/35 bg-cyan-400/10 text-cyan-200',
    cardClassName: 'bg-[#222934] border border-cyan-500/20 border-l-4 border-l-cyan-400 hover:bg-[#26303a] hover:border-cyan-400/35',
    selectedCardClassName: 'bg-[#26303a] border border-cyan-400 border-l-4 border-l-cyan-300',
    panelClassName: 'border border-cyan-400/25',
    titleClassName: 'text-cyan-300',
  },
  unknown: {
    label: 'Unknown Source',
    badgeClassName: 'border border-gray-500/35 bg-gray-500/10 text-gray-200',
    cardClassName: 'bg-[#262a30] border border-[#40454c] hover:bg-[#2a2e34]',
    selectedCardClassName: 'bg-[#2a2e34] border border-gray-400',
    panelClassName: 'border border-[#40454c]',
    titleClassName: 'text-white',
  },
};

const chunkItems = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value < 1_000_000_000_000 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && value.trim() !== '') {
      return toDate(asNumber);
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    const date = (value as Timestamp).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

const getLogType = (log: NotificationLog) => log.notificationType || log.type || 'UNKNOWN';

const humanizeType = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getLogTitle = (log: NotificationLog) => log.title || humanizeType(getLogType(log));

const getLogBody = (log: NotificationLog) => log.body || 'No message body recorded for this log entry.';

const normalizeProductScope = (value: unknown): NotificationSource | null => {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const compact = normalized.replace(/[\s_-]+/g, '');
  if (compact.includes('pulsecheck') || compact.includes('youra')) return 'pulsecheck';
  if (compact === 'pulse' || compact.includes('fitwithpulse') || compact.includes('fitpulse')) return 'fitwithpulse';

  return null;
};

const stringifySearchableValue = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const getNotificationSource = (log: NotificationLog): NotificationSource => {
  const scopeHints = [
    log.additionalContext?.productScope,
    log.additionalContext?.product,
    log.additionalContext?.sourceApp,
    log.additionalContext?.source,
    log.dataPayload?.productScope,
    log.dataPayload?.product,
    log.dataPayload?.sourceApp,
    log.dataPayload?.source,
  ];

  for (const scopeHint of scopeHints) {
    const source = normalizeProductScope(scopeHint);
    if (source) return source;
  }

  const searchableContent = [
    log.functionName,
    getLogType(log),
    log.title,
    log.body,
    stringifySearchableValue(log.dataPayload),
    stringifySearchableValue(log.additionalContext),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const pulseCheckMarkers = [
    'pulsecheck',
    'youra',
    'oura',
    'nora',
    'biometric',
    'mental_',
    ' mental ',
    'dmkind',
    '/pulsecheck',
    'pilot',
    'protocol',
    'readiness',
    'recovery',
  ];

  if (pulseCheckMarkers.some((marker) => searchableContent.includes(marker))) {
    return 'pulsecheck';
  }

  const fitWithPulseMarkers = [
    'fitwithpulse',
    'run_round',
    'watch_workout',
    'workout_completed',
    'challenge',
    'callout',
    'creator_club',
    'creator club',
    'direct_message',
    'round_daily_summary',
    'new_follower',
    'referral',
  ];

  if (fitWithPulseMarkers.some((marker) => searchableContent.includes(marker))) {
    return 'fitwithpulse';
  }

  return 'fitwithpulse';
};

const formatTimestamp = (...values: unknown[]) => {
  for (const value of values) {
    const date = toDate(value);
    if (date) {
      return date.toLocaleString();
    }
  }

  return 'N/A';
};

const normalizeRecipient = (recipient: NotificationRecipient | string): NotificationRecipient | null => {
  if (typeof recipient === 'string') {
    if (recipient.includes('@')) {
      return {
        email: recipient,
        deliveryChannel: 'email',
      };
    }

    return {
      tokenPreview: recipient,
      deliveryChannel: 'push',
    };
  }

  if (!recipient || typeof recipient !== 'object') {
    return null;
  }

  return recipient;
};

const normalizeError = (error: NotificationRecipient['error'] | NotificationLog['error']) => {
  if (!error) return null;

  if (typeof error === 'string') {
    return {
      code: 'ERROR',
      message: error,
    };
  }

  return error;
};

const getRecipients = (log: NotificationLog): NotificationRecipient[] => {
  const explicitRecipients = Array.isArray(log.recipients)
    ? log.recipients.map(normalizeRecipient).filter(Boolean) as NotificationRecipient[]
    : [];

  if (explicitRecipients.length > 0) {
    return explicitRecipients;
  }

  if (Array.isArray(log.individualResults) && log.individualResults.length > 0) {
    return log.individualResults.map((result) => ({
      tokenPreview: result.tokenPreview,
      deliveryChannel: 'push',
      success: result.success,
      messageId: result.messageId || null,
      error: result.error || null,
    }));
  }

  const additionalContext = log.additionalContext || {};
  const fallbackRecipient: NotificationRecipient = {};

  if (typeof additionalContext.userId === 'string') fallbackRecipient.userId = additionalContext.userId;
  if (typeof additionalContext.username === 'string') fallbackRecipient.username = additionalContext.username;
  if (typeof additionalContext.displayName === 'string') fallbackRecipient.displayName = additionalContext.displayName;
  if (typeof additionalContext.email === 'string') fallbackRecipient.email = additionalContext.email;
  if (!fallbackRecipient.userId && log.userId) fallbackRecipient.userId = log.userId;
  if (!fallbackRecipient.tokenPreview && log.fcmToken && log.fcmToken !== 'MISSING') fallbackRecipient.tokenPreview = log.fcmToken;

  if (!fallbackRecipient.deliveryChannel) {
    fallbackRecipient.deliveryChannel =
      fallbackRecipient.email || (log.fcmToken && log.fcmToken.startsWith('email:'))
        ? 'email'
        : 'push';
  }

  if (typeof log.success === 'boolean') fallbackRecipient.success = log.success;
  if (log.messageId) fallbackRecipient.messageId = log.messageId;
  if (log.error) fallbackRecipient.error = log.error;

  return Object.values(fallbackRecipient).some(Boolean) ? [fallbackRecipient] : [];
};

const buildRecipientLookupKeys = (recipient: NotificationRecipient) => {
  const keys: string[] = [];

  if (recipient.userId) keys.push(`user:${recipient.userId}`);
  if (recipient.email) keys.push(`email:${recipient.email.toLowerCase()}`);
  if (recipient.tokenPreview) keys.push(`token:${recipient.tokenPreview}`);

  return keys;
};

const getProfileImageUrl = (userData: Record<string, unknown>) => {
  const profileImage = userData.profileImage as
    | { profileImageURL?: string; profileImageUrl?: string; image?: string }
    | undefined;

  return (
    (typeof profileImage?.profileImageURL === 'string' && profileImage.profileImageURL) ||
    (typeof profileImage?.profileImageUrl === 'string' && profileImage.profileImageUrl) ||
    (typeof profileImage?.image === 'string' && profileImage.image) ||
    (typeof userData.profileImageUrl === 'string' && userData.profileImageUrl) ||
    (typeof userData.profileImageURL === 'string' && userData.profileImageURL) ||
    ''
  );
};

const buildUserDirectoryEntry = (userId: string, userData: Record<string, unknown>): UserDirectoryEntry => ({
  userId,
  username: typeof userData.username === 'string' ? userData.username : '',
  displayName: typeof userData.displayName === 'string' ? userData.displayName : '',
  email: typeof userData.email === 'string' ? userData.email : '',
  profileImageUrl: getProfileImageUrl(userData),
});

const getDisplayName = (recipient: DisplayRecipient) =>
  recipient.username
    ? `@${recipient.username}`
    : recipient.displayName || recipient.email || 'Unknown recipient';

const getSecondaryLine = (recipient: DisplayRecipient) => {
  if (recipient.email) return recipient.email;
  if (recipient.displayName && recipient.username) return recipient.displayName;
  if (recipient.userId) return `User ID: ${recipient.userId}`;
  return 'Recipient details unavailable';
};

const getTertiaryLine = (recipient: DisplayRecipient) => {
  if (recipient.displayName && recipient.username && recipient.email) return recipient.displayName;
  if (recipient.deliveryChannel) return `Channel: ${recipient.deliveryChannel}`;
  return '';
};

const getRecipientPreview = (recipients: DisplayRecipient[]) => {
  const labels = recipients.map(getDisplayName).filter(Boolean);

  if (labels.length === 0) return '';
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} more`;
};

const getAvatarSeed = (recipient: DisplayRecipient) =>
  recipient.username || recipient.displayName || recipient.email || recipient.userId || 'U';

const getInitials = (recipient: DisplayRecipient) => {
  const seed = getAvatarSeed(recipient).replace(/^@/, '').trim();
  if (!seed) return 'U';

  const parts = seed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const renderRecipientStatus = (recipient: NotificationRecipient) => {
  if (recipient.success === true) {
    return <span className="bg-green-500 text-white px-2 py-1 rounded text-xs">Sent</span>;
  }

  if (recipient.success === false) {
    return <span className="bg-red-500 text-white px-2 py-1 rounded text-xs">Failed</span>;
  }

  return <span className="bg-gray-600 text-white px-2 py-1 rounded text-xs">Recorded</span>;
};

const renderSourceBadge = (source: NotificationSource) => {
  const sourceMeta = NOTIFICATION_SOURCE_META[source];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${sourceMeta.badgeClassName}`}
    >
      {sourceMeta.label}
    </span>
  );
};

const RecipientAvatar: React.FC<{ recipient: DisplayRecipient }> = ({ recipient }) => {
  if (recipient.profileImageUrl) {
    return (
      <img
        src={recipient.profileImageUrl}
        alt={getDisplayName(recipient)}
        className="w-12 h-12 rounded-full object-cover border border-[#40454c] flex-shrink-0"
      />
    );
  }

  return (
    <div className="w-12 h-12 rounded-full bg-[#2a2e34] border border-[#40454c] flex items-center justify-center text-sm font-semibold text-[#d7ff00] flex-shrink-0">
      {getInitials(recipient)}
    </div>
  );
};

const NotificationLogs: React.FC = () => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingRecipients, setResolvingRecipients] = useState(false);
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [selectedRecipientIndex, setSelectedRecipientIndex] = useState<number | null>(null);
  const [userDirectory, setUserDirectory] = useState<Record<string, UserDirectoryEntry>>({});

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const resolveUserDirectory = async () => {
      if (logs.length === 0) {
        setUserDirectory({});
        return;
      }

      try {
        setResolvingRecipients(true);

        const recipientPool = logs.flatMap((log) => getRecipients(log));
        const userIds = Array.from(new Set(recipientPool.map((recipient) => recipient.userId).filter(Boolean) as string[]));
        const emails = Array.from(new Set(recipientPool.map((recipient) => recipient.email?.toLowerCase()).filter(Boolean) as string[]));
        const tokenPreviews = Array.from(new Set(recipientPool.map((recipient) => recipient.tokenPreview).filter(Boolean) as string[]));

        const nextDirectory: Record<string, UserDirectoryEntry> = {};

        const addEntry = (entry: UserDirectoryEntry, tokenValues: string[] = []) => {
          nextDirectory[`user:${entry.userId}`] = entry;

          if (entry.email) {
            nextDirectory[`email:${entry.email.toLowerCase()}`] = entry;
          }

          for (const tokenValue of tokenValues) {
            if (tokenValue) {
              nextDirectory[`token:${tokenValue}`] = entry;
            }
          }
        };

        for (const userIdChunk of chunkItems(userIds, 10)) {
          const snapshot = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', userIdChunk)));
          snapshot.forEach((docSnapshot) => {
            const userData = docSnapshot.data() as Record<string, unknown>;
            const entry = buildUserDirectoryEntry(docSnapshot.id, userData);
            addEntry(entry, [
              typeof userData.fcmToken === 'string' ? `${userData.fcmToken.substring(0, 20)}...` : '',
              typeof userData.pulseCheckFcmToken === 'string' ? `${userData.pulseCheckFcmToken.substring(0, 20)}...` : '',
            ]);
          });
        }

        for (const emailChunk of chunkItems(emails, 10)) {
          const snapshot = await getDocs(query(collection(db, 'users'), where('email', 'in', emailChunk)));
          snapshot.forEach((docSnapshot) => {
            const userData = docSnapshot.data() as Record<string, unknown>;
            const entry = buildUserDirectoryEntry(docSnapshot.id, userData);
            addEntry(entry, [
              typeof userData.fcmToken === 'string' ? `${userData.fcmToken.substring(0, 20)}...` : '',
              typeof userData.pulseCheckFcmToken === 'string' ? `${userData.pulseCheckFcmToken.substring(0, 20)}...` : '',
            ]);
          });
        }

        const unresolvedTokenPreviews = tokenPreviews.filter((tokenPreview) => !nextDirectory[`token:${tokenPreview}`]);
        if (unresolvedTokenPreviews.length > 0) {
          const snapshot = await getDocs(collection(db, 'users'));
          snapshot.forEach((docSnapshot) => {
            const userData = docSnapshot.data() as Record<string, unknown>;
            const entry = buildUserDirectoryEntry(docSnapshot.id, userData);
            addEntry(entry, [
              typeof userData.fcmToken === 'string' ? `${userData.fcmToken.substring(0, 20)}...` : '',
              typeof userData.pulseCheckFcmToken === 'string' ? `${userData.pulseCheckFcmToken.substring(0, 20)}...` : '',
            ]);
          });
        }

        if (!isCancelled) {
          setUserDirectory(nextDirectory);
        }
      } catch (error) {
        console.error('Error resolving notification recipients:', error);
      } finally {
        if (!isCancelled) {
          setResolvingRecipients(false);
        }
      }
    };

    resolveUserDirectory();

    return () => {
      isCancelled = true;
    };
  }, [logs]);

  useEffect(() => {
    setSelectedRecipientIndex(null);
  }, [selectedLog?.id]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const logsRef = collection(db, 'notification-logs');
      const logsQuery = query(logsRef, orderBy('timestampEpoch', 'desc'), limit(100));
      const snapshot = await getDocs(logsQuery);

      const logsData = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as Omit<NotificationLog, 'id'>),
      }));

      setLogs(logsData);
      setSelectedLog((currentSelectedLog) => {
        if (!currentSelectedLog) return null;
        return logsData.find((log) => log.id === currentSelectedLog.id) || currentSelectedLog;
      });
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const hydrateRecipient = (recipient: NotificationRecipient): DisplayRecipient => {
    const directoryEntry = buildRecipientLookupKeys(recipient)
      .map((key) => userDirectory[key])
      .find(Boolean);

    return {
      ...recipient,
      profileImageUrl: recipient.profileImageUrl || directoryEntry?.profileImageUrl,
      userId: recipient.userId || directoryEntry?.userId,
      username: recipient.username || directoryEntry?.username,
      displayName: recipient.displayName || directoryEntry?.displayName,
      email: recipient.email || directoryEntry?.email,
    };
  };

  const getStatusBadge = (log: NotificationLog) => {
    if (log.multicast) {
      const successRate = log.totalTokens ? (log.successCount || 0) / log.totalTokens : 0;
      if (successRate === 1) {
        return <span className="bg-green-500 text-white px-2 py-1 rounded text-xs">All Sent</span>;
      }
      if (successRate > 0.5) {
        return <span className="bg-yellow-500 text-white px-2 py-1 rounded text-xs">Partial</span>;
      }
      return <span className="bg-red-500 text-white px-2 py-1 rounded text-xs">Failed</span>;
    }

    if (log.success === true) {
      return <span className="bg-green-500 text-white px-2 py-1 rounded text-xs">Sent</span>;
    }

    if (log.success === false) {
      return <span className="bg-red-500 text-white px-2 py-1 rounded text-xs">Failed</span>;
    }

    return <span className="bg-gray-600 text-white px-2 py-1 rounded text-xs">Unknown</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111417] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d7ff00] mb-4"></div>
          <p>Loading notification logs...</p>
        </div>
      </div>
    );
  }

  const selectedRecipients = selectedLog ? getRecipients(selectedLog).map(hydrateRecipient) : [];
  const selectedRecipient = selectedRecipientIndex !== null ? selectedRecipients[selectedRecipientIndex] || null : null;
  const selectedRecipientError = normalizeError(selectedRecipient?.error || null);
  const selectedSource = selectedLog ? getNotificationSource(selectedLog) : 'unknown';
  const selectedSourceMeta = NOTIFICATION_SOURCE_META[selectedSource];

  return (
    <div className="min-h-screen bg-[#111417] text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-[#d7ff00]">Notification Logs</h1>
          <button
            onClick={fetchLogs}
            className="bg-[#d7ff00] text-black px-4 py-2 rounded-md hover:bg-opacity-80 transition duration-200"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#1a1e24] rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Notifications</h2>

            {logs.length === 0 ? (
              <p className="text-gray-400">No notification logs found.</p>
            ) : (
              <div className="space-y-4">
                {logs.map((log) => {
                  const recipients = getRecipients(log).map(hydrateRecipient);
                  const source = getNotificationSource(log);
                  const sourceMeta = NOTIFICATION_SOURCE_META[source];

                  return (
                    <div
                      key={log.id}
                      className={`p-4 rounded-lg cursor-pointer transition duration-200 ${
                        selectedLog?.id === log.id
                          ? sourceMeta.selectedCardClassName
                          : sourceMeta.cardClassName
                      }`}
                      onClick={() => setSelectedLog(log)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0 pr-4">
                          <h3 className={`font-medium truncate ${sourceMeta.titleClassName}`}>{getLogTitle(log)}</h3>
                          <p
                            className="text-sm text-gray-300 break-words overflow-hidden"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical' as const,
                              maxHeight: '2.5rem',
                            }}
                          >
                            {getLogBody(log)}
                          </p>
                        </div>
                        {getStatusBadge(log)}
                      </div>

                      <div className="flex justify-between gap-3 text-xs text-gray-400">
                        <div className="flex items-center gap-2 min-w-0">
                          {renderSourceBadge(source)}
                          <span className="truncate">{getLogType(log)}</span>
                        </div>
                        <span>{formatTimestamp(log.timestampEpoch, log.timestamp, log.sentAt, log.createdAt)}</span>
                      </div>

                      {recipients.length > 0 && (
                        <div className="mt-2 text-xs text-gray-300 break-words">
                          Recipients: {getRecipientPreview(recipients)}
                        </div>
                      )}

                      {log.multicast && (
                        <div className="mt-2 text-xs text-gray-300">
                          {log.successCount}/{log.totalTokens} sent successfully
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`bg-[#1a1e24] rounded-xl p-6 ${selectedSourceMeta.panelClassName}`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-semibold">Log Details</h2>
              {selectedLog && renderSourceBadge(selectedSource)}
            </div>

            {selectedLog ? (
              <div className="space-y-4">
                <div>
                  <h4 className={`text-sm font-medium mb-1 ${selectedSourceMeta.titleClassName}`}>Title</h4>
                  <p className="text-sm break-words">{getLogTitle(selectedLog)}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Body</h4>
                  <p className="text-sm break-words whitespace-pre-wrap">{getLogBody(selectedLog)}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Type</h4>
                  <p className="text-sm">{getLogType(selectedLog)}</p>
                </div>

                {selectedLog.functionName && (
                  <div>
                    <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Function</h4>
                    <p className="text-sm">{selectedLog.functionName}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Status</h4>
                  {getStatusBadge(selectedLog)}
                </div>

                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Timestamp</h4>
                  <p className="text-sm">
                    {formatTimestamp(selectedLog.timestampEpoch, selectedLog.timestamp, selectedLog.sentAt, selectedLog.createdAt)}
                  </p>
                </div>

                {selectedLog.multicast && (
                  <div>
                    <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Multicast Stats</h4>
                    <div className="text-sm space-y-1">
                      <p>Total Tokens: {selectedLog.totalTokens ?? 0}</p>
                      <p>Success: {selectedLog.successCount ?? 0}</p>
                      <p>Failed: {selectedLog.failureCount ?? 0}</p>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h4 className="text-sm font-medium text-[#d7ff00]">Recipients</h4>
                    {resolvingRecipients && <span className="text-xs text-gray-400">Resolving user profiles...</span>}
                  </div>

                  {selectedRecipients.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {selectedRecipients.map((recipient, index) => (
                        <button
                          key={`${selectedLog.id}-recipient-${index}`}
                          type="button"
                          onClick={() => setSelectedRecipientIndex(index)}
                          className={`w-full text-left p-3 rounded-lg border transition duration-200 ${
                            recipient.success === true
                              ? 'bg-green-900/20 border-green-800 hover:bg-green-900/30'
                              : recipient.success === false
                                ? 'bg-red-900/20 border-red-800 hover:bg-red-900/30'
                                : 'bg-[#262a30] border-[#40454c] hover:bg-[#2a2e34]'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <RecipientAvatar recipient={recipient} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium break-words">{getDisplayName(recipient)}</p>
                                  <p className="text-xs text-gray-300 break-words mt-1">{getSecondaryLine(recipient)}</p>
                                  {getTertiaryLine(recipient) && (
                                    <p className="text-xs text-gray-500 break-words mt-1">{getTertiaryLine(recipient)}</p>
                                  )}
                                </div>
                                {renderRecipientStatus(recipient)}
                              </div>

                              <p className="text-xs text-[#d7ff00] mt-2">Click for delivery details</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No recipient identities were captured for this log entry.</p>
                  )}
                </div>

                {selectedLog.error && (
                  <div>
                    <h4 className="text-sm font-medium text-red-400 mb-1">Error</h4>
                    <div className="bg-red-900/20 p-3 rounded text-sm">
                      <p><strong>Code:</strong> {selectedLog.error.code || 'UNKNOWN'}</p>
                      <p className="break-words"><strong>Message:</strong> {selectedLog.error.message || 'Unknown error'}</p>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Data Payload</h4>
                  <pre className="text-xs bg-[#262a30] p-3 rounded overflow-auto max-h-40 whitespace-pre-wrap break-words">
                    {JSON.stringify(selectedLog.dataPayload || {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">Select a log entry to view details</p>
            )}
          </div>
        </div>
      </div>

      {selectedRecipient && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setSelectedRecipientIndex(null)}
        >
          <div
            className="w-full max-w-xl bg-[#1a1e24] border border-[#40454c] rounded-2xl p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-4 min-w-0">
                <RecipientAvatar recipient={selectedRecipient} />
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-white break-words">{getDisplayName(selectedRecipient)}</h3>
                  <p className="text-sm text-gray-300 break-words mt-1">{getSecondaryLine(selectedRecipient)}</p>
                  {getTertiaryLine(selectedRecipient) && (
                    <p className="text-xs text-gray-500 break-words mt-1">{getTertiaryLine(selectedRecipient)}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecipientIndex(null)}
                className="text-gray-400 hover:text-white transition duration-200"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Delivery Status</h4>
                {renderRecipientStatus(selectedRecipient)}
              </div>

              {selectedRecipient.userId && (
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">User ID</h4>
                  <p className="text-sm font-mono break-all">{selectedRecipient.userId}</p>
                </div>
              )}

              {selectedRecipient.messageId && (
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Message ID</h4>
                  <p className="text-sm font-mono break-all">{selectedRecipient.messageId}</p>
                </div>
              )}

              {selectedRecipient.tokenPreview && (
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Token Preview</h4>
                  <p className="text-sm font-mono break-all">{selectedRecipient.tokenPreview}</p>
                </div>
              )}

              {selectedRecipient.requestedTokenPreview && selectedRecipient.requestedTokenPreview !== selectedRecipient.tokenPreview && (
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Requested Token Preview</h4>
                  <p className="text-sm font-mono break-all">{selectedRecipient.requestedTokenPreview}</p>
                </div>
              )}

              {selectedRecipient.deliveryChannel && (
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Delivery Channel</h4>
                  <p className="text-sm">{selectedRecipient.deliveryChannel}</p>
                </div>
              )}

              {selectedRecipient.resolvedFromUserRecord === true && (
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Token Resolution</h4>
                  <p className="text-sm">Used the latest token from the recipient&apos;s user profile.</p>
                </div>
              )}

              {selectedRecipientError?.message && (
                <div>
                  <h4 className="text-sm font-medium text-red-400 mb-1">Delivery Error</h4>
                  <div className="bg-red-900/20 p-3 rounded text-sm">
                    <p><strong>Code:</strong> {selectedRecipientError.code || 'UNKNOWN'}</p>
                    <p className="break-words"><strong>Message:</strong> {selectedRecipientError.message}</p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Recipient Payload</h4>
                <pre className="text-xs bg-[#262a30] p-3 rounded overflow-auto max-h-52 whitespace-pre-wrap break-words">
                  {JSON.stringify(selectedRecipient, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationLogs;
