import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays,
  Link2,
  Plus,
  UploadCloud,
  Trophy,
  Dumbbell,
  Users,
  Plane,
  Clock,
  MapPin,
  Trash2,
  X,
  Sparkles,
  PenLine,
  RefreshCw,
  FileText,
} from 'lucide-react';
import {
  coachScheduleService,
  ScheduleEvent,
  ScheduleEventType,
} from '../../api/firebase/coach/coachScheduleService';
import { noraVaultService, NoraVaultEntry } from '../../api/firebase/coach/noraVaultService';

// ---------------------------------------------------------------------------
// Nora orb — self-contained CSS/motion approximation of the PIL Nora orb.
// Purple→blue→teal gradient core, soft glow, breathing; a faster shine while
// she's actively working.
// ---------------------------------------------------------------------------

export const NoraOrb: React.FC<{ size?: number; active?: boolean }> = ({ size = 40, active = false }) => (
  <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
    {/* Glow */}
    <motion.div
      className="absolute inset-0 rounded-full blur-md"
      style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.7), rgba(45,212,191,0.25) 70%, transparent)' }}
      animate={{ scale: active ? [1, 1.25, 1] : [1, 1.08, 1], opacity: active ? [0.7, 1, 0.7] : [0.5, 0.7, 0.5] }}
      transition={{ duration: active ? 1.6 : 3, repeat: Infinity, ease: 'easeInOut' }}
    />
    {/* Core */}
    <motion.div
      className="absolute inset-0 rounded-full overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 32% 28%, #c4b5fd 0%, #8b5cf6 38%, #6366f1 62%, #2dd4bf 100%)',
        boxShadow: 'inset 0 0 12px rgba(255,255,255,0.35)',
      }}
      animate={{ scale: active ? [1, 1.05, 1] : 1 }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Rotating conic shine */}
      <motion.div
        className="absolute inset-0"
        style={{ background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.45), transparent 40%)' }}
        animate={{ rotate: 360 }}
        transition={{ duration: active ? 2.4 : 6, repeat: Infinity, ease: 'linear' }}
      />
      {/* Specular highlight */}
      <div
        className="absolute rounded-full bg-white/70 blur-[1px]"
        style={{ width: size * 0.18, height: size * 0.18, top: size * 0.2, left: size * 0.24 }}
      />
    </motion.div>
  </div>
);

// ---------------------------------------------------------------------------
// Typewriter — types text once on mount, blinking pen cursor while typing.
// ---------------------------------------------------------------------------

