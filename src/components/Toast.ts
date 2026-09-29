export type ToastType = 'success' | 'error' | 'info' | 'warning';

class ToastManager {
  private container: HTMLElement | null = null;

  private ensureContainer(): HTMLElement {
    if (!this.container) {
      let el = document.getElementById('toast-container');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast-container';
        document.body.appendChild(el);
      }
      this.container = el;
    }
    return this.container;
  }

  public show(
    title: string,
    message: string,
    type: ToastType = 'success',
    duration = 3500
  ): void {
    const container = this.ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap: Record<ToastType, string> = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠',
    };

    toast.innerHTML = `
      <div style="font-size: 20px; font-weight: bold; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${
        type === 'success' ? '#dcfce7' : type === 'error' ? '#fee2e2' : type === 'warning' ? '#fef3c7' : '#e0f2fe'
      }; color: ${
        type === 'success' ? '#15803d' : type === 'error' ? '#b91c1c' : type === 'warning' ? '#b45309' : '#0369a1'
      };">
        ${iconMap[type]}
      </div>
      <div style="flex: 1;">
        <div class="toast-title">${title}</div>
        <div class="toast-msg">${message}</div>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 300ms ease';
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
      }, 300);
    }, duration);
  }
}

export const toast = new ToastManager();
