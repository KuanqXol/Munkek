import { orderService, FilterOptions } from '../services/orderService';
import { Order, OrderStatus, ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_CLASSES } from '../models/Order';
import { formatCurrency, formatDate } from '../utils/formatters';
import { showOrderDetailsModal } from '../components/OrderDetailsModal';
import { showConfirmModal } from '../components/ConfirmModal';
import { toast } from '../components/Toast';

export class OrdersPage {
  private container: HTMLElement;
  private onNavigate: (page: string, param?: string) => void;
  private currentFilters: FilterOptions = {
    searchQuery: '',
    status: 'all',
    startDate: '',
    endDate: '',
    sortBy: 'newest',
  };

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
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h2 style="font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">Quản lý Đơn hàng</h2>
          <p style="font-size: 14px; color: var(--text-muted); margin-top: 2px;">Tìm kiếm, tra cứu và theo dõi trạng thái các đơn bánh</p>
        </div>
        <button class="btn btn-primary btn-lg" id="orders-btn-create">
          <span style="font-size: 18px;">➕</span> Thêm đơn mới
        </button>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="filter-bar">
        <!-- Search Input -->
        <div class="search-input-wrap">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            id="orders-search-input"
            class="form-control"
            placeholder="Tìm theo tên khách, SĐT, tên bánh hoặc mã đơn..."
            value="${this.currentFilters.searchQuery || ''}"
          />
        </div>

