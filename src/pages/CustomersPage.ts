import { customerService } from '../services/customerService.ts';
import { orderService } from '../services/orderService.ts';
import type { Customer } from '../models/Customer.ts';
import type { Order } from '../models/Order.ts';
import { formatCurrency, formatDate, escapeHtml, removeVietnameseTones } from '../utils/formatters.ts';
import { icons } from '../utils/icons.ts';
import { showConfirmModal } from '../components/ConfirmModal.ts';
import { showOrderDetailsModal } from '../components/OrderDetailsModal.ts';
import { toast } from '../components/Toast.ts';

export class CustomersPage {
  private container: HTMLElement;
  private onNavigate: (page: string, param?: string) => void;

  private customers: Customer[] = [];
  private orders: Order[] = [];
  private searchQuery = '';

  constructor(container: HTMLElement, onNavigate: (page: string, param?: string) => void) {
    this.container = container;
    this.onNavigate = onNavigate;
  }

  public async render(): Promise<void> {
    this.customers = await customerService.getAllCustomers();
    this.orders = await orderService.getAllOrders();

    this.renderLayout();
    this.renderCustomerList();
  }

  private renderLayout(): void {
    // Quick statistics
    const stats = this.computeCustomerStats();

    this.container.innerHTML = `
      <div class="customers-page">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">
              Quản lý Khách hàng
            </h2>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
              Danh bạ người mua, theo dõi số đơn và mức độ thân thiết của khách hàng
            </p>
          </div>
          <button class="btn btn-primary" id="btn-add-customer">
            ${icons.plus} <span>Thêm khách hàng mới</span>
          </button>
        </div>

        <!-- Quick Summary Mini Cards -->
        <div class="analytics-metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 20px;">
          <div class="metric-card">
            <div class="metric-title">Tổng số khách hàng</div>
            <div class="metric-value" style="font-size: 24px; color: var(--primary);">${stats.totalCustomers}</div>
            <div class="metric-subtext">Đã lưu trong danh bạ</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Khách quen (>1 đơn)</div>
            <div class="metric-value" style="font-size: 24px; color: #15803d;">${stats.repeatCustomers}</div>
            <div class="metric-subtext">Tỷ lệ: ${stats.repeatRate}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">Khách hàng VIP</div>
            <div class="metric-value" style="font-size: 24px; color: var(--accent);">${stats.vipCustomers}</div>
            <div class="metric-subtext">Chi tiêu trên 500.000đ</div>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="filter-bar" style="margin-bottom: 16px;">
          <div class="search-input-wrap" style="flex: 1;">
            <span class="search-icon">${icons.search}</span>
            <input
              type="text"
              id="customer-search-input"
              class="form-control"
              placeholder="Tìm khách theo họ tên, số điện thoại, địa chỉ (gõ không dấu)..."
              value="${escapeHtml(this.searchQuery)}"
            />
            ${
              this.searchQuery
                ? `<button class="btn-clear-search" id="btn-clear-customer-search">✕</button>`
                : ''
            }
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-reset-customer-search">
            ${icons.refresh} <span>Đặt lại</span>
          </button>
        </div>

        <!-- Customer Table Container -->
        <div id="customers-table-container"></div>
      </div>
    `;

    this.attachHeaderEvents();
  }

  private computeCustomerStats(): {
    totalCustomers: number;
    repeatCustomers: number;
    repeatRate: number;
    vipCustomers: number;
  } {
    const totalCustomers = this.customers.length;
    let repeatCustomers = 0;
    let vipCustomers = 0;

    for (const c of this.customers) {
      const custOrders = this.getCustomerOrders(c);
      if (custOrders.length > 1) repeatCustomers++;
      const totalSpent = custOrders.reduce((s, o) => s + (o.finalTotal || o.total || 0), 0);
      if (totalSpent >= 500000) vipCustomers++;
    }

    const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;
    return { totalCustomers, repeatCustomers, repeatRate, vipCustomers };
  }

