import { analyticsService, type AnalyticsPeriod, type AnalyticsReport } from '../services/analyticsService.ts';
import { backupService } from '../services/backupService.ts';
import { formatCurrency, escapeHtml } from '../utils/formatters.ts';
import { toast } from '../components/Toast.ts';

export class AnalyticsPage {
  private container: HTMLElement;
  private onNavigate: (page: string, param?: string) => void;

  private currentPeriod: AnalyticsPeriod = 'month';
  private customStartDate = '';
  private customEndDate = '';

  private report: AnalyticsReport | null = null;
  private showAllProducts = false;

  constructor(container: HTMLElement, onNavigate: (page: string, param?: string) => void) {
    this.container = container;
    this.onNavigate = onNavigate;
  }

  public async render(): Promise<void> {
    this.renderSkeleton();

    try {
      this.report = await analyticsService.generateReport(
        this.currentPeriod,
        this.customStartDate,
        this.customEndDate
      );
    } catch (err) {
      console.error('Lỗi khi tính toán báo cáo thống kê:', err);
      toast.show('Lỗi', 'Không thể tạo báo cáo thống kê', 'error');
    }

    this.renderFullView();
  }

  private renderSkeleton(): void {
    this.container.innerHTML = `
      <div class="analytics-page">
        <div style="padding: 60px 20px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 36px; margin-bottom: 16px;">🥮</div>
          <p style="font-weight: 700; font-size: 16px; color: var(--text-primary);">Đang tính toán số liệu kinh doanh MunKek...</p>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Tổng hợp doanh thu, lượng bánh cần làm và danh sách khách hàng</p>
        </div>
      </div>
    `;
  }

