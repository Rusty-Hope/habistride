import { WEEKDAYS } from './constants.js';
import {
  addDays,
  diffDays,
  endOfWeek,
  startOfWeek,
  todayKey,
  weekdayIndex
} from './dates.js';

export function isArchived(habit) {
  return Boolean(habit.archivedAt);
}

export function isActiveOn(habit, key) {
  if (!key || key < habit.createdAt) return false;
  if (habit.archivedAt && key >= habit.archivedAt) return false;
  return true;
}

export function isWeekly(habit) {
  return habit.schedule.type === 'weekly';
}

export function isScheduledOn(habit, key) {
  if (!isActiveOn(habit, key)) return false;

  switch (habit.schedule.type) {
    case 'weekdays':
      return habit.schedule.weekdays.includes(weekdayIndex(key));
    case 'interval':
      return diffDays(key, habit.createdAt) % habit.schedule.intervalDays === 0;
    case 'weekly':
    case 'daily':
    default:
      return true;
  }
}

export function isSkippedOn(habit, key) {
  return Boolean(habit.skips && habit.skips[key]);
}

export function getLogValue(habit, key) {
  const value = habit.logs[key];
  if (habit.goal.type === 'count') {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  return value === true ? 1 : 0;
}

export function getTarget(habit) {
  return habit.goal.type === 'count' ? habit.goal.target : 1;
}

export function isDoneOn(habit, key) {
  if (!isActiveOn(habit, key) || isSkippedOn(habit, key)) return false;

  if (habit.goal.type === 'count') {
    return getLogValue(habit, key) >= habit.goal.target;
  }

  return habit.logs[key] === true;
}

export function getEntryState(habit, key) {
  return {
    key,
    value: getLogValue(habit, key),
    target: getTarget(habit),
    unit: habit.goal.unit,
    goalType: habit.goal.type,
    done: isDoneOn(habit, key),
    skipped: isSkippedOn(habit, key),
    note: habit.notes?.[key] || ''
  };
}

export function getEffectiveWeekTarget(habit, weekStartKey) {
  let availableDays = 0;
  for (let index = 0; index < 7; index += 1) {
    const key = addDays(weekStartKey, index);
    if (isActiveOn(habit, key) && (!isSkippedOn(habit, key) || isDoneOn(habit, key))) {
      availableDays += 1;
    }
  }
  if (!availableDays) return 0;
  if (availableDays === 7) return habit.schedule.timesPerWeek;
  return Math.min(
    availableDays,
    Math.max(1, Math.ceil((habit.schedule.timesPerWeek * availableDays) / 7))
  );
}

export function getWeekCompletions(habit, weekStartKey) {
  let done = 0;
  for (let index = 0; index < 7; index += 1) {
    const key = addDays(weekStartKey, index);
    if (isDoneOn(habit, key)) done += 1;
  }
  return done;
}

export function getWeekProgress(habit, key = todayKey()) {
  const weekStart = startOfWeek(key);
  const weekEnd = endOfWeek(key);
  const target = getEffectiveWeekTarget(habit, weekStart);
  const done = getWeekCompletions(habit, weekStart);
  return {
    weekStart,
    weekEnd,
    done,
    target,
    met: target > 0 && done >= target
  };
}

export function isDueOn(habit, key = todayKey()) {
  if (!isActiveOn(habit, key)) return false;
  if (isSkippedOn(habit, key)) return false;

  if (isWeekly(habit)) {
    return !getWeekProgress(habit, key).met;
  }

  return isScheduledOn(habit, key);
}

export function getScheduleLabel(habit) {
  const schedule = habit.schedule;

  if (schedule.type === 'weekly') {
    return `${schedule.timesPerWeek}× per week`;
  }

  if (schedule.type === 'interval') {
    return schedule.intervalDays === 2
      ? 'Every other day'
      : `Every ${schedule.intervalDays} days`;
  }

  if (schedule.type === 'weekdays') {
    const days = [...new Set(schedule.weekdays)].sort((a, b) => a - b);
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && days.every(day => day <= 4)) return 'Weekdays';
    return days.map(day => WEEKDAYS[day]?.short).filter(Boolean).join(', ');
  }

  return 'Every day';
}

export function getGoalLabel(habit) {
  if (habit.goal.type === 'count') {
    return `${habit.goal.target}${habit.goal.unit ? ` ${habit.goal.unit}` : ''}`;
  }
  return 'Check off';
}

