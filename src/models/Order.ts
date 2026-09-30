export type OrderStatus = 'pending' | 'preparing' | 'completed' | 'cancelled';

export type DiscountType = 'none' | 'amount' | 'percent' | 'override';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  originalPrice: number; // Đơn giá niêm yết
  customPrice?: number; // Đơn giá tự nhập/thỏa thuận nếu bán cho người quen
}

export interface CustomerInfo {
  name: string; // Tên hoặc biệt danh thân mật (ví dụ: Chị Mai hàng xóm)
  phone?: string;
  address?: string;
  note?: string;
}

export interface Order {
  id: string; // ví dụ: ORD-0001
  customer: CustomerInfo;
  items: OrderItem[];
  orderDate: string; // YYYY-MM-DD (ngày nhận đơn)
  deliveryDate: string; // YYYY-MM-DD (ngày hẹn lấy/giao bánh)
  subtotal: number; // Tổng tiền các loại bánh trước giảm giá
  discountType: DiscountType; // none | amount (tiền VNĐ) | percent (%) | override (giá chốt)
  discountValue: number; // Số tiền giảm hoặc số %
  discountNote?: string; // Lý do giảm: "Người quen", "Khách sỉ", "Bớt tiền lẻ"...
  total: number; // Tổng tiền thanh toán sau giảm giá
  deposit: number; // Tiền đặt cọc trước
  remaining: number; // Số tiền còn lại phải thu khi giao bánh
  status: OrderStatus;
  note?: string; // Ghi chú riêng: ít ngọt, bọc túi bóng kính, hộp quà biếu sếp...
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  [key: string]: unknown;
}

export interface OrdersDocument {
  schemaVersion: number;
  appName?: string;
  updatedAt: string;
  orders: Order[];
}

export const CURRENT_SCHEMA_VERSION = 1;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Chờ làm (Đặt trước)',
  preparing: 'Đang làm / Nướng bánh',
  completed: 'Đã hoàn thành / Đã giao',
  cancelled: 'Đã hủy đơn',
};

export const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  pending: 'badge-pending',
  preparing: 'badge-preparing',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  none: 'Không giảm giá',
  amount: 'Giảm số tiền cụ thể (VNĐ)',
  percent: 'Giảm theo phần trăm (%)',
  override: 'Giá chốt thỏa thuận (Tự nhập giá)',
};
