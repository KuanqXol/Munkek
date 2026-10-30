import { productService } from '../services/productService.ts';
import { orderService } from '../services/orderService.ts';
import { customerService } from '../services/customerService.ts';
import { imageService, DEFAULT_PRODUCT_PLACEHOLDER } from '../services/imageService.ts';
import type { Product } from '../models/Product.ts';
import type { OrderItem, DiscountType } from '../models/Order.ts';
import type { Customer } from '../models/Customer.ts';
import { formatCurrency, escapeHtml, removeVietnameseTones } from '../utils/formatters.ts';
import { icons } from '../utils/icons.ts';
import { toast } from '../components/Toast.ts';

export class MainPosPage {
  private container: HTMLElement;
  private onNavigate: (page: string, param?: string) => void;

  private products: Product[] = [];
  private resolvedImages: Map<string, string> = new Map();

  // Cart state: map of productId -> quantity
  private cart: Map<string, number> = new Map();

  // Filtering state
  private searchQuery = '';
  private selectedCategory = 'all';

  // Discount state
  private discountType: DiscountType = 'none';
  private discountValue = 0;

  // Optional customer state
  private customerName = '';
  private customerPhone = '';
  private customerAddress = '';
  private orderNote = '';
  private selectedCustomerId?: string;

  // UI state
  private isSubmitting = false;
  private showCustomerDetails = false;

  constructor(
    container: HTMLElement,
    onNavigate: (page: string, param?: string) => void,
    initialCustomerName?: string
  ) {
    this.container = container;
    this.onNavigate = onNavigate;
    if (initialCustomerName) {
      this.customerName = initialCustomerName.trim();
      this.showCustomerDetails = true;
    }
  }

  public async render(): Promise<void> {
    this.products = await productService.getVisibleProducts();

    if (this.customerName && !this.customerPhone) {
      const customers = await customerService.getAllCustomers();
      const found = customers.find((c) => c.name.toLowerCase() === this.customerName.toLowerCase());
      if (found) {
        this.customerPhone = found.phone || '';
        this.customerAddress = found.address || '';
        this.selectedCustomerId = found.id;
      }
    }

    // Pre-resolve product images
    for (const p of this.products) {
      if (p.imageUrl) {
        const url = await imageService.resolveImageUrl(p.imageUrl);
        this.resolvedImages.set(p.id, url);
      }
    }

    this.renderLayout();
    this.renderProductsGrid();
    this.updateSummaryPanel();
  }

