/**
 * Escape HTML special characters to prevent raw template injection
 */
export function escapeHtml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Remove Vietnamese accents/diacritics for fast unaccented search
 * e.g. "Bánh Thập Cẩm" -> "banh thap cam"
 */
export function removeVietnameseTones(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Format currency into Vietnamese Dong standard (e.g. 150.000 ₫)
 */
export function formatCurrency(amount: number | undefined | null): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '0 ₫';
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

/**
 * Format YYYY-MM-DD to DD/MM/YYYY
 */
export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const parts = String(dateString).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(dateString);
}

/**
 * Format ISO datetime string to DD/MM/YYYY HH:mm
 */
export function formatDateTime(isoString: string | undefined | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return String(isoString);
  }
}

/**
 * Get current date string in YYYY-MM-DD format (local time)
 */
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate difference in calendar days between today and target date.
 */
export function getDaysFromToday(targetDateStr: string | undefined | null): number {
  if (!targetDateStr) return 0;
  const todayStr = getTodayString();
  const today = new Date(todayStr + 'T00:00:00');
  const target = new Date(targetDateStr + 'T00:00:00');
  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export interface DeliveryUrgency {
  label: string;
  className: string;
  days: number;
}

/**
 * Determine delivery urgency and badge styling based on target delivery date
 */
export function getDeliveryUrgency(deliveryDate?: string | null, status?: string): DeliveryUrgency {
  if (status === 'completed') {
    return { label: 'Đã hoàn tất', className: 'urgency-normal', days: 0 };
  }
  if (status === 'cancelled') {
    return { label: 'Đã hủy', className: 'urgency-normal', days: 0 };
  }
  if (!deliveryDate) {
    return { label: 'Không hẹn ngày', className: 'urgency-normal', days: 0 };
  }

  const days = getDaysFromToday(deliveryDate);
  if (days < 0) {
    return { label: `Quá hạn ${Math.abs(days)} ngày`, className: 'urgency-overdue', days };
  }
  if (days === 0) {
    return { label: 'Giao hôm nay', className: 'urgency-today', days };
  }
  if (days === 1) {
    return { label: 'Giao ngày mai', className: 'urgency-soon', days };
  }
  if (days <= 3) {
    return { label: `Giao sau ${days} ngày`, className: 'urgency-soon', days };
  }
  return { label: `Còn ${days} ngày`, className: 'urgency-normal', days };
}
