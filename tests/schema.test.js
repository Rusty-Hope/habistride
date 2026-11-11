import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SchemaError,
  createBackup,
  normalizeSettings,
  parseBackupText,
  parseState,
  serializeHabits,
  summarizeHabits,
  summaryText
} from '../src/schema.js';

const TODAY = '2026-11-11';

test('v1 backups migrate to the current habit model', () => {
  const habits = parseState({
    schemaVersion: 1,
    habits: [{
      id: 'legacy-1',
      name: 'Legacy habit',
      emoji: '🌱',
      color: '#5E6AD2',
      createdAt: '2026-11-01',
      logs: { '2026-11-10': true, '2026-11-11': true }
    }]
  }, TODAY);

  assert.equal(habits.length, 1);
  assert.equal(habits[0].schedule.type, 'daily');
  assert.equal(habits[0].goal.type, 'binary');
  assert.equal(habits[0].archivedAt, null);
  assert.deepEqual(habits[0].notes, {});
  assert.deepEqual(habits[0].skips, {});
  assert.equal(habits[0].logs['2026-11-10'], true);
});

test('v2 habits keep schedules, counts, notes and rest days', () => {
  const habits = parseState({
    schemaVersion: 2,
    habits: [{
      id: 'water',
      name: '  Drink   water  ',
      emoji: '💧',
      color: '#2C8C8A',
      createdAt: '2026-11-01',
      archivedAt: null,
      schedule: { type: 'weekdays', weekdays: [0, 2, 4], timesPerWeek: 3, intervalDays: 2 },
      goal: { type: 'count', target: 8, unit: 'glasses' },
      reminder: { enabled: true, time: '09:30' },
      logs: { '2026-11-10': 5, '2026-11-11': 8, '2099-01-01': 8, '2026-11-09': true },
      notes: { '2026-11-11': '  Refilled the bottle.  ', 'bad': 'ignored' },
      skips: { '2026-11-10': true, 'bad': true }
    }]
  }, TODAY);

  const habit = habits[0];
  assert.equal(habit.name, 'Drink water');
  assert.deepEqual(habit.schedule.weekdays, [0, 2, 4]);
  assert.deepEqual(habit.goal, { type: 'count', target: 8, unit: 'glasses' });
  assert.equal(habit.logs['2026-11-11'], 8);
  assert.equal(habit.logs['2099-01-01'], undefined);
  assert.equal(habit.notes['2026-11-11'], 'Refilled the bottle.');
  assert.equal(habit.notes.bad, undefined);
  assert.equal(habit.skips['2026-11-10'], true);
  assert.equal(habit.skips.bad, undefined);
  assert.equal(habit.reminder.enabled, true);
});

test('duplicate ids are replaced with unique ids', () => {
  const habits = parseState({
    schemaVersion: 2,
    habits: [
      { id: 'same', name: 'One', createdAt: '2026-11-01' },
      { id: 'same', name: 'Two', createdAt: '2026-11-01' }
    ]
  }, TODAY);

  assert.notEqual(habits[0].id, habits[1].id);
});

test('invalid backups are rejected with useful error codes', () => {
  assert.throws(() => parseBackupText('{not json', TODAY), error => (
    error instanceof SchemaError && error.code === 'invalid-json'
  ));

  assert.throws(() => parseState({ schemaVersion: 3, habits: [] }, TODAY), error => (
    error instanceof SchemaError && error.code === 'unsupported-version'
  ));

  assert.throws(() => parseState({ schemaVersion: 2, habits: [{ name: 12 }] }, TODAY), error => (
    error instanceof SchemaError && error.code === 'invalid-habit'
  ));
});

test('backup parsing accepts UTF-8 BOM files', () => {
  const payload = {
    schemaVersion: 2,
    habits: [{ name: 'BOM habit', createdAt: '2026-11-01' }]
  };
  const result = parseBackupText(`\uFEFF${JSON.stringify(payload)}`, TODAY);
  assert.equal(result.habits.length, 1);
  assert.equal(result.habits[0].name, 'BOM habit');
});

test('serialization and summaries are stable', () => {
  const habits = parseState({
    schemaVersion: 2,
    habits: [{
      name: 'Read',
      createdAt: '2026-11-01',
      logs: { '2026-11-10': true, '2026-11-11': true },
      notes: { '2026-11-10': 'Chapter one' },
      skips: { '2026-11-09': true }
    }]
  }, TODAY);

  const serialized = serializeHabits(habits);
  assert.deepEqual(Object.keys(serialized[0].logs), ['2026-11-10', '2026-11-11']);
  const summary = summarizeHabits(habits);
  assert.equal(summary.habits, 1);
  assert.equal(summary.checkIns, 2);
  assert.equal(summary.notes, 1);
  assert.equal(summary.skips, 1);
  assert.match(summaryText(summary), /1 habit/);
  assert.match(summaryText(summary), /2 completed check-ins/);

  const backup = createBackup(habits);
  assert.equal(backup.schemaVersion, 2);
  assert.equal(backup.app, 'HabiStride');
  assert.ok(backup.exportedAt);
  assert.equal(backup.habits.length, 1);
});

test('settings normalization falls back safely', () => {
  assert.deepEqual(normalizeSettings({
    theme: 'dark',
    view: 'insights',
    onboarded: true,
    lastBackupAt: '2026-11-11T10:00:00.000Z'
  }), {
    theme: 'dark',
    view: 'insights',
    onboarded: true,
    lastBackupAt: '2026-11-11T10:00:00.000Z'
  });

  assert.deepEqual(normalizeSettings({ theme: 'neon', view: 'nope' }), {
    theme: 'system',
    view: 'today',
    onboarded: false,
    lastBackupAt: null
  });
});

test('habits archived on the same day they were created stay archived', () => {
  const habits = parseState({
    schemaVersion: 2,
    habits: [{
      id: 'same-day-archive',
      name: 'Archived Today',
      createdAt: TODAY,
      archivedAt: TODAY
    }]
  }, TODAY);

  assert.equal(habits[0].archivedAt, TODAY);
});
