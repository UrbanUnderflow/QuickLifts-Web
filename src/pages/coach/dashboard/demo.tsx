import React from 'react';
import Head from 'next/head';
import AthleteCard from '../../../components/AthleteCard';
import { coachService, DailySentimentRecord } from '../../../api/firebase/coach/service';

type DemoMessage = { sender: 'user' | 'ai'; content: string; time?: string };
type DemoSession = { id: string; label: string; daysAgo: number; sentimentScore: number; messages: DemoMessage[] };
type DemoAthlete = {
  id: string;
  name: string;
  email: string;
  conversations: number;
  sessions: number;
  weeklyGoalPct: number;
  lastConversationAt: Date;
  demoSessions: DemoSession[];
};

const formatLastActive = (date?: Date): string => {
  if (!date) return 'Never';
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  const months = Math.floor(diffDays / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
};

const demoAthletes: DemoAthlete[] = [
  {
    id: 'a1',
    name: 'Tremaine',
    email: 'tremaine.grant@gmail.com',
    conversations: 586,
    sessions: 133,
    weeklyGoalPct: 0,
    lastConversationAt: new Date(new Date().getFullYear(), 8, 24), // Sep 24
    demoSessions: [
      { id: 's1', label: 'Sep 24, 2025', daysAgo: 0, sentimentScore: 0.3, messages: [
        { sender: 'ai', content: "I'm here to continue supporting your mental game. What's on your mind today?", time: '10:58 AM' },
        { sender: 'user', content: 'I want to do some mental exercising', time: '10:58 AM' },
        { sender: 'ai', content: 'Great! Visualization can sharpen focus and build confidence.' }
      ]},
      { id: 's2', label: 'Sep 12, 2025', daysAgo: 12, sentimentScore: 0.6, messages: [
        { sender: 'user', content: 'Feeling dialed in this week!' },
        { sender: 'ai', content: 'Love that momentum. What helped most?' }
      ]}
    ]
  },
  {
    id: 'a2',
    name: 'Alex Morgan',
    email: 'alex.morgan@example.com',
    conversations: 214,
    sessions: 64,
    weeklyGoalPct: 40,
    lastConversationAt: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 3),
    demoSessions: [
      { id: 's3', label: 'Today', daysAgo: 0, sentimentScore: -0.2, messages: [
        { sender: 'user', content: "Was a tough day. Couldn't hit my targets." },
        { sender: 'ai', content: 'Thanks for sharing. Let’s break down one small win from today.' }
      ]},
      { id: 's4', label: '3 days ago', daysAgo: 3, sentimentScore: 0.1, messages: [
        { sender: 'user', content: 'Back on track a bit.' },
        { sender: 'ai', content: 'Nice. What changed vs the prior session?' }
      ]}
    ]
  },
  {
    id: 'a3',
    name: 'Jordan King',
    email: 'jordan.king@example.com',
    conversations: 98,
    sessions: 21,
    weeklyGoalPct: 75,
    lastConversationAt: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 10),
    demoSessions: [
      { id: 's5', label: '10 days ago', daysAgo: 10, sentimentScore: 0.8, messages: [
        { sender: 'user', content: 'Crushed my workout today.' },
        { sender: 'ai', content: 'Amazing. What felt strongest—breathing, pacing, or mindset?' }
      ]},
      { id: 's6', label: '12 days ago', daysAgo: 12, sentimentScore: 0.0, messages: [
        { sender: 'user', content: 'Neutral day, nothing special.' },
        { sender: 'ai', content: 'Steady consistency compounds. One small tweak for next time?' }
      ]}
    ]
  },
  {
    id: 'a4',
    name: 'Sam Lee',
    email: 'sam.lee@example.com',
    conversations: 41,
    sessions: 12,
    weeklyGoalPct: 55,
    lastConversationAt: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1),
    demoSessions: [
      { id: 's7', label: 'Yesterday', daysAgo: 1, sentimentScore: -0.4, messages: [
        { sender: 'user', content: 'Feeling overwhelmed.' },
        { sender: 'ai', content: 'Let’s try a 2‑minute box-breathing reset and reframe one thought.' }
      ]}
    ]
  },
  {
    id: 'a5',
    name: 'Taylor Brooks',
    email: 'taylor.brooks@example.com',
    conversations: 302,
    sessions: 87,
    weeklyGoalPct: 20,
    lastConversationAt: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 21),
    demoSessions: [
      { id: 's8', label: '3 weeks ago', daysAgo: 21, sentimentScore: 0.5, messages: [
        { sender: 'user', content: 'Confidence improving.' },
        { sender: 'ai', content: 'Let’s lock that in with a pre-performance routine.' }
      ]}
    ]
  },
  {
    id: 'a6',
    name: 'Riley Chen',
    email: 'riley.chen@example.com',
    conversations: 156,
    sessions: 44,
    weeklyGoalPct: 90,
    lastConversationAt: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 5),
    demoSessions: [
      { id: 's9', label: '5 days ago', daysAgo: 5, sentimentScore: 0.2, messages: [
        { sender: 'user', content: 'Energy ok, motivation medium.' },
        { sender: 'ai', content: 'Pick one metric to celebrate today. Progress > perfection.' }
      ]}
    ]
  },
];

