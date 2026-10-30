import { orderService } from '../services/orderService';
import { productService } from '../services/productService';
import { Order, OrderItem, OrderStatus, DiscountType } from '../models/Order';
import { Product } from '../models/Product';
import { getTodayString, formatCurrency, escapeHtml } from '../utils/formatters';
import { validateOrderForm, OrderFormData } from '../utils/validators';
import { showConfirmModal } from '../components/ConfirmModal';
import { toast } from '../components/Toast';
import { icons } from '../utils/icons';

export class OrderFormPage {
  private container: HTMLElement;
  private onNavigate: (page: string, param?: string) => void;
  private editOrderId?: string;
  private existingOrder?: Order;

  private availableProducts: Product[] = [];
  private distinctProductNames: string[] = [];
  private cartItems: OrderItem[] = [];
  private discountType: DiscountType = 'none';
  private discountValue = 0;
  private discountNote = '';
  private deposit = 0;
  private isDirty = false;
  private isSubmitting = false;

  constructor(
    container: HTMLElement,
    onNavigate: (page: string, param?: string) => void,
    editOrderId?: string
  ) {
    this.container = container;
    this.onNavigate = onNavigate;
    this.editOrderId = editOrderId;
  }

  public async render(): Promise<void> {
    this.availableProducts = await productService.getAllProducts();
    const allOrders = await orderService.getAllOrders();

    // Collect distinct product names from catalog and existing orders for autocomplete
    const nameSet = new Set<string>();
    this.availableProducts.forEach((p) => nameSet.add(p.name));
    allOrders.forEach((o) => {
      if (o.items) o.items.forEach((it) => nameSet.add(it.productName));
      else if (o.productName) nameSet.add(o.productName);
    });
    this.distinctProductNames = Array.from(nameSet);

    if (this.editOrderId) {
      this.existingOrder = await orderService.getOrderById(this.editOrderId);
      if (!this.existingOrder) {
        toast.show('Lỗi', `Không tìm thấy đơn hàng mã ${this.editOrderId}`, 'error');
        this.onNavigate('orders');
        return;
      }
      this.cartItems = JSON.parse(JSON.stringify(this.existingOrder.items || []));
      this.discountType = this.existingOrder.discountType || 'none';
      this.discountValue = this.existingOrder.discountValue || 0;
      this.discountNote = (this.existingOrder.discountNote as string) || '';
      this.deposit = this.existingOrder.deposit || 0;
    } else {
      // Default: 1 empty/initial row
      if (this.cartItems.length === 0) {
        const first = this.availableProducts[0];
        const price = first ? first.unitPrice : 0;
        this.cartItems.push({
          productId: first ? first.id : undefined,
          productName: first ? first.name : '',
          quantity: 1,
          unitPrice: price,
          lineTotal: price,
          originalPrice: price,
        });
      }
    }

    this.renderForm();
  }

