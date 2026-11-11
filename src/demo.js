import { addDays, startOfWeek, todayKey, weekdayIndex } from './dates.js';
import { normalizeHabit } from './schema.js';

export function createDemoHabits(today = todayKey()) {
  const createdAt = addDays(today, -365);
  const usedIds = new Set();

  const deepWork = {
    id: 'demo-deep-work',
    name: 'Deep Work',
    emoji: '🎯',
    color: '#5E6AD2',
    createdAt,
    archivedAt: null,
    schedule: {
      type: 'weekdays',
      weekdays: [0, 1, 2, 3, 4],
      timesPerWeek: 5,
      intervalDays: 1
    },
    goal: { type: 'binary', target: 1, unit: '' },
    reminder: { enabled: true, time: '09:00' },
    logs: {},
    notes: {},
    skips: {}
  };

  for (let offset = 0; offset <= 365; offset += 1) {
    const key = addDays(today, -offset);
    if (weekdayIndex(key) <= 4 && offset !== 47 && (offset === 0 || offset % 61 !== 0)) {
      deepWork.logs[key] = true;
    }
  }

  const read = {
    id: 'demo-read',
    name: 'Read 20 pages',
    emoji: '📖',
    color: '#3D8B69',
    createdAt,
    archivedAt: null,
    schedule: {
      type: 'daily',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      timesPerWeek: 7,
      intervalDays: 1
    },
    goal: { type: 'binary', target: 1, unit: '' },
    reminder: { enabled: true, time: '20:30' },
    logs: {},
    notes: {},
    skips: {}
  };

  for (let offset = 0; offset <= 365; offset += 1) {
    if (offset % 7 === 6) continue;
    if (offset === 13) continue;
    read.logs[addDays(today, -offset)] = true;
  }
  read.notes[addDays(today, -1)] = 'Finished chapter 4.';
  const restDay = addDays(today, -12);
  read.skips[restDay] = true;
  delete read.logs[restDay];

  const workout = {
    id: 'demo-workout',
    name: 'Workout',
    emoji: '🏋️',
    color: '#B7791F',
    createdAt,
    archivedAt: null,
    schedule: {
      type: 'weekly',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      timesPerWeek: 3,
      intervalDays: 1
    },
    goal: { type: 'binary', target: 1, unit: '' },
    reminder: { enabled: true, time: '18:00' },
    logs: {},
    notes: {},
    skips: {}
  };

  const currentWeekStart = startOfWeek(today);
  for (let week = 1; week <= 52; week += 1) {
    const start = addDays(currentWeekStart, -week * 7);
    const sessions = week === 7 || week % 12 === 0 ? 2 : 3;
    [0, 2, 4].slice(0, sessions).forEach(offset => {
      const key = addDays(start, offset);
      if (key >= createdAt && key <= today) workout.logs[key] = true;
    });
  }
  [0, 1].forEach(offset => {
    const key = addDays(currentWeekStart, offset);
    if (key <= today) workout.logs[key] = true;
  });

  const water = {
    id: 'demo-water',
    name: 'Drink water',
    emoji: '💧',
    color: '#2C8C8A',
    createdAt,
    archivedAt: null,
    schedule: {
      type: 'daily',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      timesPerWeek: 7,
      intervalDays: 1
    },
    goal: { type: 'count', target: 8, unit: 'glasses' },
    reminder: { enabled: true, time: '10:00' },
    logs: {},
    notes: {},
    skips: {}
  };

  for (let offset = 1; offset <= 365; offset += 1) {
    water.logs[addDays(today, -offset)] = offset <= 5 ? 8 : 4 + (offset % 5);
  }
  water.logs[today] = 5;
  water.notes[today] = 'Remember to refill the bottle.';

  return [
    deepWork,
    read,
    workout,
    water
  ].map(habit => normalizeHabit(habit, usedIds, today));
}
