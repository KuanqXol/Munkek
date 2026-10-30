import './styles/main.css';
import { storageService } from './services/storageService.ts';
import { productService } from './services/productService.ts';
import { orderService } from './services/orderService.ts';
import { customerService } from './services/customerService.ts';
import { updateService } from './services/updateService.ts';
import { showUpdateDialog } from './components/UpdateDialog.ts';
import { toast } from './components/Toast.ts';
import { icons } from './utils/icons.ts';
import { escapeHtml } from './utils/formatters.ts';

import { MainPosPage } from './pages/MainPosPage.ts';
import { OrdersPage } from './pages/OrdersPage.ts';
import { CustomersPage } from './pages/CustomersPage.ts';
import { AnalyticsPage } from './pages/AnalyticsPage.ts';
import { ProductsPage } from './pages/ProductsPage.ts';
import { SettingsPage } from './pages/SettingsPage.ts';
import { OrderFormPage } from './pages/OrderFormPage.ts';

export type PageId = 'pos' | 'orders' | 'customers' | 'analytics' | 'products' | 'settings' | 'edit-order';

class MunKekApp {
  private currentPage: PageId = 'pos';
  private currentPageParam?: string;
  private appRoot: HTMLElement;

  constructor() {
    const root = document.getElementById('app');
    if (!root) throw new Error('Không tìm thấy element #app');
    this.appRoot = root;
  }

  public async start(): Promise<void> {
    try {
      // 1. Initialize root config and check data folder status
      const initResult = await storageService.init();

      if (initResult.status === 'NEEDS_SETUP') {
        await this.renderSetupScreen();
        return;
      }

      if (initResult.status === 'UNAVAILABLE') {
        await this.renderRecoveryScreen(initResult.message || 'Không thể truy cập thư mục dữ liệu.');
        return;
      }

      if (initResult.status === 'ERROR') {
        this.renderFatalError(initResult.message);
        return;
      }

      // 2. Normal flow: Load services
      await this.loadAndLaunch();
    } catch (err) {
      console.error('Lỗi khi khởi chạy ứng dụng MunKek:', err);
      this.renderFatalError(err);
    }
  }

  private async loadAndLaunch(): Promise<void> {
    await productService.init();
    await orderService.init();
    await customerService.init();

    this.renderAppShell();
    await this.navigateTo(this.currentPage);

    // Silent background update check
    this.checkUpdatesSilently();
  }

