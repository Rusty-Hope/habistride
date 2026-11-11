import { ICONS } from './icons.js';

const TYPE_DURATIONS = {
  success: 3000,
  info: 3500,
  error: 5500
};

export class ToastManager {
  constructor(region, { onDismiss } = {}) {
    this.region = region;
    this.onDismiss = onDismiss || null;
    this.timers = new WeakMap();
  }

  show(message, { type = 'success', action = null, duration } = {}) {
    if (!message) return null;
    const safeType = ['success', 'error', 'info'].includes(type) ? type : 'info';

    while (this.region.children.length >= 3) {
      const first = this.region.firstElementChild;
      if (!first) break;
      const timer = this.timers.get(first);
      if (timer) clearTimeout(timer);
      first.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${safeType}`;
    toast.setAttribute('role', safeType === 'error' ? 'alert' : 'status');

    const dot = document.createElement('span');
    dot.className = 'toast-dot';
    dot.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;

    toast.append(dot, text);

    if (action && typeof action.onClick === 'function') {
      const actionButton = document.createElement('button');
      actionButton.type = 'button';
      actionButton.className = 'toast-action';
      actionButton.textContent = action.label || 'Undo';
      actionButton.addEventListener('click', () => {
        this.dismiss(toast);
        action.onClick();
      });
      toast.append(actionButton);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.innerHTML = ICONS.close;
    close.addEventListener('click', () => this.dismiss(toast));
    toast.append(close);

    this.region.append(toast);

    const lifetime = duration || (action ? 6500 : TYPE_DURATIONS[safeType]);
    const timer = setTimeout(() => this.dismiss(toast), lifetime);
    this.timers.set(toast, timer);

    return toast;
  }

  dismiss(toast) {
    if (!toast || !toast.isConnected || toast.classList.contains('is-leaving')) return;
    const timer = this.timers.get(toast);
    if (timer) clearTimeout(timer);
    this.timers.delete(toast);
    toast.classList.add('is-leaving');
    setTimeout(() => {
      toast.remove();
      if (this.onDismiss) this.onDismiss();
    }, 160);
  }

  clear() {
    [...this.region.children].forEach(toast => this.dismiss(toast));
  }
}
