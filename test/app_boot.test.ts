import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Mock minimal browser DOM environment for Node
class MockLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

describe('Application Lifecycle & Bootstrap Verification', () => {
  test('MunKek initialization loads products and sets up storage correctly', async () => {
    // Setup mock globals if not present
    if (typeof (globalThis as any).localStorage === 'undefined') {
      (globalThis as any).localStorage = new MockLocalStorage();
    }

    const { storageService } = await import('../src/services/storageService.ts');
    const { productService } = await import('../src/services/productService.ts');
    const { orderService } = await import('../src/services/orderService.ts');

    const status = await storageService.init();
    assert.equal(status.status, 'READY');

    const products = await productService.init();
    assert.ok(products.length >= 8, 'Default products should be loaded');

    const visible = await productService.getVisibleProducts();
    assert.ok(visible.length > 0, 'Visible products should be available for POS');

    const orders = await orderService.init();
    assert.ok(Array.isArray(orders), 'Orders should initialize as array');
  });

  test('Order Creation flow accurately stores new order', async () => {
    const { orderService } = await import('../src/services/orderService.ts');
    const { productService } = await import('../src/services/productService.ts');

    const products = await productService.getVisibleProducts();
    const p1 = products[0];

    const newOrder = await orderService.addOrder({
      items: [
        {
          productId: p1.id,
          productName: p1.name,
          unitPrice: p1.unitPrice,
          quantity: 2,
          lineTotal: p1.unitPrice * 2,
        },
      ],
      discountType: 'amount',
      discountValue: 20000,
      customerName: 'Khách Kiểm Thử Boot',
      phone: '0901234567',
    });

    assert.ok(newOrder.id.startsWith('ORD-'));
    assert.equal(newOrder.customerName, 'Khách Kiểm Thử Boot');
    assert.equal(newOrder.discountAmount, 20000);
    assert.equal(newOrder.finalTotal, p1.unitPrice * 2 - 20000);

    const fetched = await orderService.getOrderById(newOrder.id);
    assert.ok(fetched);
    assert.equal(fetched?.id, newOrder.id);
  });
});

