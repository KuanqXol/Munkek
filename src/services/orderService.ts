import {
  type Order,
  type OrderItem,
  type DiscountType,
  type CustomerSnapshot,
  calculateOrderDiscountAndTotal,
  normalizeOrder,
} from '../models/Order.ts';
import { storageService } from './storageService.ts';
import { customerService } from './customerService.ts';
import { getTodayString, removeVietnameseTones } from '../utils/formatters.ts';

export interface CreateOrderInput {
  items: OrderItem[];
  discountType: DiscountType;
  discountValue: number;
  customer?: CustomerSnapshot;
  customerName?: string;
  phone?: string;
  address?: string;
  orderDate?: string; // YYYY-MM-DD
  deliveryDate?: string; // YYYY-MM-DD
  note?: string;
  deposit?: number;
  status?: string;
  discountNote?: string;
}

export type UpdateOrderInput = Partial<CreateOrderInput> & {
  items?: OrderItem[];
};

export interface FilterOptions {
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: 'newest' | 'oldest' | 'total-desc' | 'total-asc';
}

class OrderService {
  private orders: Order[] = [];
  private isInitialized = false;

  public async init(): Promise<Order[]> {
    this.orders = await storageService.loadOrders();
    this.isInitialized = true;
    return this.orders;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  public async getAllOrders(): Promise<Order[]> {
    await this.ensureLoaded();
    return [...this.orders];
  }

  public async getOrderById(id: string): Promise<Order | undefined> {
    await this.ensureLoaded();
    return this.orders.find((o) => o.id === id);
  }

  public generateNextId(): string {
    let max = 0;
    const regex = /^ORD-(\d+)$/i;

    for (const o of this.orders) {
      const match = o.id.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return `ORD-${String(max + 1).padStart(4, '0')}`;
  }

  /**
   * Fast order recording: minimal actions, instant calculation
   */
  public async addOrder(input: CreateOrderInput): Promise<Order> {
    await this.ensureLoaded();

    if (!input.items || input.items.length === 0) {
      throw new Error('Đơn hàng phải có ít nhất một sản phẩm.');
    }

    const items: OrderItem[] = input.items.map((it) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const uPrice = Math.max(0, Number(it.unitPrice) || 0);
      return {
        productId: it.productId,
        productName: it.productName.trim(),
        unitPrice: uPrice,
        quantity: qty,
        lineTotal: qty * uPrice,
        costPrice: it.costPrice !== undefined ? Math.max(0, Number(it.costPrice)) : undefined,
      };
    });

    const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
    const { discountAmount, finalTotal } = calculateOrderDiscountAndTotal(
      subtotal,
      input.discountType,
      input.discountValue
    );

    const now = new Date().toISOString();
    const orderDate = input.orderDate || getTodayString();
    const customerName = (input.customer?.name || input.customerName || '').trim() || 'Khách không xác định';
    const phone = (input.customer?.phone || input.phone || '').trim();
    const address = (input.customer?.address || input.address || '').trim();

    // If customer name is provided, auto-link or save to customer directory
    let customerId: string | undefined = input.customer?.id;
    if (!customerId && customerName && customerName !== 'Khách không xác định') {
      try {
        const c = await customerService.findOrCreateCustomer(customerName, phone, address);
        customerId = c.id;
      } catch (err) {
        console.warn('Could not auto-link customer:', err);
      }
    }

    const rawOrder: Record<string, unknown> = {
      id: this.generateNextId(),
      orderDate,
      deliveryDate: input.deliveryDate ? input.deliveryDate.trim() : undefined,
      createdAt: now,
      updatedAt: now,
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
      note: input.note ? input.note.trim() : undefined,
      deposit: input.deposit !== undefined ? Number(input.deposit) : undefined,
      status: input.status,
      discountNote: input.discountNote,
      items,
      subtotal,
      discountType: input.discountType,
      discountValue: input.discountValue,
      discountAmount,
      finalTotal,
      total: finalTotal,
    };

    const newOrder = normalizeOrder(rawOrder);
    this.orders.unshift(newOrder);
    await storageService.saveOrders(this.orders);
    return newOrder;
  }

  /**
   * Update an existing order at any time
   */
  public async updateOrder(id: string, input: UpdateOrderInput): Promise<Order> {
    await this.ensureLoaded();

    const index = this.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new Error(`Không tìm thấy đơn hàng mã ${id}`);
    }

    const existing = this.orders[index];
    const items = (input.items || existing.items).map((it) => {
      const qty = Math.max(1, Number(it.quantity) || 1);
      const uPrice = Math.max(0, Number(it.unitPrice) || 0);
      return {
        productId: it.productId,
        productName: it.productName.trim(),
        unitPrice: uPrice,
        quantity: qty,
        lineTotal: qty * uPrice,
        costPrice: it.costPrice !== undefined ? Math.max(0, Number(it.costPrice)) : undefined,
      };
    });

    const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
    const discountType = input.discountType || existing.discountType;
    const discountValue = input.discountValue !== undefined ? input.discountValue : existing.discountValue;

    const { discountAmount, finalTotal } = calculateOrderDiscountAndTotal(
      subtotal,
      discountType,
      discountValue
    );

    const customerName = input.customer?.name !== undefined ? (input.customer.name.trim() || 'Khách không xác định') : (input.customerName !== undefined ? (input.customerName.trim() || 'Khách không xác định') : existing.customerName);
    const phone = input.customer?.phone !== undefined ? input.customer.phone.trim() : (input.phone !== undefined ? input.phone.trim() : existing.phone);
    const address = input.customer?.address !== undefined ? input.customer.address.trim() : (input.address !== undefined ? input.address.trim() : existing.address);

    let customerId = input.customer?.id || existing.customerId;
    if (!customerId && customerName && customerName !== 'Khách không xác định') {
      try {
        const c = await customerService.findOrCreateCustomer(customerName, phone, address);
        customerId = c.id;
      } catch (err) {
        console.warn('Could not auto-link customer:', err);
      }
    }

    const rawOrder: Record<string, unknown> = {
      ...existing,
      orderDate: input.orderDate || existing.orderDate,
      deliveryDate: input.deliveryDate !== undefined ? (input.deliveryDate.trim() || undefined) : existing.deliveryDate,
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
      note: input.note !== undefined ? (input.note.trim() || undefined) : existing.note,
      deposit: input.deposit !== undefined ? Number(input.deposit) : existing.deposit,
      status: input.status !== undefined ? input.status : existing.status,
      discountNote: input.discountNote !== undefined ? input.discountNote : existing.discountNote,
      items,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      finalTotal,
      total: finalTotal,
      updatedAt: new Date().toISOString(),
    };

    const updated = normalizeOrder(rawOrder, index);
    this.orders[index] = updated;
    await storageService.saveOrders(this.orders);
    return updated;
  }

