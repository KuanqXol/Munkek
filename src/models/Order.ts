export type OrderStatus = 'pending' | 'preparing' | 'completed' | 'cancelled';

export interface Order {
  id: string; // e.g. "ORD-0001"
  customerName: string;
  phone: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number; // quantity * unitPrice
  deposit: number; // Tiền cọc đã trả trước
  orderDate: string; // YYYY-MM-DD
  deliveryDate: string; // YYYY-MM-DD
  status: OrderStatus;
  note: string;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
  // Extensible for future versions without breaking existing schema
  [extraField: string]: unknown;
}

export interface OrdersDocument {
  schemaVersion: number;
  appName?: string;
  updatedAt: string;
  orders: Order[];
}

export const CURRENT_SCHEMA_VERSION = 1;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Chờ xử lý',
  preparing: 'Đang làm',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

export const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  pending: 'badge-pending',
  preparing: 'badge-preparing',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
};
