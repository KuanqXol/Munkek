export type ProductType = 'baked' | 'snowskin' | 'box' | 'combo' | 'other';

export interface Product {
  id: string; // ví dụ: BTT-01, BTT-02, BOX-01
  name: string; // Tên bánh: Thập cẩm gà quay vi cá, Đậu xanh hạt sen...
  type: ProductType; // baked: Bánh nướng, snowskin: Bánh dẻo, box: Hộp quà/Vỏ hộp, combo: Set quà
  eggCount: number; // 0: không trứng (chay), 1: 1 trứng, 2: 2 trứng
  weight: number; // gram (150, 180, 200, 250)
  unitPrice: number; // Đơn giá bán niêm yết (VNĐ)
  costPrice?: number; // Giá vốn làm bánh (tùy chọn)
  isAvailable: boolean; // Còn nhận làm hay tạm hết nhân
  description?: string; // Mô tả nhân, độ ngọt
  imageUrl?: string; // Hình ảnh hoặc icon
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
  baked: 'badge-baked',
  snowskin: 'badge-snowskin',
  box: 'badge-box',
  combo: 'badge-combo',
  other: 'badge-other',
};