  public async deleteOrder(id: string): Promise<boolean> {
    await this.ensureLoaded();

    const index = this.orders.findIndex((o) => o.id === id);
    if (index === -1) return false;

    this.orders.splice(index, 1);
    await storageService.saveOrders(this.orders);
    return true;
  }

  /**
   * Search and filter orders with Vietnamese unaccented search
   */
  public filterOrders(options: FilterOptions): Order[] {
    let result = [...this.orders];

    if (options.searchQuery && options.searchQuery.trim()) {
      const qClean = removeVietnameseTones(options.searchQuery.trim());
      const digitsOnly = options.searchQuery.replace(/\D/g, '');

      result = result.filter((o) => {
        const idMatches = o.id.toLowerCase().includes(qClean);
        const nameMatches = removeVietnameseTones(o.customerName).includes(qClean);
        const phoneMatches = digitsOnly.length >= 3 && o.phone && o.phone.replace(/\D/g, '').includes(digitsOnly);
        const productMatches = o.items.some((it) => removeVietnameseTones(it.productName).includes(qClean));
        const noteMatches = o.note && removeVietnameseTones(o.note).includes(qClean);

        return idMatches || nameMatches || phoneMatches || productMatches || noteMatches;
      });
    }

    if (options.startDate) {
      result = result.filter((o) => o.orderDate >= options.startDate!);
    }
    if (options.endDate) {
      result = result.filter((o) => o.orderDate <= options.endDate!);
    }

    if (options.minAmount !== undefined) {
      result = result.filter((o) => o.finalTotal >= options.minAmount!);
    }
    if (options.maxAmount !== undefined) {
      result = result.filter((o) => o.finalTotal <= options.maxAmount!);
    }

    const sortBy = options.sortBy || 'newest';
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return b.orderDate.localeCompare(a.orderDate) || b.createdAt.localeCompare(a.createdAt);
      }
      if (sortBy === 'oldest') {
        return a.orderDate.localeCompare(b.orderDate) || a.createdAt.localeCompare(b.createdAt);
      }
      if (sortBy === 'total-desc') {
        return b.finalTotal - a.finalTotal;
      }
      if (sortBy === 'total-asc') {
        return a.finalTotal - b.finalTotal;
      }
      return 0;
    });

    return result;
  }

  public async replaceAllOrders(newOrders: Order[]): Promise<void> {
    this.orders = newOrders.map((o, idx) => normalizeOrder(o as unknown as Record<string, unknown>, idx));
    this.isInitialized = true;
    await storageService.saveOrders(this.orders);
  }
}

export const orderService = new OrderService();

/**
 * Calculate totals and remaining balance for order items
 */
export function calculateOrderTotals(
  items: OrderItem[],
  discountType: DiscountType = 'none',
  discountValue = 0,
  deposit = 0
): {
  subtotal: number;
  discountAmount: number;
  total: number;
  finalTotal: number;
  remaining: number;
} {
  const subtotal = items.reduce((sum, it) => {
    const price = (it.customPrice !== undefined && it.customPrice >= 0 ? it.customPrice : it.originalPrice) ?? it.unitPrice ?? 0;
    const qty = Math.max(1, it.quantity || 1);
    return sum + price * qty;
  }, 0);

  const { discountAmount, finalTotal } = calculateOrderDiscountAndTotal(subtotal, discountType, discountValue);
  const remaining = Math.max(0, finalTotal - (deposit || 0));

  return {
    subtotal,
    discountAmount,
    total: finalTotal,
    finalTotal,
    remaining,
  };
}
