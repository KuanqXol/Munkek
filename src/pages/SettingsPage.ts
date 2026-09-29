import { backupService } from '../services/backupService';
import { storageService } from '../services/storageService';
import { updateService } from '../services/updateService';
import { toast } from '../components/Toast';
import { showConfirmModal } from '../components/ConfirmModal';
import { showUpdateDialog } from '../components/UpdateDialog';

export class SettingsPage {
  private container: HTMLElement;

  constructor(container: HTMLElement, _onNavigate: (page: string, param?: string) => void) {
    this.container = container;
  }

  public async render(): Promise<void> {
    const dataFilePath = await storageService.getOrdersFilePath();
    const doc = storageService.getCachedDocument();
    const orderCount = doc ? doc.orders.length : 0;

    this.container.innerHTML = `
      <div style="max-width: 820px; margin: 0 auto;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">Dữ liệu & Cài đặt</h2>
          <p style="font-size: 14px; color: var(--text-muted); margin-top: 2px;">Quản lý dữ liệu đơn hàng, xuất file Excel, sao lưu và cập nhật ứng dụng</p>
        </div>

        <!-- Section 1: Backup & Export -->
        <div class="card" style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 18px;">
            <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; font-size: 20px;">
              💾
            </div>
            <div>
              <h3 style="font-size: 17px; font-weight: 700; color: var(--text-primary);">Xuất & Sao lưu dữ liệu</h3>
              <p style="font-size: 13px; color: var(--text-muted);">Tạo bản sao lưu định kỳ để lưu trữ an toàn hoặc mở bằng phần mềm khác</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- Export CSV -->
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; display: flex; flex-direction: column; justify-content: space-between; background: #fffcf8;">
              <div>
                <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                  📊 Xuất file Excel (CSV)
                </div>
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
                  Xuất toàn bộ ${orderCount} đơn hàng ra file <code>orders.csv</code>. Hỗ trợ chuẩn font tiếng Việt (UTF-8 BOM), mở xem và in ấn trực tiếp bằng Microsoft Excel.
                </p>
              </div>
              <button class="btn btn-secondary" id="btn-export-csv" style="width: 100%;">
                <span>📥</span> Xuất danh sách ra CSV
              </button>
            </div>

            <!-- Backup JSON -->
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; display: flex; flex-direction: column; justify-content: space-between; background: #fffcf8;">
              <div>
                <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                  📦 Sao lưu đầy đủ (JSON)
                </div>
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
                  Lưu trữ nguyên vẹn dữ liệu đơn hàng thành file <code>cake-orders-backup-*.json</code> để có thể chuyển sang máy tính khác hoặc khôi phục khi cần.
                </p>
              </div>
              <button class="btn btn-secondary" id="btn-backup-json" style="width: 100%;">
                <span>💾</span> Tạo bản sao lưu JSON
              </button>
            </div>
          </div>

          <!-- Restore JSON -->
          <div style="margin-top: 16px; border: 1px dashed #d97706; background: #fffbeb; border-radius: var(--radius-md); padding: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
              <div>
                <div style="font-size: 15px; font-weight: 700; color: #92400e; margin-bottom: 2px;">
                  🔄 Phục hồi dữ liệu từ file sao lưu
                </div>
                <p style="font-size: 13px; color: #78350f; line-height: 1.4;">
                  Nạp lại dữ liệu từ file backup JSON đã lưu trước đó. Hệ thống sẽ tự động tạo bản lưu an toàn cho dữ liệu hiện tại trước khi khôi phục.
                </p>
              </div>
              <button class="btn btn-primary" id="btn-restore-json" style="white-space: nowrap;">
                <span>📂</span> Chọn file khôi phục
              </button>
            </div>
          </div>
        </div>

        <!-- Section 2: Storage info -->
        <div class="card" style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
            <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: #e0f2fe; color: #0369a1; display: flex; align-items: center; justify-content: center; font-size: 20px;">
              📁
            </div>
            <div>
              <h3 style="font-size: 17px; font-weight: 700; color: var(--text-primary);">Vị trí lưu trữ dữ liệu trên máy</h3>
              <p style="font-size: 13px; color: var(--text-muted);">Dữ liệu luôn được lưu độc lập, an toàn trên ổ đĩa của bạn</p>
            </div>
          </div>

          <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 14px; font-family: monospace; font-size: 13px; word-break: break-all; color: var(--text-primary);">
            ${dataFilePath}
          </div>

          <div style="margin-top: 12px; display: flex; gap: 8px; font-size: 12px; color: #047857; background: #ecfdf5; padding: 10px 14px; border-radius: var(--radius-sm);">
            <span>🛡️</span>
            <span><strong>Cơ chế bảo vệ dữ liệu:</strong> Dữ liệu đơn hàng nằm tách biệt hoàn toàn khỏi thư mục cài đặt ứng dụng. Khi bạn nâng cấp hoặc cài lại MunKek, dữ liệu sẽ <strong>không bao giờ bị mất</strong>.</span>
          </div>
        </div>

        <!-- Section 3: App version & Auto Update -->
        <div class="card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: #ffedd5; color: #c2410c; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                🍰
              </div>
              <div>
                <h3 style="font-size: 17px; font-weight: 700; color: var(--text-primary);">MunKek Desktop</h3>
                <div style="font-size: 13px; color: var(--text-muted);">Phiên bản v0.1.0 (Windows x64)</div>
              </div>
            </div>

            <button class="btn btn-secondary" id="btn-check-update">
              <span>🔄</span> Kiểm tra cập nhật
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // Export CSV
    this.container.querySelector('#btn-export-csv')?.addEventListener('click', async () => {
      const btn = this.container.querySelector('#btn-export-csv') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Đang xuất CSV...';

      const res = await backupService.exportCsv();
      btn.disabled = false;
      btn.innerHTML = '<span>📥</span> Xuất danh sách ra CSV';

      if (res.success) {
        toast.show('Thành công', res.message, 'success');
      } else {
        toast.show('Thông báo', res.message, 'info');
      }
    });

    // Backup JSON
    this.container.querySelector('#btn-backup-json')?.addEventListener('click', async () => {
      const btn = this.container.querySelector('#btn-backup-json') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Đang sao lưu...';

      const res = await backupService.backupJson();
      btn.disabled = false;
      btn.innerHTML = '<span>💾</span> Tạo bản sao lưu JSON';

      if (res.success) {
        toast.show('Thành công', res.message, 'success');
      } else {
        toast.show('Thông báo', res.message, 'info');
      }
    });

    // Restore JSON
    this.container.querySelector('#btn-restore-json')?.addEventListener('click', async () => {
      const confirmed = await showConfirmModal({
        title: 'Xác nhận phục hồi dữ liệu',
        message:
          'Bạn có chắc chắn muốn nạp dữ liệu từ file sao lưu không? Trước khi ghi đè, hệ thống sẽ tự động tạo một bản sao lưu an toàn của dữ liệu hiện tại để tránh mất mát.',
        confirmText: 'Tiến hành chọn file',
        cancelText: 'Hủy',
        isDanger: false,
      });

      if (!confirmed) return;

      const res = await backupService.pickAndRestoreJson();
      if (res.success) {
        toast.show('Phục hồi thành công', res.message, 'success', 5000);
        // Refresh view
        this.render();
      } else {
        toast.show('Thông báo', res.message, 'error', 5000);
      }
    });

    // Check updates manually
    this.container.querySelector('#btn-check-update')?.addEventListener('click', async () => {
      const btn = this.container.querySelector('#btn-check-update') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Đang kiểm tra...';

      const res = await updateService.checkForUpdates(false);
      btn.disabled = false;
      btn.innerHTML = '<span>🔄</span> Kiểm tra cập nhật';

      if (res.status === 'AVAILABLE') {
        showUpdateDialog(res.info);
      } else if (res.status === 'UP_TO_DATE') {
        toast.show('Phiên bản mới nhất', 'Bạn đang sử dụng phiên bản mới nhất của MunKek (v1.0.0).', 'success');
      } else {
        toast.show('Thông báo cập nhật', res.message, 'info');
      }
    });
  }
}
