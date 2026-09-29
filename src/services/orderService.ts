import { Order, OrderStatus } from '../models/Order';
import { storageService } from './storageService';

export interface CreateOrderInput {
  customerName: string;
  phone?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  deposit?: number;
  orderDate: string; // YYYY-MM-DD
  deliveryDate: string; // YYYY-MM-DD
  status: OrderStatus;
  note?: string;
}

export type UpdateOrderInput = Partial<CreateOrderInput>;

export interface FilterOptions {
  searchQuery?: string;
  status?: OrderStatus | 'all';
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  sortBy?: 'newest' | 'oldest';
}

class OrderService {
  private orders: Order[] = [];
  private isInitialized = false;

  /**
   * Initialize orders list from local storage
   */
  public async init(): Promise<Order[]> {
    const { document } = await storageService.loadDocument();
    this.orders = [...document.orders];
    this.isInitialized = true;
    return this.orders;
  }

  /**
   * Ensure order service is loaded
   */
  private async ensureLoaded(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  /**
   * Get all orders
   */
  public async getAllOrders(): Promise<Order[]> {
    await this.ensureLoaded();
    return [...this.orders];
  }

  /**
   * Find order by unique ID
   */
  public async getOrderById(id: string): Promise<Order | undefined> {
    await this.ensureLoaded();
    return this.orders.find((o) => o.id === id);
  }

  /**
   * Generate next sequential Order ID (e.g. ORD-0001, ORD-0002)
   */
  public generateNextId(): string {
    let maxNumber = 0;
    const regex = /^ORD-(\d+)$/i;

    for (const order of this.orders) {
      const match = order.id.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }

    const nextNumber = maxNumber + 1;
    return `ORD-${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Add a new order
   */
  public async addOrder(input: CreateOrderInput): Promise<Order> {
    await this.ensureLoaded();

    const quantity = Math.max(1, Math.floor(Number(input.quantity) || 1));
    const unitPrice = Math.max(0, Number(input.unitPrice) || 0);
    const deposit = Math.max(0, Number(input.deposit) || 0);
    const total = quantity * unitPrice;

    const nowIso = new Date().toISOString();
    const newOrder: Order = {
      id: this.generateNextId(),
      customerName: input.customerName.trim(),
      phone: (input.phone || '').trim(),
      productName: input.productName.trim(),
      quantity,
      unitPrice,
      total,
      deposit,
      orderDate: input.orderDate,
      deliveryDate: input.deliveryDate,
      status: input.status || 'pending',
      note: (input.note || '').trim(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Prepend to list (newest on top)
    this.orders.unshift(newOrder);

    await this.persist();
    return newOrder;
  }

  /**
   * Update an existing order
   */
  public async updateOrder(id: string, input: UpdateOrderInput): Promise<Order> {
    await this.ensureLoaded();

    const index = this.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      throw new Error(`Không tìm thấy đơn hàng có mã ${id}`);
    }

    const existing = this.orders[index];
    const quantity =
      input.quantity !== undefined
        ? Math.max(1, Math.floor(Number(input.quantity) || 1))
        : existing.quantity;
    const unitPrice =
      input.unitPrice !== undefined
        ? Math.max(0, Number(input.unitPrice) || 0)
        : existing.unitPrice;
    const deposit =
      input.deposit !== undefined
        ? Math.max(0, Number(input.deposit) || 0)
        : existing.deposit;
    const total = quantity * unitPrice;

    const updatedOrder: Order = {
      ...existing,
      customerName:
        input.customerName !== undefined ? input.customerName.trim() : existing.customerName,
      phone: input.phone !== undefined ? input.phone.trim() : existing.phone,
      productName:
        input.productName !== undefined ? input.productName.trim() : existing.productName,
      quantity,
      unitPrice,
      total,
      deposit,
      orderDate: input.orderDate || existing.orderDate,
      deliveryDate: input.deliveryDate || existing.deliveryDate,
      status: input.status || existing.status,
      note: input.note !== undefined ? input.note.trim() : existing.note,
      updatedAt: new Date().toISOString(),
    };

    this.orders[index] = updatedOrder;
    await this.persist();
    return updatedOrder;
  }

  /**
   * Delete an order
   */
  public async deleteOrder(id: string): Promise<boolean> {
    await this.ensureLoaded();

    const index = this.orders.findIndex((o) => o.id === id);
    if (index === -1) {
      return false;
    }

    this.orders.splice(index, 1);
    await this.persist();
    return true;
  }

  /**
   * Search and filter orders
   */
  public filterOrders(options: FilterOptions): Order[] {
    let result = [...this.orders];

    // Search query (name, phone, product)
    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.trim().toLowerCase();
      result = result.filter(
        (o) =>
          o.customerName.toLowerCase().includes(q) ||
          o.phone.toLowerCase().includes(q) ||
          o.productName.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
      );
    }

    // Filter by status
    if (options.status && options.status !== 'all') {
      result = result.filter((o) => o.status === options.status);
    }

    // Filter by date range (orderDate)
    if (options.startDate) {
      result = result.filter((o) => o.orderDate >= options.startDate!);
    }
    if (options.endDate) {
      result = result.filter((o) => o.orderDate <= options.endDate!);
    }

    // Sort
    const sortBy = options.sortBy || 'newest';
    result.sort((a, b) => {
      // Primary: orderDate, Secondary: createdAt
      const dateA = a.orderDate + ' ' + (a.createdAt || '');
      const dateB = b.orderDate + ' ' + (b.createdAt || '');
      if (sortBy === 'newest') {
        return dateB.localeCompare(dateA);
      } else {
        return dateA.localeCompare(dateB);
      }
    });

    return result;
  }

  /**
   * Replace all orders (used for JSON restore)
   */
  public async replaceAllOrders(newOrders: Order[]): Promise<void> {
    this.orders = [...newOrders];
    this.isInitialized = true;
    await this.persist();
  }

  /**
   * Persist current in-memory orders to storage
   */
  private async persist(): Promise<void> {
    const doc = storageService.getCachedDocument() || {
      schemaVersion: 1,
      appName: 'MunKek',
      updatedAt: new Date().toISOString(),
      orders: [],
    };
    doc.orders = this.orders;
    await storageService.saveDocument(doc);
  }
}

export const orderService = new OrderService();
