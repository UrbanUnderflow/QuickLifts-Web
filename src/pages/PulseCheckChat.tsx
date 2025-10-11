import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../hooks/useUser';

interface ChatMessage {
  id: string;
  content: string;
  isFromUser: boolean;
  timestamp: number;
  messageType?: string;
}

const PulseCheckChat: React.FC = () => {
  const currentUser = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages]);

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
        <header className="p-4 border-b border-zinc-800">
          <h1 className="text-lg font-semibold">PulseCheck — Chat</h1>
        </header>
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
    </div>
  );
};

export default PulseCheckChat;


