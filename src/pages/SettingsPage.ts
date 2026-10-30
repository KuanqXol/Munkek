import { backupService } from '../services/backupService.ts';
import { storageService } from '../services/storageService.ts';
import { orderService } from '../services/orderService.ts';
import { productService } from '../services/productService.ts';
import { customerService } from '../services/customerService.ts';
import { updateService } from '../services/updateService.ts';
import { toast } from '../components/Toast.ts';
import { showConfirmModal } from '../components/ConfirmModal.ts';
import { showUpdateDialog } from '../components/UpdateDialog.ts';
import { escapeHtml } from '../utils/formatters.ts';
import { icons } from '../utils/icons.ts';

export class SettingsPage {
  private container: HTMLElement;

  constructor(container: HTMLElement, _onNavigate: (page: string, param?: string) => void) {
    this.container = container;
  }

  public async render(): Promise<void> {
    const dataFolderPath = storageService.getDataFolderPath();
    const orders = await orderService.getAllOrders();
    const products = await productService.getAllProducts();
    const customers = await customerService.getAllCustomers();

    this.container.innerHTML = `
      <div style="max-width: 820px; margin: 0 auto; padding-bottom: 40px;">
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">
            Dữ liệu & Cài đặt hệ thống
          </h2>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
            Quản lý vị trí lưu trữ, xuất file Excel, sao lưu an toàn và cập nhật ứng dụng
          </p>
        </div>

        <!-- Section 1: Data Location & Safety -->
        <div class="card" style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="color: var(--primary); display: flex;">${icons.folder}</div>
              <div>
                <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary);">
                  Thư mục lưu trữ dữ liệu
                </h3>
                <p style="font-size: 12px; color: var(--text-muted);">
                  Nơi lưu trữ danh sách đơn hàng, danh mục bánh, khách hàng và hình ảnh
                </p>
              </div>
            </div>

            <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #15803d; background: #dcfce7; padding: 4px 10px; border-radius: var(--radius-full);">
              <span class="status-dot"></span> Đang kết nối tốt
            </span>
          </div>

          <!-- Current Path Display -->
          <div style="background: #faf8f5; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="min-width: 0; flex: 1;">
              <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 2px;">
                ĐƯỜNG DẪN THƯ MỤC DỮ LIỆU:
              </div>
              <div style="font-family: monospace; font-size: 13px; color: var(--text-primary); word-break: break-all;">
                ${escapeHtml(dataFolderPath)}
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-pick-data-folder" style="white-space: nowrap;">
              <span>📂</span> Đổi thư mục lưu trữ
            </button>
          </div>

          <!-- Storage Statistics -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px;">
            <div style="background: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 14px; text-align: center;">
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Tổng đơn hàng</div>
              <div style="font-size: 18px; font-weight: 800; color: var(--primary);">${orders.length}</div>
            </div>
            <div style="background: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 14px; text-align: center;">
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Sản phẩm bánh</div>
              <div style="font-size: 18px; font-weight: 800; color: var(--text-primary);">${products.length}</div>
            </div>
            <div style="background: #fff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 14px; text-align: center;">
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">Hồ sơ khách hàng</div>
              <div style="font-size: 18px; font-weight: 800; color: var(--accent);">${customers.length}</div>
            </div>
          </div>

          <div style="background: #ecfdf5; border: 1px solid #d1fae5; border-radius: var(--radius-sm); padding: 10px 14px; font-size: 12px; color: #047857; display: flex; align-items: flex-start; gap: 8px; line-height: 1.5;">
            <span style="font-size: 14px;">🛡️</span>
            <div>
              <strong>Bảo toàn dữ liệu khi cập nhật:</strong> Dữ liệu của bạn được lưu độc lập tại thư mục trên. Mỗi khi bạn tải bản cài đặt mới của MunKek từ GitHub, dữ liệu của bạn hoàn toàn nguyên vẹn và không bao giờ bị ghi đè hay mất đi.
            </div>
          </div>
        </div>

        <!-- Section 2: Excel Reports & Exports -->
        <div class="card" style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
            <div style="color: var(--primary); display: flex;">${icons.download}</div>
            <div>
              <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary);">
                Xuất file báo cáo Excel
              </h3>
              <p style="font-size: 12px; color: var(--text-muted);">
                Xuất dữ liệu ra file mở được bằng Microsoft Excel chuẩn tiếng Việt (UTF-8 BOM không lỗi font)
              </p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <div style="background: #faf8f5; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                  Báo cáo Đơn hàng (${orders.length} đơn)
                </div>
                <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px;">
                  Xuất toàn bộ danh sách đơn bánh, khách hàng, số điện thoại, chi tiết món, giảm giá và thành tiền ra Excel.
                </p>
              </div>
              <button class="btn btn-secondary" id="btn-export-orders-csv" style="width: 100%;">
                <span>📥</span> Xuất đơn hàng ra Excel
              </button>
            </div>

            <div style="background: #faf8f5; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                  Bảng giá Bánh Trung Thu (${products.length} loại)
                </div>
                <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px;">
                  Xuất danh mục các loại bánh, số trứng, trọng lượng và đơn giá niêm yết để in hoặc lưu trữ.
                </p>
              </div>
              <button class="btn btn-secondary" id="btn-export-products-csv" style="width: 100%;">
                <span>📥</span> Xuất menu bánh ra Excel
              </button>
            </div>
          </div>
        </div>

        <!-- Section 3: Safe Backup & Restore -->
        <div class="card" style="margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
            <div style="color: var(--primary); display: flex;">${icons.cash}</div>
            <div>
              <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary);">
                Sao lưu & Phục hồi dữ liệu
              </h3>
              <p style="font-size: 12px; color: var(--text-muted);">
                Lưu trữ bản sao lưu an toàn hoặc phục hồi dữ liệu khi chuyển sang máy tính mới
              </p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            <!-- Backup -->
            <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; justify-content: space-between; background: #ffffff;">
              <div>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                  Tạo bản sao lưu an toàn
                </div>
                <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px;">
                  Lưu trữ toàn bộ đơn hàng thành một file duy nhất để cất giữ vào USB hoặc gửi qua Zalo/Email.
                </p>
              </div>
              <button class="btn btn-secondary" id="btn-backup-json" style="width: 100%;">
                <span>💾</span> Tạo bản sao lưu ngay
              </button>
            </div>

            <!-- Restore with Auto Safeguard -->
            <div style="border: 1px dashed #d97706; background: #fffbeb; border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="font-size: 14px; font-weight: 700; color: #92400e; margin-bottom: 4px;">
                  Phục hồi từ bản sao lưu
                </div>
                <p style="font-size: 12px; color: #78350f; line-height: 1.5; margin-bottom: 12px;">
                  Nạp lại đơn hàng từ file sao lưu trước đó. Hệ thống sẽ <strong>tự động tạo bản sao lưu an toàn</strong> dữ liệu hiện tại trước khi phục hồi.
                </p>
              </div>
              <button class="btn btn-primary" id="btn-restore-json" style="width: 100%;">
                <span>🔄</span> Chọn file phục hồi
              </button>
            </div>
          </div>
        </div>

        <!-- Section 4: App Version & Updates -->
        <div class="card">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="brand-icon" style="width: 38px; height: 38px;">
                ${icons.bakery}
              </div>
              <div>
                <div style="font-size: 15px; font-weight: 700; color: var(--text-primary);">
                  MunKek - Quản lý Bán Bánh Trung Thu
                </div>
                <div style="font-size: 12px; color: var(--text-muted);">
                  Phiên bản v0.1.0 (Windows Offline)
                </div>
              </div>
            </div>

            <button class="btn btn-secondary" id="btn-check-update">
              <span>🔄</span> Kiểm tra bản cập nhật mới
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
      try {
        const selected = await storageService.pickDataFolder();
        if (selected) {
          toast.show('Thành công', `Đã chuyển sang thư mục: ${selected}`, 'success');
          this.render();
        }
      } catch (err) {
        toast.show('Lỗi', String(err instanceof Error ? err.message : err), 'error');
      }
    });

    // Export Orders CSV
    this.container.querySelector('#btn-export-orders-csv')?.addEventListener('click', async () => {
      const btn = this.container.querySelector('#btn-export-orders-csv') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Đang xuất Excel...';

      const res = await backupService.exportCsv();
      btn.disabled = false;
      btn.innerHTML = '<span>📥</span> Xuất đơn hàng ra Excel';

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
      btn.textContent = 'Đang xuất menu...';

      const res = await backupService.exportProductsCsv();
      btn.disabled = false;
      btn.innerHTML = '<span>📥</span> Xuất menu bánh ra Excel';

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
      btn.innerHTML = '<span>💾</span> Tạo bản sao lưu ngay';

      if (res.success) {
        toast.show('Thành công', res.message, 'success');
      } else {
        toast.show('Thông báo', res.message, 'info');
      }
    });

    // Restore JSON with confirm
    this.container.querySelector('#btn-restore-json')?.addEventListener('click', async () => {
      const confirmed = await showConfirmModal({
        title: 'Xác nhận phục hồi dữ liệu',
        message: 'Hệ thống sẽ nạp dữ liệu từ file sao lưu của bạn. Trước khi thay thế, MunKek sẽ tự động tạo một bản sao lưu an toàn của dữ liệu hiện tại trong thư mục backups. Bạn có muốn tiếp tục?',
        confirmText: 'Chọn file để phục hồi',
        cancelText: 'Hủy bỏ',
        isDanger: false,
      });

      if (!confirmed) return;

      const res = await backupService.pickAndRestoreJson();
      if (res.success) {
        toast.show('Thành công', res.message, 'success');
        this.render();
      } else {
        toast.show('Thông báo', res.message, 'info');
      }
    });

    // Check updates
    this.container.querySelector('#btn-check-update')?.addEventListener('click', async () => {
      const btn = this.container.querySelector('#btn-check-update') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Đang kiểm tra...';

      try {
        const res = await updateService.checkForUpdates(false);
        btn.disabled = false;
        btn.innerHTML = '<span>🔄</span> Kiểm tra bản cập nhật mới';

        if (res.status === 'AVAILABLE') {
          showUpdateDialog(res.info);
        } else if (res.status === 'UP_TO_DATE') {
          toast.show('Đang là bản mới nhất', 'Bạn đang sử dụng phiên bản MunKek mới nhất.', 'info');
        } else {
          toast.show('Thông báo', res.message, 'info');
        }
      } catch {
        btn.disabled = false;
        btn.innerHTML = '<span>🔄</span> Kiểm tra bản cập nhật mới';
        toast.show('Thông báo', 'Không thể kiểm tra cập nhật (offline).', 'info');
      }
    });
  }
}
