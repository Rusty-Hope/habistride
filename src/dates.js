const DAY_MS = 86400000;

export function pad(value) {
  return String(value).padStart(2, '0');
}

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey() {
  return toDateKey(new Date());
}

export function buildKey(year, monthIndex, day) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

export function parseKey(key) {
  if (typeof key !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, monthIndex, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== monthIndex ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, monthIndex, day };
}

export function isValidDateKey(key) {
  return parseKey(key) !== null;
}

export function addDays(key, amount) {
  const parsed = parseKey(key);
  if (!parsed) return key;
  const date = new Date(Date.UTC(parsed.year, parsed.monthIndex, parsed.day + amount));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function diffDays(laterKey, earlierKey) {
  const later = parseKey(laterKey);
  const earlier = parseKey(earlierKey);
  if (!later || !earlier) return 0;
  return Math.round(
    (Date.UTC(later.year, later.monthIndex, later.day) -
      Date.UTC(earlier.year, earlier.monthIndex, earlier.day)) / DAY_MS
  );
}

export function weekdayIndex(key) {
  const parsed = parseKey(key);
  if (!parsed) return 0;
  const dayOfWeek = new Date(Date.UTC(parsed.year, parsed.monthIndex, parsed.day)).getUTCDay();
  return (dayOfWeek + 6) % 7;
}

export function startOfWeek(key) {
  return addDays(key, -weekdayIndex(key));
}

export function endOfWeek(key) {
  return addDays(startOfWeek(key), 6);
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function monthStartKey(year, monthIndex) {
  return buildKey(year, monthIndex, 1);
}

export function monthEndKey(year, monthIndex) {
  return buildKey(year, monthIndex, daysInMonth(year, monthIndex));
}

const longDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC'
});

const dayMonthFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC'
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC'
});

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  timeZone: 'UTC'
});

const monthShortFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  timeZone: 'UTC'
});

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

export function formatLongDate(value = new Date()) {
  if (typeof value === 'string') {
    const parsed = parseKey(value);
    if (parsed) {
      return longDateFormatter.format(new Date(Date.UTC(parsed.year, parsed.monthIndex, parsed.day, 12)));
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  return longDateFormatter.format(
    new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12))
  );
}

export function formatMonthName(monthIndex) {
  return monthFormatter.format(new Date(Date.UTC(2024, monthIndex, 1, 12)));
}

export function formatMonthShort(monthIndex) {
  return monthShortFormatter.format(new Date(Date.UTC(2024, monthIndex, 1, 12)));
}

export function formatMonthYear(year, monthIndex) {
  return `${formatMonthName(monthIndex)} ${year}`;
}

export function formatDateKey(key) {
  const parsed = parseKey(key);
  if (!parsed) return key;
  return dayMonthFormatter.format(new Date(Date.UTC(parsed.year, parsed.monthIndex, parsed.day, 12)));
}

export function formatShortDateKey(key) {
  const parsed = parseKey(key);
  if (!parsed) return key;
  return shortDateFormatter.format(new Date(Date.UTC(parsed.year, parsed.monthIndex, parsed.day, 12)));
}

export function formatTimestamp(isoString) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Never';
  return timestampFormatter.format(date);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function uid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return `habit-${globalThis.crypto.randomUUID()}`;
  }
  return `habit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadText(text, filename, mimeType = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type: mimeType }), filename);
}

export function contrastColor(hex) {
  const raw = String(hex).replace('#', '');
  const channels = [0, 2, 4].map(offset => {
    const channel = parseInt(raw.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.42 ? '#17181c' : '#ffffff';
}

export function csvEscape(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text) && !/^-\d+(\.\d+)?$/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

