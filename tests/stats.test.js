import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countCheckIns,
  getBestStreakLeader,
  getHabitCompletion,
  getHeatmap,
  getOverallCompletion,
  getPeriodSummary,
  getStreakLeader,
  getTodayOverview,
  getWeekdayActivity
} from '../src/stats.js';
import { makeHabit } from './helpers.js';

test('completion rates use scheduled days and ignore rest days', () => {
  const habit = makeHabit({
    schedule: { type: 'weekdays', weekdays: [0, 2, 4] },
    createdAt: '2026-11-02',
    logs: { '2026-11-02': true, '2026-11-04': true, '2026-11-06': true },
    skips: { '2026-11-09': true }
  });

  const result = getHabitCompletion(habit, '2026-11-02', '2026-11-11', '2026-11-11');
  assert.equal(result.done, 3);
  assert.equal(result.total, 4);
  assert.equal(result.rate, 75);
});

test('weekly completion counts target units across weeks', () => {
  const habit = makeHabit({
    schedule: { type: 'weekly', timesPerWeek: 3 },
    createdAt: '2026-10-26',
    logs: {
      '2026-10-26': true, '2026-10-28': true, '2026-10-30': true,
      '2026-11-02': true, '2026-11-04': true, '2026-11-06': true,
      '2026-11-09': true
    }
  });

  const result = getHabitCompletion(habit, '2026-10-26', '2026-11-11', '2026-11-11');
  assert.equal(result.done, 7);
  assert.equal(result.total, 9);
  assert.equal(result.rate, 78);
  assert.equal(result.unit, 'week');
});

test('overall completion averages per-habit rates', () => {
  const first = makeHabit({
    id: 'first',
    createdAt: '2026-11-01',
    logs: { '2026-11-10': true, '2026-11-11': true }
  });
  const second = makeHabit({
    id: 'second',
    createdAt: '2026-11-01',
    logs: { '2026-11-11': true }
  });

  const result = getOverallCompletion([first, second], '2026-11-10', '2026-11-11', '2026-11-11');
  assert.equal(result.rate, 75);
  assert.equal(result.habits, 2);
  assert.equal(countCheckIns([first, second], '2026-11-10', '2026-11-11', '2026-11-11'), 3);
});

test('today overview separates due habits from extras', () => {
  const daily = makeHabit({
    id: 'daily',
    createdAt: '2026-11-01',
    logs: { '2026-11-11': true }
  });
  const weekdays = makeHabit({
    id: 'weekdays',
    createdAt: '2026-11-01',
    schedule: { type: 'weekdays', weekdays: [0, 1, 2, 3, 4] }
  });
  const weekly = makeHabit({
    id: 'weekly',
    createdAt: '2026-10-01',
    schedule: { type: 'weekly', timesPerWeek: 3 },
    logs: { '2026-11-09': true, '2026-11-10': true }
  });

  const overview = getTodayOverview([daily, weekdays, weekly], '2026-11-11');
  assert.deepEqual(overview.due.map(item => item.habit.id), ['daily', 'weekdays', 'weekly']);
  assert.equal(overview.dueDone, 1);
  assert.equal(overview.dueTotal, 3);
});

test('heatmap and weekday activity produce stable aggregates', () => {
  const habit = makeHabit({
    createdAt: '2026-01-01',
    logs: {
      '2026-11-09': true,
      '2026-11-10': true,
      '2026-11-11': true
    }
  });

  const weeks = getHeatmap([habit], '2026-11-11');
  assert.equal(weeks.length, 53);
  assert.equal(weeks[52].days[2].done, 1);
  assert.equal(weeks[52].days[2].level, 4);

  const counts = getWeekdayActivity([habit], '2026-11-09', '2026-11-11', '2026-11-11');
  assert.deepEqual(counts, [1, 1, 1, 0, 0, 0, 0]);
});

test('period summary returns the selected range', () => {
  const habit = makeHabit({
    createdAt: '2026-10-01',
    logs: { '2026-11-10': true, '2026-11-11': true }
  });
  const summary = getPeriodSummary([habit], 7, '2026-11-11');
  assert.equal(summary.startKey, '2026-11-05');
  assert.equal(summary.endKey, '2026-11-11');
  assert.ok(summary.completion.rate > 0);
});

test('streak leaders compare weekly streaks by day equivalent', () => {
  const daily = makeHabit({
    id: 'daily',
    name: 'Daily 4d',
    createdAt: '2026-11-01',
    logs: {
      '2026-11-08': true,
      '2026-11-09': true,
      '2026-11-10': true,
      '2026-11-11': true
    }
  });
  const weekly = makeHabit({
    id: 'weekly',
    name: 'Weekly 2w',
    createdAt: '2026-10-01',
    schedule: { type: 'weekly', timesPerWeek: 2 },
    logs: {
      '2026-10-26': true, '2026-10-28': true,
      '2026-11-02': true, '2026-11-04': true
    }
  });

  const currentLeader = getStreakLeader([daily, weekly], '2026-11-11');
  const bestLeader = getBestStreakLeader([daily, weekly], '2026-11-11');
  assert.equal(currentLeader.habit.id, 'weekly');
  assert.equal(bestLeader.habit.id, 'weekly');
});
