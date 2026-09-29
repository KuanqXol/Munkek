import { orderService } from '../services/orderService';
import { Order, OrderStatus } from '../models/Order';
import { getTodayString, formatCurrency } from '../utils/formatters';
import { validateOrderForm, OrderFormData } from '../utils/validators';
import { toast } from '../components/Toast';

export class OrderFormPage {
  private container: HTMLElement;
  private onNavigate: (page: string, param?: string) => void;
  private editOrderId?: string;
  private existingOrder?: Order;

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
    if (this.editOrderId) {
      this.existingOrder = await orderService.getOrderById(this.editOrderId);
      if (!this.existingOrder) {
        toast.show('Lỗi', `Không tìm thấy đơn hàng mã ${this.editOrderId}`, 'error');
        this.onNavigate('orders');
        return;
      }
    }

    const isEdit = !!this.existingOrder;
    const today = getTodayString();

    const initialData: OrderFormData = this.existingOrder
      ? {
          customerName: this.existingOrder.customerName,
          phone: this.existingOrder.phone,
          productName: this.existingOrder.productName,
          quantity: this.existingOrder.quantity,
          unitPrice: this.existingOrder.unitPrice,
          deposit: this.existingOrder.deposit,
          orderDate: this.existingOrder.orderDate,
          deliveryDate: this.existingOrder.deliveryDate,
          status: this.existingOrder.status,
          note: this.existingOrder.note,
        }
      : {
          customerName: '',
          phone: '',
          productName: '',
          quantity: 1,
          unitPrice: 150000,
          deposit: 0,
          orderDate: today,
          deliveryDate: today,
          status: 'pending',
          note: '',
        };

    const initialTotal = Number(initialData.quantity) * Number(initialData.unitPrice);
    const initialRemaining = Math.max(0, initialTotal - Number(initialData.deposit));

