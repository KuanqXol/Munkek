import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { calculateOrderDiscountAndTotal, type Order } from '../src/models/Order.ts';
import { analyticsService } from '../src/services/analyticsService.ts';

// Mock minimal localStorage if running in Node
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

if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = new MockLocalStorage();
}

describe('Discount Engine Modes', () => {
  test('Mode 1: percentage discount calculation with exact rounding', () => {
    // 500.000 subtotal, 15% discount -> discountAmount: 75.000, finalTotal: 425.000
    const res = calculateOrderDiscountAndTotal(500000, 'percent', 15);
    assert.equal(res.discountAmount, 75000);
    assert.equal(res.finalTotal, 425000);
  });

  test('Mode 2: fixed amount discount calculation with subtotal cap', () => {
    // 350.000 subtotal, 50.000 discount -> discountAmount: 50.000, finalTotal: 300.000
    const res1 = calculateOrderDiscountAndTotal(350000, 'amount', 50000);
    assert.equal(res1.discountAmount, 50000);
    assert.equal(res1.finalTotal, 300000);

    // discount exceeds subtotal -> capped at subtotal, finalTotal = 0
    const res2 = calculateOrderDiscountAndTotal(100000, 'amount', 150000);
    assert.equal(res2.discountAmount, 100000);
    assert.equal(res2.finalTotal, 0);
  });

  test('Mode 3: target total (giảm còn) calculation', () => {
    // 430.000 subtotal, target 400.000 -> discountAmount: 30.000, finalTotal: 400.000
    const res = calculateOrderDiscountAndTotal(430000, 'target_total', 400000);
    assert.equal(res.discountAmount, 30000);
    assert.equal(res.finalTotal, 400000);
  });
});

describe('Analytics Date Period Filtering', () => {
  const dummyOrders: Order[] = [
    {
      id: 'ORD-0001',
      orderDate: '2026-10-30',
      createdAt: '2026-10-30T10:00:00Z',
      updatedAt: '2026-10-30T10:00:00Z',
      customerName: 'Chị Lan',
      items: [{ productName: 'Bánh nướng', quantity: 2, unitPrice: 80000, lineTotal: 160000 }],
      subtotal: 160000,
      discountType: 'none',
      discountValue: 0,
      discountAmount: 0,
      finalTotal: 160000,
      total: 160000,
    },
    {
      id: 'ORD-0002',
      orderDate: '2026-09-15',
      createdAt: '2026-09-15T14:00:00Z',
      updatedAt: '2026-09-15T14:00:00Z',
      customerName: 'Anh Bình',
      items: [{ productName: 'Bánh dẻo', quantity: 4, unitPrice: 70000, lineTotal: 280000 }],
      subtotal: 280000,
      discountType: 'none',
      discountValue: 0,
      discountAmount: 0,
      finalTotal: 280000,
      total: 280000,
    },
  ];

  test('filters all orders accurately for all period', () => {
    const res = analyticsService.filterOrdersByPeriod(dummyOrders, 'all');
    assert.equal(res.orders.length, 2);
    assert.equal(res.periodLabel, 'Toàn bộ thời gian');
  });

  test('filters custom date range strictly', () => {
    const res = analyticsService.filterOrdersByPeriod(dummyOrders, 'custom', '2026-09-01', '2026-09-30');
    assert.equal(res.orders.length, 1);
    assert.equal(res.orders[0].id, 'ORD-0002');
  });
});

describe('Cashflow & Production Analytics Metrics', () => {
  test('calculates collected vs remaining balance accurately', async () => {
    const report = await analyticsService.computeReport('all');
    // totalFinalValue must equal totalCollected + totalRemaining
    assert.equal(
      report.overview.totalFinalValue,
      report.overview.totalCollected + report.overview.totalRemaining
    );
    assert.ok(report.overview.totalCollected >= 0);
    assert.ok(report.overview.totalRemaining >= 0);
    assert.equal(
      report.overview.totalOrders,
      report.overview.completedOrdersCount + report.overview.pendingOrdersCount
    );
    assert.ok(report.overview.completionRate >= 0 && report.overview.completionRate <= 100);
  });

  test('calculates product share percent correctly', async () => {
    const report = await analyticsService.computeReport('all');
    if (report.products.bestSellersByQty.length > 0) {
      const topProd = report.products.bestSellersByQty[0];
      assert.ok(topProd.quantity > 0);
      assert.ok(topProd.percent >= 0 && topProd.percent <= 100);
    }
  });
});


