export class ConfirmDialog {
  constructor() {
    this.dialog = document.getElementById('confirm-dialog');
    this.titleElement = document.getElementById('confirm-title');
    this.messageElement = document.getElementById('confirm-message');
    this.cancelButton = document.getElementById('confirm-cancel');
    this.acceptButton = document.getElementById('confirm-accept');
    this.onConfirm = null;
    this.onCancel = null;

    this.cancelButton.addEventListener('click', () => this.cancel());
    this.acceptButton.addEventListener('click', () => this.confirm());
    this.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      this.cancel();
    });
    this.dialog.addEventListener('click', event => {
      if (event.target === this.dialog) this.cancel();
    });
  }

  open({ title, message, confirmLabel = 'Confirm', danger = true, onConfirm, onCancel }) {
    this.titleElement.textContent = title;
    this.messageElement.textContent = message;
    this.acceptButton.textContent = confirmLabel;
    this.acceptButton.className = `button ${danger ? 'button--danger' : 'button--primary'}`;
    this.onConfirm = onConfirm || null;
    this.onCancel = onCancel || null;

    if (!this.dialog.open) this.dialog.showModal();
    requestAnimationFrame(() => this.cancelButton.focus());
  }

  confirm() {
    if (!this.dialog.open) return;
    const action = this.onConfirm;
    this.onConfirm = null;
    this.onCancel = null;
    this.dialog.close();
    if (action) action();
  }

  cancel() {
    if (!this.dialog.open) return;
    const action = this.onCancel;
    this.onConfirm = null;
    this.onCancel = null;
    this.dialog.close();
    if (action) action();
  }
}
