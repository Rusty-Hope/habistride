import { COLORS, EMOJIS, LIMITS, TEMPLATES, WEEKDAYS } from '../constants.js';
import { contrastColor, escapeHtml, formatNumber, todayKey } from '../dates.js';
import { getScheduleLabel } from '../schedule.js';
import { ICONS } from '../icons.js';

export class HabitDialog {
  constructor() {
    this.dialog = document.getElementById('habit-dialog');
    this.form = document.getElementById('habit-form');
    this.titleElement = document.getElementById('habit-dialog-title');
    this.nameInput = document.getElementById('habit-name');
    this.errorElement = document.getElementById('habit-form-error');
    this.emojiOptions = document.getElementById('habit-emoji-options');
    this.colorOptions = document.getElementById('habit-color-options');
    this.templateList = document.getElementById('habit-template-list');
    this.templateSection = document.getElementById('habit-template-section');
    this.goalType = document.getElementById('habit-goal-type');
    this.countFields = document.getElementById('habit-count-fields');
    this.targetInput = document.getElementById('habit-target');
    this.unitInput = document.getElementById('habit-unit');
    this.scheduleType = document.getElementById('habit-schedule-type');
    this.weekdayField = document.getElementById('habit-weekday-field');
    this.weekdayOptions = document.getElementById('habit-weekday-options');
    this.timesField = document.getElementById('habit-times-field');
    this.timesInput = document.getElementById('habit-times');
    this.intervalField = document.getElementById('habit-interval-field');
    this.intervalInput = document.getElementById('habit-interval');
    this.startInput = document.getElementById('habit-start');
    this.reminderEnabled = document.getElementById('habit-reminder-enabled');
    this.reminderTime = document.getElementById('habit-reminder-time');
    this.archiveButton = document.getElementById('habit-archive');
    this.deleteButton = document.getElementById('habit-delete');
    this.cancelButton = document.getElementById('habit-cancel');
    this.closeButton = document.getElementById('habit-close');
    this.saveButton = document.getElementById('habit-save');

    this.mode = 'create';
    this.currentHabit = null;
    this.selectedEmoji = EMOJIS[0];
    this.selectedColor = COLORS[0].value;
    this.selectedWeekdays = new Set([0, 1, 2, 3, 4]);
    this.onSubmit = null;
    this.onDelete = null;
    this.onArchive = null;

    this.startInput.max = todayKey();

    this.bindEvents();
  }