  private renderFullView(): void {
    if (!this.report) return;

    const o = this.report.overview;
    const c = this.report.customers;
    const p = this.report.products;
    const f = this.report.finance;

    this.container.innerHTML = `
      <div class="analytics-page">
        <!-- Top Header & Controls -->
        <header class="analytics-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px;">📊</span>
              <h2 class="analytics-main-title" style="margin: 0;">
                Báo cáo Kinh doanh & Sản xuất
              </h2>
            </div>
            <p class="analytics-subtitle">
              Theo dõi doanh thu thực, dòng tiền cọc - nợ, số lượng bánh cần làm và khách VIP
            </p>
          </div>

          <!-- Period Buttons & Export -->
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <div class="analytics-period-bar">
              <button class="period-btn ${this.currentPeriod === 'today' ? 'active' : ''}" data-period="today">
                Hôm nay
              </button>
              <button class="period-btn ${this.currentPeriod === '7days' ? 'active' : ''}" data-period="7days">
                7 ngày qua
              </button>
              <button class="period-btn ${this.currentPeriod === 'month' ? 'active' : ''}" data-period="month">
                Tháng này
              </button>
              <button class="period-btn ${this.currentPeriod === 'last_month' ? 'active' : ''}" data-period="last_month">
                Tháng trước
              </button>
              <button class="period-btn ${this.currentPeriod === 'year' ? 'active' : ''}" data-period="year">
                Năm nay
              </button>
              <button class="period-btn ${this.currentPeriod === 'all' ? 'active' : ''}" data-period="all">
                Toàn bộ
              </button>
              <button class="period-btn ${this.currentPeriod === 'custom' ? 'active' : ''}" data-period="custom">
                Tùy chọn...
              </button>
            </div>

            <button class="btn btn-secondary btn-sm" id="btn-export-analytics-csv" title="Xuất báo cáo doanh thu ra file Excel">
              📥 <span>Xuất Excel</span>
            </button>
          </div>
        </header>

        <!-- Custom Date Range Bar -->
        <div class="analytics-custom-date-bar" id="analytics-custom-date-bar" style="${this.currentPeriod === 'custom' ? 'display: flex;' : 'display: none;'}">
          <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Từ ngày:</label>
          <input type="date" id="analytics-custom-start" class="form-control" style="width: 140px; padding: 6px 10px;" value="${this.customStartDate}" />
          <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-left: 8px;">Đến ngày:</label>
          <input type="date" id="analytics-custom-end" class="form-control" style="width: 140px; padding: 6px 10px;" value="${this.customEndDate}" />
          <button class="btn btn-primary btn-sm" id="analytics-custom-apply" style="margin-left: 10px;">
            Áp dụng khoảng ngày
          </button>
        </div>

        <!-- Period Info Banner -->
        <div class="analytics-period-badge">
          <span>📅 Kỳ báo cáo: <strong>${escapeHtml(this.report.periodLabel)}</strong></span>
          <span>• Đơn ghi nhận: <strong>${o.totalOrders}</strong> đơn</span>
          <span>• Tổng bánh chốt: <strong>${o.totalItemsSold}</strong> chiếc</span>
          ${o.ordersToday > 0 ? `<span style="color: #15803d; font-weight: 700;">• Hôm nay có ${o.ordersToday} đơn</span>` : ''}
        </div>

        <!-- ====================================================
             1. BỐN THẺ CHỈ SỐ VÀNG VỀ DÒNG TIỀN & DOANH THU
             ==================================================== -->
        <div class="analytics-hero-grid">
          <!-- Card 1: Doanh thu thực tế (Net) -->
          <div class="hero-kpi-card highlight-gold">
            <div class="hero-kpi-header">
              <span class="hero-kpi-title">DOANH THU THỰC NHẬN</span>
              <span class="hero-kpi-badge">💰 Tiền đơn</span>
            </div>
            <div class="hero-kpi-amount">${formatCurrency(o.totalFinalValue)}</div>
            <div class="hero-kpi-footer">
              ${
                o.totalDiscountAmount > 0
                  ? `<span style="color: #b91c1c; font-weight: 700;">Đã giảm giá: -${formatCurrency(o.totalDiscountAmount)}</span>`
                  : `<span style="color: var(--text-muted);">Không áp dụng giảm giá</span>`
              }
            </div>
          </div>

          <!-- Card 2: Tiền đã thu về tay -->
          <div class="hero-kpi-card" style="border-left: 4px solid #16a34a;">
            <div class="hero-kpi-header">
              <span class="hero-kpi-title">TIỀN ĐÃ THU VỀ</span>
              <span class="hero-kpi-badge" style="background: #f0fdf4; color: #15803d; border-color: #bbf7d0;">💵 Cầm chắc</span>
            </div>
            <div class="hero-kpi-amount" style="color: #15803d;">${formatCurrency(o.totalCollected)}</div>
            <div class="hero-kpi-footer">
              <span>Tiền cọc & đơn đã thanh toán xong</span>
            </div>
          </div>

          <!-- Card 3: Còn nợ chưa thu (Phải thu khi giao) -->
          <div class="hero-kpi-card" style="border-left: 4px solid ${o.totalRemaining > 0 ? '#ea580c' : '#10b981'};">
            <div class="hero-kpi-header">
              <span class="hero-kpi-title">CÒN NỢ CHƯA THU</span>
              <span class="hero-kpi-badge" style="${o.totalRemaining > 0 ? 'background: #fff7ed; color: #c2410c; border-color: #fed7aa;' : 'background: #f0fdf4; color: #15803d; border-color: #bbf7d0;'}">
                ${o.totalRemaining > 0 ? '⏳ Thu khi giao' : '✓ Thu đủ 100%'}
              </span>
            </div>
            <div class="hero-kpi-amount" style="color: ${o.totalRemaining > 0 ? '#c2410c' : '#15803d'};">
              ${formatCurrency(o.totalRemaining)}
            </div>
            <div class="hero-kpi-footer">
              ${
                o.totalRemaining > 0
                  ? `<span style="color: #c2410c; font-weight: 700;">⚠️ Cần nhắc khách thanh toán khi giao bánh</span>`
                  : `<span style="color: #15803d; font-weight: 600;">Không có đơn nào nợ tiền</span>`
              }
            </div>
          </div>

          <!-- Card 4: Tổng số bánh đã bán -->
          <div class="hero-kpi-card" style="border-left: 4px solid var(--accent);">
            <div class="hero-kpi-header">
              <span class="hero-kpi-title">TỔNG BÁNH ĐÃ BÁN</span>
              <span class="hero-kpi-badge">🥮 Bánh & Hộp</span>
            </div>
            <div class="hero-kpi-amount" style="color: var(--accent);">
              ${o.totalItemsSold} <span style="font-size: 15px; font-weight: 600; color: var(--text-muted);">chiếc</span>
            </div>
            <div class="hero-kpi-footer">
              <span>Từ <strong>${o.totalOrders}</strong> đơn • TB <strong>${o.avgItemsPerOrder}</strong> bánh/đơn</span>
            </div>
          </div>
        </div>

        <!-- Optional Profit Ribbon (Only shown if user entered costPrice) -->
        ${
          f.hasCostData
            ? `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm); padding: 12px 18px; margin-top: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">💡</span>
              <span style="font-size: 13px; color: #166534; font-weight: 600;">
                Ước tính lợi nhuận gộp trong kỳ: <strong style="font-size: 15px; color: #15803d;">${formatCurrency(f.estimatedGrossProfit)}</strong>
                ${f.grossMarginPercent !== null ? `<span class="badge badge-completed" style="margin-left: 8px; font-weight: 800;">Lãi: ${f.grossMarginPercent}%</span>` : ''}
              </span>
            </div>
            <div style="font-size: 12px; color: #15803d;">
              Doanh thu thực ${formatCurrency(o.totalFinalValue)} - Tiền vốn bánh ${formatCurrency(f.totalCost)}
            </div>
          </div>
        `
            : ''
        }

        <!-- ====================================================
             2. NỘI DUNG CHÍNH: 2 CỘT CÂN ĐỐI & THỰC DỤNG
             ==================================================== -->
        <div class="analytics-dashboard-cols" style="margin-top: 24px;">

          <!-- CỘT TRÁI: BẢNG KÊ CHI TIẾT SỐ LƯỢNG BÁNH ĐÃ BÁN -->
          <div class="card analytics-panel">
            <div class="panel-header">
              <div>
                <h3 class="panel-title">🥮 Bảng Kê Chi Tiết Bánh Đã Bán</h3>
                <p class="panel-subtitle">Số lượng từng vị bánh để chuẩn bị nguyên liệu và nướng bánh</p>
              </div>
              <div style="display: flex; gap: 4px;">
                <button class="btn btn-secondary btn-sm ${!this.showAllProducts ? 'active' : ''}" id="btn-toggle-top-prods" style="font-size: 11px; padding: 3px 10px;">
                  Top 5 vị
                </button>
                <button class="btn btn-secondary btn-sm ${this.showAllProducts ? 'active' : ''}" id="btn-toggle-all-prods" style="font-size: 11px; padding: 3px 10px;">
                  Tất cả (${p.bestSellersByQty.length})
                </button>
              </div>
            </div>

            <div class="panel-body">
              ${this.renderProductBreakdown(p.bestSellersByQty, o.totalItemsSold)}
            </div>
          </div>

          <!-- CỘT PHẢI: KHÁCH HÀNG VIP & TIẾN ĐỘ ĐƠN HÀNG -->
          <div style="display: flex; flex-direction: column; gap: 20px;">

            <!-- KHỐI 1: TOP KHÁCH HÀNG VIP -->
            <div class="card analytics-panel">
              <div class="panel-header">
                <div>
                  <h3 class="panel-title">👑 Top Khách Hàng Thân Thiết</h3>
                  <p class="panel-subtitle">Khách ủng hộ tiệm bánh nhiều nhất trong kỳ</p>
                </div>
                <button class="btn btn-secondary btn-sm" id="btn-go-to-customers" style="font-size: 11px; padding: 4px 10px;">
                  Danh bạ ➔
                </button>
              </div>

              <div class="panel-body">
                ${this.renderVipCustomers(c.topSpenders)}
              </div>
            </div>

            <!-- KHỐI 2: TIẾN ĐỘ ĐƠN HÀNG & VẬN HÀNH -->
            <div class="card analytics-panel">
              <div class="panel-header">
                <div>
                  <h3 class="panel-title">📦 Tiến Độ Giao & Hoàn Tất Đơn</h3>
                  <p class="panel-subtitle">Tình hình thực hiện các đơn bánh trong kỳ</p>
                </div>
                <span class="badge ${o.pendingOrdersCount === 0 ? 'badge-completed' : 'badge-pending'}" style="font-weight: 700;">
                  ${o.pendingOrdersCount === 0 ? '✓ Đã xong hết' : `Còn ${o.pendingOrdersCount} đơn`}
                </span>
              </div>

              <div class="panel-body">
                <!-- Dual Progress Bar -->
                <div style="height: 10px; background: #fee2e2; border-radius: 999px; overflow: hidden; display: flex; margin-bottom: 16px;">
                  <div style="width: ${o.completionRate}%; background: #16a34a; transition: width 400ms ease;" title="Đã hoàn tất: ${o.completionRate}%"></div>
                  <div style="width: ${100 - o.completionRate}%; background: #f97316; transition: width 400ms ease;" title="Chờ giao: ${100 - o.completionRate}%"></div>
                </div>

                <!-- Status Summary Rows -->
                <div class="summary-list" style="display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                      <span style="width: 10px; height: 10px; border-radius: 50%; background: #16a34a; display: inline-block;"></span>
                      <span>Đã giao xong / Hoàn tất:</span>
                    </span>
                    <strong style="color: #15803d; font-size: 14px;">${o.completedOrdersCount} đơn (${o.completionRate}%)</strong>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                      <span style="width: 10px; height: 10px; border-radius: 50%; background: #f97316; display: inline-block;"></span>
                      <span>Đang làm / Chờ giao bánh:</span>
                    </span>
                    <strong style="color: #c2410c; font-size: 14px;">${o.pendingOrdersCount} đơn (${100 - o.completionRate}%)</strong>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 4px;">
                    <span style="color: var(--text-muted);">Giá trị trung bình 1 đơn (AOV):</span>
                    <strong>${formatCurrency(o.avgOrderValue)}</strong>
                  </div>
                </div>

                ${
                  o.pendingOrdersCount > 0
                    ? `
                  <div style="margin-top: 14px; padding: 10px 12px; background: #fff7ed; border-radius: var(--radius-sm); border: 1px solid #fed7aa; font-size: 12px; color: #9a3412; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">🔔</span>
                    <span>Đang có <strong>${o.pendingOrdersCount} đơn bánh</strong> cần chuẩn bị và giao đúng hẹn cho khách.</span>
                  </div>
                `
                    : ''
                }
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  // ========================================================
  // RENDER HELPERS
  // ========================================================

  /**
   * Render list of cakes sold with quantity, % of total, and revenue
   */
  private renderProductBreakdown(
    items: Array<{ productName: string; quantity: number; revenue: number; percent: number }>,
    totalSold: number
  ): string {
    if (!items || items.length === 0) {
      return `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
          <div style="font-size: 32px; margin-bottom: 8px;">🥮</div>
          <p style="font-weight: 600; color: var(--text-primary);">Chưa có đơn hàng nào trong khoảng thời gian này</p>
          <p style="margin-top: 4px;">Hãy tạo đơn bánh mới để xem thống kê sản xuất tại đây.</p>
        </div>
      `;
    }

    const maxQty = items[0]?.quantity || 1;
    const displayed = this.showAllProducts ? items : items.slice(0, 5);

    return `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${displayed
          .map((prod, index) => {
            const rank = index + 1;
            const percentOfTop = Math.round((prod.quantity / maxQty) * 100);
            const percentOfAll = totalSold > 0 ? Math.round((prod.quantity / totalSold) * 100) : 0;

            let rankBadge = `<span class="rank-badge rank-other">#${rank}</span>`;
            if (rank === 1) rankBadge = `<span class="rank-badge rank-1" title="Vị bánh đắt hàng nhất">🥇 1</span>`;
            else if (rank === 2) rankBadge = `<span class="rank-badge rank-2">🥈 2</span>`;
            else if (rank === 3) rankBadge = `<span class="rank-badge rank-3">🥉 3</span>`;

            return `
              <div class="bestseller-item-card">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                  ${rankBadge}
                  <div style="flex: 1; font-weight: 700; color: var(--text-primary); font-size: 14px; min-width: 0;">
                    <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      ${escapeHtml(prod.productName)}
                    </div>
                  </div>
                  <div style="text-align: right; flex-shrink: 0;">
                    <span style="font-weight: 900; color: var(--primary); font-size: 15px;">${prod.quantity}</span>
                    <span style="font-size: 12px; color: var(--text-muted); font-weight: 600;"> chiếc</span>
                    <span style="font-size: 11px; color: #15803d; font-weight: 700; margin-left: 4px;">(${percentOfAll}%)</span>
                    <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">${formatCurrency(prod.revenue)}</div>
                  </div>
                </div>

                <!-- Visual Meter Bar -->
                <div class="meter-bar-track">
                  <div class="meter-bar-fill ${rank === 1 ? 'gold-gradient' : ''}" style="width: ${percentOfTop}%;"></div>
                </div>
              </div>
            `;
          })
          .join('')}

