import { OrdersDocument, Order, CURRENT_SCHEMA_VERSION } from '../models/Order';

export const APP_DATA_FOLDER_NAME = 'MunKek';
export const ORDERS_FILE_NAME = 'orders.json';
export const ORDERS_TEMP_FILE_NAME = '.orders.json.tmp';
export const STORAGE_LOCAL_KEY = 'munkek_orders_data';

export interface StorageStatus {
  isTauri: boolean;
  filePath: string;
  loadedFrom: 'tauri-fs' | 'browser-localstorage';
}

/**
 * Check if running inside Tauri environment
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Create default empty orders document
 */
export function createDefaultDocument(): OrdersDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appName: 'MunKek',
    updatedAt: new Date().toISOString(),
    orders: [],
  };
}

/**
 * Migrate document if older schemaVersion is detected
 */
export function migrateDocument(doc: unknown): OrdersDocument {
  if (!doc || typeof doc !== 'object') {
    return createDefaultDocument();
  }

  const raw = doc as Record<string, unknown>;

  // If old structure was a bare array of orders
  if (Array.isArray(raw)) {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      appName: 'MunKek',
      updatedAt: new Date().toISOString(),
      orders: raw as Order[],
    };
  }

  // Ensure orders array exists
  const orders: Order[] = Array.isArray(raw.orders) ? (raw.orders as Order[]) : [];

  // Migration logic for future versions (e.g. from version 1 to 2)
  const schemaVersion = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;

  return {
    schemaVersion,
    appName: (raw.appName as string) || 'MunKek',
    updatedAt: (raw.updatedAt as string) || new Date().toISOString(),
    orders,
  };
}

class StorageService {
  private cachedDoc: OrdersDocument | null = null;
  private currentFilePath: string = '';

  /**
   * Resolve orders.json absolute path in user's OS AppData directory
   */
  public async getOrdersFilePath(): Promise<string> {
    if (this.currentFilePath) return this.currentFilePath;

    if (isTauriEnvironment()) {
      try {
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const baseDir = await appDataDir();
        this.currentFilePath = await join(baseDir, ORDERS_FILE_NAME);
        return this.currentFilePath;
      } catch (err) {
        console.warn('Could not resolve Tauri appDataDir, falling back', err);
      }
    }

    this.currentFilePath = `AppData/Roaming/${APP_DATA_FOLDER_NAME}/${ORDERS_FILE_NAME} (Web Mode)`;
    return this.currentFilePath;
  }

