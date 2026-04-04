import React, { useMemo, useState } from 'react';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { Clock, Plus, Trash2 } from 'lucide-react';
import {
  formatMinutesAsTime,
  minutesToTimeInputValue,
  timeInputValueToMinutes,
  type GroupMeetAvailabilitySlot,
  type GroupMeetSharedAvailabilityParticipant,
} from '../../lib/groupMeet';

type DayRangeDraft = {
  start: string;
  end: string;
};

type GroupMeetAvailabilityPickerProps = {
  targetMonth: string;
  availabilityEntries: GroupMeetAvailabilitySlot[];
  peerAvailability?: GroupMeetSharedAvailabilityParticipant[];
  onChange: (slots: GroupMeetAvailabilitySlot[]) => void;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
};

type PeerAvailabilityForDate = GroupMeetSharedAvailabilityParticipant & {
  daySlots: GroupMeetAvailabilitySlot[];
  tooltip: string;
};

function sortAvailabilitySlots(slots: GroupMeetAvailabilitySlot[]) {
  return [...slots].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    if (left.startMinutes !== right.startMinutes) {
      return left.startMinutes - right.startMinutes;
    }

    return left.endMinutes - right.endMinutes;
  });
}

function buildCalendarDays(targetMonth: string) {
  const firstDay = startOfMonth(parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date()));
  const lastDay = endOfMonth(firstDay);
  const calendarStart = startOfWeek(firstDay, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(lastDay, { weekStartsOn: 0 });
  const days: Date[] = [];

  for (let current = calendarStart; current <= calendarEnd; current = addDays(current, 1)) {
    days.push(current);
  }

  return days;
}

function getParticipantInitials(name: string) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
}

function buildPeerTooltip(peer: GroupMeetSharedAvailabilityParticipant, slots: GroupMeetAvailabilitySlot[]) {
  const prefix = `${peer.name}${peer.participantType === 'host' ? ' • Host' : ''}`;
  const slotLines = slots.map(
    (slot) => `${formatMinutesAsTime(slot.startMinutes)} - ${formatMinutesAsTime(slot.endMinutes)}`
  );

  return [prefix, ...slotLines].join('\n');
}

