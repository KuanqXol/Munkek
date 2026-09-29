import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_CLASSES } from '../models/Order';
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
  const remaining = Math.max(0, order.total - (order.deposit || 0));

  overlay.innerHTML = `
    <div class="modal-card" style="max-width: 580px;">
      <div class="modal-header">
        <div>
          <div style="font-size: 13px; font-weight: 700; color: var(--primary); text-transform: uppercase;">Chi tiết đơn hàng</div>
          <h3 class="modal-title" style="margin-top: 2px;">${order.id} - ${order.customerName}</h3>
        </div>
        <button class="modal-close-btn" id="modal-close-btn">✕</button>
      </div>

      <div class="modal-body">
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
          <span class="badge ${statusBadge}" style="font-size: 13px; padding: 6px 12px;">${statusLabel}</span>
          <span class="urgency-badge ${urgency.className}" style="font-size: 13px; padding: 6px 12px;">${urgency.label}</span>
        </div>

        <div style="background-color: #faf7f2; border-radius: var(--radius-md); padding: 18px; border: 1px solid var(--border-color); display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;">
          <div>
            <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">KHÁCH HÀNG</div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">${order.customerName}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">SỐ ĐIỆN THOẠI</div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">${order.phone || 'Chưa có'}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">TÊN BÁNH / SẢN PHẨM</div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">${order.productName}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">SỐ LƯỢNG</div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-top: 2px;">${order.quantity} cái / ổ</div>
          </div>
        </div>

        <!-- Financial Breakdown -->
        <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: var(--text-secondary);">
            <span>Đơn giá:</span>
            <span style="font-weight: 600;">${formatCurrency(order.unitPrice)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 15px; font-weight: 700; border-top: 1px solid var(--border-light); margin-top: 4px; padding-top: 8px;">
            <span>Tổng thành tiền:</span>
            <span style="color: var(--primary);">${formatCurrency(order.total)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #059669;">
            <span>Đã đặt cọc:</span>
            <span style="font-weight: 600;">${formatCurrency(order.deposit || 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 15px; font-weight: 700; color: #c2410c; border-top: 1px dashed var(--border-color); margin-top: 4px; padding-top: 8px;">
            <span>Còn lại phải thu:</span>
            <span>${formatCurrency(remaining)}</span>
          </div>
        </div>

        <!-- Schedule & Notes -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">NGÀY ĐẶT</div>
            <div style="font-size: 14px; font-weight: 600; margin-top: 2px;">${formatDate(order.orderDate)}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">NGÀY GIAO HÀNG</div>
            <div style="font-size: 14px; font-weight: 700; color: var(--primary); margin-top: 2px;">${formatDate(order.deliveryDate)}</div>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">GHI CHÚ ĐƠN HÀNG</div>
          <div style="font-size: 14px; color: var(--text-primary); margin-top: 4px; background: #fafaf9; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-light); min-height: 48px;">
            ${order.note || 'Không có ghi chú.'}
          </div>
        </div>

        <div style="font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between;">
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
