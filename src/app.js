import {
  APP_NAME,
  APP_VERSION,
  DISPLAY_MODE_STANDALONE_QUERY,
  LIMITS,
  STORAGE_KEYS,
  VIEWS,
  IMPORT_ERROR_MESSAGES
} from './constants.js';
import {
  formatLongDate,
  formatTimestamp,
  todayKey
} from './dates.js';
import {
  SchemaError,
  parseBackupText,
  summaryText
} from './schema.js';
import { StorageService } from './storage.js';
import { Store } from './store.js';
import { createDemoHabits } from './demo.js';
import { ToastManager } from './toast.js';
import { ConfirmDialog } from './dialogs/confirm.js';
import { HabitDialog } from './dialogs/habit.js';
import { DayDialog } from './dialogs/day.js';
import { SettingsDialog } from './dialogs/settings.js';
import { OnboardingDialog } from './dialogs/onboarding.js';
import { renderToday } from './views/today.js';
import { renderCalendar } from './views/calendar.js';
import { renderInsights } from './views/insights.js';
import {
  exportCSV,
  exportJSON,
  exportReminders
} from './backup.js';

export class App {
  constructor() {
    this.storage = new StorageService();
    const loadedSettings = this.storage.readSettings();
    const stateResult = this.storage.readState();

    this.hadStoredState = stateResult.habits !== null;
    this.initialStateError = stateResult.error;
    this.initialStateSource = stateResult.source;
    this.store = new Store(stateResult.habits || [], loadedSettings);
    this.currentView = VIEWS.includes(loadedSettings.view) ? loadedSettings.view : 'today';
    this.monthView = currentMonthView();
    this.period = 30;
    this.currentDay = todayKey();
    this.selectedDate = this.currentDay;
    this.settingsOpen = false;
    this.installPrompt = null;
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    this.storagePersisted = false;
    this.storageEstimate = null;
    this.storageErrorShown = false;
    this.resizeFrame = 0;

    this.elements = {
      todayView: document.getElementById('today-view'),
      calendarView: document.getElementById('calendar-view'),
      insightsView: document.getElementById('insights-view'),
      main: document.getElementById('main'),
      todayDate: document.getElementById('today-date'),
      themeToggle: document.getElementById('theme-toggle'),
      settingsButton: document.getElementById('settings-button'),
      addHabitButton: document.getElementById('add-habit-button'),
      importInput: document.getElementById('import-input'),
      toastRegion: document.getElementById('toast-region'),
      themeMeta: document.querySelector('meta[name="theme-color"]'),
      appVersion: document.getElementById('app-version'),
      navButtons: Array.from(document.querySelectorAll('[data-nav]'))
    };

    this.toast = new ToastManager(this.elements.toastRegion);
    this.confirmDialog = new ConfirmDialog();
    this.habitDialog = new HabitDialog();
    this.dayDialog = new DayDialog();
    this.settingsDialog = new SettingsDialog({
      onThemeChange: theme => this.changeTheme(theme),
      onExportJSON: () => this.exportDataJSON(),
      onExportCSV: () => this.exportDataCSV(),
      onImport: () => this.openImportPicker(),
      onClear: () => this.requestClearAll(),
      onDownloadICS: () => this.downloadReminders(),
      onInstall: () => this.promptInstall(),
      onRequestPersist: () => this.requestPersistence(),
      onRestoreSnapshot: index => this.restoreSnapshot(index),
      onRestoreHabit: id => this.restoreArchivedHabit(id),
      onDeleteHabit: id => this.requestDeleteArchivedHabit(id),
      onClose: () => {
        this.settingsOpen = false;
      }
    });

    this.onboardingDialog = new OnboardingDialog({
      onStartFresh: () => this.finishOnboarding(false),
      onLoadDemo: () => this.finishOnboarding(true)
    });

    this.habitDialog.onSubmit = (data, habit, mode) => this.saveHabit(data, habit, mode);
    this.habitDialog.onDelete = habit => this.requestDeleteHabit(habit);
    this.habitDialog.onArchive = habit => this.archiveHabit(habit);

    this.dayDialog.onSave = (habit, key, values) => this.saveDayEntry(habit, key, values);
    this.dayDialog.onClear = (habit, key) => this.clearDayEntry(habit, key);

    this.darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.standaloneQuery = window.matchMedia(DISPLAY_MODE_STANDALONE_QUERY);

    this.bindEvents();
    this.applyTheme();
    this.renderAll();
    this.afterInitialRender();
    this.setupLifecycleListeners();
  }

