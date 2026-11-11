import { WEEKDAYS } from '../constants.js';
import { ICONS } from '../icons.js';
import {
  addDays,
  escapeHtml,
  formatMonthShort,
  formatNumber,
  formatShortDateKey,
  pluralize,
  todayKey
} from '../dates.js';
import {
  formatStreak,
  getBestStreak,
  getCurrentStreak,
  getScheduleLabel
} from '../schedule.js';
import {
  getHabitCompletion,
  getHeatmap,
  getPeriodSummary,
  getWeekAtGlance,
  getWeekdayActivity
} from '../stats.js';

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' }
];

function streakValue(streak) {
  if (!streak || !streak.count) return '—';
  return `${streak.count} ${pluralize(streak.count, streak.unit === 'weeks' ? 'week' : 'day')}`;
}

function renderMonthLabels(weeks) {
  let previousMonth = null;
  let lastColumn = -3;
  return weeks.map((week, index) => {
    const middle = addDays(week.start, 3);
    const monthIndex = Number(middle.slice(5, 7)) - 1;
    if (monthIndex === previousMonth) return '';
    previousMonth = monthIndex;
    if (index - lastColumn < 2 || index > weeks.length - 2) return '';
    lastColumn = index;
    return `<span style="grid-row: 1; grid-column-start: ${index + 1}">${escapeHtml(formatMonthShort(monthIndex))}</span>`;
  }).join('');
}

function renderHeatmap(activeHabits, today) {
  const weeks = getHeatmap(activeHabits, today);
  const completedDays = weeks.reduce((sum, week) => (
    sum + week.days.filter(day => !day.future && day.done > 0).length
  ), 0);
  const completedHabits = weeks.reduce((sum, week) => (
    sum + week.days.reduce((daySum, day) => daySum + (day.future ? 0 : day.done), 0)
  ), 0);
  const cells = weeks.map(week => week.days.map(day => {
    const title = day.label || 'Future';
    return `<span class="heat-cell heat-${day.level}${day.future ? ' is-future' : ''}" title="${escapeHtml(title)}"></span>`;
  }).join('')).join('');

  return `<section class="panel insight-panel heatmap-panel" aria-labelledby="heatmap-heading">
    <div class="panel-heading">
      <div>
        <h3 id="heatmap-heading">Activity</h3>
        <p>Your last 12 months, one square per day.</p>
      </div>
      <span class="panel-meta">Last 12 months</span>
    </div>
    <div class="heatmap">
      <div class="heatmap-scroll">
        <div class="heatmap-months">${renderMonthLabels(weeks)}</div>
        <div class="heatmap-body">
          <div class="heatmap-weekdays" aria-hidden="true"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span></div>
          <div class="heatmap-grid" role="img" aria-label="${escapeHtml(`Activity heatmap for the last 12 months: ${completedDays} days with activity and ${completedHabits} completed habit-days.`)}">${cells}</div>
        </div>
      </div>
      <div class="heatmap-legend" aria-hidden="true"><span>Less</span><i class="heat-cell heat-0"></i><i class="heat-cell heat-1"></i><i class="heat-cell heat-2"></i><i class="heat-cell heat-3"></i><i class="heat-cell heat-4"></i><span>More</span></div>
    </div>
  </section>`;
}

function renderWeekdayBars(activeHabits, startKey, today) {
  const counts = getWeekdayActivity(activeHabits, startKey, today, today);
  const max = Math.max(...counts, 1);
  const bestDay = counts.indexOf(Math.max(...counts));

  const chartLabel = WEEKDAYS.map(day => `${day.short} ${counts[day.value]}`).join(', ');

  return `<section class="panel insight-panel" aria-labelledby="weekday-heading">
    <div class="panel-heading">
      <div>
        <h3 id="weekday-heading">Check-ins by weekday</h3>
        <p>When you show up most often.</p>
      </div>
      <span class="panel-meta">${counts[bestDay] ? `${WEEKDAYS[bestDay].long} leads` : 'No data yet'}</span>
    </div>
    <div class="weekday-chart" role="img" aria-label="${escapeHtml(`Check-ins by weekday: ${chartLabel}.`)}">
      ${WEEKDAYS.map(day => {
        const count = counts[day.value];
        const height = count ? Math.max(8, Math.round((count / max) * 100)) : 2;
        return `<div class="weekday-column${count === counts[bestDay] && count > 0 ? ' is-best' : ''}">
          <span class="weekday-count">${count}</span>
          <span class="weekday-bar" style="height:${height}%"></span>
          <span class="weekday-label">${day.short}</span>
        </div>`;
      }).join('')}
    </div>
  </section>`;
}