        ${
          !this.showAllProducts && items.length > 5
            ? `
          <button class="btn btn-secondary btn-sm" id="btn-show-more-prods" style="margin-top: 6px; width: 100%; font-size: 12px;">
            Xem thêm ${items.length - 5} vị bánh khác ➔
          </button>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * Render Top 5 VIP Spenders
   */
  private renderVipCustomers(
    customers: Array<{ name: string; phone?: string; totalSpent: number; orderCount: number; id?: string }>
  ): string {
    if (!customers || customers.length === 0) {
      return `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
          Chưa có dữ liệu khách hàng trong khoảng thời gian này.
        </div>
      `;
    }

    const displayed = customers.slice(0, 5);

    return `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${displayed
          .map((c, idx) => {
            const initial = (c.name || 'K').trim().charAt(0).toUpperCase();
            const isTop1 = idx === 0;

            return `
              <div class="vip-cust-row ${isTop1 ? 'top-vip' : ''}">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: ${isTop1 ? '#fed7aa' : '#f5f5f4'}; color: ${isTop1 ? '#c2410c' : 'var(--text-secondary)'}; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;">
                  ${escapeHtml(initial)}
                </div>

                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 700; color: var(--text-primary); font-size: 13px; display: flex; align-items: center; gap: 6px;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(c.name)}</span>
                    ${isTop1 ? `<span class="badge badge-completed" style="font-size: 9px; padding: 1px 5px;">TOP 1</span>` : ''}
                  </div>
                  <div style="font-size: 11px; color: var(--text-muted);">
                    ${c.phone ? escapeHtml(c.phone) : 'Chưa có SĐT'} • <strong>${c.orderCount}</strong> đơn
                  </div>
                </div>

                <div style="text-align: right; flex-shrink: 0;">
                  <div style="font-weight: 800; color: var(--primary); font-size: 13px;">${formatCurrency(c.totalSpent)}</div>
                  <button class="btn-quick-order-for-cust" data-name="${escapeHtml(c.name)}" style="background: none; border: none; color: #0284c7; font-size: 11px; cursor: pointer; text-decoration: underline; padding: 0;">
                    + Tạo đơn
                  </button>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  private attachEvents(): void {
    // Period buttons
    this.container.querySelectorAll('.period-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const period = (e.currentTarget as HTMLElement).getAttribute('data-period') as AnalyticsPeriod;
        if (period) {
          this.currentPeriod = period;
          if (period !== 'custom') {
            this.render();
          } else {
            const customBar = this.container.querySelector('#analytics-custom-date-bar') as HTMLElement;
            if (customBar) customBar.style.display = 'flex';
          }
        }
      });
    });

    // Custom date filter apply
    this.container.querySelector('#analytics-custom-apply')?.addEventListener('click', () => {
      const startEl = this.container.querySelector('#analytics-custom-start') as HTMLInputElement;
      const endEl = this.container.querySelector('#analytics-custom-end') as HTMLInputElement;

      this.customStartDate = startEl ? startEl.value : '';
      this.customEndDate = endEl ? endEl.value : '';
      this.render();
    });

    // Product toggle buttons
    this.container.querySelector('#btn-toggle-top-prods')?.addEventListener('click', () => {
      this.showAllProducts = false;
      this.renderFullView();
    });

    this.container.querySelector('#btn-toggle-all-prods')?.addEventListener('click', () => {
      this.showAllProducts = true;
      this.renderFullView();
    });

    this.container.querySelector('#btn-show-more-prods')?.addEventListener('click', () => {
      this.showAllProducts = true;
      this.renderFullView();
    });

    // Export CSV
    this.container.querySelector('#btn-export-analytics-csv')?.addEventListener('click', async () => {
      try {
        const res = await backupService.exportCsv();
        if (res.success) {
          toast.show('Thành công', res.message || 'Đã xuất dữ liệu báo cáo sang file Excel.', 'success');
        } else {
          toast.show('Thông báo', res.message || 'Không thể xuất file.', 'info');
        }
      } catch (err) {
        toast.show('Lỗi xuất file', String(err instanceof Error ? err.message : err), 'error');
      }
    });

    // Jump to customers directory
    this.container.querySelector('#btn-go-to-customers')?.addEventListener('click', () => {
      this.onNavigate('customers');
    });

    // Quick order for customer button
    this.container.querySelectorAll('.btn-quick-order-for-cust').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const name = (e.currentTarget as HTMLElement).getAttribute('data-name');
        if (name) {
          this.onNavigate('pos', name);
        }
      });
    });
  }
}
