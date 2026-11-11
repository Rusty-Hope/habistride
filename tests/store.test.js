import test from 'node:test';
import assert from 'node:assert/strict';

import { Store } from '../src/store.js';
import { csvEscape, todayKey } from '../src/dates.js';

function fields(overrides = {}) {
  return {
    name: 'Test habit',
    emoji: '✅',
    color: '#5E6AD2',
    goal: { type: 'binary', target: 1, unit: '' },
    schedule: { type: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6], timesPerWeek: 7, intervalDays: 1 },
    startDate: todayKey(),
    reminder: { enabled: false, time: null },
    ...overrides
  };
}

test('store creates, updates and archives habits', () => {
  const store = new Store([], { theme: 'system', view: 'today', onboarded: false, lastBackupAt: null });
  const habit = store.createHabit(fields({ name: 'Drink water', goal: { type: 'count', target: 8, unit: 'glasses' } }));

  assert.equal(store.activeHabits.length, 1);
  assert.equal(habit.goal.target, 8);
  const updated = store.updateHabit(habit.id, fields({ name: 'Hydrate' }));
  assert.equal(updated.name, 'Hydrate');

  store.archiveHabit(habit.id);
  assert.equal(store.activeHabits.length, 0);
  assert.equal(store.archivedHabits.length, 1);

  store.restoreHabit(habit.id);
  assert.equal(store.activeHabits.length, 1);
});

test('count completion toggles to target and clears', () => {
  const store = new Store([], { theme: 'system', view: 'today', onboarded: false, lastBackupAt: null });
  const habit = store.createHabit(fields({ goal: { type: 'count', target: 8, unit: 'glasses' } }));
  const key = todayKey();

  let result = store.toggleCompletion(habit.id, key);
  assert.equal(result.done, true);
  assert.equal(habit.logs[key], 8);

  result = store.toggleCompletion(habit.id, key);
  assert.equal(result.done, false);
  assert.equal(habit.logs[key], undefined);
});

test('day entries support notes, rest days and clearing', () => {
  const store = new Store([], { theme: 'system', view: 'today', onboarded: false, lastBackupAt: null });
  const habit = store.createHabit(fields());
  const key = todayKey();

  store.setEntry(habit.id, key, { completed: true, note: '  A good day.  ' });
  assert.equal(habit.logs[key], true);
  assert.equal(habit.notes[key], 'A good day.');

  store.setEntry(habit.id, key, { skipped: true, note: '' });
  assert.equal(habit.logs[key], undefined);
  assert.equal(habit.skips[key], true);
  assert.equal(habit.notes[key], undefined);

  store.clearEntry(habit.id, key);
  assert.equal(habit.skips[key], undefined);
});

test('deleting and reinserting a habit preserves its order', () => {
  const store = new Store([], { theme: 'system', view: 'today', onboarded: false, lastBackupAt: null });
  const first = store.createHabit(fields({ name: 'First' }));
  const second = store.createHabit(fields({ name: 'Second' }));

  const removed = store.deleteHabit(first.id);
  assert.equal(store.habits.length, 1);
  store.insertHabit(removed.habit, removed.index);
  assert.deepEqual(store.habits.map(habit => habit.name), ['First', 'Second']);
  assert.equal(second.id, store.habits[1].id);

  assert.equal(store.moveHabit(second.id, -1), true);
  assert.deepEqual(store.habits.map(habit => habit.name), ['Second', 'First']);
  assert.equal(store.moveHabit(second.id, -1), false);
});

test('changing habit goal type preserves completed logs and csvEscape prevents formula injection', () => {
  const store = new Store([], { theme: 'system', view: 'today', onboarded: false, lastBackupAt: null });
  const key = todayKey();
  const habit = store.createHabit(fields({ name: 'Read' }));
  store.toggleCompletion(habit.id, key);
  assert.equal(habit.logs[key], true);

  store.updateHabit(habit.id, fields({
    name: 'Read pages',
    goal: { type: 'count', target: 20, unit: 'pages' }
  }));
  assert.equal(habit.logs[key], 20);

  store.updateHabit(habit.id, fields({
    name: 'Read',
    goal: { type: 'binary', target: 1, unit: '' }
  }));
  assert.equal(habit.logs[key], true);

  assert.equal(csvEscape('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(csvEscape('-5'), '-5');
});