  private getCustomerOrders(c: Customer): Order[] {
    const cPhone = c.phone ? c.phone.replace(/\D/g, '') : '';
    const cNameClean = removeVietnameseTones(c.name).toLowerCase();

    return this.orders.filter((o) => {
      if (c.id && o.customerId === c.id) return true;
      if (cPhone && o.phone && o.phone.replace(/\D/g, '') === cPhone) return true;
      if (o.customerName && removeVietnameseTones(o.customerName).toLowerCase() === cNameClean) return true;
      return false;
    });
  }

  private getFilteredCustomers(): Customer[] {
    if (!this.searchQuery || !this.searchQuery.trim()) {
      return [...this.customers];
    }

    const qClean = removeVietnameseTones(this.searchQuery.trim());
    const digits = this.searchQuery.replace(/\D/g, '');

    return this.customers.filter((c) => {
      const nameClean = removeVietnameseTones(c.name);
      const matchesName = nameClean.includes(qClean);
      const matchesPhone = digits.length >= 3 && c.phone && c.phone.replace(/\D/g, '').includes(digits);
      const matchesAddr = c.address && removeVietnameseTones(c.address).includes(qClean);
      return matchesName || matchesPhone || matchesAddr;
    });
  }

  private renderCustomerList(): void {
    const container = this.container.querySelector('#customers-table-container');
    if (!container) return;

    const filtered = this.getFilteredCustomers();

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state card" style="margin: 40px auto; max-width: 480px; text-align: center; padding: 36px 24px;">
          <div class="empty-state-icon" style="font-size: 40px; margin-bottom: 12px;">👥</div>
          <div class="empty-state-title" style="font-size: 16px; font-weight: 700; color: var(--text-primary);">
            ${this.searchQuery ? 'Không tìm thấy khách hàng phù hợp' : 'Chưa có khách hàng nào'}
          </div>
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
            ${
              this.searchQuery
                ? 'Thử tìm với từ khóa khác hoặc xóa ô tìm kiếm.'
                : 'Thêm khách hàng quen để lưu số điện thoại, địa chỉ và tiện chọn nhanh khi tạo đơn bánh.'
            }
          </p>
          ${
            this.searchQuery
              ? `<button class="btn btn-secondary btn-sm" id="btn-empty-reset-search">Xem tất cả khách hàng</button>`
              : `<button class="btn btn-primary btn-sm" id="btn-empty-add-customer">+ Thêm khách hàng đầu tiên</button>`
          }
        </div>
      `;

      container.querySelector('#btn-empty-reset-search')?.addEventListener('click', () => {
        this.searchQuery = '';
        this.render();
      });

      container.querySelector('#btn-empty-add-customer')?.addEventListener('click', () => {
        this.openCustomerModal();
      });
      return;
    }

    container.innerHTML = `
      <div class="card" style="padding: 0; overflow: hidden; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 220px;">Khách hàng</th>
              <th style="width: 140px;">Số điện thoại</th>
              <th>Địa chỉ nhận bánh</th>
              <th style="text-align: right; width: 150px;">Tổng chi tiêu</th>
              <th style="width: 180px;">Ghi chú / Sở thích</th>
              <th style="text-align: right; width: 220px;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((c) => this.renderTableRow(c)).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 12px; font-size: 13px; color: var(--text-muted); display: flex; justify-content: space-between;">
        <span>Tổng cộng: <strong>${filtered.length}</strong> khách hàng</span>
      </div>
    `;

    this.attachTableEvents(container);
  }

  private renderTableRow(c: Customer): string {
    const custOrders = this.getCustomerOrders(c);
    const orderCount = custOrders.length;
    const totalSpent = custOrders.reduce((s, o) => s + (o.finalTotal || o.total || 0), 0);
    const initial = (c.name || 'K').trim().charAt(0).toUpperCase();

    const isVip = totalSpent >= 500000;
    const isRepeat = orderCount > 1;

    return `
      <tr data-customer-id="${escapeHtml(c.id)}">
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #fef3c7; color: var(--primary); font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; border: 1px solid #fde68a;">
              ${escapeHtml(initial)}
            </div>
            <div>
              <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">
                ${escapeHtml(c.name)}
                ${isVip ? `<span class="badge badge-completed" style="font-size: 10px; margin-left: 4px; padding: 2px 6px;">VIP</span>` : (isRepeat ? `<span class="badge badge-preparing" style="font-size: 10px; margin-left: 4px; padding: 2px 6px;">Khách quen</span>` : '')}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${escapeHtml(c.id)}</div>
            </div>
          </div>
        </td>
        <td>
          ${
            c.phone
              ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${escapeHtml(c.phone)}</span>
              <button class="btn-copy-phone" data-phone="${escapeHtml(c.phone)}" title="Sao chép SĐT" style="background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 12px;">📋</button>
            </div>
          `
              : `<span style="color: var(--text-muted); font-style: italic; font-size: 12px;">Chưa có</span>`
          }
        </td>
        <td>
          <div style="font-size: 13px; color: var(--text-secondary); max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(c.address || '')}">
            ${c.address ? escapeHtml(c.address) : '<span style="color: var(--text-muted); font-style: italic;">Tại tiệm</span>'}
          </div>
        </td>
        <td style="text-align: right;">
          <div style="font-weight: 700; color: var(--primary); font-size: 14px;">
            ${formatCurrency(totalSpent)}
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">
            ${orderCount > 0 ? `<button class="btn-view-cust-orders" data-id="${escapeHtml(c.id)}" style="background: none; border: none; color: #0284c7; cursor: pointer; text-decoration: underline; font-size: 11px;">${orderCount} đơn hàng</button>` : 'Chưa có đơn'}
          </div>
        </td>
        <td>
          <div style="font-size: 12px; color: var(--text-muted); max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(c.note || '')}">
            ${c.note ? escapeHtml(c.note) : '-'}
          </div>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm btn-cust-new-order" data-id="${escapeHtml(c.id)}" title="Tạo đơn hàng cho khách này" style="color: var(--primary); font-weight: 600;">
            ${icons.plus} <span>Tạo đơn</span>
          </button>
          <button class="btn btn-secondary btn-sm btn-cust-edit" data-id="${escapeHtml(c.id)}" title="Sửa thông tin khách">
            ${icons.edit}
          </button>
          <button class="btn btn-secondary btn-sm btn-cust-delete" data-id="${escapeHtml(c.id)}" style="color: #dc2626;" title="Xóa khách hàng">
            ${icons.trash}
          </button>
        </td>
      </tr>
    `;
  }

  private attachHeaderEvents(): void {
    const searchInput = this.container.querySelector('#customer-search-input') as HTMLInputElement;
    const clearBtn = this.container.querySelector('#btn-clear-customer-search');
    const resetBtn = this.container.querySelector('#btn-reset-customer-search');
    const addBtn = this.container.querySelector('#btn-add-customer');

    addBtn?.addEventListener('click', () => {
      this.openCustomerModal();
    });

    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      this.renderCustomerList();
    });

