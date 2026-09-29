export interface OrderFormData {
  customerName: string;
  phone: string;
  productName: string;
  quantity: number | string;
  unitPrice: number | string;
  deposit: number | string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  note: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateOrderForm(data: OrderFormData): ValidationResult {
  const errors: Record<string, string> = {};

  // Tên khách hàng
  if (!data.customerName || !data.customerName.trim()) {
    errors.customerName = 'Vui lòng nhập tên khách hàng';
  }

  // Tên bánh
  if (!data.productName || !data.productName.trim()) {
    errors.productName = 'Vui lòng nhập tên bánh/sản phẩm';
  }

  // Số lượng
  const qty = Number(data.quantity);
  if (isNaN(qty) || qty <= 0) {
    errors.quantity = 'Số lượng bánh phải lớn hơn 0';
  } else if (!Number.isInteger(qty)) {
    errors.quantity = 'Số lượng bánh phải là số nguyên';
  }

  // Đơn giá
  const price = Number(data.unitPrice);
  if (isNaN(price) || price < 0) {
    errors.unitPrice = 'Đơn giá không được âm';
  }

  // Tiền cọc
  const dep = Number(data.deposit);
  if (isNaN(dep) || dep < 0) {
    errors.deposit = 'Tiền cọc không được âm';
  } else if (!isNaN(qty) && !isNaN(price) && dep > qty * price) {
    errors.deposit = 'Tiền cọc không thể lớn hơn tổng tiền đơn hàng';
  }

  // Ngày đặt
  if (!data.orderDate) {
    errors.orderDate = 'Vui lòng chọn ngày đặt';
  }

  // Ngày giao
  if (!data.deliveryDate) {
    errors.deliveryDate = 'Vui lòng chọn ngày giao hàng';
  } else if (data.orderDate && data.deliveryDate < data.orderDate) {
    errors.deliveryDate = 'Ngày giao hàng không thể trước ngày đặt';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
