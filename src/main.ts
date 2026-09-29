import './styles/main.css';
import { orderService } from './services/orderService';
import { updateService } from './services/updateService';
import { showUpdateDialog } from './components/UpdateDialog';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderFormPage } from './pages/OrderFormPage';
import { SettingsPage } from './pages/SettingsPage';

type PageId = 'dashboard' | 'orders' | 'add-order' | 'edit-order' | 'settings';

class MunKekApp {
  private currentPage: PageId = 'dashboard';
  private currentPageParam?: string;
  private appRoot: HTMLElement;

  constructor() {
    const root = document.getElementById('app');
    if (!root) throw new Error('Không tìm thấy element #app');
    this.appRoot = root;
  }

  public async start(): Promise<void> {
    try {
      // 1. Initialize data from storage
      await orderService.init();

      // 2. Render main application shell
      this.renderAppShell();

      // 3. Render active page
      await this.navigateTo(this.currentPage);

      // 4. Perform silent background update check (never blocks UI or crashes offline)
      this.checkUpdatesSilently();
    } catch (err) {
      console.error('Lỗi khi khởi chạy ứng dụng MunKek:', err);
      this.renderFatalError(err);
    }
  }

  private renderAppShell(): void {
    this.appRoot.innerHTML = `
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="brand-icon">🍰</div>
          <div class="brand-text">
            <h1>MunKek</h1>
            <p>Quản lý Đơn Bánh Ngọt</p>
          </div>
        </div>

        <nav class="sidebar-nav">
          <button class="nav-item ${this.currentPage === 'dashboard' ? 'active' : ''}" data-page="dashboard">
            <span class="nav-icon">📊</span>
            <span>Tổng quan</span>
          </button>
          <button class="nav-item ${this.currentPage === 'orders' ? 'active' : ''}" data-page="orders">
            <span class="nav-icon">🎂</span>
            <span>Đơn hàng</span>
          </button>
          <button class="nav-item ${this.currentPage === 'add-order' ? 'active' : ''}" data-page="add-order">
            <span class="nav-icon">➕</span>
            <span>Thêm đơn</span>
          </button>
          <button class="nav-item ${this.currentPage === 'settings' ? 'active' : ''}" data-page="settings">
            <span class="nav-icon">⚙️</span>
            <span>Dữ liệu / Cài đặt</span>
          </button>
        </nav>

        <div class="sidebar-footer">
          <div class="status-badge-offline">
            <span class="status-dot"></span>
            <span>Hoạt động Offline</span>
          </div>
          <div>Phiên bản v0.1.0</div>
        </div>
      </aside>

      <!-- Main Area -->
      <div class="main-wrapper">
        <header class="top-bar">
          <div class="page-title" id="app-top-title">Tổng quan</div>
          <div class="top-actions">
            <button class="btn btn-primary btn-sm" id="top-btn-new-order">
              <span>➕</span> Đơn mới
            </button>
          </div>
        </header>

        <main class="content-viewport" id="content-viewport">
          <!-- Dynamic page content will be injected here -->
        </main>
      </div>
    `;

    // Attach navigation button handlers
    this.appRoot.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const targetPage = (e.currentTarget as HTMLElement).getAttribute('data-page') as PageId;
        if (targetPage) {
          this.navigateTo(targetPage);
        }
      });
    });

    this.appRoot.querySelector('#top-btn-new-order')?.addEventListener('click', () => {
      this.navigateTo('add-order');
    });
  }

  public async navigateTo(page: PageId, param?: string): Promise<void> {
    this.currentPage = page;
    this.currentPageParam = param;

    // Update active nav item state
    this.appRoot.querySelectorAll('.nav-item').forEach((item) => {
      const p = item.getAttribute('data-page');
      if (p === page || (page === 'edit-order' && p === 'orders')) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update Top bar title
    const titleEl = document.getElementById('app-top-title');
    const pageTitles: Record<PageId, string> = {
      dashboard: 'Tổng quan tiệm bánh',
      orders: 'Danh sách đơn hàng',
      'add-order': 'Thêm đơn hàng mới',
      'edit-order': 'Chỉnh sửa đơn hàng',
      settings: 'Dữ liệu & Cài đặt',
    };
    if (titleEl) {
      titleEl.textContent = pageTitles[page] || 'MunKek';
    }

    const viewport = document.getElementById('content-viewport');
    if (!viewport) return;

    // Render corresponding page
    switch (page) {
      case 'dashboard': {
        const dashboard = new DashboardPage(viewport, (p, arg) => this.navigateTo(p as PageId, arg));
        await dashboard.render();
        break;
      }
      case 'orders': {
        const orders = new OrdersPage(viewport, (p, arg) => this.navigateTo(p as PageId, arg));
        await orders.render();
        break;
      }
      case 'add-order': {
        const form = new OrderFormPage(viewport, (p, arg) => this.navigateTo(p as PageId, arg));
        await form.render();
        break;
      }
      case 'edit-order': {
        const form = new OrderFormPage(viewport, (p, arg) => this.navigateTo(p as PageId, arg), this.currentPageParam);
        await form.render();
        break;
      }
      case 'settings': {
        const settings = new SettingsPage(viewport, (p, arg) => this.navigateTo(p as PageId, arg));
        await settings.render();
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
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; width: 100vw; background: #fff5f5; padding: 24px; text-align: center;">
        <div style="max-width: 500px; background: white; border: 1px solid #fecaca; border-radius: 16px; padding: 32px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
          <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
          <h2 style="font-size: 20px; font-weight: 800; color: #991b1b; margin-bottom: 8px;">Đã xảy ra sự cố khi mở MunKek</h2>
          <p style="font-size: 14px; color: #57534e; line-height: 1.5; margin-bottom: 20px;">
            Ứng dụng gặp vấn đề trong quá trình khởi động dữ liệu. Dữ liệu của bạn vẫn an toàn trên máy.
          </p>
          <div style="font-family: monospace; font-size: 12px; background: #fafaf9; border: 1px solid #e7e5e4; padding: 12px; border-radius: 8px; text-align: left; color: #dc2626; margin-bottom: 20px; word-break: break-all;">
            ${err instanceof Error ? err.stack || err.message : String(err)}
          </div>
          <button class="btn btn-primary" onclick="window.location.reload()">
            🔄 Tải lại ứng dụng
          </button>
        </div>
      </div>
    `;
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new MunKekApp();
  app.start();
});
