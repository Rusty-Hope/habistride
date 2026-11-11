import {
  APP_NAME,
  LIMITS,
  SCHEMA_VERSION,
  VIEWS,
  DEFAULT_SETTINGS
} from './constants.js';
import {
  clamp,
  isValidDateKey,
  todayKey,
  uid
} from './dates.js';

export class SchemaError extends Error {
  constructor(code) {
    super(code);
    this.name = 'SchemaError';
    this.code = code;
  }
}

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeSchedule(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const type = ['daily', 'weekdays', 'weekly', 'interval'].includes(source.type)
    ? source.type
    : 'daily';

  let weekdays = Array.isArray(source.weekdays)
    ? [...new Set(source.weekdays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6))]
    : [...ALL_WEEKDAYS];
  weekdays.sort((a, b) => a - b);

  if (type === 'weekdays' && !weekdays.length) {
    weekdays = [0, 1, 2, 3, 4];
  }
  if (type === 'daily' || type === 'weekly' || type === 'interval') {
    weekdays = [...ALL_WEEKDAYS];
  }

  const timesPerWeek = Number.isInteger(source.timesPerWeek)
    ? clamp(source.timesPerWeek, 1, 7)
    : (type === 'weekly' ? 3 : 7);
  const intervalDays = Number.isInteger(source.intervalDays)
    ? clamp(source.intervalDays, 1, 365)
    : 2;

  return { type, weekdays, timesPerWeek, intervalDays };
}

export function normalizeGoal(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const type = source.type === 'count' ? 'count' : 'binary';

  if (type === 'count') {
    const target = Number(source.target);
    return {
      type,
      target: Number.isFinite(target) && target > 0 ? Math.min(1000000, target) : 1,
      unit: typeof source.unit === 'string' ? source.unit.trim().slice(0, LIMITS.maxUnitLength) : ''
    };
  }

  return { type: 'binary', target: 1, unit: '' };
}

export function normalizeReminder(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const enabled = source.enabled === true;
  const time = typeof source.time === 'string' && TIME_PATTERN.test(source.time)
    ? source.time
    : null;

  return { enabled: enabled && Boolean(time), time };
}

export function normalizeNotes(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const notes = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isValidDateKey(key) || typeof value !== 'string') continue;
    const text = value.trim().slice(0, LIMITS.maxNoteLength);
    if (text) notes[key] = text;
  }
  return notes;
}

export function normalizeSkips(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const skips = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === true && isValidDateKey(key)) skips[key] = true;
  }
  return skips;
}

export function normalizeLogs(raw, goal, today = todayKey()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const logs = {};
  const entries = Object.entries(raw);

  if (entries.length > LIMITS.maxLogEntries) {
    throw new SchemaError('invalid-habit');
  }

  for (const [key, value] of entries) {
    if (!isValidDateKey(key) || key > today) continue;

    if (goal.type === 'count') {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        logs[key] = Math.min(10000000, value);
      }
      continue;
    }

    if (value === true) logs[key] = true;
  }

  return logs;
}

export function normalizeHabit(raw, usedIds = new Set(), today = todayKey()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SchemaError('invalid-habit');
  }

  const name = typeof raw.name === 'string'
    ? raw.name.trim().replace(/\s+/g, ' ').slice(0, LIMITS.maxNameLength)
    : '';
  if (!name) throw new SchemaError('invalid-habit');

  let emoji = '🌱';
  if (raw.emoji !== undefined) {
    if (typeof raw.emoji !== 'string' || !raw.emoji.trim()) {
      throw new SchemaError('invalid-habit');
    }
    emoji = raw.emoji.trim().slice(0, 16);
  }

  let color = '#5E6AD2';
  if (raw.color !== undefined) {
    if (typeof raw.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw.color)) {
      throw new SchemaError('invalid-habit');
    }
    color = raw.color.toUpperCase();
  }

  let createdAt = today;
  if (raw.createdAt !== undefined) {
    if (typeof raw.createdAt !== 'string' || !isValidDateKey(raw.createdAt)) {
      throw new SchemaError('invalid-habit');
    }
    createdAt = raw.createdAt;
  } else {
    const earliestLog = raw.logs && typeof raw.logs === 'object'
      ? Object.keys(raw.logs).filter(isValidDateKey).sort()[0]
      : null;
    createdAt = earliestLog || today;
  }
  if (createdAt > today) createdAt = today;

  let archivedAt = null;
  if (raw.archivedAt !== undefined && raw.archivedAt !== null) {
    if (typeof raw.archivedAt !== 'string' || !isValidDateKey(raw.archivedAt)) {
      throw new SchemaError('invalid-habit');
    }
    archivedAt = raw.archivedAt > today ? today : raw.archivedAt;
    if (archivedAt < createdAt) archivedAt = null;
  }

  const schedule = normalizeSchedule(raw.schedule);
  const goal = normalizeGoal(raw.goal);
  const reminder = normalizeReminder(raw.reminder);
  const logs = normalizeLogs(raw.logs, goal, today);
  const notes = normalizeNotes(raw.notes);
  const skips = normalizeSkips(raw.skips);

  let id;
  if (
    typeof raw.id === 'string' &&
    raw.id.trim() &&
    raw.id.length <= 120 &&
    !usedIds.has(raw.id)
  ) {
    id = raw.id;
  } else {
    id = uid();
  }
  usedIds.add(id);

  return {
    id,
    name,
    emoji,
    color,
    createdAt,
    archivedAt,
    schedule,
    goal,
    reminder,
    logs,
    notes,
    skips
  };
}

