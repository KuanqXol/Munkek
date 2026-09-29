import { orderService } from '../services/orderService';
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_CLASSES } from '../models/Order';
import { formatCurrency, formatDate, getTodayString, getDeliveryUrgency } from '../utils/formatters';
import { showOrderDetailsModal } from '../components/OrderDetailsModal';

export class DashboardPage {
  private container: HTMLElement;
  private onNavigate: (page: string, param?: string) => void;

  constructor(container: HTMLElement, onNavigate: (page: string, param?: string) => void) {
    this.container = container;
    this.onNavigate = onNavigate;
  }

  public async render(): Promise<void> {
    const orders = await orderService.getAllOrders();
    const todayStr = getTodayString();
    const currentMonthPrefix = todayStr.substring(0, 7); // YYYY-MM

    // Metrics calculations
    const totalOrdersCount = orders.length;

    // Orders placed today
    const ordersTodayCount = orders.filter((o) => o.orderDate === todayStr).length;

    // Pending or Preparing orders
    const pendingOrdersCount = orders.filter(
      (o) => o.status === 'pending' || o.status === 'preparing'
    ).length;

    // Revenue calculations (Excluding cancelled orders)
    const validOrders = orders.filter((o) => o.status !== 'cancelled');

    const revenueToday = validOrders
      .filter((o) => o.orderDate === todayStr)
      .reduce((sum, o) => sum + o.total, 0);

    const revenueThisMonth = validOrders
      .filter((o) => o.orderDate && o.orderDate.startsWith(currentMonthPrefix))
      .reduce((sum, o) => sum + o.total, 0);

    const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);

    // Upcoming deliveries: orders not completed and not cancelled, sorted by deliveryDate ascending
    const upcomingOrders = orders
      .filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
      .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
      .slice(0, 8); // Top 8 soonest

    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">Tổng quan tiệm bánh MunKek</h2>
          <p style="font-size: 14px; color: var(--text-muted); margin-top: 2px;">Số liệu cập nhật theo thời gian thực tại máy của bạn</p>
        </div>
        <button class="btn btn-primary btn-lg" id="dash-btn-add-order">
          <span style="font-size: 18px;">➕</span> Thêm đơn mới
        </button>
      </div>

      <!-- Metrics Grid -->
      <div class="dashboard-metrics-grid">
        <!-- Metric 1: Total Orders -->
        <div class="metric-card">
          <div class="metric-icon-wrap icon-amber">🎂</div>
          <div class="metric-content">
            <div class="metric-label">Tổng số đơn</div>
            <div class="metric-value">${totalOrdersCount} <span style="font-size: 14px; font-weight: 500; color: var(--text-muted);">đơn</span></div>
            <div class="metric-sub">Tất cả đơn trong hệ thống</div>
          </div>
        </div>

        <!-- Metric 2: Orders Today -->
        <div class="metric-card">
          <div class="metric-icon-wrap icon-blue">📅</div>
          <div class="metric-content">
            <div class="metric-label">Số đơn hôm nay</div>
            <div class="metric-value">${ordersTodayCount} <span style="font-size: 14px; font-weight: 500; color: var(--text-muted);">đơn</span></div>
            <div class="metric-sub">Ngày ${formatDate(todayStr)}</div>
          </div>
        </div>

        <!-- Metric 3: Incomplete Orders -->
        <div class="metric-card">
          <div class="metric-icon-wrap icon-purple">⏳</div>
          <div class="metric-content">
            <div class="metric-label">Đơn chưa hoàn thành</div>
            <div class="metric-value" style="color: #b45309;">${pendingOrdersCount} <span style="font-size: 14px; font-weight: 500; color: var(--text-muted);">đơn</span></div>
            <div class="metric-sub">Cần chuẩn bị & bàn giao</div>
          </div>
        </div>

        <!-- Metric 4: Revenue Today -->
        <div class="metric-card">
          <div class="metric-icon-wrap icon-orange">💰</div>
          <div class="metric-content">
            <div class="metric-label">Doanh thu hôm nay</div>
            <div class="metric-value" style="color: var(--primary);">${formatCurrency(revenueToday)}</div>
            <div class="metric-sub">Không gồm đơn đã hủy</div>
          </div>
        </div>

        <!-- Metric 5: Revenue This Month -->
        <div class="metric-card">
          <div class="metric-icon-wrap icon-rose">📈</div>
          <div class="metric-content">
            <div class="metric-label">Doanh thu tháng này</div>
            <div class="metric-value">${formatCurrency(revenueThisMonth)}</div>
            <div class="metric-sub">Tháng ${todayStr.substring(5, 7)}/${todayStr.substring(0, 4)}</div>
          </div>
        </div>

        <!-- Metric 6: Total Revenue -->
        <div class="metric-card">
          <div class="metric-icon-wrap icon-emerald">💎</div>
          <div class="metric-content">
            <div class="metric-label">Tổng doanh thu</div>
            <div class="metric-value" style="color: #15803d;">${formatCurrency(totalRevenue)}</div>
            <div class="metric-sub">Toàn bộ thời gian hoạt động</div>
          </div>
        </div>
      </div>

      <!-- Upcoming Deliveries Section -->
      <div class="upcoming-section">
        <div class="section-header">
          <div class="section-title">
            <span>⏰</span>
            <span>Đơn hàng sắp tới ngày giao bánh</span>
          </div>
          <button class="btn btn-secondary btn-sm" id="dash-btn-view-all">
            Xem tất cả đơn hàng →
          </button>
        </div>

        ${
          upcomingOrders.length === 0
            ? `
          <div class="empty-state">
            <div class="empty-state-icon">🎉</div>
            <div class="empty-state-title">Không có đơn hàng nào sắp tới hạn giao!</div>
            <p>Tất cả các đơn đã được bàn giao hoặc chưa có đơn hàng mới.</p>
          </div>
        `
            : `
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Số điện thoại</th>
                  <th>Loại bánh</th>
                  <th>Số lượng</th>
                  <th>Tổng tiền</th>
                  <th>Ngày giao</th>
                  <th>Thời hạn</th>
                  <th>Trạng thái</th>
                  <th style="text-align: right;">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${upcomingOrders
                  .map((order) => {
                    const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
                    const statusBadge = ORDER_STATUS_BADGE_CLASSES[order.status] || 'badge-pending';
                    const urgency = getDeliveryUrgency(order.deliveryDate, order.status);

                    return `
                    <tr data-order-id="${order.id}">
                      <td><strong style="color: var(--primary);">${order.id}</strong></td>
                      <td><strong>${order.customerName}</strong></td>
                      <td>${order.phone || '<span style="color: var(--text-muted);">-</span>'}</td>
                      <td>${order.productName}</td>
                      <td><strong>${order.quantity}</strong></td>
                      <td><strong>${formatCurrency(order.total)}</strong></td>
                      <td>${formatDate(order.deliveryDate)}</td>
                      <td><span class="urgency-badge ${urgency.className}">${urgency.label}</span></td>
                      <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
                      <td style="text-align: right;">
                        <button class="btn btn-secondary btn-sm btn-view-order" data-id="${order.id}">
                          Xem
                        </button>
                      </td>
                    </tr>
                  `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </div>
    `;

    // Attach event listeners
    this.container.querySelector('#dash-btn-add-order')?.addEventListener('click', () => {
      this.onNavigate('add-order');
    });

    this.container.querySelector('#dash-btn-view-all')?.addEventListener('click', () => {
      this.onNavigate('orders');
    });

    // View order buttons
    this.container.querySelectorAll('.btn-view-order').forEach((btn) => {
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
  }
}
