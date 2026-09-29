import { UpdateInfo, updateService } from '../services/updateService';
import { toast } from './Toast';

export function showUpdateDialog(info: UpdateInfo): void {
  // Avoid duplicate dialogs
  if (document.getElementById('update-modal-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'update-modal-overlay';
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 500px;">
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="font-size: 24px;">🚀</div>
          <div>
            <h3 class="modal-title">Đã có phiên bản mới v${info.version}</h3>
            <div style="font-size: 12px; color: var(--text-muted);">Phiên bản hiện tại: v${info.currentVersion}</div>
          </div>
        </div>
        <button class="modal-close-btn" id="update-close-btn">✕</button>
      </div>

      <div class="modal-body">
        <div style="margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Nội dung cập nhật mới:</div>
          <div style="background-color: #fafaf9; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px; font-size: 13px; line-height: 1.6; color: var(--text-secondary); max-height: 180px; overflow-y: auto; white-space: pre-wrap;">
${info.body || 'Bản cập nhật tối ưu hóa hiệu năng và sửa lỗi.'}
          </div>
        </div>

        <div id="update-progress-container" style="display: none; margin-top: 16px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; margin-bottom: 6px;">
            <span id="update-progress-text">Đang tải bản cập nhật...</span>
            <span id="update-progress-percent">0%</span>
          </div>
          <div style="height: 8px; background-color: var(--border-color); border-radius: 4px; overflow: hidden;">
            <div id="update-progress-bar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #c2410c, #f59e0b); transition: width 150ms ease;"></div>
          </div>
        </div>
      </div>

      <div class="modal-footer" id="update-footer-actions">
        <button class="btn btn-secondary" id="update-later-btn">Để sau</button>
        <button class="btn btn-primary" id="update-now-btn">
          <span>⬇️</span> Cập nhật ngay
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    if (overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  };

  overlay.querySelector('#update-close-btn')?.addEventListener('click', close);
  overlay.querySelector('#update-later-btn')?.addEventListener('click', close);

  const updateNowBtn = overlay.querySelector('#update-now-btn') as HTMLButtonElement;
  const progressContainer = overlay.querySelector('#update-progress-container') as HTMLElement;
  const progressBar = overlay.querySelector('#update-progress-bar') as HTMLElement;
  const progressPercent = overlay.querySelector('#update-progress-percent') as HTMLElement;
  const progressText = overlay.querySelector('#update-progress-text') as HTMLElement;
  const updateLaterBtn = overlay.querySelector('#update-later-btn') as HTMLButtonElement;

  updateNowBtn.addEventListener('click', async () => {
    updateNowBtn.disabled = true;
    updateLaterBtn.disabled = true;
    updateNowBtn.textContent = 'Đang tải về...';
    progressContainer.style.display = 'block';

    try {
      await updateService.downloadAndInstall((downloaded, total) => {
        if (total && total > 0) {
          const pct = Math.min(100, Math.round((downloaded / total) * 100));
          progressBar.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}%`;
          const mbDownloaded = (downloaded / (1024 * 1024)).toFixed(1);
          const mbTotal = (total / (1024 * 1024)).toFixed(1);
          progressText.textContent = `Đang tải: ${mbDownloaded} MB / ${mbTotal} MB`;
        } else {
          progressText.textContent = `Đang tải: ${(downloaded / 1024).toFixed(0)} KB...`;
        }
      });
      progressText.textContent = 'Đang hoàn tất và khởi động lại...';
      toast.show('Thành công', 'Đã tải xong bản cập nhật. Ứng dụng sẽ tự khởi động lại.', 'success');
    } catch (err) {
      console.error('Lỗi khi tải bản cập nhật:', err);
      progressContainer.style.display = 'none';
      updateNowBtn.disabled = false;
      updateLaterBtn.disabled = false;
      updateNowBtn.textContent = 'Thử lại';
      toast.show(
        'Lỗi cập nhật',
        `Không thể hoàn tất cập nhật: ${err instanceof Error ? err.message : String(err)}`,
        'error',
        5000
      );
    }
  });
}
