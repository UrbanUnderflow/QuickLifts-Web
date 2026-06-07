import React from 'react';
import Head from 'next/head';
import { CoachDashboardShell } from './dashboard-v2';
import { coachService, DailySentimentRecord } from '../../api/firebase/coach/service';
import { noraVaultService, NoraVaultEntry } from '../../api/firebase/coach/noraVaultService';

const DEMO_COACH_ID = 'demo-coach';

const firstNames = ['Tremaine', 'Alex', 'Jordan', 'Sam', 'Taylor', 'Riley', 'Casey', 'Morgan', 'Jamie', 'Devon', 'Avery', 'Cameron', 'Drew', 'Quinn', 'Reese', 'Skyler'];
const lastNames = ['Grant', 'Morgan', 'King', 'Lee', 'Brooks', 'Chen', 'Rivera', 'Thompson', 'Okafor', 'Washington', 'Rodriguez', 'Williams', 'Johnson', 'Martinez', 'Davis', 'Patel'];

type DemoAthlete = {
  id: string;
  displayName: string;
  email: string;
  conversationCount: number;
  totalSessions: number;
  weeklyGoalProgress: number;
  sentimentScore: number;
  lastActiveDate: Date;
};

// Deterministic mock roster spanning every status bucket.
const demoAthletes: DemoAthlete[] = Array.from({ length: 16 }).map((_, i) => {
  const fname = firstNames[i % firstNames.length];
  const lname = lastNames[i % lastNames.length];
  // Spread sentiment from negative to positive across the roster.
  const sentiment = Number((((i * 0.21 + 0.13) % 1.6) - 0.7).toFixed(2));
  const stale = i % 7 === 6 ? 12 : i % 5; // a couple of pending (stale) athletes
  const conversations = i % 9 === 8 ? 0 : 40 + ((i * 37) % 540);
  return {
    id: `demo-a${i + 1}`,
    displayName: `${fname} ${lname}`,
    email: `${fname}.${lname}`.toLowerCase() + '@example.com',
    conversationCount: conversations,
    totalSessions: 8 + ((i * 11) % 120),
    weeklyGoalProgress: (i * 13) % 101,
    sentimentScore: sentiment,
    lastActiveDate: new Date(Date.now() - stale * 86400000),
  };
});

const seedVault: NoraVaultEntry[] = [
  {
    id: 'seed-1',
    coachId: DEMO_COACH_ID,
    type: 'note',
    title: 'Practice & meeting schedule',
    category: 'Schedule',
    content:
      'Team meeting every Monday at 7:00 AM in the film room. Practice starts at 3:30 PM Mon–Thu. Lift at 6:00 AM Tue/Thu. Saturday walkthrough at 9:00 AM.',
    createdAt: new Date(Date.now() - 2 * 86400000),
  },
  {
    id: 'seed-2',
    coachId: DEMO_COACH_ID,
    type: 'note',
    title: 'Pre-game routine',
    category: 'Playbook',
    content:
      'Arrive 90 minutes before kickoff. Box breathing in the locker room, anchor word reset, then position-group walkthrough. Phones away 30 minutes out.',
    createdAt: new Date(Date.now() - 5 * 86400000),
  },
  {
    id: 'seed-3',
    coachId: DEMO_COACH_ID,
    type: 'file',
    title: 'Team handbook 2026.pdf',
    category: 'Policies',
    content: 'Travel policy, code of conduct, and academic eligibility requirements.',
    fileName: 'Team handbook 2026.pdf',
    fileType: 'application/pdf',
    downloadUrl: '#',
    createdAt: new Date(Date.now() - 9 * 86400000),
  },
];