function PeerAvatar({
  peer,
  size = 'sm',
}: {
  peer: PeerAvailabilityForDate;
  size?: 'sm' | 'md';
}) {
  const wrapperClassName =
    size === 'md'
      ? 'h-10 w-10 rounded-2xl text-sm'
      : 'h-7 w-7 rounded-xl text-[10px]';
  const badgeClassName =
    size === 'md'
      ? 'h-4 min-w-[1rem] rounded-full px-1 text-[9px]'
      : 'h-3.5 min-w-[0.875rem] rounded-full px-1 text-[8px]';

  return (
    <div className="group relative">
      <div
        title={peer.tooltip}
        className={`relative flex ${wrapperClassName} items-center justify-center overflow-hidden border border-white/10 bg-[#121821] font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.03)]`}
      >
        {peer.imageUrl ? (
          <img src={peer.imageUrl} alt={peer.name} className="h-full w-full object-cover" />
        ) : (
          <span>{getParticipantInitials(peer.name)}</span>
        )}
        {peer.participantType === 'host' && (
          <span className={`absolute -bottom-1 -right-1 flex items-center justify-center border border-[#0b1016] bg-[#E0FE10] font-bold text-black ${badgeClassName}`}>
            H
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-48 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0b1016] p-3 text-[11px] text-zinc-200 shadow-2xl group-hover:block">
        <div className="font-medium text-white">
          {peer.name}
          {peer.participantType === 'host' ? ' • Host' : ''}
        </div>
        <div className="mt-2 space-y-1">
          {peer.daySlots.map((slot) => (
            <div key={`${peer.token}-${slot.date}-${slot.startMinutes}-${slot.endMinutes}`} className="rounded-lg bg-white/[0.04] px-2 py-1">
              {formatMinutesAsTime(slot.startMinutes)} - {formatMinutesAsTime(slot.endMinutes)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GroupMeetAvailabilityPicker({
  targetMonth,
  availabilityEntries,
  peerAvailability = [],
  onChange,
  disabled = false,
  title = 'Pick availability',
  subtitle = 'Tap a day and add one or more time ranges.',
  className = '',
}: GroupMeetAvailabilityPickerProps) {
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [draftRanges, setDraftRanges] = useState<DayRangeDraft[]>([]);
  const [duplicateDates, setDuplicateDates] = useState<string[]>([]);

  const calendarDays = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(targetMonth || '')) {
      return [];
    }
    return buildCalendarDays(targetMonth);
  }, [targetMonth]);

  const slotsByDate = useMemo(() => {
    const next = new Map<string, GroupMeetAvailabilitySlot[]>();
    for (const slot of availabilityEntries) {
      const current = next.get(slot.date) || [];
      current.push(slot);
      next.set(slot.date, current);
    }
    return next;
  }, [availabilityEntries]);
  const peerAvailabilityByDate = useMemo(() => {
    const next = new Map<string, PeerAvailabilityForDate[]>();

    for (const participant of peerAvailability) {
      const daySlotsByDate = new Map<string, GroupMeetAvailabilitySlot[]>();

      for (const slot of participant.availabilityEntries || []) {
        const current = daySlotsByDate.get(slot.date) || [];
        current.push(slot);
        daySlotsByDate.set(slot.date, current);
      }

      for (const [date, daySlots] of daySlotsByDate.entries()) {
        const peersForDate = next.get(date) || [];
        const sortedDaySlots = sortAvailabilitySlots(daySlots);
        peersForDate.push({
          ...participant,
          daySlots: sortedDaySlots,
          tooltip: buildPeerTooltip(participant, sortedDaySlots),
        });
        next.set(date, peersForDate);
      }
    }

    for (const peersForDate of next.values()) {
      peersForDate.sort((left, right) => {
        if (left.participantType !== right.participantType) {
          return left.participantType === 'host' ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      });
    }

    return next;
  }, [peerAvailability]);

  const selectedDateCount = slotsByDate.size;
  const duplicableDates = useMemo(
    () =>
      calendarDays
        .filter((day) => isSameMonth(day, parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date())))
        .map((day) => ({
          date: format(day, 'yyyy-MM-dd'),
          label: format(day, 'EEE, MMM d'),
          dayOfWeek: day.getDay(),
        }))
        .filter((entry) => entry.date !== activeDate),
    [activeDate, calendarDays, targetMonth]
  );
  const activeDatePeerAvailability = useMemo(
    () => (activeDate ? peerAvailabilityByDate.get(activeDate) || [] : []),
    [activeDate, peerAvailabilityByDate]
  );

  const openDayEditor = (date: string) => {
    const slots = slotsByDate.get(date) || [];
    setActiveDate(date);
    setDuplicateDates([]);
    setDraftRanges(
      slots.length
        ? slots.map((slot) => ({
            start: minutesToTimeInputValue(slot.startMinutes),
            end: minutesToTimeInputValue(slot.endMinutes),
          }))
        : [{ start: '09:00', end: '10:00' }]
    );
  };

  const closeEditor = () => {
    setActiveDate(null);
    setDraftRanges([]);
    setDuplicateDates([]);
  };

  const updateDraftRange = (index: number, field: keyof DayRangeDraft, value: string) => {
    setDraftRanges((current) =>
      current.map((range, rangeIndex) => (rangeIndex === index ? { ...range, [field]: value } : range))
    );
  };

  const addDraftRange = () => {
    setDraftRanges((current) => [...current, { start: '13:00', end: '14:00' }]);
  };

  const removeDraftRange = (index: number) => {
    setDraftRanges((current) => (current.length === 1 ? [] : current.filter((_, rangeIndex) => rangeIndex !== index)));
  };

  const toggleDuplicateDate = (date: string) => {
    setDuplicateDates((current) =>
      current.includes(date)
        ? current.filter((entry) => entry !== date)
        : [...current, date]
    );
  };

  const selectMatchingWeekdayDates = () => {
    if (!activeDate) return;

    const activeDay = parse(activeDate, 'yyyy-MM-dd', new Date()).getDay();
    setDuplicateDates(
      duplicableDates
        .filter((entry) => entry.dayOfWeek === activeDay)
        .map((entry) => entry.date)
    );
  };

  const saveDayRanges = () => {
    if (!activeDate) return;

    const nextSlots: GroupMeetAvailabilitySlot[] = [];
    for (const range of draftRanges) {
      const startMinutes = timeInputValueToMinutes(range.start);
      const endMinutes = timeInputValueToMinutes(range.end);
      if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) continue;
      if (startMinutes >= endMinutes) continue;
      nextSlots.push({ date: activeDate, startMinutes, endMinutes });
    }

    const datesToCopy = nextSlots.length ? duplicateDates : [];
    const targetDates = [activeDate, ...datesToCopy];
    const duplicatedSlots = datesToCopy.flatMap((date) =>
      nextSlots.map((slot) => ({
        ...slot,
        date,
      }))
    );

    onChange(
      sortAvailabilitySlots([
        ...availabilityEntries.filter((slot) => !targetDates.includes(slot.date)),
        ...nextSlots,
        ...duplicatedSlots,
      ])
    );
    closeEditor();
  };

  return (
    <section className={`rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:p-6 ${className}`.trim()}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-zinc-400 mt-1">
            {selectedDateCount} day{selectedDateCount === 1 ? '' : 's'} selected
          </p>
          <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.18em] text-zinc-500 mb-3">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const inTargetMonth = isSameMonth(
            day,
            parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date())
          );
          const slots = slotsByDate.get(dateKey) || [];
          const peerParticipants = peerAvailabilityByDate.get(dateKey) || [];

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => inTargetMonth && !disabled && openDayEditor(dateKey)}
              disabled={!inTargetMonth || disabled}
              className={`min-h-[92px] rounded-2xl border p-2 text-left transition-colors ${
                inTargetMonth
                  ? slots.length
                    ? 'border-[#E0FE10]/50 bg-[#E0FE10]/10 hover:bg-[#E0FE10]/15'
                    : peerParticipants.length
                      ? 'border-emerald-400/20 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.1]'
                    : 'border-white/10 bg-black/30 hover:bg-white/[0.06]'
                  : 'border-white/5 bg-white/[0.02] text-zinc-700'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <div className="text-sm font-medium">{format(day, 'd')}</div>
              {Boolean(peerParticipants.length) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {peerParticipants.slice(0, 3).map((peer) => (
                    <PeerAvatar key={`${dateKey}-${peer.token}`} peer={peer} size="sm" />
                  ))}
                  {peerParticipants.length > 3 && (
                    <div className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-xl border border-white/10 bg-black/35 px-1 text-[10px] font-medium text-zinc-200">
                      +{peerParticipants.length - 3}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-2 space-y-1">
                {slots.slice(0, 2).map((slot) => (
                  <div key={`${slot.date}-${slot.startMinutes}-${slot.endMinutes}`} className="rounded-lg bg-black/35 px-2 py-1 text-[11px] text-zinc-200">
                    {formatMinutesAsTime(slot.startMinutes)} - {formatMinutesAsTime(slot.endMinutes)}
                  </div>
                ))}
                {slots.length > 2 && (
                  <div className="text-[11px] text-zinc-300">+{slots.length - 2} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {activeDate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0b1016] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold">{format(parse(activeDate, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM d')}</h3>
                <p className="text-sm text-zinc-400 mt-1">Add one or more time ranges for this day.</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
              >
                Close
              </button>
            </div>

            {Boolean(activeDatePeerAvailability.length) && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-medium text-white">Already available this day</div>
                <p className="mt-1 text-sm text-zinc-400">
                  Hover a guest image to see the time ranges they already saved.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {activeDatePeerAvailability.map((peer) => (
                    <div
                      key={`${activeDate}-${peer.token}`}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
                    >
                      <PeerAvatar peer={peer} size="md" />
                      <div>
                        <div className="text-sm font-medium text-white">
                          {peer.name}
                          {peer.participantType === 'host' ? ' • Host' : ''}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {peer.daySlots.length} time slot{peer.daySlots.length === 1 ? '' : 's'} saved
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3">
              {draftRanges.map((range, index) => (
                <div key={`range-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                  <label className="block">
                    <span className="block text-xs uppercase tracking-[0.18em] text-zinc-500 mb-2">Start</span>
                    <input
                      type="time"
                      value={range.start}
                      onChange={(event) => updateDraftRange(index, 'start', event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#05070b] px-3 py-3 text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs uppercase tracking-[0.18em] text-zinc-500 mb-2">End</span>
                    <input
                      type="time"
                      value={range.end}
                      onChange={(event) => updateDraftRange(index, 'end', event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#05070b] px-3 py-3 text-white"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => removeDraftRange(index)}
                    className="mt-7 rounded-xl border border-white/10 px-3 py-3 text-zinc-300 hover:bg-white/5"
                    aria-label={`Remove time range ${index + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {!draftRanges.length && (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
                  No time ranges for this day yet.
                </div>
              )}
            </div>

            {Boolean(duplicableDates.length) && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Duplicate to dates</div>
                    <p className="mt-1 text-sm text-zinc-400">
                      Save these same time ranges onto any other dates in this month.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectMatchingWeekdayDates}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      Same weekday
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateDates([])}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      Clear copies
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {duplicableDates.map((entry) => {
                    const selected = duplicateDates.includes(entry.date);
                    return (
                      <button
                        key={entry.date}
                        type="button"
                        onClick={() => toggleDuplicateDate(entry.date)}
                        className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                          selected
                            ? 'border-[#E0FE10]/60 bg-[#E0FE10]/15 text-[#F4FF8A]'
                            : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]'
                        }`}
                      >
                        {entry.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 text-xs text-zinc-500">
                  {duplicateDates.length
                    ? `These dates will be overwritten with the same time ranges when you save.`
                    : 'Pick any dates you want to copy this day onto.'}
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={addDraftRange}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm hover:bg-white/[0.08]"
              >
                <Plus className="w-4 h-4" />
                Add time range
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onChange(availabilityEntries.filter((slot) => slot.date !== activeDate));
                    closeEditor();
                  }}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-300 hover:bg-white/5"
                >
                  Clear day
                </button>
                <button
                  type="button"
                  onClick={saveDayRanges}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#E0FE10] px-4 py-3 text-sm font-semibold text-black hover:bg-lime-300"
                >
                  <Clock className="w-4 h-4" />
                  {duplicateDates.length ? `Save + copy to ${duplicateDates.length}` : 'Save day'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
