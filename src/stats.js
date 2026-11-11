import {
  addDays,
  endOfWeek,
  formatDateKey,
  startOfWeek,
  todayKey,
  weekdayIndex
} from './dates.js';
import {
  getBestStreak,
  getCurrentStreak,
  getEffectiveWeekTarget,
  getWeekCompletions,
  getWeekProgress,
  isActiveOn,
  isDoneOn,
  isDueOn,
  isScheduledOn,
  isSkippedOn,
  isWeekly
} from './schedule.js';

export function getRangeStart(days, today = todayKey()) {
  return addDays(today, -(Math.max(1, days) - 1));
}

export function getHabitCompletion(habit, startKey, endKey, today = todayKey()) {
  const end = endKey > today ? today : endKey;
  if (end < startKey) {
    return { done: 0, total: 0, rate: null, unit: isWeekly(habit) ? 'week' : 'day' };
  }

  if (isWeekly(habit)) {
    let weekStart = startOfWeek(startKey);
    let completedUnits = 0;
    let totalUnits = 0;

    while (weekStart <= end) {
      const weekEnd = endOfWeek(weekStart);
      let activeDays = 0;
      let doneInWindow = 0;
      for (let index = 0; index < 7; index += 1) {
        const key = addDays(weekStart, index);
        if (isActiveOn(habit, key)) activeDays += 1;
        if (key >= startKey && key <= end && isDoneOn(habit, key)) {
          doneInWindow += 1;
        }
      }

      if (activeDays > 0 && weekEnd >= startKey && weekStart <= end) {
        const target = getEffectiveWeekTarget(habit, weekStart);
        completedUnits += Math.min(doneInWindow, target);
        totalUnits += target;
      }
      weekStart = addDays(weekStart, 7);
    }

    return {
      done: completedUnits,
      total: totalUnits,
      rate: totalUnits ? Math.round((completedUnits / totalUnits) * 100) : null,
      unit: 'week'
    };
  }

  let done = 0;
  let total = 0;
  let cursor = startKey;

  while (cursor <= end) {
    if (isActiveOn(habit, cursor) && isScheduledOn(habit, cursor) && !isSkippedOn(habit, cursor)) {
      total += 1;
      if (isDoneOn(habit, cursor)) done += 1;
    }
    cursor = addDays(cursor, 1);
  }

  return {
    done,
    total,
    rate: total ? Math.round((done / total) * 100) : null,
    unit: 'day'
  };
}

export function getOverallCompletion(habits, startKey, endKey, today = todayKey()) {
  const results = habits
    .map(habit => getHabitCompletion(habit, startKey, endKey, today))
    .filter(result => result.total > 0);

  if (!results.length) {
    return { rate: null, done: 0, total: 0, habits: 0 };
  }

  const rate = Math.round(
    results.reduce((sum, result) => sum + result.rate, 0) / results.length
  );

  return {
    rate,
    done: results.reduce((sum, result) => sum + result.done, 0),
    total: results.reduce((sum, result) => sum + result.total, 0),
    habits: results.length
  };
}

export function countCheckIns(habits, startKey, endKey, today = todayKey()) {
  const end = endKey > today ? today : endKey;
  let count = 0;
  let cursor = startKey;

  while (cursor <= end) {
    for (const habit of habits) {
      if (isDoneOn(habit, cursor)) count += 1;
    }
    cursor = addDays(cursor, 1);
  }

  return count;
}

export function getTodayOverview(habits, today = todayKey()) {
  const due = [];
  const other = [];

  for (const habit of habits) {
    if (habit.archivedAt) continue;
    const skipped = isSkippedOn(habit, today);
    const done = isDoneOn(habit, today);
    const weeklyProgress = isWeekly(habit) ? getWeekProgress(habit, today) : null;
    const isDue = !skipped && isDueOn(habit, today);
    const item = { habit, done, skipped, due: isDue, weeklyProgress };
    if (isDue) due.push(item);
    else other.push(item);
  }

  const completedDue = due.filter(item => item.done).length;

  return {
    due,
    other,
    dueTotal: due.length,
    dueDone: completedDue,
    allDone: due.length > 0 && completedDue === due.length
  };
}

