import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AthleteCard from '../../../components/AthleteCard';
import { coachService, DailySentimentRecord } from '../../../api/firebase/coach/service';
import { FaBars, FaTimes, FaUsers } from 'react-icons/fa';

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
  const [activeTab, setActiveTab] = React.useState<'dashboard'|'referrals'|'earnings'|'staff'|'inbox'|'profile'>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [mockReady, setMockReady] = React.useState(false);
  const allDemoAthletes = React.useMemo(() => {
    const firstNames = ['Ava','Liam','Olivia','Noah','Emma','Elijah','Sophia','Mateo','Isabella','Lucas','Mia','Aiden','Amelia','Ethan','Harper','James','Evelyn','Benjamin','Camila','Michael','Gianna','Daniel','Luna','Henry','Aria','Jackson','Scarlett','Sebastian','Layla','Jack','Chloe','Levi','Ellie','Alexander','Nora','Owen','Hazel','Wyatt','Zoey','Julian','Riley','Leo','Victoria','David','Lily','Isaac','Aurora','Joseph','Violet'];
    const lastNames = ['Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Turner'];
    const base = [...demoAthletes];
    // Expand to a 100-athlete roster for demo purposes
    let idx = base.length + 1;
    while (base.length < 100) {
      const n = idx;
      const fname = firstNames[(n * 7) % firstNames.length];
      const lname = lastNames[(n * 11) % lastNames.length];
      const name = `${fname} ${lname}`;
      const emailLocal = `${fname}.${lname}`.toLowerCase().replace(/[^a-z.]/g,'');
      const weekly = Math.min(100, Math.max(0, (n * 7) % 101));
      const conversations = 10 + ((n * 13) % 350);
      const sessions = 3 + ((n * 5) % 90);
      const daysAgo = (n * 3) % 28;
      base.push({
        id: `a${n}`,
        name,
        email: `${emailLocal}@example.com`,
        conversations,
        sessions,
        weeklyGoalPct: weekly,
        lastConversationAt: new Date(Date.now() - daysAgo * 86400000),
        demoSessions: [
          { id: `s${n}_1`, label: `${daysAgo} days ago`, daysAgo, sentimentScore: ((n % 5) - 2) * 0.2, messages: [
            { sender: 'user', content: 'Checking in on training today.' },
            { sender: 'ai', content: 'Nice work—keep your warm-up consistent.' }
          ]},
          { id: `s${n}_2`, label: `${Math.max(0, daysAgo-5)} days ago`, daysAgo: Math.max(0, daysAgo-5), sentimentScore: ((n % 3) - 1) * 0.3, messages: [
            { sender: 'user', content: 'Felt better than last week.' },
            { sender: 'ai', content: 'Great—log one takeaway for next session.' }
          ]}
        ]
      });
      idx++;
    }
    return base;
  }, []);
  React.useEffect(() => {
    // Monkey-patch sentiment endpoints for demo athletes only
    const originalGet = coachService.getDailySentimentHistory.bind(coachService);
    const originalProcess = (coachService as any).processSentimentForAthlete?.bind(coachService);
    const originalGetConvos = coachService.getAthleteConversations.bind(coachService);

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
      const a = allDemoAthletes.find(x => x.id === userId);
      if (!a) return originalGet(userId, days);
      return buildHistory(a, days);
    }) as any;

    // Optional: mock process call as no-op returning same as get
    (coachService as any).processSentimentForAthlete = async (userId: string, days: number = 28) => {
      const a = allDemoAthletes.find(x => x.id === userId);
      if (!a && originalProcess) return originalProcess(userId, days);
      return buildHistory(a!, days);
    };

    // Mock conversation sessions to populate details modal and message counts
    coachService.getAthleteConversations = (async (athleteUserId: string) => {
      const a = allDemoAthletes.find(x => x.id === athleteUserId);
      if (!a) return originalGetConvos(athleteUserId);
      const now = new Date();
      // Build sessions from demoSessions with timestamps
      return a.demoSessions.map((s, idx) => {
        const start = new Date(now);
        start.setDate(now.getDate() - s.daysAgo);
        start.setHours(10, 0, 0, 0);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + Math.max(5, s.messages.length * 3));
        return {
          id: s.id,
          athleteUserId: a.id,
          startTime: start,
          endTime: end,
          messages: s.messages.map((m, i) => ({
            id: `${s.id}_${i}`,
            content: m.content,
            sender: m.sender,
            timestamp: new Date(start.getTime() + i * 120000),
            type: 'text'
          }))
        };
      }).sort((x, y) => y.startTime.getTime() - x.startTime.getTime());
    }) as any;

    setMockReady(true);

    return () => {
      coachService.getDailySentimentHistory = originalGet;
      if (originalProcess) (coachService as any).processSentimentForAthlete = originalProcess;
      coachService.getAthleteConversations = originalGetConvos;
    };
  }, []);
  return (
    <div className="min-h-screen bg-black text-white">
      <Head>
        <title>Coach Dashboard Demo | Pulse</title>
      </Head>
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Coach Dashboard</h1>
            <p className="text-zinc-400">Demo mode — mock data for walkthroughs</p>
          </div>
          <div className="flex-1" />
          <nav className="mr-6 hidden md:flex items-center gap-2">
            {[
              { key: 'dashboard', label: 'Dashboard' },
              { key: 'referrals', label: 'Referrals' },
              { key: 'earnings', label: 'Earnings' },
              { key: 'staff', label: 'Staff' },
              { key: 'inbox', label: 'Inbox' },
              { key: 'profile', label: 'Profile' }
            ].map((item) => {
              const isActive = activeTab === (item.key as any);
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key as any)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive ? 'bg-[#E0FE10] text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="text-right">
            <div className="text-sm text-zinc-400">Referral Code</div>
            <div className="text-xl font-bold text-[#E0FE10]">DEMO1234</div>
            <button
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
              className="mt-2 md:hidden inline-flex items-center justify-center p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800"
            >
              <FaBars />
            </button>
          </div>
        </div>

        {/* Mobile slide-over navigation (demo) */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute top-0 right-0 h-full w-72 bg-zinc-900 border-l border-zinc-800 shadow-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="text-lg font-semibold text-white">Menu</div>
                <button
                  aria-label="Close navigation"
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { key: 'dashboard', label: 'Dashboard' },
                  { key: 'referrals', label: 'Referrals' },
                  { key: 'earnings', label: 'Earnings' },
                  { key: 'staff', label: 'Staff' },
                  { key: 'inbox', label: 'Inbox' },
                  { key: 'profile', label: 'Profile' }
                ].map((item) => {
                  const isActive = activeTab === (item.key as any);
                  return (
                    <button
                      key={item.key}
                      onClick={() => { setActiveTab(item.key as any); setMobileNavOpen(false); }}
                      className={`px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
                        isActive ? 'bg-[#E0FE10] text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-auto pt-6 border-t border-zinc-800">
                <div className="text-xs text-zinc-400 mb-2">Referral Code</div>
                <div className="text-lg font-bold text-[#E0FE10] mb-4">DEMO1234</div>
              </div>
            </div>
          </div>
        )}

        {/* Top stat (mirrors live) */}
        {mockReady && activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
              <div className="bg-zinc-900 rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-2">
                  <FaUsers className="text-[#E0FE10] text-xl" />
                  <h3 className="text-lg font-semibold">Total Athletes</h3>
                </div>
                <div className="text-3xl font-bold text-[#E0FE10]">{allDemoAthletes.length}</div>
                <p className="text-zinc-400 text-sm mt-1">Connected athletes (demo)</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allDemoAthletes.map(a => (
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
          </>
        )}

        {activeTab === 'referrals' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-2xl font-bold mb-2">Referrals (Demo)</h3>
            <p className="text-zinc-400 mb-4">This mirrors the Referrals tab layout using static data.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-zinc-800 p-4">
                <div className="text-zinc-300 mb-1">Your referral link</div>
                <div className="text-[#E0FE10] break-all text-sm">https://fitwithpulse.ai/connect/DEMO1234</div>
              </div>
              <div className="rounded-lg border border-zinc-800 p-4">
                <div className="text-zinc-300 mb-1">Signups</div>
                <div className="text-2xl font-semibold">18</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-2xl font-bold mb-2">Earnings (Demo)</h3>
            <p className="text-zinc-400 mb-4">Mock payout summary and recent transactions.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-zinc-800 p-4"><div className="text-zinc-400 text-sm">MRR</div><div className="text-2xl font-semibold">$1,240</div></div>
              <div className="rounded-lg border border-zinc-800 p-4"><div className="text-zinc-400 text-sm">Month to date</div><div className="text-2xl font-semibold">$3,980</div></div>
              <div className="rounded-lg border border-zinc-800 p-4"><div className="text-zinc-400 text-sm">Payout on</div><div className="text-2xl font-semibold">Fri</div></div>
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-2xl font-bold mb-2">Staff (Demo)</h3>
            <p className="text-zinc-400 mb-4">Invite team members and manage permissions (static).</p>
            <div className="space-y-3">
              {['assistant@demo.com','psych@demo.com'].map((email)=>(
                <div key={email} className="flex items-center justify-between border border-zinc-800 rounded-lg p-3">
                  <div className="text-zinc-300">{email}</div>
                  <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">full</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'inbox' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-2xl font-bold mb-2">Inbox (Demo)</h3>
            <p className="text-zinc-400">Conversations UI placeholder for demo.</p>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-2xl font-bold mb-2">Profile (Demo)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><div className="text-zinc-400 text-sm mb-1">Coach Name</div><div className="bg-zinc-800 rounded-lg px-3 py-2">Demo Coach</div></div>
              <div><div className="text-zinc-400 text-sm mb-1">Email</div><div className="bg-zinc-800 rounded-lg px-3 py-2">coach.demo@fitwithpulse.ai</div></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachDemoDashboard;


