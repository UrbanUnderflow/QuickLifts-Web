export type MessageChannel = 'app' | 'sms';
export type ChannelStatus = { status: string; reason?: string; retryable?: boolean };
export type InboxMessage = {
  id: string; athleteId: string; text: string; direction: 'incoming' | 'outgoing'; atMs: number;
  channels: Partial<Record<MessageChannel, ChannelStatus>>;
};
export type InboxRecipient = {
  id: string; name: string; unread: boolean; lastMessage: string; lastAtMs: number;
  textAvailable: boolean; textReason: string | null;
};
export type MessagesInboxData = { recipients: InboxRecipient[]; messages: InboxMessage[]; hasOlder: boolean };
export const retryableTextStates = new Set(['failed', 'undelivered', 'blocked', 'canceled']);
export function timestampMs(value: any): number {
  if (typeof value === 'number') return value;
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds != null || value?._seconds != null) return Number(value.seconds ?? value._seconds) * 1000;
  const time = new Date(value || 0).getTime(); return Number.isFinite(time) ? time : 0;
}
/** Only explicit delivery links combine channels. Equal text/time never implies identity. */
export function assembleTimeline(logical: any[], app: any[], sms: any[], uid: string): InboxMessage[] {
  const output = new Map<string, InboxMessage>();
  const appById = new Map(app.map(message => [message.id, message]));
  const smsById = new Map(sms.map(message => [message.id, message]));
  const linkedApp = new Set<string>(), linkedSms = new Set<string>();
  for (const message of logical) {
    const channels: InboxMessage['channels'] = {};
    if (message.app) {
      const evidence = appById.get(message.app.messageId);
      linkedApp.add(message.app.messageId);
      channels.app = { status: evidence?.readBy?.[message.athleteId] ? 'read' : message.app.status };
    }
    if (message.sms) {
      if (message.sms.jobId) linkedSms.add(message.sms.jobId);
      const evidence = smsById.get(message.sms.jobId);
      const status = evidence?.status || message.sms.status;
      channels.sms = { status, reason: evidence ? undefined : message.sms.reason, retryable: retryableTextStates.has(status) };
    }
    output.set(message.id, { id: message.id, athleteId: message.athleteId, text: message.text, direction: 'outgoing', atMs: message.atMs, channels });
  }
  for (const message of app) {
    if (linkedApp.has(message.id) || message.unifiedMessageId && output.has(message.unifiedMessageId)) continue;
    const id = message.unifiedMessageId || `app-${message.id}`;
    output.set(id, { id, athleteId: message.athleteId, text: message.content || '', direction: message.senderId === uid ? 'outgoing' : 'incoming', atMs: timestampMs(message.timestamp), channels: { app: { status: message.senderId === uid ? (message.readBy?.[message.athleteId] ? 'read' : 'saved') : 'received' } } });
  }
  for (const message of sms) {
    if (linkedSms.has(message.id) || message.unifiedMessageId && logical.some(row => row.id === message.unifiedMessageId)) continue;
    const id = message.unifiedMessageId || `sms-${message.id}`;
    const previous = output.get(id);
    if (previous?.channels.sms && previous.atMs > message.atMs) continue;
    const status = message.status || 'received';
    output.set(id, { ...previous, id, athleteId: message.athleteId, text: previous?.text || message.text || '', direction: message.direction, atMs: previous?.atMs || message.atMs, channels: { ...previous?.channels, sms: { status, retryable: !!message.unifiedMessageId && message.senderId === uid && retryableTextStates.has(status) } } });
  }
  return [...output.values()].sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id));
}

export function channelLabel(channel: MessageChannel, value: ChannelStatus): string {
  const names: Record<string, string> = { saved: 'Sent in App', read: 'Read in App', received: channel === 'app' ? 'App reply' : 'Text reply', queued: 'Text queued', sending: 'Sending text', accepted: 'Text accepted by provider', sent: 'Text sent', delivered: 'Text delivered', unknown: 'Text status uncertain. Check before sending again.', failed: 'Text failed', undelivered: 'Text not delivered', canceled: 'Text canceled', blocked: 'Text unavailable' };
  return names[value.status] || `${channel === 'app' ? 'App' : 'Text'}: ${value.status}`;
}
