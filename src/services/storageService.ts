import { type AppConfig, DEFAULT_CONFIG } from '../models/Config.ts';
import type { Product } from '../models/Product.ts';
import { type Order, type OrdersDocument, CURRENT_SCHEMA_VERSION, normalizeOrder } from '../models/Order.ts';

export const CONFIG_FILE_NAME = 'config.json';
export const APP_CONFIG_FILE_NAME = 'munkek-config.json';
export const PRODUCTS_FILE_NAME = 'products.json';
export const ORDERS_FILE_NAME = 'orders.json';
export const CUSTOMERS_FILE_NAME = 'customers.json';

const LOCAL_STORAGE_CONFIG_KEY = 'munkek_app_config';
const LOCAL_STORAGE_PRODUCTS_KEY = 'munkek_products_data';
const LOCAL_STORAGE_ORDERS_KEY = 'munkek_orders_data';

const DEFAULT_SEED_PRODUCTS: Product[] = [
  {
    id: 'BTT-01',
    name: 'Thập cẩm gà quay vi cá',
    type: 'baked',
    eggCount: 2,
    weight: 200,
    unitPrice: 110000,
    costPrice: 65000,
    isAvailable: true,
    description: 'Nhân thập cẩm truyền thống kết hợp gà quay, vi cá và 2 lòng đỏ trứng muối bùi béo.',
  },
  {
    id: 'BTT-02',
    name: 'Thập cẩm lạp xưởng ngũ hạt',
    type: 'baked',
    eggCount: 1,
    weight: 180,
    unitPrice: 90000,
    costPrice: 52000,
    isAvailable: true,
    description: 'Lạp xưởng Mai Quế Lộ, hạt điều, hạt sen, hạt dưa, vừng rang thơm lừng.',
  },
  {
    id: 'BTT-03',
    name: 'Đậu xanh hạt sen',
    type: 'baked',
    eggCount: 1,
    weight: 180,
    unitPrice: 75000,
    costPrice: 40000,
    isAvailable: true,
    description: 'Đậu xanh sên mịn màng, ngọt thanh, kèm hạt sen nguyên hạt và 1 trứng muối.',
  },
  {
    id: 'BTT-04',
    name: 'Khoai môn sữa dừa',
    type: 'baked',
    eggCount: 1,
    weight: 180,
    unitPrice: 75000,
    costPrice: 42000,
    isAvailable: true,
    description: 'Khoai môn dẻo bùi thoang thoảng hương nước cốt dừa tự nhiên.',
  },
  {
    id: 'BTT-05',
    name: 'Trà xanh matcha đậu đỏ',
    type: 'baked',
    eggCount: 1,
    weight: 180,
    unitPrice: 80000,
    costPrice: 45000,
    isAvailable: true,
    description: 'Bột trà xanh Nhật Bản thơm dịu bọc nhân đậu đỏ bùi ngọt.',
  },
  {
    id: 'BTT-06',
    name: 'Dẻo hạt sen lá dứa',
    type: 'snowskin',
    eggCount: 1,
    weight: 200,
    unitPrice: 70000,
    costPrice: 38000,
    isAvailable: true,
    description: 'Vỏ dẻo mềm dẻo từ nếp cái hoa vàng, thoảng hương lá dứa thanh khiết.',
  },
  {
    id: 'BTT-07',
    name: 'Dẻo đậu xanh (Chay)',
    type: 'snowskin',
    eggCount: 0,
    weight: 180,
    unitPrice: 60000,
    costPrice: 32000,
    isAvailable: true,
    description: 'Bánh dẻo chay thanh đạm, nhân đậu xanh nguyên chất không trứng.',
  },
  {
    id: 'BOX-01',
    name: 'Hộp quà 4 bánh Cao Cấp MunKek',
    type: 'box',
    eggCount: 0,
    weight: 0,
    unitPrice: 60000,
    costPrice: 35000,
    isAvailable: true,
    description: 'Hộp cứng sang trọng in họa tiết trăng rằm, kèm dao cắt và túi xách lịch sự biếu tặng.',
  },
];

