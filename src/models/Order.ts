export type DiscountType = 'none' | 'percent' | 'fixed' | 'final' | 'amount' | 'override' | 'target_total';

export type OrderStatus = 'pending' | 'preparing' | 'completed' | 'cancelled';

export interface OrderItem {
  productId?: string;
  productName: string;
  unitPrice: number; // Đơn giá snapshot tại thời điểm bán
  quantity: number;
  lineTotal: number; // quantity * unitPrice
  costPrice?: number; // Giá vốn snapshot tại thời điểm bán (tùy chọn)
  originalPrice?: number;
  customPrice?: number;
  [key: string]: unknown;
}

export interface CustomerSnapshot {
  id?: string;
  name?: string;
  phone?: string;
  address?: string;
}

export interface Order {
  id: string; // e.g. "ORD-0001"
  orderDate: string; // YYYY-MM-DD (ngày ghi nhận đơn, mặc định hôm nay)
  deliveryDate?: string; // YYYY-MM-DD (ngày hẹn giao, tùy chọn)
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601

  // Customer information
  customer?: CustomerSnapshot;
  customerId?: string;
  customerName: string; // "Khách không xác định" nếu không nhập
  phone?: string;
  address?: string;
  note?: string; // Ghi chú tự do

  // Items
  items: OrderItem[];

  // Financials
  subtotal: number; // Tổng tiền các sản phẩm trước giảm giá
  discountType: DiscountType; // none | percent | fixed | final
  discountValue: number; // Giá trị nhập vào (% hoặc tiền giảm hoặc giá chốt)
  discountAmount: number; // Số tiền được giảm thực tế (VNĐ)
  finalTotal: number; // Thành tiền cuối cùng sau giảm giá
  discountNote?: string;

  // Legacy fields for backward compatibility
  total: number; // Alias of finalTotal
  deposit?: number;
  remaining?: number;
  status?: OrderStatus | string; // Legacy status if present ('pending' | 'completed' | 'cancelled')
  productName?: string; // Legacy summary
  quantity?: number; // Legacy total qty
  unitPrice?: number;
  [key: string]: unknown;
}

export interface OrdersDocument {
  schemaVersion: number;
  appName?: string;
  updatedAt: string;
  orders: Order[];
}

export const CURRENT_SCHEMA_VERSION = 2;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ giao',
  preparing: 'Đang làm',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

export const ORDER_STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: 'badge-pending',
  preparing: 'badge-preparing',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  none: 'Không giảm giá',
  percent: 'Giảm theo phần trăm (%)',
  fixed: 'Giảm một số tiền (VNĐ)',
  amount: 'Giảm một số tiền (VNĐ)',
  final: 'Giảm còn giá cuối (VNĐ)',
  override: 'Giảm còn giá cuối (VNĐ)',
  target_total: 'Giảm còn giá cuối (VNĐ)',
};

/**
 * Calculate discount amount and final total accurately according to the 3 modes
 */
export function calculateOrderDiscountAndTotal(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number
): { discountAmount: number; finalTotal: number } {
  const cleanSubtotal = Math.max(0, Math.round(Number(subtotal) || 0));
  const cleanVal = Math.max(0, Number(discountValue) || 0);

  if (discountType === 'percent') {
    const pct = Math.max(0, Math.min(100, cleanVal));
    const discountAmount = Math.min(cleanSubtotal, Math.round((cleanSubtotal * pct) / 100));
    const finalTotal = Math.max(0, cleanSubtotal - discountAmount);
    return { discountAmount, finalTotal };
  }

  if (discountType === 'fixed' || discountType === 'amount') {
    const discountAmount = Math.max(0, Math.min(cleanSubtotal, Math.round(cleanVal)));
    const finalTotal = Math.max(0, cleanSubtotal - discountAmount);
    return { discountAmount, finalTotal };
  }

  if (discountType === 'final' || discountType === 'override' || discountType === 'target_total') {
    const target = Math.max(0, Math.min(cleanSubtotal, Math.round(cleanVal)));
    const discountAmount = Math.max(0, cleanSubtotal - target);
    return { discountAmount, finalTotal: target };
  }

  // 'none'
  return { discountAmount: 0, finalTotal: cleanSubtotal };
}

/**
 * Normalizes any order object (legacy v0.1.0 or v0.2.0) into a clean, resilient Order.
 */
