# Codebase Map — QuickLifts-Web

> **For agents:** Use this to find files by feature. Don't guess paths — look them up here first.
> Project root: `/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web`

---

## API Services — `src/api/firebase/`

Each subdirectory contains Firestore CRUD operations for a feature area.

| Directory | Purpose |
|-----------|---------|
| `admin/` | Admin settings, feature flags |
| `auth/` | Authentication helpers |
| `chat/` | Chat/messaging Firestore ops |
| `club/` | Club/community features |
| `coach/` | Coach profiles, partnerships |
| `config.ts` | Firebase app configuration |
| `creatorPages/` | Creator page content |
| `escalation/` | Escalation rules and conditions |
| `exercise/` | Exercise library CRUD |
| `exerciseLog/` | Workout exercise logging |
| `gemini/` | Gemini AI integration |
| `groupChat/` | Group chat (Round Table) Firestore |
| `intelFeed/` | Agent intel feed service |
| `kanban/` | Kanban task board CRUD |
| `meal/` | Meal tracking and macros |
| `meetingMinutes/` | Meeting minutes storage |
| `mentalnotes/` | Mental notes feature |
| `mentaltraining/` | Mental training curriculum + athlete progress |
| `messaging/` | Push notification messaging |
| `presence/` | Agent presence/heartbeat |
| `privacy/` | Privacy consent management |
| `programming/` | Workout programming service |
| `progressTimeline/` | Progress timeline/feed data |
| `reunionPayments/` | Reunion payment processing |
| `reviewContext/` | App Store review context |
| `storage/` | Firebase Storage helpers |
| `subscription/` | Stripe subscription management |
| `user/` | User profiles and accounts |
| `video-processor/` | Video processing service |
| `workout/` | Workout CRUD |
| `workoutCategoryMapping/` | Exercise category mappings |
| `workoutSession/` | Live workout session tracking |

---

## Components — `src/components/`

### Virtual Office — `src/components/virtualOffice/`
| File | Purpose |
|------|---------|
| `VirtualOfficeContent.tsx` | Main virtual office layout (largest file, ~147KB) |
| `GroupChatModal.tsx` | Round Table group chat UI |
| `AgentChatModal.tsx` | 1:1 agent DM chat |
| `ProgressTimelinePanel.tsx` | Progress timeline/feed panel |
| `FilingCabinet.tsx` | Filing cabinet document viewer |
| `MeetingMinutesPreview.tsx` | Meeting minutes display |
| `InterventionAlert.tsx` | Escalation intervention alerts |
| `MessageBubble.tsx` | Chat message bubble component |
| `RoundTable.tsx` | Round Table entry point |
| `AgentAvatar.tsx` | Agent avatar component |

### Mental Training — `src/components/mentaltraining/`
Key files: `CurriculumProgressCard.tsx`, `MentalProgressCard.tsx`, `MentalProgressDashboard.tsx`

### PulseCheck — `src/components/pulsecheck/`
PulseCheck waitlist and survey components.

### App Components — `src/components/App/`
Dashboard cards, exercise views, progress bars, workout UI.

### Standalone Components (frequently used)
| File | Purpose |
|------|---------|
| `SignInModal.tsx` | Auth sign-in modal (~111KB) |
| `AuthWrapper.tsx` | Auth state wrapper |
| `AthleteCard.tsx` | Athlete profile card |
| `AthleteDetailsModal.tsx` | Athlete detail view |
| `ConversationModal.tsx` | Messaging conversation |
| `Meta.tsx` / `PageHead.tsx` | SEO meta tags |
| `SyncProgressBar.tsx` | Data sync progress |
| `ErrorBoundary.tsx` | Error boundary wrapper |

---

## Pages — `src/pages/`

### Admin Pages — `src/pages/admin/`
| File | Purpose |
|------|---------|
| `virtualOffice.tsx` | Virtual Office page (entry point, loads VirtualOfficeContent) |
| `agentChat.tsx` | Agent chat admin page |
| `users.tsx` | User management (~182KB) |
| `challengestatus.tsx` | Challenge management |
| `corporatePartners.tsx` | Corporate partner management |
| `escalationConditions.tsx` | Escalation rules editor |
| `metrics.tsx` | System metrics dashboard |
| `projectManagement.tsx` | Project management/kanban |
| `subscriptions.tsx` | Subscription management |
| `equity.tsx` | Equity management |
| `vcDatabase.tsx` | VC database |
| `mealLogs.tsx` | Meal log viewer |
| `reviewTracker.tsx` | App review tracker |
| `workoutSummaries.tsx` | Workout summary viewer |

