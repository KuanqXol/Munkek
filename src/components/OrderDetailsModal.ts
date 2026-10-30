import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_CLASSES, DISCOUNT_TYPE_LABELS } from '../models/Order';
import { formatCurrency, formatDate, formatDateTime, getDeliveryUrgency, escapeHtml } from '../utils/formatters';
import { toast } from './Toast';

export function showOrderDetailsModal(
  order: Order,
  onEditRequested: (orderId: string) => void
): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const statusLabel = order.status ? (ORDER_STATUS_LABELS[order.status] || order.status) : 'Hoàn tất';
  const statusBadge = order.status ? (ORDER_STATUS_BADGE_CLASSES[order.status] || 'badge-completed') : 'badge-completed';
  const urgency = getDeliveryUrgency(order.deliveryDate, order.status);
  const remaining = order.remaining ?? 0;

  const items = order.items || [];
  const totalQuantity = order.quantity || items.reduce((sum, it) => sum + (it.quantity || 1), 0);

  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 580px;">
      <div class="modal-header">
        <div>
          <div style="font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">
            Chi tiết đơn hàng
          </div>
          <h3 class="modal-title" style="margin-top: 2px;">
            ${escapeHtml(order.id)} - ${escapeHtml(order.customer?.name || order.customerName)}
          </h3>
        </div>
        <button class="modal-close-btn" id="modal-close-btn">✕</button>
      </div>

      <div class="modal-body">
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
          <span class="badge ${statusBadge}" style="font-size: 13px; padding: 5px 10px;">${statusLabel}</span>
          <span class="urgency-badge ${urgency.className}" style="font-size: 13px; padding: 5px 10px;">${urgency.label}</span>
        </div>

        <!-- Customer Card -->
        <div style="background-color: #faf8f5; border-radius: var(--radius-md); padding: 14px 16px; border: 1px solid var(--border-color); display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">NGƯỜI MUA</div>
            <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
              ${escapeHtml(order.customer?.name || order.customerName)}
            </div>
          </div>
          <div>
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">SỐ ĐIỆN THOẠI</div>
            <div style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
              ${order.customer?.phone || order.phone ? escapeHtml(order.customer?.phone || order.phone) : '<span style="color: var(--text-muted); font-weight: normal;">Chưa lưu</span>'}
            </div>
          </div>
          <div style="grid-column: span 2;">
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700;">ĐỊA CHỈ / HẸN NHẬN BÁNH</div>
            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">
              ${order.customer?.address ? escapeHtml(order.customer.address) : 'Nhận trực tiếp tại tiệm'}
            </div>
          </div>
        </div>

        <!-- Mooncake Cart Items List -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px; display: flex; justify-content: space-between;">
            <span>DANH SÁCH BÁNH ĐÃ ĐẶT</span>
            <span>Tổng: <strong>${totalQuantity}</strong> chiếc / hộp</span>
          </div>

          <div style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); overflow: hidden;">
            <table class="data-table" style="font-size: 13px; margin: 0;">
              <thead>
                <tr>
                  <th>Tên bánh</th>
                  <th style="width: 60px; text-align: center;">SL</th>
                  <th style="width: 110px; text-align: right;">Đơn giá</th>
                  <th style="width: 110px; text-align: right;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${
                  items.length > 0
                    ? items
                        .map((it) => {
                          const price = (it.customPrice !== undefined && it.customPrice >= 0 ? it.customPrice : it.originalPrice) ?? it.unitPrice ?? 0;
                          const lineTotal = it.quantity * price;
                          const hasDiscount = it.customPrice !== undefined && it.originalPrice !== undefined && it.customPrice < it.originalPrice;

                          return `
                        <tr>
                          <td>
                            <strong>${escapeHtml(it.productName)}</strong>
                            ${
                              hasDiscount
                                ? `<span style="font-size: 11px; color: #15803d; display: block;">Giá ưu đãi riêng: ${formatCurrency(it.customPrice!)}</span>`
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
                        .join('')
                    : `
                    <tr>
                      <td><strong>${escapeHtml(order.productName)}</strong></td>
                      <td style="text-align: center;"><strong>${order.quantity}</strong></td>
                      <td style="text-align: right;">${formatCurrency(order.unitPrice)}</td>
                      <td style="text-align: right; font-weight: 700; color: var(--primary);">${formatCurrency(order.total)}</td>
                    </tr>
                  `
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Financial Summary -->
        <div style="background-color: #faf8f5; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
            <span style="color: var(--text-muted);">Tạm tính:</span>
            <span>${formatCurrency(order.subtotal || order.total)}</span>
          </div>

          ${
            order.discountType && order.discountType !== 'none'
              ? `
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; color: #15803d;">
              <span>
                Giảm giá (${DISCOUNT_TYPE_LABELS[order.discountType] || order.discountType}
                ${order.discountNote ? ` - ${escapeHtml(String(order.discountNote))}` : ''}):
              </span>
              <span>-${formatCurrency(Math.max(0, (order.subtotal || order.total) - order.total))}</span>
            </div>
          `
              : ''
          }

          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; border-top: 1px dashed var(--border-color); padding-top: 8px; margin-bottom: 6px;">
            <span style="color: var(--text-primary);">Tổng thanh toán:</span>
            <span style="color: var(--primary);">${formatCurrency(order.total)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
            <span style="color: var(--text-muted);">Tiền cọc đã nhận:</span>
            <span style="color: #15803d; font-weight: 700;">${formatCurrency(order.deposit || 0)}</span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; border-top: 1px solid var(--border-color); padding-top: 8px;">
            <span style="color: #c2410c;">Số tiền còn lại phải thu:</span>
            <span style="color: #c2410c;">${formatCurrency(remaining)}</span>
          </div>
        </div>

        <!-- Dates & Note -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; margin-bottom: 12px;">
          <div>
            <span style="color: var(--text-muted);">Ngày nhận đơn:</span>
            <strong style="display: block; margin-top: 2px;">${formatDate(order.orderDate)}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted);">Hẹn ngày lấy/giao:</span>
            <strong style="display: block; margin-top: 2px; color: var(--primary);">${formatDate(order.deliveryDate)}</strong>
          </div>
        </div>

        ${
          order.note
            ? `
          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: var(--radius-sm); padding: 10px 14px; font-size: 13px; color: #92400e; margin-bottom: 12px;">
            <strong>Ghi chú:</strong> ${escapeHtml(order.note)}
          </div>
        `
            : ''
        }

        <div style="font-size: 11px; color: var(--text-muted); text-align: right;">
          Tạo lúc: ${formatDateTime(order.createdAt)}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary btn-sm" id="modal-btn-copy-summary">
          📋 Sao chép tóm tắt đơn
        </button>
        <button class="btn btn-secondary btn-sm" id="modal-btn-close">
          Đóng
        </button>
        <button class="btn btn-primary btn-sm" id="modal-btn-edit">
          ✏️ Chỉnh sửa đơn
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
  };

  overlay.querySelector('#modal-close-btn')?.addEventListener('click', close);
  overlay.querySelector('#modal-btn-close')?.addEventListener('click', close);

  overlay.querySelector('#modal-btn-edit')?.addEventListener('click', () => {
    close();
    onEditRequested(order.id);
  });

  // Copy order summary to clipboard (convenient for messaging customers on Zalo)
  overlay.querySelector('#modal-btn-copy-summary')?.addEventListener('click', async () => {
    const itemsText =
      items.length > 0
        ? items.map((it) => `- ${it.quantity}x ${it.productName}: ${formatCurrency(it.quantity * ((it.customPrice ?? it.originalPrice) ?? it.unitPrice ?? 0))}`).join('\n')
        : `- ${order.quantity}x ${order.productName}: ${formatCurrency(order.total)}`;

    const text = `🥮 [MunKek] XÁC NHẬN ĐƠN HÀNG #${order.id}
Khách hàng: ${order.customer?.name || order.customerName}
${order.customer?.phone ? `SĐT: ${order.customer.phone}\n` : ''}${order.customer?.address ? `Địa chỉ nhận: ${order.customer.address}\n` : ''}
Chi tiết bánh:
${itemsText}

Tổng thanh toán: ${formatCurrency(order.total)}
Đã đặt cọc: ${formatCurrency(order.deposit || 0)}
Còn lại thu khi giao: ${formatCurrency(remaining)}
Hẹn ngày nhận: ${formatDate(order.deliveryDate)}
${order.note ? `Ghi chú: ${order.note}\n` : ''}
Cảm ơn bạn đã ủng hộ MunKek!`;

    try {
      await navigator.clipboard.writeText(text);
      toast.show('Đã sao chép', 'Đã copy tóm tắt đơn hàng vào bộ nhớ tạm để gửi tin nhắn.', 'success');
    } catch {
      toast.show('Thông báo', 'Không thể sao chép tự động.', 'info');
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
    }
  });
}