const Typewriter: React.FC<{ text: string; speed?: number; onDone?: () => void }> = ({
  text,
  speed = 16,
  onDone,
}) => {
  const [shown, setShown] = useState('');
  const doneRef = useRef(false);
  useEffect(() => {
    let i = 0;
    let timer: any;
    const tick = () => {
      i += 1;
      setShown(text.slice(0, i));
      if (i < text.length) {
        timer = setTimeout(tick, speed);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
    };
    timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  const typing = shown.length < text.length;
  return (
    <span>
      {shown}
      {typing && (
        <PenLine className="inline-block w-3 h-3 ml-0.5 -mb-0.5 text-purple-300 animate-pulse" />
      )}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Event metadata (type → icon + tone)
// ---------------------------------------------------------------------------

const TYPE_META: Record<
  ScheduleEventType,
  { label: string; icon: React.ElementType; chip: string; ring: string }
> = {
  competition: { label: 'Competition', icon: Trophy, chip: 'bg-orange-500/15 text-orange-300 border-orange-500/30', ring: 'bg-orange-500/15 text-orange-400' },
  practice: { label: 'Practice', icon: Dumbbell, chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', ring: 'bg-emerald-500/15 text-emerald-400' },
  lift: { label: 'Lift', icon: Dumbbell, chip: 'bg-[#E0FE10]/15 text-[#E0FE10] border-[#E0FE10]/30', ring: 'bg-[#E0FE10]/10 text-[#E0FE10]' },
  meeting: { label: 'Meeting', icon: Users, chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30', ring: 'bg-blue-500/15 text-blue-400' },
  travel: { label: 'Travel', icon: Plane, chip: 'bg-purple-500/15 text-purple-300 border-purple-500/30', ring: 'bg-purple-500/15 text-purple-400' },
  event: { label: 'Event', icon: CalendarDays, chip: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/30', ring: 'bg-zinc-700/40 text-zinc-300' },
};

const TYPE_OPTIONS: ScheduleEventType[] = ['competition', 'practice', 'lift', 'meeting', 'travel', 'event'];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const parseLocalDate = (yyyyMmDd: string): Date => {
  const [y, m, d] = (yyyyMmDd || '').split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};

const formatHeading = (yyyyMmDd: string): string => {
  const d = parseLocalDate(yyyyMmDd);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const hostOf = (url: string): string => {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return 'the page';
  }
};

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type LiveEvent = ScheduleEvent & { live?: boolean };

// ---------------------------------------------------------------------------
// Schedule board
// ---------------------------------------------------------------------------

type Phase = 'idle' | 'fetching' | 'writing' | 'done';

const ScheduleBoard: React.FC<{ coachId?: string; isDemo?: boolean }> = ({ coachId }) => {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Import / animation state
  const [urlInput, setUrlInput] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [importMeta, setImportMeta] = useState<{ sourceTitle: string; host: string; total: number } | null>(null);
  const [writtenCount, setWrittenCount] = useState(0);

  // Manual composer
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<{ title: string; date: string; time: string; type: ScheduleEventType; location: string; opponent: string }>({
    title: '', date: todayStr(), time: '', type: 'practice', location: '', opponent: '',
  });

  // Documents (files dropped here land in Nora's vault, tagged Schedule)
  const [docs, setDocs] = useState<NoraVaultEntry[]>([]);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!coachId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [evts, vault] = await Promise.all([
        coachScheduleService.getEvents(coachId),
        noraVaultService.getEntries(coachId).catch(() => [] as NoraVaultEntry[]),
      ]);
      setEvents(evts);
      setDocs(vault.filter((e) => (e.type === 'file' || e.type === 'image') && e.category === 'Schedule'));
    } catch (err) {
      console.error('[schedule] load failed', err);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // --- Link import + Nora writing animation ---------------------------------
  const runImport = async (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url || !coachId || phase !== 'idle') return;
    setError(null);
    setPhase('fetching');
    setWrittenCount(0);
    setImportMeta({ sourceTitle: '', host: hostOf(url), total: 0 });
    try {
      const { sourceTitle, events: drafts } = await coachScheduleService.scrapeUrl(url);
      if (!drafts.length) {
        setError('Nora couldn’t find any events on that page. Try a direct schedule link.');
        setPhase('idle');
        setImportMeta(null);
        return;
      }
      setImportMeta({ sourceTitle, host: hostOf(url), total: drafts.length });
      setPhase('writing');

      // Reveal events one-by-one so it reads like Nora writing them in.
      const perEvent = Math.min(520, Math.max(150, Math.round(7000 / drafts.length)));
      const revealed: LiveEvent[] = [];
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i];
        revealed.push({
          ...d,
          id: `live-${i}-${d.date}`,
          coachId,
          source: 'link',
          sourceUrl: url,
          live: true,
        } as LiveEvent);
        setEvents((prev) => {
          const persisted = prev.filter((e) => !e.live);
          return sortEvents([...persisted, ...revealed]);
        });
        setWrittenCount(i + 1);
        await delay(perEvent);
      }

      // Persist for real (no-op-ish in demo, where addEvents is mocked).
      let saved: ScheduleEvent[];
      try {
        saved = await coachScheduleService.addEvents(coachId, drafts.map((d) => ({ ...d, source: 'link', sourceUrl: url })));
      } catch (err) {
        console.error('[schedule] persist failed, keeping animated set', err);
        saved = revealed.map((e) => ({ ...e, live: false }));
      }
      setEvents((prev) => sortEvents([...prev.filter((e) => !e.live), ...saved]));
      setPhase('done');
      await delay(1500);
      setPhase('idle');
      setImportMeta(null);
      setWrittenCount(0);
      setUrlInput('');
    } catch (err: any) {
      console.error('[schedule] import failed', err);
      setError(err?.message || 'That import didn’t work. Check the link and try again.');
      setEvents((prev) => prev.filter((e) => !e.live));
      setPhase('idle');
      setImportMeta(null);
    }
  };

  // --- Manual add -----------------------------------------------------------
  const saveDraft = async () => {
    if (!coachId || !draft.title.trim() || !draft.date) return;
    try {
      const created = await coachScheduleService.addEvent(coachId, {
        title: draft.title,
        date: draft.date,
        time: draft.time.trim() || undefined,
        type: draft.type,
        location: draft.location.trim() || undefined,
        opponent: draft.opponent.trim() || undefined,
        source: 'manual',
      });
      setEvents((prev) => sortEvents([...prev, created]));
      setDraft({ title: '', date: todayStr(), time: '', type: 'practice', location: '', opponent: '' });
      setComposerOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Couldn’t save that event.');
    }
  };

  const removeEvent = async (e: LiveEvent) => {
    if (e.live) return;
    try {
      await coachScheduleService.deleteEvent(e.id);
      setEvents((prev) => prev.filter((x) => x.id !== e.id));
    } catch (err) {
      console.error('[schedule] delete failed', err);
    }
  };

  // --- File / URL drop ------------------------------------------------------
  const handleFiles = async (files: FileList | File[]) => {
    if (!coachId) return;
    setError(null);
    for (const file of Array.from(files)) {
      if (file.size > 25 * 1024 * 1024) {
        setError(`"${file.name}" is larger than 25MB and was skipped.`);
        continue;
      }
      try {
        setUploading({ name: file.name, pct: 0 });
        await noraVaultService.addFile(coachId, file, {
          category: 'Schedule',
          onProgress: (pct) => setUploading({ name: file.name, pct }),
        });
      } catch (err: any) {
        setError(err?.message || `Failed to upload "${file.name}".`);
      }
    }
    setUploading(null);
    refresh();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    // A dragged browser link arrives as text/uri-list — treat it as an import.
    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    } else if (uri && /^https?:\/\//i.test(uri.trim())) {
      setUrlInput(uri.trim());
      runImport(uri.trim());
    }
  };

  const removeDoc = async (doc: NoraVaultEntry) => {
    try {
      await noraVaultService.deleteEntry(doc);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      console.error('[schedule] doc delete failed', err);
    }
  };

  const grouped = useMemo(() => groupByDate(events), [events]);
  const busy = phase === 'fetching' || phase === 'writing';

  return (
    <div className="space-y-5">
      {/* Header / explainer */}
      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/8 to-teal-500/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <NoraOrb size={32} />
          <div>
            <div className="text-sm font-bold text-white">Schedule</div>
            <div className="text-xs text-zinc-500">Practices, meetings, lifts & competitions</div>
          </div>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Paste a link to a published schedule — like your athletics site&apos;s competition page — and Nora
          reads it and <span className="text-purple-300 font-medium">writes every event onto your calendar</span>.
          Add events by hand, or drop a schedule file in. Everything here is context Nora can use to answer{' '}
          <span className="text-teal-300 font-medium">&ldquo;when&apos;s our next meet?&rdquo;</span>
        </p>
      </div>

      {/* Link import bar */}
      <div className="rounded-2xl border border-zinc-700/40 bg-zinc-800/30 p-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 bg-zinc-900/60 border border-zinc-700/40 rounded-xl px-3 py-2 focus-within:border-purple-500/40">
            <Link2 className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runImport(urlInput);
              }}
              disabled={busy}
              placeholder="Paste a schedule link (e.g. seminoles.com/sports/mens-track-and-field/schedule/2026)"
              className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none disabled:opacity-50"
            />
          </div>
          <button
            onClick={() => runImport(urlInput)}
            disabled={busy || !urlInput.trim() || !coachId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-teal-500 text-white text-sm font-semibold hover:brightness-110 disabled:opacity-40 transition flex-shrink-0"
          >
            <Sparkles className="w-4 h-4" /> Import with Nora
          </button>
        </div>
      </div>

      {/* Secondary actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setComposerOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95"
        >
          <Plus className="w-4 h-4" /> Add event
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-zinc-200 text-sm hover:bg-zinc-700/60"
        >
          <UploadCloud className="w-4 h-4" /> Upload file
        </button>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/30 text-zinc-400 text-sm hover:text-zinc-200"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Manual composer */}
      <AnimatePresence>
        {composerOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Title (e.g. vs. Florida State)"
                  className="bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                />
                <select
                  value={draft.type}
                  onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as ScheduleEventType }))}
                  className="bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E0FE10]/40"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{TYPE_META[t].label}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                  className="bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E0FE10]/40 [color-scheme:dark]"
                />
                <input
                  value={draft.time}
                  onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
                  placeholder="Time (e.g. 3:30 PM or TBA)"
                  className="bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                />
                <input
                  value={draft.location}
                  onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                  placeholder="Location (optional)"
                  className="bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                />
                <input
                  value={draft.opponent}
                  onChange={(e) => setDraft((d) => ({ ...d, opponent: e.target.value }))}
                  placeholder="Opponent (optional)"
                  className="bg-zinc-900/60 border border-zinc-700/40 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#E0FE10]/40"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={saveDraft}
                  disabled={!draft.title.trim()}
                  className="px-4 py-2 rounded-lg bg-[#E0FE10] text-black text-sm font-semibold hover:brightness-95 disabled:opacity-40"
                >
                  Save event
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-purple-400/60 bg-purple-500/5' : 'border-zinc-700/50 hover:border-zinc-600/60 bg-zinc-800/20'
        }`}
      >
        <UploadCloud className="w-7 h-7 text-zinc-500 mx-auto mb-1.5" />
        <div className="text-sm text-zinc-300">
          {uploading ? (
            <span>
              Uploading <span className="text-[#E0FE10]">{uploading.name}</span> — {uploading.pct}%
            </span>
          ) : (
            <>
              Drop a <span className="text-purple-300">schedule link</span> or a file here, or{' '}
              <span className="text-[#E0FE10]">browse</span>
            </>
          )}
        </div>
        <div className="text-[11px] text-zinc-600 mt-1">Links get parsed by Nora · files up to 25MB</div>
      </div>

      {/* Source documents */}
      {docs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {docs.map((d) => (
            <div
              key={d.id}
              className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/40 text-xs text-zinc-300"
            >
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              <span className="truncate max-w-[180px]">{d.title}</span>
              <button onClick={() => removeDoc(d)} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Nora writing status */}
      <AnimatePresence>
        {phase !== 'idle' && importMeta && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-teal-500/5 p-4 flex items-center gap-3"
          >
            <NoraOrb size={44} active={busy} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">
                {phase === 'fetching' && `Nora is reading ${importMeta.host}…`}
                {phase === 'writing' && `Writing in your schedule… ${writtenCount} of ${importMeta.total}`}
                {phase === 'done' && `Done — added ${importMeta.total} events to your calendar ✓`}
              </div>
              <div className="text-xs text-zinc-400 truncate">
                {importMeta.sourceTitle || importMeta.host}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-zinc-700/50 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-400 to-teal-400"
                  animate={{
                    width:
                      phase === 'fetching'
                        ? '15%'
                        : phase === 'done'
                        ? '100%'
                        : `${importMeta.total ? Math.round((writtenCount / importMeta.total) * 100) : 0}%`,
                  }}
                  transition={{ ease: 'easeOut', duration: 0.3 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule list */}
      <div>
        <div className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          On the calendar {events.length > 0 && <span className="text-zinc-600">({events.filter((e) => !e.live).length || events.length})</span>}
        </div>
        {loading ? (
          <div className="flex items-center gap-3 text-zinc-500 text-sm py-10 justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#E0FE10]" />
            Loading the schedule…
          </div>
        ) : events.length === 0 ? (
          <div className="text-sm text-zinc-500 rounded-xl border border-zinc-800/60 bg-zinc-800/20 p-8 text-center">
            Nothing scheduled yet. Paste a schedule link above and watch Nora fill it in — or add an event by hand.
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(({ date, items }) => {
              const past = date < todayStr();
              return (
                <div key={date}>
                  <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${past ? 'text-zinc-600' : 'text-teal-300/80'}`}>
                    {formatHeading(date)}
                  </div>
                  <div className="space-y-2">
                    <AnimatePresence initial={false}>
                      {items.map((e) => (
                        <EventRow key={e.id} event={e} past={past} onDelete={() => removeEvent(e)} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Event row
// ---------------------------------------------------------------------------

const EventRow: React.FC<{ event: LiveEvent; past: boolean; onDelete: () => void }> = ({ event, past, onDelete }) => {
  const meta = TYPE_META[event.type] || TYPE_META.event;
  const Icon = meta.icon;
  return (
    <motion.div
      layout
      initial={event.live ? { opacity: 0, x: -14 } : false}
      animate={{ opacity: past ? 0.55 : 1, x: 0 }}
      exit={{ opacity: 0, x: 14 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={`relative flex items-start gap-3 p-3 rounded-xl border transition-colors group ${
        event.live
          ? 'bg-purple-500/5 border-purple-500/30'
          : 'bg-zinc-800/40 border-zinc-700/30 hover:bg-zinc-800/60'
      }`}
    >
      {/* ink bar that draws in for freshly-written rows */}
      {event.live && (
        <motion.span
          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-gradient-to-b from-purple-400 to-teal-400"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.3 }}
          style={{ transformOrigin: 'top' }}
        />
      )}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.ring}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white">
            {event.live ? <Typewriter text={event.title} /> : event.title}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${meta.chip}`}>{meta.label}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 flex-wrap">
          {event.time && (
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {event.time}</span>
          )}
          {event.location && (
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>
          )}
          {event.opponent && !event.title.toLowerCase().includes(event.opponent.toLowerCase()) && (
            <span className="text-zinc-400">{event.opponent}</span>
          )}
          {event.notes && <span className="text-zinc-600">· {event.notes}</span>}
        </div>
      </div>
      {!event.live && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
          aria-label="Delete event"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const sortEvents = (list: LiveEvent[]): LiveEvent[] =>
  [...list].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));

const groupByDate = (list: LiveEvent[]): { date: string; items: LiveEvent[] }[] => {
  const sorted = sortEvents(list);
  const map = new Map<string, LiveEvent[]>();
  sorted.forEach((e) => {
    const key = e.date || 'undated';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  });
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
};

export default ScheduleBoard;
