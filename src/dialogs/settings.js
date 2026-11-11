import { ICONS } from '../icons.js';
import { escapeHtml, formatNumber, formatTimestamp } from '../dates.js';
import { APP_VERSION } from '../constants.js';

export class SettingsDialog {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.dialog = document.getElementById('settings-dialog');
    this.closeButton = document.getElementById('settings-close');
    this.content = document.getElementById('settings-content');
    this.data = null;

    this.closeButton.addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      this.close();
    });
    this.dialog.addEventListener('click', event => {
      if (event.target === this.dialog) this.close();
    });
    this.dialog.addEventListener('close', () => {
      this.callbacks.onClose?.();
    });
    this.content.addEventListener('click', event => this.handleClick(event));
  }

  open(data) {
    this.data = data;
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
    requestAnimationFrame(() => this.closeButton.focus());
  }

  refresh(data) {
    this.data = data;
    if (this.dialog.open) this.render();
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  handleClick(event) {
    const button = event.target.closest('[data-settings-action]');
    if (!button) return;
    const action = button.dataset.settingsAction;

    switch (action) {
      case 'theme':
        if (this.data) this.data.settings.theme = button.dataset.theme;
        this.updateThemeButtons();
        this.callbacks.onThemeChange?.(button.dataset.theme);
        break;
      case 'export-json':
        this.callbacks.onExportJSON?.();
        break;
      case 'export-csv':
        this.callbacks.onExportCSV?.();
        break;
      case 'import':
        this.callbacks.onImport?.();
        break;
      case 'clear':
        this.callbacks.onClear?.();
        break;
      case 'ics':
        this.callbacks.onDownloadICS?.();
        break;
      case 'install':
        this.callbacks.onInstall?.();
        break;
      case 'persist':
        this.callbacks.onRequestPersist?.();
        break;
      case 'restore-snapshot':
        this.callbacks.onRestoreSnapshot?.(Number(button.dataset.index));
        break;
      case 'restore-habit':
        this.callbacks.onRestoreHabit?.(button.dataset.habitId);
        break;
      case 'delete-habit':
        this.callbacks.onDeleteHabit?.(button.dataset.habitId);
        break;
      default:
        break;
    }
  }

  updateThemeButtons() {
    this.content.querySelectorAll('[data-settings-action="theme"]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.theme === this.data?.settings.theme));
      button.classList.toggle('is-active', button.dataset.theme === this.data?.settings.theme);
    });
  }

  render() {
    if (!this.data) return;
    const {
      settings,
      snapshots = [],
      archived = [],
      backupAt = null,
      storage = {},
      activeHabits = []
    } = this.data;

    const reminderCount = activeHabits.filter(habit => habit.reminder?.enabled).length;
    const snapshotHtml = snapshots.length
      ? snapshots.map((snapshot, index) => `<li class="list-row">
          <div class="list-row-main">
            <strong>${escapeHtml(snapshot.reason)}</strong>
            <span>${escapeHtml(formatTimestamp(snapshot.at))} · ${snapshot.habits.length} ${snapshot.habits.length === 1 ? 'habit' : 'habits'}</span>
          </div>
          <button class="button button--ghost button--small" type="button" data-settings-action="restore-snapshot" data-index="${index}">Restore</button>
        </li>`).join('')
      : '<li class="list-empty">Snapshots are created before destructive actions.</li>';

    const archivedHtml = archived.length
      ? archived.map(habit => `<li class="list-row">
          <div class="list-row-main">
            <strong><span aria-hidden="true">${escapeHtml(habit.emoji)}</span> ${escapeHtml(habit.name)}</strong>
            <span>Archived ${escapeHtml(habit.archivedAt || '')}</span>
          </div>
          <div class="list-row-actions">
            <button class="button button--ghost button--small" type="button" data-settings-action="restore-habit" data-habit-id="${escapeHtml(habit.id)}">Restore</button>
            <button class="button button--ghost button--small button--danger-quiet" type="button" data-settings-action="delete-habit" data-habit-id="${escapeHtml(habit.id)}">Delete</button>
          </div>
        </li>`).join('')
      : '<li class="list-empty">No archived habits.</li>';

    const installHtml = this.data.isStandalone
      ? '<span class="status-pill status-pill--ok">Installed</span>'
      : this.data.installAvailable
        ? `<button class="button button--primary button--small" type="button" data-settings-action="install">${ICONS.download}<span>Install app</span></button>`
        : '<span class="settings-muted">Use your browser’s “Install app” or “Add to Home Screen” option.</span>';

    const persistenceHtml = storage.persisted
      ? '<span class="status-pill status-pill--ok">Persistent</span>'
      : storage.available
        ? `<button class="button button--ghost button--small" type="button" data-settings-action="persist">Request persistence</button>`
        : '<span class="status-pill status-pill--warn">Unavailable</span>';

    const usageHtml = storage.estimate?.usage
      ? `${formatNumber(Math.round(storage.estimate.usage / 1024))} KB used${storage.estimate.quota ? ` of ${formatNumber(Math.round(storage.estimate.quota / 1024 / 1024))} MB` : ''}`
      : 'Stored locally in this browser';

    this.content.innerHTML = `
      <section class="settings-section">
        <div class="settings-section-head">
          <h3>Appearance</h3>
          <p>Choose how HabiStride looks.</p>
        </div>
        <div class="segmented segmented--theme" role="group" aria-label="Theme">
          <button class="segmented-button${settings.theme === 'system' ? ' is-active' : ''}" type="button" data-settings-action="theme" data-theme="system" aria-pressed="${settings.theme === 'system'}">System</button>
          <button class="segmented-button${settings.theme === 'light' ? ' is-active' : ''}" type="button" data-settings-action="theme" data-theme="light" aria-pressed="${settings.theme === 'light'}">Light</button>
          <button class="segmented-button${settings.theme === 'dark' ? ' is-active' : ''}" type="button" data-settings-action="theme" data-theme="dark" aria-pressed="${settings.theme === 'dark'}">Dark</button>
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section-head">
          <h3>Reminders</h3>
          <p>Download your habit reminders as a calendar file. Reminder times live inside each habit.</p>
        </div>
        <div class="settings-row">
          <span class="settings-muted">${reminderCount ? `${reminderCount} ${reminderCount === 1 ? 'habit has' : 'habits have'} a reminder time.` : 'No reminder times set yet.'}</span>
          <button class="button button--ghost button--small" type="button" data-settings-action="ics"${reminderCount ? '' : ' disabled'}>${ICONS.download}<span>Download .ics</span></button>
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section-head">
          <h3>Backup & data</h3>
          <p>Your data never leaves this browser unless you export it.</p>
        </div>
        <div class="settings-data-grid">
          <div class="settings-stat">
            <span class="settings-stat-label">Last backup</span>
            <strong>${escapeHtml(backupAt ? formatTimestamp(backupAt) : 'Never')}</strong>
          </div>
          <div class="settings-stat">
            <span class="settings-stat-label">Active habits</span>
            <strong>${activeHabits.length}</strong>
          </div>
        </div>
        <div class="settings-button-row">
          <button class="button button--primary button--small" type="button" data-settings-action="export-json">${ICONS.download}<span>Export JSON</span></button>
          <button class="button button--ghost button--small" type="button" data-settings-action="export-csv">Export CSV</button>
          <button class="button button--ghost button--small" type="button" data-settings-action="import">${ICONS.upload}<span>Import JSON</span></button>
        </div>
        <div class="settings-subsection">
          <div class="settings-subsection-head">
            <h4>Restore points</h4>
            <span>Latest ${snapshots.length ? snapshots.length : '—'}</span>
          </div>
          <ul class="settings-list">${snapshotHtml}</ul>
        </div>
        <div class="settings-danger-row">
          <div>
            <strong>Clear all data</strong>
            <p>Remove every habit, check-in and note from this browser.</p>
          </div>
          <button class="button button--danger-quiet button--small" type="button" data-settings-action="clear">Clear data</button>
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section-head">
          <h3>Archived habits</h3>
          <p>Archived habits are hidden from Today and Calendar. Their history is preserved.</p>
        </div>
        <ul class="settings-list">${archivedHtml}</ul>
      </section>

      <section class="settings-section">
        <div class="settings-section-head">
          <h3>Keyboard shortcuts</h3>
          <p>Navigate and log habits without leaving the keyboard.</p>
        </div>
        <div class="shortcut-grid">
          <div class="shortcut-item"><span>Switch views</span><span class="kbd-group"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd></span></div>
          <div class="shortcut-item"><span>New habit</span><kbd>N</kbd></div>
          <div class="shortcut-item"><span>Toggle theme</span><kbd>T</kbd></div>
          <div class="shortcut-item"><span>Close dialog</span><kbd>Esc</kbd></div>
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section-head">
          <h3>App & storage</h3>
          <p>Install HabiStride for a focused, offline-friendly daily ritual.</p>
        </div>
        <div class="settings-row">
          <span class="settings-muted">Installation</span>
          ${installHtml}
        </div>
        <div class="settings-row">
          <span class="settings-muted">Storage</span>
          <span class="settings-status">${persistenceHtml}<span class="settings-caption">${escapeHtml(usageHtml)}</span></span>
        </div>
        <div class="settings-about">
          <span class="settings-version">HabiStride v${APP_VERSION}</span>
          <span>No account. No tracking. Local-first.</span>
        </div>
      </section>
    `;
  }
}
