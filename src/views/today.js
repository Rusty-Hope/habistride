import { ICONS } from '../icons.js';
import { WEEKDAYS } from '../constants.js';
import {
  addDays,
  contrastColor,
  escapeHtml,
  formatDateKey,
  formatLongDate,
  formatNumber,
  weekdayIndex
} from '../dates.js';
import {
  formatStreak,
  getCurrentStreak,
  getScheduleLabel,
  isActiveOn,
  isDoneOn,
  isWeekly
} from '../schedule.js';
import { getTodayOverview } from '../stats.js';

function habitMeta(item) {
  const { habit, due, weeklyProgress, skipped, today } = item;
  const parts = [];

  if (weeklyProgress) {
    parts.push(`<span>${escapeHtml(`${weeklyProgress.done} of ${weeklyProgress.target} this week`)}</span>`);
  }
  parts.push(`<span>${escapeHtml(getScheduleLabel(habit))}</span>`);

  if (habit.goal.type === 'count') {
    parts.push(`<span>${escapeHtml(`Goal ${formatNumber(habit.goal.target)}${habit.goal.unit ? ` ${habit.goal.unit}` : ''}`)}</span>`);
  }

  const streak = getCurrentStreak(habit, today);
  if (streak.count > 0) {
    parts.push(`<span class="streak-pill${streak.count >= 3 ? ' is-hot' : ''}">${ICONS.flame}${escapeHtml(formatStreak(streak))}</span>`);
  } else {
    parts.push(`<span>No streak yet</span>`);
  }

  if (skipped) parts.unshift(`<span class="status-tag">Rest day</span>`);
  else if (!due) parts.unshift(`<span>${escapeHtml(isWeekly(habit) ? 'Weekly goal met' : 'Not scheduled')}</span>`);

  return parts.join('<span class="meta-sep">·</span>');
}

function completionControl(item, dateKey) {
  const { habit, done } = item;
  const label = done
    ? `Mark ${habit.name} as not done`
    : `Mark ${habit.name} as done`;

  return `<button
    class="habit-check${done ? ' is-checked' : ''}"
    type="button"
    data-action="toggle"
    data-habit-id="${escapeHtml(habit.id)}"
    data-date-key="${escapeHtml(dateKey)}"
    aria-pressed="${done}"
    aria-label="${escapeHtml(label)}"
  >${ICONS.check}</button>`;
}

function compactCountControl(item, dateKey) {
  const { habit, done } = item;
  const value = Number(habit.logs[dateKey] || 0);
  const target = habit.goal.target;
  const unit = habit.goal.unit ? ` ${habit.goal.unit}` : '';
  const ratio = Math.min(100, Math.round((value / Math.max(1, target)) * 100));

  return `<div class="row-count${done ? ' is-complete' : ''}" role="group" aria-label="${escapeHtml(`${habit.name} progress`)}" style="--count-progress:${ratio}%">
    <button class="count-step" type="button" data-action="dec" data-habit-id="${escapeHtml(habit.id)}" data-date-key="${escapeHtml(dateKey)}" aria-label="Decrease ${escapeHtml(habit.name)}" ${value <= 0 ? 'disabled' : ''}>−</button>
    <button class="count-readout" type="button" data-action="day" data-habit-id="${escapeHtml(habit.id)}" data-date-key="${escapeHtml(dateKey)}" aria-label="${escapeHtml(`${formatNumber(value)}/${formatNumber(target)}${unit}. Edit ${habit.name}`)}">
      <strong>${formatNumber(value)}</strong><span>/${formatNumber(target)}</span>
    </button>
    <button class="count-step" type="button" data-action="inc" data-habit-id="${escapeHtml(habit.id)}" data-date-key="${escapeHtml(dateKey)}" aria-label="Increase ${escapeHtml(habit.name)}">+</button>
  </div>`;
}

