import { Order, ORDER_STATUS_LABELS, DISCOUNT_TYPE_LABELS } from '../models/Order';
import { Product, PRODUCT_TYPE_LABELS } from '../models/Product';
import { orderService } from './orderService';
import { productService } from './productService';
import { isTauriEnvironment } from './storageService';
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
      'Tổng số lượng bánh',
      'Tạm tính (VNĐ)',
      'Loại giảm giá',
      'Tiền giảm giá (VNĐ)',
      'Lý do giảm giá',
      'Tổng thanh toán (VNĐ)',
      'Tiền cọc (VNĐ)',
      'Còn nợ phải thu (VNĐ)',
      'Ngày nhận đơn',
      'Ngày hẹn giao',
      'Trạng thái',
      'Ghi chú',
      'Ngày tạo',
    ];

    const rows = orders.map((order) => {
      const items = order.items || [];
      const totalQty = items.reduce((sum, it) => sum + (it.quantity || 1), 0);
      const itemsDetail = items.map((it) => `${it.quantity}x ${it.productName}`).join('; ');
      const remaining = order.remaining !== undefined ? order.remaining : Math.max(0, order.total - (order.deposit || 0));
      const statusText = ORDER_STATUS_LABELS[order.status] || order.status;
      const discountTypeText = order.discountType ? DISCOUNT_TYPE_LABELS[order.discountType] || order.discountType : 'Không';
      const discountAmount = Math.max(0, (order.subtotal || order.total) - order.total);

      return [
        this.escapeCsvCell(order.id),
        this.escapeCsvCell(order.customer?.name || ''),
        this.escapeCsvCell(order.customer?.phone || ''),
        this.escapeCsvCell(order.customer?.address || ''),
        this.escapeCsvCell(itemsDetail),
        totalQty,
        order.subtotal || order.total,
        this.escapeCsvCell(discountTypeText),
        discountAmount,
        this.escapeCsvCell(order.discountNote || ''),
        order.total,
        order.deposit || 0,
        remaining,
        this.escapeCsvCell(formatDate(order.orderDate)),
        this.escapeCsvCell(formatDate(order.deliveryDate)),
        this.escapeCsvCell(statusText),
        this.escapeCsvCell(order.note || ''),
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

      const csvContent = this.generateOrdersCsvContent(orders);
      const defaultFilename = `don_hang_banh_${getTodayString()}.csv`;

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
   * Generate CSV for Products
   */
  public generateProductsCsvContent(products: Product[]): string {
    const headers = [
      'Mã bánh',
      'Tên bánh',
      'Phân loại',
      'Trọng lượng (g)',
      'Số trứng',
      'Đơn giá niêm yết (VNĐ)',
      'Giá vốn (VNĐ)',
      'Tình trạng',
      'Mô tả',
    ];

    const rows = products.map((p) => {
      const typeLabel = PRODUCT_TYPE_LABELS[p.type] || p.type;
      const statusText = p.isAvailable ? 'Còn làm' : 'Tạm hết';

      return [
        this.escapeCsvCell(p.id),
        this.escapeCsvCell(p.name),
        this.escapeCsvCell(typeLabel),
        p.weight,
        p.eggCount,
        p.unitPrice,
        p.costPrice || '',
        this.escapeCsvCell(statusText),
        this.escapeCsvCell(p.description || ''),
      ].join(',');
    });

    return '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rows].join('\r\n');
  }

  /**
   * Export all products to CSV
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
      const defaultFilename = `menu_banh_trung_thu_${getTodayString()}.csv`;

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
          message: `Đã xuất ${products.length} sản phẩm ra file CSV.`,
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
      const defaultFilename = `munkek-backup-${getTodayString()}.json`;
      const jsonContent = JSON.stringify(
        {
          schemaVersion: 1,
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
          filters: [{ name: 'File JSON', extensions: ['json'] }],
        });

        if (!selectedPath) {
          return { success: false, message: 'Đã hủy thao tác sao lưu.' };
        }

        await writeTextFile(selectedPath, jsonContent);
        return {
          success: true,
          message: `Đã tạo bản sao lưu thành công chứa ${orders.length} đơn hàng.`,
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
          message: `Đã tải xuống file sao lưu JSON chứa ${orders.length} đơn hàng.`,
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
        const item = candidateOrders[i] as Record<string, unknown>;

        if (!item || typeof item !== 'object') {
          return {
            isValid: false,
            orders: [],
            error: `Dòng thứ ${i + 1} không phải là đối tượng đơn hàng hợp lệ.`,
          };
        }

        const id = String(item.id || `ORD-${String(i + 1).padStart(4, '0')}`);

        // Handle customer info: support object or legacy customerName string
        const customer = item.customer && typeof item.customer === 'object'
          ? {
              name: String((item.customer as Record<string, unknown>).name || 'Khách vãng lai'),
              phone: String((item.customer as Record<string, unknown>).phone || ''),
              address: String((item.customer as Record<string, unknown>).address || ''),
            }
          : {
              name: String(item.customerName || 'Khách vãng lai'),
              phone: String(item.phone || ''),
              address: '',
            };

        // Handle items: support array or legacy productName
        let items = Array.isArray(item.items)
          ? item.items.map((it: Record<string, unknown>) => ({
              productId: String(it.productId || 'BTT-01'),
              productName: String(it.productName || 'Bánh Trung Thu'),
              quantity: Math.max(1, Number(it.quantity) || 1),
              originalPrice: Math.max(0, Number(it.originalPrice ?? it.unitPrice) || 0),
              customPrice: it.customPrice !== undefined ? Math.max(0, Number(it.customPrice)) : undefined,
            }))
          : [];

        if (items.length === 0 && item.productName) {
          items = [
            {
              productId: 'BTT-01',
              productName: String(item.productName),
              quantity: Math.max(1, Number(item.quantity) || 1),
              originalPrice: Math.max(0, Number(item.unitPrice) || 0),
              customPrice: undefined,
            },
          ];
        }

        const subtotal = Number(item.subtotal) || items.reduce((sum, it) => sum + it.quantity * (it.customPrice ?? it.originalPrice), 0);
        const total = Number(item.total) || subtotal;
        const deposit = Math.max(0, Number(item.deposit) || 0);
        const remaining = Math.max(0, total - deposit);

        const validOrder: Order = {
          id,
          customer,
          items,
          orderDate: String(item.orderDate || getTodayString()),
          deliveryDate: String(item.deliveryDate || getTodayString()),
          subtotal,
          discountType: (['none', 'amount', 'percent', 'override'].includes(String(item.discountType))
            ? item.discountType
            : 'none') as Order['discountType'],
          discountValue: Number(item.discountValue) || 0,
          discountNote: String(item.discountNote || ''),
          total,
          deposit,
          remaining,
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
   * Restore from raw JSON string with full validation and auto safety backup
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
      // Replace all orders
      await orderService.replaceAllOrders(validation.orders);

      return {
        success: true,
        message: `Phục hồi thành công ${validation.orders.length} đơn hàng từ file sao lưu!`,
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