    this.container.innerHTML = `
      <div style="max-width: 780px; margin: 0 auto;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="btn btn-secondary btn-sm" id="form-btn-back" title="Quay lại">
                ← Quay lại
              </button>
              <h2 style="font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">
                ${isEdit ? `Chỉnh sửa Đơn hàng: ${this.existingOrder?.id}` : 'Thêm Đơn hàng mới'}
              </h2>
            </div>
            <p style="font-size: 14px; color: var(--text-muted); margin-top: 4px; margin-left: 90px;">
              ${isEdit ? 'Cập nhật thông tin chi tiết đơn bánh' : 'Điền thông tin khách hàng và chi tiết món bánh đặt'}
            </p>
          </div>
        </div>

        <form id="order-form" class="form-card" novalidate>
          <div class="form-grid">
            <!-- Tên khách hàng -->
            <div class="form-group">
              <label class="form-label" for="customerName">
                Tên khách hàng <span class="required">*</span>
              </label>
              <input
                type="text"
                id="customerName"
                name="customerName"
                class="form-control"
                placeholder="Ví dụ: Chị Lan, Anh Hùng..."
                value="${initialData.customerName}"
                required
              />
              <div class="form-error" id="err-customerName"></div>
            </div>

            <!-- Số điện thoại -->
            <div class="form-group">
              <label class="form-label" for="phone">
                Số điện thoại liên hệ
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                class="form-control"
                placeholder="Ví dụ: 0912 345 678"
                value="${initialData.phone}"
              />
              <div class="form-error" id="err-phone"></div>
            </div>

            <!-- Tên bánh -->
            <div class="form-group form-group-full">
              <label class="form-label" for="productName">
                Tên món bánh / Sản phẩm <span class="required">*</span>
              </label>
              <input
                type="text"
                id="productName"
                name="productName"
                class="form-control"
                placeholder="Ví dụ: Bánh kem bắp sinh nhật 20cm, Tiramisu..."
                value="${initialData.productName}"
                required
              />
              <div class="form-error" id="err-productName"></div>
            </div>

            <!-- Số lượng -->
            <div class="form-group">
              <label class="form-label" for="quantity">
                Số lượng bánh <span class="required">*</span>
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                class="form-control"
                min="1"
                step="1"
                value="${initialData.quantity}"
                required
              />
              <div class="form-error" id="err-quantity"></div>
            </div>

            <!-- Đơn giá -->
            <div class="form-group">
              <label class="form-label" for="unitPrice">
                Đơn giá (VNĐ) <span class="required">*</span>
              </label>
              <input
                type="number"
                id="unitPrice"
                name="unitPrice"
                class="form-control"
                min="0"
                step="1000"
                value="${initialData.unitPrice}"
                required
              />
              <div class="form-error" id="err-unitPrice"></div>
            </div>

            <!-- Tiền cọc -->
            <div class="form-group">
              <label class="form-label" for="deposit">
                Tiền đặt cọc trước (VNĐ)
              </label>
              <input
                type="number"
                id="deposit"
                name="deposit"
                class="form-control"
                min="0"
                step="1000"
                value="${initialData.deposit}"
              />
              <div class="form-error" id="err-deposit"></div>
            </div>

            <!-- Trạng thái -->
            <div class="form-group">
              <label class="form-label" for="status">
                Trạng thái đơn hàng <span class="required">*</span>
              </label>
              <select id="status" name="status" class="form-control">
                <option value="pending" ${initialData.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
                <option value="preparing" ${initialData.status === 'preparing' ? 'selected' : ''}>Đang làm</option>
                <option value="completed" ${initialData.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
                <option value="cancelled" ${initialData.status === 'cancelled' ? 'selected' : ''}>Đã hủy</option>
              </select>
            </div>

            <!-- Ngày đặt -->
            <div class="form-group">
              <label class="form-label" for="orderDate">
                Ngày nhận đơn <span class="required">*</span>
              </label>
              <input
                type="date"
                id="orderDate"
                name="orderDate"
                class="form-control"
                value="${initialData.orderDate}"
                required
              />
              <div class="form-error" id="err-orderDate"></div>
            </div>

            <!-- Ngày giao -->
            <div class="form-group">
              <label class="form-label" for="deliveryDate">
                Ngày hẹn giao bánh <span class="required">*</span>
              </label>
              <input
                type="date"
                id="deliveryDate"
                name="deliveryDate"
                class="form-control"
                value="${initialData.deliveryDate}"
                required
              />
              <div class="form-error" id="err-deliveryDate"></div>
            </div>

            <!-- Auto-calculate Preview Box -->
            <div class="form-group-full total-preview-box">
              <div>
                <div class="total-preview-label">Thành tiền (Số lượng × Đơn giá):</div>
                <div id="preview-calc-formula" style="font-size: 13px; color: #9a3412;">
                  ${initialData.quantity} × ${formatCurrency(Number(initialData.unitPrice))}
                </div>
              </div>
              <div style="text-align: right;">
                <div class="total-preview-value" id="preview-total-value">
                  ${formatCurrency(initialTotal)}
                </div>
                <div style="font-size: 13px; color: #78350f; margin-top: 2px;" id="preview-remaining-value">
                  Còn lại phải thu: ${formatCurrency(initialRemaining)}
                </div>
              </div>
            </div>

            <!-- Ghi chú -->
            <div class="form-group form-group-full">
              <label class="form-label" for="note">
                Ghi chú thêm về đơn bánh
              </label>
              <textarea
                id="note"
                name="note"
                class="form-control"
                rows="3"
                placeholder="Ví dụ: Ghi chữ 'Chúc mừng sinh nhật bé Bắp', ít ngọt, nến số 5..."
              >${initialData.note}</textarea>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; justify-content: flex-end; gap: 14px; margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--border-light);">
            <button type="button" class="btn btn-secondary btn-lg" id="form-btn-cancel">
              Hủy bỏ
            </button>
            <button type="submit" class="btn btn-primary btn-lg" id="form-btn-submit">
              <span>💾</span> ${isEdit ? 'Lưu thay đổi' : 'Tạo đơn hàng'}
            </button>
          </div>
        </form>
      </div>
    `;

