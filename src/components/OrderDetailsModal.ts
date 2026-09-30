import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_CLASSES, DISCOUNT_TYPE_LABELS } from '../models/Order';
import { formatCurrency, formatDate, formatDateTime, getDeliveryUrgency } from '../utils/formatters';

export function showOrderDetailsModal(
  order: Order,
  onEditRequested: (orderId: string) => void
): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
  const statusBadge = ORDER_STATUS_BADGE_CLASSES[order.status] || 'badge-pending';
  const urgency = getDeliveryUrgency(order.deliveryDate, order.status);
  const remaining = order.remaining !== undefined ? order.remaining : Math.max(0, order.total - (order.deposit || 0));

  const items = order.items || [];
  const totalQuantity = items.reduce((sum, it) => sum + (it.quantity || 1), 0);

  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 620px;">
      <div class="modal-header">
        <div>
          <div style="font-size: 13px; font-weight: 700; color: var(--primary); text-transform: uppercase;">
            Chi tiết đơn hàng Bánh Trung Thu
          </div>
          <h3 class="modal-title" style="margin-top: 2px;">
            ${order.id} - ${order.customer?.name || 'Khách vãng lai'}
          </h3>
        </div>
        <button class="modal-close-btn" id="modal-close-btn">✕</button>
      </div>

      <div class="modal-body">
        <div style="display: flex; gap: 10px; margin-bottom: 18px;">
          <span class="badge ${statusBadge}" style="font-size: 13px; padding: 6px 12px;">${statusLabel}</span>
          <span class="urgency-badge ${urgency.className}" style="font-size: 13px; padding: 6px 12px;">${urgency.label}</span>
        </div>

        <!-- Customer Card -->
        <div style="background-color: #faf7f2; border-radius: var(--radius-md); padding: 14px 18px; border: 1px solid var(--border-color); display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px;">
          <div>
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">KHÁCH HÀNG</div>
            <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
              ${order.customer?.name || 'Khách vãng lai'}
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">SỐ ĐIỆN THOẠI</div>
            <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
              ${order.customer?.phone || '<span style="color: var(--text-muted);">-</span>'}
            </div>
          </div>
          <div style="grid-column: span 2;">
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">ĐỊA CHỈ / HẸN NHẬN BÁNH</div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">
              ${order.customer?.address || 'Nhận trực tiếp tại tiệm'}
            </div>
          </div>
        </div>

        <!-- Mooncake Cart Items List -->
        <div style="margin-bottom: 18px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; display: flex; justify-content: space-between;">
            <span>DANH SÁCH BÁNH ĐẶT</span>
            <span>Tổng số: <strong>${totalQuantity}</strong> chiếc / hộp</span>
          </div>

          <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
            <table class="data-table" style="font-size: 13px; margin: 0;">
              <thead>
                <tr>
                  <th>Tên bánh</th>
                  <th style="width: 70px; text-align: center;">SL</th>
                  <th style="width: 120px; text-align: right;">Đơn giá</th>
                  <th style="width: 120px; text-align: right;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map((it) => {
                    const price = it.customPrice !== undefined && it.customPrice >= 0 ? it.customPrice : it.originalPrice;
                    const lineTotal = it.quantity * price;
                    const hasDiscount = it.customPrice !== undefined && it.customPrice < it.originalPrice;

                    return `
                    <tr>
                      <td>
                        <strong>${it.productName}</strong>
                        ${
                          hasDiscount
                            ? `<span style="font-size: 11px; color: #15803d; display: block;">Ưu đãi giá riêng: ${formatCurrency(it.customPrice!)}</span>`
                            : ''
                        }
                      </td>
                      <td style="text-align: center;"><strong>${it.quantity}</strong></td>
                      <td style="text-align: right;">${formatCurrency(price)}</td>
                      <td style="text-align: right; font-weight: 700; color: var(--primary);">
                        ${formatCurrency(lineTotal)}
                      </td>
                    </tr>
                  `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Financial Breakdown -->
        <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; margin-bottom: 18px; background: #fffcf8;">
          <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: var(--text-secondary);">
            <span>Tạm tính giỏ bánh:</span>
            <span style="font-weight: 600;">${formatCurrency(order.subtotal || order.total)}</span>
          </div>

          ${
            order.discountType && order.discountType !== 'none'
              ? `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #dc2626;">
              <span>
                Giảm giá (${DISCOUNT_TYPE_LABELS[order.discountType]}):
                ${order.discountNote ? `<span style="font-size: 11px; color: var(--text-muted); font-style: italic;">(${order.discountNote})</span>` : ''}
              </span>
              <span style="font-weight: 600;">
                -${formatCurrency(Math.max(0, (order.subtotal || order.total) - order.total))}
              </span>
            </div>
          `
              : ''
          }

          <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 16px; font-weight: 800; border-top: 1px solid var(--border-light); margin-top: 4px; padding-top: 8px;">
            <span>Tổng thanh toán:</span>
            <span style="color: var(--primary);">${formatCurrency(order.total)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #059669;">
            <span>Đã đặt cọc trước:</span>
            <span style="font-weight: 600;">${formatCurrency(order.deposit || 0)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 15px; font-weight: 700; color: #b45309; border-top: 1px dashed #fed7aa; margin-top: 4px; padding-top: 8px;">
            <span>Còn lại phải thu khi giao bánh:</span>
            <span>${formatCurrency(remaining)}</span>
          </div>
        </div>

        <!-- Schedule & Notes -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div>
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">NGÀY NHẬN ĐƠN</div>
            <div style="font-size: 13px; font-weight: 600; margin-top: 2px;">${formatDate(order.orderDate)}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">NGÀY HẸN GIAO BÁNH</div>
            <div style="font-size: 14px; font-weight: 700; color: var(--primary); margin-top: 2px;">
              ${formatDate(order.deliveryDate)}
            </div>
          </div>
        </div>

        ${
          order.note
            ? `
          <div style="margin-bottom: 14px;">
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">GHI CHÚ ĐƠN BÁNH</div>
            <div style="font-size: 13px; color: var(--text-primary); margin-top: 4px; background: #fafaf9; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
              ${order.note}
            </div>
          </div>
        `
            : ''
        }

        <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between; margin-top: 12px;">
          <span>Tạo lúc: ${formatDateTime(order.createdAt)}</span>
          <span>Cập nhật: ${formatDateTime(order.updatedAt)}</span>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-close-action">Đóng</button>
        <button class="btn btn-primary" id="modal-edit-action">
          <span>✏️</span> Sửa đơn hàng
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    document.removeEventListener('keydown', handleKeyDown);
    if (overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', handleKeyDown);

  overlay.querySelector('#modal-close-btn')?.addEventListener('click', close);
  overlay.querySelector('#modal-close-action')?.addEventListener('click', close);
  overlay.querySelector('#modal-edit-action')?.addEventListener('click', () => {
    close();
    onEditRequested(order.id);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}
