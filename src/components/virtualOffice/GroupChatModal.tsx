import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Send, Sparkles, MessageSquare, AtSign, Paperclip, FileText, Loader2, FolderOpen, Code2, ChevronDown, Lightbulb, ListTodo, Terminal, Zap, Copy } from 'lucide-react';
import { db } from '../../api/firebase/config';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { groupChatService } from '../../api/firebase/groupChat/service';
import { presenceService, AgentPresence } from '../../api/firebase/presence/service';
import type { GroupChatMessage } from '../../api/firebase/groupChat/types';
import { MessageBubble } from './MessageBubble';
import { meetingMinutesService } from '../../api/firebase/meetingMinutes/service';
import type { MeetingMinutes } from '../../api/firebase/meetingMinutes/types';

interface GroupChatModalProps {
  chatId: string;
  participants: string[];
  onClose: (messages: GroupChatMessage[]) => void;
}

const AGENT_COLORS: Record<string, string> = {
  nora: '#22c55e',
  antigravity: '#8b5cf6',
  scout: '#f59e0b',
  solara: '#f43f5e',
  default: '#3b82f6',
};

const AGENT_EMOJIS: Record<string, string> = {
  nora: '⚡',
  antigravity: '🌌',
  scout: '🕵️',
  solara: '❤️‍🔥',
  sage: '🧬',
};

const COMPOSE_BASE_MESSAGE_BUDGET_CHARS = 2400;
const COMPOSE_FILE_ATTACHMENT_BUDGET_CHARS = 3200;
const COMPOSE_MINUTES_ATTACHMENT_BUDGET_CHARS = 2400;
const COMPOSE_TOTAL_MESSAGE_BUDGET_CHARS = 7600;

const countLines = (text: string): number => {
  if (!text) return 0;
  return text.split(/\r\n|\r|\n/).length;
};

