import { backupService } from '../services/backupService';
import { storageService } from '../services/storageService';
import { orderService } from '../services/orderService';
import { productService } from '../services/productService';
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
    const dataFolderPath = storageService.getDataFolderPath();
    const configFilePath = storageService.getConfigFilePath();
    const orders = await orderService.getAllOrders();
    const products = await productService.getAllProducts();

    this.container.innerHTML = `
      <div style="max-width: 840px; margin: 0 auto; padding-bottom: 40px;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">Dữ liệu & Cài đặt</h2>
          <p style="font-size: 14px; color: var(--text-muted); margin-top: 2px;">
            Quản lý vị trí lưu trữ dữ liệu, sao lưu an toàn, xuất Excel và cập nhật hệ thống
          </p>
        </div>

        <!-- Section 1: Storage & Folder Relocation -->
        <div class="card" style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
            <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: #e0f2fe; color: #0369a1; display: flex; align-items: center; justify-content: center; font-size: 20px;">
              📁
            </div>
            <div>
              <h3 style="font-size: 17px; font-weight: 700; color: var(--text-primary);">Vị trí lưu trữ dữ liệu (Config & Data)</h3>
              <p style="font-size: 13px; color: var(--text-muted);">
                Mặc định đặt ngay tại thư mục gốc của ứng dụng. Bạn có thể đem ra nơi khác tùy ý.
              </p>
            </div>
          </div>

          <!-- Current Data Folder Path -->
          <div style="margin-bottom: 14px;">
            <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">
              THƯ MỤC CHỨA DỮ LIỆU (DATA PATH):
            </div>
            <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 14px; font-family: monospace; font-size: 13px; word-break: break-all; color: var(--text-primary); display: flex; justify-content: space-between; align-items: center;">
              <span>${dataFolderPath}</span>
              <button class="btn btn-secondary btn-sm" id="btn-pick-data-folder" style="margin-left: 10px; white-space: nowrap;">
                📂 Trỏ lại thư mục Data
              </button>
            </div>
          </div>

          <!-- Current Config File Path -->
          <div style="margin-bottom: 14px;">
            <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">
              FILE CẤU HÌNH (CONFIG.JSON):
            </div>
            <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 14px; font-family: monospace; font-size: 13px; word-break: break-all; color: var(--text-primary); display: flex; justify-content: space-between; align-items: center;">
              <span>${configFilePath}</span>
              <button class="btn btn-secondary btn-sm" id="btn-pick-config-file" style="margin-left: 10px; white-space: nowrap;">
                ⚙️ Chọn file config
              </button>
            </div>
          </div>

          <div style="margin-top: 12px; display: flex; gap: 8px; font-size: 12px; color: #047857; background: #ecfdf5; padding: 10px 14px; border-radius: var(--radius-sm);">
            <span>🛡️</span>
            <span>
              <strong>Bảo toàn dữ liệu khi cập nhật:</strong> File <code>config.json</code> và thư mục <code>data/</code> nằm tại thư mục gốc. Trước khi cập nhật phần mềm, bạn có thể copy hoặc đem thư mục <code>data/</code> ra nơi khác (ví dụ: ổ D: hoặc Desktop), sau khi cài xong chỉ cần trỏ lại 1 lần là xong.
            </span>
          </div>
        </div>

        <!-- Section 2: Backup & Export -->
        <div class="card" style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 18px;">
            <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; font-size: 20px;">
              💾
            </div>
            <div>
              <h3 style="font-size: 17px; font-weight: 700; color: var(--text-primary);">Xuất Excel & Sao lưu dữ liệu</h3>
              <p style="font-size: 13px; color: var(--text-muted);">Tạo bản sao lưu định kỳ để lưu trữ an toàn hoặc mở bằng Excel</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- Export Orders CSV -->
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; display: flex; flex-direction: column; justify-content: space-between; background: #fffcf8;">
              <div>
                <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                  📊 Xuất Excel Đơn hàng (${orders.length} đơn)
                </div>
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
                  Xuất toàn bộ đơn bánh, danh sách từng loại bánh, tiền cọc, nợ và ngày giao ra file Excel (UTF-8 BOM không lỗi font tiếng Việt).
                </p>
              </div>
              <button class="btn btn-secondary" id="btn-export-orders-csv" style="width: 100%;">
                <span>📥</span> Xuất đơn hàng ra CSV
              </button>
            </div>

            <!-- Export Products CSV -->
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; display: flex; flex-direction: column; justify-content: space-between; background: #fffcf8;">
              <div>
                <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                  🥮 Xuất Menu Bánh (${products.length} loại)
                </div>
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
                  Xuất danh mục các loại bánh trung thu, đơn giá niêm yết, số trứng và trọng lượng ra file CSV để in hoặc đối chiếu.
                </p>
              </div>
              <button class="btn btn-secondary" id="btn-export-products-csv" style="width: 100%;">
                <span>📥</span> Xuất menu bánh ra CSV
              </button>
            </div>
          </div>

          <div style="margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <!-- Backup JSON -->
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 18px; display: flex; flex-direction: column; justify-content: space-between; background: #fffcf8;">
              <div>
                <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                  📦 Sao lưu đầy đủ (JSON)
                </div>
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
                  Lưu trữ nguyên vẹn dữ liệu đơn hàng thành file <code>munkek-backup-*.json</code> để chuyển sang máy tính khác hoặc cất giữ.
                </p>
              </div>
              <button class="btn btn-secondary" id="btn-backup-json" style="width: 100%;">
                <span>💾</span> Tạo bản sao lưu JSON
              </button>
            </div>

            <!-- Restore JSON -->
            <div style="border: 1px dashed #d97706; background: #fffbeb; border-radius: var(--radius-md); padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-size: 15px; font-weight: 700; color: #92400e; margin-bottom: 4px;">
                  🔄 Phục hồi từ bản sao lưu
                </div>
                <p style="font-size: 13px; color: #78350f; line-height: 1.5; margin-bottom: 16px;">
                  Nạp lại dữ liệu đơn hàng từ file JSON đã lưu trước đó. Hệ thống hỗ trợ tương thích ngược với các bản sao lưu cũ.
                </p>
              </div>
              <button class="btn btn-primary" id="btn-restore-json" style="width: 100%;">
                <span>📂</span> Chọn file khôi phục
              </button>
            </div>
          </div>
        </div>

        <!-- Section 3: App version & Auto Update -->
        <div class="card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 36px; height: 36px; border-radius: var(--radius-sm); background: #ffedd5; color: #c2410c; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                🥮
              </div>
              <div>
                <h3 style="font-size: 17px; font-weight: 700; color: var(--text-primary);">MunKek - Tiệm Bánh Trung Thu</h3>
                <div style="font-size: 13px; color: var(--text-muted);">Phiên bản v0.1.0 (Windows Offline)</div>
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
    // Pick custom data folder
    this.container.querySelector('#btn-pick-data-folder')?.addEventListener('click', async () => {
      const selected = await storageService.pickDataFolder();
      if (selected) {
        toast.show('Thành công', `Đã đổi thư mục dữ liệu sang: ${selected}`, 'success');
        this.render();
      }
    });

    // Pick custom config file
    this.container.querySelector('#btn-pick-config-file')?.addEventListener('click', async () => {
      const selected = await storageService.pickConfigFile();
      if (selected) {
        toast.show('Thành công', `Đã nạp file cấu hình từ: ${selected}`, 'success');
        this.render();
      }
    });

    // Export Orders CSV
    this.container.querySelector('#btn-export-orders-csv')?.addEventListener('click', async () => {
      const btn = this.container.querySelector('#btn-export-orders-csv') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Đang xuất CSV...';

      const res = await backupService.exportCsv();
      btn.disabled = false;
      btn.innerHTML = '<span>📥</span> Xuất đơn hàng ra CSV';

      if (res.success) {
        toast.show('Thành công', res.message, 'success');
      } else {
        toast.show('Thông báo', res.message, 'info');
      }
    });

    // Export Products CSV
    this.container.querySelector('#btn-export-products-csv')?.addEventListener('click', async () => {
      const btn = this.container.querySelector('#btn-export-products-csv') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Đang xuất CSV...';

      const res = await backupService.exportProductsCsv();
      btn.disabled = false;
      btn.innerHTML = '<span>📥</span> Xuất menu bánh ra CSV';

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
          'Bạn có chắc chắn muốn nạp dữ liệu từ file sao lưu không? Các đơn hàng từ file sao lưu sẽ được nạp vào hệ thống.',
        confirmText: 'Tiến hành chọn file',
        cancelText: 'Hủy',
        isDanger: false,
      });

      if (!confirmed) return;

      const res = await backupService.pickAndRestoreJson();
      if (res.success) {
        toast.show('Phục hồi thành công', res.message, 'success', 5000);
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
        toast.show('Phiên bản mới nhất', 'Bạn đang sử dụng phiên bản mới nhất của MunKek (v0.1.0).', 'success');
      } else {
        toast.show('Thông báo cập nhật', res.message, 'info');
      }
    });
  }
}
