import { AppConfig, DEFAULT_CONFIG } from '../models/Config';
import { Product } from '../models/Product';
import { Order, OrdersDocument, CURRENT_SCHEMA_VERSION } from '../models/Order';

export const CONFIG_FILE_NAME = 'config.json';
export const PRODUCTS_FILE_NAME = 'products.json';
export const ORDERS_FILE_NAME = 'orders.json';
export const CUSTOMERS_FILE_NAME = 'customers.json';

const LOCAL_STORAGE_CONFIG_KEY = 'munkek_app_config';
const LOCAL_STORAGE_PRODUCTS_KEY = 'munkek_products_data';
const LOCAL_STORAGE_ORDERS_KEY = 'munkek_orders_data';

export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

class StorageService {
  private config: AppConfig = { ...DEFAULT_CONFIG };
  private isInitialized = false;

  /**
   * Initialize storage and load config.json
   */
  public async init(): Promise<AppConfig> {
    if (this.isInitialized) return this.config;

    if (isTauriEnvironment()) {
      try {
        const { exists, readTextFile, writeTextFile } = await import('@tauri-apps/plugin-fs');

        // Look for config.json at root directory
        const hasRootConfig = await exists(CONFIG_FILE_NAME);
        if (hasRootConfig) {
          const raw = await readTextFile(CONFIG_FILE_NAME);
          const parsed = JSON.parse(raw);
          this.config = { ...DEFAULT_CONFIG, ...parsed, configPath: CONFIG_FILE_NAME };
        } else {
          // If not exists at root, create default config.json
          this.config = { ...DEFAULT_CONFIG, configPath: CONFIG_FILE_NAME };
          await writeTextFile(CONFIG_FILE_NAME, JSON.stringify(this.config, null, 2));
        }

        // Ensure data directory exists
        await this.ensureDataFolder();
      } catch (err) {
        console.warn('Tauri FS load config error, falling back to local defaults:', err);
      }
    } else {
      // Browser LocalStorage fallback
      const stored = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
      if (stored) {
        try {
          this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
        } catch {
          this.config = { ...DEFAULT_CONFIG };
        }
      } else {
        this.config = { ...DEFAULT_CONFIG };
        localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(this.config));
      }
    }