const clampHeadTail = (text: string, maxChars: number): string => {
  const raw = String(text || '');
  if (!raw) return '';
  if (!Number.isFinite(maxChars) || maxChars <= 0 || raw.length <= maxChars) return raw;

  const headLen = Math.max(24, Math.floor(maxChars * 0.74));
  const tailLen = Math.max(0, maxChars - headLen - 3);
  if (tailLen <= 0) return `${raw.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  return `${raw.slice(0, headLen).trimEnd()}\n…\n${raw.slice(-tailLen).trimStart()}`;
};

const buildCompactionMeta = (label: string, originalText: string, compactedText: string): string => {
  if (!originalText) return '';
  if (originalText.length <= compactedText.length) return '';
  return `[${label} auto-compacted from ${originalText.length.toLocaleString()} chars / ${countLines(originalText).toLocaleString()} lines]`;
};

const toEpochMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortByCreatedAtAsc = (a: GroupChatMessage, b: GroupChatMessage): number => {
  const aMs = toEpochMs((a as any).createdAt);
  const bMs = toEpochMs((b as any).createdAt);
  if (aMs !== bMs) return aMs - bMs;
  return String(a.id || '').localeCompare(String(b.id || ''));
};

const mergeMessagesStable = (
  previous: GroupChatMessage[],
  incoming: GroupChatMessage[],
): GroupChatMessage[] => {
  if (previous.length === 0) {
    return [...incoming].sort(sortByCreatedAtAsc);
  }

  const incomingById = new Map<string, GroupChatMessage>();
  incoming.forEach((msg) => {
    if (msg.id) incomingById.set(msg.id, msg);
  });

  // Keep existing visual order stable, but refresh message content from latest snapshot.
  const mergedInExistingOrder: GroupChatMessage[] = [];
  previous.forEach((msg) => {
    if (!msg.id) return;
    const updated = incomingById.get(msg.id);
    if (updated) {
      mergedInExistingOrder.push(updated);
      incomingById.delete(msg.id);
    }
  });

  // Append only truly new messages after the existing list.
  const newMessages = Array.from(incomingById.values()).sort(sortByCreatedAtAsc);
  return mergedInExistingOrder.concat(newMessages);
};

export const GroupChatModal: React.FC<GroupChatModalProps> = ({
  chatId,
  participants,
  onClose,
}) => {
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentPresence>>({});
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  // Chat mode switcher
  type ChatMode = 'brainstorm' | 'task' | 'command';
  const [chatMode, setChatMode] = useState<ChatMode>('brainstorm');

  // Meeting minutes attachment state
  const [showMinutesPicker, setShowMinutesPicker] = useState(false);
  const [allMinutes, setAllMinutes] = useState<MeetingMinutes[]>([]);
  const [attachedMinutes, setAttachedMinutes] = useState<MeetingMinutes | null>(null);
  const [loadingMinutes, setLoadingMinutes] = useState(false);

  // File browser state
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [fileBrowserPath, setFileBrowserPath] = useState('/');
  const [fileBrowserItems, setFileBrowserItems] = useState<any[]>([]);
  const [fileBrowserLoading, setFileBrowserLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; path: string; content: string; size: number } | null>(null);
  const [fileFilter, setFileFilter] = useState('');
  const [fileBrowserMode, setFileBrowserMode] = useState<'search' | 'browse'>('search');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [endConfirmMessage, setEndConfirmMessage] = useState('Are you sure you want to end this chat?');
  const [copyButtonLabel, setCopyButtonLabel] = useState('Copy chat');

  // Listen to messages
  useEffect(() => {
    const unsubscribe = groupChatService.listenToMessages(chatId, (newMessages) => {
      setMessages((prev) => mergeMessagesStable(prev, newMessages));
    });
    return () => unsubscribe();
  }, [chatId]);

  // Listen to agent presence
  useEffect(() => {
    const unsubscribe = presenceService.listen((agents) => {
      const statusMap: Record<string, AgentPresence> = {};
      agents.forEach(agent => { statusMap[agent.id] = agent; });
      setAgentStatuses(statusMap);
    });
    return () => unsubscribe();
  }, []);

  // Smart scroll — only auto-scroll if user is near bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distFromBottom < 120) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      setHasNewMessages(true);
    }
  }, [messages]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distFromBottom < 80) setHasNewMessages(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setHasNewMessages(false);
  };

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Prevent accidental tab close/reload while session is active.
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const message = 'A Round Table chat is active. Are you sure you want to leave?';
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    setSending(true);
    try {
      const rawBaseMessage = inputText.trim();
      const compactBaseMessage = clampHeadTail(rawBaseMessage, COMPOSE_BASE_MESSAGE_BUDGET_CHARS);
      let messageContent = compactBaseMessage;
      const baseMeta = buildCompactionMeta('message', rawBaseMessage, compactBaseMessage);
      if (baseMeta) messageContent += `\n\n${baseMeta}`;

      if (attachedFile) {
        const rawFileContent = String(attachedFile.content || '');
        const compactFileContent = clampHeadTail(rawFileContent, COMPOSE_FILE_ATTACHMENT_BUDGET_CHARS);
        const fileMeta = buildCompactionMeta('file', rawFileContent, compactFileContent);
        messageContent += `\n\n--- ATTACHED FILE: ${attachedFile.path} ---`;
        if (fileMeta) messageContent += `\n${fileMeta}`;
        messageContent += `\n\`\`\`\n${compactFileContent}\n\`\`\`\n--- END FILE ---`;
      }
      if (attachedMinutes) {
        const md = meetingMinutesService.toMarkdown(attachedMinutes);
        const normalizedMd = md.replace(/\n{3,}/g, '\n\n').trim();
        const compactMinutes = clampHeadTail(normalizedMd, COMPOSE_MINUTES_ATTACHMENT_BUDGET_CHARS);
        const minutesMeta = buildCompactionMeta('meeting minutes', normalizedMd, compactMinutes);
        messageContent += `\n\n--- ATTACHED MEETING MINUTES ---`;
        if (minutesMeta) messageContent += `\n${minutesMeta}`;
        messageContent += `\n${compactMinutes}\n--- END MEETING MINUTES ---`;
      }

      if (messageContent.length > COMPOSE_TOTAL_MESSAGE_BUDGET_CHARS) {
        const rawComposed = messageContent;
        const compactComposed = clampHeadTail(rawComposed, COMPOSE_TOTAL_MESSAGE_BUDGET_CHARS);
        const totalMeta = buildCompactionMeta('total prompt', rawComposed, compactComposed);
        messageContent = totalMeta
          ? `${compactComposed}\n\n${totalMeta}`
          : compactComposed;
      }

      if (chatMode === 'brainstorm') {
        // Default: broadcast to all agents for group discussion
        await groupChatService.broadcastMessage(chatId, messageContent, participants);
      } else {
        // Task or Command mode: extract @mentioned agents and send directly as commands
        const mentionedAgents = participants.filter(agentId => {
          const name = (agentStatuses[agentId]?.displayName || agentId).toLowerCase();
          return messageContent.toLowerCase().includes(`@${name}`) || messageContent.includes(`@${agentId}`);
        });

        // If no agents mentioned, send to all participants
        const targets = mentionedAgents.length > 0 ? mentionedAgents : participants;

        // Also broadcast the message to group chat so everyone sees it
        await groupChatService.broadcastMessage(chatId, `[${chatMode.toUpperCase()}] ${messageContent}`, participants);

        // Send individual task/command to each targeted agent
        for (const agentId of targets) {
          await addDoc(collection(db, 'agent-commands'), {
            from: 'admin',
            to: agentId,
            type: chatMode, // 'task' or 'command'
            content: messageContent.replace(new RegExp(`@\\w+`, 'gi'), '').trim(),
            metadata: { source: 'group-chat', chatId },
            status: 'pending',
            createdAt: serverTimestamp(),
          });
        }
      }

      setInputText('');
      setAttachedMinutes(null);
      setAttachedFile(null);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle @ mention detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);

    // Check for @ trigger
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setShowMentions(true);
      setMentionFilter(atMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
      setMentionFilter('');
    }

    // Check for /b trigger for file search
    const slashBMatch = textBeforeCursor.match(/(^|\s)\/b\s(.*)$/i);

    if (slashBMatch) {
      const searchQuery = slashBMatch[2];
      setFileFilter(searchQuery);
      if (!showFileBrowser) {
        setShowFileBrowser(true);
        setFileBrowserMode('search');
      }
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (searchQuery.trim().length > 0) {
        searchDebounceRef.current = setTimeout(() => searchFilesGC(searchQuery.trim()), 200);
      } else {
        setSearchResults([]);
      }
      return;
    }

    // Check for / trigger for file browser (fallback)
    const slashIdx = textBeforeCursor.lastIndexOf('/');
    if (slashIdx >= 0) {
      const charBefore = slashIdx > 0 ? textBeforeCursor[slashIdx - 1] : ' ';
      if (slashIdx === 0 || /\s/.test(charBefore)) {
        const afterSlash = textBeforeCursor.slice(slashIdx + 1);
        if (afterSlash.startsWith('b')) return;
        setFileFilter(afterSlash);
        if (!showFileBrowser) {
          setShowFileBrowser(true);
          setFileBrowserMode('browse');
          browseDir('/');
        }
        return;
      }
    }
    if (showFileBrowser) setShowFileBrowser(false);
  }, [showFileBrowser]);

  // Insert mention
  const insertMention = useCallback((agentId: string, agentName: string) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart || 0;
    const textBeforeCursor = inputText.substring(0, cursorPos);
    const textAfterCursor = inputText.substring(cursorPos);

    // Replace the @partial with @agentName
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const newText = textBeforeCursor.substring(0, atIndex) + `@${agentName} ` + textAfterCursor;
    setInputText(newText);
    setShowMentions(false);

    // Refocus
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = atIndex + agentName.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  }, [inputText]);

  const searchFilesGC = async (searchQuery: string) => {
    setFileBrowserLoading(true);
    try {
      const res = await fetch(`/api/files/browse?search=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (e) {
      console.error('Failed to search files:', e);
    }
    setFileBrowserLoading(false);
  };

  const browseDir = async (dirPath: string) => {
    setFileBrowserLoading(true);
    setFileBrowserPath(dirPath);
    try {
      const res = await fetch(`/api/files/browse?path=${encodeURIComponent(dirPath)}`);
      if (res.ok) {
        const data = await res.json();
        setFileBrowserItems(data.items || []);
      }
    } catch (e) {
      console.error('Failed to browse files:', e);
    }
    setFileBrowserLoading(false);
  };

  const selectFile = async (filePath: string) => {
    try {
      const res = await fetch(`/api/files/browse?path=${encodeURIComponent(filePath)}&read=true`);
      if (res.ok) {
        const data = await res.json();
        setAttachedFile({ name: data.name, path: data.path, content: data.content, size: data.size });
      }
    } catch (e) {
      console.error('Failed to read file:', e);
    }
    setShowFileBrowser(false);
    const slashBIdx = inputText.search(/(^|\s)\/b\s/i);
    if (slashBIdx >= 0) {
      const actualSlash = inputText.indexOf('/b', slashBIdx);
      setInputText(inputText.slice(0, actualSlash).trimEnd());
    } else {
      const slashIdx2 = inputText.lastIndexOf('/');
      if (slashIdx2 >= 0) setInputText(inputText.slice(0, slashIdx2));
    }
  };

  const resolveTimestamp = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? new Date(parsed) : null;
    }
    if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }
    if (typeof (value as { seconds?: number }).seconds === 'number') {
      return new Date((value as { seconds: number }).seconds * 1000);
    }
    return null;
  };

  const formatTranscriptTime = (value: unknown): string => {
    const date = resolveTimestamp(value);
    if (!date) return 'unknown time';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const buildTranscript = (): string => {
    const lines: string[] = [];

    messages.forEach((message) => {
      const sender = message.from === 'admin' ? 'You' : (agentStatuses[message.from]?.displayName || message.from);
      lines.push(`[${formatTranscriptTime((message as any).createdAt)}] ${sender}: ${message.content}`);

      Object.entries(message.responses || {}).forEach(([agentId, response]) => {
        const responder = agentStatuses[agentId]?.displayName || agentId;
        const statusTag = response.status ? ` [${response.status}]` : '';
        if (response.content && response.content.trim()) {
          lines.push(`  ${AGENT_EMOJIS[agentId] || '🤖'} ${responder}: ${response.content}`);
        } else if (statusTag) {
          lines.push(`  ${AGENT_EMOJIS[agentId] || '🤖'} ${responder}${statusTag}`);
        }
      });

      lines.push('');
    });

    return lines.join('\n').trim();
  };

  const copyChatToClipboard = async () => {
    const transcript = buildTranscript();
    if (!transcript) return;

    try {
      await navigator.clipboard.writeText(transcript);
      setCopyButtonLabel('Copied!');
      setTimeout(() => setCopyButtonLabel('Copy chat'), 1400);
      return;
    } catch {
      const fallbackTextarea = document.createElement('textarea');
      fallbackTextarea.value = transcript;
      fallbackTextarea.setAttribute('readonly', '');
      fallbackTextarea.style.position = 'absolute';
      fallbackTextarea.style.left = '-9999px';
      document.body.appendChild(fallbackTextarea);
      fallbackTextarea.focus();
      fallbackTextarea.select();
      document.execCommand('copy');
      document.body.removeChild(fallbackTextarea);
      setCopyButtonLabel('Copied!');
      setTimeout(() => setCopyButtonLabel('Copy chat'), 1400);
    }
  };

  const confirmClose = () => {
    const hasActiveResponses = messages.some(msg =>
      Object.values(msg.responses || {}).some(r => r.status === 'processing')
    );
    setEndConfirmMessage(
      hasActiveResponses
        ? 'Some agents are still responding. End chat anyway?'
        : 'Are you sure you want to end this round table chat and generate minutes?'
    );
    setShowEndConfirm(true);
  };

  const closeConfirmed = () => {
    setShowEndConfirm(false);
    onClose(messages);
  };

  const cancelClose = () => setShowEndConfirm(false);

  const agentNames: Record<string, string> = {};
  participants.forEach(agentId => {
    agentNames[agentId] = agentStatuses[agentId]?.displayName || agentId;
  });

  // Filter mention suggestions
  const mentionSuggestions = participants.filter(agentId => {
    const name = (agentStatuses[agentId]?.displayName || agentId).toLowerCase();
    return name.includes(mentionFilter);
  });

  // Count total responses
  const totalResponses = messages.reduce((sum, msg) => {
    return sum + Object.values(msg.responses).filter(r => r.status === 'completed').length;
  }, 0);

  // Compute which agents are currently typing (pending or processing — NOT timed-out)
  const typingAgents: { id: string; name: string; emoji: string; color: string }[] = [];
  // Also compute agents whose response timed out this session (for a subtle hint)
  const timedOutAgents: { id: string; name: string; emoji: string }[] = [];
  messages.forEach(msg => {
    Object.entries(msg.responses).forEach(([agentId, response]) => {
      if (response.status === 'pending' || response.status === 'processing') {
        if (!typingAgents.find(a => a.id === agentId)) {
          typingAgents.push({
            id: agentId,
            name: agentNames[agentId] || agentId,
            emoji: AGENT_EMOJIS[agentId] || '🤖',
            color: AGENT_COLORS[agentId] || AGENT_COLORS.default,
          });
        }
      } else if (response.status === 'timed-out') {
        if (!timedOutAgents.find(a => a.id === agentId)) {
          timedOutAgents.push({
            id: agentId,
            name: agentNames[agentId] || agentId,
            emoji: AGENT_EMOJIS[agentId] || '🤖',
          });
        }
      }
    });
  });

  // ── Aggregate token usage from all participating agents ──
  const totalTokens = participants.reduce((sum, agentId) => {
    const usage = agentStatuses[agentId]?.tokenUsage;
    return sum + (usage?.totalTokens || 0);
  }, 0);
  const totalPromptTokens = participants.reduce((sum, agentId) => {
    const usage = agentStatuses[agentId]?.tokenUsage;
    return sum + (usage?.promptTokens || 0);
  }, 0);
  const totalCompletionTokens = participants.reduce((sum, agentId) => {
    const usage = agentStatuses[agentId]?.tokenUsage;
    return sum + (usage?.completionTokens || 0);
  }, 0);
  const totalCalls = participants.reduce((sum, agentId) => {
    const usage = agentStatuses[agentId]?.tokenUsage;
    return sum + (usage?.callCount || 0);
  }, 0);

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  return ReactDOM.createPortal(
    <>
    <div className="rt-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="rt-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="rt-header">
          <div className="rt-header-left">
            <div className="rt-header-icon">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="rt-title">Round Table</h2>
              <p className="rt-subtitle">
                {participants.length} agents
                {totalResponses > 0 && ` · ${totalResponses} responses`}
              </p>
            </div>
          </div>
          <div className="rt-header-right">
            {/* Token counter */}
            {totalTokens > 0 && (
              <div className="rt-token-counter" title={`Prompt: ${formatTokens(totalPromptTokens)} · Completion: ${formatTokens(totalCompletionTokens)} · ${totalCalls} API calls`}>
                <Zap className="w-3 h-3" />
                <span>{formatTokens(totalTokens)}</span>
              </div>
            )}
            {/* Agent presence dots */}
            <div className="rt-presence-dots">
              {participants.map(agentId => {
                const color = AGENT_COLORS[agentId] || AGENT_COLORS.default;
                const emoji = AGENT_EMOJIS[agentId] || '🤖';
                const name = agentStatuses[agentId]?.displayName || agentId;
                return (
                  <div
                    key={agentId}
                    className="rt-presence-dot"
                    title={name}
                    style={{ background: `${color}20`, borderColor: `${color}50` }}
                  >
                    <span>{emoji}</span>
                  </div>
                );
              })}
            </div>
            <button
              className="rt-copy-chat"
              onClick={copyChatToClipboard}
              title={copyButtonLabel}
              aria-label="Copy chat transcript"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button className="rt-close" onClick={confirmClose}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="rt-messages" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
          {messages.length === 0 && (
            <div className="rt-empty">
              <div className="rt-empty-icon">
                <MessageSquare className="w-7 h-7" />
              </div>
              <p className="rt-empty-title">Start a round table discussion</p>
              <p className="rt-empty-desc">
                Your message will be sent to all agents.
                Use <span className="rt-at-example">@name</span> to address a specific agent.
              </p>
            </div>
          )}

          {messages.map(message => (
            <MessageBubble
              key={message.id}
              message={message}
              agentNames={agentNames}
              agentEmojis={AGENT_EMOJIS}
              agentColors={AGENT_COLORS}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* New messages indicator */}
        {hasNewMessages && (
          <button className="rt-new-msg-btn" onClick={scrollToBottom}>
            <ChevronDown className="w-4 h-4" />
            <span>New messages</span>
          </button>
        )}

        {/* ── Typing indicator ── */}
        {typingAgents.length > 0 && (
          <div className="rt-typing-bar">
            <div className="rt-typing-avatars">
              {typingAgents.map(agent => (
                <span key={agent.id} className="rt-typing-emoji" title={agent.name}>
                  {agent.emoji}
                </span>
              ))}
            </div>
            <span className="rt-typing-text">
              {typingAgents.length === 1
                ? `${typingAgents[0].name} is typing`
                : typingAgents.length === 2
                  ? `${typingAgents[0].name} and ${typingAgents[1].name} are typing`
                  : `${typingAgents[0].name} and ${typingAgents.length - 1} others are typing`
              }
            </span>
            <div className="rt-typing-dots">
              <span /><span /><span />
            </div>
          </div>
        )}

        {/* ── Timed-out agent hint (runner was offline or turn-queue blocked) ── */}
        {timedOutAgents.length > 0 && typingAgents.length === 0 && (
          <div className="rt-timeout-bar">
            <span className="rt-timeout-icon">⚡</span>
            <span className="rt-timeout-text">
              {timedOutAgents.map(a => a.name).join(', ')}
              {' didn\'t respond in time'}
            </span>
          </div>
        )}


        {/* ── Mention dropdown ── */}
        {showMentions && mentionSuggestions.length > 0 && (
          <div className="rt-mention-dropdown">
            {mentionSuggestions.map(agentId => {
              const name = agentStatuses[agentId]?.displayName || agentId;
              const emoji = AGENT_EMOJIS[agentId] || '🤖';
              const color = AGENT_COLORS[agentId] || AGENT_COLORS.default;
              return (
                <button
                  key={agentId}
                  className="rt-mention-item"
                  onClick={() => insertMention(agentId, name)}
                >
                  <span className="rt-mention-emoji">{emoji}</span>
                  <span className="rt-mention-name" style={{ color }}>{name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Input ── */}
        <div className="rt-input-area">
          {/* Mode Switcher */}
          <div className="rt-mode-switcher">
            <button
              className={`rt-mode-pill ${chatMode === 'brainstorm' ? 'active' : ''}`}
              onClick={() => setChatMode('brainstorm')}
              data-mode="brainstorm"
            >
              <Lightbulb className="w-3 h-3" />
              Brainstorm
            </button>
            <button
              className={`rt-mode-pill ${chatMode === 'task' ? 'active' : ''}`}
              onClick={() => setChatMode('task')}
              data-mode="task"
            >
              <ListTodo className="w-3 h-3" />
              Task
            </button>
            <button
              className={`rt-mode-pill ${chatMode === 'command' ? 'active' : ''}`}
              onClick={() => setChatMode('command')}
              data-mode="command"
            >
              <Terminal className="w-3 h-3" />
              Command
            </button>
          </div>
          {/* Attached minutes chip */}
          {attachedMinutes && (
            <div className="rt-attached-chip">
              <FileText className="w-3 h-3" />
              <span>{attachedMinutes.executiveSummary?.slice(0, 50) || 'Meeting Minutes'}...</span>
              <button className="rt-chip-remove" onClick={() => setAttachedMinutes(null)}>✕</button>
            </div>
          )}

          {/* Minutes picker dropdown */}
          {showMinutesPicker && (
            <div className="rt-minutes-picker">
              <div className="rt-minutes-picker-header">
                <FileText className="w-3.5 h-3.5" />
                <span>Attach Meeting Minutes</span>
              </div>
              {loadingMinutes ? (
                <div className="rt-minutes-loading">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading minutes...</span>
                </div>
              ) : allMinutes.length === 0 ? (
                <div className="rt-minutes-empty">No saved meeting minutes yet</div>
              ) : (
                <div className="rt-minutes-list">
                  {allMinutes.map(m => {
                    const date = m.createdAt instanceof Date
                      ? m.createdAt
                      : (m.createdAt as any)?.toDate?.() || new Date();
                    return (
                      <button
                        key={m.id}
                        className="rt-minutes-item"
                        onClick={() => {
                          setAttachedMinutes(m);
                          setShowMinutesPicker(false);
                        }}
                      >
                        <div className="rt-minutes-item-top">
                          <span className="rt-minutes-date">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="rt-minutes-duration">{m.duration}</span>
                        </div>
                        <p className="rt-minutes-summary">
                          {m.executiveSummary?.slice(0, 80) || 'Meeting minutes'}...
                        </p>
                        <div className="rt-minutes-agents">
                          {m.participants.map(p => (
                            <span key={p} className="rt-minutes-agent-tag">{p}</span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Attached file chip */}
          {attachedFile && (
            <div className="rt-attached-chip rt-file-chip">
              <Code2 className="w-3 h-3" />
              <span>{attachedFile.path}</span>
              <span className="rt-file-size">{(attachedFile.size / 1024).toFixed(1)}KB</span>
              <button className="rt-chip-remove" onClick={() => setAttachedFile(null)}>✕</button>
            </div>
          )}

          {/* File browser dropdown */}
          {showFileBrowser && (
            <div className="rt-file-browser">
              <div className="rt-fb-header">
                {fileBrowserMode === 'search' ? (
                  <>
                    <Code2 className="w-3.5 h-3.5" style={{ color: '#818cf8' }} />
                    <span className="rt-fb-path">Search: {fileFilter || '...'}</span>
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span className="rt-fb-path">{fileBrowserPath}</span>
                    {fileBrowserPath !== '/' && (
                      <button className="rt-fb-up" onClick={() => {
                        const parent = fileBrowserPath.split('/').slice(0, -1).join('/') || '/';
                        browseDir(parent);
                      }}>↑ Up</button>
                    )}
                  </>
                )}
                <button className="rt-fb-close" onClick={() => setShowFileBrowser(false)}>✕</button>
              </div>
              {fileBrowserLoading ? (
                <div className="rt-fb-loading"><Loader2 className="w-4 h-4 animate-spin" /><span>Searching...</span></div>
              ) : fileBrowserMode === 'search' ? (
                <div className="rt-fb-list">
                  {searchResults.length === 0 && fileFilter.trim() ? (
                    <div className="rt-fb-empty">{fileFilter.trim().length < 2 ? 'Type to search files...' : 'No matching files'}</div>
                  ) : searchResults.length === 0 ? (
                    <div className="rt-fb-empty">Type a filename to search...</div>
                  ) : (
                    searchResults.map((item: any) => (
                      <button
                        key={item.path}
                        className="rt-fb-item"
                        onClick={() => {
                          if (item.isDirectory) {
                            setFileBrowserMode('browse');
                            browseDir(item.path);
                          } else {
                            selectFile(item.path);
                          }
                        }}
                      >
                        <span className="rt-fb-icon">{item.icon}</span>
                        <div className="rt-fb-info">
                          <span className="rt-fb-name">{item.name}</span>
                          <span className="rt-fb-parent">{item.parentDir}</span>
                        </div>
                        {!item.isDirectory && item.size != null && (
                          <span className="rt-fb-size">{(item.size / 1024).toFixed(1)}KB</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="rt-fb-list">
                  {fileBrowserItems
                    .filter(item => !fileFilter || item.name.toLowerCase().includes(fileFilter.toLowerCase()))
                    .map(item => (
                      <button
                        key={item.path}
                        className="rt-fb-item"
                        onClick={() => {
                          if (item.isDirectory) {
                            browseDir(item.path);
                            setFileFilter('');
                          } else {
                            selectFile(item.path);
                          }
                        }}
                      >
                        <span className="rt-fb-icon">{item.icon}</span>
                        <span className="rt-fb-name">{item.name}</span>
                        {item.isDirectory && <span className="rt-fb-count">{item.children} items</span>}
                        {!item.isDirectory && item.size != null && (
                          <span className="rt-fb-size">{(item.size / 1024).toFixed(1)}KB</span>
                        )}
                      </button>
                    ))}
                  {fileBrowserItems.filter(item => !fileFilter || item.name.toLowerCase().includes(fileFilter.toLowerCase())).length === 0 && (
                    <div className="rt-fb-empty">No matching files</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rt-input-row">
            <button
              className="rt-attach-btn"
              title="Attach meeting minutes"
              onClick={async () => {
                if (showMinutesPicker) {
                  setShowMinutesPicker(false);
                  return;
                }
                setShowMinutesPicker(true);
                if (allMinutes.length === 0) {
                  setLoadingMinutes(true);
                  try {
                    const mins = await meetingMinutesService.getAll();
                    setAllMinutes(mins);
                  } catch (e) {
                    console.error('Failed to load minutes:', e);
                  }
                  setLoadingMinutes(false);
                }
              }}
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              className="rt-at-btn"
              onClick={() => {
                const cur = inputText;
                setInputText(cur + '@');
                setShowMentions(true);
                setMentionFilter('');
                setTimeout(() => inputRef.current?.focus(), 10);
              }}
              title="Mention an agent"
            >
              <AtSign className="w-4 h-4" />
            </button>
            <textarea
              ref={inputRef}
              className="rt-textarea"
              placeholder={
                chatMode === 'brainstorm'
                  ? 'Set a goal + desired output (e.g. "Decide top 3 pilot metrics and owner")…'
                  : chatMode === 'task'
                    ? 'Describe a task… @mention an agent to assign'
                    : 'Send a command… @mention an agent to target'
              }
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              maxLength={2000}
              rows={1}
              disabled={sending}
            />
            <button
              className="rt-send"
              onClick={handleSend}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <div className="rt-spinner" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="rt-input-hint">
            <kbd>↵</kbd> to send · <kbd>⇧</kbd> + <kbd>↵</kbd> new line · <kbd>@</kbd> to mention
            {chatMode === 'brainstorm' && (
              <span className="rt-mode-hint">
                &nbsp;· Tip: start with Goal + Done-When so agents know when to stop.
              </span>
            )}
            {chatMode !== 'brainstorm' && (
              <span className="rt-mode-hint">
                &nbsp;· Mode: <strong>{chatMode}</strong> — {chatMode === 'task' ? 'creates a kanban task' : 'sends a direct command'}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>

      {showEndConfirm && (
        <div className="rt-confirm-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="rt-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="rt-confirm-title">End round table chat?</h3>
            <p className="rt-confirm-message">{endConfirmMessage}</p>
            <div className="rt-confirm-actions">
              <button className="rt-confirm-cancel" onClick={cancelClose}>
                Continue chat
              </button>
              <button className="rt-confirm-end" onClick={closeConfirmed}>
                End and generate minutes
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ═══ OVERLAY ═══ */
        .rt-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: rtFadeIn 0.25s ease-out;
        }

        @keyframes rtFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* ═══ MODAL ═══ */
        .rt-modal {
          width: 580px;
          max-width: 100%;
          height: 75vh;
          max-height: 680px;
          background: rgba(12, 15, 20, 0.97);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03),
            0 24px 80px rgba(0, 0, 0, 0.7),
            0 0 120px rgba(139, 92, 246, 0.06);
          animation: rtSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes rtSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ═══ HEADER ═══ */
        .rt-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .rt-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rt-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rt-token-counter {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 20px;
          background: rgba(234, 179, 8, 0.08);
          border: 1px solid rgba(234, 179, 8, 0.2);
          color: #eab308;
          font-size: 11px;
          font-weight: 600;
          font-family: 'SF Mono', 'Fira Code', monospace;
          cursor: default;
          transition: all 0.2s ease;
          animation: tokenPulse 2s ease-in-out infinite;
        }
        .rt-token-counter:hover {
          background: rgba(234, 179, 8, 0.14);
          border-color: rgba(234, 179, 8, 0.35);
        }
        @keyframes tokenPulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }

        .rt-header-icon {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.2));
          border: 1px solid rgba(139, 92, 246, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
        }

        .rt-title {
          font-size: 14px;
          font-weight: 700;
          color: #fafafa;
          margin: 0;
        }

        .rt-subtitle {
          font-size: 10px;
          color: #52525b;
          margin: 1px 0 0;
        }

        .rt-presence-dots {
          display: flex;
          gap: 4px;
        }

        .rt-presence-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1.5px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }

        .rt-close {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          color: #52525b;
          cursor: pointer;
          transition: all 0.15s;
        }

        .rt-close:hover {
          background: rgba(255, 255, 255, 0.04);
          color: #a1a1aa;
        }

        .rt-copy-chat {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          color: #52525b;
          cursor: pointer;
          transition: all 0.15s;
        }

        .rt-copy-chat:hover {
          background: rgba(255, 255, 255, 0.04);
          color: #a1a1aa;
        }

        .rt-copy-chat:active {
          transform: translateY(1px);
        }

        .rt-confirm-overlay {
          position: fixed;
          inset: 0;
          z-index: 10010;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(2, 6, 23, 0.78);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          animation: rtFadeIn 0.2s ease-out;
        }

        .rt-confirm-modal {
          width: min(430px, calc(100% - 36px));
          background: rgba(12, 15, 20, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          padding: 16px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.65);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .rt-confirm-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #fafafa;
        }

        .rt-confirm-message {
          margin: 0;
          font-size: 13px;
          color: #cbd5e1;
          line-height: 1.45;
        }

        .rt-confirm-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 8px;
        }

        .rt-confirm-cancel,
        .rt-confirm-end {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          background: transparent;
          color: #a1a1aa;
          transition: all 0.15s;
        }

        .rt-confirm-cancel:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #e4e4e7;
        }

        .rt-confirm-end {
          background: linear-gradient(135deg, #7c3aed, #ec4899);
          border-color: transparent;
          color: #fafafa;
        }

        .rt-confirm-end:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .rt-confirm-end:active {
          transform: translateY(0);
        }

        @media (max-width: 480px) {
          .rt-confirm-overlay {
            padding: 12px;
          }

          .rt-confirm-modal {
            width: 100%;
          }

          .rt-confirm-actions {
            flex-direction: column-reverse;
          }
        }

        /* ═══ MESSAGES ═══ */
        .rt-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 18px;
          min-height: 0;
          scrollbar-width: thin;
          scrollbar-color: rgba(63,63,70,0.3) transparent;
        }

        .rt-messages::-webkit-scrollbar { width: 5px; }
        .rt-messages::-webkit-scrollbar-track { background: transparent; }
        .rt-messages::-webkit-scrollbar-thumb {
          background: rgba(63,63,70,0.3);
          border-radius: 4px;
        }

        /* ═══ EMPTY STATE ═══ */
        .rt-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 200px;
          text-align: center;
          gap: 8px;
        }

        .rt-empty-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: rgba(139, 92, 246, 0.07);
          border: 1px solid rgba(139, 92, 246, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6d28d9;
          margin-bottom: 4px;
        }

        .rt-empty-title {
          font-size: 14px;
          font-weight: 600;
          color: #d4d4d8;
          margin: 0;
        }

        .rt-empty-desc {
          font-size: 12px;
          color: #52525b;
          margin: 0;
          max-width: 260px;
          line-height: 1.5;
        }

        .rt-at-example {
          color: #a78bfa;
          font-weight: 600;
        }

        /* ═══ MENTION DROPDOWN ═══ */
        .rt-mention-dropdown {
          position: absolute;
          bottom: 90px;
          left: 18px;
          right: 18px;
          background: rgba(24, 24, 27, 0.98);
          border: 1px solid rgba(63, 63, 70, 0.3);
          border-radius: 12px;
          padding: 4px;
          z-index: 10;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          animation: rtDropIn 0.15s ease-out;
        }

        @keyframes rtDropIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .rt-mention-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          border: none;
          background: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.1s;
        }

        .rt-mention-item:hover {
          background: rgba(139, 92, 246, 0.1);
        }

        .rt-mention-emoji { font-size: 16px; }
        .rt-mention-name { font-size: 13px; font-weight: 600; }

        /* ═══ INPUT AREA ═══ */
        .rt-input-area {
          padding: 12px 18px 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }

        /* ═══ MODE SWITCHER ═══ */
        .rt-mode-switcher {
          display: flex;
          gap: 4px;
          margin-bottom: 10px;
          padding: 3px;
          background: rgba(255,255,255,0.02);
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.04);
        }

        .rt-mode-pill {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.02em;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: #52525b;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .rt-mode-pill:hover {
          color: #a1a1aa;
          background: rgba(255,255,255,0.04);
        }

        /* Brainstorm active */
        .rt-mode-pill[data-mode="brainstorm"].active {
          background: rgba(139, 92, 246, 0.12);
          border-color: rgba(139, 92, 246, 0.3);
          color: #a78bfa;
          box-shadow: 0 0 12px rgba(139, 92, 246, 0.08);
        }

        /* Task active */
        .rt-mode-pill[data-mode="task"].active {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.3);
          color: #4ade80;
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.08);
        }

        /* Command active */
        .rt-mode-pill[data-mode="command"].active {
          background: rgba(245, 158, 11, 0.12);
          border-color: rgba(245, 158, 11, 0.3);
          color: #fbbf24;
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.08);
        }

        .rt-mode-hint {
          color: #71717a;
        }
        .rt-mode-hint strong {
          text-transform: capitalize;
          color: #a1a1aa;
        }

        .rt-input-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }

        .rt-at-btn {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          color: #52525b;
          cursor: pointer;
          transition: all 0.15s;
        }

        .rt-at-btn:hover {
          background: rgba(139,92,246,0.1);
          border-color: rgba(139,92,246,0.25);
          color: #a78bfa;
        }

        .rt-textarea {
          flex: 1;
          min-height: 36px;
          max-height: 100px;
          resize: none;
          background: rgba(24, 24, 27, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 8px 14px;
          color: #e4e4e7;
          font-size: 13px;
          font-family: inherit;
          line-height: 1.5;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .rt-textarea:focus {
          border-color: rgba(139, 92, 246, 0.35);
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.06);
        }

        .rt-textarea::placeholder { color: #3f3f46; }
        .rt-textarea:disabled { opacity: 0.4; cursor: not-allowed; }

        .rt-send {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #7c3aed, #6366f1);
          border: none;
          border-radius: 10px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .rt-send:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(124, 58, 237, 0.35);
        }

        .rt-send:active:not(:disabled) { transform: translateY(0); }
        .rt-send:disabled { opacity: 0.3; cursor: not-allowed; }

        .rt-input-hint {
          margin: 6px 0 0;
          font-size: 9px;
          color: #3f3f46;
          text-align: right;
        }

        .rt-input-hint kbd {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 3px;
          padding: 0px 4px;
          font-size: 9px;
          font-family: inherit;
          color: #52525b;
        }

        .rt-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.25);
          border-top-color: white;
          border-radius: 50%;
          animation: rtSpin 0.7s linear infinite;
        }

        @keyframes rtSpin {
          to { transform: rotate(360deg); }
        }

        /* ═══ TYPING INDICATOR ═══ */
        .rt-typing-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-top: 1px solid rgba(255,255,255,0.02);
          animation: rtTypingFadeIn 0.3s ease-out;
        }

        @keyframes rtTypingFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .rt-typing-avatars {
          display: flex;
          gap: 2px;
        }

        .rt-typing-emoji {
          font-size: 14px;
        }

        .rt-typing-text {
          font-size: 11px;
          color: #71717a;
          font-weight: 500;
        }

        .rt-typing-dots {
          display: flex;
          gap: 3px;
          margin-left: 2px;
        }

        .rt-typing-dots span {
          width: 4px;
          height: 4px;
          background: #52525b;
          border-radius: 50%;
          animation: rtDotBounce 1.3s infinite ease-in-out;
        }

        .rt-typing-dots span:nth-child(2) { animation-delay: 0.15s; }
        .rt-typing-dots span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes rtDotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
          30% { transform: translateY(-3px); opacity: 1; }
        }

        /* ── Timed-out bar (agent runner was offline or turn-queue expired) ── */
        .rt-timeout-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 18px;
          border-top: 1px solid rgba(255, 179, 0, 0.08);
          background: rgba(255, 179, 0, 0.03);
          animation: rtTypingFadeIn 0.3s ease-out;
        }

        .rt-timeout-icon {
          font-size: 11px;
          opacity: 0.6;
        }

        .rt-timeout-text {
          font-size: 11px;
          color: #a16207;
          font-weight: 500;
          opacity: 0.85;
        }

        /* ── Attachment UI ── */
        .rt-attach-btn {
          flex-shrink: 0; width: 32px; height: 32px;
          border-radius: 8px; border: none; background: transparent;
          color: #52525b; display: flex; align-items: center;
          justify-content: center; cursor: pointer; transition: all 0.15s;
        }
        .rt-attach-btn:hover { background: rgba(255,255,255,0.06); color: #a1a1aa; }

        .rt-attached-chip {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 10px; border-radius: 8px;
          background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.2);
          font-size: 11px; color: #a78bfa; margin-bottom: 4px;
        }
        .rt-attached-chip span {
          flex: 1; white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; min-width: 0;
        }
        .rt-chip-remove {
          background: none; border: none; color: #52525b;
          cursor: pointer; font-size: 11px; padding: 0 2px; flex-shrink: 0;
        }
        .rt-chip-remove:hover { color: #ef4444; }

        .rt-minutes-picker {
          position: absolute; bottom: 80px; left: 12px; right: 12px;
          background: #1a1a20; border: 1px solid #222228;
          border-radius: 14px; z-index: 21;
          box-shadow: 0 -6px 24px rgba(0,0,0,0.5);
          max-height: 320px; display: flex; flex-direction: column;
          animation: rtFade 0.15s ease-out;
        }
        .rt-minutes-picker-header {
          display: flex; align-items: center; gap: 6px;
          padding: 12px 14px; border-bottom: 1px solid #222228;
          font-size: 12px; font-weight: 600; color: #a1a1aa;
        }
        .rt-minutes-loading {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 24px; color: #52525b; font-size: 12px;
        }
        .rt-minutes-empty {
          padding: 24px; text-align: center;
          color: #3f3f46; font-size: 12px;
        }
        .rt-minutes-list { overflow-y: auto; flex: 1; }
        .rt-minutes-list::-webkit-scrollbar { width: 3px; }
        .rt-minutes-list::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
        .rt-minutes-item {
          display: block; width: 100%; padding: 10px 14px;
          border: none; border-bottom: 1px solid rgba(63,63,70,0.08);
          background: transparent; color: inherit; text-align: left;
          cursor: pointer; transition: background 0.12s;
        }
        .rt-minutes-item:hover { background: rgba(139,92,246,0.06); }
        .rt-minutes-item:last-child { border-bottom: none; }
        .rt-minutes-item-top {
          display: flex; justify-content: space-between;
          align-items: center; margin-bottom: 3px;
        }
        .rt-minutes-date { font-size: 11px; font-weight: 600; color: #e4e4e7; }
        .rt-minutes-duration { font-size: 10px; color: #52525b; }
        .rt-minutes-summary {
          font-size: 11px; color: #71717a; margin: 0 0 4px;
          line-height: 1.3; display: -webkit-box;
          -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .rt-minutes-agents { display: flex; gap: 4px; flex-wrap: wrap; }
        .rt-minutes-agent-tag {
          font-size: 9px; font-weight: 600; text-transform: capitalize;
          padding: 1px 6px; border-radius: 4px;
          background: rgba(63,63,70,0.2); color: #71717a;
        }

        /* ── New Messages Indicator ── */
        .rt-new-msg-btn {
          position: absolute; bottom: 90px; left: 50%; transform: translateX(-50%);
          display: flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: 20px;
          background: rgba(139,92,246,0.9); color: #fff;
          border: none; cursor: pointer; font-size: 11px; font-weight: 600;
          box-shadow: 0 4px 16px rgba(139,92,246,0.3);
          z-index: 20; animation: rtFade 0.2s ease-out;
          transition: background 0.15s;
        }
        .rt-new-msg-btn:hover { background: rgba(139,92,246,1); }

        /* ── File Browser ── */
        .rt-file-chip { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.2); color: #4ade80; }
        .rt-file-size { font-size: 9px; color: #52525b; flex-shrink: 0; }

        .rt-file-browser {
          position: absolute; bottom: 80px; left: 12px; right: 12px;
          background: #1a1a20; border: 1px solid #222228;
          border-radius: 14px; z-index: 22;
          box-shadow: 0 -6px 24px rgba(0,0,0,0.5);
          animation: rtFade 0.15s ease-out;
          max-height: 340px; display: flex; flex-direction: column;
        }
        .rt-fb-header {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 14px; border-bottom: 1px solid #222228;
          font-size: 11px; font-weight: 600; color: #a1a1aa;
        }
        .rt-fb-path {
          flex: 1; font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 11px; color: #a78bfa;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .rt-fb-up, .rt-fb-close {
          background: none; border: none; color: #52525b;
          cursor: pointer; font-size: 10px; font-weight: 600;
          padding: 3px 6px; border-radius: 4px; transition: all 0.12s;
        }
        .rt-fb-up:hover { background: rgba(139,92,246,0.1); color: #a78bfa; }
        .rt-fb-close:hover { color: #ef4444; }
        .rt-fb-loading {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 24px; color: #52525b; font-size: 12px;
        }
        .rt-fb-list { overflow-y: auto; flex: 1; }
        .rt-fb-list::-webkit-scrollbar { width: 3px; }
        .rt-fb-list::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
        .rt-fb-item {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 7px 14px; border: none;
          border-bottom: 1px solid rgba(63,63,70,0.06);
          background: transparent; color: inherit; text-align: left;
          cursor: pointer; transition: background 0.12s; font-size: 12px;
        }
        .rt-fb-item:hover { background: rgba(139,92,246,0.06); }
        .rt-fb-item:last-child { border-bottom: none; }
        .rt-fb-icon { font-size: 13px; flex-shrink: 0; width: 18px; text-align: center; }
        .rt-fb-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .rt-fb-name { color: #d4d4d8; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rt-fb-parent { font-size: 9px; color: #3f3f46; font-family: 'SF Mono', 'Fira Code', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rt-fb-count { font-size: 9px; color: #3f3f46; }
        .rt-fb-size { font-size: 9px; color: #3f3f46; flex-shrink: 0; }
        .rt-fb-empty { padding: 20px; text-align: center; color: #3f3f46; font-size: 11px; }

        @media (max-width: 768px) {
          .rt-overlay { padding: 0; }
          .rt-modal {
            width: 100vw;
            height: 100vh;
            max-height: 100vh;
            border-radius: 0;
          }
        }
      `}</style>
    </>,
    document.body
  );
};
