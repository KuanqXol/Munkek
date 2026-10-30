import type { Order } from '../models/Order.ts';
import { orderService } from './orderService.ts';
import { productService } from './productService.ts';
import { customerService } from './customerService.ts';
import { getTodayString } from '../utils/formatters.ts';

export type AnalyticsPeriod = 'today' | '7days' | 'month' | 'last_month' | 'year' | 'all' | 'custom';

export interface AnalyticsReport {
  periodLabel: string;
  filteredOrders: Order[];

  // 1. Overview
  overview: {
    totalOrders: number;
    ordersToday: number;
    ordersThisWeek: number;
    ordersThisMonth: number;
    ordersThisYear: number;
    totalGrossValue: number;
    totalDiscountAmount: number;
    totalFinalValue: number;
    totalCollected: number;
    totalRemaining: number;
    completedOrdersCount: number;
    pendingOrdersCount: number;
    completionRate: number;
    avgOrderValue: number;
    medianOrderValue: number;
    totalItemsSold: number;
    avgItemsPerOrder: number;
    totalKnownCustomers: number;
    momRevenueGrowth: number | null; // % vs last month
    momOrderGrowth: number | null;
  };

  // 2. Customers
  customers: {
    topSpenders: Array<{ name: string; phone?: string; totalSpent: number; orderCount: number; totalQty: number; id?: string }>;
    topFrequent: Array<{ name: string; phone?: string; orderCount: number; totalSpent: number; id?: string }>;
    topQuantities: Array<{ name: string; phone?: string; totalQty: number; id?: string }>;
    repeatCustomersCount: number;
    oneTimeCustomersCount: number;
    repeatRate: number; // %
    firstCustomer: { name: string; date: string } | null;
    latestCustomer: { name: string; date: string } | null;
    avgDaysBetweenOrders: number | null;
    customerDiscounts: Array<{ name: string; totalDiscount: number }>;
  };

  // 3. Products
  products: {
    bestSellersByQty: Array<{ productName: string; quantity: number; revenue: number; percent: number }>;
    bestSellersByRevenue: Array<{ productName: string; quantity: number; revenue: number }>;
    mostFrequentProduct: { productName: string; orderCount: number } | null;
    leastSoldProduct: { productName: string; quantity: number } | null;
    productCombos: Array<{ combo: string; count: number }>;
    revenueShare: Array<{ productName: string; percent: number; revenue: number }>;
  };

  // 4. Orders
  ordersStats: {
    maxOrder: Order | null;
    minOrder: Order | null;
    orderWithMostItems: Order | null;
    orderWithMostDistinctProducts: Order | null;
    biggestDiscountOrder: Order | null;
    anonymousCount: number;
    identifiedCount: number;
    singleItemOrdersCount: number;
    multiItemOrdersCount: number;
    valueBins: Array<{ label: string; count: number; percent: number }>;
  };

  // 5. Discounts
  discounts: {
    totalDiscountAmount: number;
    discountedOrdersCount: number;
    discountedPercent: number; // % of orders
    avgDiscountAmount: number;
    byMode: {
      percentCount: number;
      percentTotal: number;
      fixedCount: number;
      fixedTotal: number;
      finalCount: number;
      finalTotal: number;
    };
    avgWithDiscount: number;
    avgWithoutDiscount: number;
  };

  // 6. Time Analysis
  timeAnalysis: {
    bestDay: { date: string; revenue: number; orderCount: number } | null;
    bestMonth: { month: string; revenue: number; orderCount: number } | null;
    slowestMonth: { month: string; revenue: number; orderCount: number } | null;
    dayOfWeekDistribution: Array<{ dayName: string; count: number; revenue: number }>;
    bestWeekday: string | null;
    monthlyStats: Array<{ month: string; count: number; revenue: number }>;
    activeStreakDays: number;
    longestGapDays: number;
  };