  bindEvents() {
    this.form.addEventListener('submit', event => this.handleSubmit(event));
    this.nameInput.addEventListener('input', () => this.clearError());
    [this.targetInput, this.timesInput, this.intervalInput, this.reminderTime].forEach(input => {
      input.addEventListener('input', () => this.clearError());
    });
    this.goalType.addEventListener('change', () => this.updateVisibility());
    this.scheduleType.addEventListener('change', () => this.updateVisibility());
    this.reminderEnabled.addEventListener('change', () => this.updateVisibility());
    this.cancelButton.addEventListener('click', () => this.close());
    this.closeButton.addEventListener('click', () => this.close());

    this.archiveButton.addEventListener('click', () => {
      if (this.currentHabit && typeof this.onArchive === 'function') {
        this.onArchive(this.currentHabit);
      }
    });

    this.deleteButton.addEventListener('click', () => {
      if (this.currentHabit && typeof this.onDelete === 'function') {
        this.onDelete(this.currentHabit);
      }
    });

    this.emojiOptions.addEventListener('click', event => {
      const button = event.target.closest('[data-emoji]');
      if (!button) return;
      this.selectedEmoji = button.dataset.emoji;
      this.syncOptions();
    });

    this.colorOptions.addEventListener('click', event => {
      const button = event.target.closest('[data-color]');
      if (!button) return;
      this.selectedColor = button.dataset.color;
      this.syncOptions();
    });

    this.weekdayOptions.addEventListener('click', event => {
      const button = event.target.closest('[data-weekday]');
      if (!button) return;
      const day = Number(button.dataset.weekday);
      if (this.selectedWeekdays.has(day)) this.selectedWeekdays.delete(day);
      else this.selectedWeekdays.add(day);
      this.syncWeekdays();
    });

    this.templateList.addEventListener('click', event => {
      const button = event.target.closest('[data-template-id]');
      if (!button) return;
      const template = TEMPLATES.find(item => item.id === button.dataset.templateId);
      if (!template) return;
      this.applyTemplate(template);
    });

    this.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      this.close();
    });

    this.dialog.addEventListener('click', event => {
      if (event.target === this.dialog) this.close();
    });
  }

  openCreate(habits = []) {
    this.mode = 'create';
    this.currentHabit = null;

    this.selectedEmoji = EMOJIS.find(emoji => !habits.some(habit => habit.emoji === emoji)) || EMOJIS[0];
    this.selectedColor = COLORS.find(color => !habits.some(habit => habit.color === color.value))?.value || COLORS[0].value;
    this.selectedWeekdays = new Set([0, 1, 2, 3, 4]);

    this.nameInput.value = '';
    this.goalType.value = 'binary';
    this.targetInput.value = '1';
    this.unitInput.value = '';
    this.scheduleType.value = 'daily';
    this.timesInput.value = '3';
    this.intervalInput.value = '2';
    const today = todayKey();
    this.startInput.max = today;
    this.startInput.value = today;
    this.reminderEnabled.checked = false;
    this.reminderTime.value = '09:00';
    this.dialogTitle('New habit');
    this.saveButton.textContent = 'Create habit';
    this.deleteButton.hidden = true;
    this.archiveButton.hidden = true;
    this.templateSection.hidden = false;
    this.clearError();
    this.renderOptions();
    this.renderTemplates();
    this.updateVisibility();
    this.open();
  }

  openEdit(habit) {
    this.mode = 'edit';
    this.currentHabit = habit;
    this.selectedEmoji = habit.emoji;
    this.selectedColor = habit.color;
    this.selectedWeekdays = new Set(habit.schedule.weekdays);

    this.nameInput.value = habit.name;
    this.goalType.value = habit.goal.type;
    this.targetInput.value = String(habit.goal.type === 'count' ? habit.goal.target : 1);
    this.unitInput.value = habit.goal.unit || '';
    this.scheduleType.value = habit.schedule.type;
    this.timesInput.value = String(habit.schedule.timesPerWeek);
    this.intervalInput.value = String(habit.schedule.intervalDays);
    this.startInput.max = todayKey();
    this.startInput.value = habit.createdAt;
    this.reminderEnabled.checked = Boolean(habit.reminder.enabled);
    this.reminderTime.value = habit.reminder.time || '09:00';

    this.dialogTitle('Edit habit');
    this.saveButton.textContent = 'Save changes';
    this.deleteButton.hidden = false;
    this.archiveButton.hidden = Boolean(habit.archivedAt);
    this.templateSection.hidden = true;
    this.clearError();
    this.renderOptions();
    this.renderTemplates();
    this.updateVisibility();
    this.open();
    requestAnimationFrame(() => this.nameInput.select());
  }

  dialogTitle(text) {
    this.titleElement.textContent = text;
  }

  open() {
    if (!this.dialog.open) this.dialog.showModal();
    requestAnimationFrame(() => this.nameInput.focus());
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  renderOptions() {
    this.emojiOptions.innerHTML = EMOJIS.map(emoji => {
      return `<button class="emoji-button" type="button" data-emoji="${escapeHtml(emoji)}" aria-label="${escapeHtml(emoji)} icon" aria-pressed="${emoji === this.selectedEmoji}">${escapeHtml(emoji)}</button>`;
    }).join('');

    this.colorOptions.innerHTML = COLORS.map(color => {
      return `<button class="color-button" type="button" data-color="${color.value}" aria-label="${escapeHtml(color.name)}" aria-pressed="${color.value === this.selectedColor}" style="--swatch:${color.value};color:${contrastColor(color.value)}">${ICONS.check}</button>`;
    }).join('');

    this.renderWeekdays();
  }

  renderTemplates() {
    this.templateList.innerHTML = TEMPLATES.map(template => {
      const details = [
        getScheduleLabel({ schedule: template.schedule }),
        template.goal.type === 'count'
          ? `${formatNumber(template.goal.target)} ${template.goal.unit}`
          : 'Check off'
      ].join(' · ');
      return `<button class="template-card" type="button" data-template-id="${template.id}">
        <span class="template-icon" style="--habit-color:${template.color}" aria-hidden="true">${template.emoji}</span>
        <span class="template-copy"><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(details)}</small></span>
      </button>`;
    }).join('');
  }

  renderWeekdays() {
    this.weekdayOptions.innerHTML = WEEKDAYS.map(day => {
      return `<button class="weekday-button" type="button" data-weekday="${day.value}" aria-pressed="${this.selectedWeekdays.has(day.value)}">${day.short}</button>`;
    }).join('');
  }

  syncOptions() {
    this.emojiOptions.querySelectorAll('[data-emoji]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.emoji === this.selectedEmoji));
    });
    this.colorOptions.querySelectorAll('[data-color]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.color === this.selectedColor));
    });
  }

  syncWeekdays() {
    this.weekdayOptions.querySelectorAll('[data-weekday]').forEach(button => {
      button.setAttribute('aria-pressed', String(this.selectedWeekdays.has(Number(button.dataset.weekday))));
    });
  }

  applyTemplate(template) {
    this.selectedEmoji = template.emoji;
    this.selectedColor = template.color;
    this.selectedWeekdays = new Set(template.schedule.weekdays);
    this.nameInput.value = template.name;
    this.goalType.value = template.goal.type;
    this.targetInput.value = String(template.goal.type === 'count' ? template.goal.target : 1);
    this.unitInput.value = template.goal.unit || '';
    this.scheduleType.value = template.schedule.type;
    this.timesInput.value = String(template.schedule.timesPerWeek);
    this.intervalInput.value = String(template.schedule.intervalDays);
    this.startInput.value = todayKey();
    this.reminderEnabled.checked = false;
    this.reminderTime.value = '09:00';
    this.clearError();
    this.syncOptions();
    this.syncWeekdays();
    this.updateVisibility();
    requestAnimationFrame(() => this.nameInput.focus());
  }

  updateVisibility() {
    const isCount = this.goalType.value === 'count';
    const scheduleType = this.scheduleType.value;
    this.countFields.hidden = !isCount;
    this.weekdayField.hidden = scheduleType !== 'weekdays';
    this.timesField.hidden = scheduleType !== 'weekly';
    this.intervalField.hidden = scheduleType !== 'interval';
    this.reminderTime.disabled = !this.reminderEnabled.checked;
  }

  handleSubmit(event) {
    event.preventDefault();
    this.clearError();

    const name = this.nameInput.value.trim().replace(/\s+/g, ' ').slice(0, LIMITS.maxNameLength);
    if (!name) {
      this.nameInput.setAttribute('aria-invalid', 'true');
      this.showError('Give your habit a name.', this.nameInput);
      return;
    }

    const goalType = this.goalType.value === 'count' ? 'count' : 'binary';
    let target = 1;
    let unit = '';
    if (goalType === 'count') {
      target = Number(this.targetInput.value);
      if (!Number.isFinite(target) || target <= 0 || target > 1000000) {
        this.targetInput.setAttribute('aria-invalid', 'true');
        this.showError('Target must be a number greater than zero.', this.targetInput);
        return;
      }
      unit = this.unitInput.value.trim().slice(0, LIMITS.maxUnitLength);
    }

    const scheduleType = this.scheduleType.value;
    let weekdays = [...this.selectedWeekdays].sort((a, b) => a - b);
    let timesPerWeek = 3;
    let intervalDays = 2;

    if (scheduleType === 'weekdays') {
      if (!weekdays.length) {
        this.showError('Pick at least one day of the week.', this.weekdayOptions.querySelector('button'));
        return;
      }
    } else {
      weekdays = [0, 1, 2, 3, 4, 5, 6];
    }

    if (scheduleType === 'weekly') {
      timesPerWeek = Number(this.timesInput.value);
      if (!Number.isInteger(timesPerWeek) || timesPerWeek < 1 || timesPerWeek > 7) {
        this.timesInput.setAttribute('aria-invalid', 'true');
        this.showError('Weekly target must be between 1 and 7.', this.timesInput);
        return;
      }
    }

    if (scheduleType === 'interval') {
      intervalDays = Number(this.intervalInput.value);
      if (!Number.isInteger(intervalDays) || intervalDays < 2 || intervalDays > 365) {
        this.intervalInput.setAttribute('aria-invalid', 'true');
        this.showError('Interval must be between 2 and 365 days.', this.intervalInput);
        return;
      }
    }

    if (this.reminderEnabled.checked && !this.reminderTime.value) {
      this.reminderTime.setAttribute('aria-invalid', 'true');
      this.showError('Pick a reminder time or turn reminders off.', this.reminderTime);
      return;
    }

    let startDate = this.startInput.value || todayKey();
    if (startDate > todayKey()) startDate = todayKey();

    if (typeof this.onSubmit === 'function') {
      this.onSubmit({
        name,
        emoji: this.selectedEmoji,
        color: this.selectedColor,
        goal: { type: goalType, target, unit },
        schedule: { type: scheduleType, weekdays, timesPerWeek, intervalDays },
        startDate,
        reminder: {
          enabled: this.reminderEnabled.checked,
          time: this.reminderTime.value || null
        }
      }, this.currentHabit, this.mode);
    }
  }

  showError(message, focusElement = null) {
    this.errorElement.textContent = message;
    this.errorElement.hidden = false;
    if (focusElement) focusElement.focus();
  }

  clearError() {
    this.errorElement.textContent = '';
    this.errorElement.hidden = true;
    [this.nameInput, this.targetInput, this.timesInput, this.intervalInput, this.reminderTime]
      .forEach(input => input.removeAttribute('aria-invalid'));
  }
}
