import React, { useEffect, useRef, useState } from 'react';
import { useUser } from '../../hooks/useUser';
import { Brain, Send } from 'lucide-react';

interface ChatMessage {
  id: string;
  content: string;
  isFromUser: boolean;
  timestamp: number;
  messageType?: string;
}

const Chat: React.FC = () => {
  const currentUser = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
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
    <div className="flex flex-col h-full bg-black">
      {/* Main chat area */}
      <div className="flex-1 overflow-hidden">
        <div 
          ref={scrollerRef} 
          className="h-full overflow-y-auto"
          style={{ overscrollBehavior: 'contain' }}
        >
          {/* Welcome/Empty State */}
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center px-4">
              <div className="text-center max-w-2xl">
                <div className="w-16 h-16 bg-[#E0FE10]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Brain className="w-8 h-8 text-[#E0FE10]" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Welcome to PulseCheck</h2>
                <p className="text-zinc-400 text-lg">
                  Your AI sports psychology companion. Ask me anything about mental performance, mindset, or training psychology.
                </p>
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
                      <div className="text-white leading-relaxed whitespace-pre-wrap">
                        {m.content}
                      </div>
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
              className="absolute right-2 bottom-2 w-8 h-8 bg-[#E0FE10] text-black rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-lime-400 transition-colors"
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
  );
};

export default Chat;