    clearBtn?.addEventListener('click', () => {
      this.searchQuery = '';
      this.render();
    });

    resetBtn?.addEventListener('click', () => {
      this.searchQuery = '';
      this.render();
    });
  }

  private attachTableEvents(wrapper: Element): void {
    // Copy phone
    wrapper.querySelectorAll('.btn-copy-phone').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const phone = (btn as HTMLElement).getAttribute('data-phone');
        if (phone) {
          try {
            await navigator.clipboard.writeText(phone);
            toast.show('Đã sao chép', `Đã copy SĐT: ${phone}`, 'success');
          } catch {
            toast.show('Thông báo', phone, 'info');
          }
        }
      });
    });

    // View customer orders history
    wrapper.querySelectorAll('.btn-view-cust-orders').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-id');
        if (id) {
          const cust = this.customers.find((c) => c.id === id);
          if (cust) this.openCustomerOrdersModal(cust);
        }
      });
    });

    // New order for customer
    wrapper.querySelectorAll('.btn-cust-new-order').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-id');
        if (id) {
          const cust = this.customers.find((c) => c.id === id);
          if (cust) {
            // Navigate to POS with preselected customer
            this.onNavigate('pos', cust.name);
          }
        }
      });
    });

    // Edit customer
    wrapper.querySelectorAll('.btn-cust-edit').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-id');
        if (id) {
          const cust = this.customers.find((c) => c.id === id);
          if (cust) this.openCustomerModal(cust);
        }
      });
    });

    // Delete customer
    wrapper.querySelectorAll('.btn-cust-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-id');
        if (!id) return;

        const cust = this.customers.find((c) => c.id === id);
        if (!cust) return;

        const confirmed = await showConfirmModal({
          title: `Xác nhận xóa khách hàng`,
          message: `Bạn có chắc muốn xóa khách hàng "${cust.name}" khỏi danh bạ? Dữ liệu lịch sử các đơn hàng trước đây vẫn được bảo toàn nguyên vẹn.`,
          confirmText: 'Xóa khách hàng',
          cancelText: 'Giữ lại',
          isDanger: true,
        });

        if (confirmed) {
          await customerService.deleteCustomer(id);
          toast.show('Thành công', `Đã xóa khách hàng "${cust.name}".`, 'info');
          await this.render();
        }
      });
    });
  }

  /**
   * Modal to Add or Edit Customer
   */
  private openCustomerModal(existing?: Customer): void {
    const isEdit = !!existing;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 520px;">
        <div class="modal-header">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">
              ${isEdit ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}
            </div>
            <h3 class="modal-title" style="margin-top: 2px;">
              ${isEdit ? `${existing?.name}` : 'Lưu người mua vào danh bạ'}
            </h3>
          </div>
          <button class="modal-close-btn" id="modal-cust-close">✕</button>
        </div>

        <form id="customer-form">
          <div class="modal-body">
            <!-- Tên khách hàng -->
            <div class="form-group">
              <label class="form-label" for="cust-name">Họ và tên khách hàng <span class="required">*</span></label>
              <input
                type="text"
                id="cust-name"
                class="form-control"
                placeholder="Ví dụ: Chị Mai (Hàng xóm), Anh Tuấn Techcom..."
                value="${existing ? escapeHtml(existing.name) : ''}"
                required
                autofocus
              />
              <div class="form-error" id="err-cust-name"></div>
            </div>

            <!-- Số điện thoại -->
            <div class="form-group">
              <label class="form-label" for="cust-phone">Số điện thoại</label>
              <input
                type="tel"
                id="cust-phone"
                class="form-control"
                placeholder="Ví dụ: 0912345678"
                value="${existing?.phone ? escapeHtml(existing.phone) : ''}"
              />
            </div>

            <!-- Địa chỉ -->
            <div class="form-group">
              <label class="form-label" for="cust-address">Địa chỉ nhận bánh / Điểm giao</label>
              <input
                type="text"
                id="cust-address"
                class="form-control"
                placeholder="Ví dụ: Số 12 ngõ 85, hoặc Tòa nhà Keangnam..."
                value="${existing?.address ? escapeHtml(existing.address) : ''}"
              />
            </div>

            <!-- Ghi chú / Sở thích -->
            <div class="form-group">
              <label class="form-label" for="cust-note">Ghi chú riêng / Sở thích của khách</label>
              <textarea
                id="cust-note"
                class="form-control"
                rows="3"
                placeholder="Ví dụ: Khách quen thích bánh ít ngọt, ăn chay, hay đặt set quà biếu rằm..."
              >${existing?.note ? escapeHtml(existing.note) : ''}</textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="modal-cust-cancel">Hủy</button>
            <button type="submit" class="btn btn-primary" id="modal-cust-submit">
              ${icons.check} <span>${isEdit ? 'Lưu thay đổi' : 'Thêm khách hàng'}</span>
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', handleKeyDown);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);

    overlay.querySelector('#modal-cust-close')?.addEventListener('click', close);
    overlay.querySelector('#modal-cust-cancel')?.addEventListener('click', close);

    const form = overlay.querySelector('#customer-form') as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameInput = form.querySelector('#cust-name') as HTMLInputElement;
      const phoneInput = form.querySelector('#cust-phone') as HTMLInputElement;
      const addressInput = form.querySelector('#cust-address') as HTMLInputElement;
      const noteInput = form.querySelector('#cust-note') as HTMLTextAreaElement;

      const name = nameInput.value.trim();
      if (!name) {
        const err = form.querySelector('#err-cust-name') as HTMLElement;
        if (err) err.textContent = 'Vui lòng nhập họ tên khách hàng.';
        nameInput.focus();
        return;
      }

      try {
        if (isEdit && existing) {
          await customerService.updateCustomer(existing.id, {
            name,
            phone: phoneInput.value.trim() || undefined,
            address: addressInput.value.trim() || undefined,
            note: noteInput.value.trim() || undefined,
          });
          toast.show('Thành công', `Đã cập nhật thông tin "${name}".`, 'success');
        } else {
          const created = await customerService.addCustomer({
            name,
            phone: phoneInput.value.trim() || undefined,
            address: addressInput.value.trim() || undefined,
            note: noteInput.value.trim() || undefined,
          });
          toast.show('Thành công', `Đã thêm khách hàng "${created.name}".`, 'success');
        }

        close();
        await this.render();
      } catch (err) {
        toast.show('Lỗi', String(err instanceof Error ? err.message : err), 'error');
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  /**
   * Modal to view customer order history
   */
  private openCustomerOrdersModal(customer: Customer): void {
    const custOrders = this.getCustomerOrders(customer);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const totalSpent = custOrders.reduce((s, o) => s + (o.finalTotal || o.total || 0), 0);

    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 650px;">
        <div class="modal-header">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase;">
              Lịch sử mua hàng
            </div>
            <h3 class="modal-title" style="margin-top: 2px;">
              ${escapeHtml(customer.name)} (${custOrders.length} đơn hàng)
            </h3>
          </div>
          <button class="modal-close-btn" id="modal-cust-orders-close">✕</button>
        </div>

        <div class="modal-body">
          <div style="background: #faf8f5; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 12px; color: var(--text-muted);">Tổng chi tiêu tích lũy:</div>
              <div style="font-size: 18px; font-weight: 800; color: var(--primary);">${formatCurrency(totalSpent)}</div>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-modal-order-for-cust">
              ${icons.plus} <span>Tạo đơn mới cho khách</span>
            </button>
          </div>

          ${
            custOrders.length === 0
              ? `
            <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
              Khách hàng này chưa có đơn hàng nào được ghi nhận.
            </div>
          `
              : `
            <div style="max-height: 380px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
              <table class="data-table" style="margin: 0; font-size: 13px;">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Ngày đặt</th>
                    <th>Chi tiết bánh</th>
                    <th style="text-align: right;">Thành tiền</th>
                    <th style="text-align: right;">Xem</th>
                  </tr>
                </thead>
                <tbody>
                  ${custOrders
                    .map((o) => {
                      const itemsText = o.items && o.items.length > 0
                        ? o.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')
                        : o.productName || 'Bánh Trung Thu';

                      return `
                        <tr>
                          <td><strong style="color: var(--primary); font-family: monospace;">${escapeHtml(o.id)}</strong></td>
                          <td style="font-size: 12px;">${formatDate(o.orderDate)}</td>
                          <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(itemsText)}">
                            ${escapeHtml(itemsText)}
                          </td>
                          <td style="text-align: right; font-weight: 700; color: var(--text-primary);">
                            ${formatCurrency(o.finalTotal || o.total)}
                          </td>
                          <td style="text-align: right;">
                            <button class="btn btn-secondary btn-sm btn-inspect-order" data-id="${escapeHtml(o.id)}" title="Xem chi tiết đơn">
                              ${icons.eye}
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

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="modal-cust-orders-done">Đóng</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#modal-cust-orders-close')?.addEventListener('click', close);
    overlay.querySelector('#modal-cust-orders-done')?.addEventListener('click', close);

    overlay.querySelector('#btn-modal-order-for-cust')?.addEventListener('click', () => {
      close();
      this.onNavigate('pos', customer.name);
    });

    overlay.querySelectorAll('.btn-inspect-order').forEach((btn) => {
      btn.addEventListener('click', () => {
        const orderId = (btn as HTMLElement).getAttribute('data-id');
        if (orderId) {
          const ord = this.orders.find((o) => o.id === orderId);
          if (ord) {
            showOrderDetailsModal(ord, (editId) => {
              close();
              this.onNavigate('edit-order', editId);
            });
          }
        }
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }
}
