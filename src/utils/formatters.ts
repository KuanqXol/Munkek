import { OrderStatus } from '../models/Order';

/**
 * Format currency into Vietnamese Dong standard (e.g. 150.000 ₫)
 */
export function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0 ₫';
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format YYYY-MM-DD to DD/MM/YYYY
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

/**
 * Format ISO datetime string to DD/MM/YYYY HH:mm
 */
export function formatDateTime(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return isoString;
  }
}

/**
 * Get current date string in YYYY-MM-DD format
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
 * > 0: future, 0: today, < 0: past
 */
export function getDaysFromToday(targetDateStr: string): number {
  if (!targetDateStr) return 0;
  const todayStr = getTodayString();
  const today = new Date(todayStr + 'T00:00:00');
  const target = new Date(targetDateStr + 'T00:00:00');
  const diffTime = target.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get delivery urgency label
 */
export function getDeliveryUrgency(deliveryDate: string, status: OrderStatus): {
  label: string;
  className: string;
} {
  if (status === 'completed') {
    return { label: 'Đã hoàn thành', className: 'urgency-done' };
  }
  if (status === 'cancelled') {
    return { label: 'Đã hủy', className: 'urgency-cancelled' };
  }

  const days = getDaysFromToday(deliveryDate);
  if (days < 0) {
    return { label: `Quá hạn ${Math.abs(days)} ngày`, className: 'urgency-overdue' };
  }
  if (days === 0) {
    return { label: 'Hôm nay giao!', className: 'urgency-today' };
  }
  if (days === 1) {
    return { label: 'Ngày mai giao', className: 'urgency-tomorrow' };
  }
  return { label: `Còn ${days} ngày`, className: 'urgency-future' };
}