function renderWeekGlance(activeHabits, today) {
  const days = getWeekAtGlance(activeHabits, today);
  const total = days.reduce((sum, day) => sum + day.done, 0);
  const label = days
    .map((day, index) => `${WEEKDAYS[index].short} ${day.future ? 'upcoming' : day.done}`)
    .join(', ');

  return `<section class="panel insight-panel" aria-labelledby="week-glance-heading">
    <div class="panel-heading">
      <div>
        <h3 id="week-glance-heading">This week</h3>
        <p>${escapeHtml(`${total} check-in${total === 1 ? '' : 's'} so far.`)}</p>
      </div>
      <span class="panel-meta">Mon–Sun</span>
    </div>
    <div class="week-glance" role="img" aria-label="${escapeHtml(`This week's check-ins: ${label}.`)}">
      ${days.map((day, index) => `<div class="week-day${day.future ? ' is-future' : ''}">
        <span class="week-day-label">${WEEKDAYS[index].short}</span>
        <span class="week-day-cell" style="--day-progress:${Math.round(day.ratio * 100)}%">
          <span>${day.future ? '' : day.done}</span>
        </span>
      </div>`).join('')}
    </div>
  </section>`;
}

function renderHabitBreakdown(habitsList, startKey, today, { isArchivedList = false } = {}) {
  if (!habitsList.length) {
    return `<p class="section-empty">No active habits yet.</p>`;
  }

  return `<div class="habit-breakdown">
    ${habitsList.map(habit => {
      const completion = getHabitCompletion(habit, startKey, today, today);
      const current = getCurrentStreak(habit, today);
      const best = getBestStreak(habit, today);
      const percent = completion.rate ?? 0;
      const unitSuffix = current.unit === 'weeks' ? 'w' : 'd';
      return `<article class="breakdown-row${isArchivedList ? ' is-archived' : ''}" style="--habit-color:${escapeHtml(habit.color)}">
        <span class="habit-badge" style="--habit-color:${escapeHtml(habit.color)}" aria-hidden="true">${escapeHtml(habit.emoji)}</span>
        <div class="breakdown-main">
          <div class="breakdown-title">
            <strong>${escapeHtml(habit.name)}${isArchivedList ? ' <span class="mini-badge mini-badge--muted">Archived</span>' : ''}</strong>
            <span>${completion.rate === null ? '—' : `${percent}%`}</span>
          </div>
          <div class="breakdown-meta">${escapeHtml(getScheduleLabel(habit))} · ${current.count ? escapeHtml(formatStreak(current)) : 'No current streak'}</div>
          <div class="progress"><span class="progress-bar progress-bar--habit" style="width:${percent}%"></span></div>
        </div>
        <div class="breakdown-stats">
          <span class="breakdown-stat"><strong>${current.count || 0}<i>${unitSuffix}</i></strong><small>current</small></span>
          <span class="breakdown-stat"><strong>${best.count || 0}<i>${unitSuffix}</i></strong><small>best</small></span>
        </div>
      </article>`;
    }).join('')}
  </div>`;
}

export function renderInsights({ habits, period = 30, today = todayKey() }) {
  const active = habits.filter(habit => !habit.archivedAt);
  const archived = habits.filter(habit => Boolean(habit.archivedAt));

  if (!active.length && !archived.length) {
    return `<div class="view-inner">
      <header class="view-head">
        <div><h2>Insights</h2><p class="view-subtitle">Patterns appear once you have a few check-ins.</p></div>
      </header>
      <div class="empty-state panel">
        <div class="empty-state-icon" aria-hidden="true">${ICONS.chart}</div>
        <h3>Nothing to measure yet</h3>
        <p>Add a habit and start checking in. Your progress, streaks and best days will show up here.</p>
        <button class="button button--primary" type="button" data-action="add-habit">${ICONS.plus}<span>Add habit</span></button>
      </div>
    </div>`;
  }

  const summary = getPeriodSummary(active.length ? active : habits, period, today);
  const { startKey } = summary;
  const bestStreak = summary.bestStreak;
  const rate = summary.completion.rate;

  return `<div class="view-inner">
    <header class="view-head">
      <div>
        <p class="eyebrow">Progress</p>
        <h2>Insights</h2>
        <p class="view-subtitle">Small signals from the last ${period} days.</p>
      </div>
      <div class="segmented segmented--range" role="group" aria-label="Insights period">
        ${PERIODS.map(item => `<button type="button" class="segmented-button${item.days === period ? ' is-active' : ''}" data-action="range" data-days="${item.days}" aria-pressed="${item.days === period}">${item.label}</button>`).join('')}
      </div>
    </header>

    <section class="insight-metrics" aria-label="Summary">
      <article class="metric">
        <div class="metric-top">
          <p class="metric-label">Completion</p>
          <span class="metric-icon metric-icon--accent" aria-hidden="true">${ICONS.target}</span>
        </div>
        <p class="metric-value">${rate === null ? '—' : `${rate}<span class="metric-unit">%</span>`}</p>
        <p class="metric-note">${summary.completion.habits ? `Across ${summary.completion.habits} active ${summary.completion.habits === 1 ? 'habit' : 'habits'}` : 'No scheduled days in this period'}</p>
      </article>
      <article class="metric">
        <div class="metric-top">
          <p class="metric-label">Check-ins</p>
          <span class="metric-icon metric-icon--success" aria-hidden="true">${ICONS.check}</span>
        </div>
        <p class="metric-value">${formatNumber(summary.checkIns)}</p>
        <p class="metric-note">${escapeHtml(`${formatShortDateKey(startKey)} – ${formatShortDateKey(today)}`)}</p>
      </article>
      <article class="metric">
        <div class="metric-top">
          <p class="metric-label">Best streak</p>
          <span class="metric-icon metric-icon--warning" aria-hidden="true">${ICONS.trophy}</span>
        </div>
        <p class="metric-value">${bestStreak ? escapeHtml(streakValue(bestStreak.streak)) : '—'}</p>
        <p class="metric-note">${bestStreak ? escapeHtml(bestStreak.habit.name) : 'No streak yet'}</p>
      </article>
      <article class="metric">
        <div class="metric-top">
          <p class="metric-label">Active habits</p>
          <span class="metric-icon" aria-hidden="true">${ICONS.flame}</span>
        </div>
        <p class="metric-value">${active.length}</p>
        <p class="metric-note">${archived.length ? `${archived.length} archived` : 'All visible'}</p>
      </article>
    </section>

    <div class="insight-grid">
      ${renderHeatmap(active.length ? active : habits, today)}
      ${renderWeekGlance(active.length ? active : habits, today)}
    </div>

    <div class="insight-grid insight-grid--split">
      ${renderWeekdayBars(active.length ? active : habits, startKey, today)}
      <section class="panel insight-panel" aria-labelledby="breakdown-heading">
        <div class="panel-heading">
          <div>
            <h3 id="breakdown-heading">Habit breakdown</h3>
            <p>Current period, one habit at a time.</p>
          </div>
        </div>
        ${renderHabitBreakdown(active, startKey, today)}
        ${archived.length ? `<div class="archived-breakdown">
          <h4 class="archived-breakdown-title">Archived history</h4>
          ${renderHabitBreakdown(archived, startKey, today, { isArchivedList: true })}
        </div>` : ''}
      </section>
    </div>
  </div>`;
}
