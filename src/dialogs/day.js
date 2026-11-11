import {
  formatDateKey,
  formatNumber,
  todayKey
} from '../dates.js';
import { getGoalLabel, getLogValue, getScheduleLabel, isDoneOn, isSkippedOn } from '../schedule.js';
import { LIMITS } from '../constants.js';

export class DayDialog {
  constructor() {
    this.dialog = document.getElementById('day-dialog');
    this.form = document.getElementById('day-form');
    this.titleElement = document.getElementById('day-dialog-title');
    this.subtitleElement = document.getElementById('day-dialog-subtitle');
    this.metaElement = document.getElementById('day-meta');
    this.closeButton = document.getElementById('day-close');
    this.cancelButton = document.getElementById('day-cancel');
    this.clearButton = document.getElementById('day-clear');
    this.saveButton = document.getElementById('day-save');
    this.binaryField = document.getElementById('day-binary-field');
    this.completedInput = document.getElementById('day-completed');
    this.countField = document.getElementById('day-count-field');
    this.countInput = document.getElementById('day-count');
    this.countGoal = document.getElementById('day-count-goal');
    this.decrementButton = document.getElementById('day-dec');
    this.incrementButton = document.getElementById('day-inc');
    this.skipInput = document.getElementById('day-skip');
    this.noteInput = document.getElementById('day-note');
    this.errorElement = document.getElementById('day-form-error');

    this.habit = null;
    this.dateKey = null;
    this.onSave = null;
    this.onClear = null;

    this.bindEvents();
  }

  bindEvents() {
    this.form.addEventListener('submit', event => this.handleSubmit(event));
    this.closeButton.addEventListener('click', () => this.close());
    this.cancelButton.addEventListener('click', () => this.close());
    this.clearButton.addEventListener('click', () => {
      if (this.habit && this.dateKey && typeof this.onClear === 'function') {
        this.onClear(this.habit, this.dateKey);
      }
    });
    this.skipInput.addEventListener('change', () => this.syncDisabledState());
    this.countInput.addEventListener('input', () => {
      this.syncDisabledState();
      this.countInput.removeAttribute('aria-invalid');
      this.errorElement.hidden = true;
    });
    this.decrementButton.addEventListener('click', () => this.step(-1));
    this.incrementButton.addEventListener('click', () => this.step(1));
    this.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      this.close();
    });
    this.dialog.addEventListener('click', event => {
      if (event.target === this.dialog) this.close();
    });
  }

  open(habit, dateKey) {
    this.habit = habit;
    this.dateKey = dateKey;
    this.errorElement.hidden = true;
    this.errorElement.textContent = '';
    this.countInput.removeAttribute('aria-invalid');

    const isCount = habit.goal.type === 'count';
    this.binaryField.hidden = isCount;
    this.countField.hidden = !isCount;
    this.completedInput.checked = !isCount && isDoneOn(habit, dateKey);
    this.countInput.value = String(getLogValue(habit, dateKey));
    this.countInput.max = '10000000';
    this.countGoal.textContent = isCount ? `of ${formatNumber(habit.goal.target)}${habit.goal.unit ? ` ${habit.goal.unit}` : ''}` : '';
    this.skipInput.checked = isSkippedOn(habit, dateKey);
    this.noteInput.value = habit.notes?.[dateKey] || '';
    this.noteInput.maxLength = LIMITS.maxNoteLength;

    this.titleElement.textContent = habit.name;
    this.subtitleElement.textContent = dateKey === todayKey()
      ? `Today · ${formatDateKey(dateKey)}`
      : formatDateKey(dateKey);
    this.metaElement.textContent = `${getScheduleLabel(habit)} · ${getGoalLabel(habit)}`;

    const hasEntry = Object.prototype.hasOwnProperty.call(habit.logs, dateKey) ||
      Object.prototype.hasOwnProperty.call(habit.skips, dateKey) ||
      Object.prototype.hasOwnProperty.call(habit.notes, dateKey);
    this.clearButton.hidden = !hasEntry;

    this.syncDisabledState();
    if (!this.dialog.open) this.dialog.showModal();
    requestAnimationFrame(() => {
      if (isCount) this.countInput.focus();
      else this.completedInput.focus();
    });
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  step(delta) {
    const current = Number(this.countInput.value) || 0;
    const next = Math.max(0, Math.round(current + delta));
    this.countInput.value = String(next);
    this.syncDisabledState();
  }

  syncDisabledState() {
    const skipped = this.skipInput.checked;
    this.completedInput.disabled = skipped;
    this.countInput.disabled = skipped;
    this.decrementButton.disabled = skipped || Number(this.countInput.value) <= 0;
    this.incrementButton.disabled = skipped;
  }

  handleSubmit(event) {
    event.preventDefault();
    if (!this.habit || !this.dateKey) return;

    const skipped = this.skipInput.checked;
    const isCount = this.habit.goal.type === 'count';
    let value = 0;
    let completed = false;

    if (!skipped) {
      if (isCount) {
        value = Number(this.countInput.value);
        if (!Number.isFinite(value) || value < 0 || value > 10000000) {
          this.countInput.setAttribute('aria-invalid', 'true');
          this.showError('Count must be between 0 and 10,000,000.');
          this.countInput.focus();
          return;
        }
        value = Math.round(value);
      } else {
        completed = this.completedInput.checked;
      }
    }

    if (typeof this.onSave === 'function') {
      this.onSave(this.habit, this.dateKey, {
        completed,
        value,
        skipped,
        note: this.noteInput.value
      });
    }
  }

  showError(message) {
    this.errorElement.textContent = message;
    this.errorElement.hidden = false;
  }
}
