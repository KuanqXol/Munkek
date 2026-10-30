import { orderService, type FilterOptions } from '../services/orderService.ts';
import type { Order } from '../models/Order.ts';
import { formatCurrency, formatDate, escapeHtml, getTodayString } from '../utils/formatters.ts';
import { showOrderDetailsModal } from '../components/OrderDetailsModal.ts';
import { showConfirmModal } from '../components/ConfirmModal.ts';
import { toast } from '../components/Toast.ts';
import { icons } from '../utils/icons.ts';

export class OrdersPage {
  private container: HTMLElement;
  private onNavigate: (page: string, param?: string) => void;

  private currentFilters: FilterOptions = {
    searchQuery: '',
    startDate: '',
    endDate: '',
    sortBy: 'newest',
  };

  private activePeriodQuick: 'all' | 'today' | '7days' | 'month' = 'all';

  constructor(container: HTMLElement, onNavigate: (page: string, param?: string) => void) {
    this.container = container;
    this.onNavigate = onNavigate;
  }

  public async render(): Promise<void> {
    await orderService.getAllOrders();
    this.renderLayout();
    this.applyFiltersAndRenderTable();
  }

  private renderLayout(): void {
    this.container.innerHTML = `
      <div class="orders-page-header">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">
            Quản lý Đơn hàng
          </h2>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
            Tra cứu lịch sử đơn, tìm kiếm thông tin khách, sửa đổi hoặc xóa đơn hàng
          </p>
        </div>
        <button class="btn btn-primary" id="orders-btn-create">
          ${icons.plus} <span>Tạo đơn mới</span>
        </button>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="filter-bar">
        <!-- Search Input -->
        <div class="search-input-wrap">
          <span class="search-icon">${icons.search}</span>
          <input
            type="text"
            id="orders-search-input"
            class="form-control"
            placeholder="Tìm theo tên khách, SĐT, tên bánh, ghi chú, mã đơn..."
            value="${escapeHtml(this.currentFilters.searchQuery || '')}"
          />
        </div>

        <!-- Quick Period Filter -->
        <div class="orders-quick-filters">
          <button class="btn btn-secondary btn-sm quick-filter-btn ${this.activePeriodQuick === 'all' ? 'active' : ''}" data-p="all">
            Tất cả
          </button>
          <button class="btn btn-secondary btn-sm quick-filter-btn ${this.activePeriodQuick === 'today' ? 'active' : ''}" data-p="today">
            Hôm nay
          </button>
          <button class="btn btn-secondary btn-sm quick-filter-btn ${this.activePeriodQuick === '7days' ? 'active' : ''}" data-p="7days">
            7 ngày
          </button>
          <button class="btn btn-secondary btn-sm quick-filter-btn ${this.activePeriodQuick === 'month' ? 'active' : ''}" data-p="month">
            Tháng này
          </button>
        </div>

        <!-- Sort Select -->
        <div style="display: flex; align-items: center; gap: 6px;">
          <select id="orders-filter-sort" class="filter-select" style="min-width: 140px;">
            <option value="newest" ${this.currentFilters.sortBy === 'newest' ? 'selected' : ''}>Mới nhất</option>
            <option value="oldest" ${this.currentFilters.sortBy === 'oldest' ? 'selected' : ''}>Cũ nhất</option>
            <option value="total-desc" ${this.currentFilters.sortBy === 'total-desc' ? 'selected' : ''}>Giá trị cao nhất</option>
            <option value="total-asc" ${this.currentFilters.sortBy === 'total-asc' ? 'selected' : ''}>Giá trị thấp nhất</option>
          </select>
        </div>

        <!-- Reset Button -->
        <button class="btn btn-secondary btn-sm" id="orders-btn-reset-filters" title="Xóa bộ lọc">
          ${icons.refresh} <span>Đặt lại</span>
        </button>
      </div>

      <!-- Orders Table Container -->
      <div id="orders-table-wrapper"></div>
    `;

    this.attachToolbarEvents();
  }

