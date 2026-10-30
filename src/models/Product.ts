export type ProductType = 'baked' | 'snowskin' | 'box' | 'combo' | 'other';

export interface Product {
  id: string; // e.g. "BTT-01", "BOX-01"
  name: string; // Tên bánh
  unitPrice: number; // Đơn giá bán mặc định (VNĐ)
  costPrice?: number; // Giá vốn (tùy chọn, để tính lợi nhuận)
  imageUrl?: string; // Đường dẫn tương đối trong data/images/ hoặc base64
  category?: string; // Phân loại danh mục
  type?: ProductType;
  eggCount?: number;
  weight?: number;
  isAvailable?: boolean;
  isVisible?: boolean; // Hiển thị trên màn hình tạo đơn hay ẩn
  sortOrder?: number;
  description?: string;
  [key: string]: unknown;
}

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  baked: 'Bánh nướng',
  snowskin: 'Bánh dẻo',
  box: 'Vỏ hộp / Túi quà',
  combo: 'Set Combo Hộp',
  other: 'Khác',
};

export const PRODUCT_TYPE_BADGE_CLASSES: Record<ProductType, string> = {
  baked: 'badge-preparing',
  snowskin: 'badge-completed',
  box: 'badge-pending',
  combo: 'badge-preparing',
  other: 'badge-pending',
};