function streakDaysEquivalent(streak) {
  if (!streak || !streak.count) return 0;
  return streak.unit === 'weeks' ? streak.count * 7 : streak.count;
}

export function getStreakLeader(habits, today = todayKey()) {
  let leader = null;

  for (const habit of habits) {
    if (habit.archivedAt) continue;
    const streak = getCurrentStreak(habit, today);
    if (!leader || streakDaysEquivalent(streak) > streakDaysEquivalent(leader.streak)) {
      leader = { habit, streak };
    }
  }

  return leader && leader.streak.count > 0 ? leader : null;
}

export function getBestStreakLeader(habits, today = todayKey()) {
  let leader = null;

  for (const habit of habits) {
    if (habit.archivedAt) continue;
    const streak = getBestStreak(habit, today);
    if (!leader || streakDaysEquivalent(streak) > streakDaysEquivalent(leader.streak)) {
      leader = { habit, streak };
    }
  }

  return leader && leader.streak.count > 0 ? leader : null;
}

export function getHeatmap(habits, today = todayKey(), weekCount = 53) {
  const currentWeekStart = startOfWeek(today);
  const firstWeekStart = addDays(currentWeekStart, -(weekCount - 1) * 7);
  const weeks = [];

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const weekStart = addDays(firstWeekStart, weekIndex * 7);
    const days = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const key = addDays(weekStart, dayIndex);
      const future = key > today;
      const active = habits.filter(habit => isActiveOn(habit, key));
      const done = active.filter(habit => isDoneOn(habit, key)).length;
      const ratio = active.length ? done / active.length : 0;

      let level = 0;
      if (!future && active.length) {
        if (ratio >= 0.75) level = 4;
        else if (ratio >= 0.5) level = 3;
        else if (ratio >= 0.25) level = 2;
        else if (ratio > 0) level = 1;
      }

      days.push({
        key,
        future,
        active: active.length,
        done,
        ratio,
        level,
        label: future
          ? ''
          : `${formatDateKey(key)} · ${done} of ${active.length} completed`
      });
    }

    weeks.push({ start: weekStart, days });
  }

  return weeks;
}

export function getWeekdayActivity(habits, startKey, endKey, today = todayKey()) {
  const counts = Array.from({ length: 7 }, () => 0);
  const end = endKey > today ? today : endKey;
  let cursor = startKey;

  while (cursor <= end) {
    for (const habit of habits) {
      if (isDoneOn(habit, cursor)) counts[weekdayIndex(cursor)] += 1;
    }
    cursor = addDays(cursor, 1);
  }

  return counts;
}

export function getWeekAtGlance(habits, today = todayKey()) {
  const weekStart = startOfWeek(today);
  const days = [];

  for (let index = 0; index < 7; index += 1) {
    const key = addDays(weekStart, index);
    const future = key > today;
    const active = habits.filter(habit => isActiveOn(habit, key));
    const done = active.filter(habit => isDoneOn(habit, key)).length;
    days.push({
      key,
      future,
      active: active.length,
      done,
      ratio: active.length ? done / active.length : 0
    });
  }

  return days;
}

export function getPeriodSummary(habits, days, today = todayKey()) {
  const startKey = getRangeStart(days, today);
  const completion = getOverallCompletion(habits, startKey, today, today);
  const checkIns = countCheckIns(habits, startKey, today, today);
  const currentStreak = getStreakLeader(habits, today);
  const bestStreak = getBestStreakLeader(habits, today);

  return {
    startKey,
    endKey: today,
    completion,
    checkIns,
    currentStreak,
    bestStreak,
    activeHabits: habits.length
  };
}
