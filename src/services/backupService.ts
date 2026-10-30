import { type Order, ORDER_STATUS_LABELS, DISCOUNT_TYPE_LABELS, normalizeOrder } from '../models/Order.ts';
import { type Product, PRODUCT_TYPE_LABELS } from '../models/Product.ts';
import { orderService } from './orderService.ts';
import { productService } from './productService.ts';
import { isTauriEnvironment, storageService } from './storageService.ts';
import { getTodayString, formatDate } from '../utils/formatters.ts';

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
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  }

  /**
   * Generate CSV content for Orders with UTF-8 BOM for Microsoft Excel compatibility
   */
  public generateOrdersCsvContent(orders: Order[]): string {
    const headers = [
      'Mã đơn',
      'Tên khách hàng',
      'Số điện thoại',
      'Địa chỉ giao',
      'Chi tiết bánh đã đặt',
      'Tổng số lượng',
      'Tạm tính (VNĐ)',
      'Hình thức giảm giá',
      'Tiền giảm (VNĐ)',
      'Lý do giảm giá',
      'Tổng thanh toán (VNĐ)',
      'Tiền cọc (VNĐ)',
      'Còn lại phải thu (VNĐ)',
      'Ngày nhận đơn',
      'Ngày hẹn giao',
      'Trạng thái',
      'Ghi chú',
      'Ngày tạo đơn',
    ];

    const rows = orders.map((order) => {
      const items = order.items || [];
      const totalQty = order.quantity || items.reduce((sum, it) => sum + (it.quantity || 1), 0);
      const itemsDetail =
        items.length > 0
          ? items.map((it) => `${it.quantity}x ${it.productName}`).join('; ')
          : order.productName;
      const statusText = order.status ? (ORDER_STATUS_LABELS[order.status] || order.status) : 'Hoàn tất';
      const discountTypeText = order.discountType ? DISCOUNT_TYPE_LABELS[order.discountType] || order.discountType : 'Không';
      const discountAmount = Math.max(0, (order.subtotal || order.total) - order.total);

      return [
        this.escapeCsvCell(order.id),
        this.escapeCsvCell(order.customer?.name || order.customerName || ''),
        this.escapeCsvCell(order.customer?.phone || order.phone || ''),
        this.escapeCsvCell(order.customer?.address || ''),
        this.escapeCsvCell(itemsDetail),
        totalQty,
        order.subtotal || order.total,
        this.escapeCsvCell(discountTypeText),
        discountAmount,
        this.escapeCsvCell(String(order.discountNote || '')),
        order.total,
        order.deposit || 0,
        order.remaining ?? 0,
        this.escapeCsvCell(formatDate(order.orderDate)),
        this.escapeCsvCell(formatDate(order.deliveryDate)),
        this.escapeCsvCell(statusText),
        this.escapeCsvCell(order.note || ''),
        this.escapeCsvCell(order.createdAt),
      ].join(',');
    });

    // \uFEFF is UTF-8 Byte Order Mark (BOM) needed for Excel to recognize UTF-8 encoding
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
          message: 'Chưa có đơn hàng nào để xuất file Excel.',
        };
      }

      const csvContent = this.generateOrdersCsvContent(orders);
      const defaultFilename = `MunKek_DonHang_${getTodayString()}.csv`;

      if (isTauriEnvironment()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');

        const selectedPath = await save({
          title: 'Lưu file danh sách đơn hàng Excel/CSV',
          defaultPath: defaultFilename,
          filters: [{ name: 'File CSV (Excel)', extensions: ['csv'] }],
        });

        if (!selectedPath) {
          return { success: false, message: 'Đã hủy thao tác lưu file.' };
        }

        await writeTextFile(selectedPath, csvContent);
        return {
          success: true,
          message: `Đã xuất ${orders.length} đơn hàng ra file Excel thành công!`,
          filePath: selectedPath,
        };
      } else {
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
          message: `Đã tải xuống file Excel chứa ${orders.length} đơn hàng.`,
          filePath: defaultFilename,
        };
      }
    } catch (err) {
      return {
        success: false,
        message: `Xuất file thất bại: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Generate CSV content for Products Menu
   */
  public generateProductsCsvContent(products: Product[]): string {
    const headers = [
      'Mã bánh',
      'Tên bánh / Sản phẩm',
      'Phân loại',
      'Số trứng',
      'Trọng lượng (g)',
      'Đơn giá bán (VNĐ)',
      'Giá vốn (VNĐ)',
      'Trạng thái',
      'Mô tả vị bánh',
    ];

    const rows = products.map((p) => {
      const typeText = (p.type && PRODUCT_TYPE_LABELS[p.type]) ? PRODUCT_TYPE_LABELS[p.type] : p.type || 'Bánh nướng';
      const eggText = p.eggCount !== undefined && p.eggCount > 0 ? `${p.eggCount} trứng` : 'Không trứng (Chay)';
      const weightText = p.weight !== undefined && p.weight > 0 ? `${p.weight}g` : '-';
      const statusText = p.isAvailable ? 'Đang nhận làm' : 'Tạm hết nhân';

      return [
        this.escapeCsvCell(p.id),
        this.escapeCsvCell(p.name),
        this.escapeCsvCell(typeText),
        this.escapeCsvCell(eggText),
        this.escapeCsvCell(weightText),
        p.unitPrice,
        p.costPrice || 0,
        this.escapeCsvCell(statusText),
        this.escapeCsvCell(p.description || ''),
      ].join(',');
    });

    return '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');
  }

  /**
   * Export product catalog to CSV
   */
  public async exportProductsCsv(): Promise<BackupResult> {
    try {
      const products = await productService.getAllProducts();
      if (products.length === 0) {
        return {
          success: false,
          message: 'Không có sản phẩm nào trong menu để xuất file CSV.',
        };
      }

      const csvContent = this.generateProductsCsvContent(products);
      const defaultFilename = `MunKek_MenuBanh_${getTodayString()}.csv`;

      if (isTauriEnvironment()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');

        const selectedPath = await save({
          title: 'Lưu bảng giá menu bánh CSV',
          defaultPath: defaultFilename,
          filters: [{ name: 'File CSV', extensions: ['csv'] }],
        });

        if (!selectedPath) return { success: false, message: 'Đã hủy thao tác.' };
        await writeTextFile(selectedPath, csvContent);
        return {
          success: true,
          message: `Đã xuất ${products.length} sản phẩm ra file CSV thành công.`,
          filePath: selectedPath,
        };
      } else {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { success: true, message: `Đã tải xuống file CSV menu bánh.` };
      }
    } catch (err) {
      return { success: false, message: `Lỗi xuất CSV menu: ${err}` };
    }
  }

  /**
   * Backup all orders to a standalone JSON file
   */
  public async backupJson(): Promise<BackupResult> {
    try {
      const orders = await orderService.getAllOrders();
      const defaultFilename = `MunKek_SaoLuu_${getTodayString()}.json`;
      const jsonContent = JSON.stringify(
        {
          schemaVersion: 2,
          appName: 'MunKek - Tiệm Bánh Trung Thu',
          exportDate: new Date().toISOString(),
          orders,
        },
        null,
        2
      );

      if (isTauriEnvironment()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');

        const selectedPath = await save({
          title: 'Lưu file sao lưu MunKek (JSON)',
          defaultPath: defaultFilename,
          filters: [{ name: 'File sao lưu JSON', extensions: ['json'] }],
        });

        if (!selectedPath) {
          return { success: false, message: 'Đã hủy thao tác sao lưu.' };
        }

        await writeTextFile(selectedPath, jsonContent);
        return {
          success: true,
          message: `Đã tạo bản sao lưu an toàn chứa ${orders.length} đơn hàng!`,
          filePath: selectedPath,
        };
      } else {
        const blob = new Blob([jsonContent], { type: 'application/json' });
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
          message: `Đã tải xuống file sao lưu chứa ${orders.length} đơn hàng.`,
          filePath: defaultFilename,
        };
      }
    } catch (err) {
      return {
        success: false,
        message: `Sao lưu thất bại: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Create an automatic safety backup in data/backups before any destructive restore
   */
  private async createAutoSafetyBackup(orders: Order[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `auto_backup_truoc_khi_phuc_hoi_${timestamp}.json`;
    const serialized = JSON.stringify(
      {
        schemaVersion: 2,
        appName: 'MunKek - Tiệm Bánh Trung Thu',
        backupReason: 'Auto safety backup before restore',
        createdAt: new Date().toISOString(),
        orders,
      },
      null,
      2
    );

    if (isTauriEnvironment()) {
      const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
      const { join } = await import('@tauri-apps/api/path');

      const dataDir = storageService.getDataFolderPath();
      const backupsDir = await join(dataDir, 'backups');
      if (!(await exists(backupsDir))) {
        await mkdir(backupsDir, { recursive: true });
      }

      const backupFilePath = await join(backupsDir, filename);
      await writeTextFile(backupFilePath, serialized);
      return backupFilePath;
    }

    // Browser mode
    localStorage.setItem(`munkek_safety_backup_${timestamp}`, serialized);
    return filename;
  }

  /**
   * Validate and parse backup JSON content (supports both new multi-item and legacy single-item formats)
   */
  public validateBackupContent(rawJson: string): ValidationBackupResult {
    try {
      const parsed = JSON.parse(rawJson);
      let candidateOrders: unknown[] = [];

      if (Array.isArray(parsed)) {
        candidateOrders = parsed;
      } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.orders)) {
        candidateOrders = parsed.orders;
      } else {
        return {
          isValid: false,
          orders: [],
          error: 'File sao lưu không đúng định dạng của MunKek (không tìm thấy danh sách đơn hàng).',
        };
      }

      const validOrders: Order[] = [];

      for (let i = 0; i < candidateOrders.length; i++) {
        const item = candidateOrders[i];
        if (!item || typeof item !== 'object') {
          return {
            isValid: false,
            orders: [],
            error: `Đơn hàng thứ ${i + 1} trong file không hợp lệ.`,
          };
        }

        const normalized = normalizeOrder(item as Record<string, unknown>, i);
        validOrders.push(normalized);
      }

      return {
        isValid: true,
        orders: validOrders,
      };
    } catch (err) {
      return {
        isValid: false,
        orders: [],
        error: `File JSON bị lỗi cấu trúc: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Restore from raw JSON string with full validation and mandatory auto safety backup
   */
  public async restoreFromJsonContent(rawJson: string): Promise<BackupResult> {
    const validation = this.validateBackupContent(rawJson);
    if (!validation.isValid) {
      return {
        success: false,
        message: validation.error || 'Dữ liệu file sao lưu không hợp lệ.',
      };
    }

    try {
      // 1. Safeguard: Create automatic safety backup of current orders first!
      const currentOrders = await orderService.getAllOrders();
      if (currentOrders.length > 0) {
        try {
          await this.createAutoSafetyBackup(currentOrders);
        } catch (safetyErr) {
          return {
            success: false,
            message: `Không thể tạo bản sao lưu an toàn tự động: ${safetyErr}. Quá trình phục hồi đã được hủy để bảo vệ dữ liệu hiện tại của bạn.`,
          };
        }
      }

      // 2. Replace all orders safely
      await orderService.replaceAllOrders(validation.orders);

      return {
        success: true,
        message: `Đã phục hồi thành công ${validation.orders.length} đơn hàng! Bản sao lưu an toàn của dữ liệu trước đó đã được lưu trong thư mục backups.`,
        count: validation.orders.length,
      };
    } catch (err) {
      return {
        success: false,
        message: `Lỗi ghi dữ liệu: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Pick file and restore JSON
   */
  public async pickAndRestoreJson(): Promise<BackupResult> {
    try {
      if (isTauriEnvironment()) {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const { readTextFile } = await import('@tauri-apps/plugin-fs');

        const selected = await open({
          multiple: false,
          filters: [{ name: 'File sao lưu MunKek', extensions: ['json'] }],
        });

        if (!selected || typeof selected !== 'string') {
          return { success: false, message: 'Đã hủy chọn file phục hồi.' };
        }

        const content = await readTextFile(selected);
        return await this.restoreFromJsonContent(content);
      } else {
        // Browser file picker fallback
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
              resolve({ success: false, message: 'Chưa chọn file sao lưu.' });
              return;
            }
            const reader = new FileReader();
            reader.onload = async (e) => {
              const text = e.target?.result as string;
              const result = await this.restoreFromJsonContent(text);
              resolve(result);
            };
            reader.onerror = () => {
              resolve({ success: false, message: 'Không thể đọc file đã chọn.' });
            };
            reader.readAsText(file);
          };
          input.click();
        });
      }
    } catch (err) {
      return {
        success: false,
        message: `Phục hồi thất bại: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

export const backupService = new BackupService();