### API Routes — `src/pages/api/`
| Path | Purpose |
|------|---------|
| `agent/intelFeed.ts` | Intel feed API endpoint |
| `agent/` | Agent-related API routes |
| `admin/` | Admin API routes |
| `auth/` | Auth API routes |
| `brevo/` | Brevo email API |
| `review/` | App review endpoints |
| `chatbot.js` | AI chatbot endpoint |
| `track.ts` | Analytics tracking |

### Key Public Pages
| File | Purpose |
|------|---------|
| `index.tsx` | Landing page |
| `programming.tsx` | Workout programming (~237KB) |
| `PulseCheck.tsx` | PulseCheck app (~230KB) |
| `WunnaRun.tsx` | WunnaRun feature (~154KB) |
| `run.tsx` | Run tracking page |
| `rounds.tsx` | Rounds/challenges |
| `coach.tsx` | Coach page |

---

## Types — `src/types/`

| File | Purpose |
|------|---------|
| `Activity.ts` | Activity feed types |
| `AuthTypes.ts` | Auth state types |
| `BodyWeight.ts` | Body weight tracking types |
| `Coach.ts` | Coach/partnership types |
| `DashboardTypes.ts` | Dashboard data types |
| `Privacy.ts` | Privacy consent types |
| `PromoCode.ts` | Promo code types |
| `UserTogetherRoundCollection.ts` | Round collection types |

---

## State Management — `src/redux/`

| File | Purpose |
|------|---------|
| `store.ts` | Redux store configuration |
| `userSlice.ts` | User state |
| `workoutSlice.ts` | Workout state |
| `loadingSlice.ts` | Loading state |
| `toastSlice.ts` | Toast notifications |
| `devModeSlice.ts` | Dev mode toggle |

---

## Utilities — `src/utils/`

| File | Purpose |
|------|---------|
| `tablePositions.ts` | Virtual Office desk positions |
| `stripeConstants.ts` | Stripe product/price IDs |
| `platformDetection.ts` | iOS/Android/web detection |
| `formatDate.ts` | Date formatting helpers |
| `timestamp.ts` | Firestore timestamp helpers |
| `gifGenerator.ts` | GIF generation for sharing |
| `tts.ts` | Text-to-speech |
| `metrics.ts` | Metrics calculation helpers |

---

## Scripts — `scripts/`

| File | Purpose |
|------|---------|
| `agentRunner.js` | Main agent execution engine (~154KB) |
| `emailBridge.js` | Email bridge service |
| `manageKanban.js` | Kanban task management CLI |
| `diagnoseAgent.js` | Agent diagnostics |
| `sendToAgent.js` | Send commands to agents |
| `resetBlockedTasks.js` | Reset stuck kanban tasks |
| `sync-firebase-indexes.sh` | Firebase index sync |

---

## Key Config Files (project root)

| File | Purpose |
|------|---------|
| `firebase.json` | Firebase hosting/functions config |
| `firestore.rules` | Firestore security rules |
| `firestore.indexes.json` | Firestore composite indexes |
| `netlify.toml` | Netlify deployment config |
| `next.config.js` | Next.js configuration |
| `tailwind.config.js` | Tailwind CSS config |
| `package.json` | Dependencies and scripts |

---

## Docs — `docs/`

| File | Purpose |
|------|---------|
| `AGENT_MANIFESTO.md` | Agent shared knowledge + lessons |
| `AGENT_ONBOARDING.md` | Guide for onboarding new agents |
| `agents/` | Per-agent documentation |
| `CODEBASE_MAP.md` | This file (codebase navigation) |

---

## Common Patterns

- **Agent colors/emojis** are duplicated across: `virtualOffice.tsx`, `GroupChatModal.tsx`, `AgentChatModal.tsx`, `FilingCabinet.tsx`, `MeetingMinutesPreview.tsx`, `agentChat.tsx`
- **Firestore collections** are defined in service files under `src/api/firebase/`
- **New features** typically need: API service in `src/api/firebase/`, component in `src/components/`, page in `src/pages/`, and types in `src/types/`