  private renderForm(): void {
    const isEdit = !!this.existingOrder;
    const today = getTodayString();

    const customerName = this.existingOrder?.customer?.name || this.existingOrder?.customerName || '';
    const phone = this.existingOrder?.customer?.phone || this.existingOrder?.phone || '';
    const address = this.existingOrder?.customer?.address || '';
    const orderDate = this.existingOrder?.orderDate || today;
    const deliveryDate = this.existingOrder?.deliveryDate || today;
    const status = this.existingOrder?.status || 'pending';
    const note = this.existingOrder?.note || '';

    this.container.innerHTML = `
      <div style="max-width: 820px; margin: 0 auto; padding-bottom: 40px;">
        <!-- Top bar: Back & Heading -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="btn btn-secondary btn-sm" id="form-btn-back" type="button">
              ← Quay lại
            </button>
            <div>
              <h2 style="font-size: 20px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">
                ${isEdit ? `Chỉnh sửa Đơn hàng: ${escapeHtml(this.existingOrder?.id)}` : 'Ghi nhận Đơn hàng Mới'}
              </h2>
              <p style="font-size: 13px; color: var(--text-muted);">
                ${isEdit ? 'Cập nhật bánh đã đặt, giảm giá hoặc tiến độ' : 'Nhập nhanh thông tin người mua, loại bánh và lịch hẹn giao'}
              </p>
            </div>
          </div>
        </div>

        <!-- Datalist for Product Autocomplete -->
        <datalist id="product-name-suggestions">
          ${this.distinctProductNames.map((name) => `<option value="${escapeHtml(name)}"></option>`).join('')}
        </datalist>

        <form id="order-form" novalidate>
          <!-- Section 1: Customer Information -->
          <div class="card" style="margin-bottom: 18px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
              <div style="color: var(--primary); display: flex;">${icons.user}</div>
              <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary);">
                Thông tin Khách hàng
              </h3>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="customerName">
                  Tên khách / Biệt danh thân mật <span style="color: #dc2626;">*</span>
                </label>
                <input
                  type="text"
                  id="customerName"
                  name="customerName"
                  class="form-control"
                  placeholder="Ví dụ: Chị Mai hàng xóm, Anh Tuấn..."
                  value="${escapeHtml(customerName)}"
                />
                <div class="form-error" id="err-customerName"></div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="phone">Số điện thoại (tùy chọn)</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  class="form-control"
                  placeholder="Ví dụ: 0912 345 678"
                  value="${escapeHtml(phone)}"
                />
              </div>

              <div class="form-group" style="grid-column: span 2; margin-bottom: 0;">
                <label class="form-label" for="address">Địa chỉ giao / Hẹn nhận bánh (tùy chọn)</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  class="form-control"
                  placeholder="Ví dụ: Khách qua tiệm lấy, Ship tới số 15..."
                  value="${escapeHtml(address)}"
                />
              </div>
            </div>
          </div>

          <!-- Section 2: Mooncake / Product Items in Order -->
          <div class="card" style="margin-bottom: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="color: var(--primary); display: flex;">${icons.orders}</div>
                <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary);">
                  Danh sách Bánh Trung Thu đã đặt
                </h3>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-add-item-row">
                ${icons.plus} <span>Thêm loại bánh</span>
              </button>
            </div>

            <div id="cart-items-container">
              <!-- Dynamically populated item rows -->
            </div>
            <div class="form-error" id="err-items" style="margin-top: 8px;"></div>
          </div>

          <!-- Section 3: Financials & Flexible Discounts -->
          <div class="card" style="margin-bottom: 18px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
              <div style="color: var(--primary); display: flex;">${icons.cash}</div>
              <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary);">
                Thanh toán & Giảm giá (bán cho người quen)
              </h3>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <!-- Left: Discount options -->
              <div>
                <label class="form-label">Hình thức giảm giá / Ưu đãi</label>
                <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                    <input type="radio" name="discountRadio" value="none" ${this.discountType === 'none' ? 'checked' : ''} />
                    <span>Không giảm giá (Bán đúng giá niêm yết)</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                    <input type="radio" name="discountRadio" value="amount" ${this.discountType === 'amount' ? 'checked' : ''} />
                    <span>Bớt số tiền cụ thể (VNĐ)</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                    <input type="radio" name="discountRadio" value="percent" ${this.discountType === 'percent' ? 'checked' : ''} />
                    <span>Giảm theo phần trăm (%)</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                    <input type="radio" name="discountRadio" value="override" ${this.discountType === 'override' ? 'checked' : ''} />
                    <span>Giá chốt thỏa thuận (Tự nhập tổng tiền)</span>
                  </label>
                </div>

                <div id="discount-inputs-wrap" style="display: ${this.discountType === 'none' ? 'none' : 'block'};">
                  <div class="form-group" style="margin-bottom: 10px;">
                    <label class="form-label" id="discount-value-label">Số tiền giảm (VNĐ)</label>
                    <input
                      type="number"
                      id="discountValue"
                      class="form-control"
                      min="0"
                      value="${this.discountValue || 0}"
                    />
                    <div class="form-error" id="err-discountValue"></div>
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <label class="form-label" for="discountNote">Lý do giảm giá (tùy chọn)</label>
                    <input
                      type="text"
                      id="discountNote"
                      class="form-control"
                      placeholder="Ví dụ: Người quen, Bớt tiền lẻ..."
                      value="${escapeHtml(this.discountNote)}"
                    />
                  </div>
                </div>
              </div>

              <!-- Right: Deposit & Calculation Summary -->
              <div style="background: #faf8f5; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                    <span style="color: var(--text-muted);">Tạm tính:</span>
                    <strong id="summary-subtotal" style="color: var(--text-primary);">0 ₫</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: #15803d;" id="summary-discount-row">
                    <span>Tiền giảm:</span>
                    <strong id="summary-discount">-0 ₫</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; border-top: 1px dashed var(--border-color); padding-top: 8px; margin-bottom: 14px;">
                    <span>Tổng thanh toán:</span>
                    <span id="summary-total" style="color: var(--primary);">0 ₫</span>
                  </div>

                  <!-- Deposit input -->
                  <div class="form-group" style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <label class="form-label" for="deposit" style="margin-bottom: 0;">Tiền khách đã đặt cọc:</label>
                      <div style="display: flex; gap: 4px;">
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-dep-0" style="padding: 2px 6px; font-size: 11px;">0đ</button>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-dep-50" style="padding: 2px 6px; font-size: 11px;">Cọc 50%</button>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-dep-full" style="padding: 2px 6px; font-size: 11px;">Trả đủ</button>
                      </div>
                    </div>
                    <input
                      type="number"
                      id="deposit"
                      name="deposit"
                      class="form-control"
                      min="0"
                      step="1000"
                      value="${this.deposit || 0}"
                    />
                    <div class="form-error" id="err-deposit"></div>
                  </div>

                  <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; background: white; padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                    <span style="color: var(--text-secondary);">Còn lại thu khi giao:</span>
                    <span id="summary-remaining" style="color: #c2410c;">0 ₫</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 4: Dates & Order Progress -->
          <div class="card" style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
              <div style="color: var(--primary); display: flex;">${icons.calendar}</div>
              <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary);">
                Lịch hẹn & Tiến độ làm bánh
              </h3>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="orderDate">Ngày nhận đơn</label>
                <input
                  type="date"
                  id="orderDate"
                  name="orderDate"
                  class="form-control"
                  value="${orderDate}"
                />
                <div class="form-error" id="err-orderDate"></div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="deliveryDate">
                  Ngày hẹn giao bánh <span style="color: #dc2626;">*</span>
                </label>
                <input
                  type="date"
                  id="deliveryDate"
                  name="deliveryDate"
                  class="form-control"
                  value="${deliveryDate}"
                />
                <div class="form-error" id="err-deliveryDate"></div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="status">Trạng thái đơn bánh</label>
                <select id="status" name="status" class="filter-select">
                  <option value="pending" ${status === 'pending' ? 'selected' : ''}>Chờ làm (Đặt trước)</option>
                  <option value="preparing" ${status === 'preparing' ? 'selected' : ''}>Đang làm bánh</option>
                  <option value="completed" ${status === 'completed' ? 'selected' : ''}>Đã hoàn thành / Đã giao</option>
                  <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Đã hủy đơn</option>
                </select>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="note">Ghi chú riêng về đơn bánh (tùy chọn)</label>
              <textarea
                id="note"
                name="note"
                class="form-control"
                rows="2"
                placeholder="Ví dụ: Ít ngọt, đóng hộp quà 4 bánh biếu tặng, lấy bánh buổi sáng..."
              >${escapeHtml(note)}</textarea>
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 12px;">
            <button type="button" class="btn btn-secondary" id="form-btn-cancel">
              Hủy bỏ
            </button>
            <button type="submit" class="btn btn-primary btn-lg" id="form-btn-submit">
              ${icons.check} <span>${isEdit ? 'Lưu thay đổi' : 'Tạo đơn hàng'}</span>
            </button>
          </div>
        </form>
      </div>
    `;

    this.renderCartRows();
    this.updateCalculationSummary();
    this.attachEvents();
  }

