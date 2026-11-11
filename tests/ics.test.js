import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReminderCalendar } from '../src/ics.js';
import { makeHabit } from './helpers.js';

const NOW = new Date('2026-11-11T00:00:00');
const TODAY = '2026-11-11';

test('calendar reminders include recurrence and alarms', () => {
  const habit = makeHabit({
    id: 'deep-work',
    name: 'Deep Work',
    createdAt: TODAY,
    schedule: { type: 'weekdays', weekdays: [0, 1, 2, 3, 4] },
    reminder: { enabled: true, time: '09:00' }
  });

  const calendar = buildReminderCalendar([habit], NOW);
  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(calendar, /UID:deep-work@habistride\.local/);
  assert.match(calendar, /RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/);
  assert.match(calendar, /DTSTART:20261111T090000/);
  assert.match(calendar, /BEGIN:VALARM/);
  assert.match(calendar, /SUMMARY:Habit: Deep Work/);
});

test('weekly habits become a weekly planning reminder', () => {
  const habit = makeHabit({
    id: 'workout',
    name: 'Workout',
    createdAt: '2026-10-01',
    schedule: { type: 'weekly', timesPerWeek: 3 },
    reminder: { enabled: true, time: '18:00' }
  });

  const calendar = buildReminderCalendar([habit], NOW);
  assert.match(calendar, /RRULE:FREQ=WEEKLY;BYDAY=MO/);
  assert.match(calendar, /SUMMARY:Weekly goal: Workout/);
  assert.match(calendar, /Target: 3 sessions this week/);
});

test('habits without reminders do not create events', () => {
  const habit = makeHabit({
    createdAt: TODAY,
    reminder: { enabled: false, time: '09:00' }
  });
  assert.equal(buildReminderCalendar([habit], NOW), null);
});

test('ICS text escapes commas and semicolons', () => {
  const habit = makeHabit({
    id: 'escaped',
    name: 'Read, write; rest',
    createdAt: TODAY,
    reminder: { enabled: true, time: '09:00' }
  });
  const calendar = buildReminderCalendar([habit], NOW);
  assert.match(calendar, /SUMMARY:Habit: Read\\, write\\; rest/);
});

test('ICS reminders use the passed reference date and respect future start dates', () => {
  const customNow = new Date(2025, 4, 10, 8, 0, 0);
  const habit = makeHabit({
    id: 'future-habit',
    name: 'Future Habit',
    createdAt: '2025-05-12',
    reminder: { enabled: true, time: '09:00' }
  });
  const calendar = buildReminderCalendar([habit], customNow);
  assert.match(calendar, /DTSTART:20250512T090000/);
});
