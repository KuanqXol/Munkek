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

    // Metrics calculations
    const totalOrdersCount = orders.length;
    const ordersTodayCount = orders.filter((o) => o.orderDate === todayStr).length;

    // Pending or Preparing orders
    const pendingOrdersCount = orders.filter(
      (o) => o.status === 'pending' || o.status === 'preparing'
    ).length;

    // Revenue calculations (Excluding cancelled orders)
    const validOrders = orders.filter((o) => o.status !== 'cancelled');

    const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
    const totalDeposit = validOrders.reduce((sum, o) => sum + (o.deposit || 0), 0);

    // Uncollected remaining debt from pending & preparing orders
    const uncollectedDebt = validOrders
      .filter((o) => o.status === 'pending' || o.status === 'preparing')
      .reduce((sum, o) => sum + (o.remaining !== undefined ? o.remaining : Math.max(0, o.total - (o.deposit || 0))), 0);

    // Mooncake filling/flavor production breakdown
    const fillingStats = orderService.getMooncakeFillingStats();
    const totalCakesSold = fillingStats.reduce((sum, f) => sum + f.quantity, 0);

    // Upcoming deliveries: orders not completed and not cancelled, sorted by deliveryDate ascending
    const upcomingOrders = orders
      .filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
      .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
      .slice(0, 8); // Top 8 soonest

    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">
            Tổng quan mùa Bánh Trung Thu
          </h2>
          <p style="font-size: 14px; color: var(--text-muted); margin-top: 2px;">
            Theo dõi doanh thu, số lượng bánh cần làm và lịch giao bánh cận ngày rằm
          </p>
        </div>
        <button class="btn btn-primary btn-lg" id="dash-btn-add-order">
          <span style="font-size: 18px;">➕</span> Thêm đơn mới
        </button>
      </div>

      <!-- Metrics Grid -->
      <div class="dashboard-metrics-grid">
        <!-- Metric 1: Total Orders -->
        <div class="metric-card">
          <div class="metric-icon-wrap icon-amber">🥮</div>
          <div class="metric-content">
            <div class="metric-label">Tổng số đơn bánh</div>
            <div class="metric-value">${totalOrdersCount} <span style="font-size: 14px; font-weight: 500; color: var(--text-muted);">đơn</span></div>
            <div class="metric-sub">${totalCakesSold} chiếc/hộp đã đặt</div>
          </div>
        </div>

        <!-- Metric 2: Orders Today -->
        <div class="metric-card">
          <div class="metric-icon-wrap icon-blue">📅</div>
          <div class="metric-content">
            <div class="metric-label">Đơn nhận hôm nay</div>
            <div class="metric-value">${ordersTodayCount} <span style="font-size: 14px; font-weight: 500; color: var(--text-muted);">đơn</span></div>
            <div class="metric-sub">Ngày ${formatDate(todayStr)}</div>
          </div>
        </div>

        <!-- Metric 3: Pending Orders -->
        <div class="metric-card">
          <div class="metric-icon-wrap icon-purple">⏳</div>
          <div class="metric-content">
            <div class="metric-label">Đơn cần làm / giao</div>
            <div class="metric-value" style="color: #b45309;">${pendingOrdersCount} <span style="font-size: 14px; font-weight: 500; color: var(--text-muted);">đơn</span></div>
            <div class="metric-sub">Chờ nướng hoặc đóng gói</div>
          </div>
        </div>

        <!-- Metric 4: Total Revenue -->
        <div class="metric-card">
          <div class="metric-icon-wrap icon-orange">💰</div>
          <div class="metric-content">
            <div class="metric-label">Doanh thu mùa bánh</div>
            <div class="metric-value" style="color: var(--primary);">${formatCurrency(totalRevenue)}</div>
            <div class="metric-sub">Đã trừ giảm giá & đơn hủy</div>
          </div>
        </div>

        <!-- Metric 5: Total Deposit -->
        <div class="metric-card">
          <div class="metric-icon-wrap icon-emerald">💵</div>
          <div class="metric-content">
            <div class="metric-label">Tiền cọc đã thu</div>
            <div class="metric-value" style="color: #15803d;">${formatCurrency(totalDeposit)}</div>
            <div class="metric-sub">Tiền ứng trước của khách</div>
          </div>
        </div>

        <!-- Metric 6: Uncollected Debt -->
        <div class="metric-card">
          <div class="metric-icon-wrap icon-rose">🏷️</div>
          <div class="metric-content">
            <div class="metric-label">Còn phải thu khi giao</div>
            <div class="metric-value" style="color: #c2410c;">${formatCurrency(uncollectedDebt)}</div>
            <div class="metric-sub">Công nợ đơn đang làm</div>
          </div>
        </div>
      </div>

      <!-- Section: Mooncake Filling / Flavor Production Statistics -->
      <div class="card" style="margin-top: 24px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 22px;">🥣</span>
            <div>
              <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary);">
                Thống kê Số lượng Bánh theo Từng Loại Nhân / Vị
              </h3>
              <p style="font-size: 13px; color: var(--text-muted);">
                Số liệu thực tế giúp bạn ước tính nguyên liệu: sên đậu xanh, trộn nhân thập cẩm, chuẩn bị trứng muối
              </p>
            </div>
          </div>
          <span style="font-size: 13px; font-weight: 700; color: var(--primary); background: #ffedd5; padding: 4px 12px; border-radius: var(--radius-full);">
            Tổng: ${totalCakesSold} chiếc
          </span>
        </div>

        ${
          fillingStats.length === 0
            ? `
          <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
            Chưa có số liệu bánh được đặt. Hãy thêm đơn hàng mới để xem thống kê vị bánh.
          </div>
        `
            : `
          <div class="table-container" style="border: 1px solid var(--border-color); border-radius: var(--radius-md);">
            <table class="data-table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>Tên bánh / Loại nhân</th>
                  <th style="width: 140px; text-align: center;">Số lượng đã bán</th>
                  <th style="width: 140px; text-align: right;">Doanh số</th>
                  <th style="width: 160px;">Tỷ trọng</th>
                </tr>
              </thead>
              <tbody>
                ${fillingStats
                  .map((f) => {
                    const pct = totalCakesSold > 0 ? Math.round((f.quantity / totalCakesSold) * 100) : 0;
                    return `
                    <tr>
                      <td><strong style="color: var(--text-primary);">${f.productName}</strong></td>
                      <td style="text-align: center;">
                        <span style="display: inline-block; background: #fef3c7; color: #92400e; font-weight: 800; padding: 2px 10px; border-radius: 12px; font-size: 13px;">
                          ${f.quantity} cái
                        </span>
                      </td>
                      <td style="text-align: right; font-weight: 600;">${formatCurrency(f.totalAmount)}</td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <div style="flex: 1; height: 8px; background: #f5f5f4; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${pct}%; height: 100%; background: var(--primary); border-radius: 4px;"></div>
                          </div>
                          <span style="font-size: 12px; color: var(--text-muted); width: 32px; text-align: right;">${pct}%</span>
                        </div>
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

      <!-- Upcoming Deliveries Section -->
      <div class="upcoming-section">
        <div class="section-header">
          <div class="section-title">
            <span>⏰</span>
            <span>Đơn hàng cận ngày giao bánh (Cận Rằm)</span>
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
                  <th>Bánh đã đặt</th>
                  <th>Tổng tiền</th>
                  <th>Cọc / Nợ</th>
                  <th>Ngày hẹn giao</th>
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
                    const remaining = order.remaining !== undefined ? order.remaining : Math.max(0, order.total - (order.deposit || 0));

                    const itemsSummary = (order.items || [])
                      .map((it) => `${it.quantity}x ${it.productName}`)
                      .join(', ');

                    return `
                    <tr data-order-id="${order.id}">
                      <td><strong style="color: var(--primary);">${order.id}</strong></td>
                      <td>
                        <strong>${order.customer?.name || 'Khách vãng lai'}</strong>
                        ${order.customer?.phone ? `<div style="font-size: 11px; color: var(--text-muted);">${order.customer.phone}</div>` : ''}
                      </td>
                      <td style="max-width: 200px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                        <span style="font-size: 13px;" title="${itemsSummary}">${itemsSummary}</span>
                      </td>
                      <td><strong>${formatCurrency(order.total)}</strong></td>
                      <td>
                        <div style="font-size: 12px; color: #15803d;">Cọc: ${formatCurrency(order.deposit || 0)}</div>
                        ${remaining > 0 ? `<div style="font-size: 12px; font-weight: 700; color: #b45309;">Nợ: ${formatCurrency(remaining)}</div>` : ''}
                      </td>
                      <td><strong>${formatDate(order.deliveryDate)}</strong></td>
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
