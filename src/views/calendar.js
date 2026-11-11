import { WEEKDAYS } from '../constants.js';
import { ICONS } from '../icons.js';
import {
  buildKey,
  contrastColor,
  daysInMonth,
  escapeHtml,
  formatDateKey,
  formatMonthYear,
  formatNumber,
  todayKey,
  weekdayIndex
} from '../dates.js';
import {
  getCurrentStreak,
  getScheduleLabel,
  isDoneOn,
  isSkippedOn
} from '../schedule.js';
import { getOverallCompletion } from '../stats.js';

function compactStreak(streak) {
  if (!streak.count) return 'No streak';
  return `${streak.count}${streak.unit === 'weeks' ? 'w' : 'd'} streak`;
}

function monthActivity(habits, year, monthIndex) {
  const start = buildKey(year, monthIndex, 1);
  const end = buildKey(year, monthIndex, daysInMonth(year, monthIndex));

  for (const habit of habits) {
    for (const key of Object.keys(habit.logs || {})) {
      if (key >= start && key <= end) return true;
    }
    for (const key of Object.keys(habit.notes || {})) {
      if (key >= start && key <= end) return true;
    }
    for (const key of Object.keys(habit.skips || {})) {
      if (key >= start && key <= end) return true;
    }
  }

  return false;
}

function dayCell(habit, dayMeta, today) {
  const { key, weekday, dateLabel } = dayMeta;
  const disabled = key > today || key < habit.createdAt;
  const done = isDoneOn(habit, key);
  const skipped = isSkippedOn(habit, key);
  const note = habit.notes?.[key] || '';
  const value = Number(habit.logs?.[key] || 0);
  const target = habit.goal.target;
  const partial = habit.goal.type === 'count' && value > 0 && value < target;

  const classes = ['day-cell'];
  if (disabled) classes.push('is-disabled');
  if (done) classes.push('is-done');
  if (partial) classes.push('is-partial');
  if (skipped) classes.push('is-skipped');
  if (note) classes.push('has-note');
  if (key === today) classes.push('is-today');
  if (weekday?.value >= 5) classes.push('is-weekend');

  let content = '';
  if (done) content = ICONS.check;
  else if (skipped) content = '<span class="cell-dash" aria-hidden="true">–</span>';
  else if (partial) content = `<span class="cell-value">${formatNumber(value)}</span>`;

  let status = 'not recorded';
  if (skipped) status = 'rest day';
  else if (done) status = 'completed';
  else if (partial) status = `${value} of ${target}${habit.goal.unit ? ` ${habit.goal.unit}` : ''}`;

  const noteText = note ? `. Note: ${note}` : '';
  const label = `${habit.name}, ${dateLabel}: ${status}${noteText}`;

  return `<td class="day-cell-wrap">
    <button
      class="${classes.join(' ')}"
      type="button"
      data-action="day"
      data-habit-id="${escapeHtml(habit.id)}"
      data-date-key="${key}"
      aria-label="${escapeHtml(label)}"
      ${disabled ? 'disabled' : ''}
      style="--habit-color:${escapeHtml(habit.color)};--check-color:${contrastColor(habit.color)}"
    >${content}${note ? '<span class="note-dot" aria-hidden="true"></span>' : ''}</button>
  </td>`;
}

