import { type Customer, DEFAULT_SEED_CUSTOMERS } from '../models/Customer.ts';
import { isTauriEnvironment, storageService } from './storageService.ts';
import { removeVietnameseTones } from '../utils/formatters.ts';

export const CUSTOMERS_FILE_NAME = 'customers.json';
const LOCAL_STORAGE_CUSTOMERS_KEY = 'munkek_customers_data';

export { DEFAULT_SEED_CUSTOMERS };

class CustomerService {
  private customers: Customer[] = [];
  private isInitialized = false;

  public async init(): Promise<Customer[]> {
    if (this.isInitialized) return this.customers;

    if (isTauriEnvironment()) {
      try {
        const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
        const { join } = await import('@tauri-apps/api/path');

        const filePath = await join(storageService.getDataFolderPath(), CUSTOMERS_FILE_NAME);
        if (await exists(filePath)) {
          const raw = await readTextFile(filePath);
          if (raw && raw.trim()) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              this.customers = parsed;
              this.isInitialized = true;
              return this.customers;
            }
          }
        }
      } catch (err) {
        console.warn('Could not read customers.json:', err);
      }
    }

    // Browser / fallback
    const stored = localStorage.getItem(LOCAL_STORAGE_CUSTOMERS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.customers = parsed;
          this.isInitialized = true;
          return this.customers;
        }
      } catch {}
    }

    // Seed from ./data/customers.json if available
    try {
      const res = await fetch('./data/customers.json').catch(() => fetch('/data/customers.json'));
      if (res && res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith('[')) {
          const seed = JSON.parse(text);
          if (Array.isArray(seed) && seed.length > 0) {
            this.customers = seed;
            localStorage.setItem(LOCAL_STORAGE_CUSTOMERS_KEY, JSON.stringify(seed));
            this.isInitialized = true;
            return this.customers;
          }
        }
      }
    } catch {}

    // Fallback seed customers for browser preview
    this.customers = [...DEFAULT_SEED_CUSTOMERS];
    localStorage.setItem(LOCAL_STORAGE_CUSTOMERS_KEY, JSON.stringify(this.customers));
    this.isInitialized = true;
    return this.customers;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  public async getAllCustomers(): Promise<Customer[]> {
    await this.ensureLoaded();
    return [...this.customers];
  }

  public async getCustomerById(id: string): Promise<Customer | undefined> {
    await this.ensureLoaded();
    return this.customers.find((c) => c.id === id);
  }

  public generateNextId(): string {
    let max = 0;
    const regex = /^KH-(\d+)$/i;
    for (const c of this.customers) {
      const match = c.id.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return `KH-${String(max + 1).padStart(4, '0')}`;
  }

  /**
   * Search customers by partial name (unaccented Vietnamese) or phone number
   */
  public searchCustomers(query: string, limit = 8): Customer[] {
    if (!query || !query.trim()) return [];
    const qClean = removeVietnameseTones(query.trim());
    const digitsOnly = query.replace(/\D/g, '');

    return this.customers
      .filter((c) => {
        const nameClean = removeVietnameseTones(c.name);
        const matchesName = nameClean.includes(qClean);
        const matchesPhone = digitsOnly.length >= 3 && c.phone && c.phone.replace(/\D/g, '').includes(digitsOnly);
        return matchesName || matchesPhone;
      })
      .slice(0, limit);
  }

  /**
   * Find or create customer by name and optional phone
   */
  public async findOrCreateCustomer(
    name: string,
    phone?: string,
    address?: string
  ): Promise<Customer> {
    await this.ensureLoaded();

    const cleanName = name.trim();
    const cleanPhone = phone ? phone.trim() : '';

    // Check if customer already exists by phone (if phone provided) or exact name
    let found = this.customers.find((c) => {
      if (cleanPhone && c.phone && c.phone.replace(/\D/g, '') === cleanPhone.replace(/\D/g, '')) {
        return true;
      }
      return !cleanPhone && c.name.toLowerCase() === cleanName.toLowerCase();
    });

    if (found) {
      // Update phone or address if provided and not previously recorded
      let updated = false;
      if (cleanPhone && !found.phone) {
        found.phone = cleanPhone;
        updated = true;
      }
      if (address && !found.address) {
        found.address = address.trim();
        updated = true;
      }
      if (updated) {
        found.updatedAt = new Date().toISOString();
        await this.saveCustomers();
      }
      return found;
    }

    // Create new customer
    const now = new Date().toISOString();
    const newCustomer: Customer = {
      id: this.generateNextId(),
      name: cleanName,
      phone: cleanPhone || undefined,
      address: address ? address.trim() : undefined,
      createdAt: now,
      updatedAt: now,
    };

    this.customers.push(newCustomer);
    await this.saveCustomers();
    return newCustomer;
  }

  public async addCustomer(input: {
    name: string;
    phone?: string;
    address?: string;
    note?: string;
  }): Promise<Customer> {
    await this.ensureLoaded();

    const cleanName = input.name.trim();
    if (!cleanName) {
      throw new Error('Họ tên khách hàng không được để trống.');
    }

    const now = new Date().toISOString();
    const newCustomer: Customer = {
      id: this.generateNextId(),
      name: cleanName,
      phone: input.phone?.trim() || undefined,
      address: input.address?.trim() || undefined,
      note: input.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    this.customers.unshift(newCustomer);
    await this.saveCustomers();
    return newCustomer;
  }

  public async updateCustomer(id: string, input: Partial<Customer>): Promise<Customer> {
    await this.ensureLoaded();

    const index = this.customers.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error(`Không tìm thấy khách hàng với mã ${id}`);
    }

    const existing = this.customers[index];
    const cleanName = input.name !== undefined ? input.name.trim() : existing.name;
    if (!cleanName) {
      throw new Error('Họ tên khách hàng không được để trống.');
    }

    const updated: Customer = {
      ...existing,
      name: cleanName,
      phone: input.phone !== undefined ? (input.phone.trim() || undefined) : existing.phone,
      address: input.address !== undefined ? (input.address.trim() || undefined) : existing.address,
      note: input.note !== undefined ? (input.note.trim() || undefined) : existing.note,
      updatedAt: new Date().toISOString(),
    };

    this.customers[index] = updated;
    await this.saveCustomers();
    return updated;
  }

  public async deleteCustomer(id: string): Promise<boolean> {
    await this.ensureLoaded();

    const index = this.customers.findIndex((c) => c.id === id);
    if (index === -1) return false;

    this.customers.splice(index, 1);
    await this.saveCustomers();
    return true;
  }

  public async saveCustomers(): Promise<void> {
    const serialized = JSON.stringify(this.customers, null, 2);

    if (isTauriEnvironment()) {
      try {
        const { writeTextFile, rename, remove } = await import('@tauri-apps/plugin-fs');
        const { join } = await import('@tauri-apps/api/path');

        const dataDir = storageService.getDataFolderPath();
        const finalPath = await join(dataDir, CUSTOMERS_FILE_NAME);
        const tempPath = await join(dataDir, `.${CUSTOMERS_FILE_NAME}.tmp`);

        await writeTextFile(tempPath, serialized);
        try {
          await rename(tempPath, finalPath);
        } catch {
          await writeTextFile(finalPath, serialized);
          try { await remove(tempPath); } catch {}
        }
        return;
      } catch (err) {
        console.error('Failed to save customers.json:', err);
      }
    }

    localStorage.setItem(LOCAL_STORAGE_CUSTOMERS_KEY, serialized);
  }
}

export const customerService = new CustomerService();

