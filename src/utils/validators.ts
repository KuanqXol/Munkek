import type { DiscountType, OrderItem } from '../models/Order.ts';
import type { ProductType } from '../models/Product.ts';

export interface OrderFormData {
  customerName?: string;
  phone?: string;
  address?: string;
  items: OrderItem[];
  discountType: DiscountType;
  discountValue: number | string;
  discountNote?: string;
  deposit: number | string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  note?: string;
}

export interface ProductFormData {
  name: string;
  type: ProductType;
  eggCount: number | string;
  weight: number | string;
  unitPrice: number | string;
  costPrice?: number | string;
  isAvailable: boolean;
  description?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateOrderForm(data: OrderFormData): ValidationResult {
  const errors: Record<string, string> = {};

  // Customer Name
  if (!data.customerName || !data.customerName.trim()) {
    errors.customerName = 'Vui lòng nhập tên khách hàng hoặc biệt danh.';
  }

  // Items in order
  if (!data.items || data.items.length === 0) {
    errors.items = 'Vui lòng chọn hoặc nhập ít nhất 1 sản phẩm cho đơn hàng.';
  } else {
    for (let i = 0; i < data.items.length; i++) {
      const it = data.items[i];
      if (!it.productName || !it.productName.trim()) {
        errors.items = `Vui lòng nhập tên cho sản phẩm thứ ${i + 1}.`;
        break;
      }
      if (!it.quantity || Number(it.quantity) <= 0) {
        errors.items = `Số lượng của "${it.productName}" phải lớn hơn 0.`;
        break;
      }
      const price = it.customPrice !== undefined ? Number(it.customPrice) : Number(it.originalPrice);
      if (isNaN(price) || price < 0) {
        errors.items = `Đơn giá của "${it.productName}" không được để trống hoặc âm.`;
        break;
      }
    }
  }

  // Discount validation
  if (data.discountType === 'percent') {
    const pct = Number(data.discountValue);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      errors.discountValue = 'Tỷ lệ chiết khấu phải từ 0% đến 100%.';
    }
  } else if (data.discountType === 'amount') {
    const amt = Number(data.discountValue);
    if (isNaN(amt) || amt < 0) {
      errors.discountValue = 'Số tiền giảm giá không được âm.';
    }
  } else if (data.discountType === 'override') {
    const ov = Number(data.discountValue);
    if (isNaN(ov) || ov < 0) {
      errors.discountValue = 'Giá thỏa thuận chốt đơn không được âm.';
    }
  }

  // Deposit
  const dep = Number(data.deposit);
  if (isNaN(dep) || dep < 0) {
    errors.deposit = 'Tiền đặt cọc không được âm.';
  }

  // Order date
  if (!data.orderDate) {
    errors.orderDate = 'Vui lòng chọn ngày nhận đơn.';
  }

  // Delivery date
  if (!data.deliveryDate) {
    errors.deliveryDate = 'Vui lòng chọn ngày hẹn giao bánh.';
  } else if (data.orderDate && data.deliveryDate < data.orderDate) {
    errors.deliveryDate = 'Ngày hẹn giao không thể trước ngày nhận đơn.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateProductForm(data: ProductFormData): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.name || !data.name.trim()) {
    errors.name = 'Vui lòng nhập tên bánh.';
  }

  const price = Number(data.unitPrice);
  if (isNaN(price) || price <= 0) {
    errors.unitPrice = 'Đơn giá bán phải lớn hơn 0 VNĐ.';
  }

  if (data.costPrice !== undefined && data.costPrice !== '') {
    const cost = Number(data.costPrice);
    if (isNaN(cost) || cost < 0) {
      errors.costPrice = 'Giá vốn không được âm.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
