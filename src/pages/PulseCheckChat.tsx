import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../hooks/useUser';
import { db } from '../api/firebase/config';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore';

interface ChatMessage {
  id: string;
  content: string;
  isFromUser: boolean;
  timestamp: number;
  messageType?: string;
}

interface MentalNote {
  id: string;
  text: string;
  isPrivate: boolean;
  createdAt?: number;
}

const PulseCheckChat: React.FC = () => {
  const currentUser = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Mental notes state
  const [mentalNotes, setMentalNotes] = useState<MentalNote[]>([]);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteIsPrivate, setNoteIsPrivate] = useState(true);
  const [selectedNote, setSelectedNote] = useState<MentalNote | null>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages]);

  // Initial assistant greeting like iOS PulseCheck
  useEffect(() => {
    if (!currentUser) return;
    if (messages.length > 0) return;
    const name =
      // @ts-ignore prefer displayName then preferredName then username
      (currentUser as any).preferredName || currentUser.displayName || currentUser.username || 'athlete';
    const greeting = `Hey ${name} — I’m your mental mindset coach. What’s one focus for today?`;
    const aiMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      content: greeting,
      isFromUser: false,
      timestamp: Math.floor(Date.now() / 1000),
      messageType: 'greeting'
    };
    setMessages([aiMsg]);
  }, [currentUser]);

  // Load mental notes
  useEffect(() => {
    const loadNotes = async () => {
      if (!currentUser?.id) return;
      try {
        const notesRef = collection(db, 'pulsecheck-mental-notes', currentUser.id, 'notes');
        const q = query(notesRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const notes: MentalNote[] = snap.docs.map(d => ({
          id: d.id,
          text: (d.data() as any).text || '',
          isPrivate: !!(d.data() as any).isPrivate,
          createdAt: (d.data() as any).createdAt?.seconds
            ? (d.data() as any).createdAt.seconds
            : Math.floor(Date.now() / 1000)
        }));
        setMentalNotes(notes);
      } catch (e) {
        // Silently ignore for MVP
        console.error('[PulseCheck] Failed to load mental notes', e);
      }
    };
    loadNotes();
  }, [currentUser?.id]);

  const handleSaveNote = async () => {
    if (!currentUser?.id || !noteText.trim()) return;
    try {
      const notesRef = collection(db, 'pulsecheck-mental-notes', currentUser.id, 'notes');
      const docRef = await addDoc(notesRef, {
        text: noteText.trim(),
        isPrivate: noteIsPrivate,
        createdAt: serverTimestamp()
      });
      const newNote: MentalNote = { id: docRef.id, text: noteText.trim(), isPrivate: noteIsPrivate, createdAt: Math.floor(Date.now() / 1000) };
      setMentalNotes(prev => [newNote, ...prev]);
      setIsNoteModalOpen(false);
      setNoteText('');
      setNoteIsPrivate(true);
      // Show confirmation in chat
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          content: noteIsPrivate ? 'Saved a private mental note.' : 'Saved a mental note shared with your coach.',
          isFromUser: false,
          timestamp: Math.floor(Date.now() / 1000),
          messageType: 'system'
        }
      ]);
    } catch (e) {
      console.error('[PulseCheck] Failed to save note', e);
    }
  };

  const handleDeleteNote = async (note: MentalNote) => {
    if (!currentUser?.id) return;
    try {
      await deleteDoc(doc(db, 'pulsecheck-mental-notes', currentUser.id, 'notes', note.id));
      setMentalNotes(prev => prev.filter(n => n.id !== note.id));
      setSelectedNote(null);
    } catch (e) {
      console.error('[PulseCheck] Failed to delete note', e);
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto h-screen flex flex-col">
        <header className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h1 className="text-lg font-semibold">PulseCheck</h1>
          <button
            onClick={() => setIsNoteModalOpen(true)}
            className="text-sm px-3 py-1.5 rounded-lg bg-[#E0FE10] text-black hover:bg-[#d0ee00]"
          >
            Add Mental Note
          </button>
        </header>

        {/* Mental Notes bar */}
        <div className="border-b border-zinc-800 bg-black/60">
          <div className="px-4 py-3 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs uppercase tracking-wider text-zinc-400 mr-2">Mental Notes</span>
            {mentalNotes.length === 0 ? (
              <span className="text-zinc-500 text-sm">No notes yet</span>
            ) : (
              mentalNotes.map(note => (
                <button
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${note.isPrivate ? 'bg-zinc-800 text-zinc-200' : 'bg-[#E0FE10] text-black'}`}
                  title={note.text}
                >
                  {note.text.length > 48 ? note.text.slice(0, 48) + '…' : note.text}
                </button>
              ))
            )}
          </div>
        </div>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(m => (
            <div key={m.id} className={`max-w-[80%] ${m.isFromUser ? 'ml-auto' : ''}`}>
              <div className={`${m.isFromUser ? 'bg-[#E0FE10] text-black' : 'bg-zinc-900 text-white'} rounded-2xl px-4 py-3`}> {m.content}</div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-zinc-800">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder="Type your message..."
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 outline-none"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="bg-[#E0FE10] text-black rounded-xl px-5 font-semibold disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Create Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-xl w-full max-w-lg">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Mental Note</h2>
              <button onClick={() => setIsNoteModalOpen(false)} className="text-zinc-400 hover:text-white">×</button>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Write a note you want to remember…"
                className="w-full bg-zinc-800 rounded-lg p-3 outline-none min-h-[120px]"
              />
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={noteIsPrivate} onChange={e => setNoteIsPrivate(e.target.checked)} />
                Private (only you). Uncheck to share with your coach.
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsNoteModalOpen(false)} className="px-3 py-2 bg-zinc-800 rounded-lg">Cancel</button>
                <button onClick={handleSaveNote} disabled={!noteText.trim()} className="px-3 py-2 bg-[#E0FE10] text-black rounded-lg disabled:opacity-50">Save Note</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Note Modal */}
      {selectedNote && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-xl w-full max-w-lg">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Mental Note</h2>
              <button onClick={() => setSelectedNote(null)} className="text-zinc-400 hover:text-white">×</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-zinc-100 leading-relaxed whitespace-pre-wrap">{selectedNote.text}</p>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setSelectedNote(null)} className="px-3 py-2 bg-zinc-800 rounded-lg">Close</button>
                <button onClick={() => handleDeleteNote(selectedNote)} className="px-3 py-2 bg-red-600 rounded-lg">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PulseCheckChat;


