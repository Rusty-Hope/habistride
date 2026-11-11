import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  diffDays,
  formatDateKey,
  formatMonthYear,
  isValidDateKey,
  parseKey,
  startOfWeek,
  weekdayIndex
} from '../src/dates.js';
import {
  formatStreak,
  getBestStreak,
  getCurrentStreak,
  getEffectiveWeekTarget,
  getScheduleLabel,
  getWeekProgress,
  isDueOn,
  isDoneOn
} from '../src/schedule.js';
import { makeHabit } from './helpers.js';

test('date helpers handle month and year boundaries', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(diffDays('2026-11-11', '2026-11-01'), 10);
  assert.equal(weekdayIndex('2026-11-11'), 2);
  assert.equal(startOfWeek('2026-11-11'), '2026-11-09');
  assert.equal(formatDateKey('2026-11-11'), 'November 11');
  assert.equal(formatMonthYear(2026, 10), 'November 2026');
  assert.equal(isValidDateKey('2026-02-30'), false);
  assert.deepEqual(parseKey('2026-11-11'), { year: 2026, monthIndex: 10, day: 11 });
});

test('daily streak gives today a grace period and preserves yesterday', () => {
  const habit = makeHabit({
    createdAt: '2026-11-01',
    logs: { '2026-11-09': true, '2026-11-10': true }
  });

  assert.deepEqual(getCurrentStreak(habit, '2026-11-11'), { count: 2, unit: 'days' });
  habit.logs['2026-11-11'] = true;
  assert.deepEqual(getCurrentStreak(habit, '2026-11-11'), { count: 3, unit: 'days' });
});

test('a missed day breaks the streak, skipped days are neutral', () => {
  const habit = makeHabit({
    createdAt: '2026-11-01',
    logs: { '2026-11-08': true, '2026-11-09': true },
    skips: { '2026-11-10': true }
  });

  assert.deepEqual(getCurrentStreak(habit, '2026-11-11'), { count: 2, unit: 'days' });
  habit.skips = {};
  assert.deepEqual(getCurrentStreak(habit, '2026-11-11'), { count: 0, unit: 'days' });
});

test('weekday schedules ignore non-scheduled days', () => {
  const habit = makeHabit({
    schedule: { type: 'weekdays', weekdays: [0, 1, 2, 3, 4] },
    createdAt: '2026-10-01',
    logs: { '2026-11-09': true, '2026-11-10': true }
  });

  assert.deepEqual(getCurrentStreak(habit, '2026-11-11'), { count: 2, unit: 'days' });
  assert.equal(isDueOn(habit, '2026-11-14'), false);
});

test('interval schedules use the creation date as the anchor', () => {
  const habit = makeHabit({
    schedule: { type: 'interval', intervalDays: 2 },
    createdAt: '2026-11-01',
    logs: { '2026-11-09': true, '2026-11-11': true }
  });

  assert.deepEqual(getCurrentStreak(habit, '2026-11-11'), { count: 2, unit: 'days' });
  assert.equal(isDueOn(habit, '2026-11-11'), true);
  assert.equal(isDueOn(habit, '2026-11-10'), false);
});

test('weekly targets produce week streaks and week progress', () => {
  const habit = makeHabit({
    schedule: { type: 'weekly', timesPerWeek: 3 },
    createdAt: '2026-10-05',
    logs: {
      '2026-10-19': true, '2026-10-21': true,
      '2026-10-26': true, '2026-10-28': true, '2026-10-30': true,
      '2026-11-02': true, '2026-11-04': true, '2026-11-06': true,
      '2026-11-09': true, '2026-11-10': true
    }
  });

  assert.deepEqual(getWeekProgress(habit, '2026-11-11'), {
    weekStart: '2026-11-09',
    weekEnd: '2026-11-15',
    done: 2,
    target: 3,
    met: false
  });
  assert.equal(isDueOn(habit, '2026-11-11'), true);
  assert.deepEqual(getCurrentStreak(habit, '2026-11-11'), { count: 2, unit: 'weeks' });
  assert.equal(getEffectiveWeekTarget(habit, '2026-10-05'), 3);

  const partialWeekHabit = makeHabit({
    schedule: { type: 'weekly', timesPerWeek: 3 },
    createdAt: '2026-10-10'
  });
  assert.equal(getEffectiveWeekTarget(partialWeekHabit, '2026-10-05'), 1);

  const restWeekHabit = makeHabit({
    schedule: { type: 'weekly', timesPerWeek: 3 },
    createdAt: '2026-10-01',
    logs: {
      '2026-10-26': true, '2026-10-28': true, '2026-10-30': true
    },
    skips: {
      '2026-11-02': true, '2026-11-03': true, '2026-11-04': true,
      '2026-11-05': true, '2026-11-06': true, '2026-11-07': true, '2026-11-08': true
    }
  });
  assert.equal(getEffectiveWeekTarget(restWeekHabit, '2026-11-02'), 0);
  assert.deepEqual(getCurrentStreak(restWeekHabit, '2026-11-11'), { count: 1, unit: 'weeks' });
});

test('streak labels, due state and count completion work', () => {
  const habit = makeHabit({
    createdAt: '2026-11-01',
    goal: { type: 'count', target: 8, unit: 'glasses' },
    logs: { '2026-11-10': 8, '2026-11-11': 5 }
  });

  assert.equal(isDoneOn(habit, '2026-11-11'), false);
  assert.equal(formatStreak(getCurrentStreak(habit, '2026-11-11')), '1-day streak');
  assert.equal(getScheduleLabel(habit), 'Every day');
  assert.deepEqual(getBestStreak(habit, '2026-11-12'), { count: 1, unit: 'days' });
});
