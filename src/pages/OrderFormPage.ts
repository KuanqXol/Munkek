import { orderService } from '../services/orderService';
import { productService } from '../services/productService';
import { Order, OrderItem, OrderStatus, DiscountType } from '../models/Order';
import { Product } from '../models/Product';
import { getTodayString, formatCurrency } from '../utils/formatters';
import { validateOrderForm, OrderFormData } from '../utils/validators';
import { toast } from '../components/Toast';

export class OrderFormPage {
  private container: HTMLElement;
  private onNavigate: (page: string, param?: string) => void;
  private editOrderId?: string;
  private existingOrder?: Order;

  private availableProducts: Product[] = [];
  private cartItems: OrderItem[] = [];
  private discountType: DiscountType = 'none';
  private discountValue = 0;
  private discountNote = '';
  private deposit = 0;

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
      this.discountNote = this.existingOrder.discountNote || '';
      this.deposit = this.existingOrder.deposit || 0;
    } else {
      // Default cart: if products exist, add first available product with quantity 1
      if (this.availableProducts.length > 0 && this.cartItems.length === 0) {
        const first = this.availableProducts[0];
        this.cartItems.push({
          productId: first.id,
          productName: first.name,
          quantity: 1,
          originalPrice: first.unitPrice,
        });
      }
    }

    this.renderForm();
  }

  private renderForm(): void {
    const isEdit = !!this.existingOrder;
    const today = getTodayString();

    const customerName = this.existingOrder?.customer?.name || '';
    const phone = this.existingOrder?.customer?.phone || '';
    const address = this.existingOrder?.customer?.address || '';
    const orderDate = this.existingOrder?.orderDate || today;
    const deliveryDate = this.existingOrder?.deliveryDate || today;
    const status = this.existingOrder?.status || 'pending';
    const note = this.existingOrder?.note || '';

    this.container.innerHTML = `
      <div style="max-width: 860px; margin: 0 auto; padding-bottom: 40px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="btn btn-secondary btn-sm" id="form-btn-back" title="Quay lại">
                ← Quay lại
              </button>
              <h2 style="font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">
                ${isEdit ? `Chỉnh sửa Đơn hàng: ${this.existingOrder?.id}` : 'Thêm Đơn hàng Bánh Trung Thu'}
              </h2>
            </div>
            <p style="font-size: 14px; color: var(--text-muted); margin-top: 4px; margin-left: 90px;">
              ${isEdit ? 'Cập nhật bánh đặt, điều chỉnh giảm giá hoặc tiến độ đơn' : 'Ghi chép các loại bánh đặt mua, tiền cọc và lịch hẹn giao'}
            </p>
          </div>
        </div>

        <form id="order-form" novalidate>
          <!-- Section 1: Customer Information -->
          <div class="card" style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span style="font-size: 20px;">👤</span>
              <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary);">Thông tin Khách hàng (Tùy chọn)</h3>
            </div>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label" for="customerName">Tên khách / Biệt danh thân mật</label>
                <input
                  type="text"
                  id="customerName"
                  name="customerName"
                  class="form-control"
                  placeholder="Ví dụ: Chị Mai hàng xóm, Anh Tuấn cơ quan..."
                  value="${customerName}"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="phone">Số điện thoại</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  class="form-control"
                  placeholder="Ví dụ: 0912 345 678"
                  value="${phone}"
                />
              </div>

              <div class="form-group form-group-full">
                <label class="form-label" for="address">Địa chỉ giao / Hẹn nhận bánh</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  class="form-control"
                  placeholder="Ví dụ: Khách qua tiệm lấy, Gửi xe buýt, Ship tới số 15..."
                  value="${address}"
                />
              </div>
            </div>
          </div>

          <!-- Section 2: Mooncake Cart Items -->
          <div class="card" style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">🥮</span>
                <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary);">Danh sách Bánh Trung Thu đã đặt</h3>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-add-item-row">
                <span>➕</span> Thêm loại bánh
              </button>
            </div>

            <!-- Items List Container -->
            <div id="cart-items-container">
              <!-- Rendered dynamically -->
            </div>
            <div class="form-error" id="err-items" style="margin-top: 8px;"></div>
          </div>

          <!-- Section 3: Flexible Discounts for Acquaintances & Friends -->
          <div class="card" style="margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span style="font-size: 20px;">🏷️</span>
              <div>
                <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary);">Chính sách Giảm giá & Giá bán Thân thiết</h3>
                <p style="font-size: 13px; color: var(--text-muted);">Bớt tiền cho người quen, giảm % cho khách mua sỉ hoặc tự chốt giá bán</p>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;" id="discount-type-selector">
              <label class="discount-pill ${this.discountType === 'none' ? 'active' : ''}">
                <input type="radio" name="discountRadio" value="none" ${this.discountType === 'none' ? 'checked' : ''} style="display: none;" />
                <span style="font-weight: 700;">Không giảm</span>
                <span style="font-size: 11px; opacity: 0.8;">Theo giá niêm yết</span>
              </label>

              <label class="discount-pill ${this.discountType === 'amount' ? 'active' : ''}">
                <input type="radio" name="discountRadio" value="amount" ${this.discountType === 'amount' ? 'checked' : ''} style="display: none;" />
                <span style="font-weight: 700;">Bớt tiền mặt (VNĐ)</span>
                <span style="font-size: 11px; opacity: 0.8;">Bớt tiền lẻ, hỗ trợ ship</span>
              </label>

              <label class="discount-pill ${this.discountType === 'percent' ? 'active' : ''}">
                <input type="radio" name="discountRadio" value="percent" ${this.discountType === 'percent' ? 'checked' : ''} style="display: none;" />
                <span style="font-weight: 700;">Giảm theo %</span>
                <span style="font-size: 11px; opacity: 0.8;">Chiết khấu 5%, 10%, 15%</span>
              </label>

              <label class="discount-pill ${this.discountType === 'override' ? 'active' : ''}">
                <input type="radio" name="discountRadio" value="override" ${this.discountType === 'override' ? 'checked' : ''} style="display: none;" />
                <span style="font-weight: 700;">Chốt giá trọn gói</span>
                <span style="font-size: 11px; opacity: 0.8;">Thỏa thuận riêng</span>
              </label>
            </div>

            <div id="discount-inputs-box" style="${this.discountType === 'none' ? 'display: none;' : 'display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; background: #fffcf8; padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-color);'}">
              <div class="form-group">
                <label class="form-label" id="label-discount-val" for="discountValue">
                  ${this.discountType === 'percent' ? 'Tỷ lệ chiết khấu (%)' : this.discountType === 'override' ? 'Tổng tiền chốt thỏa thuận (VNĐ)' : 'Số tiền bớt (VNĐ)'}
                </label>
                <input
                  type="number"
                  id="discountValue"
                  class="form-control"
                  min="0"
                  step="${this.discountType === 'percent' ? 1 : 1000}"
                  value="${this.discountValue}"
                />
                <div class="form-error" id="err-discountValue"></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="discountNote">Lý do giảm / Ghi chú thân quen</label>
                <input
                  type="text"
                  id="discountNote"
                  class="form-control"
                  placeholder="Ví dụ: Bạn thân, Khách quen mua sỉ, Bớt tiền lẻ..."
                  value="${this.discountNote}"
                />
              </div>
            </div>
          </div>

          <!-- Section 4: Live Totals & Deposit -->
          <div class="card" style="margin-bottom: 20px; background: #fffcf9; border: 2px solid #fed7aa;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <div>
                <div class="form-group">
                  <label class="form-label" for="deposit" style="font-weight: 700; color: #15803d;">
                    💰 Tiền khách đã đặt cọc trước (VNĐ)
                  </label>
                  <input
                    type="number"
                    id="deposit"
                    class="form-control"
                    min="0"
                    step="5000"
                    placeholder="0"
                    value="${this.deposit}"
                    style="font-size: 16px; font-weight: 700; color: #15803d;"
                  />
                  <div class="form-error" id="err-deposit"></div>
                </div>

                <div style="display: flex; gap: 8px; margin-top: 8px;">
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-dep-0">0đ</button>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-dep-50">Cọc 50%</button>
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-quick-dep-full">Đã trả đủ 100%</button>
                </div>
              </div>

              <!-- Calculation Result Board -->
              <div style="background: white; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; display: flex; flex-direction: column; justify-content: center; gap: 6px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-secondary);">
                  <span>Tạm tính giỏ bánh:</span>
                  <strong id="summary-subtotal">0 đ</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #dc2626;" id="summary-discount-row">
                  <span>Giảm giá / Ưu đãi:</span>
                  <strong id="summary-discount">-0 đ</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: var(--primary); border-top: 1px solid var(--border-light); padding-top: 6px;">
                  <span>Tổng tiền thanh toán:</span>
                  <span id="summary-total">0 đ</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; color: #b45309; border-top: 1px dashed #fed7aa; padding-top: 6px;">
                  <span>Còn lại phải thu khi giao:</span>
                  <span id="summary-remaining">0 đ</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 5: Schedule & Status -->
          <div class="card" style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
              <span style="font-size: 20px;">📅</span>
              <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary);">Thời gian & Trạng thái đơn</h3>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label" for="orderDate">Ngày nhận đơn <span class="required">*</span></label>
                <input
                  type="date"
                  id="orderDate"
                  class="form-control"
                  value="${orderDate}"
                  required
                />
                <div class="form-error" id="err-orderDate"></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="deliveryDate">Ngày hẹn giao bánh <span class="required">*</span></label>
                <input
                  type="date"
                  id="deliveryDate"
                  class="form-control"
                  value="${deliveryDate}"
                  required
                />
                <div class="form-error" id="err-deliveryDate"></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="status">Tiến độ đơn hàng</label>
                <select id="status" class="form-control">
                  <option value="pending" ${status === 'pending' ? 'selected' : ''}>Chờ làm (Đặt trước)</option>
                  <option value="preparing" ${status === 'preparing' ? 'selected' : ''}>Đang làm / Nướng bánh</option>
                  <option value="completed" ${status === 'completed' ? 'selected' : ''}>Đã giao / Hoàn thành</option>
                  <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Đã hủy đơn</option>
                </select>
              </div>

              <div class="form-group form-group-full">
                <label class="form-label" for="note">Ghi chú riêng cho mẻ bánh</label>
                <textarea
                  id="note"
                  class="form-control"
                  rows="2"
                  placeholder="Ví dụ: Khách dặn ít ngọt, đóng hộp quà 4 bánh có túi xách đẹp..."
                >${note}</textarea>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; justify-content: flex-end; gap: 14px;">
            <button type="button" class="btn btn-secondary btn-lg" id="form-btn-cancel">
              Hủy bỏ
            </button>
            <button type="submit" class="btn btn-primary btn-lg" id="form-btn-submit">
              <span>💾</span> ${isEdit ? 'Lưu thay đổi đơn bánh' : 'Tạo đơn bánh mới'}
            </button>
          </div>
        </form>
      </div>
    `;

    this.renderCartItems();
    this.attachEvents();
    this.updateCalculationSummary();
  }

  private renderCartItems(): void {
    const container = this.container.querySelector('#cart-items-container');
    if (!container) return;

    if (this.cartItems.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px; background: #fafaf9; border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          <div style="font-size: 32px; margin-bottom: 8px;">🥮</div>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-secondary);">Chưa có bánh nào trong đơn hàng</div>
          <button type="button" class="btn btn-primary btn-sm" id="btn-cart-empty-add" style="margin-top: 10px;">
            ➕ Chọn bánh ngay
          </button>
        </div>
      `;
      container.querySelector('#btn-cart-empty-add')?.addEventListener('click', () => {
        this.addCartItemRow();
      });
      return;
    }

    container.innerHTML = `
      <div class="table-container" style="border: 1px solid var(--border-color); border-radius: var(--radius-md);">
        <table class="data-table" style="font-size: 13px;">
          <thead>
            <tr>
              <th style="min-width: 220px;">Loại bánh / Sản phẩm</th>
              <th style="width: 100px;">Số lượng</th>
              <th style="width: 130px;">Giá niêm yết</th>
              <th style="width: 150px;">Giá bán thực tế</th>
              <th style="width: 130px; text-align: right;">Thành tiền</th>
              <th style="width: 50px; text-align: center;"></th>
            </tr>
          </thead>
          <tbody>
            ${this.cartItems
              .map((it, idx) => {
                const effectivePrice =
                  it.customPrice !== undefined && it.customPrice >= 0 ? it.customPrice : it.originalPrice;
                const lineTotal = it.quantity * effectivePrice;

                return `
                <tr data-cart-index="${idx}">
                  <td>
                    <select class="form-control cart-product-select" data-index="${idx}" style="font-size: 13px; padding: 6px 10px;">
                      ${this.availableProducts
                        .map(
                          (p) =>
                            `<option value="${p.id}" ${p.id === it.productId ? 'selected' : ''}>
                              ${p.name} (${formatCurrency(p.unitPrice)})
                            </option>`
                        )
                        .join('')}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      class="form-control cart-qty-input"
                      data-index="${idx}"
                      min="1"
                      step="1"
                      value="${it.quantity}"
                      style="font-size: 13px; padding: 6px 8px; text-align: center;"
                    />
                  </td>
                  <td style="color: var(--text-muted); font-size: 13px;">
                    ${formatCurrency(it.originalPrice)}
                  </td>
                  <td>
                    <input
                      type="number"
                      class="form-control cart-price-input"
                      data-index="${idx}"
                      min="0"
                      step="1000"
                      placeholder="${it.originalPrice}"
                      value="${it.customPrice !== undefined ? it.customPrice : ''}"
                      style="font-size: 13px; padding: 6px 8px;"
                      title="Nếu bán giá riêng cho bạn bè/người quen, hãy gõ giá vào đây"
                    />
                  </td>
                  <td style="text-align: right; font-weight: 700; color: var(--primary);">
                    ${formatCurrency(lineTotal)}
                  </td>
                  <td style="text-align: center;">
                    <button type="button" class="btn btn-secondary btn-sm cart-remove-btn" data-index="${idx}" title="Xóa món này" style="padding: 4px 8px; font-size: 12px; color: #dc2626;">
                      ✕
                    </button>
                  </td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    // Attach listeners to cart rows
    container.querySelectorAll('.cart-product-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
        const pid = (e.currentTarget as HTMLSelectElement).value;
        const prod = this.availableProducts.find((p) => p.id === pid);
        if (prod && this.cartItems[idx]) {
          this.cartItems[idx].productId = prod.id;
          this.cartItems[idx].productName = prod.name;
          this.cartItems[idx].originalPrice = prod.unitPrice;
          this.cartItems[idx].customPrice = undefined;
          this.renderCartItems();
          this.updateCalculationSummary();
        }
      });
    });

    container.querySelectorAll('.cart-qty-input').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
        const val = Math.max(1, Number((e.currentTarget as HTMLInputElement).value) || 1);
        if (this.cartItems[idx]) {
          this.cartItems[idx].quantity = val;
          this.updateCalculationSummary();
        }
      });
    });

    container.querySelectorAll('.cart-price-input').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
        const raw = (e.currentTarget as HTMLInputElement).value;
        if (this.cartItems[idx]) {
          this.cartItems[idx].customPrice = raw === '' ? undefined : Math.max(0, Number(raw) || 0);
          this.updateCalculationSummary();
        }
      });
    });

    container.querySelectorAll('.cart-remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
        this.cartItems.splice(idx, 1);
        this.renderCartItems();
        this.updateCalculationSummary();
      });
    });
  }

  private addCartItemRow(): void {
    if (this.availableProducts.length === 0) {
      toast.show('Chưa có bánh', 'Vui lòng vào mục "Bánh Trung Thu" để thêm sản phẩm trước.', 'info');
      return;
    }
    const first = this.availableProducts[0];
    this.cartItems.push({
      productId: first.id,
      productName: first.name,
      quantity: 1,
      originalPrice: first.unitPrice,
    });
    this.renderCartItems();
    this.updateCalculationSummary();
  }

  private updateCalculationSummary(): void {
    // 1. Calculate subtotal
    const subtotal = this.cartItems.reduce((acc, it) => {
      const price = it.customPrice !== undefined && it.customPrice >= 0 ? it.customPrice : it.originalPrice;
      return acc + it.quantity * price;
    }, 0);

    // 2. Calculate discount
    let discountAmount = 0;
    let finalTotal = subtotal;

    if (this.discountType === 'amount') {
      discountAmount = Math.max(0, Math.min(subtotal, Number(this.discountValue) || 0));
      finalTotal = Math.max(0, subtotal - discountAmount);
    } else if (this.discountType === 'percent') {
      const pct = Math.max(0, Math.min(100, Number(this.discountValue) || 0));
      discountAmount = Math.round((subtotal * pct) / 100);
      finalTotal = Math.max(0, subtotal - discountAmount);
    } else if (this.discountType === 'override') {
      finalTotal = Math.max(0, Number(this.discountValue) || 0);
      discountAmount = Math.max(0, subtotal - finalTotal);
    }

    const remaining = Math.max(0, finalTotal - this.deposit);

    const subEl = this.container.querySelector('#summary-subtotal');
    const disEl = this.container.querySelector('#summary-discount');
    const totEl = this.container.querySelector('#summary-total');
    const remEl = this.container.querySelector('#summary-remaining');

    if (subEl) subEl.textContent = formatCurrency(subtotal);
    if (disEl) disEl.textContent = `-${formatCurrency(discountAmount)}`;
    if (totEl) totEl.textContent = formatCurrency(finalTotal);
    if (remEl) remEl.textContent = formatCurrency(remaining);
  }

  private attachEvents(): void {
    const form = this.container.querySelector('#order-form') as HTMLFormElement;
    const backBtn = this.container.querySelector('#form-btn-back');
    const cancelBtn = this.container.querySelector('#form-btn-cancel');
    const addItemBtn = this.container.querySelector('#btn-add-item-row');

    backBtn?.addEventListener('click', () => this.onNavigate('orders'));
    cancelBtn?.addEventListener('click', () => this.onNavigate('orders'));
    addItemBtn?.addEventListener('click', () => this.addCartItemRow());

    // Discount type pills
    const pillInputs = this.container.querySelectorAll('input[name="discountRadio"]');
    pillInputs.forEach((radio) => {
      radio.parentElement?.addEventListener('click', () => {
        const val = (radio as HTMLInputElement).value as DiscountType;
        this.discountType = val;

        this.container.querySelectorAll('.discount-pill').forEach((p) => p.classList.remove('active'));
        radio.parentElement?.classList.add('active');

        const box = this.container.querySelector('#discount-inputs-box') as HTMLElement;
        const labelVal = this.container.querySelector('#label-discount-val') as HTMLElement;

        if (val === 'none') {
          box.style.display = 'none';
          this.discountValue = 0;
        } else {
          box.style.display = 'grid';
          if (val === 'percent') {
            labelVal.textContent = 'Tỷ lệ chiết khấu (%)';
          } else if (val === 'override') {
            labelVal.textContent = 'Tổng tiền chốt thỏa thuận (VNĐ)';
          } else {
            labelVal.textContent = 'Số tiền bớt (VNĐ)';
          }
        }
        this.updateCalculationSummary();
      });
    });

    const discValInput = this.container.querySelector('#discountValue') as HTMLInputElement;
    discValInput?.addEventListener('input', () => {
      this.discountValue = Math.max(0, Number(discValInput.value) || 0);
      this.updateCalculationSummary();
    });

    const discNoteInput = this.container.querySelector('#discountNote') as HTMLInputElement;
    discNoteInput?.addEventListener('input', () => {
      this.discountNote = discNoteInput.value;
    });

    const depositInput = this.container.querySelector('#deposit') as HTMLInputElement;
    depositInput?.addEventListener('input', () => {
      this.deposit = Math.max(0, Number(depositInput.value) || 0);
      this.updateCalculationSummary();
    });

    // Quick deposit buttons
    this.container.querySelector('#btn-quick-dep-0')?.addEventListener('click', () => {
      this.deposit = 0;
      if (depositInput) depositInput.value = '0';
      this.updateCalculationSummary();
    });

    this.container.querySelector('#btn-quick-dep-50')?.addEventListener('click', () => {
      const subtotal = this.cartItems.reduce((acc, it) => acc + it.quantity * (it.customPrice ?? it.originalPrice), 0);
      let total = subtotal;
      if (this.discountType === 'amount') total = Math.max(0, subtotal - this.discountValue);
      else if (this.discountType === 'percent') total = Math.max(0, subtotal - (subtotal * this.discountValue) / 100);
      else if (this.discountType === 'override') total = this.discountValue;

      this.deposit = Math.round(total / 2);
      if (depositInput) depositInput.value = String(this.deposit);
      this.updateCalculationSummary();
    });

    this.container.querySelector('#btn-quick-dep-full')?.addEventListener('click', () => {
      const subtotal = this.cartItems.reduce((acc, it) => acc + it.quantity * (it.customPrice ?? it.originalPrice), 0);
      let total = subtotal;
      if (this.discountType === 'amount') total = Math.max(0, subtotal - this.discountValue);
      else if (this.discountType === 'percent') total = Math.max(0, subtotal - (subtotal * this.discountValue) / 100);
      else if (this.discountType === 'override') total = this.discountValue;

      this.deposit = total;
      if (depositInput) depositInput.value = String(this.deposit);
      this.updateCalculationSummary();
    });

    // Submit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(form);
    });
  }

  private async handleSubmit(form: HTMLFormElement): Promise<void> {
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
      toast.show('Chưa đúng thông tin', 'Vui lòng kiểm tra lại thông tin đơn hàng.', 'error');
      return;
    }

    const submitBtn = form.querySelector('#form-btn-submit') as HTMLButtonElement;
    submitBtn.disabled = true;

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

      this.onNavigate('orders');
    } catch (err) {
      toast.show('Lỗi', err instanceof Error ? err.message : String(err), 'error');
      submitBtn.disabled = false;
    }
  }
}