  private renderCartRows(): void {
    const container = this.container.querySelector('#cart-items-container');
    if (!container) return;

    container.innerHTML = this.cartItems
      .map((item, index) => {
        const price = (item.customPrice !== undefined ? item.customPrice : item.originalPrice) ?? item.unitPrice ?? 0;
        const lineTotal = item.quantity * price;

        return `
        <div class="cart-item-row" data-index="${index}" style="display: grid; grid-template-columns: 1fr 100px 140px 130px 36px; gap: 10px; align-items: center; margin-bottom: 10px; background: #faf8f5; padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <!-- Product Name Input with Datalist Autocomplete -->
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 3px;">TÊN BÁNH / SẢN PHẨM</label>
            <input
              type="text"
              class="form-control item-name-input"
              data-index="${index}"
              list="product-name-suggestions"
              placeholder="Chọn hoặc gõ tên bánh..."
              value="${escapeHtml(item.productName)}"
            />
          </div>

          <!-- Quantity -->
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 3px;">SỐ LƯỢNG</label>
            <input
              type="number"
              class="form-control item-qty-input"
              data-index="${index}"
              min="1"
              value="${item.quantity || 1}"
              style="text-align: center;"
            />
          </div>

          <!-- Unit Price (Editable for friend/relative discounts) -->
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 3px;">ĐƠN GIÁ (VNĐ)</label>
            <input
              type="number"
              class="form-control item-price-input"
              data-index="${index}"
              min="0"
              step="1000"
              placeholder="0"
              value="${item.customPrice !== undefined ? item.customPrice : item.originalPrice}"
            />
          </div>

          <!-- Line Total -->
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 3px; text-align: right;">THÀNH TIỀN</label>
            <div style="font-weight: 700; color: var(--primary); text-align: right; padding: 8px 0; font-size: 14px;">
              ${formatCurrency(lineTotal)}
            </div>
          </div>

          <!-- Remove Item Button -->
          <div style="display: flex; justify-content: center; padding-top: 18px;">
            <button
              type="button"
              class="btn btn-secondary btn-sm btn-remove-item"
              data-index="${index}"
              title="Xóa dòng này"
              style="padding: 6px; color: #dc2626; border-color: transparent;"
              ${this.cartItems.length <= 1 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}
            >
              ${icons.close}
            </button>
          </div>
        </div>
      `;
      })
      .join('');

    this.attachCartEvents();
  }

