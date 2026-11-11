import { normalizeHabit } from './schema.js';
import { clamp, todayKey, uid } from './dates.js';
import { getLogValue, isActiveOn, isDoneOn } from './schedule.js';
import { LIMITS } from './constants.js';

export class Store {
  constructor(habits = [], settings) {
    this.habits = habits;
    this.settings = settings;
  }

  get activeHabits() {
    return this.habits.filter(habit => !habit.archivedAt);
  }

  get archivedHabits() {
    return this.habits.filter(habit => Boolean(habit.archivedAt));
  }

  find(id) {
    return this.habits.find(habit => habit.id === id) || null;
  }

  createHabit(fields) {
    if (this.habits.length >= LIMITS.maxHabits) {
      return null;
    }
    const today = todayKey();
    const raw = {
      id: uid(),
      name: fields.name,
      emoji: fields.emoji,
      color: fields.color,
      createdAt: fields.startDate || today,
      archivedAt: null,
      schedule: fields.schedule,
      goal: fields.goal,
      reminder: fields.reminder,
      logs: {},
      notes: {},
      skips: {}
    };

    const usedIds = new Set(this.habits.map(item => item.id));
    const habit = normalizeHabit(raw, usedIds, today);
    this.habits.push(habit);
    return habit;
  }

  updateHabit(id, fields) {
    const habit = this.find(id);
    if (!habit) return null;

    const usedIds = new Set(
      this.habits.filter(item => item.id !== id).map(item => item.id)
    );
    const today = todayKey();
    const nextCreatedAt = fields.startDate || habit.createdAt;
    const nextGoalType = fields.goal?.type === 'count' ? 'count' : 'binary';
    const nextTarget = nextGoalType === 'count' ? (Number(fields.goal?.target) || 1) : 1;
    const convertedLogs = {};
    const prunedNotes = {};
    const prunedSkips = {};

    for (const [key, value] of Object.entries(habit.logs || {})) {
      if (key < nextCreatedAt) continue;
      if (nextGoalType === 'count' && value === true) {
        convertedLogs[key] = nextTarget;
      } else if (nextGoalType === 'binary' && typeof value === 'number') {
        if (value >= (habit.goal?.target || 1)) {
          convertedLogs[key] = true;
        }
      } else {
        convertedLogs[key] = value;
      }
    }

    for (const [key, value] of Object.entries(habit.notes || {})) {
      if (key >= nextCreatedAt) prunedNotes[key] = value;
    }

    for (const [key, value] of Object.entries(habit.skips || {})) {
      if (key >= nextCreatedAt) prunedSkips[key] = value;
    }

    const raw = {
      ...habit,
      name: fields.name,
      emoji: fields.emoji,
      color: fields.color,
      createdAt: nextCreatedAt,
      schedule: fields.schedule,
      goal: fields.goal,
      reminder: fields.reminder,
      logs: convertedLogs,
      notes: prunedNotes,
      skips: prunedSkips,
      id: habit.id
    };

    const normalized = normalizeHabit(raw, usedIds, today);
    Object.assign(habit, normalized);
    return habit;
  }

  archiveHabit(id) {
    const habit = this.find(id);
    if (!habit || habit.archivedAt) return null;
    habit.archivedAt = todayKey();
    return habit;
  }

  restoreHabit(id) {
    const habit = this.find(id);
    if (!habit || !habit.archivedAt) return null;
    habit.archivedAt = null;
    return habit;
  }

  deleteHabit(id) {
    const index = this.habits.findIndex(habit => habit.id === id);
    if (index === -1) return null;
    const [habit] = this.habits.splice(index, 1);
    return { habit, index };
  }

  insertHabit(habit, index) {
    const safeIndex = clamp(index, 0, this.habits.length);
    this.habits.splice(safeIndex, 0, habit);
  }

  replaceHabits(habits) {
    this.habits = habits;
  }

  moveHabit(id, direction) {
    const activeIds = this.activeHabits.map(habit => habit.id);
    const activePos = activeIds.indexOf(id);
    if (activePos === -1) return false;
    const targetActivePos = activePos + direction;
    if (targetActivePos < 0 || targetActivePos >= activeIds.length) return false;

    const targetId = activeIds[targetActivePos];
    const fromIndex = this.habits.findIndex(habit => habit.id === id);
    const toIndex = this.habits.findIndex(habit => habit.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return false;

    const [moved] = this.habits.splice(fromIndex, 1);
    this.habits.splice(toIndex, 0, moved);
    return true;
  }

  toggleCompletion(id, key) {
    const habit = this.find(id);
    if (!habit || !isActiveOn(habit, key) || key > todayKey()) return null;

    const wasDone = isDoneOn(habit, key);
    delete habit.skips[key];

    if (habit.goal.type === 'count') {
      if (wasDone) delete habit.logs[key];
      else habit.logs[key] = habit.goal.target;
    } else if (habit.logs[key] === true) {
      delete habit.logs[key];
    } else {
      habit.logs[key] = true;
    }

    return {
      habit,
      done: isDoneOn(habit, key),
      value: getLogValue(habit, key)
    };
  }

  adjustCount(id, key, delta) {
    const habit = this.find(id);
    if (!habit || habit.goal.type !== 'count' || !isActiveOn(habit, key) || key > todayKey()) {
      return null;
    }

    const next = clamp(getLogValue(habit, key) + delta, 0, 10000000);
    if (next <= 0) {
      delete habit.logs[key];
    } else {
      habit.logs[key] = next;
      delete habit.skips[key];
    }

    return {
      habit,
      value: next,
      done: next >= habit.goal.target
    };
  }

  setEntry(id, key, { completed = false, value = 0, skipped = false, note = '' }) {
    const habit = this.find(id);
    if (!habit || !isActiveOn(habit, key) || key > todayKey()) return null;

    if (skipped) {
      delete habit.logs[key];
      habit.skips[key] = true;
    } else {
      delete habit.skips[key];

      if (habit.goal.type === 'count') {
        const count = clamp(Number(value) || 0, 0, 10000000);
        if (count > 0) habit.logs[key] = count;
        else delete habit.logs[key];
      } else if (completed) {
        habit.logs[key] = true;
      } else {
        delete habit.logs[key];
      }
    }

    const trimmedNote = typeof note === 'string' ? note.trim().slice(0, LIMITS.maxNoteLength) : '';
    if (trimmedNote) habit.notes[key] = trimmedNote;
    else delete habit.notes[key];

    return habit;
  }

  clearEntry(id, key) {
    const habit = this.find(id);
    if (!habit) return null;
    delete habit.logs[key];
    delete habit.skips[key];
    delete habit.notes[key];
    return habit;
  }

  setTheme(theme) {
    this.settings.theme = ['system', 'light', 'dark'].includes(theme) ? theme : 'system';
  }

  setView(view) {
    this.settings.view = ['today', 'calendar', 'insights'].includes(view) ? view : 'today';
  }

  setOnboarded(value) {
    this.settings.onboarded = value === true;
  }

  setLastBackupAt(iso) {
    this.settings.lastBackupAt = iso;
  }
}
