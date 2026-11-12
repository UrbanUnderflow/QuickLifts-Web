// Tells Nora when she last talked with the athlete, so a reopened chat continues
// instead of greeting them again as if it were a new conversation.

function toMillis(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number < 1e12 ? number * 1000 : number; // seconds or milliseconds
}

function localParts(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute} ${parts.dayPeriod}` };
}

function describeGap(minutes) {
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'about an hour ago' : `about ${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'about a day ago' : `${days} days ago`;
}

function buildConversationTimingSection({ recentMessages = [], timeZone, now = Date.now() }) {
  if (!timeZone) return '';
  const times = (recentMessages || []).map((message) => toMillis(message?.timestamp)).filter((t) => t && t <= now + 60000);
  if (!times.length) return '';
  const last = Math.max(...times);
  const minutes = Math.max(0, Math.round((now - last) / 60000));
  let nowLocal;
  let lastLocal;
  try {
    nowLocal = localParts(new Date(now), timeZone);
    lastLocal = localParts(new Date(last), timeZone);
  } catch {
    return '';
  }
  const sameDay = nowLocal.day === lastLocal.day;
  const when = sameDay ? `${lastLocal.time} today` : `${lastLocal.time} on ${lastLocal.day}`;
  const guidance = sameDay
    ? 'You have already talked today. Continue the conversation: do not greet them again or start over as if it is new.'
      + (minutes >= 120 ? ' Some time has passed, so you can pick up naturally from where things were, in a few words at most.' : '')
    : 'This is a new day since you last talked. A short greeting is fine; you can refer back to the last conversation if it helps.';
  return `\n\n### Conversation Timing\nIt is now ${nowLocal.time} for the athlete. You last talked ${describeGap(minutes)} (${when}). ${guidance}`;
}

module.exports = { buildConversationTimingSection };