function renderDateStrip(habits, selectedDate, today) {
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const key = addDays(today, -offset);
    const weekday = WEEKDAYS[weekdayIndex(key)];
    const dayNum = Number(key.slice(8, 10));
    const active = habits.filter(habit => !habit.archivedAt && isActiveOn(habit, key));
    const doneCount = active.filter(habit => isDoneOn(habit, key)).length;
    const allDone = active.length > 0 && doneCount === active.length;
    const someDone = doneCount > 0 && !allDone;
    const isSelected = key === selectedDate;
    const isToday = key === today;

    days.push(`<button
      type="button"
      class="date-pill${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}${allDone ? ' is-complete' : someDone ? ' is-partial' : ''}"
      data-action="select-date"
      data-date-key="${key}"
      aria-pressed="${isSelected}"
      aria-label="${escapeHtml(`${weekday.long}, ${formatDateKey(key)}${isToday ? ' (Today)' : ''}: ${doneCount} of ${active.length} completed`)}"
    >
      <span class="date-pill-day">${weekday.short}</span>
      <span class="date-pill-num">${dayNum}</span>
      <span class="date-pill-dot" aria-hidden="true"></span>
    </button>`);
  }

  return `<div class="today-date-strip" role="group" aria-label="Recent days">${days.join('')}</div>`;
}

function renderProgressRing(percent, allDone) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return `<div class="progress-ring-wrap${allDone ? ' is-complete' : ''}" aria-hidden="true">
    <svg class="progress-ring" width="44" height="44" viewBox="0 0 44 44">
      <circle class="progress-ring-bg" cx="22" cy="22" r="${radius}" fill="none" stroke-width="4"></circle>
      <circle class="progress-ring-value" cx="22" cy="22" r="${radius}" fill="none" stroke-width="4" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" stroke-linecap="round"></circle>
    </svg>
    <span class="progress-ring-label">${allDone ? ICONS.sparkles : `${percent}%`}</span>
  </div>`;
}

function renderHabitRow(item, { dateKey, today, canMoveUp, canMoveDown }) {
  const { habit, done, skipped, due } = item;
  const note = habit.notes?.[dateKey] || '';
  const classes = ['today-habit'];
  if (done) classes.push('is-done');
  if (!due) classes.push('is-quiet');
  if (skipped) classes.push('is-rest');
  const checkColor = contrastColor(habit.color);

  const titleBadge = isWeekly(habit)
    ? `<span class="mini-badge">Weekly</span>`
    : '';

  return `<article class="${classes.join(' ')}" data-habit-id="${escapeHtml(habit.id)}" style="--habit-color:${escapeHtml(habit.color)};--check-color:${checkColor}">
    ${completionControl(item, dateKey)}
    <span class="habit-badge" aria-hidden="true">${escapeHtml(habit.emoji)}</span>
    <div class="today-habit-copy">
      <div class="today-habit-title">
        <h4>${escapeHtml(habit.name)}</h4>
        ${titleBadge}
        ${skipped ? '<span class="mini-badge mini-badge--muted">Rest day</span>' : ''}
      </div>
      <p class="today-habit-meta">${habitMeta({ ...item, today })}</p>
      ${note ? '<p class="today-note-preview">' + escapeHtml(note) + '</p>' : ''}
    </div>
    ${habit.goal.type === 'count' ? compactCountControl(item, dateKey) : ''}
    <div class="today-habit-actions">
      <button class="icon-button icon-button--tiny${note ? ' has-note' : ''}" type="button" data-action="day" data-habit-id="${escapeHtml(habit.id)}" data-date-key="${escapeHtml(dateKey)}" aria-label="${escapeHtml(`Open details for ${habit.name}`)}" title="Day details & note">${ICONS.note}</button>
      <button class="icon-button icon-button--tiny" type="button" data-action="edit-habit" data-habit-id="${escapeHtml(habit.id)}" aria-label="${escapeHtml(`Edit ${habit.name}`)}" title="Edit habit">${ICONS.pencil}</button>
      <div class="habit-reorder" role="group" aria-label="${escapeHtml(`Reorder ${habit.name}`)}">
        <button class="icon-button icon-button--micro" type="button" data-action="move-up" data-habit-id="${escapeHtml(habit.id)}" aria-label="${escapeHtml(`Move ${habit.name} up`)}" title="Move up" ${canMoveUp ? '' : 'disabled'}>${ICONS.chevronUp}</button>
        <button class="icon-button icon-button--micro" type="button" data-action="move-down" data-habit-id="${escapeHtml(habit.id)}" aria-label="${escapeHtml(`Move ${habit.name} down`)}" title="Move down" ${canMoveDown ? '' : 'disabled'}>${ICONS.chevronDown}</button>
      </div>
    </div>
  </article>`;
}

