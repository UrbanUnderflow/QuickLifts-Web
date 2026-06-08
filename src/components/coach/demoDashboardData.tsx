import React from 'react';
import type { AthleteAlert } from '../../pages/coach/dashboard';
import { coachService, DailySentimentRecord } from '../../api/firebase/coach/service';
import { noraVaultService, NoraVaultEntry } from '../../api/firebase/coach/noraVaultService';
import {
  coachScheduleService,
  ScheduleEvent,
  ScheduleEventDraft,
} from '../../api/firebase/coach/coachScheduleService';

// ---------------------------------------------------------------------------
// Shared demo dataset + service mocks for the coach dashboard.
//
// Used by BOTH the always-on demo page (/coach/dashboard/demo) and the live
// dashboard's training mode (/coach/dashboard on first visit / ?training=1),
// so the walkthrough data stays in lockstep across surfaces.
// ---------------------------------------------------------------------------

export const DEMO_COACH_ID = 'demo-coach';

const firstNames = ['Tremaine', 'Alex', 'Jordan', 'Sam', 'Taylor', 'Riley', 'Casey', 'Morgan', 'Jamie', 'Devon', 'Avery', 'Cameron', 'Drew', 'Quinn', 'Reese', 'Skyler'];
const lastNames = ['Grant', 'Morgan', 'King', 'Lee', 'Brooks', 'Chen', 'Rivera', 'Thompson', 'Okafor', 'Washington', 'Rodriguez', 'Williams', 'Johnson', 'Martinez', 'Davis', 'Patel'];