  // 7. Store Records
  records: {
    mostLoyalCustomer: { name: string; count: number } | null;
    highestSpender: { name: string; spent: number } | null;
    biggestOrder: { id: string; total: number; customer: string } | null;
    mostItemsOrder: { id: string; qty: number; customer: string } | null;
    mostLovedProduct: { name: string; qty: number } | null;
    busiestDay: { date: string; count: number } | null;
    bestMonth: { month: string; revenue: number } | null;
    totalOrdersMilestone: number;
    totalCakesMilestone: number;
    biggestDiscountRecorded: { id: string; amount: number; customer: string } | null;
    firstStoreOrder: Order | null;
  };

  // 8. Finance & Profit
  finance: {
    hasCostData: boolean;
    estimatedGrossProfit: number;
    grossMarginPercent: number | null;
    totalCost: number;
    mostProfitableProduct: { productName: string; profit: number } | null;
    itemsMissingCostCount: number;
  };

  // 9. Data Quality
  dataQuality: {
    ordersWithoutCustomerCount: number;
    productsWithoutImageCount: number;
    productsWithoutPriceCount: number;
    abnormalZeroTotalOrdersCount: number;
    potentialDuplicateCustomersCount: number;
  };
}

class AnalyticsService {
  /**
   * Filter orders for a given reporting period
   */
  public filterOrdersByPeriod(
    orders: Order[],
    period: AnalyticsPeriod,
    customStart?: string,
    customEnd?: string
  ): { orders: Order[]; periodLabel: string } {
    const todayStr = getTodayString();
    const today = new Date(todayStr + 'T00:00:00');

    let startDate = '';
    let endDate = '';
    let periodLabel = 'Toàn bộ thời gian';

    if (period === 'today') {
      startDate = todayStr;
      endDate = todayStr;
      periodLabel = 'Hôm nay';
    } else if (period === '7days') {
      const past = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      startDate = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
      endDate = todayStr;
      periodLabel = '7 ngày qua';
    } else if (period === 'month') {
      startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      endDate = todayStr;
      periodLabel = 'Tháng này';
    } else if (period === 'last_month') {
      const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonthEnd = new Date(firstThisMonth.getTime() - 1);
      const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);

      startDate = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, '0')}-01`;
      endDate = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(lastMonthEnd.getDate()).padStart(2, '0')}`;
      periodLabel = `Tháng ${lastMonthStart.getMonth() + 1}/${lastMonthStart.getFullYear()}`;
    } else if (period === 'year') {
      startDate = `${today.getFullYear()}-01-01`;
      endDate = todayStr;
      periodLabel = `Năm ${today.getFullYear()}`;
    } else if (period === 'custom') {
      startDate = customStart || '';
      endDate = customEnd || '';
      periodLabel = `Từ ${startDate || 'đầu'} đến ${endDate || 'nay'}`;
    }

    let filtered = [...orders];
    // Exclude legacy cancelled orders from business statistics
    filtered = filtered.filter((o) => o.status !== 'cancelled');

    if (startDate) {
      filtered = filtered.filter((o) => o.orderDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((o) => o.orderDate <= endDate);
    }

    return { orders: filtered, periodLabel };
  }

  /**
   * Alias for computeReport
   */
  public async generateReport(
    period: AnalyticsPeriod = 'all',
    customStart?: string,
    customEnd?: string
  ): Promise<AnalyticsReport> {
    return this.computeReport(period, customStart, customEnd);
  }

  /**
   * Compute comprehensive analytics across all 9 categories
   */
  public async computeReport(
    period: AnalyticsPeriod = 'all',
    customStart?: string,
    customEnd?: string
  ): Promise<AnalyticsReport> {
    const allOrders = await orderService.getAllOrders();
    const validAllOrders = allOrders.filter((o) => o.status !== 'cancelled');
    const allProducts = await productService.getAllProducts();
    const allCustomers = await customerService.getAllCustomers();

    const { orders, periodLabel } = this.filterOrdersByPeriod(allOrders, period, customStart, customEnd);
    const todayStr = getTodayString();

    // 1. Overview
    const totalOrders = orders.length;
    const ordersToday = orders.filter((o) => o.orderDate === todayStr).length;

    // Week calculation
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0
    const startOfWeek = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
    const startOfWeekStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
    const ordersThisWeek = orders.filter((o) => o.orderDate >= startOfWeekStr).length;

    const startOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const ordersThisMonth = orders.filter((o) => o.orderDate >= startOfMonthStr).length;

    const startOfYearStr = `${now.getFullYear()}-01-01`;
    const ordersThisYear = orders.filter((o) => o.orderDate >= startOfYearStr).length;

    const totalGrossValue = orders.reduce((sum, o) => sum + o.subtotal, 0);
    const totalDiscountAmount = orders.reduce((sum, o) => sum + o.discountAmount, 0);
    const totalFinalValue = orders.reduce((sum, o) => sum + o.finalTotal, 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(totalFinalValue / totalOrders) : 0;

    // Cashflow: Collected vs Remaining
    let totalCollected = 0;
    let totalRemaining = 0;
    let completedOrdersCount = 0;
    let pendingOrdersCount = 0;

    orders.forEach((o) => {
      const isCompleted = o.status === 'completed';
      if (isCompleted) {
        completedOrdersCount++;
        totalCollected += o.finalTotal;
      } else {
        pendingOrdersCount++;
        const dep = Math.min(o.deposit !== undefined ? Number(o.deposit) : 0, o.finalTotal);
        const rem = Math.max(0, o.finalTotal - dep);
        totalCollected += dep;
        totalRemaining += rem;
      }
    });

    const completionRate = totalOrders > 0 ? Math.round((completedOrdersCount / totalOrders) * 100) : 0;

    // Median order value
    const sortedTotals = orders.map((o) => o.finalTotal).sort((a, b) => a - b);
    let medianOrderValue = 0;
    if (sortedTotals.length > 0) {
      const mid = Math.floor(sortedTotals.length / 2);
      medianOrderValue = sortedTotals.length % 2 !== 0 ? sortedTotals[mid] : Math.round((sortedTotals[mid - 1] + sortedTotals[mid]) / 2);
    }

    const totalItemsSold = orders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0);
    const avgItemsPerOrder = totalOrders > 0 ? Number((totalItemsSold / totalOrders).toFixed(1)) : 0;

    // Distinct identified customers
    const knownCustomerNames = new Set<string>();
    orders.forEach((o) => {
      if (o.customerName && o.customerName !== 'Khách không xác định') {
        knownCustomerNames.add(o.customerName);
      }
    });
    const totalKnownCustomers = knownCustomerNames.size;

    // MoM Growth (this month vs last month from all orders)
    const thisMonthOrders = validAllOrders.filter((o) => o.orderDate.startsWith(startOfMonthStr.slice(0, 7)));
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthPrefix = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthOrders = validAllOrders.filter((o) => o.orderDate.startsWith(prevMonthPrefix));

    const thisMonthRev = thisMonthOrders.reduce((sum, o) => sum + o.finalTotal, 0);
    const lastMonthRev = lastMonthOrders.reduce((sum, o) => sum + o.finalTotal, 0);

    const momRevenueGrowth = lastMonthRev > 0 ? Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 100) : null;
    const momOrderGrowth = lastMonthOrders.length > 0 ? Math.round(((thisMonthOrders.length - lastMonthOrders.length) / lastMonthOrders.length) * 100) : null;

    // 2. Customers Analytics
    const customerMap: Record<string, { name: string; phone?: string; totalSpent: number; orderCount: number; totalQty: number; discounts: number; dates: string[] }> = {};

    orders.forEach((o) => {
      if (!o.customerName || o.customerName === 'Khách không xác định') return;
      const key = (o.phone ? `${o.customerName}_${o.phone}` : o.customerName).toLowerCase();
      if (!customerMap[key]) {
        customerMap[key] = {
          name: o.customerName,
          phone: o.phone,
          totalSpent: 0,
          orderCount: 0,
          totalQty: 0,
          discounts: 0,
          dates: [],
        };
      }
      customerMap[key].totalSpent += o.finalTotal;
      customerMap[key].orderCount += 1;
      customerMap[key].totalQty += o.items.reduce((s, it) => s + it.quantity, 0);
      customerMap[key].discounts += o.discountAmount;
      customerMap[key].dates.push(o.orderDate);
    });

    const customerList = Object.values(customerMap);
    const topSpenders = [...customerList].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 20);
    const topFrequent = [...customerList].sort((a, b) => b.orderCount - a.orderCount).slice(0, 20);
    const topQuantities = [...customerList].sort((a, b) => b.totalQty - a.totalQty).slice(0, 20);
    const customerDiscounts = [...customerList].filter((c) => c.discounts > 0).sort((a, b) => b.discounts - a.discounts).map((c) => ({ name: c.name, totalDiscount: c.discounts })).slice(0, 10);

    const repeatCustomersCount = customerList.filter((c) => c.orderCount >= 2).length;
    const oneTimeCustomersCount = customerList.filter((c) => c.orderCount === 1).length;
    const repeatRate = customerList.length > 0 ? Math.round((repeatCustomersCount / customerList.length) * 100) : 0;

    // First and Latest customer
    const sortedByDate = [...orders].sort((a, b) => a.orderDate.localeCompare(b.orderDate));
    const firstWithCust = sortedByDate.find((o) => o.customerName !== 'Khách không xác định');
    const latestWithCust = [...sortedByDate].reverse().find((o) => o.customerName !== 'Khách không xác định');

    // 3. Products Analytics
    const prodMap: Record<string, { quantity: number; revenue: number; orderCount: number }> = {};
    const comboMap: Record<string, number> = {};

    orders.forEach((o) => {
      const distinctNamesInOrder = Array.from(new Set(o.items.map((it) => it.productName)));

      // Combos: 2 products bought together
      if (distinctNamesInOrder.length >= 2) {
        for (let i = 0; i < distinctNamesInOrder.length; i++) {
          for (let j = i + 1; j < distinctNamesInOrder.length; j++) {
            const pair = [distinctNamesInOrder[i], distinctNamesInOrder[j]].sort().join(' + ');
            comboMap[pair] = (comboMap[pair] || 0) + 1;
          }
        }
      }

      o.items.forEach((it) => {
        if (!prodMap[it.productName]) {
          prodMap[it.productName] = { quantity: 0, revenue: 0, orderCount: 0 };
        }
        prodMap[it.productName].quantity += it.quantity;

        // Proportional discount allocation per line
        const lineFraction = o.subtotal > 0 ? it.lineTotal / o.subtotal : 0;
        const lineDiscount = o.discountAmount * lineFraction;
        const lineNet = Math.max(0, it.lineTotal - lineDiscount);

        prodMap[it.productName].revenue += lineNet;
        prodMap[it.productName].orderCount += 1;
      });
    });

    const prodList = Object.entries(prodMap).map(([productName, data]) => ({
      productName,
      quantity: data.quantity,
      revenue: Math.round(data.revenue),
      orderCount: data.orderCount,
    }));

    const bestSellersByQty = [...prodList]
      .sort((a, b) => b.quantity - a.quantity)
      .map((p) => ({
        ...p,
        percent: totalItemsSold > 0 ? Math.round((p.quantity / totalItemsSold) * 100) : 0,
      }));
    const bestSellersByRevenue = [...prodList].sort((a, b) => b.revenue - a.revenue).slice(0, 15);
    const mostFrequentProduct = [...prodList].sort((a, b) => b.orderCount - a.orderCount)[0] || null;
    const leastSoldProduct = [...prodList].sort((a, b) => a.quantity - b.quantity)[0] || null;

    const productCombos = Object.entries(comboMap)
      .map(([combo, count]) => ({ combo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const revenueShare = prodList
      .map((p) => ({
        productName: p.productName,
        revenue: p.revenue,
        percent: totalFinalValue > 0 ? Number(((p.revenue / totalFinalValue) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.percent - a.percent);

    // 4. Orders Stats & Distribution Bins
    let maxOrder: Order | null = null;
    let minOrder: Order | null = null;
    let orderWithMostItems: Order | null = null;
    let orderWithMostDistinctProducts: Order | null = null;
    let biggestDiscountOrder: Order | null = null;

    let anonymousCount = 0;
    let singleItemOrdersCount = 0;
    let multiItemOrdersCount = 0;

    const bins = [
      { label: 'Dưới 100.000 ₫', min: 0, max: 99999, count: 0 },
      { label: '100.000 ₫ - 300.000 ₫', min: 100000, max: 300000, count: 0 },
      { label: '300.000 ₫ - 500.000 ₫', min: 300001, max: 500000, count: 0 },
      { label: '500.000 ₫ - 1.000.000 ₫', min: 500001, max: 1000000, count: 0 },
      { label: 'Trên 1.000.000 ₫', min: 1000001, max: Infinity, count: 0 },
    ];

    orders.forEach((o) => {
      if (!maxOrder || o.finalTotal > maxOrder.finalTotal) maxOrder = o;
      if (!minOrder || o.finalTotal < minOrder.finalTotal) minOrder = o;

      const totalQty = o.items.reduce((s, it) => s + it.quantity, 0);
      if (!orderWithMostItems || totalQty > orderWithMostItems.items.reduce((s, it) => s + it.quantity, 0)) {
        orderWithMostItems = o;
      }
      if (!orderWithMostDistinctProducts || o.items.length > orderWithMostDistinctProducts.items.length) {
        orderWithMostDistinctProducts = o;
      }
      if (!biggestDiscountOrder || o.discountAmount > biggestDiscountOrder.discountAmount) {
        biggestDiscountOrder = o;
      }

      if (o.customerName === 'Khách không xác định') {
        anonymousCount++;
      }
      if (o.items.length <= 1) {
        singleItemOrdersCount++;
      } else {
        multiItemOrdersCount++;
      }

      // Binning
      for (const b of bins) {
        if (o.finalTotal >= b.min && o.finalTotal <= b.max) {
          b.count++;
          break;
        }
      }
    });

    const valueBins = bins.map((b) => ({
      label: b.label,
      count: b.count,
      percent: totalOrders > 0 ? Math.round((b.count / totalOrders) * 100) : 0,
    }));

    // 5. Discounts Stats
    const discountedOrders = orders.filter((o) => o.discountAmount > 0);
    const discountedOrdersCount = discountedOrders.length;
    const discountedPercent = totalOrders > 0 ? Math.round((discountedOrdersCount / totalOrders) * 100) : 0;
    const avgDiscountAmount = discountedOrdersCount > 0 ? Math.round(totalDiscountAmount / discountedOrdersCount) : 0;

    const byMode = {
      percentCount: 0,
      percentTotal: 0,
      fixedCount: 0,
      fixedTotal: 0,
      finalCount: 0,
      finalTotal: 0,
    };

    orders.forEach((o) => {
      if (o.discountType === 'percent') {
        byMode.percentCount++;
        byMode.percentTotal += o.discountAmount;
      } else if (o.discountType === 'fixed' || o.discountType === 'amount') {
        byMode.fixedCount++;
        byMode.fixedTotal += o.discountAmount;
      } else if (o.discountType === 'final' || o.discountType === 'override') {
        byMode.finalCount++;
        byMode.finalTotal += o.discountAmount;
      }
    });

    const nonDiscountedOrders = orders.filter((o) => o.discountAmount === 0);
    const avgWithDiscount = discountedOrdersCount > 0 ? Math.round(discountedOrders.reduce((s, o) => s + o.finalTotal, 0) / discountedOrdersCount) : 0;
    const avgWithoutDiscount = nonDiscountedOrders.length > 0 ? Math.round(nonDiscountedOrders.reduce((s, o) => s + o.finalTotal, 0) / nonDiscountedOrders.length) : 0;

    // 6. Time Analysis
    const dayMap: Record<string, { revenue: number; orderCount: number }> = {};
    const monthMap: Record<string, { revenue: number; orderCount: number }> = {};
    const dowCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun to Sat
    const dowRevenue = [0, 0, 0, 0, 0, 0, 0];

    orders.forEach((o) => {
      dayMap[o.orderDate] = dayMap[o.orderDate] || { revenue: 0, orderCount: 0 };
      dayMap[o.orderDate].revenue += o.finalTotal;
      dayMap[o.orderDate].orderCount += 1;

      const m = o.orderDate.slice(0, 7);
      monthMap[m] = monthMap[m] || { revenue: 0, orderCount: 0 };
      monthMap[m].revenue += o.finalTotal;
      monthMap[m].orderCount += 1;

      const d = new Date(o.orderDate + 'T00:00:00');
      const dow = d.getDay();
      dowCounts[dow]++;
      dowRevenue[dow] += o.finalTotal;
    });

    const dayEntries = Object.entries(dayMap).map(([date, d]) => ({ date, ...d }));
    const bestDay = [...dayEntries].sort((a, b) => b.revenue - a.revenue)[0] || null;

    const monthEntries = Object.entries(monthMap).map(([month, d]) => ({
      month,
      count: d.orderCount,
      orderCount: d.orderCount,
      revenue: d.revenue,
    }));
    const bestMonth = [...monthEntries].sort((a, b) => b.revenue - a.revenue)[0] || null;
    const slowestMonth = [...monthEntries].sort((a, b) => a.revenue - b.revenue)[0] || null;

    const DOW_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayOfWeekDistribution = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
      dayName: DOW_NAMES[dow],
      count: dowCounts[dow],
      revenue: dowRevenue[dow],
    }));

    const bestWeekdayEntry = [...dayOfWeekDistribution].sort((a, b) => b.count - a.count)[0];
    const bestWeekday = bestWeekdayEntry && bestWeekdayEntry.count > 0 ? bestWeekdayEntry.dayName : null;

    const monthlyStats = [...monthEntries].sort((a, b) => a.month.localeCompare(b.month));

    // Active streak and longest gap
    const distinctDates = Object.keys(dayMap).sort();
    let activeStreakDays = distinctDates.length > 0 ? 1 : 0;
    let currentStreak = 1;
    let longestGapDays = 0;

    for (let i = 1; i < distinctDates.length; i++) {
      const prev = new Date(distinctDates[i - 1] + 'T00:00:00');
      const curr = new Date(distinctDates[i] + 'T00:00:00');
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
        if (currentStreak > activeStreakDays) activeStreakDays = currentStreak;
      } else {
        currentStreak = 1;
        const gap = diffDays - 1;
        if (gap > longestGapDays) longestGapDays = gap;
      }
    }

    // 7. Store Records (from validAllOrders)
    const allProdMap: Record<string, number> = {};
    const allCustSpends: Record<string, { name: string; spent: number; count: number }> = {};
    let allMaxOrder: Order | null = null;
    let allMaxItemsOrder: Order | null = null;
    let allMaxDiscountOrder: Order | null = null;

    validAllOrders.forEach((o) => {
      if (!allMaxOrder || o.finalTotal > allMaxOrder.finalTotal) allMaxOrder = o;
      const q = o.items.reduce((s, it) => s + it.quantity, 0);
      if (!allMaxItemsOrder || q > allMaxItemsOrder.items.reduce((s, it) => s + it.quantity, 0)) allMaxItemsOrder = o;
      if (!allMaxDiscountOrder || o.discountAmount > allMaxDiscountOrder.discountAmount) allMaxDiscountOrder = o;

      o.items.forEach((it) => {
        allProdMap[it.productName] = (allProdMap[it.productName] || 0) + it.quantity;
      });

      if (o.customerName && o.customerName !== 'Khách không xác định') {
        const k = o.customerName.toLowerCase();
        if (!allCustSpends[k]) allCustSpends[k] = { name: o.customerName, spent: 0, count: 0 };
        allCustSpends[k].spent += o.finalTotal;
        allCustSpends[k].count += 1;
      }
    });

    const topLoyal = Object.values(allCustSpends).sort((a, b) => b.count - a.count)[0];
    const topSpender = Object.values(allCustSpends).sort((a, b) => b.spent - a.spent)[0];
    const topProduct = Object.entries(allProdMap).sort((a, b) => b[1] - a[1])[0];

    const records = {
      mostLoyalCustomer: topLoyal ? { name: topLoyal.name, count: topLoyal.count } : null,
      highestSpender: topSpender ? { name: topSpender.name, spent: topSpender.spent } : null,
      biggestOrder: allMaxOrder ? { id: (allMaxOrder as Order).id, total: (allMaxOrder as Order).finalTotal, customer: (allMaxOrder as Order).customerName } : null,
      mostItemsOrder: allMaxItemsOrder ? { id: (allMaxItemsOrder as Order).id, qty: (allMaxItemsOrder as Order).items.reduce((s, it) => s + it.quantity, 0), customer: (allMaxItemsOrder as Order).customerName } : null,
      mostLovedProduct: topProduct ? { name: topProduct[0], qty: topProduct[1] } : null,
      busiestDay: bestDay ? { date: bestDay.date, count: bestDay.orderCount } : null,
      bestMonth: bestMonth ? { month: bestMonth.month, revenue: bestMonth.revenue } : null,
      totalOrdersMilestone: validAllOrders.length,
      totalCakesMilestone: validAllOrders.reduce((s, o) => s + o.items.reduce((itSum, it) => itSum + it.quantity, 0), 0),
      biggestDiscountRecorded: allMaxDiscountOrder && (allMaxDiscountOrder as Order).discountAmount > 0
        ? { id: (allMaxDiscountOrder as Order).id, amount: (allMaxDiscountOrder as Order).discountAmount, customer: (allMaxDiscountOrder as Order).customerName }
        : null,
      firstStoreOrder: validAllOrders.length > 0 ? validAllOrders[validAllOrders.length - 1] : null,
    };

    // 8. Finance & Profit
    let totalCost = 0;
    let itemsWithCostCount = 0;
    let itemsMissingCostCount = 0;
    const profitByProduct: Record<string, number> = {};

    orders.forEach((o) => {
      o.items.forEach((it) => {
        // Find catalog cost if snapshot cost is not in order
        const catalogProd = allProducts.find((p) => p.name === it.productName || p.id === it.productId);
        const unitCost = it.costPrice !== undefined ? it.costPrice : catalogProd?.costPrice;

        if (unitCost !== undefined && unitCost > 0) {
          const lineCost = unitCost * it.quantity;
          totalCost += lineCost;
          itemsWithCostCount++;

          const lineRev = it.lineTotal;
          const lineProfit = lineRev - lineCost;
          profitByProduct[it.productName] = (profitByProduct[it.productName] || 0) + lineProfit;
        } else {
          itemsMissingCostCount++;
        }
      });
    });

    const hasCostData = itemsWithCostCount > 0;
    const estimatedGrossProfit = hasCostData ? Math.max(0, totalFinalValue - totalCost) : 0;
    const grossMarginPercent = hasCostData && totalFinalValue > 0 ? Number(((estimatedGrossProfit / totalFinalValue) * 100).toFixed(1)) : null;

    const mostProfitableProduct = Object.entries(profitByProduct).sort((a, b) => b[1] - a[1])[0];

    // 9. Data Quality
    const ordersWithoutCustomerCount = orders.filter((o) => o.customerName === 'Khách không xác định').length;
    const productsWithoutImageCount = allProducts.filter((p) => !p.imageUrl).length;
    const productsWithoutPriceCount = allProducts.filter((p) => !p.unitPrice || p.unitPrice <= 0).length;
    const abnormalZeroTotalOrdersCount = orders.filter((o) => o.finalTotal === 0).length;

    // Potential duplicate customers (same phone or exact same name different id)
    const phoneMap: Record<string, number> = {};
    allCustomers.forEach((c) => {
      if (c.phone) {
        const pClean = c.phone.replace(/\D/g, '');
        if (pClean.length >= 8) {
          phoneMap[pClean] = (phoneMap[pClean] || 0) + 1;
        }
      }
    });
    const potentialDuplicateCustomersCount = Object.values(phoneMap).filter((cnt) => cnt > 1).length;

    return {
      periodLabel,
      filteredOrders: orders,
      overview: {
        totalOrders,
        ordersToday,
        ordersThisWeek,
        ordersThisMonth,
        ordersThisYear,
        totalGrossValue,
        totalDiscountAmount,
        totalFinalValue,
        totalCollected,
        totalRemaining,
        completedOrdersCount,
        pendingOrdersCount,
        completionRate,
        avgOrderValue,
        medianOrderValue,
        totalItemsSold,
        avgItemsPerOrder,
        totalKnownCustomers,
        momRevenueGrowth,
        momOrderGrowth,
      },
      customers: {
        topSpenders,
        topFrequent,
        topQuantities,
        repeatCustomersCount,
        oneTimeCustomersCount,
        repeatRate,
        firstCustomer: firstWithCust ? { name: firstWithCust.customerName, date: firstWithCust.orderDate } : null,
        latestCustomer: latestWithCust ? { name: latestWithCust.customerName, date: latestWithCust.orderDate } : null,
        avgDaysBetweenOrders: null,
        customerDiscounts,
      },
      products: {
        bestSellersByQty,
        bestSellersByRevenue,
        mostFrequentProduct,
        leastSoldProduct,
        productCombos,
        revenueShare,
      },
      ordersStats: {
        maxOrder,
        minOrder,
        orderWithMostItems,
        orderWithMostDistinctProducts,
        biggestDiscountOrder,
        anonymousCount,
        identifiedCount: totalOrders - anonymousCount,
        singleItemOrdersCount,
        multiItemOrdersCount,
        valueBins,
      },
      discounts: {
        totalDiscountAmount,
        discountedOrdersCount,
        discountedPercent,
        avgDiscountAmount,
        byMode,
        avgWithDiscount,
        avgWithoutDiscount,
      },
      timeAnalysis: {
        bestDay,
        bestMonth,
        slowestMonth,
        dayOfWeekDistribution,
        bestWeekday,
        monthlyStats,
        activeStreakDays,
        longestGapDays,
      },
      records,
      finance: {
        hasCostData,
        estimatedGrossProfit,
        grossMarginPercent,
        totalCost,
        mostProfitableProduct: mostProfitableProduct ? { productName: mostProfitableProduct[0], profit: Math.round(mostProfitableProduct[1]) } : null,
        itemsMissingCostCount,
      },
      dataQuality: {
        ordersWithoutCustomerCount,
        productsWithoutImageCount,
        productsWithoutPriceCount,
        abnormalZeroTotalOrdersCount,
        potentialDuplicateCustomersCount,
      },
    };
  }
}

export const analyticsService = new AnalyticsService();