        <!-- Status Filter -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary); white-space: nowrap;">Trạng thái:</label>
          <select id="orders-filter-status" class="filter-select">
            <option value="all" ${this.currentFilters.status === 'all' ? 'selected' : ''}>Tất cả</option>
            <option value="pending" ${this.currentFilters.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
            <option value="preparing" ${this.currentFilters.status === 'preparing' ? 'selected' : ''}>Đang làm</option>
            <option value="completed" ${this.currentFilters.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
            <option value="cancelled" ${this.currentFilters.status === 'cancelled' ? 'selected' : ''}>Đã hủy</option>
          </select>
        </div>

        <!-- Date Range Filter -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary); white-space: nowrap;">Từ:</label>
          <input
            type="date"
            id="orders-filter-start-date"
            class="form-control"
            style="padding: 8px 12px; font-size: 13px; width: 140px;"
            value="${this.currentFilters.startDate || ''}"
          />
          <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary); white-space: nowrap;">Đến:</label>
          <input
            type="date"
            id="orders-filter-end-date"
            class="form-control"
            style="padding: 8px 12px; font-size: 13px; width: 140px;"
            value="${this.currentFilters.endDate || ''}"
          />
        </div>

        <!-- Sort -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary); white-space: nowrap;">Sắp xếp:</label>
          <select id="orders-filter-sort" class="filter-select">
            <option value="newest" ${this.currentFilters.sortBy === 'newest' ? 'selected' : ''}>Mới nhất</option>
            <option value="oldest" ${this.currentFilters.sortBy === 'oldest' ? 'selected' : ''}>Cũ nhất</option>
          </select>
        </div>

        <!-- Reset Button -->
        <button class="btn btn-secondary btn-sm" id="orders-btn-reset-filters" title="Xóa bộ lọc">
          <span>🔄</span> Đặt lại
        </button>
      </div>

      <!-- Orders Table Container -->
      <div id="orders-table-wrapper"></div>
    `;

    this.attachToolbarEvents();
  }

  private attachToolbarEvents(): void {
    const searchInput = this.container.querySelector('#orders-search-input') as HTMLInputElement;
    const statusSelect = this.container.querySelector('#orders-filter-status') as HTMLSelectElement;
    const startDateInput = this.container.querySelector('#orders-filter-start-date') as HTMLInputElement;
    const endDateInput = this.container.querySelector('#orders-filter-end-date') as HTMLInputElement;
    const sortSelect = this.container.querySelector('#orders-filter-sort') as HTMLSelectElement;
    const resetBtn = this.container.querySelector('#orders-btn-reset-filters');
    const createBtn = this.container.querySelector('#orders-btn-create');

    createBtn?.addEventListener('click', () => {
      this.onNavigate('add-order');
    });

    searchInput?.addEventListener('input', () => {
      this.currentFilters.searchQuery = searchInput.value;
      this.applyFiltersAndRenderTable();
    });

    statusSelect?.addEventListener('change', () => {
      this.currentFilters.status = statusSelect.value as OrderStatus | 'all';
      this.applyFiltersAndRenderTable();
    });

    startDateInput?.addEventListener('change', () => {
      this.currentFilters.startDate = startDateInput.value;
      this.applyFiltersAndRenderTable();
    });

    endDateInput?.addEventListener('change', () => {
      this.currentFilters.endDate = endDateInput.value;
      this.applyFiltersAndRenderTable();
    });

    sortSelect?.addEventListener('change', () => {
      this.currentFilters.sortBy = sortSelect.value as 'newest' | 'oldest';
      this.applyFiltersAndRenderTable();
    });

    resetBtn?.addEventListener('click', () => {
      this.currentFilters = {
        searchQuery: '',
        status: 'all',
        startDate: '',
        endDate: '',
        sortBy: 'newest',
      };
      searchInput.value = '';
      statusSelect.value = 'all';
      startDateInput.value = '';
      endDateInput.value = '';
      sortSelect.value = 'newest';
      this.applyFiltersAndRenderTable();
    });
  }

  private applyFiltersAndRenderTable(): void {
    const tableWrapper = this.container.querySelector('#orders-table-wrapper');
    if (!tableWrapper) return;

    const filtered = orderService.filterOrders(this.currentFilters);

    if (filtered.length === 0) {
      tableWrapper.innerHTML = `
        <div class="card empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">Không tìm thấy đơn hàng nào</div>
          <p style="margin-bottom: 16px;">Không có đơn hàng nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại.</p>
          <button class="btn btn-primary" id="btn-empty-add">
            ➕ Thêm đơn hàng mới
          </button>
        </div>
      `;
      tableWrapper.querySelector('#btn-empty-add')?.addEventListener('click', () => {
        this.onNavigate('add-order');
      });
      return;
    }

    tableWrapper.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Số điện thoại</th>
              <th>Sản phẩm</th>
              <th>SL</th>
              <th>Tổng tiền</th>
              <th>Ngày đặt</th>
              <th>Ngày giao</th>
              <th>Trạng thái</th>
              <th style="text-align: right;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((order) => this.renderTableRow(order)).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 12px; font-size: 13px; color: var(--text-muted); display: flex; justify-content: space-between;">
        <span>Hiển thị <strong>${filtered.length}</strong> đơn hàng</span>
        <span>Tổng giá trị: <strong>${formatCurrency(
          filtered.filter((o) => o.status !== 'cancelled').reduce((acc, o) => acc + o.total, 0)
        )}</strong></span>
      </div>
    `;

    this.attachTableActionEvents(tableWrapper);
  }

  private renderTableRow(order: Order): string {
    const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
    const statusBadge = ORDER_STATUS_BADGE_CLASSES[order.status] || 'badge-pending';

    return `
      <tr data-order-id="${order.id}">
        <td><strong style="color: var(--primary);">${order.id}</strong></td>
        <td>
          <div style="font-weight: 700;">${order.customerName}</div>
        </td>
        <td>${order.phone || '<span style="color: var(--text-muted);">-</span>'}</td>
        <td>${order.productName}</td>
        <td><strong>${order.quantity}</strong></td>
        <td><strong style="color: var(--text-primary);">${formatCurrency(order.total)}</strong></td>
        <td>${formatDate(order.orderDate)}</td>
        <td><strong>${formatDate(order.deliveryDate)}</strong></td>
        <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm btn-action-view" data-id="${order.id}" title="Xem chi tiết">
            👁️ Xem
          </button>
          <button class="btn btn-secondary btn-sm btn-action-edit" data-id="${order.id}" style="margin-left: 4px;" title="Chỉnh sửa">
            ✏️ Sửa
          </button>
          <button class="btn btn-danger btn-sm btn-action-delete" data-id="${order.id}" style="margin-left: 4px;" title="Xóa đơn">
            🗑️ Xóa
          </button>
        </td>
      </tr>
    `;
  }

  private attachTableActionEvents(wrapper: Element): void {
    // View details
    wrapper.querySelectorAll('.btn-action-view').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id) {
          const order = await orderService.getOrderById(id);
          if (order) {
            showOrderDetailsModal(order, (editId) => {
              this.onNavigate('edit-order', editId);
            });
          }
        }
      });
    });

    // Edit
    wrapper.querySelectorAll('.btn-action-edit').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id) {
          this.onNavigate('edit-order', id);
        }
      });
    });

    // Delete with confirmation modal
    wrapper.querySelectorAll('.btn-action-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (!id) return;

        const order = await orderService.getOrderById(id);
        if (!order) return;

        const confirmed = await showConfirmModal({
          title: `Xóa đơn hàng ${order.id}`,
          message: `Bạn có chắc chắn muốn xóa đơn hàng của khách hàng "${order.customerName}" (Mã: ${order.id} - Bánh: ${order.productName}) không? Dữ liệu đơn này sẽ bị xóa vĩnh viễn khỏi hệ thống.`,
          confirmText: 'Xóa đơn này',
          cancelText: 'Hủy',
          isDanger: true,
        });

        if (confirmed) {
          const success = await orderService.deleteOrder(order.id);
          if (success) {
            toast.show('Đã xóa', `Đã xóa thành công đơn hàng ${order.id}`, 'success');
            this.applyFiltersAndRenderTable();
          } else {
            toast.show('Lỗi', 'Không thể xóa đơn hàng.', 'error');
          }
        }
      });
    });
  }
}