export type StorageStatus = 'READY' | 'NEEDS_SETUP' | 'UNAVAILABLE' | 'ERROR';

export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

class StorageService {
  private config: AppConfig = { ...DEFAULT_CONFIG };
  private status: StorageStatus = 'NEEDS_SETUP';
  private errorMessage = '';
  private isSaving = false;
  private pendingSave: Promise<void> | null = null;

  public getStatus(): StorageStatus {
    return this.status;
  }

  public getErrorMessage(): string {
    return this.errorMessage;
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public getDataFolderPath(): string {
    return this.config.dataPath || './data';
  }

  public getConfigFilePath(): string {
    return this.config.configPath || CONFIG_FILE_NAME;
  }

  /**
   * Initialize storage and determine whether app is ready, needs first-time setup, or is unavailable.
   */
  public async init(): Promise<{ status: StorageStatus; message?: string }> {
    if (!isTauriEnvironment()) {
      // Browser preview mode (Dev only)
      const stored = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
      if (stored) {
        try {
          this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored), isConfigured: true };
        } catch {
          this.config = { ...DEFAULT_CONFIG, isConfigured: true };
        }
      } else {
        this.config = { ...DEFAULT_CONFIG, isConfigured: true };
        localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(this.config));
      }
      this.status = 'READY';
      return { status: 'READY' };
    }

    try {
      const { exists, readTextFile, mkdir } = await import('@tauri-apps/plugin-fs');
      const { appConfigDir, join, resolve } = await import('@tauri-apps/api/path');

      let savedConfig: Partial<AppConfig> | null = null;
      let effectiveConfigPath = '';

      // 1. Check user appConfig directory (persisted across app updates)
      let userConfigPath = '';
      try {
        const configDir = await appConfigDir();
        if (!(await exists(configDir))) {
          await mkdir(configDir, { recursive: true });
        }
        userConfigPath = await join(configDir, APP_CONFIG_FILE_NAME);
        if (await exists(userConfigPath)) {
          const raw = await readTextFile(userConfigPath);
          savedConfig = JSON.parse(raw);
          effectiveConfigPath = userConfigPath;
        }
      } catch (cfgErr) {
        console.warn('Could not read user appConfigDir:', cfgErr);
      }

      // 2. Fallback: check working directory config.json (backward compatibility with v0.1.0)
      if (!savedConfig) {
        try {
          if (await exists(CONFIG_FILE_NAME)) {
            const raw = await readTextFile(CONFIG_FILE_NAME);
            savedConfig = JSON.parse(raw);
            effectiveConfigPath = CONFIG_FILE_NAME;
          }
        } catch (rootCfgErr) {
          console.warn('Could not read root config.json:', rootCfgErr);
        }
      }

      // 3. Fallback: check localStorage pointer in Tauri WebView
      if (!savedConfig) {
        try {
          const ls = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
          if (ls) {
            savedConfig = JSON.parse(ls);
          }
        } catch {}
      }

      // If configuration exists and has a dataPath
      if (savedConfig && savedConfig.dataPath && savedConfig.isConfigured !== false) {
        this.config = {
          ...DEFAULT_CONFIG,
          ...savedConfig,
          configPath: effectiveConfigPath || userConfigPath || CONFIG_FILE_NAME,
          isConfigured: true,
        };

        // Check if configured dataPath actually exists on disk
        const targetDataDir = this.config.dataPath;
        const dataDirExists = await exists(targetDataDir);

        if (!dataDirExists) {
          // Folder is missing (e.g. unplugged USB, moved folder)
          this.status = 'UNAVAILABLE';
          this.errorMessage = `Không tìm thấy thư mục dữ liệu tại: "${targetDataDir}". Thư mục có thể đã bị di chuyển, xóa hoặc ổ đĩa ngoài chưa được cắm.`;
          return { status: 'UNAVAILABLE', message: this.errorMessage };
        }

        // Folder exists! Ensure standard data files exist
        await this.ensureDataFolder();
        this.status = 'READY';
        return { status: 'READY' };
      }

      // 4. First-time launch: check if existing legacy data folder exists in root or appData
      const hasRootData = await exists('./data');
      if (hasRootData && (await exists('./data/orders.json'))) {
        // Found legacy data in root! Automatically adapt and mark ready
        const resolvedRootData = await resolve('./data');
        this.config = {
          ...DEFAULT_CONFIG,
          dataPath: resolvedRootData,
          configPath: effectiveConfigPath || userConfigPath,
          isConfigured: true,
        };
        await this.saveConfig(this.config);
        this.status = 'READY';
        return { status: 'READY' };
      }

      // No configured folder found: Prompt user with First Launch Setup screen
      this.status = 'NEEDS_SETUP';
      return { status: 'NEEDS_SETUP' };
    } catch (err) {
      console.error('Fatal storage init error:', err);
      this.status = 'ERROR';
      this.errorMessage = err instanceof Error ? err.message : String(err);
      return { status: 'ERROR', message: this.errorMessage };
    }
  }

  /**
   * Complete first-launch setup by selecting or creating a data directory
   */
  public async setupDataFolder(folderPath: string): Promise<void> {
    if (!isTauriEnvironment()) {
      this.config = { ...this.config, dataPath: folderPath, isConfigured: true };
      localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(this.config));
      this.status = 'READY';
      return;
    }

    const { exists, mkdir, writeTextFile, remove } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');

    // Ensure folder exists
    if (!(await exists(folderPath))) {
      await mkdir(folderPath, { recursive: true });
    }

    // Verify write permissions with probe file
    const probePath = await join(folderPath, '.probe_write_test');
    try {
      await writeTextFile(probePath, 'ok');
      await remove(probePath);
    } catch (err) {
      throw new Error(`Thư mục "${folderPath}" không có quyền ghi dữ liệu. Vui lòng chọn thư mục khác.`);
    }

    this.config.dataPath = folderPath;
    this.config.isConfigured = true;
    this.config.lastOpened = new Date().toISOString();

    await this.saveConfig(this.config);
    await this.ensureDataFolder();
    this.status = 'READY';
  }

  /**
   * Save configuration to persistent location
   */
  public async saveConfig(newConfig: Partial<AppConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig, lastOpened: new Date().toISOString() };

    if (!isTauriEnvironment()) {
      localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(this.config));
      return;
    }

    try {
      const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
      const { appConfigDir, join } = await import('@tauri-apps/api/path');

      const serialized = JSON.stringify(this.config, null, 2);

      // Save in user appConfigDir
      try {
        const configDir = await appConfigDir();
        if (!(await exists(configDir))) {
          await mkdir(configDir, { recursive: true });
        }
        const userConfigPath = await join(configDir, APP_CONFIG_FILE_NAME);
        await writeTextFile(userConfigPath, serialized);
      } catch (e) {
        console.warn('Could not write to user appConfigDir:', e);
      }

      // Also save in root config.json if accessible
      try {
        await writeTextFile(CONFIG_FILE_NAME, serialized);
      } catch {}

      // Keep localStorage updated as in-memory mirror
      localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, serialized);
    } catch (err) {
      console.error('Error saving app configuration:', err);
      throw new Error(`Không thể lưu file cấu hình: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Ensure data folder contains valid orders.json and products.json
   */
  public async ensureDataFolder(): Promise<void> {
    if (!isTauriEnvironment()) return;

    const { exists, mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');

    const dataDir = this.getDataFolderPath();
    if (!(await exists(dataDir))) {
      await mkdir(dataDir, { recursive: true });
    }

    // Check products.json
    const productsPath = await join(dataDir, PRODUCTS_FILE_NAME);
    if (!(await exists(productsPath))) {
      // Initialize with default empty array
      await writeTextFile(productsPath, JSON.stringify([], null, 2));
    }

    // Check orders.json
    const ordersPath = await join(dataDir, ORDERS_FILE_NAME);
    if (!(await exists(ordersPath))) {
      const defaultDoc: OrdersDocument = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        appName: this.config.shopName || 'MunKek - Tiệm Bánh Trung Thu',
        updatedAt: new Date().toISOString(),
        orders: [],
      };
      await writeTextFile(ordersPath, JSON.stringify(defaultDoc, null, 2));
    }

    // Check backups folder
    const backupsDir = await join(dataDir, 'backups');
    if (!(await exists(backupsDir))) {
      await mkdir(backupsDir, { recursive: true });
    }
  }

  /**
   * Load Products from data/products.json
   */
  public async loadProducts(): Promise<Product[]> {
    if (isTauriEnvironment()) {
      const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
      const { join } = await import('@tauri-apps/api/path');

      const filePath = await join(this.getDataFolderPath(), PRODUCTS_FILE_NAME);
      if (await exists(filePath)) {
        const raw = await readTextFile(filePath);
        if (raw && raw.trim()) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
          } catch (err) {
            console.error('Corrupted products.json, preserving file:', err);
            throw new Error(`File ${PRODUCTS_FILE_NAME} bị lỗi cấu trúc dữ liệu. Hệ thống không ghi đè để bảo vệ dữ liệu.`);
          }
        }
      }
      return [];
    }

    // Browser preview fallback
    const stored = localStorage.getItem(LOCAL_STORAGE_PRODUCTS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }

    try {
      const res = await fetch('./data/products.json').catch(() => fetch('/data/products.json'));
      if (res && res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith('[')) {
          const seed = JSON.parse(text);
          if (Array.isArray(seed) && seed.length > 0) {
            localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(seed));
            return seed;
          }
        }
      }
    } catch {}

    // Fallback seed products for browser preview
    localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, JSON.stringify(DEFAULT_SEED_PRODUCTS));
    return DEFAULT_SEED_PRODUCTS;
  }

  /**
   * Save Products with atomic write and error reporting
   */
  public async saveProducts(products: Product[]): Promise<void> {
    const serialized = JSON.stringify(products, null, 2);

    if (isTauriEnvironment()) {
      const { writeTextFile, rename, remove } = await import('@tauri-apps/plugin-fs');
      const { join } = await import('@tauri-apps/api/path');

      const dataDir = this.getDataFolderPath();
      const finalPath = await join(dataDir, PRODUCTS_FILE_NAME);
      const tempPath = await join(dataDir, `.${PRODUCTS_FILE_NAME}.tmp`);

      try {
        await writeTextFile(tempPath, serialized);
        try {
          await rename(tempPath, finalPath);
        } catch {
          await writeTextFile(finalPath, serialized);
          try { await remove(tempPath); } catch {}
        }
        return;
      } catch (err) {
        console.error('Failed to save products.json to disk:', err);
        throw new Error(`Không thể lưu danh mục sản phẩm vào đĩa: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    localStorage.setItem(LOCAL_STORAGE_PRODUCTS_KEY, serialized);
  }

  /**
   * Load Orders with data protection (never wipe corrupted file, normalize legacy records)
   */
  public async loadOrders(): Promise<Order[]> {
    if (isTauriEnvironment()) {
      const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
      const { join } = await import('@tauri-apps/api/path');

      const filePath = await join(this.getDataFolderPath(), ORDERS_FILE_NAME);
      if (!(await exists(filePath))) {
        return [];
      }

      const raw = await readTextFile(filePath);
      if (!raw || !raw.trim()) {
        return [];
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        console.error('CRITICAL: orders.json is corrupted JSON:', parseErr);
        throw new Error(`File dữ liệu "${ORDERS_FILE_NAME}" bị hỏng hoặc lỗi định dạng. MunKek không ghi đè để bảo vệ dữ liệu gốc.`);
      }

      let rawOrders: unknown[] = [];
      if (Array.isArray(parsed)) {
        rawOrders = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).orders)) {
        rawOrders = (parsed as Record<string, unknown>).orders as unknown[];
      }

      return rawOrders.map((o, idx) => normalizeOrder(o as Record<string, unknown>, idx));
    }

    // Browser preview mode
    const stored = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const list = Array.isArray(parsed) ? parsed : parsed.orders || [];
        if (list.length > 0) {
          return list.map((o: Record<string, unknown>, idx: number) => normalizeOrder(o, idx));
        }
      } catch {}
    }

    try {
      const res = await fetch('./data/orders.json').catch(() => fetch('/data/orders.json'));
      if (res && res.ok) {
        const text = await res.text();
        if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
          const seed = JSON.parse(text);
          const list = Array.isArray(seed) ? seed : seed.orders || [];
          if (list.length > 0) {
            localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(seed));
            return list.map((o: Record<string, unknown>, idx: number) => normalizeOrder(o, idx));
          }
        }
      }
    } catch {}
    return [];
  }

  /**
   * Save Orders with atomic write, concurrency lock, and NO silent fallback
   */
  public async saveOrders(orders: Order[]): Promise<void> {
    if (this.isSaving && this.pendingSave) {
      await this.pendingSave;
    }

    this.isSaving = true;

    this.pendingSave = (async () => {
      try {
        const doc: OrdersDocument = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          appName: this.config.shopName || 'MunKek - Tiệm Bánh Trung Thu',
          updatedAt: new Date().toISOString(),
          orders,
        };
        const serialized = JSON.stringify(doc, null, 2);

        if (isTauriEnvironment()) {
          const { writeTextFile, rename, remove } = await import('@tauri-apps/plugin-fs');
          const { join } = await import('@tauri-apps/api/path');

          const dataDir = this.getDataFolderPath();
          const finalPath = await join(dataDir, ORDERS_FILE_NAME);
          const tempPath = await join(dataDir, `.${ORDERS_FILE_NAME}.tmp`);

          try {
            await writeTextFile(tempPath, serialized);
            try {
              await rename(tempPath, finalPath);
            } catch {
              await writeTextFile(finalPath, serialized);
              try { await remove(tempPath); } catch {}
            }
          } catch (writeErr) {
            console.error('CRITICAL: Failed to write orders.json to disk:', writeErr);
            throw new Error(`Không thể ghi dữ liệu đơn hàng vào đĩa: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`);
          }
          return;
        }

        // Browser preview mode only
        localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, serialized);
      } finally {
        this.isSaving = false;
        this.pendingSave = null;
      }
    })();

    await this.pendingSave;
  }

  /**
   * Open native folder picker to select custom external data folder
   */
  public async pickDataFolder(): Promise<string | null> {
    if (!isTauriEnvironment()) {
      return null;
    }

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Chọn thư mục lưu trữ dữ liệu MunKek (data)',
      });

      if (selected && typeof selected === 'string') {
        await this.setupDataFolder(selected);
        return selected;
      }
    } catch (err) {
      console.error('Error in pickDataFolder:', err);
      throw err;
    }
    return null;
  }

  /**
   * Migrate existing data from old location to new location safely
   */
  public async migrateData(sourceDir: string, targetDir: string): Promise<{ success: boolean; count: number }> {
    if (!isTauriEnvironment()) {
      return { success: false, count: 0 };
    }

    const { exists, readTextFile, writeTextFile, copyFile } = await import('@tauri-apps/plugin-fs');
    const { join } = await import('@tauri-apps/api/path');

    const sourceOrdersPath = await join(sourceDir, ORDERS_FILE_NAME);
    if (!(await exists(sourceOrdersPath))) {
      return { success: false, count: 0 };
    }

    // Read and verify source orders
    const raw = await readTextFile(sourceOrdersPath);
    const parsed = JSON.parse(raw);
    const ordersList = Array.isArray(parsed) ? parsed : parsed.orders || [];

    // Copy orders.json and products.json to target
    const targetOrdersPath = await join(targetDir, ORDERS_FILE_NAME);
    await writeTextFile(targetOrdersPath, raw);

    const sourceProductsPath = await join(sourceDir, PRODUCTS_FILE_NAME);
    if (await exists(sourceProductsPath)) {
      const targetProductsPath = await join(targetDir, PRODUCTS_FILE_NAME);
      await copyFile(sourceProductsPath, targetProductsPath);
    }

    // Point config to new target directory
    await this.setupDataFolder(targetDir);

    return { success: true, count: ordersList.length };
  }
}

export const storageService = new StorageService();
