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
        this.renderSetupScreen();
        return;
      }

      if (initResult.status === 'UNAVAILABLE') {
        this.renderRecoveryScreen(initResult.message || 'Không thể truy cập thư mục dữ liệu.');
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
  private renderSetupScreen(): void {
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
          <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px;">
            Để bảo toàn toàn bộ đơn hàng và danh mục bánh khi bạn cập nhật phần mềm, vui lòng chọn một thư mục lưu trữ dữ liệu trên máy tính. Bạn chỉ cần chọn một lần duy nhất.
          </p>

          <div style="background: #faf8f5; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; margin-bottom: 24px;">
            <div style="font-size: 13px; font-weight: 700; color: var(--primary); margin-bottom: 4px;">
              🛡️ An toàn dữ liệu tuyệt đối:
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
              Bạn có thể chọn một thư mục bất kỳ (ví dụ trong ổ <code>D:</code> hoặc <code>Documents</code>). Các bản cập nhật sau này từ GitHub sẽ không bao giờ làm mất dữ liệu của bạn.
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <button class="btn btn-primary btn-lg" id="btn-setup-pick-folder" style="width: 100%;">
              <span>📂</span> Chọn thư mục lưu trữ dữ liệu
            </button>
            <button class="btn btn-secondary" id="btn-setup-use-default" style="width: 100%;">
              Sử dụng thư mục mặc định (./data)
            </button>
          </div>
        </div>
      </div>
    `;

    this.appRoot.querySelector('#btn-setup-pick-folder')?.addEventListener('click', async () => {
      try {
        const selected = await storageService.pickDataFolder();
        if (selected) {
          toast.show('Thành công', `Đã kết nối thư mục dữ liệu: ${selected}`, 'success');
          await this.loadAndLaunch();
        }
      } catch (err) {
        toast.show('Thông báo', String(err instanceof Error ? err.message : err), 'error');
      }
    });

    this.appRoot.querySelector('#btn-setup-use-default')?.addEventListener('click', async () => {
      try {
        await storageService.setupDataFolder('./data');
        toast.show('Thành công', 'Đã khởi tạo thư mục dữ liệu mặc định.', 'success');
        await this.loadAndLaunch();
      } catch (err) {
        toast.show('Lỗi', String(err instanceof Error ? err.message : err), 'error');
      }
    });
  }

  /**
   * Recovery Screen: Shown when configured data folder is missing or disconnected
   */
  private renderRecoveryScreen(message: string): void {
    const currentPath = storageService.getDataFolderPath();

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

          <div style="background: #fafaf9; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 14px; font-family: monospace; font-size: 12px; word-break: break-all; color: var(--text-primary); margin-bottom: 20px;">
            Đường dẫn: ${escapeHtml(currentPath)}
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button class="btn btn-primary" id="btn-recovery-retry" style="width: 100%;">
              <span>🔄</span> Thử kết nối lại
            </button>
            <button class="btn btn-secondary" id="btn-recovery-pick" style="width: 100%;">
              <span>📂</span> Chọn thư mục dữ liệu khác
            </button>
            <button class="btn btn-secondary" id="btn-recovery-default" style="width: 100%;">
              Sử dụng thư mục mặc định (./data)
            </button>
          </div>
        </div>
      </div>
    `;

    this.appRoot.querySelector('#btn-recovery-retry')?.addEventListener('click', () => {
      window.location.reload();
    });

    this.appRoot.querySelector('#btn-recovery-pick')?.addEventListener('click', async () => {
      try {
        const selected = await storageService.pickDataFolder();
        if (selected) {
          toast.show('Thành công', 'Đã đổi thư mục dữ liệu thành công.', 'success');
          await this.loadAndLaunch();
        }
      } catch (err) {
        toast.show('Lỗi', String(err instanceof Error ? err.message : err), 'error');
      }
    });

    this.appRoot.querySelector('#btn-recovery-default')?.addEventListener('click', async () => {
      try {
        await storageService.setupDataFolder('./data');
        toast.show('Thành công', 'Đã kết nối lại thư mục mặc định.', 'success');
        await this.loadAndLaunch();
      } catch (err) {
        toast.show('Lỗi', String(err instanceof Error ? err.message : err), 'error');
      }
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