const CoachDemoDashboard: React.FC = () => {
  React.useEffect(() => {
    // Monkey-patch sentiment endpoints for demo athletes only
    const originalGet = coachService.getDailySentimentHistory.bind(coachService);
    const originalProcess = (coachService as any).processSentimentForAthlete?.bind(coachService);

    const toYYYYMMDD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const buildHistory = (athlete: DemoAthlete, days = 28): DailySentimentRecord[] => {
      const today = new Date();
      const map = new Map<number, { score: number; count: number }>();
      athlete.demoSessions.forEach(s => map.set(s.daysAgo, { score: s.sentimentScore, count: s.messages.length }));
      const out: DailySentimentRecord[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = map.get(i);
        out.push({
          id: `${athlete.id}_${toYYYYMMDD(d)}`,
          userId: athlete.id,
          date: toYYYYMMDD(d),
          sentimentScore: key ? key.score : 0,
          messageCount: key ? key.count : 0,
          lastAnalyzedAt: d,
          createdAt: d,
          updatedAt: d
        });
      }
      return out; // newest first (i=0 .. 27)
    };

    coachService.getDailySentimentHistory = (async (userId: string, days: number = 28) => {
      const a = demoAthletes.find(x => x.id === userId);
      if (!a) return originalGet(userId, days);
      return buildHistory(a, days);
    }) as any;

    // Optional: mock process call as no-op returning same as get
    (coachService as any).processSentimentForAthlete = async (userId: string, days: number = 28) => {
      const a = demoAthletes.find(x => x.id === userId);
      if (!a && originalProcess) return originalProcess(userId, days);
      return buildHistory(a!, days);
    };

    return () => {
      coachService.getDailySentimentHistory = originalGet;
      if (originalProcess) (coachService as any).processSentimentForAthlete = originalProcess;
    };
  }, []);
  return (
    <div className="min-h-screen bg-black text-white">
      <Head>
        <title>Coach Dashboard Demo | Pulse</title>
      </Head>
      <div className="container mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Coach Dashboard (Demo)</h1>
          <p className="text-zinc-400 text-sm mt-1">This page uses mock data for walkthroughs and demos.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {demoAthletes.map(a => (
            <AthleteCard
              key={a.id}
              athlete={{
                id: a.id,
                displayName: a.name,
                email: a.email,
                conversationCount: a.conversations,
                totalSessions: a.sessions,
                weeklyGoalProgress: a.weeklyGoalPct,
                lastActiveDate: a.lastConversationAt
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CoachDemoDashboard;


