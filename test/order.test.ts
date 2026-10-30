import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateOrderTotals } from '../src/services/orderService.ts';
import { normalizeOrder, type OrderItem } from '../src/models/Order.ts';
import { escapeHtml, formatCurrency, formatDate, getDaysFromToday } from '../src/utils/formatters.ts';
import { validateOrderForm } from '../src/utils/validators.ts';
import { backupService } from '../src/services/backupService.ts';

describe('Order Financial Calculations (calculateOrderTotals)', () => {
  test('calculates standard subtotal with multiple items without discount', () => {
    const items: OrderItem[] = [
      { productName: 'Bánh Thập Cẩm', quantity: 2, originalPrice: 90000 },
      { productName: 'Bánh Đậu Xanh', quantity: 3, originalPrice: 75000 },
    ];
    const res = calculateOrderTotals(items, 'none', 0, 100000);
    // Subtotal: 2*90k + 3*75k = 180k + 225k = 405k
    assert.equal(res.subtotal, 405000);
    assert.equal(res.discountAmount, 0);
    assert.equal(res.total, 405000);
    assert.equal(res.remaining, 305000);
  });

  test('applies amount discount correctly', () => {
    const items: OrderItem[] = [
      { productName: 'Hộp Quà', quantity: 1, originalPrice: 300000 },
    ];
    const res = calculateOrderTotals(items, 'amount', 30000, 100000);
    assert.equal(res.subtotal, 300000);
    assert.equal(res.discountAmount, 30000);
    assert.equal(res.total, 270000);
    assert.equal(res.remaining, 170000);
  });

  test('applies percentage discount correctly with rounding', () => {
    const items: OrderItem[] = [
      { productName: 'Bánh Dẻo', quantity: 4, originalPrice: 65000 },
    ];
    // Subtotal: 260k, 10% = 26k, total = 234k
    const res = calculateOrderTotals(items, 'percent', 10, 0);
    assert.equal(res.subtotal, 260000);
    assert.equal(res.discountAmount, 26000);
    assert.equal(res.total, 234000);
    assert.equal(res.remaining, 234000);
  });

  test('applies price override (thỏa thuận) correctly', () => {
    const items: OrderItem[] = [
      { productName: 'Bánh Thập Cẩm Gà Quay', quantity: 2, originalPrice: 110000 },
    ];
    // Subtotal: 220k, Override to 180k
    const res = calculateOrderTotals(items, 'override', 180000, 180000);
    assert.equal(res.subtotal, 220000);
    assert.equal(res.discountAmount, 40000);
    assert.equal(res.total, 180000);
    assert.equal(res.remaining, 0);
  });

  test('handles zero or negative remaining safely (over-deposit)', () => {
    const items: OrderItem[] = [
      { productName: 'Bánh', quantity: 1, originalPrice: 50000 },
    ];
    const res = calculateOrderTotals(items, 'none', 0, 70000);
    assert.equal(res.total, 50000);
    assert.equal(res.remaining, 0);
  });
});

describe('Legacy v0.1.0 Data Normalization (normalizeOrder)', () => {
  test('converts legacy flat order schema to rich model without data loss', () => {
    const legacyRaw = {
      id: 'ORD-0001',
      customerName: 'Chị Mai hàng xóm',
      phone: '0912345678',
      productName: 'Bánh Thập Cẩm',
      quantity: 3,
      unitPrice: 85000,
      total: 255000,
      deposit: 100000,
      orderDate: '2026-09-30',
      deliveryDate: '2026-10-01',
      status: 'pending',
      note: 'Ít ngọt',
      customExtraField: 'preserved_value',
    };

    const order = normalizeOrder(legacyRaw);

    assert.equal(order.id, 'ORD-0001');
    assert.equal(order.customer.name, 'Chị Mai hàng xóm');
    assert.equal(order.customer.phone, '0912345678');
    assert.equal(order.customerName, 'Chị Mai hàng xóm');
    assert.equal(order.phone, '0912345678');
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].productName, 'Bánh Thập Cẩm');
    assert.equal(order.items[0].quantity, 3);
    assert.equal(order.items[0].originalPrice, 85000);
    assert.equal(order.subtotal, 255000);
    assert.equal(order.total, 255000);
    assert.equal(order.deposit, 100000);
    assert.equal(order.remaining, 155000);
    assert.equal(order.customExtraField, 'preserved_value');
  });

  test('populates flat backward-compatible fields from modern multi-item order', () => {
    const modernRaw = {
      id: 'ORD-0002',
      customer: {
        name: 'Anh Tuấn',
        phone: '0987654321',
        address: 'Tòa nhà A',
      },
      items: [
        { productName: 'Bánh Trà Xanh', quantity: 2, originalPrice: 80000 },
        { productName: 'Bánh Khoai Môn', quantity: 2, originalPrice: 75000 },
      ],
      total: 310000,
      deposit: 0,
      status: 'preparing',
    };

    const order = normalizeOrder(modernRaw);

    assert.equal(order.customerName, 'Anh Tuấn');
    assert.equal(order.phone, '0987654321');
    assert.equal(order.quantity, 4);
    assert.ok(order.productName.includes('Bánh Trà Xanh'));
    assert.ok(order.productName.includes('Bánh Khoai Môn'));
    assert.equal(order.remaining, 310000);
  });
});