export function getCurrentStreak(habit, today = todayKey()) {
  if (isWeekly(habit)) {
    return getWeeklyCurrentStreak(habit, today);
  }
  return getFixedCurrentStreak(habit, today);
}

function getFixedCurrentStreak(habit, today) {
  let cursor = today;
  if (habit.archivedAt && cursor >= habit.archivedAt) {
    cursor = addDays(habit.archivedAt, -1);
  }

  let count = 0;
  let guard = 0;

  while (cursor >= habit.createdAt && guard < 4000) {
    guard += 1;
    const scheduled = isScheduledOn(habit, cursor);
    if (scheduled) {
      if (isSkippedOn(habit, cursor)) {
        // An intentional rest day is neutral: it neither adds nor breaks.
      } else if (isDoneOn(habit, cursor)) {
        count += 1;
      } else if (cursor !== today) {
        break;
      }
      // Today is still in progress, so an unchecked due day gets a grace period.
    }
    cursor = addDays(cursor, -1);
  }

  return { count, unit: 'days' };
}

function getWeeklyCurrentStreak(habit, today) {
  let weekStart = startOfWeek(today);
  let count = 0;
  let guard = 0;
  let currentWeek = true;
  const firstWeek = startOfWeek(habit.createdAt);

  while (weekStart >= firstWeek && guard < 520) {
    guard += 1;
    let activeDays = 0;
    for (let index = 0; index < 7; index += 1) {
      if (isActiveOn(habit, addDays(weekStart, index))) activeDays += 1;
    }
    if (activeDays > 0) {
      const target = getEffectiveWeekTarget(habit, weekStart);
      if (target > 0) {
        const done = getWeekCompletions(habit, weekStart);
        const met = done >= target;

        if (met) {
          count += 1;
        } else if (!currentWeek) {
          break;
        }
      }
    }

    currentWeek = false;
    weekStart = addDays(weekStart, -7);
  }

  return { count, unit: 'weeks' };
}

export function getBestStreak(habit, today = todayKey()) {
  if (isWeekly(habit)) {
    return getWeeklyBestStreak(habit, today);
  }
  return getFixedBestStreak(habit, today);
}

function getFixedBestStreak(habit, today) {
  const end = habit.archivedAt && habit.archivedAt <= today
    ? addDays(habit.archivedAt, -1)
    : today;

  let cursor = habit.createdAt;
  let run = 0;
  let best = 0;
  let guard = 0;

  while (cursor <= end && guard < 5000) {
    guard += 1;
    if (isScheduledOn(habit, cursor)) {
      if (isSkippedOn(habit, cursor)) {
        // Neutral day.
      } else if (isDoneOn(habit, cursor)) {
        run += 1;
        best = Math.max(best, run);
      } else if (cursor !== end) {
        run = 0;
      }
    }
    cursor = addDays(cursor, 1);
  }

  return { count: best, unit: 'days' };
}

function getWeeklyBestStreak(habit, today) {
  const lastWeek = startOfWeek(
    habit.archivedAt && habit.archivedAt <= today
      ? addDays(habit.archivedAt, -1)
      : today
  );

  let weekStart = startOfWeek(habit.createdAt);
  let run = 0;
  let best = 0;
  let guard = 0;

  while (weekStart <= lastWeek && guard < 520) {
    guard += 1;
    const target = getEffectiveWeekTarget(habit, weekStart);
    if (target) {
      if (getWeekCompletions(habit, weekStart) >= target) {
        run += 1;
        best = Math.max(best, run);
      } else if (weekStart !== lastWeek) {
        run = 0;
      }
    }
    weekStart = addDays(weekStart, 7);
  }

  return { count: best, unit: 'weeks' };
}

export function formatStreak(streak) {
  if (!streak || streak.count <= 0) return '';
  return `${streak.count}-${streak.unit === 'weeks' ? 'week' : 'day'} streak`;
}

export function getNextScheduledKey(habit, fromKey = todayKey()) {
  if (habit.schedule.type === 'weekly') {
    // Weekly reminders are handled as a Monday planning event by the ICS exporter.
    return startOfWeek(fromKey);
  }

  let cursor = fromKey < habit.createdAt ? habit.createdAt : fromKey;
  for (let guard = 0; guard < 370; guard += 1) {
    if (habit.archivedAt && cursor >= habit.archivedAt) return null;
    if (isScheduledOn(habit, cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return null;
}