export function renderCalendar({ habits, view, today = todayKey() }) {
  const active = habits.filter(habit => !habit.archivedAt);

  if (!active.length) {
    return `<div class="view-inner">
      <header class="view-head">
        <div><h2>Calendar</h2><p class="view-subtitle">See your monthly progress at a glance.</p></div>
      </header>
      <div class="empty-state panel">
        <div class="empty-state-icon" aria-hidden="true">${ICONS.calendar}</div>
        <h3>No habits to show</h3>
        <p>Create a habit and your monthly history will appear here.</p>
        <button class="button button--primary" type="button" data-action="add-habit">${ICONS.plus}<span>Add habit</span></button>
      </div>
    </div>`;
  }

  const totalDays = daysInMonth(view.year, view.month);
  const firstKey = buildKey(view.year, view.month, 1);
  const lastKey = buildKey(view.year, view.month, totalDays);
  const futureMonth = firstKey > today;
  const progress = getOverallCompletion(active, firstKey, lastKey, today);
  const hasActivity = monthActivity(active, view.year, view.month);
  const monthTitle = formatMonthYear(view.year, view.month);

  let header = `<tr><th scope="col" class="corner-cell">Habit</th>`;
  const daysMeta = [];
  for (let day = 1; day <= totalDays; day += 1) {
    const key = buildKey(view.year, view.month, day);
    const weekday = WEEKDAYS[weekdayIndex(key)];
    daysMeta.push({ key, weekday, dateLabel: formatDateKey(key) });
    const classes = ['day-head'];
    if (key === today) classes.push('is-today');
    if (weekday?.value >= 5) classes.push('is-weekend');
    header += `<th scope="col" class="${classes.join(' ')}"${key === today ? ' aria-current="date"' : ''}>
      <span class="weekday"><abbr title="${weekday?.long || ''}">${weekday?.short || ''}</abbr></span>
      <span class="day-number">${day}</span>
    </th>`;
  }
  header += '</tr>';

  const rows = active.map(habit => {
    const streak = getCurrentStreak(habit, today);
    const streakLabel = compactStreak(streak);
    const editLabel = `Edit ${habit.name}`;

    let row = '<tr class="habit-row">';
    row += `<th scope="row" class="habit-row-label">
      <div class="habit-row-label-inner">
        <span class="habit-badge" style="--habit-color:${escapeHtml(habit.color)}" aria-hidden="true">${escapeHtml(habit.emoji)}</span>
        <span class="habit-info">
          <span class="habit-name">${escapeHtml(habit.name)}</span>
          <span class="habit-streak">${escapeHtml(getScheduleLabel(habit))} · ${escapeHtml(streakLabel)}</span>
        </span>
        <button class="edit-habit" type="button" data-action="edit-habit" data-habit-id="${escapeHtml(habit.id)}" aria-label="${escapeHtml(editLabel)}">${ICONS.pencil}</button>
      </div>
    </th>`;

    for (let index = 0; index < daysMeta.length; index += 1) {
      row += dayCell(habit, daysMeta[index], today);
    }
    row += '</tr>';
    return row;
  }).join('');

  const monthNote = futureMonth
    ? `<div class="inline-notice"><span class="inline-notice-icon">${ICONS.calendar}</span><div><strong>This month hasn’t started yet.</strong><p>Come back when the month begins or use Today to keep your streak going.</p></div></div>`
    : !hasActivity
      ? `<div class="inline-notice"><span class="inline-notice-icon">${ICONS.calendar}</span><div><strong>No entries in ${escapeHtml(monthTitle)} yet.</strong><p>Open a day to add a check-in or note — or start from Today.</p></div></div>`
      : '';

  return `<div class="view-inner">
    <header class="view-head calendar-head">
      <div>
        <p class="eyebrow">History</p>
        <h2>Calendar</h2>
        <p class="view-subtitle">A calm monthly overview of every active habit.</p>
      </div>
      <div class="calendar-controls">
        <button class="icon-button" type="button" data-action="prev-month" aria-label="Previous month">${ICONS.chevronLeft}</button>
        <h3 class="month-title" aria-live="polite">${escapeHtml(monthTitle)}</h3>
        <button class="icon-button" type="button" data-action="next-month" aria-label="Next month">${ICONS.chevronRight}</button>
        <button class="button button--ghost button--small" type="button" data-action="today">Today</button>
      </div>
    </header>

    <div class="panel calendar-panel">
      ${monthNote}
      <div class="calendar-meta">
        <div class="legend" aria-label="Calendar legend">
          <span class="legend-item"><span class="legend-swatch legend-swatch--done"></span>Done</span>
          <span class="legend-item"><span class="legend-swatch legend-swatch--partial"></span>Partial</span>
          <span class="legend-item"><span class="legend-swatch legend-swatch--rest"></span>Rest day</span>
          <span class="legend-item"><span class="legend-dot"></span>Note</span>
        </div>
        <span class="month-rate">${progress.rate === null ? 'No data yet' : `${progress.rate}% this month`}</span>
      </div>
      <div class="calendar-scroll" id="calendar-scroll">
        <table class="habit-table" aria-label="${escapeHtml(`Habit check-ins for ${monthTitle}`)}">
          <caption class="sr-only">${escapeHtml(`Habit check-ins for ${monthTitle}`)}</caption>
          <colgroup><col class="col-habit"><col span="${totalDays}" class="col-day"></colgroup>
          <thead>${header}</thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="scroll-hint" id="calendar-scroll-hint" hidden>${ICONS.arrowRight}<span>Scroll horizontally to see the full month</span></p>
    </div>
  </div>`;
}