    this.isInitialized = true;
    return this.config;
  }

  /**
   * Ensure data folder and basic template files exist
   */
  public async ensureDataFolder(): Promise<void> {
    if (!isTauriEnvironment()) return;

    try {
      const { exists, mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs');
      const { join } = await import('@tauri-apps/api/path');

      const dataDir = this.config.dataPath || './data';
      if (!(await exists(dataDir))) {
        await mkdir(dataDir, { recursive: true });
      }

      // Check products.json
      const productsPath = await join(dataDir, PRODUCTS_FILE_NAME);
      if (!(await exists(productsPath))) {
        await writeTextFile(productsPath, JSON.stringify([], null, 2));
      }

      // Check orders.json
      const ordersPath = await join(dataDir, ORDERS_FILE_NAME);
      if (!(await exists(ordersPath))) {
        const defaultOrdersDoc: OrdersDocument = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          appName: 'MunKek - Tiệm Bánh Trung Thu',
          updatedAt: new Date().toISOString(),
          orders: [],
        };
        await writeTextFile(ordersPath, JSON.stringify(defaultOrdersDoc, null, 2));
      }

      // Check backups folder
      const backupsDir = await join(dataDir, 'backups');
      if (!(await exists(backupsDir))) {
        await mkdir(backupsDir, { recursive: true });
      }
    } catch (err) {
      console.warn('Lỗi khi kiểm tra thư mục data:', err);
    }
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public async saveConfig(newConfig: Partial<AppConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig, lastOpened: new Date().toISOString() };

    if (isTauriEnvironment()) {
      try {
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        const targetConfigPath = this.config.configPath || CONFIG_FILE_NAME;
        await writeTextFile(targetConfigPath, JSON.stringify(this.config, null, 2));
      } catch (err) {
        console.error('Không thể ghi file config.json:', err);
      }
    } else {
      localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(this.config));
    }
  }

  /**
   * Set new dataPath and update config
   */
  public async setDataPath(newPath: string): Promise<void> {
    await this.saveConfig({ dataPath: newPath });
    await this.ensureDataFolder();
  }

  public getDataFolderPath(): string {
    return this.config.dataPath || './data';
  }

  public getConfigFilePath(): string {
    return this.config.configPath || CONFIG_FILE_NAME;
  }

  public async getOrdersFilePath(): Promise<string> {
    const dataDir = this.getDataFolderPath();
    if (isTauriEnvironment()) {
      try {
        const { join } = await import('@tauri-apps/api/path');
        return await join(dataDir, ORDERS_FILE_NAME);
      } catch {
        return `${dataDir}/${ORDERS_FILE_NAME}`;
      }
    }
    return `${dataDir}/${ORDERS_FILE_NAME}`;
  }

  public async getProductsFilePath(): Promise<string> {
    const dataDir = this.getDataFolderPath();
    if (isTauriEnvironment()) {
      try {
        const { join } = await import('@tauri-apps/api/path');
        return await join(dataDir, PRODUCTS_FILE_NAME);
      } catch {
        return `${dataDir}/${PRODUCTS_FILE_NAME}`;
      }
    }
    return `${dataDir}/${PRODUCTS_FILE_NAME}`;
  }

  /**
   * Load Products from data/products.json
   */
  public async loadProducts(): Promise<Product[]> {
    await this.init();

    if (isTauriEnvironment()) {
      try {
        const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
        const { join } = await import('@tauri-apps/api/path');

        const filePath = await join(this.config.dataPath || './data', PRODUCTS_FILE_NAME);
        if (await exists(filePath)) {
          const raw = await readTextFile(filePath);
          if (raw && raw.trim()) {
            return JSON.parse(raw);
          }
        }
      } catch (err) {
        console.warn('Không thể đọc file products.json từ disk:', err);
      }
    }

    // Fallback: localStorage
    const stored = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // continue to fetch
      }
    }

    // If empty in browser preview, seed from ./data/products.json
    try {
      const res = await fetch('./data/products.json');
      if (res.ok) {
        const seed = await res.json();
        if (Array.isArray(seed) && seed.length > 0) {
          localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(seed));
          return seed;
        }
      }
    } catch {
      // ignore
    }
    return [];
  }

  /**
   * Save Products to data/products.json (Atomic write via tmp file)
   */
  public async saveProducts(products: Product[]): Promise<void> {
    const serialized = JSON.stringify(products, null, 2);

    if (isTauriEnvironment()) {
      try {
        const { writeTextFile, rename } = await import('@tauri-apps/plugin-fs');
        const { join } = await import('@tauri-apps/api/path');

        const dataDir = this.config.dataPath || './data';
        const finalPath = await join(dataDir, PRODUCTS_FILE_NAME);
        const tempPath = await join(dataDir, `.${PRODUCTS_FILE_NAME}.tmp`);

        await writeTextFile(tempPath, serialized);
        await rename(tempPath, finalPath);
        return;
      } catch (err) {
        console.error('Lỗi khi lưu products.json:', err);
      }
    }

    localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, serialized);
  }

  /**
   * Load Orders from data/orders.json
   */
  public async loadOrders(): Promise<Order[]> {
    await this.init();

    if (isTauriEnvironment()) {
      try {
        const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
        const { join } = await import('@tauri-apps/api/path');

        const filePath = await join(this.config.dataPath || './data', ORDERS_FILE_NAME);
        if (await exists(filePath)) {
          const raw = await readTextFile(filePath);
          if (raw && raw.trim()) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && Array.isArray(parsed.orders)) return parsed.orders;
          }
        }
      } catch (err) {
        console.warn('Không thể đọc file orders.json từ disk:', err);
      }
    }

    // Fallback: localStorage
    const stored = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.orders)) return parsed.orders;
      } catch {
        // continue to fetch
      }
    }

    // If empty in browser preview, seed from ./data/orders.json
    try {
      const res = await fetch('./data/orders.json');
      if (res.ok) {
        const seed = await res.json();
        if (seed && Array.isArray(seed.orders)) {
          localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(seed));
          return seed.orders;
        }
      }
    } catch {
      // ignore
    }
    return [];
  }

  /**
   * Save Orders to data/orders.json (Atomic write)
   */
  public async saveOrders(orders: Order[]): Promise<void> {
    const doc: OrdersDocument = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      appName: this.config.shopName || 'MunKek - Tiệm Bánh Trung Thu',
      updatedAt: new Date().toISOString(),
      orders,
    };
    const serialized = JSON.stringify(doc, null, 2);

    if (isTauriEnvironment()) {
      try {
        const { writeTextFile, rename } = await import('@tauri-apps/plugin-fs');
        const { join } = await import('@tauri-apps/api/path');

        const dataDir = this.config.dataPath || './data';
        const finalPath = await join(dataDir, ORDERS_FILE_NAME);
        const tempPath = await join(dataDir, `.${ORDERS_FILE_NAME}.tmp`);

        await writeTextFile(tempPath, serialized);
        await rename(tempPath, finalPath);
        return;
      } catch (err) {
        console.error('Lỗi khi lưu orders.json:', err);
      }
    }

    localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, serialized);
  }

  /**
   * Pick custom data folder via native folder dialog
   */
  public async pickDataFolder(): Promise<string | null> {
    if (isTauriEnvironment()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Chọn thư mục lưu trữ dữ liệu Bánh Trung Thu (data)',
        });
        if (selected && typeof selected === 'string') {
          await this.setDataPath(selected);
          return selected;
        }
      } catch (err) {
        console.error('Lỗi khi chọn thư mục data:', err);
      }
    }
    return null;
  }

  /**
   * Pick custom config file via native file dialog
   */
  public async pickConfigFile(): Promise<string | null> {
    if (isTauriEnvironment()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const { readTextFile } = await import('@tauri-apps/plugin-fs');

        const selected = await open({
          directory: false,
          multiple: false,
          title: 'Chọn file cấu hình (config.json)',
          filters: [{ name: 'MunKek Config', extensions: ['json'] }],
        });

        if (selected && typeof selected === 'string') {
          const raw = await readTextFile(selected);
          const parsed = JSON.parse(raw);
          this.config = { ...DEFAULT_CONFIG, ...parsed, configPath: selected };
          await this.ensureDataFolder();
          return selected;
        }
      } catch (err) {
        console.error('Lỗi khi nạp file config:', err);
      }
    }
    return null;
  }
}

export const storageService = new StorageService();
