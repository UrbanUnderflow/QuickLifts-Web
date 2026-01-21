import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useUser } from '../../hooks/useUser';
import { Brain, Send, Heart, Star, Target, Gauge, Flame, TrendingUp, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { db } from '../../api/firebase/config';
import { collection, getDocs, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import EscalationModal from './EscalationModal';
import NoraIntroCard from './NoraIntroCard';
import { EscalationTier, EscalationCategory } from '../../api/firebase/escalation/types';
import { MentalExercise } from '../../api/firebase/mentaltraining/types';
import { ExerciseInstructionCard } from '../mentaltraining';

const STORAGE_KEY_NORA_INTRO = 'pulsecheck_has_seen_nora_intro_card';
const STORAGE_KEY_ACTIVE_EXERCISE = 'pulsecheck_active_exercise';

interface ChatMessage {
  id: string;
  content: string;
  isFromUser: boolean;
  timestamp: number;
  messageType?: string;
  mentalNote?: MentalNote; // For mental note action cards
  exercise?: MentalExercise; // For exercise instruction cards
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

// Severity color mapping - Enhanced with Chromatic Glass colors
const getSeverityColor = (severity: MentalNote['severity']) => {
  switch (severity) {
    case 'low': return { 
      bg: 'rgba(34, 197, 94, 0.1)', 
      border: 'rgba(34, 197, 94, 0.3)', 
      icon: 'rgb(34, 197, 94)',
      glow: 'rgba(34, 197, 94, 0.2)'
    };
    case 'medium': return { 
      bg: 'rgba(249, 115, 22, 0.1)', 
      border: 'rgba(249, 115, 22, 0.3)', 
      icon: 'rgb(249, 115, 22)',
      glow: 'rgba(249, 115, 22, 0.2)'
    };
    case 'high': return { 
      bg: 'rgba(239, 68, 68, 0.1)', 
      border: 'rgba(239, 68, 68, 0.3)', 
      icon: 'rgb(239, 68, 68)',
      glow: 'rgba(239, 68, 68, 0.2)'
    };
    default: return { 
      bg: 'rgba(113, 113, 122, 0.1)', 
      border: 'rgba(113, 113, 122, 0.3)', 
      icon: 'rgb(113, 113, 122)',
      glow: 'rgba(113, 113, 122, 0.2)'
    };
  }
};

// Calculate days since last discussed
const getDaysSince = (timestamp: number): number => {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  return Math.floor(diff / (60 * 60 * 24));
};

// Floating Orb Component for ambient lighting
const FloatingOrb: React.FC<{
  color: string;
  size: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  delay?: number;
}> = ({ color, size, position, delay = 0 }) => {
  return (
    <motion.div
      className={`absolute ${size} rounded-full blur-3xl pointer-events-none opacity-30`}
      style={{ 
        backgroundColor: color,
        ...position
      }}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.2, 0.35, 0.2],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        delay,
        ease: "easeInOut"
      }}
    />
  );
};

