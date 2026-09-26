/** YYYY-MM-DD in the user's local timezone (toISOString would give the UTC date). */
export function localDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// toLocale*String builds a new Intl formatter on every call, which is slow in lists; reuse them.
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const shortDateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const clockFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayCache = new Map<string, string>();

/** "Sat, 26 Sep" for a YYYY-MM-DD string, interpreted as a local date. */
export function formatDay(dateStr: string): string {
  let out = dayCache.get(dateStr);
  if (out === undefined) {
    const [y, m, d] = dateStr.split('-').map(Number);
    out = dayFormat.format(new Date(y, m - 1, d));
    dayCache.set(dateStr, out);
  }
  return out;
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", or a date, for an ISO timestamp. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return 'Yesterday';
  return shortDateFormat.format(then);
}

/** Local clock time ("9:05 AM") for an ISO timestamp. */
export function clockTime(iso: string): string {
  return clockFormat.format(new Date(iso));
}
