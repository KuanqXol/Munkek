import { Order, OrdersDocument, ORDER_STATUS_LABELS } from '../models/Order';
import { orderService } from './orderService';
import { storageService, isTauriEnvironment } from './storageService';
import { getTodayString, formatDate } from '../utils/formatters';

export interface BackupResult {
  success: boolean;
  message: string;
  filePath?: string;
  count?: number;
}

export interface ValidationBackupResult {
  isValid: boolean;
  orders: Order[];
  error?: string;
}

class BackupService {
  /**
   * Escape and format CSV cell
   */
  private escapeCsvCell(value: string | number | undefined | null): string {
    if (value === null || value === undefined) return '""';
    const str = String(value);
    // If contains quote, comma, or newline, escape quotes and wrap in quotes
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  }

  /**
   * Generate CSV content with UTF-8 BOM for Microsoft Excel compatibility
   */
  public generateCsvContent(orders: Order[]): string {
    const headers = [
      'Mã đơn',
      'Tên khách hàng',
      'Số điện thoại',
      'Tên bánh',
      'Số lượng',
      'Đơn giá (VNĐ)',
      'Thành tiền (VNĐ)',
      'Tiền cọc (VNĐ)',
      'Còn lại phải thu (VNĐ)',
      'Ngày đặt',
      'Ngày giao',
      'Trạng thái',
      'Ghi chú',
      'Ngày tạo',
    ];

    const rows = orders.map((order) => {
      const remaining = Math.max(0, order.total - (order.deposit || 0));
      const statusText = ORDER_STATUS_LABELS[order.status] || order.status;
      return [
        this.escapeCsvCell(order.id),
        this.escapeCsvCell(order.customerName),
        this.escapeCsvCell(order.phone),
        this.escapeCsvCell(order.productName),
        order.quantity,
        order.unitPrice,
        order.total,
        order.deposit || 0,
        remaining,
        this.escapeCsvCell(formatDate(order.orderDate)),
        this.escapeCsvCell(formatDate(order.deliveryDate)),
        this.escapeCsvCell(statusText),
        this.escapeCsvCell(order.note),
        this.escapeCsvCell(order.createdAt),
      ].join(',');
    });

    // \uFEFF is the UTF-8 Byte Order Mark (BOM) needed for Excel to recognize UTF-8 encoding
    return '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');
  }

  /**
   * Export all orders to CSV
   */
  public async exportCsv(): Promise<BackupResult> {
    try {
      const orders = await orderService.getAllOrders();
      if (orders.length === 0) {
        return {
          success: false,
          message: 'Không có đơn hàng nào để xuất file CSV.',
        };
      }

      const csvContent = this.generateCsvContent(orders);
      const defaultFilename = `orders_${getTodayString()}.csv`;

      if (isTauriEnvironment()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');

        const selectedPath = await save({
          title: 'Lưu danh sách đơn hàng CSV',
          defaultPath: defaultFilename,
          filters: [
            {
              name: 'File CSV',
              extensions: ['csv'],
            },
          ],
        });

        if (!selectedPath) {
          return { success: false, message: 'Đã hủy thao tác xuất CSV.' };
        }

        await writeTextFile(selectedPath, csvContent);
        return {
          success: true,
          message: `Đã xuất thành công ${orders.length} đơn hàng ra file CSV.`,
          filePath: selectedPath,
        };
      } else {
        // Browser download fallback
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return {
          success: true,
          message: `Đã tải xuống file CSV chứa ${orders.length} đơn hàng.`,
          filePath: defaultFilename,
        };
      }
    } catch (err) {
      console.error('Lỗi khi xuất CSV:', err);
      return {
        success: false,
        message: `Xuất CSV thất bại: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Backup all orders to a standalone JSON file
   */
  public async backupJson(): Promise<BackupResult> {
    try {
      const orders = await orderService.getAllOrders();
      const backupDoc: OrdersDocument = {
        schemaVersion: 1,
        appName: 'MunKek',
        updatedAt: new Date().toISOString(),
        orders,
      };

      const jsonContent = JSON.stringify(backupDoc, null, 2);
      const defaultFilename = `cake-orders-backup-${getTodayString()}.json`;

      if (isTauriEnvironment()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');

        const selectedPath = await save({
          title: 'Lưu file sao lưu dữ liệu JSON',
          defaultPath: defaultFilename,
          filters: [
            {
              name: 'MunKek Backup JSON',
              extensions: ['json'],
            },
          ],
        });

        if (!selectedPath) {
          return { success: false, message: 'Đã hủy thao tác sao lưu.' };
        }

        await writeTextFile(selectedPath, jsonContent);
        return {
          success: true,
          message: `Đã sao lưu thành công ${orders.length} đơn hàng!`,
          filePath: selectedPath,
        };
      } else {
        // Browser download fallback
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return {
          success: true,
          message: `Đã tải xuống file sao lưu JSON chứa ${orders.length} đơn hàng.`,
          filePath: defaultFilename,
        };
      }
    } catch (err) {
      console.error('Lỗi khi sao lưu JSON:', err);
      return {
        success: false,
        message: `Sao lưu thất bại: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Validate raw JSON structure before restoring
   */
  public validateBackupContent(rawJson: string): ValidationBackupResult {
    try {
      if (!rawJson || !rawJson.trim()) {
        return { isValid: false, orders: [], error: 'File sao lưu trống, không có nội dung.' };
      }

      const parsed = JSON.parse(rawJson);
      let rawOrders: unknown[] = [];

      if (Array.isArray(parsed)) {
        rawOrders = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).orders)) {
        rawOrders = (parsed as Record<string, unknown>).orders as unknown[];
      } else {
        return {
          isValid: false,
          orders: [],
          error: 'Cấu trúc file không hợp lệ (không tìm thấy danh sách đơn hàng).',
        };
      }

      const validOrders: Order[] = [];
      for (let i = 0; i < rawOrders.length; i++) {
        const item = rawOrders[i] as Record<string, unknown>;
        if (!item || typeof item !== 'object') {
          return {
            isValid: false,
            orders: [],
            error: `Đơn hàng ở vị trí #${i + 1} không phải là đối tượng hợp lệ.`,
          };
        }

        // Validate essential fields
        if (!item.id || typeof item.id !== 'string') {
          return {
            isValid: false,
            orders: [],
            error: `Đơn hàng ở vị trí #${i + 1} thiếu mã đơn (id).`,
          };
        }
        if (!item.customerName || typeof item.customerName !== 'string') {
          return {
            isValid: false,
            orders: [],
            error: `Đơn hàng mã ${item.id} thiếu tên khách hàng.`,
          };
        }
        if (!item.productName || typeof item.productName !== 'string') {
          return {
            isValid: false,
            orders: [],
            error: `Đơn hàng mã ${item.id} thiếu tên bánh.`,
          };
        }

        const validOrder: Order = {
          id: String(item.id),
          customerName: String(item.customerName),
          phone: String(item.phone || ''),
          productName: String(item.productName),
          quantity: Math.max(1, Number(item.quantity) || 1),
          unitPrice: Math.max(0, Number(item.unitPrice) || 0),
          total: Number(item.total) || Math.max(1, Number(item.quantity) || 1) * Math.max(0, Number(item.unitPrice) || 0),
          deposit: Math.max(0, Number(item.deposit) || 0),
          orderDate: String(item.orderDate || getTodayString()),
          deliveryDate: String(item.deliveryDate || getTodayString()),
          status: (['pending', 'preparing', 'completed', 'cancelled'].includes(String(item.status))
            ? item.status
            : 'pending') as Order['status'],
          note: String(item.note || ''),
          createdAt: String(item.createdAt || new Date().toISOString()),
          updatedAt: String(item.updatedAt || new Date().toISOString()),
        };

        validOrders.push(validOrder);
      }

      return {
        isValid: true,
        orders: validOrders,
      };
    } catch (err) {
      return {
        isValid: false,
        orders: [],
        error: `File JSON bị lỗi cú pháp: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Create an automatic safety backup of current data on disk before restoring
   */
  private async createSafetyPreRestoreBackup(): Promise<string | null> {
    try {
      const currentDoc = storageService.getCachedDocument();
      if (!currentDoc || currentDoc.orders.length === 0) return null;

      if (isTauriEnvironment()) {
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        const baseDir = await appDataDir();
        const backupPath = await join(
          baseDir,
          `orders.auto-backup-before-restore-${Date.now()}.json`
        );
        await writeTextFile(backupPath, JSON.stringify(currentDoc, null, 2));
        return backupPath;
      }
    } catch (err) {
      console.warn('Không thể tạo file auto-backup trước khi restore:', err);
    }
    return null;
  }

  /**
   * Restore from raw JSON string with full validation and auto safety backup
   */
  public async restoreFromJsonContent(rawJson: string): Promise<BackupResult> {
    const validation = this.validateBackupContent(rawJson);
    if (!validation.isValid) {
      return {
        success: false,
        message: validation.error || 'Dữ liệu file phục hồi không hợp lệ.',
      };
    }

    // Create safety backup of current data first
    const safetyFile = await this.createSafetyPreRestoreBackup();

    try {
      await orderService.replaceAllOrders(validation.orders);
      let msg = `Phục hồi dữ liệu thành công! Đã nạp ${validation.orders.length} đơn hàng.`;
      if (safetyFile) {
        msg += ` (Bản sao lưu an toàn trước đó đã được lưu tự động tại AppData).`;
      }
      return {
        success: true,
        message: msg,
        count: validation.orders.length,
      };
    } catch (err) {
      console.error('Lỗi khi ghi đè dữ liệu restore:', err);
      return {
        success: false,
        message: `Phục hồi thất bại: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Pick and restore JSON backup file (handles both Tauri dialog and browser)
   */
  public async pickAndRestoreJson(): Promise<BackupResult> {
    if (isTauriEnvironment()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const { readTextFile } = await import('@tauri-apps/plugin-fs');

        const selected = await open({
          title: 'Chọn file sao lưu MunKek (.json)',
          multiple: false,
          filters: [
            {
              name: 'MunKek Backup JSON',
              extensions: ['json'],
            },
          ],
        });

        if (!selected || typeof selected !== 'string') {
          return { success: false, message: 'Đã hủy chọn file phục hồi.' };
        }

        const content = await readTextFile(selected);
        return await this.restoreFromJsonContent(content);
      } catch (err) {
        return {
          success: false,
          message: `Không thể đọc file: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    } else {
      // In browser mode: return instructions or use input element trigger in UI
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve({ success: false, message: 'Đã hủy chọn file.' });
            return;
          }
          const reader = new FileReader();
          reader.onload = async (e) => {
            const content = e.target?.result as string;
            const res = await this.restoreFromJsonContent(content);
            resolve(res);
          };
          reader.onerror = () => {
            resolve({ success: false, message: 'Lỗi khi đọc file phục hồi từ trình duyệt.' });
          };
          reader.readAsText(file);
        };
        input.click();
      });
    }
  }
}

export const backupService = new BackupService();
