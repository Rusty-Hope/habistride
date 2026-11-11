import { createBackup } from './schema.js';
import { csvEscape, downloadText, todayKey } from './dates.js';
import { getScheduleLabel, isDoneOn } from './schedule.js';
import { buildReminderCalendar } from './ics.js';

export function exportJSON(habits) {
  const payload = createBackup(habits);
  downloadText(
    JSON.stringify(payload, null, 2),
    `habistride-${todayKey()}.json`,
    'application/json;charset=utf-8'
  );
  return payload;
}

export function exportCSV(habits) {
  const rows = [[
    'Habit',
    'Icon',
    'Schedule',
    'Goal',
    'Target',
    'Unit',
    'Date',
    'Value',
    'Completed',
    'Rest day',
    'Note'
  ]];

  const sortedHabits = [...habits].sort((a, b) => a.name.localeCompare(b.name));

  for (const habit of sortedHabits) {
    const dates = [...new Set([
      ...Object.keys(habit.logs || {}),
      ...Object.keys(habit.skips || {}),
      ...Object.keys(habit.notes || {})
    ])].sort();

    for (const key of dates) {
      const value = habit.logs?.[key];
      rows.push([
        habit.name,
        habit.emoji,
        getScheduleLabel(habit),
        habit.goal.type === 'count' ? 'Count' : 'Check',
        habit.goal.type === 'count' ? habit.goal.target : 1,
        habit.goal.unit || '',
        key,
        value ?? '',
        isDoneOn(habit, key) ? 'Yes' : 'No',
        habit.skips?.[key] ? 'Yes' : 'No',
        habit.notes?.[key] || ''
      ]);
    }
  }

  const csv = `\uFEFF${rows.map(row => row.map(csvEscape).join(',')).join('\r\n')}\r\n`;
  downloadText(csv, `habistride-${todayKey()}.csv`, 'text/csv;charset=utf-8');
  return rows.length - 1;
}

export function exportReminders(habits) {
  const calendar = buildReminderCalendar(habits);
  if (!calendar) return false;
  downloadText(calendar, `habistride-reminders-${todayKey()}.ics`, 'text/calendar;charset=utf-8');
  return true;
}
