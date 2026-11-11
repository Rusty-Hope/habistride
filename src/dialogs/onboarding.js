export class OnboardingDialog {
  constructor({ onStartFresh, onLoadDemo }) {
    this.dialog = document.getElementById('onboarding-dialog');
    this.freshButton = document.getElementById('onboarding-fresh');
    this.demoButton = document.getElementById('onboarding-demo');
    this.onStartFresh = onStartFresh;
    this.onLoadDemo = onLoadDemo;

    this.freshButton.addEventListener('click', () => {
      this.close();
      this.onStartFresh?.();
    });

    this.demoButton.addEventListener('click', () => {
      this.close();
      this.onLoadDemo?.();
    });

    this.dialog.addEventListener('cancel', event => {
      event.preventDefault();
      this.close();
      this.onStartFresh?.();
    });
  }

  open() {
    if (!this.dialog.open) this.dialog.showModal();
    requestAnimationFrame(() => this.freshButton.focus());
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }
}