export type DemoAthlete = {
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
export const DEMO_ATHLETES: DemoAthlete[] = Array.from({ length: 16 }).map((_, i) => {
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

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000);

// Hand-authored alerts for the walkthrough. Only Tier 2 (consent-based) and
// Tier 3 (clinical) reach this board.
//  • Every Tier 2 below was explicitly consented to *Coach Mayo* (the demo coach).
//    An athlete who picked a different staffer — or "don't notify anyone" — would
//    never appear here; that's the whole point of the consent gate.
//  • Tier 3 is awareness only: Nora, PulseCheck, and AuntEdna have already acted.
export const DEMO_ALERTS: AthleteAlert[] = [
  // ── Tier 2 — consent-based (horizontal lane) ──
  {
    id: 'al-morgan',
    athleteId: 'demo-a8',
    athleteName: 'Morgan Thompson',
    tier: 2,
    category: 'Anxiety Indicators',
    flaggedAt: hoursAgo(3),
    lastCheckIn: hoursAgo(3),
    notifiedCoachName: 'Coach Mayo',
    summary:
      "Morgan's been carrying a lot of pre-competition pressure this week — their check-ins point to anxiety that keeps resurfacing. Their body's fine; this is in the head.",
    noraActions: [
      { label: 'Box Breathing', detail: 'Ran 4 rounds together — settled in the moment.', status: 'completed' },
      { label: 'Anchor Word reset', detail: 'Re-locked Morgan’s anchor word to a calm baseline.', status: 'completed' },
      { label: 'Competition Walkthrough', detail: 'Queued a mental rehearsal before the next session.', status: 'queued' },
    ],
    recommendation:
      "Pull Morgan aside before the next session for a quick, low-key check-in. You don't need to mention the specifics — just let them know you've got them.",
  },
  {
    id: 'al-skyler',
    athleteId: 'demo-a16',
    athleteName: 'Skyler Patel',
    tier: 2,
    category: 'Persistent Distress',
    flaggedAt: hoursAgo(7),
    lastCheckIn: hoursAgo(7),
    notifiedCoachName: 'Coach Mayo',
    summary:
      "Skyler's mood has been trending low for several days running — not a one-off bad day. They opened up to Nora and chose to bring you into the loop.",
    noraActions: [
      { label: 'Grounding check-in', detail: 'Walked through a short grounding exercise.', status: 'completed' },
      { label: 'Daily mood follow-ups', detail: 'Nora is checking in each morning this week.', status: 'active' },
    ],
    recommendation:
      "A warm, unhurried conversation matters more than advice here. Ask how they're doing and listen — let Skyler lead.",
  },
  {
    id: 'al-alex',
    athleteId: 'demo-a2',
    athleteName: 'Alex Morgan',
    tier: 2,
    category: 'Injury-Related',
    flaggedAt: hoursAgo(26),
    lastCheckIn: hoursAgo(26),
    notifiedCoachName: 'Coach Mayo',
    summary:
      "Alex is struggling with the mental side of their recovery — frustration about the timeline and feeling disconnected from the team. They asked that you know.",
    noraActions: [
      { label: 'Highlight Reel', detail: 'Replayed peak-performance memories to rebuild confidence.', status: 'completed' },
      { label: 'Reframe rehab as training', detail: 'Reframing exercise to keep Alex engaged in recovery.', status: 'active' },
    ],
    recommendation:
      "Keep Alex involved with the team even while they're out. A small role or a check-in on their rehab goals goes a long way.",
  },
  // ── Tier 3 — clinical monitoring / awareness (stack) ──
  {
    id: 'al-jordan',
    athleteId: 'demo-a3',
    athleteName: 'Jordan King',
    tier: 3,
    category: 'Severe Distress',
    flaggedAt: hoursAgo(5),
    lastCheckIn: hoursAgo(5),
    handoffStatus: 'engaged',
    clinicalContact: 'Dr. Liz Carter',
    summary:
      "Jordan shared some things this morning that go beyond what coaching should hold. Nora moved quickly and a licensed clinician is now engaged and supporting them.",
    noraActions: [
      { label: 'Safety check completed', detail: 'Nora confirmed Jordan was safe in the moment.', status: 'completed' },
      { label: 'Clinical handoff to AuntEdna', detail: 'Full context securely packaged and routed to care.', status: 'completed' },
      { label: 'Care team connected', detail: 'Dr. Liz Carter is now engaged with Jordan.', status: 'completed' },
    ],
    recommendation:
      "No coaching action needed. Please don't discuss performance or availability with Jordan today — the care team has this. Keep things normal and discreet around the group.",
  },
  {
    id: 'al-devon',
    athleteId: 'demo-a10',
    athleteName: 'Devon Washington',
    tier: 3,
    category: 'Rapid Deterioration',
    flaggedAt: hoursAgo(1),
    lastCheckIn: hoursAgo(1),
    handoffStatus: 'connecting',
    clinicalContact: 'the care team',
    summary:
      "Devon's check-ins shifted sharply in a short window. Nora flagged it as beyond coaching scope and a clinical handoff is underway right now.",
    noraActions: [
      { label: 'Safety check completed', detail: 'Nora confirmed Devon was safe in the moment.', status: 'completed' },
      { label: 'Clinical handoff to AuntEdna', detail: 'Connecting Devon with a licensed clinician.', status: 'active' },
    ],
    recommendation:
      "No coaching action needed yet. Hold off on any performance conversations — you'll get an update once the care team is fully engaged.",
  },
];

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

// A couple of recurring items already on the calendar before any import.
const seedSchedule: ScheduleEvent[] = [
  {
    id: 'sched-seed-1',
    coachId: DEMO_COACH_ID,
    title: 'Team meeting',
    date: '2026-06-08',
    time: '7:00 AM',
    location: 'Film room',
    type: 'meeting',
    source: 'manual',
    createdAt: new Date(),
  },
  {
    id: 'sched-seed-2',
    coachId: DEMO_COACH_ID,
    title: 'Practice',
    date: '2026-06-09',
    time: '3:30 PM',
    type: 'practice',
    source: 'manual',
    createdAt: new Date(),
  },
];

// Canned result for the link-import walkthrough (no network/LLM in demo) —
// a believable 2026–27 men's track & field season.
const demoScrapeEvents: ScheduleEventDraft[] = [
  { title: 'FSU Season Opener', date: '2026-12-05', time: 'All Day', location: 'Tallahassee, FL', type: 'competition', notes: 'Home' },
  { title: 'Clemson Invitational', date: '2027-01-16', time: 'TBA', location: 'Clemson, SC', opponent: 'Clemson', type: 'competition', notes: 'Away' },
  { title: 'Carolina Challenge', date: '2027-01-23', time: 'All Day', location: 'Clemson, SC', type: 'competition' },
  { title: 'Tiger Paw Invitational', date: '2027-02-13', time: 'All Day', location: 'Clemson, SC', type: 'competition' },
  { title: 'ACC Indoor Championships', date: '2027-02-26', endDate: '2027-02-28', time: 'All Day', location: 'Louisville, KY', type: 'competition', notes: 'Conference' },
  { title: 'NCAA Indoor Championships', date: '2027-03-12', endDate: '2027-03-13', time: 'All Day', location: 'Virginia Beach, VA', type: 'competition' },
  { title: 'Florida Relays', date: '2027-03-27', time: 'All Day', location: 'Gainesville, FL', opponent: 'Florida', type: 'competition', notes: 'Away' },
  { title: 'Tom Jones Memorial', date: '2027-04-17', time: 'All Day', location: 'Gainesville, FL', type: 'competition' },
  { title: 'ACC Outdoor Championships', date: '2027-05-13', endDate: '2027-05-15', time: 'All Day', location: 'Atlanta, GA', type: 'competition', notes: 'Conference' },
];

const toYYYYMMDD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Apply in-memory mocks for the dashboard's coach services while `active`, and
// restore the originals on deactivate/unmount. Returns whether the mocks are in
// place (gate rendering on it so the shell never briefly hits real services).
export function useDemoDashboardMocks(active: boolean): boolean {
  const [mockReady, setMockReady] = React.useState(false);

  React.useEffect(() => {
    if (!active) {
      setMockReady(false);
      return;
    }

    const originalGet = coachService.getDailySentimentHistory.bind(coachService);
    const originalProcess = (coachService as any).processSentimentForAthlete?.bind(coachService);
    const originalConvos = coachService.getAthleteConversations.bind(coachService);
    const originalVaultGet = noraVaultService.getEntries.bind(noraVaultService);
    const originalVaultAddNote = noraVaultService.addNote.bind(noraVaultService);
    const originalVaultAddFile = noraVaultService.addFile.bind(noraVaultService);
    const originalVaultDelete = noraVaultService.deleteEntry.bind(noraVaultService);
    const originalSchedGet = coachScheduleService.getEvents.bind(coachScheduleService);
    const originalSchedAdd = coachScheduleService.addEvent.bind(coachScheduleService);
    const originalSchedAddMany = coachScheduleService.addEvents.bind(coachScheduleService);
    const originalSchedDelete = coachScheduleService.deleteEvent.bind(coachScheduleService);
    const originalSchedScrape = coachScheduleService.scrapeUrl.bind(coachScheduleService);

    let vault = [...seedVault];
    let schedule = [...seedSchedule];
    let schedCounter = 0;

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
      const a = DEMO_ATHLETES.find((x) => x.id === userId);
      return a ? buildHistory(a, days) : originalGet(userId, days);
    }) as any;

    (coachService as any).processSentimentForAthlete = async (userId: string, days = 28) => {
      const a = DEMO_ATHLETES.find((x) => x.id === userId);
      if (!a) return originalProcess ? originalProcess(userId, days) : [];
      return buildHistory(a, days);
    };

    coachService.getAthleteConversations = (async (athleteUserId: string) => {
      const a = DEMO_ATHLETES.find((x) => x.id === athleteUserId);
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

    // Schedule: in-memory, no Firebase.
    const buildEvent = (draft: ScheduleEventDraft): ScheduleEvent => ({
      ...draft,
      id: `sched-local-${++schedCounter}`,
      coachId: DEMO_COACH_ID,
      source: draft.source || 'manual',
      createdAt: new Date(),
    });
    coachScheduleService.getEvents = (async () => [...schedule]) as any;
    coachScheduleService.addEvent = (async (_coachId: string, draft: ScheduleEventDraft) => {
      const created = buildEvent(draft);
      schedule = [...schedule, created];
      return created;
    }) as any;
    coachScheduleService.addEvents = (async (_coachId: string, drafts: ScheduleEventDraft[]) => {
      const created = drafts.map(buildEvent);
      schedule = [...schedule, ...created];
      return created;
    }) as any;
    coachScheduleService.deleteEvent = (async (eventId: string) => {
      schedule = schedule.filter((e) => e.id !== eventId);
    }) as any;
    coachScheduleService.scrapeUrl = (async (url: string) => {
      // Simulate the fetch+parse round-trip so the writing animation has a beat.
      await new Promise((r) => setTimeout(r, 1100));
      return {
        sourceTitle: 'Men’s Track & Field — 2026–27 Schedule',
        events: demoScrapeEvents.map((e) => ({ ...e, source: 'link' as const, sourceUrl: url })),
      };
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
      coachScheduleService.getEvents = originalSchedGet;
      coachScheduleService.addEvent = originalSchedAdd;
      coachScheduleService.addEvents = originalSchedAddMany;
      coachScheduleService.deleteEvent = originalSchedDelete;
      coachScheduleService.scrapeUrl = originalSchedScrape;
      setMockReady(false);
    };
  }, [active]);

  return mockReady;
}