  /**
   * Load orders document from disk (or localStorage fallback in browser)
   */
  public async loadDocument(): Promise<{ document: OrdersDocument; status: StorageStatus }> {
    if (isTauriEnvironment()) {
      try {
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const { exists, readTextFile, writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs');

        const baseDir = await appDataDir();
        this.currentFilePath = await join(baseDir, ORDERS_FILE_NAME);

        // Ensure AppData directory exists
        const dirExists = await exists(baseDir);
        if (!dirExists) {
          await mkdir(baseDir, { recursive: true });
        }

        const fileExists = await exists(this.currentFilePath);
        if (!fileExists) {
          // File does not exist yet: create fresh default document
          const defaultDoc = createDefaultDocument();
          await writeTextFile(this.currentFilePath, JSON.stringify(defaultDoc, null, 2));
          this.cachedDoc = defaultDoc;
          return {
            document: defaultDoc,
            status: {
              isTauri: true,
              filePath: this.currentFilePath,
              loadedFrom: 'tauri-fs',
            },
          };
        }

        // File exists: read content
        const rawContent = await readTextFile(this.currentFilePath);

        // Handle empty file
        if (!rawContent || !rawContent.trim()) {
          console.warn('orders.json is empty. Initializing default structure.');
          const defaultDoc = createDefaultDocument();
          await writeTextFile(this.currentFilePath, JSON.stringify(defaultDoc, null, 2));
          this.cachedDoc = defaultDoc;
          return {
            document: defaultDoc,
            status: {
              isTauri: true,
              filePath: this.currentFilePath,
              loadedFrom: 'tauri-fs',
            },
          };
        }

        // Parse JSON safely
        try {
          const parsed = JSON.parse(rawContent);
          const migrated = migrateDocument(parsed);
          this.cachedDoc = migrated;
          return {
            document: migrated,
            status: {
              isTauri: true,
              filePath: this.currentFilePath,
              loadedFrom: 'tauri-fs',
            },
          };
        } catch (parseError) {
          // JSON parse failed: create safety backup of corrupt file before recovering
          console.error('orders.json is corrupt, preserving backup...', parseError);
          const backupPath = await join(
            baseDir,
            `orders.corrupt-${Date.now()}.json`
          );
          try {
            await writeTextFile(backupPath, rawContent);
          } catch (bkErr) {
            console.error('Failed to create corrupt backup file', bkErr);
          }

          const defaultDoc = createDefaultDocument();
          this.cachedDoc = defaultDoc;
          return {
            document: defaultDoc,
            status: {
              isTauri: true,
              filePath: this.currentFilePath,
              loadedFrom: 'tauri-fs',
            },
          };
        }
      } catch (tauriError) {
        console.error('Tauri filesystem error, falling back to local storage', tauriError);
      }
    }

    // Fallback: Browser LocalStorage (for web dev or testing)
    const stored = localStorage.getItem(STORAGE_LOCAL_KEY);
    if (!stored) {
      const defaultDoc = createDefaultDocument();
      localStorage.setItem(STORAGE_LOCAL_KEY, JSON.stringify(defaultDoc));
      this.cachedDoc = defaultDoc;
      return {
        document: defaultDoc,
        status: {
          isTauri: false,
          filePath: 'LocalStorage: ' + STORAGE_LOCAL_KEY,
          loadedFrom: 'browser-localstorage',
        },
      };
    }

    try {
      const parsed = JSON.parse(stored);
      const migrated = migrateDocument(parsed);
      this.cachedDoc = migrated;
      return {
        document: migrated,
        status: {
          isTauri: false,
          filePath: 'LocalStorage: ' + STORAGE_LOCAL_KEY,
          loadedFrom: 'browser-localstorage',
        },
      };
    } catch {
      const defaultDoc = createDefaultDocument();
      this.cachedDoc = defaultDoc;
      return {
        document: defaultDoc,
        status: {
          isTauri: false,
          filePath: 'LocalStorage: ' + STORAGE_LOCAL_KEY,
          loadedFrom: 'browser-localstorage',
        },
      };
    }
  }

  /**
   * Save orders document atomically (write to temp file then rename/replace)
   */
  public async saveDocument(doc: OrdersDocument): Promise<void> {
    doc.updatedAt = new Date().toISOString();
    const serialized = JSON.stringify(doc, null, 2);

    if (isTauriEnvironment()) {
      try {
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const { writeTextFile, rename, exists, mkdir } = await import('@tauri-apps/plugin-fs');

        const baseDir = await appDataDir();
        if (!(await exists(baseDir))) {
          await mkdir(baseDir, { recursive: true });
        }

        const finalPath = await join(baseDir, ORDERS_FILE_NAME);
        const tempPath = await join(baseDir, ORDERS_TEMP_FILE_NAME);

        // Atomic write strategy:
        // 1. Write full content to temporary file
        await writeTextFile(tempPath, serialized);
        // 2. Atomically rename/replace temp file to final target file
        // On Windows and POSIX, renaming within same filesystem/directory is atomic
        await rename(tempPath, finalPath);

        this.cachedDoc = doc;
        this.currentFilePath = finalPath;
        return;
      } catch (err) {
        console.error('Failed to save document via Tauri FS, using browser fallback', err);
      }
    }

    // Fallback save in localStorage
    localStorage.setItem(STORAGE_LOCAL_KEY, serialized);
    this.cachedDoc = doc;
  }

  /**
   * Get cached document synchronously if already loaded
   */
  public getCachedDocument(): OrdersDocument | null {
    return this.cachedDoc;
  }
}

export const storageService = new StorageService();
