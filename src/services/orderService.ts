import { Order, OrderItem, OrderStatus, DiscountType, CustomerInfo } from '../models/Order';
import { storageService } from './storageService';

export interface CreateOrderInput {
  customer: CustomerInfo;
  items: OrderItem[];
  orderDate: string; // YYYY-MM-DD
  deliveryDate: string; // YYYY-MM-DD
  discountType: DiscountType;
  discountValue: number;
  discountNote?: string;
  deposit?: number;
  status: OrderStatus;
  note?: string;
}

export type UpdateOrderInput = Partial<CreateOrderInput>;

export interface FilterOptions {
  searchQuery?: string;
  status?: OrderStatus | 'all';
  deliveryDate?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'delivery-soon' | 'newest' | 'oldest';
}

/**
 * Calculate financial totals with flexible discount modes
 */
export function calculateOrderTotals(
  items: OrderItem[],
  discountType: DiscountType,
  discountValue: number,
  deposit: number = 0
): { subtotal: number; discountAmount: number; total: number; remaining: number } {
  const subtotal = items.reduce((sum, item) => {
    const price =
      item.customPrice !== undefined && item.customPrice >= 0
        ? Number(item.customPrice)
        : Number(item.originalPrice) || 0;
    const qty = Math.max(1, Number(item.quantity) || 1);
    return sum + qty * price;
  }, 0);

  let discountAmount = 0;
  let finalTotal = subtotal;

  if (discountType === 'amount') {
    discountAmount = Math.max(0, Math.min(subtotal, Number(discountValue) || 0));
    finalTotal = Math.max(0, subtotal - discountAmount);
  } else if (discountType === 'percent') {
    const pct = Math.max(0, Math.min(100, Number(discountValue) || 0));
    discountAmount = Math.round((subtotal * pct) / 100);
    finalTotal = Math.max(0, subtotal - discountAmount);
  } else if (discountType === 'override') {
    finalTotal = Math.max(0, Number(discountValue) || 0);
    discountAmount = Math.max(0, subtotal - finalTotal);
  }

  const cleanDeposit = Math.max(0, Number(deposit) || 0);
  const remaining = Math.max(0, finalTotal - cleanDeposit);

  return {
    subtotal,
    discountAmount,
    total: finalTotal,
    remaining,
  };
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

  public async addOrder(input: CreateOrderInput): Promise<Order> {
    await this.ensureLoaded();

    const totals = calculateOrderTotals(
      input.items,
      input.discountType,
      input.discountValue,
      input.deposit || 0
    );

    const now = new Date().toISOString();
    const newOrder: Order = {
      id: this.generateNextId(),
      customer: {
        name: (input.customer.name || 'Khách vãng lai').trim(),
        phone: (input.customer.phone || '').trim(),
        address: (input.customer.address || '').trim(),
        note: (input.customer.note || '').trim(),
      },
      items: input.items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: Math.max(1, Number(it.quantity) || 1),
        originalPrice: Math.max(0, Number(it.originalPrice) || 0),
        customPrice: it.customPrice !== undefined ? Math.max(0, Number(it.customPrice)) : undefined,
      })),
      orderDate: input.orderDate,
      deliveryDate: input.deliveryDate,
      subtotal: totals.subtotal,
      discountType: input.discountType,
      discountValue: Number(input.discountValue) || 0,
      discountNote: (input.discountNote || '').trim(),
      total: totals.total,
      deposit: Math.max(0, Number(input.deposit) || 0),
      remaining: totals.remaining,
      status: input.status || 'pending',
      note: (input.note || '').trim(),
      createdAt: now,
      updatedAt: now,
    };

    this.orders.unshift(newOrder);
    await storageService.saveOrders(this.orders);
    return newOrder;
  }

  public async updateOrder(id: string, input: UpdateOrderInput): Promise<Order> {
    await this.ensureLoaded();

    const index = this.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new Error(`Không tìm thấy đơn hàng mã ${id}`);
    }

    const existing = this.orders[index];
    const items = input.items || existing.items;
    const discountType = input.discountType || existing.discountType;
    const discountValue = input.discountValue !== undefined ? input.discountValue : existing.discountValue;
    const deposit = input.deposit !== undefined ? input.deposit : existing.deposit;

    const totals = calculateOrderTotals(items, discountType, discountValue, deposit);

    const updated: Order = {
      ...existing,
      customer: input.customer
        ? {
            name: (input.customer.name || existing.customer.name).trim(),
            phone: (input.customer.phone ?? existing.customer.phone ?? '').trim(),
            address: (input.customer.address ?? existing.customer.address ?? '').trim(),
            note: (input.customer.note ?? existing.customer.note ?? '').trim(),
          }
        : existing.customer,
      items,
      orderDate: input.orderDate || existing.orderDate,
      deliveryDate: input.deliveryDate || existing.deliveryDate,
      subtotal: totals.subtotal,
      discountType,
      discountValue,
      discountNote: input.discountNote !== undefined ? input.discountNote.trim() : existing.discountNote,
      total: totals.total,
      deposit,
      remaining: totals.remaining,
      status: input.status || existing.status,
      note: input.note !== undefined ? input.note.trim() : existing.note,
      updatedAt: new Date().toISOString(),
    };

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
   * Filter and search orders
   */
  public filterOrders(options: FilterOptions): Order[] {
    let result = [...this.orders];

    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.trim().toLowerCase();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          (o.customer.phone && o.customer.phone.includes(q)) ||
          o.items.some((it) => it.productName.toLowerCase().includes(q))
      );
    }

    if (options.status && options.status !== 'all') {
      result = result.filter((o) => o.status === options.status);
    }

    if (options.deliveryDate) {
      result = result.filter((o) => o.deliveryDate === options.deliveryDate);
    }

    if (options.startDate) {
      result = result.filter((o) => o.deliveryDate >= options.startDate!);
    }
    if (options.endDate) {
      result = result.filter((o) => o.deliveryDate <= options.endDate!);
    }

    const sortBy = options.sortBy || 'delivery-soon';
    result.sort((a, b) => {
      if (sortBy === 'delivery-soon') {
        return a.deliveryDate.localeCompare(b.deliveryDate) || b.createdAt.localeCompare(a.createdAt);
      } else if (sortBy === 'newest') {
        return b.createdAt.localeCompare(a.createdAt);
      } else {
        return a.createdAt.localeCompare(b.createdAt);
      }
    });

    return result;
  }

  /**
   * Get total mooncake quantities sold grouped by flavor/filling
   */
  public getMooncakeFillingStats(): Array<{ productName: string; quantity: number; totalAmount: number }> {
    const stats: Record<string, { quantity: number; totalAmount: number }> = {};

    for (const order of this.orders) {
      if (order.status === 'cancelled') continue;

      for (const it of order.items) {
        if (!stats[it.productName]) {
          stats[it.productName] = { quantity: 0, totalAmount: 0 };
        }
        const effectivePrice = it.customPrice !== undefined ? it.customPrice : it.originalPrice;
        stats[it.productName].quantity += it.quantity;
        stats[it.productName].totalAmount += it.quantity * effectivePrice;
      }
    }

    return Object.entries(stats)
      .map(([productName, data]) => ({
        productName,
        quantity: data.quantity,
        totalAmount: data.totalAmount,
      }))
      .sort((a, b) => b.quantity - a.quantity);
  }

  public async replaceAllOrders(newOrders: Order[]): Promise<void> {
    this.orders = [...newOrders];
    this.isInitialized = true;
    await storageService.saveOrders(this.orders);
  }
}

export const orderService = new OrderService();