  /**
   * First Launch Setup Screen: Friendly, simple directory selection for non-tech user
   */
  private async renderSetupScreen(): Promise<void> {
    const defaultFolder = await storageService.getDefaultSafeDataFolder();

    this.appRoot.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-card">
          <div class="onboarding-brand">
            <div class="brand-icon">${icons.bakery}</div>
            <div>
              <h1 style="font-size: 20px; font-weight: 800; color: var(--text-primary);">MunKek</h1>
              <p style="font-size: 13px; color: var(--text-muted);">Quản lý Bán Bánh Trung Thu</p>
            </div>
          </div>

          <h2 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">
            Chào mừng bạn đến với MunKek!
          </h2>
          <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 18px;">
            Để bảo toàn toàn bộ đơn hàng và danh mục bánh khi cập nhật phần mềm, vui lòng chọn hoặc nhập thư mục lưu dữ liệu trên máy tính.
          </p>

          <div style="background: #faf8f5; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px; margin-bottom: 20px;">
            <div style="font-size: 13px; font-weight: 700; color: var(--primary); margin-bottom: 4px;">
              🛡️ An toàn dữ liệu tuyệt đối:
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
              Thư mục này lưu trữ file đơn hàng (orders.json) và menu bánh (products.json). Các bản cập nhật sau này từ GitHub sẽ không bao giờ làm mất dữ liệu của bạn.
            </div>
          </div>

          <!-- Input + Browse Box -->
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
              Đường dẫn thư mục dữ liệu:
            </label>
            <div style="display: flex; gap: 8px;">
              <input
                type="text"
                id="setup-folder-input"
                class="form-control"
                style="flex: 1; font-family: monospace; font-size: 13px;"
                value="${escapeHtml(defaultFolder)}"
                placeholder="Ví dụ: D:\\MunKekData hoặc C:\\Users\\...\\MunKekData"
              />
              <button class="btn btn-secondary" id="btn-setup-browse" style="white-space: nowrap; flex-shrink: 0;" type="button">
                <span>📂</span> Duyệt...
              </button>
            </div>
            <p style="font-size: 11px; color: var(--text-muted); margin-top: 5px;">
              Bạn có thể nhấn "Duyệt..." để chọn thư mục hoặc tự nhập/dán đường dẫn vào ô trên.
            </p>
          </div>

          <!-- Error Alert Box -->
          <div id="setup-error-box" style="display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 16px; color: #991b1b; font-size: 13px; line-height: 1.5;">
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button class="btn btn-primary btn-lg" id="btn-setup-confirm" style="width: 100%;" type="button">
              <span>🚀</span> Xác nhận & Bắt đầu sử dụng
            </button>
            <button class="btn btn-secondary" id="btn-setup-use-default" style="width: 100%;" type="button">
              <span>📁</span> Tự động tạo thư mục an toàn (${escapeHtml(defaultFolder)})
            </button>
          </div>
        </div>
      </div>
    `;

    const folderInput = this.appRoot.querySelector('#setup-folder-input') as HTMLInputElement;
    const browseBtn = this.appRoot.querySelector('#btn-setup-browse');
    const confirmBtn = this.appRoot.querySelector('#btn-setup-confirm') as HTMLButtonElement;
    const defaultBtn = this.appRoot.querySelector('#btn-setup-use-default') as HTMLButtonElement;
    const errorBox = this.appRoot.querySelector('#setup-error-box') as HTMLElement;

    browseBtn?.addEventListener('click', async () => {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Chọn thư mục lưu trữ dữ liệu MunKek (data)',
        });
        const folder = Array.isArray(selected) ? selected[0] : selected;
        if (folder && typeof folder === 'string') {
          folderInput.value = folder;
          errorBox.style.display = 'none';
        }
      } catch (err) {
        console.error('Error opening folder picker:', err);
        errorBox.textContent = `Lỗi mở cửa sổ chọn thư mục: ${err instanceof Error ? err.message : String(err)}`;
        errorBox.style.display = 'block';
      }
    });

    const handleConnect = async (targetPath: string) => {
      const cleanPath = (targetPath || '').trim();
      if (!cleanPath) {
        errorBox.textContent = 'Vui lòng nhập hoặc chọn một đường dẫn thư mục dữ liệu hợp lệ.';
        errorBox.style.display = 'block';
        return;
      }

      errorBox.style.display = 'none';
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span>⏳</span> Đang kết nối thư mục...';
      }
      if (defaultBtn) defaultBtn.disabled = true;

      try {
        await storageService.setupDataFolder(cleanPath);
        toast.show('Thành công', `Đã kết nối thư mục dữ liệu: ${cleanPath}`, 'success');
        await this.loadAndLaunch();
      } catch (err) {
        console.error('Setup folder error:', err);
        errorBox.textContent = `Không thể kết nối thư mục: ${err instanceof Error ? err.message : String(err)}`;
        errorBox.style.display = 'block';
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = '<span>🚀</span> Xác nhận & Bắt đầu sử dụng';
        }
        if (defaultBtn) defaultBtn.disabled = false;
      }
    };

    confirmBtn?.addEventListener('click', () => {
      handleConnect(folderInput.value);
    });

    defaultBtn?.addEventListener('click', () => {
      handleConnect(defaultFolder);
    });
  }

  /**
   * Recovery Screen: Shown when configured data folder is missing or disconnected
   */
  private async renderRecoveryScreen(message: string): Promise<void> {
    const currentPath = storageService.getDataFolderPath();
    const defaultFolder = await storageService.getDefaultSafeDataFolder();

    this.appRoot.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-card" style="border-color: #fed7aa;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 24px;">
              ⚠️
            </div>
            <div>
              <h2 style="font-size: 18px; font-weight: 800; color: #991b1b;">Không thể truy cập thư mục dữ liệu</h2>
              <p style="font-size: 13px; color: var(--text-muted);">Cần kiểm tra lại kết nối thư mục lưu trữ</p>
            </div>
          </div>

          <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px;">
            ${escapeHtml(message)}
          </p>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
              Đường dẫn thư mục hiện tại:
            </label>
            <div style="display: flex; gap: 8px;">
              <input
                type="text"
                id="recovery-folder-input"
                class="form-control"
                style="flex: 1; font-family: monospace; font-size: 13px;"
                value="${escapeHtml(currentPath)}"
                placeholder="Nhập đường dẫn thư mục..."
              />
              <button class="btn btn-secondary" id="btn-recovery-browse" style="white-space: nowrap; flex-shrink: 0;" type="button">
                <span>📂</span> Duyệt...
              </button>
            </div>
          </div>

          <div id="recovery-error-box" style="display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 16px; color: #991b1b; font-size: 13px;">
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button class="btn btn-primary" id="btn-recovery-confirm" style="width: 100%;" type="button">
              <span>🔄</span> Kết nối thư mục này
            </button>
            <button class="btn btn-secondary" id="btn-recovery-default" style="width: 100%;" type="button">
              <span>📁</span> Chuyển sang thư mục an toàn (${escapeHtml(defaultFolder)})
            </button>
          </div>
        </div>
      </div>
    `;

    const folderInput = this.appRoot.querySelector('#recovery-folder-input') as HTMLInputElement;
    const browseBtn = this.appRoot.querySelector('#btn-recovery-browse');
    const confirmBtn = this.appRoot.querySelector('#btn-recovery-confirm') as HTMLButtonElement;
    const defaultBtn = this.appRoot.querySelector('#btn-recovery-default') as HTMLButtonElement;
    const errorBox = this.appRoot.querySelector('#recovery-error-box') as HTMLElement;

    browseBtn?.addEventListener('click', async () => {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Chọn thư mục lưu trữ dữ liệu MunKek',
        });
        const folder = Array.isArray(selected) ? selected[0] : selected;
        if (folder && typeof folder === 'string') {
          folderInput.value = folder;
          errorBox.style.display = 'none';
        }
      } catch (err) {
        errorBox.textContent = `Lỗi mở cửa sổ chọn: ${err instanceof Error ? err.message : String(err)}`;
        errorBox.style.display = 'block';
      }
    });

    const handleRecovery = async (targetPath: string) => {
      const cleanPath = (targetPath || '').trim();
      if (!cleanPath) {
        errorBox.textContent = 'Vui lòng nhập đường dẫn thư mục hợp lệ.';
        errorBox.style.display = 'block';
        return;
      }

      errorBox.style.display = 'none';
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span>⏳</span> Đang kiểm tra...';
      }

      try {
        await storageService.setupDataFolder(cleanPath);
        toast.show('Thành công', 'Đã kết nối lại thư mục dữ liệu.', 'success');
        await this.loadAndLaunch();
      } catch (err) {
        errorBox.textContent = `Không thể kết nối: ${err instanceof Error ? err.message : String(err)}`;
        errorBox.style.display = 'block';
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = '<span>🔄</span> Kết nối thư mục này';
        }
      }
    };

    confirmBtn?.addEventListener('click', () => {
      handleRecovery(folderInput.value);
    });

    defaultBtn?.addEventListener('click', () => {
      handleRecovery(defaultFolder);
    });
  }

  private renderAppShell(): void {
    this.appRoot.innerHTML = `
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="brand-icon">
            ${icons.bakery}
          </div>
          <div class="brand-text">
            <h1>MunKek</h1>
            <p>Bán Bánh Trung Thu</p>
          </div>
        </div>

        <!-- Primary Navigation Sections -->
        <nav class="sidebar-nav">
          <button class="nav-item ${this.currentPage === 'pos' ? 'active' : ''}" data-page="pos">
            <span class="nav-icon">${icons.plus}</span>
            <span>Tạo đơn</span>
          </button>
          <button class="nav-item ${this.currentPage === 'orders' ? 'active' : ''}" data-page="orders">
            <span class="nav-icon">${icons.orders}</span>
            <span>Đơn hàng</span>
          </button>
          <button class="nav-item ${this.currentPage === 'customers' ? 'active' : ''}" data-page="customers">
            <span class="nav-icon">${icons.customer}</span>
            <span>Khách hàng</span>
          </button>
          <button class="nav-item ${this.currentPage === 'analytics' ? 'active' : ''}" data-page="analytics">
            <span class="nav-icon">${icons.dashboard}</span>
            <span>Thống kê</span>
          </button>
          <button class="nav-item ${this.currentPage === 'products' ? 'active' : ''}" data-page="products">
            <span class="nav-icon">${icons.cake}</span>
            <span>Sản phẩm</span>
          </button>
          <button class="nav-item ${this.currentPage === 'settings' ? 'active' : ''}" data-page="settings">
            <span class="nav-icon">${icons.settings}</span>
            <span>Dữ liệu & Cài đặt</span>
          </button>
        </nav>

        <div class="sidebar-footer">
          <div class="status-badge-offline">
            <span class="status-dot"></span>
            <span>Hoạt động Offline</span>
          </div>
          <div style="font-size: 11px;">Phiên bản v0.1.0</div>
        </div>
      </aside>

      <!-- Main Area -->
      <div class="main-wrapper">
        <header class="top-bar">
          <div class="page-title" id="app-top-title">Ghi nhận đơn hàng nhanh</div>
          <div class="top-actions" id="app-top-actions">
            <!-- Dynamic button depending on page -->
            <button class="btn btn-primary btn-sm" id="top-btn-new-order">
              ${icons.plus} <span>Tạo đơn mới</span>
            </button>
          </div>
        </header>

        <main class="content-viewport" id="content-viewport">
          <!-- Active Page Injected Here -->
        </main>
      </div>
    `;

    // Navigation events
    this.appRoot.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const targetPage = (e.currentTarget as HTMLElement).getAttribute('data-page') as PageId;
        if (targetPage) {
          this.navigateTo(targetPage);
        }
      });
    });

    this.appRoot.querySelector('#top-btn-new-order')?.addEventListener('click', () => {
      this.navigateTo('pos');
    });
  }

  public async navigateTo(page: PageId, param?: string): Promise<void> {
    this.currentPage = page;
    this.currentPageParam = param;

    // Update active nav state
    this.appRoot.querySelectorAll('.nav-item').forEach((item) => {
      const p = item.getAttribute('data-page');
      if (p === page || (page === 'edit-order' && p === 'orders')) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update Top bar title & actions
    const titleEl = document.getElementById('app-top-title');
    const topActions = document.getElementById('app-top-actions');

    const pageTitles: Record<PageId, string> = {
      pos: 'Ghi nhận đơn hàng',
      orders: 'Quản lý đơn hàng',
      customers: 'Quản lý khách hàng',
      analytics: 'Báo cáo & Phân tích kinh doanh',
      products: 'Danh mục bánh & Bảng giá',
      settings: 'Dữ liệu & Cài đặt hệ thống',
      'edit-order': 'Chỉnh sửa đơn hàng',
    };

    if (titleEl) {
      titleEl.textContent = pageTitles[page] || 'MunKek';
    }

    if (topActions) {
      if (page === 'pos') {
        topActions.innerHTML = `
          <button class="btn btn-secondary btn-sm" id="top-btn-view-orders">
            ${icons.orders} <span>Xem lịch sử đơn</span>
          </button>
        `;
        topActions.querySelector('#top-btn-view-orders')?.addEventListener('click', () => {
          this.navigateTo('orders');
        });
      } else {
        topActions.innerHTML = `
          <button class="btn btn-primary btn-sm" id="top-btn-new-order">
            ${icons.plus} <span>Tạo đơn mới</span>
          </button>
        `;
        topActions.querySelector('#top-btn-new-order')?.addEventListener('click', () => {
          this.navigateTo('pos');
        });
      }
    }

    const viewport = document.getElementById('content-viewport');
    if (!viewport) return;

    // Render corresponding page
    switch (page) {
      case 'pos': {
        const pos = new MainPosPage(viewport, (p, arg) => this.navigateTo(p as PageId, arg), this.currentPageParam);
        await pos.render();
        break;
      }
      case 'orders': {
        const orders = new OrdersPage(viewport, (p, arg) => this.navigateTo(p as PageId, arg));
        await orders.render();
        break;
      }
      case 'customers': {
        const customers = new CustomersPage(viewport, (p, arg) => this.navigateTo(p as PageId, arg));
        await customers.render();
        break;
      }
      case 'analytics': {
        const analytics = new AnalyticsPage(viewport, (p, arg) => this.navigateTo(p as PageId, arg));
        await analytics.render();
        break;
      }
      case 'products': {
        const products = new ProductsPage(viewport, (p, arg) => this.navigateTo(p as PageId, arg));
        await products.render();
        break;
      }
      case 'settings': {
        const settings = new SettingsPage(viewport, (p, arg) => this.navigateTo(p as PageId, arg));
        await settings.render();
        break;
      }
      case 'edit-order': {
        const form = new OrderFormPage(viewport, (p, arg) => this.navigateTo(p as PageId, arg), this.currentPageParam);
        await form.render();
        break;
      }
    }
  }

  private async checkUpdatesSilently(): Promise<void> {
    try {
      const res = await updateService.checkForUpdates(true);
      if (res.status === 'AVAILABLE') {
        showUpdateDialog(res.info);
      }
    } catch {
      // Ignore background errors completely
    }
  }

  private renderFatalError(err: unknown): void {
    this.appRoot.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-card" style="border-color: #fecaca; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
          <h2 style="font-size: 18px; font-weight: 800; color: #991b1b; margin-bottom: 8px;">
            Đã xảy ra sự cố khi mở MunKek
          </h2>
          <p style="font-size: 14px; color: #57534e; line-height: 1.5; margin-bottom: 20px;">
            Ứng dụng gặp vấn đề trong quá trình khởi động. Dữ liệu của bạn vẫn an toàn trên máy tính.
          </p>
          <div style="font-family: monospace; font-size: 12px; background: #fafaf9; border: 1px solid #e7e5e4; padding: 12px; border-radius: 8px; text-align: left; color: #dc2626; margin-bottom: 20px; word-break: break-all;">
            ${escapeHtml(err instanceof Error ? err.stack || err.message : String(err))}
          </div>
          <button class="btn btn-primary" onclick="window.location.reload()">
            🔄 Tải lại ứng dụng
          </button>
        </div>
      </div>
    `;
  }
}

// Bootstrap MunKek Application
const initMunKek = () => {
  try {
    const app = new MunKekApp();
    app.start().catch((err) => {
      console.error('Lỗi khởi động MunKek:', err);
      const root = document.getElementById('app');
      if (root) {
        root.innerHTML = `
          <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #fffbeb; padding: 24px;">
            <div style="background: white; border: 1px solid #fed7aa; border-radius: 16px; padding: 32px; max-width: 520px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">🥮</div>
              <h2 style="font-size: 20px; font-weight: 800; color: #991b1b; margin-bottom: 8px;">Không thể khởi chạy MunKek</h2>
              <p style="font-size: 14px; color: #78716c; line-height: 1.5; margin-bottom: 20px;">
                Đã xảy ra lỗi trong quá trình nạp ứng dụng. Dữ liệu bánh của bạn trên máy tính vẫn an toàn.
              </p>
              <pre style="text-align: left; background: #fafaf9; border: 1px solid #e7e5e4; padding: 12px; border-radius: 8px; font-size: 12px; color: #dc2626; overflow-x: auto; margin-bottom: 20px;">${escapeHtml(err instanceof Error ? err.stack || err.message : String(err))}</pre>
              <button style="background: #ea580c; color: white; border: none; border-radius: 8px; padding: 10px 24px; font-weight: 700; cursor: pointer;" onclick="window.location.reload()">
                🔄 Tải lại trang
              </button>
            </div>
          </div>
        `;
      }
    });
  } catch (err) {
    console.error('Lỗi tạo instance MunKek:', err);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMunKek);
} else {
  initMunKek();
}
