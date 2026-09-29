export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export function showConfirmModal(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const confirmBtnClass = options.isDanger ? 'btn btn-danger' : 'btn btn-primary';

    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 440px;">
        <div class="modal-header">
          <h3 class="modal-title">${options.title}</h3>
          <button class="modal-close-btn" id="modal-close-x">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size: 15px; color: var(--text-secondary); line-height: 1.6;">${options.message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel-btn">${options.cancelText || 'Hủy bỏ'}</button>
          <button class="${confirmBtnClass}" id="modal-confirm-btn">${options.confirmText || 'Xác nhận'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cleanup = (result: boolean) => {
      document.removeEventListener('keydown', handleKeyDown);
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 150ms ease';
      setTimeout(() => {
        if (overlay.parentElement) {
          overlay.parentElement.removeChild(overlay);
        }
      }, 150);
      resolve(result);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    overlay.querySelector('#modal-cancel-btn')?.addEventListener('click', () => cleanup(false));
    overlay.querySelector('#modal-close-x')?.addEventListener('click', () => cleanup(false));
    overlay.querySelector('#modal-confirm-btn')?.addEventListener('click', () => cleanup(true));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup(false);
      }
    });
  });
}