    this.attachFormEvents();
  }

  private attachFormEvents(): void {
    const form = this.container.querySelector('#order-form') as HTMLFormElement;
    const backBtn = this.container.querySelector('#form-btn-back');
    const cancelBtn = this.container.querySelector('#form-btn-cancel');

    const qtyInput = form.querySelector('#quantity') as HTMLInputElement;
    const priceInput = form.querySelector('#unitPrice') as HTMLInputElement;
    const depInput = form.querySelector('#deposit') as HTMLInputElement;

    const formulaEl = form.querySelector('#preview-calc-formula') as HTMLElement;
    const totalEl = form.querySelector('#preview-total-value') as HTMLElement;
    const remainingEl = form.querySelector('#preview-remaining-value') as HTMLElement;

    // Live update total and remaining
    const updatePreview = () => {
      const q = Math.max(0, Number(qtyInput.value) || 0);
      const p = Math.max(0, Number(priceInput.value) || 0);
      const d = Math.max(0, Number(depInput.value) || 0);
      const tot = q * p;
      const rem = Math.max(0, tot - d);

      formulaEl.textContent = `${q} × ${formatCurrency(p)}`;
      totalEl.textContent = formatCurrency(tot);
      remainingEl.textContent = `Còn lại phải thu: ${formatCurrency(rem)}`;
    };

    qtyInput.addEventListener('input', updatePreview);
    priceInput.addEventListener('input', updatePreview);
    depInput.addEventListener('input', updatePreview);

    backBtn?.addEventListener('click', () => this.onNavigate('orders'));
    cancelBtn?.addEventListener('click', () => this.onNavigate('orders'));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(form);
    });
  }

  private async handleSubmit(form: HTMLFormElement): Promise<void> {
    // Clear previous error messages
    form.querySelectorAll('.form-error').forEach((el) => (el.textContent = ''));
    form.querySelectorAll('.form-control').forEach((el) => el.classList.remove('is-invalid'));

    const formData: OrderFormData = {
      customerName: (form.querySelector('#customerName') as HTMLInputElement).value,
      phone: (form.querySelector('#phone') as HTMLInputElement).value,
      productName: (form.querySelector('#productName') as HTMLInputElement).value,
      quantity: (form.querySelector('#quantity') as HTMLInputElement).value,
      unitPrice: (form.querySelector('#unitPrice') as HTMLInputElement).value,
      deposit: (form.querySelector('#deposit') as HTMLInputElement).value,
      orderDate: (form.querySelector('#orderDate') as HTMLInputElement).value,
      deliveryDate: (form.querySelector('#deliveryDate') as HTMLInputElement).value,
      status: (form.querySelector('#status') as HTMLSelectElement).value,
      note: (form.querySelector('#note') as HTMLTextAreaElement).value,
    };

    const validation = validateOrderForm(formData);

    if (!validation.isValid) {
      // Display field errors
      for (const [field, msg] of Object.entries(validation.errors)) {
        const input = form.querySelector(`#${field}`) as HTMLElement;
        const errEl = form.querySelector(`#err-${field}`) as HTMLElement;
        if (input) input.classList.add('is-invalid');
        if (errEl) errEl.textContent = msg;
      }
      toast.show('Chưa đúng thông tin', 'Vui lòng kiểm tra lại các trường được báo đỏ.', 'error');
      return;
    }

    const submitBtn = form.querySelector('#form-btn-submit') as HTMLButtonElement;
    submitBtn.disabled = true;

    try {
      if (this.existingOrder) {
        // Update existing order
        await orderService.updateOrder(this.existingOrder.id, {
          customerName: formData.customerName,
          phone: formData.phone,
          productName: formData.productName,
          quantity: Number(formData.quantity),
          unitPrice: Number(formData.unitPrice),
          deposit: Number(formData.deposit) || 0,
          orderDate: formData.orderDate,
          deliveryDate: formData.deliveryDate,
          status: formData.status as OrderStatus,
          note: formData.note,
        });

        toast.show('Thành công', `Đã lưu cập nhật cho đơn hàng ${this.existingOrder.id}`, 'success');
      } else {
        // Create new order
        const created = await orderService.addOrder({
          customerName: formData.customerName,
          phone: formData.phone,
          productName: formData.productName,
          quantity: Number(formData.quantity),
          unitPrice: Number(formData.unitPrice),
          deposit: Number(formData.deposit) || 0,
          orderDate: formData.orderDate,
          deliveryDate: formData.deliveryDate,
          status: formData.status as OrderStatus,
          note: formData.note,
        });

        toast.show('Thành công', `Đã tạo đơn hàng mới mã ${created.id}`, 'success');
      }

      this.onNavigate('orders');
    } catch (err) {
      console.error('Lỗi khi lưu đơn:', err);
      toast.show(
        'Lỗi lưu đơn hàng',
        err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu dữ liệu.',
        'error'
      );
      submitBtn.disabled = false;
    }
  }
}