  private attachToolbarEvents(): void {
    const searchInput = this.container.querySelector('#orders-search-input') as HTMLInputElement;
    const sortSelect = this.container.querySelector('#orders-filter-sort') as HTMLSelectElement;
    const resetBtn = this.container.querySelector('#orders-btn-reset-filters');
    const createBtn = this.container.querySelector('#orders-btn-create');

    createBtn?.addEventListener('click', () => {
      this.onNavigate('pos');
    });

    searchInput?.addEventListener('input', () => {
      this.currentFilters.searchQuery = searchInput.value;
      this.applyFiltersAndRenderTable();
    });

    sortSelect?.addEventListener('change', () => {
      this.currentFilters.sortBy = sortSelect.value as 'newest' | 'oldest' | 'total-desc' | 'total-asc';
      this.applyFiltersAndRenderTable();
    });

    // Quick period buttons
    this.container.querySelectorAll('.quick-filter-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const p = (e.currentTarget as HTMLElement).getAttribute('data-p') as 'all' | 'today' | '7days' | 'month';
        this.activePeriodQuick = p;

        this.container.querySelectorAll('.quick-filter-btn').forEach((b) => b.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');

        const today = getTodayString();
        if (p === 'today') {
          this.currentFilters.startDate = today;
          this.currentFilters.endDate = today;
        } else if (p === '7days') {
          const d = new Date();
          d.setDate(d.getDate() - 6);
          this.currentFilters.startDate = d.toISOString().split('T')[0];
          this.currentFilters.endDate = today;
        } else if (p === 'month') {
          const now = new Date();
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          this.currentFilters.startDate = firstDay;
          this.currentFilters.endDate = today;
        } else {
          this.currentFilters.startDate = '';
          this.currentFilters.endDate = '';
        }

        this.applyFiltersAndRenderTable();
      });
    });

    resetBtn?.addEventListener('click', () => {
      this.currentFilters = {
        searchQuery: '',
        startDate: '',
        endDate: '',
        sortBy: 'newest',
      };
      this.activePeriodQuick = 'all';
      if (searchInput) searchInput.value = '';
      if (sortSelect) sortSelect.value = 'newest';
      this.container.querySelectorAll('.quick-filter-btn').forEach((b) => b.classList.remove('active'));
      this.container.querySelector('.quick-filter-btn[data-p="all"]')?.classList.add('active');
      this.applyFiltersAndRenderTable();
    });
  }

  private applyFiltersAndRenderTable(): void {
    const tableWrapper = this.container.querySelector('#orders-table-wrapper');
    if (!tableWrapper) return;

    const filtered = orderService.filterOrders(this.currentFilters);
    const totalRevenue = filtered.reduce((sum, o) => sum + (o.finalTotal || o.total || 0), 0);
    const totalItems = filtered.reduce((sum, o) => {
      const items = o.items || [];
      return sum + (items.length > 0 ? items.reduce((s, it) => s + (it.quantity || 1), 0) : o.quantity || 1);
    }, 0);

    if (filtered.length === 0) {
      tableWrapper.innerHTML = `
        <div class="card empty-state">
          <div class="empty-state-icon">
            ${icons.orders}
          </div>
          <div class="empty-state-title">Không tìm thấy đơn hàng nào</div>
          <p style="margin-bottom: 16px; font-size: 14px;">
            Thử thay đổi từ khóa tìm kiếm, chọn bộ lọc thời gian khác hoặc tạo đơn mới.
          </p>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button class="btn btn-secondary" id="btn-empty-reset">
              Xem tất cả đơn
            </button>
            <button class="btn btn-primary" id="btn-empty-add-order">
              ${icons.plus} Tạo đơn hàng mới
            </button>
          </div>
        </div>
      `;

      tableWrapper.querySelector('#btn-empty-reset')?.addEventListener('click', () => {
        this.currentFilters = {
          searchQuery: '',
          startDate: '',
          endDate: '',
          sortBy: 'newest',
        };
        this.activePeriodQuick = 'all';
        this.render();
      });

      tableWrapper.querySelector('#btn-empty-add-order')?.addEventListener('click', () => {
        this.onNavigate('pos');
      });
      return;
    }

    tableWrapper.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 105px;">Mã đơn</th>
              <th style="width: 120px;">Ngày tạo</th>
              <th>Khách hàng</th>
              <th>Chi tiết bánh đặt</th>
              <th style="text-align: right; width: 130px;">Tạm tính</th>
              <th style="text-align: right; width: 120px;">Giảm giá</th>
              <th style="text-align: right; width: 140px;">Tổng thanh toán</th>
              <th style="text-align: right; width: 140px;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((order) => this.renderTableRow(order)).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 12px; font-size: 13px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <span>Hiển thị <strong>${filtered.length}</strong> đơn hàng • Tổng: <strong>${totalItems}</strong> bánh</span>
        <span style="font-size: 14px; color: var(--text-primary);">Tổng doanh số danh sách: <strong style="color: var(--primary); font-size: 16px;">${formatCurrency(totalRevenue)}</strong></span>
      </div>
    `;

    this.attachTableActionEvents(tableWrapper);
  }

  private renderTableRow(order: Order): string {
    const items = order.items || [];
    const totalQty = items.length > 0 ? items.reduce((sum, it) => sum + (it.quantity || 1), 0) : order.quantity || 1;
    const itemsSummary =
      items.length > 0
        ? items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')
        : order.productName;

    const subtotal = order.subtotal ?? order.total;
    const discountAmount = order.discountAmount || 0;
    const finalTotal = order.finalTotal ?? order.total;

    return `
      <tr class="order-table-row" data-order-id="${escapeHtml(order.id)}" style="cursor: pointer;">
        <td style="font-weight: 700; color: var(--primary); font-family: monospace;">
          ${escapeHtml(order.id)}
        </td>
        <td style="font-size: 12px; color: var(--text-secondary);">
          ${formatDate(order.orderDate)}
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary);">
            ${escapeHtml(order.customer?.name || order.customerName || 'Khách vãng lai')}
          </div>
          ${
            order.customer?.phone || order.phone
              ? `<div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(order.customer?.phone || order.phone)}</div>`
              : ''
          }
        </td>
        <td style="max-width: 260px;">
          <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600;" title="${escapeHtml(itemsSummary)}">
            ${escapeHtml(itemsSummary)}
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">
            Số lượng: <strong>${totalQty}</strong> chiếc/hộp
          </div>
        </td>
        <td style="text-align: right; color: var(--text-secondary); font-size: 13px;">
          ${formatCurrency(subtotal)}
        </td>
        <td style="text-align: right;">
          ${
            discountAmount > 0
              ? `<span style="color: #dc2626; font-weight: 700; font-size: 13px;">-${formatCurrency(discountAmount)}</span>`
              : `<span style="color: var(--text-muted); font-size: 12px;">0đ</span>`
          }
        </td>
        <td style="text-align: right;">
          <div style="font-weight: 800; color: var(--primary); font-size: 15px;">
            ${formatCurrency(finalTotal)}
          </div>
        </td>
        <td style="text-align: right;" onclick="event.stopPropagation();">
          <div style="display: flex; justify-content: flex-end; gap: 4px;">
            <button class="btn btn-secondary btn-sm btn-order-view" data-id="${escapeHtml(order.id)}" title="Xem chi tiết">
              ${icons.eye}
            </button>
            <button class="btn btn-secondary btn-sm btn-order-edit" data-id="${escapeHtml(order.id)}" title="Chỉnh sửa đơn">
              ${icons.edit}
            </button>
            <button class="btn btn-secondary btn-sm btn-order-delete" data-id="${escapeHtml(order.id)}" title="Xóa đơn" style="color: #dc2626;">
              ${icons.trash}
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  private attachTableActionEvents(container: Element): void {
    // Click on row to view details
    container.querySelectorAll('.order-table-row').forEach((row) => {
      row.addEventListener('click', async () => {
        const id = row.getAttribute('data-order-id');
        if (!id) return;
        const order = await orderService.getOrderById(id);
        if (order) {
          showOrderDetailsModal(order, (editId) => this.onNavigate('edit-order', editId));
        }
      });
    });

    // View button
    container.querySelectorAll('.btn-order-view').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-id');
        if (!id) return;
        const order = await orderService.getOrderById(id);
        if (order) {
          showOrderDetailsModal(order, (editId) => this.onNavigate('edit-order', editId));
        }
      });
    });

    // Edit button
    container.querySelectorAll('.btn-order-edit').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-id');
        if (id) {
          this.onNavigate('edit-order', id);
        }
      });
    });

    // Delete button with safe confirm modal
    container.querySelectorAll('.btn-order-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-id');
        if (!id) return;

        const order = await orderService.getOrderById(id);
        const customerName = order?.customer?.name || order?.customerName || 'khách này';

        const confirmed = await showConfirmModal({
          title: `Xác nhận xóa đơn hàng ${id}`,
          message: `Bạn có chắc chắn muốn xóa đơn bánh của ${customerName}? Hành động này sẽ loại bỏ đơn khỏi danh sách và cập nhật lại thống kê.`,
          confirmText: 'Xóa đơn hàng',
          cancelText: 'Giữ lại',
          isDanger: true,
        });

        if (confirmed) {
          await orderService.deleteOrder(id);
          toast.show('Thành công', `Đã xóa đơn hàng ${id}.`, 'info');
          this.applyFiltersAndRenderTable();
        }
      });
    });
  }
}
