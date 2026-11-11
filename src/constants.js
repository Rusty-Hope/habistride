export const APP_NAME = 'HabiStride';
export const APP_VERSION = '2.0.0';
export const SCHEMA_VERSION = 2;

export const STORAGE_PREFIX = 'habit_tracker_v2';
export const STORAGE_KEYS = Object.freeze({
  state: `${STORAGE_PREFIX}:state`,
  settings: `${STORAGE_PREFIX}:settings`,
  snapshots: `${STORAGE_PREFIX}:snapshots`,
  installDismissed: `${STORAGE_PREFIX}:install-dismissed`
});

export const LEGACY_KEYS = Object.freeze({
  state: 'habit_tracker_v1:habits',
  settings: 'habit_tracker_v1:settings'
});

export const LIMITS = Object.freeze({
  maxHabits: 100,
  maxNameLength: 80,
  maxUnitLength: 24,
  maxNoteLength: 1000,
  maxLogEntries: 20000,
  maxHabitSnapshots: 5,
  maxImportBytes: 5 * 1024 * 1024
});

export const VIEWS = Object.freeze(['today', 'calendar', 'insights']);

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'system',
  view: 'today',
  onboarded: false,
  lastBackupAt: null
});

export const DISPLAY_MODE_STANDALONE_QUERY = '(display-mode: standalone)';

export const WEEKDAYS = Object.freeze([
  { value: 0, short: 'Mon', long: 'Monday' },
  { value: 1, short: 'Tue', long: 'Tuesday' },
  { value: 2, short: 'Wed', long: 'Wednesday' },
  { value: 3, short: 'Thu', long: 'Thursday' },
  { value: 4, short: 'Fri', long: 'Friday' },
  { value: 5, short: 'Sat', long: 'Saturday' },
  { value: 6, short: 'Sun', long: 'Sunday' }
]);

export const COLORS = Object.freeze([
  { value: '#5E6AD2', name: 'Indigo' },
  { value: '#3D8B69', name: 'Green' },
  { value: '#B7791F', name: 'Amber' },
  { value: '#B85C76', name: 'Rose' },
  { value: '#8064C7', name: 'Violet' },
  { value: '#2C8C8A', name: 'Teal' },
  { value: '#5D7288', name: 'Slate' },
  { value: '#B5624B', name: 'Rust' }
]);

export const EMOJIS = Object.freeze([
  '🎯', '📖', '🏋️', '🧘', '💧', '🥗', '✍️', '🎸',
  '🧹', '💊', '☀️', '🚶', '🍎', '💻', '🌱', '🎨'
]);

const DAILY = Object.freeze({
  type: 'daily',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  timesPerWeek: 7,
  intervalDays: 1
});

const BINARY = Object.freeze({ type: 'binary', target: 1, unit: '' });

export const TEMPLATES = Object.freeze([
  {
    id: 'deep-work',
    name: 'Deep Work',
    emoji: '🎯',
    color: '#5E6AD2',
    schedule: { ...DAILY, type: 'weekdays', weekdays: [0, 1, 2, 3, 4], timesPerWeek: 5 },
    goal: { ...BINARY }
  },
  {
    id: 'read',
    name: 'Read 20 pages',
    emoji: '📖',
    color: '#3D8B69',
    schedule: { ...DAILY },
    goal: { ...BINARY }
  },
  {
    id: 'workout',
    name: 'Workout',
    emoji: '🏋️',
    color: '#B7791F',
    schedule: { ...DAILY, type: 'weekly', timesPerWeek: 3 },
    goal: { ...BINARY }
  },
  {
    id: 'meditate',
    name: 'Meditate 10 minutes',
    emoji: '🧘',
    color: '#8064C7',
    schedule: { ...DAILY },
    goal: { ...BINARY }
  },
  {
    id: 'water',
    name: 'Drink water',
    emoji: '💧',
    color: '#2C8C8A',
    schedule: { ...DAILY },
    goal: { type: 'count', target: 8, unit: 'glasses' }
  },
  {
    id: 'walk',
    name: 'Walk 10,000 steps',
    emoji: '🚶',
    color: '#5D7288',
    schedule: { ...DAILY },
    goal: { type: 'count', target: 10000, unit: 'steps' }
  }
]);

export const IMPORT_ERROR_MESSAGES = Object.freeze({
  'invalid-json': 'That file is not valid JSON.',
  'unsupported-version': 'This backup version is not supported.',
  'invalid-format': 'This file does not look like a HabiStride backup.',
  'invalid-habit': 'The backup contains a habit with invalid data.',
  'too-many-habits': 'The backup contains too many habits.',
  'file-too-large': 'This file is too large to import.'
});
