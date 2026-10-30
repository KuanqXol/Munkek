import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for test environment
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

describe('Customer Management (customerService)', () => {
  test('creates new customer with generated ID and persists', async () => {
    const { customerService } = await import('../src/services/customerService.ts');
    await customerService.init();

    const newCust = await customerService.addCustomer({
      name: 'Chị Mai Lan',
      phone: '0988776655',
      address: 'Số 15 phố Huế, Hà Nội',
      note: 'Thích bánh dẻo chay ít ngọt',
    });

    assert.ok(newCust.id.startsWith('KH-'));
    assert.equal(newCust.name, 'Chị Mai Lan');
    assert.equal(newCust.phone, '0988776655');
    assert.equal(newCust.address, 'Số 15 phố Huế, Hà Nội');
    assert.equal(newCust.note, 'Thích bánh dẻo chay ít ngọt');

    const found = await customerService.getCustomerById(newCust.id);
    assert.ok(found);
    assert.equal(found?.name, 'Chị Mai Lan');
  });

  test('searches customers by unaccented Vietnamese name and phone digits', async () => {
    const { customerService } = await import('../src/services/customerService.ts');

    // "chi mai lan" should match "Chị Mai Lan"
    const resultsName = customerService.searchCustomers('chi mai lan');
    assert.ok(resultsName.length > 0);
    assert.equal(resultsName[0].name, 'Chị Mai Lan');

    // Phone partial match "7766"
    const resultsPhone = customerService.searchCustomers('7766');
    assert.ok(resultsPhone.length > 0);
    assert.equal(resultsPhone[0].phone, '0988776655');
  });

  test('updates customer information accurately', async () => {
    const { customerService } = await import('../src/services/customerService.ts');

    const cust = await customerService.addCustomer({
      name: 'Bác Hoàng',
      phone: '0912344321',
    });

    const updated = await customerService.updateCustomer(cust.id, {
      name: 'Bác Hoàng (Công đoàn)',
      address: 'Phường Ba Đình',
    });

    assert.equal(updated.name, 'Bác Hoàng (Công đoàn)');
    assert.equal(updated.address, 'Phường Ba Đình');
    assert.equal(updated.phone, '0912344321');
  });

  test('deletes customer cleanly', async () => {
    const { customerService } = await import('../src/services/customerService.ts');

    const cust = await customerService.addCustomer({
      name: 'Khách Tạm Thời Cần Xóa',
      phone: '0900000000',
    });

    const deleted = await customerService.deleteCustomer(cust.id);
    assert.equal(deleted, true);

    const found = await customerService.getCustomerById(cust.id);
    assert.equal(found, undefined);
  });
});