// Escalation response interface
interface EscalationResponse {
  tier: EscalationTier;
  category: EscalationCategory;
  reason?: string;
  confidence: number;
  shouldEscalate: boolean;
}

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
  
  // Escalation state
  const [escalationModal, setEscalationModal] = useState<{
    isOpen: boolean;
    tier: EscalationTier;
    category: EscalationCategory;
    reason?: string;
  }>({
    isOpen: false,
    tier: EscalationTier.None,
    category: EscalationCategory.General
  });
  const [escalationProcessing, setEscalationProcessing] = useState(false);
  const [currentEscalationId, setCurrentEscalationId] = useState<string | null>(null);
  const [hasActiveEscalation, setHasActiveEscalation] = useState(false);
  
  // Nora intro card state
  const [showNoraIntro, setShowNoraIntro] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY_NORA_INTRO) !== 'true';
  });
  
  // Active exercise state (for writing exercises that redirect here)
  const [activeExercise, setActiveExercise] = useState<MentalExercise | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY_ACTIVE_EXERCISE);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  const handleDismissNoraIntro = () => {
    localStorage.setItem(STORAGE_KEY_NORA_INTRO, 'true');
    setShowNoraIntro(false);
  };
  
  // Handle starting an exercise from external source (e.g., mental training page)
  const handleStartExerciseInChat = useCallback((exercise: MentalExercise) => {
    // Store in localStorage so it persists across page navigation
    localStorage.setItem(STORAGE_KEY_ACTIVE_EXERCISE, JSON.stringify(exercise));
    setActiveExercise(exercise);
    
    // Add the exercise instruction card to chat
    const exerciseMsg: ChatMessage = {
      id: `exercise-${Date.now()}`,
      content: '',
      isFromUser: false,
      timestamp: Math.floor(Date.now() / 1000),
      messageType: 'exerciseInstruction',
      exercise: exercise,
    };
    setMessages(prev => [...prev, exerciseMsg]);
    
    // Prompt the user to begin
    setTimeout(() => {
      const promptMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        content: `Let's work through "${exercise.name}" together. Take your time with each prompt above, then write your thoughts to me. I'll give you feedback as you go. Ready when you are! 🧠`,
        isFromUser: false,
        timestamp: Math.floor(Date.now() / 1000),
      };
      setMessages(prev => [...prev, promptMsg]);
    }, 500);
  }, []);
  
  // Check for pending exercise on mount (from navigation)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check URL params for exercise data
    const urlParams = new URLSearchParams(window.location.search);
    const exerciseParam = urlParams.get('exercise');
    
    if (exerciseParam && !activeExercise) {
      try {
        const exercise = JSON.parse(decodeURIComponent(exerciseParam));
        handleStartExerciseInChat(exercise);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {
        console.error('[PulseCheck] Failed to parse exercise from URL', e);
      }
    }
  }, [activeExercise, handleStartExerciseInChat]);
  
  // Clear exercise when complete
  const handleExerciseComplete = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_EXERCISE);
    setActiveExercise(null);
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Initial AI greeting like iOS
  useEffect(() => {
    if (!currentUser) return;
    if (messages.length > 0) return;
    const name = (currentUser as any).preferredName || currentUser.displayName || currentUser.username || 'athlete';
    const greeting = `Hey ${name} — I'm Nora, your AI mental performance coach. What's one focus for today?`;
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

  // Handle escalation modal consent acceptance
  const handleAcceptConsent = useCallback(async () => {
    if (!currentUser || !currentEscalationId) return;
    
    setEscalationProcessing(true);
    try {
      const res = await fetch('/.netlify/functions/pulsecheck-escalation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'consent',
          escalationId: currentEscalationId,
          userId: currentUser.id,
          consent: true
        })
      });
      
      const json = await res.json();
      if (res.ok && json.success) {
        // Add confirmation message to chat
        const confirmMsg: ChatMessage = {
          id: Math.random().toString(36).slice(2),
          content: json.message || 'Thank you. A mental health professional will reach out soon. In the meantime, I\'m here if you want to keep talking.',
          isFromUser: false,
          timestamp: Math.floor(Date.now() / 1000)
        };
        setMessages(prev => [...prev, confirmMsg]);
        setEscalationModal({ isOpen: false, tier: EscalationTier.None, category: EscalationCategory.General });
      }
    } catch (e) {
      console.error('[PulseCheck] Consent acceptance failed:', e);
    } finally {
      setEscalationProcessing(false);
    }
  }, [currentUser, currentEscalationId]);

  // Handle escalation modal consent decline
  const handleDeclineConsent = useCallback(async () => {
    if (!currentUser || !currentEscalationId) return;
    
    setEscalationProcessing(true);
    try {
      const res = await fetch('/.netlify/functions/pulsecheck-escalation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'consent',
          escalationId: currentEscalationId,
          userId: currentUser.id,
          consent: false
        })
      });
      
      const json = await res.json();
      if (res.ok && json.success) {
        // Add acknowledgment message to chat
        const declineMsg: ChatMessage = {
          id: Math.random().toString(36).slice(2),
          content: json.message || 'I understand. Remember, you can always change your mind. I\'m here whenever you want to talk.',
          isFromUser: false,
          timestamp: Math.floor(Date.now() / 1000)
        };
        setMessages(prev => [...prev, declineMsg]);
        setEscalationModal({ isOpen: false, tier: EscalationTier.None, category: EscalationCategory.General });
      }
    } catch (e) {
      console.error('[PulseCheck] Consent decline failed:', e);
      setEscalationModal({ isOpen: false, tier: EscalationTier.None, category: EscalationCategory.General });
    } finally {
      setEscalationProcessing(false);
    }
  }, [currentUser, currentEscalationId]);

  // Handle escalation response from chat API
  const handleEscalation = useCallback(async (escalation: EscalationResponse, userMessage: string) => {
    if (!escalation || !escalation.shouldEscalate) return;
    
    // Set active escalation state for visual cues (Tier 2 and 3)
    if (escalation.tier === EscalationTier.ElevatedRisk || escalation.tier === EscalationTier.CriticalRisk) {
      setHasActiveEscalation(true);
    }
    
    // For Tier 2 (Elevated) - show consent modal
    if (escalation.tier === EscalationTier.ElevatedRisk) {
      // Create escalation record first
      try {
        const res = await fetch('/.netlify/functions/pulsecheck-escalation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            userId: currentUser?.id,
            conversationId,
            tier: escalation.tier,
            category: escalation.category,
            triggerContent: userMessage,
            classificationReason: escalation.reason,
            classificationConfidence: escalation.confidence
          })
        });
        
        const json = await res.json();
        if (res.ok && json.escalationId) {
          setCurrentEscalationId(json.escalationId);
        }
      } catch (e) {
        console.error('[PulseCheck] Failed to create escalation record:', e);
      }
      
      setEscalationModal({
        isOpen: true,
        tier: escalation.tier,
        category: escalation.category,
        reason: escalation.reason
      });
    }
    
    // For Tier 3 (Critical) - show modal immediately (escalation record already created by backend)
    if (escalation.tier === EscalationTier.CriticalRisk) {
      setEscalationModal({
        isOpen: true,
        tier: escalation.tier,
        category: escalation.category,
        reason: escalation.reason
      });
      setEscalationProcessing(true);
      
      // The backend already creates the record and initiates handoff for Tier 3
      // We just need to show the modal with crisis resources
      setTimeout(() => {
        setEscalationProcessing(false);
      }, 2000);
    }
  }, [currentUser, conversationId]);

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

    // Log message being sent
    console.log('📤 Sending message to Nora:', text);
    console.log('─'.repeat(60));

    try {
      const res = await fetch('/.netlify/functions/pulsecheck-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, message: text, conversationId })
      });
      
      let json;
      try {
        json = await res.json();
      } catch (parseError) {
        console.error('[PulseCheck Chat] Failed to parse response:', parseError);
        const text = await res.text();
        console.error('[PulseCheck Chat] Response text:', text);
        throw new Error('Invalid response from server');
      }
      
      if (res.ok) {
        if (json.conversationId && json.conversationId !== conversationId) setConversationId(json.conversationId);
        const aiMsg: ChatMessage = {
          id: Math.random().toString(36).slice(2),
          content: json.assistantMessage || "I'm here to support you. Can you share more?",
          isFromUser: false,
          timestamp: Math.floor(Date.now() / 1000)
        };
        setMessages(prev => [...prev, aiMsg]);
        
        // ========== ESCALATION TIER LOGGING ==========
        const tier = json.escalation?.tier ?? 0;
        const tierName = tier === 0 ? 'None' : tier === 1 ? 'Monitor-Only' : tier === 2 ? 'Elevated Risk' : tier === 3 ? 'Critical Risk' : 'Unknown';
        const category = json.escalation?.category || 'N/A';
        const confidence = json.escalation?.confidence ?? 0;
        const reason = json.escalation?.reason || 'N/A';
        const shouldEscalate = json.escalation?.shouldEscalate ?? false;
        
        // Prominent console log for tier
        console.log(
          `%c🚨 ESCALATION TIER: ${tier} (${tierName})`,
          `font-size: 16px; font-weight: bold; color: ${tier === 0 ? '#71717A' : tier === 1 ? '#3B82F6' : tier === 2 ? '#F97316' : '#EF4444'}; padding: 4px 8px; background: ${tier === 0 ? 'rgba(113, 113, 122, 0.1)' : tier === 1 ? 'rgba(59, 130, 246, 0.1)' : tier === 2 ? 'rgba(249, 115, 22, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border-radius: 4px;`
        );
        console.log('📝 Message:', text);
        console.log('📊 Classification Details:', {
          tier: `${tier} (${tierName})`,
          category,
          confidence: `${(confidence * 100).toFixed(1)}%`,
          shouldEscalate,
          reason
        });
        console.log('🔍 Full Escalation Object:', json.escalation || 'No escalation data');
        console.log('─'.repeat(60));
        
        // Handle escalation if present
        if (json.escalation && json.escalation.shouldEscalate) {
          console.log('[PulseCheck Chat] ✅ Triggering escalation handler');
          handleEscalation(json.escalation, text);
        } else {
          console.log('[PulseCheck Chat] ⏭️ No escalation action needed:', {
            hasEscalation: !!json.escalation,
            shouldEscalate: json.escalation?.shouldEscalate,
            reason: !json.escalation ? 'No escalation object' : !json.escalation.shouldEscalate ? 'shouldEscalate is false' : 'Unknown'
          });
        }
      } else {
        console.error('❌ [PulseCheck Chat] Server error:', {
          status: res.status,
          statusText: res.statusText,
          error: json.error,
          detail: json.detail,
          type: json.type
        });
        // Log escalation tier even on error if available
        if (json.escalation) {
          const tier = json.escalation?.tier ?? 0;
          const tierName = tier === 0 ? 'None' : tier === 1 ? 'Monitor-Only' : tier === 2 ? 'Elevated Risk' : tier === 3 ? 'Critical Risk' : 'Unknown';
          console.log(`⚠️ Escalation tier detected despite error: ${tier} (${tierName})`);
        }
        const aiMsg: ChatMessage = {
          id: Math.random().toString(36).slice(2),
          content: 'Something went wrong. Please try again shortly.',
          isFromUser: false,
          timestamp: Math.floor(Date.now() / 1000)
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (e) {
      console.error('[PulseCheck Chat] Network/request error:', e);
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
    <div className="flex flex-col h-full bg-[#0a0a0b] relative overflow-hidden">
      {/* Ambient Floating Orbs - Chromatic Glass Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <FloatingOrb 
          color={hasActiveEscalation ? "#F97316" : "#E0FE10"} 
          size="w-[400px] h-[400px]" 
          position={{ top: '-15%', left: '-10%' }} 
          delay={0} 
        />
        <FloatingOrb 
          color={hasActiveEscalation ? "#FB923C" : "#3B82F6"} 
          size="w-[300px] h-[300px]" 
          position={{ top: '40%', right: '-5%' }} 
          delay={2} 
        />
        <FloatingOrb 
          color={hasActiveEscalation ? "#F59E0B" : "#8B5CF6"} 
          size="w-[250px] h-[250px]" 
          position={{ bottom: '10%', left: '20%' }} 
          delay={4} 
        />
      </div>

      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxwYXRoIGQ9Ik0wIDBoMzAwdjMwMEgweiIgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuMDUiLz48L3N2Zz4=')]" />

      {/* Main chat area */}
      <div className="flex-1 overflow-hidden relative z-10">
        <div 
          ref={scrollerRef} 
          className="h-full overflow-y-auto"
          style={{ overscrollBehavior: 'contain' }}
        >
          {/* Mental Notes bar at top - Glassmorphic */}
          {mentalNotes.length > 0 && (
            <div className="sticky top-0 z-10">
              {/* Glass surface */}
              <div className="backdrop-blur-xl bg-zinc-900/40 border-b border-white/10">
                {/* Chromatic reflection line */}
                <div 
                  className="absolute top-0 left-0 right-0 h-[1px] opacity-40"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(224,254,16,0.5), rgba(59,130,246,0.5), transparent)' }}
                />
                
                <div className="max-w-3xl mx-auto px-4 py-3">
                  <div className="flex items-center gap-2">
                    {/* Left Arrow - Glassmorphic button */}
                    <motion.button
                      onClick={() => scrollMentalNotes('left')}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                      aria-label="Scroll left"
                    >
                      <ChevronLeft className="w-4 h-4 text-white/80" />
                    </motion.button>

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
                          <motion.button
                            key={note.id}
                            onClick={() => setSelectedNote(note)}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className="relative flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl transition-all group"
                            style={{
                              backgroundColor: colors.bg,
                              border: `1px solid ${colors.border}`
                            }}
                            title={note.content}
                          >
                            {/* Glow effect on hover */}
                            <div 
                              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-md -z-10"
                              style={{ backgroundColor: colors.glow }}
                            />
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
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Right Arrow - Glassmorphic button */}
                    <motion.button
                      onClick={() => scrollMentalNotes('right')}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                      aria-label="Scroll right"
                    >
                      <ChevronRight className="w-4 h-4 text-white/80" />
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nora Intro Card - shown for new users */}
          <AnimatePresence>
            {showNoraIntro && (
              <div className="max-w-3xl mx-auto pt-6">
                <NoraIntroCard onDismiss={handleDismissNoraIntro} />
              </div>
            )}
          </AnimatePresence>

          {/* Messages */}
          {messages.length > 0 && (
            <div className="max-w-3xl mx-auto px-4 py-8">
              <div className="space-y-6">
                <AnimatePresence>
                  {messages.map((m, index) => (
                    <motion.div 
                      key={m.id} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index === messages.length - 1 ? 0.1 : 0 }}
                      className="flex gap-4 items-start"
                    >
                      {/* AI Avatar with glow */}
                      {!m.isFromUser && (
                        <div className="relative flex-shrink-0">
                          {/* Glow behind avatar - warm when escalation active */}
                          <motion.div 
                            className={`absolute inset-0 w-8 h-8 rounded-full blur-lg transition-colors duration-1000`}
                            style={{ 
                              backgroundColor: hasActiveEscalation ? 'rgba(249, 115, 22, 0.25)' : 'rgba(224, 254, 16, 0.3)'
                            }}
                            animate={hasActiveEscalation ? {
                              opacity: [0.25, 0.4, 0.25],
                              scale: [1, 1.1, 1]
                            } : {}}
                            transition={hasActiveEscalation ? {
                              duration: 3,
                              repeat: Infinity,
                              ease: "easeInOut"
                            } : {}}
                          />
                          <div className="relative w-8 h-8 rounded-full flex items-center justify-center overflow-hidden">
                            {/* Gradient border effect - warm when escalation active */}
                            <motion.div 
                              className="absolute inset-0 rounded-full transition-colors duration-1000"
                              style={{ 
                                background: hasActiveEscalation 
                                  ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.3), rgba(251, 146, 60, 0.15))'
                                  : 'linear-gradient(135deg, rgba(224, 254, 16, 0.3), rgba(224, 254, 16, 0.1))'
                              }}
                              animate={hasActiveEscalation ? {
                                opacity: [0.3, 0.5, 0.3]
                              } : {}}
                              transition={hasActiveEscalation ? {
                                duration: 2.5,
                                repeat: Infinity,
                                ease: "easeInOut"
                              } : {}}
                            />
                            <div className="absolute inset-[1px] bg-[#0a0a0b] rounded-full flex items-center justify-center">
                              <Brain 
                                className={`w-4 h-4 transition-colors duration-1000 ${hasActiveEscalation ? 'text-[#F97316]' : 'text-[#E0FE10]'}`}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Message Content */}
                      <div className={`flex-1 ${m.isFromUser ? 'ml-12' : ''}`}>
                        {m.messageType === 'exerciseInstruction' && m.exercise ? (
                          // Exercise Instruction Card
                          <ExerciseInstructionCard 
                            exercise={m.exercise}
                          />
                        ) : m.messageType === 'mentalNoteActionCard' && m.mentalNote ? (
                          // Mental Note Action Card - Premium Glassmorphic
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative max-w-md group"
                          >
                            {/* Glow effect */}
                            <div 
                              className="absolute -inset-1 rounded-3xl blur-xl opacity-30"
                              style={{ backgroundColor: getSeverityColor(m.mentalNote.severity).glow }}
                            />
                            
                            {/* Glass card */}
                            <div className="relative rounded-2xl overflow-hidden backdrop-blur-xl bg-zinc-900/60 border border-white/10">
                              {/* Chromatic top line */}
                              <div 
                                className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
                                style={{ background: `linear-gradient(90deg, transparent, ${getSeverityColor(m.mentalNote.severity).icon}80, transparent)` }}
                              />
                              
                              {/* Header */}
                              <div className="p-4 border-b border-white/5">
                                <div className="flex items-start gap-3">
                                  {(() => {
                                    const Icon = getCategoryIcon(m.mentalNote.category);
                                    const colors = getSeverityColor(m.mentalNote.severity);
                                    return (
                                      <>
                                        <div 
                                          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                                          style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
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
                                            <span className="text-white/20">•</span>
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
                                    <h4 className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Action Items</h4>
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
                          </motion.div>
                        ) : (
                          // Regular text message
                          <div className={`text-white leading-relaxed whitespace-pre-wrap ${m.isFromUser ? 'text-right' : ''}`}>
                            {m.isFromUser ? (
                              <span className="inline-block px-4 py-2 rounded-2xl bg-zinc-800/80 backdrop-blur-sm border border-white/5">
                                {m.content}
                              </span>
                            ) : (
                              <span>{m.content}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* User Avatar */}
                      {m.isFromUser && !m.messageType && (
                        <div className="relative flex-shrink-0">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10">
                            {currentUser?.profileImage?.profileImageURL ? (
                              <img 
                                src={currentUser.profileImage.profileImageURL}
                                alt="You"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                                <span className="text-white text-sm font-semibold">
                                  {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Typing indicator - Chromatic style */}
                {sending && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4 items-start"
                  >
                    <div className="relative flex-shrink-0">
                      <div 
                        className={`absolute inset-0 w-8 h-8 rounded-full blur-lg animate-pulse transition-colors duration-1000`}
                        style={{ 
                          backgroundColor: hasActiveEscalation ? 'rgba(249, 115, 22, 0.3)' : 'rgba(224, 254, 16, 0.3)'
                        }}
                      />
                      <div className="relative w-8 h-8 rounded-full flex items-center justify-center overflow-hidden">
                        <div 
                          className="absolute inset-0 rounded-full transition-colors duration-1000"
                          style={{ 
                            background: hasActiveEscalation 
                              ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.3), rgba(251, 146, 60, 0.1))'
                              : 'linear-gradient(135deg, rgba(224, 254, 16, 0.3), rgba(224, 254, 16, 0.1))'
                          }}
                        />
                        <div className="absolute inset-[1px] bg-[#0a0a0b] rounded-full flex items-center justify-center">
                          <Brain 
                            className={`w-4 h-4 transition-colors duration-1000 ${hasActiveEscalation ? 'text-[#F97316]' : 'text-[#E0FE10]'}`}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex gap-1.5 items-center py-2">
                        <motion.div 
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                          className="w-2 h-2 bg-[#E0FE10]/60 rounded-full"
                        />
                        <motion.div 
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                          className="w-2 h-2 bg-[#E0FE10]/60 rounded-full"
                        />
                        <motion.div 
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                          className="w-2 h-2 bg-[#E0FE10]/60 rounded-full"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area - Fixed at bottom with Glassmorphic styling */}
      <div className="relative z-10 pb-16 md:pb-0">
        {/* Gradient fade */}
        <div 
          className="absolute bottom-full left-0 right-0 h-20 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #0a0a0b, transparent)' }}
        />
        
        {/* Glass surface */}
        <div className="backdrop-blur-xl bg-zinc-900/40 border-t border-white/10">
          {/* Chromatic reflection line */}
          <div 
            className="absolute top-0 left-0 right-0 h-[1px] opacity-30"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(224,254,16,0.3), transparent)' }}
          />
          
          <div className="max-w-3xl mx-auto px-4 py-4">
            <div className="relative group">
              {/* Glow effect on focus - warm when escalation active */}
              <motion.div 
                className={`absolute -inset-1 rounded-2xl blur transition-opacity ${hasActiveEscalation ? 'opacity-20' : 'opacity-0 group-focus-within:opacity-100'}`}
                style={{ 
                  background: hasActiveEscalation
                    ? 'linear-gradient(90deg, rgba(249, 115, 22, 0), rgba(249, 115, 22, 0.15), rgba(249, 115, 22, 0))'
                    : 'linear-gradient(90deg, rgba(224, 254, 16, 0), rgba(224, 254, 16, 0.1), rgba(224, 254, 16, 0))'
                }}
                animate={hasActiveEscalation ? {
                  opacity: [0.15, 0.25, 0.15]
                } : {}}
                transition={hasActiveEscalation ? {
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                } : {}}
              />
              {!hasActiveEscalation && (
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#E0FE10]/0 via-[#E0FE10]/10 to-[#E0FE10]/0 opacity-0 group-focus-within:opacity-100 blur transition-opacity" />
              )}
              
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
                  placeholder="Message Nora..."
                  rows={1}
                  className={`w-full bg-zinc-900/60 backdrop-blur-sm border rounded-xl px-4 py-3 pr-12 outline-none resize-none text-white placeholder:text-zinc-500 transition-all ${
                    hasActiveEscalation 
                      ? 'border-[#F97316]/20 focus:border-[#F97316]/40 focus:bg-zinc-900/80' 
                      : 'border-white/10 focus:border-[#E0FE10]/30 focus:bg-zinc-900/80'
                  }`}
                  style={{
                    minHeight: '52px',
                    maxHeight: '200px'
                  }}
                />
                <motion.button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all overflow-hidden"
                  style={{
                    background: input.trim() ? 'linear-gradient(135deg, #E0FE10, #c4e00f)' : 'rgba(255,255,255,0.1)'
                  }}
                >
                  <Send className={`w-4 h-4 ${input.trim() ? 'text-black' : 'text-white/50'}`} />
                </motion.button>
              </div>
            </div>
            <p className="text-zinc-600 text-xs text-center mt-2">
              PulseCheck can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* View Note Modal - Premium Glassmorphic */}
    <AnimatePresence>
      {selectedNote && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop with blur */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedNote(null)}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg"
          >
            {/* Glow effect */}
            <div 
              className="absolute -inset-2 rounded-3xl blur-2xl opacity-40"
              style={{ backgroundColor: getSeverityColor(selectedNote.severity).glow }}
            />
            
            {/* Glass card */}
            <div className="relative rounded-2xl overflow-hidden backdrop-blur-xl bg-zinc-900/90 border border-white/10">
              {/* Chromatic top line */}
              <div 
                className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
                style={{ background: `linear-gradient(90deg, transparent, ${getSeverityColor(selectedNote.severity).icon}80, transparent)` }}
              />
              
              {/* Header */}
              <div className="p-6 border-b border-white/5">
                <div className="flex items-start gap-3">
                  {(() => {
                    const Icon = getCategoryIcon(selectedNote.category);
                    const colors = getSeverityColor(selectedNote.severity);
                    return (
                      <>
                        <div 
                          className="relative flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
                        >
                          {/* Glow */}
                          <div 
                            className="absolute inset-0 rounded-full blur-lg opacity-50"
                            style={{ backgroundColor: colors.glow }}
                          />
                          <Icon className="relative w-6 h-6" style={{ color: colors.icon }} />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-lg font-semibold text-white mb-1">{selectedNote.title}</h2>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="capitalize font-medium" style={{ color: colors.icon }}>
                              {selectedNote.category}
                            </span>
                            <span className="text-white/20">•</span>
                            <span className="text-zinc-400">
                              Last discussed {getDaysSince(selectedNote.lastDiscussed)} days ago
                            </span>
                          </div>
                        </div>
                        <motion.button 
                          onClick={() => setSelectedNote(null)} 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                        >
                          ×
                        </motion.button>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Description</h3>
                  <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap">{selectedNote.content}</p>
                </div>

                {selectedNote.actionItems && selectedNote.actionItems.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Action Items</h3>
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
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <motion.button 
                    onClick={() => selectedNote && handleAskAboutNote(selectedNote)} 
                    disabled={sending}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-black"
                    style={{ background: 'linear-gradient(135deg, #E0FE10, #c4e00f)' }}
                  >
                    <Sparkles className="w-4 h-4" />
                    Ask PulseCheck
                  </motion.button>
                  
                  <div className="flex gap-2">
                    <motion.button 
                      onClick={() => setSelectedNote(null)} 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium transition-all"
                    >
                      Close
                    </motion.button>
                    <motion.button 
                      onClick={() => selectedNote && handleDeleteNote(selectedNote)} 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 font-medium transition-all"
                    >
                      Delete
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Escalation Modal */}
    <EscalationModal
      isOpen={escalationModal.isOpen}
      tier={escalationModal.tier}
      category={escalationModal.category}
      reason={escalationModal.reason}
      onAcceptConsent={handleAcceptConsent}
      onDeclineConsent={handleDeclineConsent}
      onClose={() => {
        // Only allow closing for Tier 2 (Elevated)
        if (escalationModal.tier === EscalationTier.ElevatedRisk) {
          setEscalationModal({ isOpen: false, tier: EscalationTier.None, category: EscalationCategory.General });
        }
      }}
      isProcessing={escalationProcessing}
    />
    </>
  );
};

export default Chat;