function migrateV1Habit(habit, usedIds, today) {
  if (!habit || typeof habit !== 'object') throw new SchemaError('invalid-habit');

  const logs = {};
  if (habit.logs && typeof habit.logs === 'object') {
    for (const [key, value] of Object.entries(habit.logs)) {
      if (value === true && isValidDateKey(key) && key <= today) logs[key] = true;
    }
  }

  return normalizeHabit({
    ...habit,
    createdAt: habit.createdAt,
    logs,
    notes: {},
    skips: {},
    archivedAt: null,
    schedule: normalizeSchedule({ type: 'daily' }),
    goal: normalizeGoal({ type: 'binary' }),
    reminder: normalizeReminder({})
  }, usedIds, today);
}

export function parseState(payload, today = todayKey()) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new SchemaError('invalid-format');
  }

  if (!Array.isArray(payload.habits)) {
    throw new SchemaError('invalid-format');
  }

  if (payload.habits.length > LIMITS.maxHabits) {
    throw new SchemaError('too-many-habits');
  }

  if (payload.schemaVersion === undefined) {
    throw new SchemaError('invalid-format');
  }

  if (payload.schemaVersion !== 1 && payload.schemaVersion !== SCHEMA_VERSION) {
    throw new SchemaError('unsupported-version');
  }

  const usedIds = new Set();
  if (payload.schemaVersion === 1) {
    return payload.habits.map(habit => migrateV1Habit(habit, usedIds, today));
  }

  return payload.habits.map(habit => normalizeHabit(habit, usedIds, today));
}

export function parseBackupText(text, today = todayKey()) {
  const normalized = typeof text === 'string' && text.charCodeAt(0) === 0xFEFF
    ? text.slice(1)
    : text;

  let payload;
  try {
    payload = JSON.parse(normalized);
  } catch (error) {
    throw new SchemaError('invalid-json');
  }

  const habits = parseState(payload, today);
  return { habits, summary: summarizeHabits(habits) };
}

export function serializeHabits(habits) {
  return habits.map(habit => ({
    id: habit.id,
    name: habit.name,
    emoji: habit.emoji,
    color: habit.color,
    createdAt: habit.createdAt,
    archivedAt: habit.archivedAt,
    schedule: {
      type: habit.schedule.type,
      weekdays: [...habit.schedule.weekdays],
      timesPerWeek: habit.schedule.timesPerWeek,
      intervalDays: habit.schedule.intervalDays
    },
    goal: { ...habit.goal },
    reminder: { ...habit.reminder },
    logs: sortObject(habit.logs),
    notes: sortObject(habit.notes),
    skips: sortObject(habit.skips)
  }));
}

function sortObject(object) {
  const result = {};
  Object.keys(object || {}).sort().forEach(key => {
    result[key] = object[key];
  });
  return result;
}

export function createBackup(habits) {
  return {
    schemaVersion: SCHEMA_VERSION,
    app: APP_NAME,
    exportedAt: new Date().toISOString(),
    habits: serializeHabits(habits)
  };
}

export function summarizeHabits(habits) {
  let checkIns = 0;
  let partials = 0;
  let notes = 0;
  let skips = 0;
  let archived = 0;
  let reminders = 0;
  let earliest = null;
  let latest = null;

  for (const habit of habits) {
    if (habit.archivedAt) archived += 1;
    if (habit.reminder.enabled) reminders += 1;
    notes += Object.keys(habit.notes || {}).length;
    skips += Object.keys(habit.skips || {}).length;

    if (habit.createdAt && (!earliest || habit.createdAt < earliest)) {
      earliest = habit.createdAt;
    }

    for (const [key, value] of Object.entries(habit.logs || {})) {
      const done = habit.goal.type === 'count'
        ? Number(value) >= habit.goal.target
        : value === true;
      if (done) checkIns += 1;
      else partials += 1;
      if (!latest || key > latest) latest = key;
    }

    for (const key of Object.keys(habit.notes || {})) {
      if (!latest || key > latest) latest = key;
    }
  }

  return {
    habits: habits.length,
    active: habits.length - archived,
    archived,
    checkIns,
    partials,
    notes,
    skips,
    reminders,
    earliest,
    latest
  };
}

export function summaryText(summary) {
  const parts = [
    `${summary.habits} ${summary.habits === 1 ? 'habit' : 'habits'}`,
    `${summary.checkIns} completed ${summary.checkIns === 1 ? 'check-in' : 'check-ins'}`
  ];
  if (summary.notes) parts.push(`${summary.notes} ${summary.notes === 1 ? 'note' : 'notes'}`);
  if (summary.skips) parts.push(`${summary.skips} rest ${summary.skips === 1 ? 'day' : 'days'}`);
  return parts.join(', ');
}

export function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const theme = ['system', 'light', 'dark'].includes(source.theme) ? source.theme : DEFAULT_SETTINGS.theme;
  const view = VIEWS.includes(source.view) ? source.view : DEFAULT_SETTINGS.view;
  const onboarded = source.onboarded === true;
  let lastBackupAt = null;
  if (typeof source.lastBackupAt === 'string') {
    const date = new Date(source.lastBackupAt);
    if (!Number.isNaN(date.getTime())) lastBackupAt = date.toISOString();
  }

  return { theme, view, onboarded, lastBackupAt };
}