export function normalizeOrder(raw: Record<string, unknown>, index = 0): Order {
  const id = String(raw.id || `ORD-${String(index + 1).padStart(4, '0')}`);

  // Customer resolution
  let customerId = raw.customerId ? String(raw.customerId) : undefined;
  let customerName = '';
  let phone = '';
  let address = '';

  if (raw.customer && typeof raw.customer === 'object') {
    const c = raw.customer as Record<string, unknown>;
    customerName = String(c.name || '').trim();
    phone = String(c.phone || '').trim();
    address = String(c.address || '').trim();
    if (c.id) customerId = String(c.id);
  }
  if (!customerName && raw.customerName) {
    customerName = String(raw.customerName).trim();
  }
  if (!phone && raw.phone) {
    phone = String(raw.phone).trim();
  }
  if (!customerName) {
    customerName = 'Khách không xác định';
  }

  // Items resolution
  let items: OrderItem[] = [];
  if (Array.isArray(raw.items) && raw.items.length > 0) {
    items = raw.items.map((it: Record<string, unknown>) => {
      const pName = String(it.productName || 'Bánh Trung Thu').trim();
      const uPrice = Math.max(0, Number(it.unitPrice ?? it.customPrice ?? it.originalPrice) || 0);
      const qty = Math.max(1, Number(it.quantity) || 1);
      const lineTotal = Math.max(0, Number(it.lineTotal ?? qty * uPrice) || 0);
      const costPrice = it.costPrice !== undefined ? Math.max(0, Number(it.costPrice)) : undefined;

      return {
        productId: it.productId ? String(it.productId) : undefined,
        productName: pName,
        unitPrice: uPrice,
        quantity: qty,
        lineTotal,
        costPrice,
        originalPrice: it.originalPrice !== undefined ? Number(it.originalPrice) : uPrice,
        customPrice: it.customPrice !== undefined ? Number(it.customPrice) : undefined,
      };
    });
  } else if (raw.productName) {
    // Legacy single-item order
    const pName = String(raw.productName).trim();
    const qty = Math.max(1, Number(raw.quantity) || 1);
    const uPrice = Math.max(0, Number(raw.unitPrice) || 0);
    const lineTotal = Math.max(0, Number(raw.total ?? qty * uPrice) || 0);

    items = [
      {
        productName: pName,
        unitPrice: uPrice,
        quantity: qty,
        lineTotal,
        originalPrice: uPrice,
      },
    ];
  }

  // Calculate Subtotal from items
  const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);

  // Discount resolution
  let discountType = (raw.discountType as DiscountType) || 'none';
  if (discountType === 'amount') discountType = 'fixed';
  if (discountType === 'override') discountType = 'final';

  let discountValue = Math.max(0, Number(raw.discountValue) || 0);
  let discountAmount = Math.max(0, Number(raw.discountAmount) || 0);
  let finalTotal = Math.max(0, Number(raw.finalTotal ?? raw.total) || subtotal);

  if (discountType !== 'none') {
    const calc = calculateOrderDiscountAndTotal(subtotal, discountType, discountValue);
    discountAmount = calc.discountAmount;
    finalTotal = calc.finalTotal;
  } else {
    discountAmount = 0;
    finalTotal = subtotal;
  }

  // Dates
  const now = new Date().toISOString();
  const orderDate = String(raw.orderDate || now.split('T')[0]);
  const deliveryDate = raw.deliveryDate ? String(raw.deliveryDate) : undefined;
  const createdAt = String(raw.createdAt || now);
  const updatedAt = String(raw.updatedAt || now);
  const note = raw.note ? String(raw.note).trim() : undefined;

  // Legacy summary helpers
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  const primaryName =
    items.length === 1
      ? items[0].productName
      : items.map((it) => `${it.quantity}x ${it.productName}`).join(', ');

  return {
    ...raw,
    id,
    orderDate,
    deliveryDate,
    createdAt,
    updatedAt,
    customer: {
      id: customerId,
      name: customerName,
      phone: phone || undefined,
      address: address || undefined,
    },
    customerId,
    customerName,
    phone: phone || undefined,
    address: address || undefined,
    note,
    items,
    subtotal,
    discountType,
    discountValue,
    discountAmount,
    finalTotal,
    total: finalTotal,
    productName: primaryName,
    quantity: totalQty,
    unitPrice: items[0]?.unitPrice || 0,
    deposit: raw.deposit !== undefined ? Number(raw.deposit) : undefined,
    remaining: raw.remaining !== undefined ? Number(raw.remaining) : Math.max(0, finalTotal - (Number(raw.deposit) || 0)),
    status: raw.status ? String(raw.status) : undefined,
  };
}