describe('Security & HTML Escaping (escapeHtml)', () => {
  test('escapes malicious script tags and event handlers', () => {
    const malicious = '<script>alert("XSS")</script>';
    const escaped = escapeHtml(malicious);
    assert.equal(escaped, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    assert.ok(!escaped.includes('<script>'));
  });

  test('escapes quotes and ampersands in customer notes', () => {
    const text = 'Khách & Bạn thân "VIP" <3';
    const escaped = escapeHtml(text);
    assert.equal(escaped, 'Khách &amp; Bạn thân &quot;VIP&quot; &lt;3');
  });

  test('handles null and undefined gracefully', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
  });
});

describe('Form Validation (validateOrderForm)', () => {
  test('rejects empty customer name', () => {
    const res = validateOrderForm({
      customerName: '   ',
      items: [{ productName: 'Bánh', quantity: 1, originalPrice: 50000 }],
      discountType: 'none',
      discountValue: 0,
      deposit: 0,
      orderDate: '2026-10-01',
      deliveryDate: '2026-10-02',
      status: 'pending',
    });
    assert.equal(res.isValid, false);
    assert.ok(res.errors.customerName);
  });

  test('rejects empty items list', () => {
    const res = validateOrderForm({
      customerName: 'Chị Mai',
      items: [],
      discountType: 'none',
      discountValue: 0,
      deposit: 0,
      orderDate: '2026-10-01',
      deliveryDate: '2026-10-02',
      status: 'pending',
    });
    assert.equal(res.isValid, false);
    assert.ok(res.errors.items);
  });

  test('rejects delivery date prior to order date', () => {
    const res = validateOrderForm({
      customerName: 'Chị Mai',
      items: [{ productName: 'Bánh', quantity: 1, originalPrice: 50000 }],
      discountType: 'none',
      discountValue: 0,
      deposit: 0,
      orderDate: '2026-10-05',
      deliveryDate: '2026-10-01',
      status: 'pending',
    });
    assert.equal(res.isValid, false);
    assert.ok(res.errors.deliveryDate);
  });

  test('passes on valid complete order', () => {
    const res = validateOrderForm({
      customerName: 'Chị Mai',
      phone: '0901234567',
      items: [{ productName: 'Bánh Đậu Xanh', quantity: 2, originalPrice: 75000 }],
      discountType: 'none',
      discountValue: 0,
      deposit: 50000,
      orderDate: '2026-10-01',
      deliveryDate: '2026-10-02',
      status: 'pending',
    });
    assert.equal(res.isValid, true);
    assert.equal(Object.keys(res.errors).length, 0);
  });
});

describe('CSV Generation & Excel Compatibility', () => {
  test('generates CSV with UTF-8 BOM for Microsoft Excel Vietnamese support', () => {
    const order = normalizeOrder({
      id: 'ORD-0001',
      customerName: 'Nguyễn Văn Đạt',
      phone: '0912345678',
      productName: 'Bánh Thập Cẩm Gà Quay Vi Cá',
      quantity: 2,
      unitPrice: 110000,
      total: 220000,
      deposit: 100000,
      orderDate: '2026-09-30',
      deliveryDate: '2026-10-01',
      status: 'completed',
      note: 'Ít đường, giao buổi sáng',
    });

    const csv = backupService.generateOrdersCsvContent([order]);
    // Must start with UTF-8 BOM
    assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM \\uFEFF');
    assert.ok(csv.includes('ORD-0001'));
    assert.ok(csv.includes('Nguyễn Văn Đạt'));
    assert.ok(csv.includes('Bánh Thập Cẩm Gà Quay Vi Cá'));
  });
});