function emptyState() {
  return `<div class="empty-state panel">
    <div class="empty-state-icon" aria-hidden="true">${ICONS.calendar}</div>
    <h3>Build your first routine</h3>
    <p>Start with one small habit. You can add schedules, targets, notes and reminders as you go.</p>
    <button class="button button--primary" type="button" data-action="add-habit">${ICONS.plus}<span>Add your first habit</span></button>
  </div>`;
}

export function renderToday({ habits, today, selectedDate = today }) {
  const activeDate = selectedDate && selectedDate <= today ? selectedDate : today;
  const overview = getTodayOverview(habits, activeDate);
  const activeHabits = habits.filter(habit => !habit.archivedAt);
  const activeCount = activeHabits.length;
  const activeIds = activeHabits.map(habit => habit.id);
  const percent = overview.dueTotal
    ? Math.round((overview.dueDone / overview.dueTotal) * 100)
    : 0;

  if (!activeCount) {
    return `<div class="view-inner">
      <header class="view-head today-head">
        <div>
          <p class="eyebrow">${escapeHtml(formatLongDate(today))}</p>
          <h2>Today</h2>
          <p class="view-subtitle">A quiet place to start a new routine.</p>
        </div>
      </header>
      ${emptyState()}
    </div>`;
  }

  const renderRowWithOrder = item => {
    const idx = activeIds.indexOf(item.habit.id);
    return renderHabitRow(item, {
      dateKey: activeDate,
      today,
      canMoveUp: idx > 0,
      canMoveDown: idx !== -1 && idx < activeIds.length - 1
    });
  };

  const dueRows = overview.due.map(renderRowWithOrder).join('');
  const otherRows = overview.other.map(renderRowWithOrder).join('');

  const isViewingToday = activeDate === today;
  const isYesterday = activeDate === addDays(today, -1);
  const headingTitle = isViewingToday
    ? 'Today'
    : isYesterday
      ? 'Yesterday'
      : formatDateKey(activeDate);

  const subtitle = overview.dueTotal
    ? overview.allDone
      ? isViewingToday
        ? 'Everything scheduled for today is complete.'
        : `All scheduled habits completed on ${formatDateKey(activeDate)}.`
      : `${overview.dueDone} of ${overview.dueTotal} scheduled habits complete.`
    : isViewingToday
      ? 'Nothing is scheduled for today.'
      : `Nothing was scheduled for ${formatDateKey(activeDate)}.`;

  return `<div class="view-inner">
    <header class="view-head today-head">
      <div class="today-head-main">
        <div class="today-eyebrow-row">
          <p class="eyebrow">${escapeHtml(formatLongDate(activeDate))}</p>
          ${!isViewingToday ? `<button class="back-today-pill" type="button" data-action="select-date" data-date-key="${today}">Back to today</button>` : ''}
        </div>
        <h2>${escapeHtml(headingTitle)}</h2>
        <p class="view-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <div class="today-progress${overview.allDone ? ' is-complete' : ''}" aria-label="${escapeHtml(subtitle)}">
        ${renderProgressRing(percent, overview.allDone)}
        <div class="today-progress-details">
          <div class="today-progress-copy">
            <strong>${overview.dueTotal ? `${overview.dueDone}/${overview.dueTotal}` : '—'}</strong>
            <span>${overview.allDone ? 'All done!' : overview.dueTotal ? 'completed' : 'free day'}</span>
          </div>
          <div class="progress"><span class="progress-bar" style="width:${percent}%"></span></div>
        </div>
      </div>
    </header>

    ${renderDateStrip(habits, activeDate, today)}

    <section class="habit-section" aria-labelledby="due-today-heading">
      <div class="section-heading">
        <h3 id="due-today-heading">${isViewingToday ? 'Due today' : `Due on ${escapeHtml(formatDateKey(activeDate))}`}</h3>
        <span class="section-count">${overview.dueDone}/${overview.dueTotal}</span>
      </div>
      ${dueRows || '<p class="section-empty">No habits are due on this day. Use the list below if you want to log extra sessions.</p>'}
    </section>

    ${overview.other.length ? `<section class="habit-section habit-section--quiet" aria-labelledby="also-today-heading">
      <div class="section-heading">
        <h3 id="also-today-heading">Also available</h3>
        <span class="section-count">${overview.other.length}</span>
      </div>
      ${otherRows}
    </section>` : ''}
  </div>`;
}
