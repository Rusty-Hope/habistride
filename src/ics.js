import { addDays, parseKey, toDateKey, weekdayIndex } from './dates.js';
import { getGoalLabel, getScheduleLabel, isScheduledOn } from './schedule.js';

const ICS_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function pad(value) {
  return String(value).padStart(2, '0');
}

function escapeIcsText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function formatIcsLocal(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    pad(date.getMinutes()),
    '00'
  ].join('');
}

function formatIcsUtc(date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z'
  ].join('');
}

function timeToParts(time) {
  const [hours, minutes] = (time || '09:00').split(':').map(Number);
  return { hours, minutes };
}

function dateFromKeyTime(key, time) {
  const parsed = parseKey(key);
  if (!parsed) return null;
  const { hours, minutes } = timeToParts(time);
  return new Date(parsed.year, parsed.monthIndex, parsed.day, hours, minutes, 0, 0);
}

function nextWeeklyMonday(habit, now, time) {
  const today = toDateKey(now);
  const startBase = habit.createdAt && habit.createdAt > today ? habit.createdAt : today;
  let cursor = addDays(startBase, (7 - weekdayIndex(startBase)) % 7);
  let candidate = dateFromKeyTime(cursor, time);
  if (candidate && candidate <= now) {
    cursor = addDays(cursor, 7);
    candidate = dateFromKeyTime(cursor, time);
  }
  return candidate;
}

function nextFixedOccurrence(habit, now, time) {
  const today = toDateKey(now);
  let cursor = habit.createdAt && habit.createdAt > today ? habit.createdAt : today;
  for (let guard = 0; guard < 370; guard += 1) {
    if (isScheduledOn(habit, cursor)) {
      const candidate = dateFromKeyTime(cursor, time);
      if (candidate && candidate > now) return candidate;
    }
    cursor = addDays(cursor, 1);
  }
  return null;
}

function recurrenceRule(habit) {
  switch (habit.schedule.type) {
    case 'weekdays': {
      const days = [...new Set(habit.schedule.weekdays)]
        .sort((a, b) => a - b)
        .map(day => ICS_DAYS[day])
        .join(',');
      return `FREQ=WEEKLY;BYDAY=${days}`;
    }
    case 'interval':
      return `FREQ=DAILY;INTERVAL=${habit.schedule.intervalDays}`;
    case 'weekly':
      return 'FREQ=WEEKLY;BYDAY=MO';
    case 'daily':
    default:
      return 'FREQ=DAILY';
  }
}

function foldLine(line) {
  if (line.length <= 73) return line;
  const chunks = [];
  let rest = line;
  while (rest.length > 73) {
    chunks.push(rest.slice(0, 73));
    rest = rest.slice(73);
  }
  chunks.push(rest);
  return chunks.join('\r\n ');
}

export function buildReminderCalendar(habits, now = new Date()) {
  const events = [];

  for (const habit of habits) {
    if (habit.archivedAt || !habit.reminder?.enabled || !habit.reminder.time) continue;

    const time = habit.reminder.time;
    const isWeeklyGoal = habit.schedule.type === 'weekly';
    const start = isWeeklyGoal
      ? nextWeeklyMonday(habit, now, time)
      : nextFixedOccurrence(habit, now, time);

    if (!start) continue;
    const end = new Date(start.getTime() + 10 * 60 * 1000);

    const summary = isWeeklyGoal
      ? `Weekly goal: ${habit.name}`
      : `Habit: ${habit.name}`;

    const descriptionParts = [
      getScheduleLabel(habit),
      getGoalLabel(habit)
    ];
    if (isWeeklyGoal) {
      descriptionParts.push(`Target: ${habit.schedule.timesPerWeek} sessions this week`);
    }

    const uid = `${habit.id}@habistride.local`;
    const lines = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatIcsUtc(now)}`,
      `DTSTART:${formatIcsLocal(start)}`,
      `DTEND:${formatIcsLocal(end)}`,
      `RRULE:${recurrenceRule(habit)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(descriptionParts.join(' · '))}`,
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'TRIGGER:-PT0M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(summary)}`,
      'END:VALARM',
      'END:VEVENT'
    ];

    events.push(...lines.map(foldLine));
  }

  if (!events.length) return null;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HabiStride//HabiStride 2.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:HabiStride Reminders',
    ...events,
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}