const toYYYYMMDD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const CoachDashboardV2Demo: React.FC = () => {
  const [mockReady, setMockReady] = React.useState(false);

  React.useEffect(() => {
    const originalGet = coachService.getDailySentimentHistory.bind(coachService);
    const originalProcess = (coachService as any).processSentimentForAthlete?.bind(coachService);
    const originalConvos = coachService.getAthleteConversations.bind(coachService);
    const originalVaultGet = noraVaultService.getEntries.bind(noraVaultService);
    const originalVaultAddNote = noraVaultService.addNote.bind(noraVaultService);
    const originalVaultAddFile = noraVaultService.addFile.bind(noraVaultService);
    const originalVaultDelete = noraVaultService.deleteEntry.bind(noraVaultService);

    let vault = [...seedVault];

    const buildHistory = (athlete: DemoAthlete, days = 28): DailySentimentRecord[] => {
      const today = new Date();
      const out: DailySentimentRecord[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        // Most days have a check-in; jitter around the athlete's baseline.
        const hasMsg = (i + athlete.displayName.length) % 3 !== 0;
        const jitter = (((i * 7) % 5) - 2) * 0.12;
        out.push({
          id: `${athlete.id}_${toYYYYMMDD(d)}`,
          userId: athlete.id,
          date: toYYYYMMDD(d),
          sentimentScore: hasMsg ? Math.max(-1, Math.min(1, athlete.sentimentScore + jitter)) : 0,
          messageCount: hasMsg ? 1 + ((i * 3) % 6) : 0,
          lastAnalyzedAt: d,
          createdAt: d,
          updatedAt: d,
        });
      }
      return out;
    };

    coachService.getDailySentimentHistory = (async (userId: string, days = 28) => {
      const a = demoAthletes.find((x) => x.id === userId);
      return a ? buildHistory(a, days) : originalGet(userId, days);
    }) as any;

    (coachService as any).processSentimentForAthlete = async (userId: string, days = 28) => {
      const a = demoAthletes.find((x) => x.id === userId);
      if (!a) return originalProcess ? originalProcess(userId, days) : [];
      return buildHistory(a, days);
    };

    coachService.getAthleteConversations = (async (athleteUserId: string) => {
      const a = demoAthletes.find((x) => x.id === athleteUserId);
      if (!a) return originalConvos(athleteUserId);
      const start = new Date();
      start.setHours(10, 0, 0, 0);
      return [
        {
          id: `${a.id}_s1`,
          athleteUserId: a.id,
          startTime: start,
          endTime: new Date(start.getTime() + 9 * 60000),
          messages: [
            { id: 'm1', content: 'Checking in before practice.', sender: 'user', timestamp: start, type: 'text' },
            { id: 'm2', content: 'Great—keep your warm-up consistent.', sender: 'ai', timestamp: new Date(start.getTime() + 120000), type: 'text' },
          ],
        },
      ];
    }) as any;

    // Vault: in-memory, no Firebase.
    noraVaultService.getEntries = (async () => [...vault]) as any;
    noraVaultService.addNote = (async (_coachId: string, entry: any) => {
      const created: NoraVaultEntry = {
        id: `local-${vault.length + 1}-${entry.title}`,
        coachId: DEMO_COACH_ID,
        type: entry.type || 'note',
        title: entry.title?.trim() || 'Untitled note',
        content: entry.content?.trim() || '',
        category: entry.category,
        url: entry.url,
        createdAt: new Date(),
      };
      vault = [created, ...vault];
      return created;
    }) as any;
    noraVaultService.addFile = (async (_coachId: string, file: File, opts?: any) => {
      opts?.onProgress?.(100);
      const isImage = file.type.startsWith('image/');
      const created: NoraVaultEntry = {
        id: `local-file-${vault.length + 1}`,
        coachId: DEMO_COACH_ID,
        type: isImage ? 'image' : 'file',
        title: opts?.title?.trim() || file.name,
        content: opts?.summary?.trim() || '',
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        downloadUrl: '#',
        createdAt: new Date(),
      };
      vault = [created, ...vault];
      return created;
    }) as any;
    noraVaultService.deleteEntry = (async (entry: NoraVaultEntry) => {
      vault = vault.filter((e) => e.id !== entry.id);
    }) as any;

    setMockReady(true);

    return () => {
      coachService.getDailySentimentHistory = originalGet;
      if (originalProcess) (coachService as any).processSentimentForAthlete = originalProcess;
      coachService.getAthleteConversations = originalConvos;
      noraVaultService.getEntries = originalVaultGet;
      noraVaultService.addNote = originalVaultAddNote;
      noraVaultService.addFile = originalVaultAddFile;
      noraVaultService.deleteEntry = originalVaultDelete;
    };
  }, []);

  return (
    <>
      <Head>
        <title>Coach Dashboard (Demo) | PulseCheck</title>
      </Head>
      <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs px-4 py-1.5 text-center">
        Demo mode — mock data for walkthroughs. No real athletes or Firebase writes.
      </div>
      {mockReady && (
        <CoachDashboardShell
          athletes={demoAthletes as any}
          loadingAthletes={false}
          coachName="Coach Mayo"
          coachEmail="coach.mayo@fitwithpulse.ai"
          coachId={DEMO_COACH_ID}
          isDemo
          earningsEnabled
          revenueSharePct={20}
        />
      )}
    </>
  );
};

export default CoachDashboardV2Demo;