  private attachCartEvents(): void {
    const container = this.container.querySelector('#cart-items-container');
    if (!container) return;

    // Product name input
    container.querySelectorAll('.item-name-input').forEach((input) => {
      input.addEventListener('change', (e) => {
        this.isDirty = true;
        const idx = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0', 10);
        const name = (e.target as HTMLInputElement).value.trim();
        this.cartItems[idx].productName = name;

        // Auto-match standard price from catalog if currently 0
        const matched = this.availableProducts.find((p) => p.name.toLowerCase() === name.toLowerCase());
        if (matched) {
          this.cartItems[idx].productId = matched.id;
          if (!this.cartItems[idx].originalPrice || this.cartItems[idx].originalPrice === 0) {
            this.cartItems[idx].originalPrice = matched.unitPrice;
          }
        }
        this.renderCartRows();
        this.updateCalculationSummary();
      });
    });

    // Quantity input
    container.querySelectorAll('.item-qty-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        this.isDirty = true;
        const idx = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0', 10);
        const qty = Math.max(1, parseInt((e.target as HTMLInputElement).value || '1', 10));
        this.cartItems[idx].quantity = qty;
        this.updateCalculationSummary();
      });
    });

    // Price input
    container.querySelectorAll('.item-price-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        this.isDirty = true;
        const idx = parseInt((e.target as HTMLElement).getAttribute('data-index') || '0', 10);
        const price = Math.max(0, parseInt((e.target as HTMLInputElement).value || '0', 10));
        this.cartItems[idx].originalPrice = price;
        this.cartItems[idx].customPrice = price;
        this.updateCalculationSummary();
      });
    });

    // Remove row button
    container.querySelectorAll('.btn-remove-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (this.cartItems.length <= 1) return;
        this.isDirty = true;
        const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-index') || '0', 10);
        this.cartItems.splice(idx, 1);
        this.renderCartRows();
        this.updateCalculationSummary();
      });
    });
  }

  private updateCalculationSummary(): void {
    const subtotal = this.cartItems.reduce(
      (sum, it) => sum + (it.quantity || 1) * (it.customPrice !== undefined ? it.customPrice : it.originalPrice || 0),
      0
    );

    let discountAmount = 0;
    let finalTotal = subtotal;

    if (this.discountType === 'amount') {
      discountAmount = Math.max(0, Math.min(subtotal, this.discountValue || 0));
      finalTotal = Math.max(0, subtotal - discountAmount);
    } else if (this.discountType === 'percent') {
      const pct = Math.max(0, Math.min(100, this.discountValue || 0));
      discountAmount = Math.round((subtotal * pct) / 100);
      finalTotal = Math.max(0, subtotal - discountAmount);
    } else if (this.discountType === 'override') {
      finalTotal = Math.max(0, this.discountValue || 0);
      discountAmount = Math.max(0, subtotal - finalTotal);
    }

    const cleanDeposit = Math.max(0, this.deposit || 0);
    const remaining = Math.max(0, finalTotal - cleanDeposit);

    const subtotalEl = this.container.querySelector('#summary-subtotal');
    const discountEl = this.container.querySelector('#summary-discount');
    const discountRow = this.container.querySelector('#summary-discount-row') as HTMLElement;
    const totalEl = this.container.querySelector('#summary-total');
    const remainingEl = this.container.querySelector('#summary-remaining');

    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (discountEl) discountEl.textContent = `-${formatCurrency(discountAmount)}`;
    if (discountRow) discountRow.style.display = discountAmount > 0 ? 'flex' : 'none';
    if (totalEl) totalEl.textContent = formatCurrency(finalTotal);
    if (remainingEl) remainingEl.textContent = formatCurrency(remaining);
  }

  private attachEvents(): void {
    const form = this.container.querySelector('#order-form') as HTMLFormElement;
    if (!form) return;

    // Track dirty form
    form.addEventListener('input', () => {
      this.isDirty = true;
    });

    // Add new product item row
    this.container.querySelector('#btn-add-item-row')?.addEventListener('click', () => {
      this.isDirty = true;
      this.cartItems.push({
        productId: undefined,
        productName: '',
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
        originalPrice: 0,
      });
      this.renderCartRows();
      this.updateCalculationSummary();
    });

    // Back button with confirm if dirty
    const handleBack = async () => {
      if (this.isDirty) {
        const confirm = await showConfirmModal({
          title: 'Hủy bỏ thay đổi?',
          message: 'Bạn có các thông tin đơn hàng chưa được lưu. Rời khỏi trang này sẽ làm mất dữ liệu vừa nhập.',
          confirmText: 'Rời đi',
          cancelText: 'Tiếp tục chỉnh sửa',
          isDanger: true,
        });
        if (!confirm) return;
      }
      this.onNavigate('orders');
    };

    this.container.querySelector('#form-btn-back')?.addEventListener('click', handleBack);
    this.container.querySelector('#form-btn-cancel')?.addEventListener('click', handleBack);

    // Discount radio handlers
    this.container.querySelectorAll('input[name="discountRadio"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        this.isDirty = true;
        this.discountType = (e.target as HTMLInputElement).value as DiscountType;

        const inputsWrap = this.container.querySelector('#discount-inputs-wrap') as HTMLElement;
        const label = this.container.querySelector('#discount-value-label') as HTMLElement;

        if (this.discountType === 'none') {
          if (inputsWrap) inputsWrap.style.display = 'none';
          this.discountValue = 0;
        } else {
          if (inputsWrap) inputsWrap.style.display = 'block';
          if (label) {
            if (this.discountType === 'percent') label.textContent = 'Tỷ lệ chiết khấu (%)';
            else if (this.discountType === 'amount') label.textContent = 'Số tiền bớt trực tiếp (VNĐ)';
            else if (this.discountType === 'override') label.textContent = 'Tổng giá chốt thỏa thuận (VNĐ)';
          }
        }
        this.updateCalculationSummary();
      });
    });

    // Discount value input
    const discountValInput = this.container.querySelector('#discountValue') as HTMLInputElement;
    discountValInput?.addEventListener('input', () => {
      this.isDirty = true;
      this.discountValue = Math.max(0, parseInt(discountValInput.value || '0', 10));
      this.updateCalculationSummary();
    });

    // Discount note input
    const discountNoteInput = this.container.querySelector('#discountNote') as HTMLInputElement;
    discountNoteInput?.addEventListener('input', () => {
      this.isDirty = true;
      this.discountNote = discountNoteInput.value;
    });

    // Deposit input
    const depositInput = this.container.querySelector('#deposit') as HTMLInputElement;
    depositInput?.addEventListener('input', () => {
      this.isDirty = true;
      this.deposit = Math.max(0, parseInt(depositInput.value || '0', 10));
      this.updateCalculationSummary();
    });

    // Quick deposit buttons
    this.container.querySelector('#btn-quick-dep-0')?.addEventListener('click', () => {
      this.isDirty = true;
      this.deposit = 0;
      if (depositInput) depositInput.value = '0';
      this.updateCalculationSummary();
    });

    this.container.querySelector('#btn-quick-dep-50')?.addEventListener('click', () => {
      this.isDirty = true;
      const subtotal = this.cartItems.reduce(
        (acc, it) => acc + it.quantity * ((it.customPrice ?? it.originalPrice) || 0),
        0
      );
      let total = subtotal;
      if (this.discountType === 'amount') total = Math.max(0, subtotal - this.discountValue);
      else if (this.discountType === 'percent') total = Math.max(0, subtotal - (subtotal * this.discountValue) / 100);
      else if (this.discountType === 'override') total = this.discountValue;

      this.deposit = Math.round(total / 2);
      if (depositInput) depositInput.value = String(this.deposit);
      this.updateCalculationSummary();
    });

    this.container.querySelector('#btn-quick-dep-full')?.addEventListener('click', () => {
      this.isDirty = true;
      const subtotal = this.cartItems.reduce(
        (acc, it) => acc + it.quantity * ((it.customPrice ?? it.originalPrice) || 0),
        0
      );
      let total = subtotal;
      if (this.discountType === 'amount') total = Math.max(0, subtotal - this.discountValue);
      else if (this.discountType === 'percent') total = Math.max(0, subtotal - (subtotal * this.discountValue) / 100);
      else if (this.discountType === 'override') total = this.discountValue;

      this.deposit = total;
      if (depositInput) depositInput.value = String(this.deposit);
      this.updateCalculationSummary();
    });

    // Form submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(form);
    });
  }

  private async handleSubmit(form: HTMLFormElement): Promise<void> {
    if (this.isSubmitting) return;

    form.querySelectorAll('.form-error').forEach((el) => (el.textContent = ''));

    const customerName = (form.querySelector('#customerName') as HTMLInputElement).value;
    const phone = (form.querySelector('#phone') as HTMLInputElement).value;
    const address = (form.querySelector('#address') as HTMLInputElement).value;
    const orderDate = (form.querySelector('#orderDate') as HTMLInputElement).value;
    const deliveryDate = (form.querySelector('#deliveryDate') as HTMLInputElement).value;
    const status = (form.querySelector('#status') as HTMLSelectElement).value as OrderStatus;
    const note = (form.querySelector('#note') as HTMLTextAreaElement).value;

    const formData: OrderFormData = {
      customerName,
      phone,
      address,
      items: this.cartItems,
      discountType: this.discountType,
      discountValue: this.discountValue,
      discountNote: this.discountNote,
      deposit: this.deposit,
      orderDate,
      deliveryDate,
      status,
      note,
    };

    const validation = validateOrderForm(formData);
    if (!validation.isValid) {
      for (const [field, msg] of Object.entries(validation.errors)) {
        const errEl = form.querySelector(`#err-${field}`) as HTMLElement;
        if (errEl) errEl.textContent = msg;
      }
      toast.show('Chưa đủ thông tin', 'Vui lòng kiểm tra lại các trường được đánh dấu đỏ.', 'error');
      return;
    }

    const submitBtn = form.querySelector('#form-btn-submit') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang lưu đơn hàng...';
    this.isSubmitting = true;

    try {
      if (this.existingOrder) {
        await orderService.updateOrder(this.existingOrder.id, {
          customer: {
            name: customerName,
            phone,
            address,
          },
          items: this.cartItems,
          orderDate,
          deliveryDate,
          discountType: this.discountType,
          discountValue: this.discountValue,
          discountNote: this.discountNote,
          deposit: this.deposit,
          status,
          note,
        });

        toast.show('Thành công', `Đã lưu cập nhật cho đơn hàng ${this.existingOrder.id}`, 'success');
      } else {
        const created = await orderService.addOrder({
          customer: {
            name: customerName,
            phone,
            address,
          },
          items: this.cartItems,
          orderDate,
          deliveryDate,
          discountType: this.discountType,
          discountValue: this.discountValue,
          discountNote: this.discountNote,
          deposit: this.deposit,
          status,
          note,
        });

        toast.show('Thành công', `Đã tạo đơn hàng mới mã ${created.id}`, 'success');
      }

      this.isDirty = false;
      this.onNavigate('orders');
    } catch (err) {
      toast.show('Lỗi lưu đơn hàng', err instanceof Error ? err.message : String(err), 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>${icons.check}</span> <span>${this.existingOrder ? 'Lưu thay đổi' : 'Tạo đơn hàng'}</span>`;
      this.isSubmitting = false;
    }
  }
}