  private renderLayout(): void {
    const categories = this.extractCategories();

    this.container.innerHTML = `
      <div class="pos-layout">
        <!-- Left: Product Selection Area -->
        <section class="pos-products-section">
          <!-- Filter Toolbar -->
          <div class="pos-toolbar">
            <div style="display: flex; gap: 10px; align-items: center;">
              <div class="search-input-wrap pos-search" style="flex: 1;">
                <span class="search-icon">${icons.search}</span>
                <input
                  type="text"
                  id="pos-search-input"
                  class="form-control"
                  placeholder="Tìm bánh theo tên, vị nhân, mã số (gõ không dấu)..."
                  value="${escapeHtml(this.searchQuery)}"
                  autocomplete="off"
                />
                ${
                  this.searchQuery
                    ? `<button class="btn-clear-search" id="pos-btn-clear-search" title="Xóa tìm kiếm">✕</button>`
                    : ''
                }
              </div>
              <button class="btn btn-secondary btn-sm" id="pos-view-history-btn" title="Xem danh sách đơn hàng đã tạo">
                ${icons.orders} <span>Lịch sử đơn</span>
              </button>
            </div>

            <!-- Category Pills -->
            <div class="pos-category-pills">
              <button class="pos-cat-pill ${this.selectedCategory === 'all' ? 'active' : ''}" data-cat="all">
                Tất cả (${this.products.length})
              </button>
              ${categories
                .map(
                  (cat) => `
                <button class="pos-cat-pill ${this.selectedCategory === cat.key ? 'active' : ''}" data-cat="${escapeHtml(cat.key)}">
                  ${escapeHtml(cat.label)} (${cat.count})
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- Product Grid -->
          <div class="pos-grid-container" id="pos-grid-container">
            <!-- Rendered by renderProductsGrid() -->
          </div>
        </section>

        <!-- Right: Order Summary Panel -->
        <aside class="pos-summary-panel">
          <div class="pos-summary-header">
            <div class="pos-summary-title">
              <h3>Đơn hàng đang tạo</h3>
              <span class="pos-total-items-badge" id="pos-total-items-badge">0 món</span>
            </div>
            <button class="btn btn-secondary btn-sm" id="pos-btn-reset-cart" title="Đặt lại đơn hàng">
              ${icons.refresh} <span>Xóa giỏ</span>
            </button>
          </div>

          <!-- Cart Items Scrollable List -->
          <div class="pos-cart-items" id="pos-cart-items">
            <!-- Rendered by updateSummaryPanel() -->
          </div>

          <!-- Order Summary & Calculations -->
          <div class="pos-summary-footer">
            <!-- Subtotal Row -->
            <div class="pos-price-row">
              <span class="label">Tạm tính:</span>
              <span class="value" id="pos-subtotal-val">0đ</span>
            </div>

            <!-- Discount Section -->
            <div class="pos-discount-box">
              <div class="pos-discount-tabs">
                <button type="button" class="discount-tab-btn ${this.discountType === 'none' ? 'active' : ''}" data-type="none">
                  Không giảm
                </button>
                <button type="button" class="discount-tab-btn ${this.discountType === 'percent' ? 'active' : ''}" data-type="percent">
                  Giảm %
                </button>
                <button type="button" class="discount-tab-btn ${this.discountType === 'amount' ? 'active' : ''}" data-type="amount">
                  Giảm tiền
                </button>
                <button type="button" class="discount-tab-btn ${this.discountType === 'target_total' ? 'active' : ''}" data-type="target_total">
                  Giảm còn
                </button>
              </div>

              <div id="pos-discount-input-area" class="pos-discount-input-area" style="${this.discountType === 'none' ? 'display: none;' : ''}">
                <div class="pos-discount-field-row">
                  <input
                    type="number"
                    id="pos-discount-input"
                    class="form-control pos-discount-input"
                    placeholder="${this.getDiscountPlaceholder()}"
                    value="${this.discountValue > 0 ? this.discountValue : ''}"
                    min="0"
                  />
                  <span class="pos-discount-unit" id="pos-discount-unit">${this.getDiscountUnit()}</span>
                </div>
                <!-- Quick discount chips -->
                <div class="pos-quick-discount-chips" id="pos-quick-chips">
                  ${this.renderQuickDiscountChips()}
                </div>
              </div>

              <div class="pos-price-row discount-row" id="pos-discount-applied-row" style="${this.discountType === 'none' ? 'display: none;' : ''}">
                <span class="label">Đã giảm:</span>
                <span class="value text-danger" id="pos-discount-amount-val">-0đ</span>
              </div>
            </div>

            <!-- Final Total -->
            <div class="pos-final-total-row">
              <div>
                <div class="total-label">Tổng thanh toán</div>
                <div class="total-subtext" id="pos-savings-subtext"></div>
              </div>
              <div class="total-amount" id="pos-final-total-val">0đ</div>
            </div>

            <!-- Optional Customer Info Toggle -->
            <div class="pos-customer-section">
              <button type="button" class="pos-customer-toggle-btn" id="pos-btn-toggle-customer">
                <span>${icons.customer} Thông tin khách hàng ${this.customerName ? `(<strong>${escapeHtml(this.customerName)}</strong>)` : '(Tùy chọn)'}</span>
                <span class="arrow-icon" id="pos-customer-arrow">${this.showCustomerDetails ? '▲' : '▼'}</span>
              </button>

              <div class="pos-customer-form" id="pos-customer-form" style="${this.showCustomerDetails ? 'display: block;' : 'display: none;'}">
                <div class="autocomplete-wrap" style="position: relative;">
                  <input
                    type="text"
                    id="pos-input-customer-name"
                    class="form-control form-control-sm"
                    placeholder="Tên khách hàng (tìm khách cũ)..."
                    value="${escapeHtml(this.customerName)}"
                    autocomplete="off"
                  />
                  <div class="autocomplete-dropdown" id="pos-customer-dropdown" style="display: none;"></div>
                </div>

                <div style="display: flex; gap: 8px; margin-top: 8px;">
                  <input
                    type="text"
                    id="pos-input-customer-phone"
                    class="form-control form-control-sm"
                    placeholder="Số điện thoại..."
                    value="${escapeHtml(this.customerPhone)}"
                    style="flex: 1;"
                  />
                  <input
                    type="text"
                    id="pos-input-customer-address"
                    class="form-control form-control-sm"
                    placeholder="Địa chỉ..."
                    value="${escapeHtml(this.customerAddress)}"
                    style="flex: 1.2;"
                  />
                </div>

                <div style="margin-top: 8px;">
                  <input
                    type="text"
                    id="pos-input-order-note"
                    class="form-control form-control-sm"
                    placeholder="Ghi chú đơn hàng (nếu có)..."
                    value="${escapeHtml(this.orderNote)}"
                  />
                </div>
              </div>
            </div>

            <!-- Big Submit Button -->
            <div class="pos-action-btn-wrap">
              <button class="btn btn-primary btn-pos-create" id="pos-btn-create-order" disabled>
                ${icons.check} <span>TẠO ĐƠN HÀNG</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
    `;

    this.attachEvents();
  }

  private extractCategories(): Array<{ key: string; label: string; count: number }> {
    const map = new Map<string, number>();
    for (const p of this.products) {
      const cat = p.category || (p.type === 'box' ? 'Vỏ hộp / Túi quà' : p.type === 'snowskin' ? 'Bánh dẻo' : 'Bánh nướng');
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries()).map(([label, count]) => ({
      key: label,
      label,
      count,
    }));
  }

  private renderProductsGrid(): void {
    const gridContainer = this.container.querySelector('#pos-grid-container');
    if (!gridContainer) return;

    const filtered = this.getFilteredProducts();

    if (filtered.length === 0) {
      gridContainer.innerHTML = `
        <div class="empty-state card" style="grid-column: 1 / -1; margin: 40px auto; max-width: 450px;">
          <div class="empty-state-icon">${icons.bakery}</div>
          <div class="empty-state-title">Không tìm thấy bánh phù hợp</div>
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
            Thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục "Tất cả".
          </p>
          <button class="btn btn-secondary btn-sm" id="pos-empty-btn-reset">
            Xem tất cả bánh
          </button>
        </div>
      `;
      gridContainer.querySelector('#pos-empty-btn-reset')?.addEventListener('click', () => {
        this.searchQuery = '';
        this.selectedCategory = 'all';
        this.render();
      });
      return;
    }

    gridContainer.innerHTML = filtered
      .map((p) => {
        const qty = this.cart.get(p.id) || 0;
        const isSelected = qty > 0;
        const imgUrl = this.resolvedImages.get(p.id) || DEFAULT_PRODUCT_PLACEHOLDER;

        return `
          <div class="pos-product-card ${isSelected ? 'selected' : ''}" data-product-id="${escapeHtml(p.id)}">
            <div class="pos-card-img-wrap">
              <img src="${imgUrl}" alt="${escapeHtml(p.name)}" class="pos-card-img" loading="lazy" />
              ${
                p.category || p.type
                  ? `<span class="pos-card-badge">${escapeHtml(p.category || (p.type === 'box' ? 'Hộp quà' : 'Bánh'))}</span>`
                  : ''
              }
            </div>

            <div class="pos-card-body">
              <h4 class="pos-card-title" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h4>
              <div class="pos-card-meta">
                ${p.weight ? `<span>${p.weight}g</span>` : ''}
              </div>
              <div class="pos-card-price">${formatCurrency(p.unitPrice)}</div>
            </div>

            <div class="pos-card-stepper" onclick="event.stopPropagation();">
              <button
                type="button"
                class="stepper-btn btn-dec"
                data-id="${escapeHtml(p.id)}"
                ${qty === 0 ? 'disabled' : ''}
                aria-label="Giảm"
              >
                −
              </button>
              <span class="stepper-count ${qty > 0 ? 'active' : ''}">${qty}</span>
              <button
                type="button"
                class="stepper-btn btn-inc"
                data-id="${escapeHtml(p.id)}"
                aria-label="Tăng"
              >
                +
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    // Attach card click & stepper events
    gridContainer.querySelectorAll('.pos-product-card').forEach((card) => {
      const id = card.getAttribute('data-product-id');
      if (!id) return;

      // Clicking anywhere on card body or image increments quantity by 1
      card.addEventListener('click', () => {
        this.incrementProduct(id);
      });
    });

    gridContainer.querySelectorAll('.btn-inc').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-id');
        if (id) this.incrementProduct(id);
      });
    });

    gridContainer.querySelectorAll('.btn-dec').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-id');
        if (id) this.decrementProduct(id);
      });
    });
  }

  private getFilteredProducts(): Product[] {
    let list = this.products;

    if (this.selectedCategory !== 'all') {
      list = list.filter((p) => {
        const cat = p.category || (p.type === 'box' ? 'Vỏ hộp / Túi quà' : p.type === 'snowskin' ? 'Bánh dẻo' : 'Bánh nướng');
        return cat === this.selectedCategory;
      });
    }

    if (this.searchQuery.trim()) {
      const clean = removeVietnameseTones(this.searchQuery.trim());
      list = list.filter((p) => {
        const nameClean = removeVietnameseTones(p.name);
        const idClean = p.id.toLowerCase();
        return nameClean.includes(clean) || idClean.includes(clean);
      });
    }

    return list;
  }

  private incrementProduct(productId: string): void {
    const current = this.cart.get(productId) || 0;
    this.cart.set(productId, current + 1);
    this.updateCardUi(productId);
    this.updateSummaryPanel();
  }

  private decrementProduct(productId: string): void {
    const current = this.cart.get(productId) || 0;
    if (current <= 1) {
      this.cart.delete(productId);
    } else {
      this.cart.set(productId, current - 1);
    }
    this.updateCardUi(productId);
    this.updateSummaryPanel();
  }

  private setProductQuantity(productId: string, qty: number): void {
    if (qty <= 0) {
      this.cart.delete(productId);
    } else {
      this.cart.set(productId, qty);
    }
    this.updateCardUi(productId);
    this.updateSummaryPanel();
  }

  private updateCardUi(productId: string): void {
    const card = this.container.querySelector(`.pos-product-card[data-product-id="${productId}"]`);
    if (!card) return;

    const qty = this.cart.get(productId) || 0;
    const isSelected = qty > 0;

    if (isSelected) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }

    const countEl = card.querySelector('.stepper-count');
    if (countEl) {
      countEl.textContent = String(qty);
      if (qty > 0) countEl.classList.add('active');
      else countEl.classList.remove('active');
    }

    const decBtn = card.querySelector('.btn-dec') as HTMLButtonElement;
    if (decBtn) {
      decBtn.disabled = qty === 0;
    }
  }

  private updateSummaryPanel(): void {
    const cartItemsEl = this.container.querySelector('#pos-cart-items');
    const badgeEl = this.container.querySelector('#pos-total-items-badge');
    const subtotalEl = this.container.querySelector('#pos-subtotal-val');
    const discountAmountEl = this.container.querySelector('#pos-discount-amount-val');
    const finalTotalEl = this.container.querySelector('#pos-final-total-val');
    const savingsEl = this.container.querySelector('#pos-savings-subtext') as HTMLElement | null;
    const createBtn = this.container.querySelector('#pos-btn-create-order') as HTMLButtonElement;
    const discountAppliedRow = this.container.querySelector('#pos-discount-applied-row') as HTMLElement;

    const items: Array<{ product: Product; quantity: number }> = [];
    let totalCakes = 0;
    let subtotal = 0;

    for (const [pId, qty] of this.cart.entries()) {
      const prod = this.products.find((p) => p.id === pId);
      if (prod && qty > 0) {
        items.push({ product: prod, quantity: qty });
        totalCakes += qty;
        subtotal += prod.unitPrice * qty;
      }
    }

    if (badgeEl) {
      badgeEl.textContent = `${totalCakes} bánh`;
    }

    // Render cart item rows
    if (cartItemsEl) {
      if (items.length === 0) {
        cartItemsEl.innerHTML = `
          <div class="pos-cart-empty">
            <div style="font-size: 28px; margin-bottom: 6px; opacity: 0.6;">🛒</div>
            <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">Giỏ hàng trống</div>
            <div style="font-size: 12px; color: var(--text-muted);">
              Nhấn <strong>[+]</strong> trên thẻ bánh để thêm vào đơn
            </div>
          </div>
        `;
      } else {
        cartItemsEl.innerHTML = items
          .map(({ product, quantity }) => {
            const lineTotal = product.unitPrice * quantity;
            return `
              <div class="pos-cart-row" data-cart-id="${escapeHtml(product.id)}">
                <div class="pos-cart-row-info">
                  <div class="pos-cart-row-name" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</div>
                  <div class="pos-cart-row-price">${formatCurrency(product.unitPrice)}/c</div>
                </div>

                <div class="pos-cart-row-stepper">
                  <button type="button" class="btn-cart-dec" data-id="${escapeHtml(product.id)}">−</button>
                  <span class="cart-qty">${quantity}</span>
                  <button type="button" class="btn-cart-inc" data-id="${escapeHtml(product.id)}">+</button>
                </div>

                <div class="pos-cart-row-total">
                  ${formatCurrency(lineTotal)}
                </div>

                <button type="button" class="btn-cart-del" data-id="${escapeHtml(product.id)}" title="Xóa món này">
                  ✕
                </button>
              </div>
            `;
          })
          .join('');

        // Attach cart row events
        cartItemsEl.querySelectorAll('.btn-cart-inc').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = (btn as HTMLElement).getAttribute('data-id');
            if (id) this.incrementProduct(id);
          });
        });

        cartItemsEl.querySelectorAll('.btn-cart-dec').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = (btn as HTMLElement).getAttribute('data-id');
            if (id) this.decrementProduct(id);
          });
        });

        cartItemsEl.querySelectorAll('.btn-cart-del').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = (btn as HTMLElement).getAttribute('data-id');
            if (id) this.setProductQuantity(id, 0);
          });
        });
      }
    }

    // Calculate discount & final total
    let discountAmount = 0;
    let finalTotal = subtotal;

    if (this.discountType === 'percent') {
      const pct = Math.min(100, Math.max(0, this.discountValue));
      discountAmount = Math.round((subtotal * pct) / 100);
      finalTotal = Math.max(0, subtotal - discountAmount);
    } else if (this.discountType === 'amount') {
      discountAmount = Math.min(subtotal, Math.max(0, this.discountValue));
      finalTotal = Math.max(0, subtotal - discountAmount);
    } else if (this.discountType === 'target_total') {
      if (this.discountValue > 0 && this.discountValue < subtotal) {
        discountAmount = subtotal - this.discountValue;
        finalTotal = this.discountValue;
      } else {
        discountAmount = 0;
        finalTotal = subtotal;
      }
    }

    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (finalTotalEl) finalTotalEl.textContent = formatCurrency(finalTotal);

    if (discountAmountEl) {
      discountAmountEl.textContent = `-${formatCurrency(discountAmount)}`;
    }

    if (discountAppliedRow) {
      if (this.discountType !== 'none' && discountAmount > 0) {
        discountAppliedRow.style.display = 'flex';
      } else {
        discountAppliedRow.style.display = 'none';
      }
    }

    if (savingsEl) {
      if (discountAmount > 0) {
        savingsEl.textContent = `Tiết kiệm: ${formatCurrency(discountAmount)}`;
        savingsEl.style.display = 'block';
      } else {
        savingsEl.style.display = 'none';
      }
    }

    if (createBtn) {
      createBtn.disabled = items.length === 0 || this.isSubmitting;
    }
  }

  private renderQuickDiscountChips(): string {
    if (this.discountType === 'percent') {
      return `
        <button type="button" class="quick-chip" data-val="5">5%</button>
        <button type="button" class="quick-chip" data-val="10">10%</button>
        <button type="button" class="quick-chip" data-val="15">15%</button>
        <button type="button" class="quick-chip" data-val="20">20%</button>
      `;
    }
    if (this.discountType === 'amount') {
      return `
        <button type="button" class="quick-chip" data-val="10000">10k</button>
        <button type="button" class="quick-chip" data-val="20000">20k</button>
        <button type="button" class="quick-chip" data-val="50000">50k</button>
        <button type="button" class="quick-chip" data-val="100000">100k</button>
      `;
    }
    if (this.discountType === 'target_total') {
      return `
        <span style="font-size: 11px; color: var(--text-muted);">Nhập số tiền chẵn khách cần trả</span>
      `;
    }
    return '';
  }

  private getDiscountPlaceholder(): string {
    if (this.discountType === 'percent') return 'Ví dụ: 10';
    if (this.discountType === 'amount') return 'Ví dụ: 50000';
    if (this.discountType === 'target_total') return 'Ví dụ: 300000';
    return '';
  }

  private getDiscountUnit(): string {
    if (this.discountType === 'percent') return '%';
    if (this.discountType === 'amount') return 'đ';
    if (this.discountType === 'target_total') return 'đ';
    return '';
  }

  private attachEvents(): void {
    // Search input
    const searchInput = this.container.querySelector('#pos-search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      const clearBtn = this.container.querySelector('#pos-btn-clear-search');
      if (clearBtn) {
        (clearBtn as HTMLElement).style.display = this.searchQuery ? 'block' : 'none';
      }
      this.renderProductsGrid();
    });

    this.container.querySelector('#pos-btn-clear-search')?.addEventListener('click', () => {
      this.searchQuery = '';
      if (searchInput) searchInput.value = '';
      this.renderProductsGrid();
    });

    this.container.querySelector('#pos-view-history-btn')?.addEventListener('click', () => {
      this.onNavigate('orders');
    });

    // Category pills
    this.container.querySelectorAll('.pos-cat-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const cat = (e.currentTarget as HTMLElement).getAttribute('data-cat') || 'all';
        this.selectedCategory = cat;

        this.container.querySelectorAll('.pos-cat-pill').forEach((p) => p.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');

        this.renderProductsGrid();
      });
    });

    // Reset cart button
    this.container.querySelector('#pos-btn-reset-cart')?.addEventListener('click', () => {
      if (this.cart.size === 0) return;
      this.cart.clear();
      this.discountType = 'none';
      this.discountValue = 0;
      this.renderProductsGrid();
      this.updateSummaryPanel();
      toast.show('Thông báo', 'Đã xóa trắng giỏ hàng.', 'info');
    });

    // Discount mode tabs
    this.container.querySelectorAll('.discount-tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const type = (e.currentTarget as HTMLElement).getAttribute('data-type') as DiscountType;
        if (!type) return;

        this.discountType = type;
        this.discountValue = 0;

        this.container.querySelectorAll('.discount-tab-btn').forEach((b) => b.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');

        const inputArea = this.container.querySelector('#pos-discount-input-area') as HTMLElement;
        const input = this.container.querySelector('#pos-discount-input') as HTMLInputElement;
        const unit = this.container.querySelector('#pos-discount-unit');
        const chipsArea = this.container.querySelector('#pos-quick-chips');

        if (type === 'none') {
          if (inputArea) inputArea.style.display = 'none';
        } else {
          if (inputArea) inputArea.style.display = 'block';
          if (input) {
            input.value = '';
            input.placeholder = this.getDiscountPlaceholder();
            input.focus();
          }
          if (unit) unit.textContent = this.getDiscountUnit();
          if (chipsArea) {
            chipsArea.innerHTML = this.renderQuickDiscountChips();
            this.attachChipEvents();
          }
        }

        this.updateSummaryPanel();
      });
    });

    // Discount input change
    const discountInput = this.container.querySelector('#pos-discount-input') as HTMLInputElement;
    discountInput?.addEventListener('input', () => {
      this.discountValue = Math.max(0, Number(discountInput.value) || 0);
      this.updateSummaryPanel();
    });

    this.attachChipEvents();

    // Customer form toggle
    const toggleCustomerBtn = this.container.querySelector('#pos-btn-toggle-customer');
    const customerForm = this.container.querySelector('#pos-customer-form') as HTMLElement;
    const customerArrow = this.container.querySelector('#pos-customer-arrow');

    toggleCustomerBtn?.addEventListener('click', () => {
      this.showCustomerDetails = !this.showCustomerDetails;
      if (customerForm) {
        customerForm.style.display = this.showCustomerDetails ? 'block' : 'none';
      }
      if (customerArrow) {
        customerArrow.textContent = this.showCustomerDetails ? '▲' : '▼';
      }
    });

    // Customer name autocomplete
    const nameInput = this.container.querySelector('#pos-input-customer-name') as HTMLInputElement;
    const phoneInput = this.container.querySelector('#pos-input-customer-phone') as HTMLInputElement;
    const addressInput = this.container.querySelector('#pos-input-customer-address') as HTMLInputElement;
    const noteInput = this.container.querySelector('#pos-input-order-note') as HTMLInputElement;
    const dropdown = this.container.querySelector('#pos-customer-dropdown') as HTMLElement;

    nameInput?.addEventListener('input', () => {
      this.customerName = nameInput.value;
      this.selectedCustomerId = undefined;
      const suggestions = customerService.searchCustomers(this.customerName, 5);
      this.renderCustomerAutocomplete(suggestions, dropdown, phoneInput, addressInput);
    });

    nameInput?.addEventListener('focus', () => {
      if (this.customerName.trim()) {
        const suggestions = customerService.searchCustomers(this.customerName, 5);
        this.renderCustomerAutocomplete(suggestions, dropdown, phoneInput, addressInput);
      }
    });

    phoneInput?.addEventListener('input', () => {
      this.customerPhone = phoneInput.value;
      if (!this.customerName) {
        const suggestions = customerService.searchCustomers(this.customerPhone, 5);
        this.renderCustomerAutocomplete(suggestions, dropdown, phoneInput, addressInput);
      }
    });

    addressInput?.addEventListener('input', () => {
      this.customerAddress = addressInput.value;
    });

    noteInput?.addEventListener('input', () => {
      this.orderNote = noteInput.value;
    });

    // Close autocomplete on click outside
    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target as Node) && e.target !== nameInput && e.target !== phoneInput) {
        dropdown.style.display = 'none';
      }
    });

    // Create Order button
    const createBtn = this.container.querySelector('#pos-btn-create-order');
    createBtn?.addEventListener('click', () => {
      this.handleCreateOrder();
    });
  }

  private attachChipEvents(): void {
    const chipsArea = this.container.querySelector('#pos-quick-chips');
    if (!chipsArea) return;

    chipsArea.querySelectorAll('.quick-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = Number((chip as HTMLElement).getAttribute('data-val')) || 0;
        this.discountValue = val;
        const discountInput = this.container.querySelector('#pos-discount-input') as HTMLInputElement;
        if (discountInput) discountInput.value = String(val);
        this.updateSummaryPanel();
      });
    });
  }

  private renderCustomerAutocomplete(
    suggestions: Customer[],
    dropdown: HTMLElement,
    phoneInput: HTMLInputElement,
    addressInput: HTMLInputElement
  ): void {
    if (!dropdown) return;

    if (suggestions.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    dropdown.innerHTML = suggestions
      .map(
        (c) => `
        <div class="autocomplete-item" data-id="${escapeHtml(c.id)}">
          <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(c.name)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">
            ${c.phone ? `SĐT: ${escapeHtml(c.phone)}` : ''}
            ${c.address ? ` • Đ/c: ${escapeHtml(c.address)}` : ''}
          </div>
        </div>
      `
      )
      .join('');

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.autocomplete-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        const cust = suggestions.find((c) => c.id === id);
        if (cust) {
          this.selectedCustomerId = cust.id;
          this.customerName = cust.name;
          this.customerPhone = cust.phone || '';
          this.customerAddress = cust.address || '';

          const nameInput = this.container.querySelector('#pos-input-customer-name') as HTMLInputElement;
          if (nameInput) nameInput.value = cust.name;
          if (phoneInput) phoneInput.value = cust.phone || '';
          if (addressInput) addressInput.value = cust.address || '';

          dropdown.style.display = 'none';
          toast.show('Khách quen', `Đã chọn khách hàng: ${cust.name}`, 'info');
        }
      });
    });
  }

  private async handleCreateOrder(): Promise<void> {
    if (this.isSubmitting) return;

    // Build order items
    const orderItems: OrderItem[] = [];
    for (const [pId, qty] of this.cart.entries()) {
      const prod = this.products.find((p) => p.id === pId);
      if (prod && qty > 0) {
        orderItems.push({
          productId: prod.id,
          productName: prod.name,
          quantity: qty,
          unitPrice: prod.unitPrice,
          lineTotal: prod.unitPrice * qty,
          costPrice: prod.costPrice,
        });
      }
    }

    if (orderItems.length === 0) {
      toast.show('Chưa chọn bánh', 'Vui lòng chọn ít nhất một sản phẩm bánh.', 'warning');
      return;
    }

    try {
      this.isSubmitting = true;
      const createBtn = this.container.querySelector('#pos-btn-create-order') as HTMLButtonElement;
      if (createBtn) {
        createBtn.disabled = true;
        createBtn.innerHTML = `<span>⏳ Đang ghi nhận...</span>`;
      }

      const newOrder = await orderService.addOrder({
        items: orderItems,
        discountType: this.discountType,
        discountValue: this.discountValue,
        customerName: this.customerName.trim() || undefined,
        phone: this.customerPhone.trim() || undefined,
        address: this.customerAddress.trim() || undefined,
        customer: this.customerName.trim()
          ? {
              id: this.selectedCustomerId,
              name: this.customerName.trim(),
              phone: this.customerPhone.trim() || undefined,
              address: this.customerAddress.trim() || undefined,
            }
          : undefined,
        note: this.orderNote.trim() || undefined,
      });

      // Show success toast with view link
      toast.show(
        'Tạo đơn thành công!',
        `Đơn ${newOrder.id} • ${formatCurrency(newOrder.finalTotal || newOrder.total)} đã được ghi nhận.`,
        'success'
      );

      // Reset cart and form
      this.cart.clear();
      this.discountType = 'none';
      this.discountValue = 0;
      this.customerName = '';
      this.customerPhone = '';
      this.customerAddress = '';
      this.orderNote = '';
      this.selectedCustomerId = undefined;
      this.showCustomerDetails = false;

      // Re-render UI
      this.render();
    } catch (err) {
      console.error('Lỗi khi tạo đơn hàng:', err);
      toast.show('Lỗi', `Không thể tạo đơn hàng: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      this.isSubmitting = false;
    }
  }
}