  bindEvents() {
    this.elements.navButtons.forEach(button => {
      button.addEventListener('click', () => this.setView(button.dataset.nav));
    });

    this.elements.themeToggle.addEventListener('click', () => {
      const next = this.getEffectiveTheme() === 'dark' ? 'light' : 'dark';
      this.changeTheme(next);
    });

    this.elements.settingsButton.addEventListener('click', () => this.openSettings());
    this.elements.addHabitButton.addEventListener('click', () => this.openCreateHabit());

    this.elements.main.addEventListener('click', event => {
      const trigger = event.target.closest('[data-action]');
      if (!trigger) return;

      const action = trigger.dataset.action;
      const habitId = trigger.dataset.habitId;

      switch (action) {
        case 'add-habit':
          this.openCreateHabit();
          break;
        case 'edit-habit':
          this.openEditHabit(habitId);
          break;
        case 'toggle':
          this.toggleToday(habitId, trigger.dataset.dateKey || this.selectedDate || todayKey());
          break;
        case 'inc':
          this.adjustCount(habitId, trigger.dataset.dateKey || this.selectedDate || todayKey(), 1);
          break;
        case 'dec':
          this.adjustCount(habitId, trigger.dataset.dateKey || this.selectedDate || todayKey(), -1);
          break;
        case 'day':
          this.openDayDialog(habitId, trigger.dataset.dateKey || this.selectedDate || todayKey());
          break;
        case 'select-date':
          if (trigger.dataset.dateKey && trigger.dataset.dateKey <= this.currentDay) {
            this.selectedDate = trigger.dataset.dateKey;
            this.render();
            requestAnimationFrame(() => {
              const pill = this.elements.main.querySelector(
                `[data-action="select-date"][data-date-key="${this.selectedDate}"]`
              );
              if (pill) pill.focus();
            });
          }
          break;
        case 'move-up':
          if (this.store.moveHabit(habitId, -1)) {
            this.persistHabits();
            this.render();
            this.restoreFocusAction('move-up', habitId);
          }
          break;
        case 'move-down':
          if (this.store.moveHabit(habitId, 1)) {
            this.persistHabits();
            this.render();
            this.restoreFocusAction('move-down', habitId);
          }
          break;
        case 'prev-month':
          this.changeMonth(-1);
          break;
        case 'next-month':
          this.changeMonth(1);
          break;
        case 'today':
          this.goToCurrentMonth();
          break;
        case 'range':
          this.period = Number(trigger.dataset.days) || 30;
          this.render();
          requestAnimationFrame(() => {
            const selected = this.elements.main.querySelector(
              `[data-action="range"][data-days="${this.period}"]`
            );
            if (selected) selected.focus();
          });
          break;
        default:
          break;
      }
    });

    this.elements.importInput.addEventListener('change', event => this.handleImportFile(event));

    window.addEventListener('resize', () => {
      if (this.resizeFrame) return;
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = 0;
        this.updateCalendarScrollHint();
      });
    });

    window.addEventListener('storage', event => this.handleStorageEvent(event));
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      this.installPrompt = event;
      this.refreshSettings();
    });
    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      this.isStandalone = true;
      this.toast.show(`${APP_NAME} installed.`, { type: 'success' });
      this.refreshSettings();
    });
    window.addEventListener('offline', () => {
      this.toast.show('You are offline. Your data is still available.', { type: 'info' });
    });
    window.addEventListener('online', () => {
      this.toast.show('You are back online.', { type: 'info' });
    });

    this.darkModeQuery.addEventListener?.('change', () => {
      if (this.store.settings.theme === 'system') {
        this.applyTheme();
        this.refreshSettings();
      }
    });

    this.standaloneQuery.addEventListener?.('change', event => {
      this.isStandalone = event.matches;
      this.refreshSettings();
    });

    window.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case '1':
          this.setView('today');
          break;
        case '2':
          this.setView('calendar');
          break;
        case '3':
          this.setView('insights');
          break;
        case 'n':
          event.preventDefault();
          this.openCreateHabit();
          break;
        case 't': {
          const next = this.getEffectiveTheme() === 'dark' ? 'light' : 'dark';
          this.changeTheme(next);
          break;
        }
        default:
          break;
      }
    });
  }

  setupLifecycleListeners() {
    const syncCurrentDay = () => {
      const day = todayKey();
      if (day === this.currentDay) return;
      const oldDay = this.currentDay;
      this.currentDay = day;
      if (this.selectedDate === oldDay) {
        this.selectedDate = day;
      }
      if (monthKeyOf(this.monthView) === oldDay.slice(0, 7)) {
        this.monthView = currentMonthView();
      }
      this.render();
    };

    this.dayCheckTimer = window.setInterval(syncCurrentDay, 60000);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) syncCurrentDay();
    });
  }

  afterInitialRender() {
    if (!this.storage.available) {
      this.storageErrorShown = true;
      this.toast.show('Local storage is unavailable. Changes will not be saved.', {
        type: 'error',
        duration: 6500
      });
    } else if (this.initialStateError) {
      this.toast.show(
        this.initialStateSource === 'snapshot'
          ? 'Saved data could not be read. The latest restore point was loaded.'
          : 'Saved data could not be read. You can import a backup or start fresh.',
        { type: 'error', duration: 6500 }
      );
    }

    if (this.initialStateSource === 'legacy') {
      this.toast.show('Your data was upgraded to the new format.', { type: 'info', duration: 4500 });
    }

    const params = new URLSearchParams(window.location.search);
    const demoRequested = params.get('demo') === '1';
    const requestedTheme = params.get('theme');
    const requestedView = params.get('view');

    if (!this.hadStoredState && !this.initialStateError && demoRequested) {
      if (['light', 'dark'].includes(requestedTheme)) {
        this.store.setTheme(requestedTheme);
        this.applyTheme();
      }
      this.finishOnboarding(true, { quiet: true });
      if (VIEWS.includes(requestedView)) {
        this.currentView = requestedView;
        this.store.setView(requestedView);
        this.persistSettings();
        this.renderAll();
      }
      this.ensurePersistence();
      return;
    }

    if (this.hadStoredState) {
      if (!this.store.settings.onboarded) {
        this.store.setOnboarded(true);
        this.persistSettings();
      }
    } else if (!this.initialStateError && !this.store.settings.onboarded) {
      this.onboardingDialog.open();
    }

    this.ensurePersistence();
  }

  async ensurePersistence() {
    if (!this.storage.available) return;
    const persisted = await this.storage.requestPersistence();
    this.storagePersisted = persisted;
    if (this.settingsOpen) this.refreshSettings();
  }

  renderAll() {
    this.updateChrome();
    this.render();
  }

  updateChrome() {
    this.elements.todayDate.textContent = formatLongDate(this.currentDay);
    this.elements.appVersion.textContent = `${APP_NAME} v${APP_VERSION}`;

    this.elements.navButtons.forEach(button => {
      const active = button.dataset.nav === this.currentView;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });

    const viewName = { today: 'Today', calendar: 'Calendar', insights: 'Insights' }[this.currentView];
    document.title = viewName
      ? `${viewName} · ${APP_NAME}`
      : APP_NAME;

    this.applyTheme();
  }

  render() {
    const { todayView, calendarView, insightsView } = this.elements;
    const views = { today: todayView, calendar: calendarView, insights: insightsView };

    Object.entries(views).forEach(([name, element]) => {
      element.hidden = name !== this.currentView;
    });

    if (this.currentView === 'today') {
      todayView.innerHTML = renderToday({
        habits: this.store.habits,
        today: this.currentDay,
        selectedDate: this.selectedDate
      });
    } else if (this.currentView === 'calendar') {
      calendarView.innerHTML = renderCalendar({
        habits: this.store.habits,
        view: this.monthView,
        today: this.currentDay
      });
      requestAnimationFrame(() => this.updateCalendarScrollHint());
    } else {
      insightsView.innerHTML = renderInsights({
        habits: this.store.habits,
        period: this.period,
        today: this.currentDay
      });
    }

    this.updateChrome();
  }

  setView(view) {
    if (!VIEWS.includes(view) || view === this.currentView) return;
    this.currentView = view;
    this.store.setView(view);
    this.persistSettings();
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------ theme ------------------------------ */

  getEffectiveTheme() {
    if (this.store.settings.theme === 'light' || this.store.settings.theme === 'dark') {
      return this.store.settings.theme;
    }
    return this.darkModeQuery.matches ? 'dark' : 'light';
  }

  applyTheme() {
    const theme = this.getEffectiveTheme();
    const isDark = theme === 'dark';
    document.documentElement.dataset.theme = theme;

    if (this.elements.themeMeta) {
      this.elements.themeMeta.setAttribute('content', isDark ? '#0e0f12' : '#f6f6f8');
    }

    const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
    this.elements.themeToggle.setAttribute('aria-label', label);
    this.elements.themeToggle.title = label;
    this.elements.themeToggle.setAttribute('aria-pressed', String(isDark));
  }

  changeTheme(theme) {
    this.store.setTheme(theme);
    this.applyTheme();
    this.persistSettings();
  }

  /* ---------------------------- onboarding ---------------------------- */

  finishOnboarding(useDemo, { quiet = false } = {}) {
    if (useDemo) {
      this.store.replaceHabits(createDemoHabits());
    } else if (!this.store.habits.length) {
      this.store.replaceHabits([]);
    }

    this.store.setOnboarded(true);
    this.currentView = 'today';
    this.store.setView('today');
    this.persistHabits();
    this.persistSettings();
    this.renderAll();

    if (useDemo) {
      if (!quiet) {
        this.toast.show('Demo habits loaded. Edit or clear them whenever you like.', {
          type: 'info',
          duration: 4500
        });
      }
    } else {
      this.elements.addHabitButton.focus();
    }
  }

  /* ----------------------------- navigation ---------------------------- */

  changeMonth(delta) {
    const date = new Date(this.monthView.year, this.monthView.month + delta, 1);
    this.monthView = { year: date.getFullYear(), month: date.getMonth() };
    this.render();
    this.focusAction(delta < 0 ? 'prev-month' : 'next-month');
  }

  goToCurrentMonth() {
    this.monthView = currentMonthView();
    this.render();
    this.focusAction('today');
    requestAnimationFrame(() => this.scrollCalendarToToday());
  }

  /* ------------------------------- habits ------------------------------ */

  openCreateHabit() {
    this.habitDialog.openCreate(this.store.habits);
  }

  openEditHabit(habitId) {
    const habit = this.store.find(habitId);
    if (!habit) return;
    this.habitDialog.openEdit(habit);
  }

  saveHabit(data, existingHabit, mode) {
    if (mode === 'create' && this.store.habits.length >= LIMITS.maxHabits) {
      this.habitDialog.showError(`You can track up to ${LIMITS.maxHabits} habits.`);
      return;
    }

    let habit;
    if (mode === 'create') {
      habit = this.store.createHabit(data);
    } else if (existingHabit) {
      habit = this.store.updateHabit(existingHabit.id, data);
    }

    if (!habit) {
      this.habitDialog.showError('The habit could not be saved.');
      return;
    }

    if (!this.store.settings.onboarded) {
      this.store.setOnboarded(true);
      this.persistSettings();
    }

    const saved = this.persistHabits();
    this.habitDialog.close();
    this.render();

    if (saved) {
      this.toast.show(mode === 'create' ? 'Habit created.' : 'Changes saved.', { type: 'success' });
    }

    requestAnimationFrame(() => this.focusHabitRow(habit.id));
  }

  archiveHabit(habit) {
    const archived = this.store.archiveHabit(habit.id);
    if (!archived) return;

    this.persistHabits();
    this.habitDialog.close();
    this.render();
    this.toast.show('Habit archived.', {
      type: 'info',
      action: {
        label: 'Undo',
        onClick: () => {
          this.store.restoreHabit(habit.id);
          this.persistHabits();
          this.render();
          this.refreshSettings();
          this.toast.show('Habit restored.', { type: 'success' });
        }
      }
    });
  }

  requestDeleteHabit(habit, { fromSettings = false } = {}) {
    if (!habit) return;
    this.confirmDialog.open({
      title: 'Delete habit?',
      message: `“${habit.name}” and all of its check-ins, notes and rest days will be permanently deleted.`,
      confirmLabel: 'Delete habit',
      onConfirm: () => {
        this.storage.addSnapshot(this.store.habits, 'Before deleting a habit');
        const result = this.store.deleteHabit(habit.id);
        if (!result) return;

        this.persistHabits();
        this.habitDialog.close();
        this.render();
        this.refreshSettings();

        this.toast.show('Habit deleted.', {
          type: 'success',
          action: {
            label: 'Undo',
            onClick: () => {
              this.store.insertHabit(result.habit, result.index);
              this.persistHabits();
              this.render();
              this.refreshSettings();
              this.toast.show('Habit restored.', { type: 'success' });
            }
          }
        });

        if (fromSettings) this.settingsDialog.close();
        requestAnimationFrame(() => this.elements.addHabitButton.focus());
      }
    });
  }

  requestDeleteArchivedHabit(habitId) {
    const habit = this.store.find(habitId);
    if (!habit) return;
    this.settingsDialog.close();
    this.requestDeleteHabit(habit, { fromSettings: true });
  }

  restoreArchivedHabit(habitId) {
    const habit = this.store.restoreHabit(habitId);
    if (!habit) return;
    this.persistHabits();
    this.render();
    this.refreshSettings();
    this.toast.show('Habit restored.', { type: 'success' });
  }

  toggleToday(habitId, dateKey) {
    const result = this.store.toggleCompletion(habitId, dateKey);
    if (!result) return;
    this.persistHabits();
    this.render();
    this.restoreFocusAction('toggle', habitId);
  }

  adjustCount(habitId, dateKey, delta) {
    const result = this.store.adjustCount(habitId, dateKey, delta);
    if (!result) return;
    this.persistHabits();
    this.render();
    this.restoreFocusAction(delta > 0 ? 'inc' : 'dec', habitId);
  }

  openDayDialog(habitId, dateKey) {
    const habit = this.store.find(habitId);
    if (!habit) return;
    if (dateKey > this.currentDay || dateKey < habit.createdAt) return;
    this.dayDialog.open(habit, dateKey);
  }

  saveDayEntry(habit, dateKey, values) {
    this.store.setEntry(habit.id, dateKey, values);
    this.persistHabits();
    this.dayDialog.close();
    this.render();
    this.toast.show('Entry saved.', { type: 'success', duration: 1800 });
  }

  clearDayEntry(habit, dateKey) {
    this.store.clearEntry(habit.id, dateKey);
    this.persistHabits();
    this.dayDialog.close();
    this.render();
    this.toast.show('Entry cleared.', { type: 'info', duration: 1800 });
  }

  /* ------------------------------- data -------------------------------- */

  openImportPicker() {
    this.settingsDialog.close();
    this.elements.importInput.value = '';
    this.elements.importInput.click();
  }

  async handleImportFile(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (file.size > LIMITS.maxImportBytes) {
      this.toast.show(IMPORT_ERROR_MESSAGES['file-too-large'], { type: 'error' });
      return;
    }

    let text;
    try {
      text = await file.text();
    } catch (error) {
      this.toast.show('Could not read the selected file.', { type: 'error' });
      return;
    }

    let parsed;
    try {
      parsed = parseBackupText(text);
    } catch (error) {
      const message = error instanceof SchemaError
        ? IMPORT_ERROR_MESSAGES[error.code] || IMPORT_ERROR_MESSAGES['invalid-format']
        : IMPORT_ERROR_MESSAGES['invalid-format'];
      this.toast.show(message, { type: 'error' });
      return;
    }

    const { habits, summary } = parsed;
    const range = summary.earliest && summary.latest
      ? ` Dates in this file: ${summary.earliest} to ${summary.latest}.`
      : '';

    this.confirmDialog.open({
      title: 'Replace current data?',
      message: `Import ${summaryText(summary)}?${range} Your current habits and check-ins will be replaced.`,
      confirmLabel: 'Import data',
      onConfirm: () => {
        this.storage.addSnapshot(this.store.habits, 'Before import');
        const previous = this.store.habits;
        this.store.replaceHabits(habits);
        this.store.setOnboarded(true);
        this.persistHabits();
        this.persistSettings();
        this.renderAll();
        this.toast.show('Data imported.', {
          type: 'success',
          action: {
            label: 'Undo',
            onClick: () => {
              this.store.replaceHabits(previous);
              this.persistHabits();
              this.renderAll();
              this.toast.show('Previous data restored.', { type: 'success' });
            }
          }
        });
      }
    });
  }

  exportDataJSON() {
    try {
      exportJSON(this.store.habits);
      this.store.setLastBackupAt(new Date().toISOString());
      this.persistSettings();
      this.toast.show('Data exported.', { type: 'success' });
      this.refreshSettings();
    } catch (error) {
      this.toast.show('Could not create the export file.', { type: 'error' });
    }
  }

  exportDataCSV() {
    try {
      const rows = exportCSV(this.store.habits);
      this.toast.show(`CSV exported (${rows} rows).`, { type: 'success' });
    } catch (error) {
      this.toast.show('Could not create the CSV file.', { type: 'error' });
    }
  }

  downloadReminders() {
    const ok = exportReminders(this.store.activeHabits);
    if (!ok) {
      this.toast.show('Set a reminder time on at least one habit first.', { type: 'error' });
      return;
    }
    this.toast.show('Calendar reminders downloaded.', { type: 'success' });
  }

  requestClearAll() {
    this.settingsDialog.close();
    this.confirmDialog.open({
      title: 'Clear all data?',
      message: 'This removes every habit, check-in, note and reminder from this browser. A restore point will be created first.',
      confirmLabel: 'Clear data',
      onConfirm: () => {
        this.storage.addSnapshot(this.store.habits, 'Before clearing all data');
        const previous = this.store.habits;
        this.store.replaceHabits([]);
        this.store.setOnboarded(true);
        this.persistHabits();
        this.persistSettings();
        this.renderAll();
        this.toast.show('All data cleared.', {
          type: 'success',
          action: {
            label: 'Undo',
            onClick: () => {
              this.store.replaceHabits(previous);
              this.persistHabits();
              this.renderAll();
              this.toast.show('Data restored.', { type: 'success' });
            }
          }
        });
        requestAnimationFrame(() => this.elements.addHabitButton.focus());
      }
    });
  }

  restoreSnapshot(index) {
    const snapshot = this.storage.readSnapshots()[index];
    if (!snapshot) return;
    this.settingsDialog.close();

    this.confirmDialog.open({
      title: 'Restore this snapshot?',
      message: `Restore ${snapshot.habits.length} ${snapshot.habits.length === 1 ? 'habit' : 'habits'} from ${formatTimestamp(snapshot.at)}? Current data will be replaced.`,
      confirmLabel: 'Restore snapshot',
      onConfirm: () => {
        this.storage.addSnapshot(this.store.habits, 'Before restoring a snapshot');
        this.store.replaceHabits(snapshot.habits);
        this.store.setOnboarded(true);
        this.persistHabits();
        this.persistSettings();
        this.renderAll();
        this.toast.show('Snapshot restored.', { type: 'success' });
      }
    });
  }

  /* ----------------------------- settings ------------------------------ */

  openSettings() {
    this.settingsOpen = true;
    this.settingsDialog.open(this.buildSettingsData());
    this.storage.getEstimate().then(estimate => {
      this.storageEstimate = estimate;
      if (this.settingsOpen) this.refreshSettings();
    });
  }

  refreshSettings() {
    if (!this.settingsOpen) return;
    this.settingsDialog.refresh(this.buildSettingsData());
  }

  buildSettingsData() {
    return {
      settings: this.store.settings,
      snapshots: this.storage.readSnapshots(),
      archived: this.store.archivedHabits,
      backupAt: this.store.settings.lastBackupAt,
      activeHabits: this.store.activeHabits,
      storage: {
        available: this.storage.available,
        persisted: this.storagePersisted,
        estimate: this.storageEstimate
      },
      installAvailable: Boolean(this.installPrompt),
      isStandalone: this.isStandalone
    };
  }

  async promptInstall() {
    if (!this.installPrompt) return;
    const prompt = this.installPrompt;
    this.installPrompt = null;
    prompt.prompt();
    try {
      await prompt.userChoice;
    } catch (error) {
      // The user dismissed the prompt; that's fine.
    }
    this.refreshSettings();
  }

  async requestPersistence() {
    const persisted = await this.storage.requestPersistence();
    this.storagePersisted = persisted;
    this.toast.show(
      persisted ? 'Persistent storage enabled.' : 'The browser did not grant persistent storage.',
      { type: persisted ? 'success' : 'info' }
    );
    this.refreshSettings();
  }

  /* ---------------------------- persistence ---------------------------- */

  persistHabits() {
    const saved = this.storage.writeState(this.store.habits);
    if (saved) this.storageErrorShown = false;
    else this.reportStorageError();
    return saved;
  }

  persistSettings() {
    const saved = this.storage.writeSettings(this.store.settings);
    if (saved) this.storageErrorShown = false;
    else this.reportStorageError();
    return saved;
  }

  reportStorageError() {
    if (this.storageErrorShown) return;
    this.storageErrorShown = true;
    this.toast.show('Could not save changes in this browser.', { type: 'error', duration: 6500 });
  }

  /* --------------------------- cross-tab sync -------------------------- */

  handleStorageEvent(event) {
    if (event.key === STORAGE_KEYS.state) {
      const result = this.storage.readState();
      if (result.habits) {
        this.store.replaceHabits(result.habits);
        this.render();
        this.refreshSettings();
        this.toast.show('Synced changes from another tab.', { type: 'info', duration: 2500 });
      }
      return;
    }

    if (event.key === STORAGE_KEYS.settings) {
      const settings = this.storage.readSettings();
      this.store.settings.theme = settings.theme;
      this.store.settings.lastBackupAt = settings.lastBackupAt;
      this.store.settings.onboarded = settings.onboarded;
      if (settings.onboarded) {
        this.onboardingDialog.close();
      }
      this.applyTheme();
      this.refreshSettings();
    }
  }

  /* ----------------------------- focus/UI ------------------------------ */

  restoreFocusAction(action, habitId) {
    requestAnimationFrame(() => {
      const elements = Array.from(this.elements.main.querySelectorAll(`[data-action="${action}"]`));
      const target = elements.find(element => element.dataset.habitId === habitId);
      if (target && !target.disabled) target.focus();
    });
  }

  focusAction(action) {
    requestAnimationFrame(() => {
      const target = this.elements.main.querySelector(`[data-action="${action}"]`);
      if (target && !target.disabled) target.focus();
    });
  }

  focusHabitRow(habitId) {
    const candidates = Array.from(this.elements.main.querySelectorAll('[data-habit-id]'))
      .filter(element => element.dataset.habitId === habitId);

    for (const candidate of candidates) {
      if (candidate.matches('button') && !candidate.disabled) {
        candidate.focus();
        return;
      }
      if (!candidate.matches('button')) {
        const control = candidate.querySelector('button:not(:disabled)');
        if (control) {
          control.focus();
          return;
        }
      }
    }

    this.elements.addHabitButton.focus();
  }

  updateCalendarScrollHint() {
    if (this.currentView !== 'calendar') return;
    const scroller = this.elements.calendarView.querySelector('#calendar-scroll');
    const hint = this.elements.calendarView.querySelector('#calendar-scroll-hint');
    if (!scroller || !hint) return;
    hint.hidden = scroller.scrollWidth <= scroller.clientWidth + 2;
  }

  scrollCalendarToToday() {
    if (this.currentView !== 'calendar') return;
    const scroller = this.elements.calendarView.querySelector('#calendar-scroll');
    const cell = this.elements.calendarView.querySelector('.day-cell.is-today');
    const sticky = this.elements.calendarView.querySelector('.habit-row-label');
    if (!scroller || !cell) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const visibleLeft = scrollerRect.left + (sticky ? sticky.getBoundingClientRect().width : 0);
    if (cellRect.left < visibleLeft || cellRect.right > scrollerRect.right) {
      scroller.scrollLeft += cellRect.left - visibleLeft - 8;
    }
    this.updateCalendarScrollHint();
  }
}

function currentMonthView() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthKeyOf(view) {
  return `${view.year}-${String(view.month + 1).padStart(2, '0')}`;
}
