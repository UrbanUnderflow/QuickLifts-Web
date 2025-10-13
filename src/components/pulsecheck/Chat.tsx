import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../../hooks/useUser';
import { Brain, Send, Heart, Star, Target, Gauge, Flame, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '../../api/firebase/config';
import { collection, getDocs, deleteDoc, doc, orderBy, query } from 'firebase/firestore';

interface ChatMessage {
  id: string;
  content: string;
  isFromUser: boolean;
  timestamp: number;
  messageType?: string;
  mentalNote?: MentalNote; // For mental note action cards
}

interface MentalNote {
  id: string;
  title: string;
  content: string;
  category: 'anxiety' | 'confidence' | 'focus' | 'pressure' | 'motivation' | 'performance' | 'general';
  severity: 'low' | 'medium' | 'high';
  status: 'active' | 'improving' | 'resolved' | 'monitoring' | 'declined';
  createdAt: number;
  lastDiscussed: number;
  userId: string;
  relatedMessageIds?: string[];
  actionItems?: string[];
  tags?: string[];
}

// Category icon mapping
const getCategoryIcon = (category: MentalNote['category']) => {
  switch (category) {
    case 'anxiety': return Heart;
    case 'confidence': return Star;
    case 'focus': return Target;
    case 'pressure': return Gauge;
    case 'motivation': return Flame;
    case 'performance': return TrendingUp;
    case 'general': return Brain;
    default: return Brain;
  }
};

// Severity color mapping
const getSeverityColor = (severity: MentalNote['severity']) => {
  switch (severity) {
    case 'low': return { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.3)', icon: 'rgb(34, 197, 94)' };
    case 'medium': return { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', icon: 'rgb(249, 115, 22)' };
    case 'high': return { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', icon: 'rgb(239, 68, 68)' };
    default: return { bg: 'rgba(113, 113, 122, 0.1)', border: 'rgba(113, 113, 122, 0.3)', icon: 'rgb(113, 113, 122)' };
  }
};

// Calculate days since last discussed
const getDaysSince = (timestamp: number): number => {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  return Math.floor(diff / (60 * 60 * 24));
};

const Chat: React.FC = () => {
  const currentUser = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const mentalNotesScrollRef = useRef<HTMLDivElement>(null);
  // Mental notes state
  const [mentalNotes, setMentalNotes] = useState<MentalNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<MentalNote | null>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Initial AI greeting like iOS
  useEffect(() => {
    if (!currentUser) return;
    if (messages.length > 0) return;
    const name = (currentUser as any).preferredName || currentUser.displayName || currentUser.username || 'athlete';
    const greeting = `Hey ${name} — I’m your mental mindset coach. What’s one focus for today?`;
    setMessages([{ id: Math.random().toString(36).slice(2), content: greeting, isFromUser: false, timestamp: Math.floor(Date.now() / 1000), messageType: 'greeting' }]);
  }, [currentUser]);

  // Load mental notes
  useEffect(() => {
    const loadNotes = async () => {
      if (!currentUser?.id) {
        console.log('[PulseCheck][Notes] Skipping load - no currentUser');
        return;
      }
      try {
        const pathSegs = ['user-mental-notes', currentUser.id, 'notes'];
        console.log('[PulseCheck][Notes] Loading notes', { userId: currentUser.id, path: pathSegs.join('/') });
        const notesRef = collection(db, ...pathSegs as [string, string, string]);
        const q = query(notesRef, orderBy('lastDiscussed', 'desc'));
        const snap = await getDocs(q);
        console.log('[PulseCheck][Notes] Snapshot size:', snap.size);
        const notes: MentalNote[] = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || 'Untitled Note',
            content: data.content || '',
            category: (data.category as MentalNote['category']) || 'general',
            severity: (data.severity as MentalNote['severity']) || 'medium',
            status: (data.status as MentalNote['status']) || 'active',
            createdAt: data.createdAt || Math.floor(Date.now() / 1000),
            lastDiscussed: data.lastDiscussed || data.createdAt || Math.floor(Date.now() / 1000),
            userId: data.userId || currentUser.id,
            relatedMessageIds: data.relatedMessageIds || [],
            actionItems: data.actionItems || [],
            tags: data.tags || []
          };
        }).filter(note => 
          // Filter to only show active, improving, and monitoring status (like iOS)
          note.status === 'active' || note.status === 'improving' || note.status === 'monitoring'
        );
        console.log('[PulseCheck][Notes] Parsed notes count:', notes.length, notes);
        setMentalNotes(notes);
      } catch (e) {
        console.error('[PulseCheck][Notes] Failed to load mental notes', e);
      }
    };
    loadNotes();
  }, [currentUser?.id]);

  const handleDeleteNote = async (note: MentalNote) => {
    if (!currentUser?.id) return;
    try {
      await deleteDoc(doc(db, 'user-mental-notes', currentUser.id, 'notes', note.id));
      setMentalNotes(prev => prev.filter(n => n.id !== note.id));
      setSelectedNote(null);
    } catch (e) {
      console.error('[PulseCheck] Failed to delete note', e);
    }
  };

  const handleAskAboutNote = async (note: MentalNote) => {
    if (!currentUser || sending) return;
    
    // Add the mental note action card to the chat
    const actionCardMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      content: '', // Empty content since we'll render the action card
      isFromUser: true,
      timestamp: Math.floor(Date.now() / 1000),
      messageType: 'mentalNoteActionCard',
      mentalNote: note
    };
    
    setMessages(prev => [...prev, actionCardMsg]);
    setSelectedNote(null); // Close the modal
    setSending(true);

    try {
      // Send the request to AI to discuss this mental note
      const prompt = `I'd like to discuss my mental note: "${note.title}". ${note.content}`;
      
      const res = await fetch('/.netlify/functions/pulsecheck-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: currentUser.id, 
          message: prompt, 
          conversationId,
          mentalNoteId: note.id // Pass the mental note ID for context
        })
      });
      
      const json = await res.json();
      if (res.ok) {
        if (json.conversationId && json.conversationId !== conversationId) setConversationId(json.conversationId);
        const aiMsg: ChatMessage = {
          id: Math.random().toString(36).slice(2),
          content: json.assistantMessage || "Let's talk about this. How have you been feeling about this lately?",
          isFromUser: false,
          timestamp: Math.floor(Date.now() / 1000)
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        const aiMsg: ChatMessage = {
          id: Math.random().toString(36).slice(2),
          content: 'Something went wrong. Please try again shortly.',
          isFromUser: false,
          timestamp: Math.floor(Date.now() / 1000)
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (e) {
      const aiMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        content: 'Network error. Please try again.',
        isFromUser: false,
        timestamp: Math.floor(Date.now() / 1000)
      };
      setMessages(prev => [...prev, aiMsg]);
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    if (!input.trim() || !currentUser || sending) return;
    const text = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      content: text,
      isFromUser: true,
      timestamp: Math.floor(Date.now() / 1000)
    };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch('/.netlify/functions/pulsecheck-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, message: text, conversationId })
      });
      const json = await res.json();
      if (res.ok) {
        if (json.conversationId && json.conversationId !== conversationId) setConversationId(json.conversationId);
        const aiMsg: ChatMessage = {
          id: Math.random().toString(36).slice(2),
          content: json.assistantMessage || "I'm here to support you. Can you share more?",
          isFromUser: false,
          timestamp: Math.floor(Date.now() / 1000)
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        const aiMsg: ChatMessage = {
          id: Math.random().toString(36).slice(2),
          content: 'Something went wrong. Please try again shortly.',
          isFromUser: false,
          timestamp: Math.floor(Date.now() / 1000)
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (e) {
      const aiMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        content: 'Network error. Please try again.',
        isFromUser: false,
        timestamp: Math.floor(Date.now() / 1000)
      };
      setMessages(prev => [...prev, aiMsg]);
    } finally {
      setSending(false);
    }
  };

  const scrollMentalNotes = (direction: 'left' | 'right') => {
    if (!mentalNotesScrollRef.current) return;
    const scrollAmount = 200;
    const newScrollLeft = direction === 'left' 
      ? mentalNotesScrollRef.current.scrollLeft - scrollAmount
      : mentalNotesScrollRef.current.scrollLeft + scrollAmount;
    
    mentalNotesScrollRef.current.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  return (
    <>
    <div className="flex flex-col h-full bg-black">
      {/* Main chat area */}
      <div className="flex-1 overflow-hidden">
        <div 
          ref={scrollerRef} 
          className="h-full overflow-y-auto"
          style={{ overscrollBehavior: 'contain' }}
        >
          {/* Mental Notes bar at top */}
          {mentalNotes.length > 0 && (
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur border-b border-zinc-800">
              <div className="max-w-3xl mx-auto px-4 py-3">
                <div className="flex items-center gap-2">
                  {/* Left Arrow */}
                  <button
                    onClick={() => scrollMentalNotes('left')}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>

                  {/* Mental Notes Container */}
                  <div 
                    ref={mentalNotesScrollRef}
                    className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide"
                  >
                    {mentalNotes.slice(0, 5).map(note => {
                      const Icon = getCategoryIcon(note.category);
                      const colors = getSeverityColor(note.severity);
                      const daysSince = getDaysSince(note.lastDiscussed);
                      
                      return (
                        <button
                          key={note.id}
                          onClick={() => setSelectedNote(note)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl transition-all hover:scale-105"
                          style={{
                            backgroundColor: colors.bg,
                            border: `1px solid ${colors.border}`
                          }}
                          title={note.content}
                        >
                          <Icon 
                            className="w-3.5 h-3.5 flex-shrink-0" 
                            style={{ color: colors.icon }}
                          />
                          <span className="text-sm font-medium text-white whitespace-nowrap">
                            {note.title}
                          </span>
                          {daysSince > 1 && (
                            <span className="text-xs text-zinc-400">
                              {daysSince}d
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Arrow */}
                  <button
                    onClick={() => scrollMentalNotes('right')}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="max-w-3xl mx-auto px-4 py-8">
              <div className="space-y-6">
                {messages.map(m => (
                  <div key={m.id} className="flex gap-4 items-start">
                    {/* Avatar */}
                    {!m.isFromUser && (
                      <div className="flex-shrink-0 w-8 h-8 bg-[#E0FE10]/10 rounded-full flex items-center justify-center">
                        <Brain className="w-5 h-5 text-[#E0FE10]" />
                      </div>
                    )}
                    
                    {/* Message Content */}
                    <div className={`flex-1 ${m.isFromUser ? 'ml-12' : ''}`}>
                      {m.messageType === 'mentalNoteActionCard' && m.mentalNote ? (
                        // Mental Note Action Card
                        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden max-w-md">
                          {/* Header */}
                          <div className="p-4 border-b border-zinc-800">
                            <div className="flex items-start gap-3">
                              {(() => {
                                const Icon = getCategoryIcon(m.mentalNote.category);
                                const colors = getSeverityColor(m.mentalNote.severity);
                                return (
                                  <>
                                    <div 
                                      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                                      style={{ backgroundColor: colors.bg }}
                                    >
                                      <Icon className="w-5 h-5" style={{ color: colors.icon }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-base font-semibold text-white mb-1">
                                        {m.mentalNote.title}
                                      </h3>
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="capitalize" style={{ color: colors.icon }}>
                                          {m.mentalNote.category}
                                        </span>
                                        <span className="text-zinc-600">•</span>
                                        <span className="text-zinc-400">
                                          Last discussed {getDaysSince(m.mentalNote.lastDiscussed)} days ago
                                        </span>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Content */}
                          <div className="p-4 space-y-3">
                            <p className="text-sm text-zinc-300 leading-relaxed">
                              {m.mentalNote.content}
                            </p>

                            {m.mentalNote.actionItems && m.mentalNote.actionItems.length > 0 && (
                              <div className="pt-2">
                                <h4 className="text-xs font-medium text-zinc-400 mb-2">Action Items</h4>
                                <ul className="space-y-1.5">
                                  {m.mentalNote.actionItems.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-xs text-zinc-400">
                                      <span className="text-[#E0FE10] mt-0.5">•</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        // Regular text message
                        <div className="text-white leading-relaxed whitespace-pre-wrap">
                          {m.content}
                        </div>
                      )}
                    </div>

                    {/* User Avatar */}
                    {m.isFromUser && (
                      <div className="flex-shrink-0 w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Typing indicator */}
                {sending && (
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-[#E0FE10]/10 rounded-full flex items-center justify-center">
                      <Brain className="w-5 h-5 text-[#E0FE10]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex gap-1 items-center py-2">
                        <div className="w-2 h-2 bg-zinc-600 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-zinc-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-zinc-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area - Fixed at bottom */}
      <div className="border-t border-zinc-800 bg-black pb-16 md:pb-0">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="relative">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Message PulseCheck..."
              rows={1}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 pr-12 outline-none focus:border-[#E0FE10]/50 resize-none text-white placeholder:text-zinc-500"
              style={{
                minHeight: '52px',
                maxHeight: '200px'
              }}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#E0FE10] text-black rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-lime-400 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-zinc-500 text-xs text-center mt-2">
            PulseCheck can make mistakes. Check important info.
          </p>
        </div>
      </div>
    </div>

    {/* View Note Modal */}
    {selectedNote && (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-2xl w-full max-w-lg border border-zinc-800">
          {/* Header */}
          <div className="p-6 border-b border-zinc-800">
            <div className="flex items-start gap-3">
              {(() => {
                const Icon = getCategoryIcon(selectedNote.category);
                const colors = getSeverityColor(selectedNote.severity);
                return (
                  <>
                    <div 
                      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: colors.bg }}
                    >
                      <Icon className="w-5 h-5" style={{ color: colors.icon }} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold text-white mb-1">{selectedNote.title}</h2>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="capitalize" style={{ color: colors.icon }}>
                          {selectedNote.category}
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-400">
                          Last discussed {getDaysSince(selectedNote.lastDiscussed)} days ago
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedNote(null)} 
                      className="text-zinc-400 hover:text-white text-2xl leading-none"
                    >
                      ×
                    </button>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Description</h3>
              <p className="text-zinc-100 leading-relaxed whitespace-pre-wrap">{selectedNote.content}</p>
            </div>

            {selectedNote.actionItems && selectedNote.actionItems.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Action Items</h3>
                <ul className="space-y-2">
                  {selectedNote.actionItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-zinc-300">
                      <span className="text-[#E0FE10] mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4">
              <button 
                onClick={() => selectedNote && handleAskAboutNote(selectedNote)} 
                disabled={sending}
                className="px-4 py-2 bg-[#E0FE10] hover:bg-lime-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Brain className="w-4 h-4" />
                Ask PulseCheck about this
              </button>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedNote(null)} 
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => selectedNote && handleDeleteNote(selectedNote)} 
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default Chat;


