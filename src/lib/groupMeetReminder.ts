import { convertLocalDateMinutesToUtcIso } from "./googleCalendar";
import {
  buildGroupMeetFinalSelectionSignature,
  type GroupMeetFinalSelection,
} from "./groupMeet";

export function getGroupMeetFinalReminderDispatchDecision(args: {
  now?: Date | string | number;
  finalSelection: GroupMeetFinalSelection | null | undefined;
  timezone: string;
  sentSelectionSignature?: string | null;
  leadMinutes?: number;
}) {
  const selectionSignature = buildGroupMeetFinalSelectionSignature(
    args.finalSelection,
  );

  if (!selectionSignature || !args.finalSelection) {
    return {
      due: false,
      reason: "missing-final-selection",
      selectionSignature: null,
      startsAtIso: null,
      minutesUntilStart: null,
    } as const;
  }

  const startsAtIso = convertLocalDateMinutesToUtcIso(
    args.finalSelection.date,
    args.finalSelection.startMinutes,
    args.timezone || "America/New_York",
  );
  const now = new Date(args.now || Date.now());
  const startsAt = new Date(startsAtIso);
  const minutesUntilStart = Math.round(
    (startsAt.getTime() - now.getTime()) / 60000,
  );
  const leadMinutes = Math.max(1, Number(args.leadMinutes) || 60);

  if (args.sentSelectionSignature === selectionSignature) {
    return {
      due: false,
      reason: "already-sent",
      selectionSignature,
      startsAtIso,
      minutesUntilStart,
    } as const;
  }

  if (!Number.isFinite(minutesUntilStart)) {
    return {
      due: false,
      reason: "invalid-meeting-start",
      selectionSignature,
      startsAtIso,
      minutesUntilStart: null,
    } as const;
  }

  if (minutesUntilStart <= 0) {
    return {
      due: false,
      reason: "already-started",
      selectionSignature,
      startsAtIso,
      minutesUntilStart,
    } as const;
  }

  if (minutesUntilStart > leadMinutes) {
    return {
      due: false,
      reason: "too-early",
      selectionSignature,
      startsAtIso,
      minutesUntilStart,
    } as const;
  }

  return {
    due: true,
    reason: "within-window",
    selectionSignature,
    startsAtIso,
    minutesUntilStart,
  } as const;
}
