import { productService } from '../services/productService.ts';
import { imageService, DEFAULT_PRODUCT_PLACEHOLDER } from '../services/imageService.ts';
import type { Product, ProductType } from '../models/Product.ts';
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_BADGE_CLASSES } from '../models/Product.ts';
import { formatCurrency, escapeHtml } from '../utils/formatters.ts';
import { showConfirmModal } from '../components/ConfirmModal.ts';
import { toast } from '../components/Toast.ts';
import { icons } from '../utils/icons.ts';

export class ProductsPage {
  private container: HTMLElement;
  private searchQuery = '';
  private selectedType = 'all';
  private imageCache: Map<string, string> = new Map();

  constructor(container: HTMLElement, _onNavigate?: (page: string, param?: string) => void) {
    this.container = container;
  }

  public async render(): Promise<void> {
    const products = await productService.getAllProducts();

    // Cache image URLs
    for (const p of products) {
      if (p.imageUrl) {
        const url = await imageService.resolveImageUrl(p.imageUrl);
        this.imageCache.set(p.id, url);
      }
    }

    this.renderLayout();
    this.applyFiltersAndRenderTable();
  }

  private renderLayout(): void {
    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">
            Danh mục Bánh & Sản phẩm
          </h2>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
            Quản lý bảng giá, hình ảnh, giá vốn và trạng thái hiển thị của các loại bánh
          </p>
        </div>
        <button class="btn btn-primary" id="btn-add-product">
          ${icons.plus} <span>Thêm sản phẩm mới</span>
        </button>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="filter-bar">
        <!-- Search Input -->
        <div class="search-input-wrap">
          <span class="search-icon">${icons.search}</span>
          <input
            type="text"
            id="products-search-input"
            class="form-control"
            placeholder="Tìm theo tên bánh, mã số hoặc vị nhân..."
            value="${escapeHtml(this.searchQuery)}"
          />
        </div>

        <!-- Type Filter -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="font-size: 13px; font-weight: 600; color: var(--text-secondary); white-space: nowrap;">Loại:</label>
          <select id="products-filter-type" class="filter-select">
            <option value="all" ${this.selectedType === 'all' ? 'selected' : ''}>Tất cả loại bánh</option>
            <option value="baked" ${this.selectedType === 'baked' ? 'selected' : ''}>Bánh nướng</option>
            <option value="snowskin" ${this.selectedType === 'snowskin' ? 'selected' : ''}>Bánh dẻo</option>
            <option value="box" ${this.selectedType === 'box' ? 'selected' : ''}>Vỏ hộp / Túi quà</option>
            <option value="combo" ${this.selectedType === 'combo' ? 'selected' : ''}>Set combo</option>
          </select>
        </div>

        <button class="btn btn-secondary btn-sm" id="products-btn-reset" title="Đặt lại bộ lọc">
          ${icons.refresh} <span>Đặt lại</span>
        </button>
      </div>

      <!-- Products Table Container -->
      <div id="products-table-wrapper"></div>
    `;

    this.attachToolbarEvents();
  }

  private attachToolbarEvents(): void {
    const searchInput = this.container.querySelector('#products-search-input') as HTMLInputElement;
    const typeSelect = this.container.querySelector('#products-filter-type') as HTMLSelectElement;
    const resetBtn = this.container.querySelector('#products-btn-reset');
    const addBtn = this.container.querySelector('#btn-add-product');

    addBtn?.addEventListener('click', () => {
      this.openProductModal();
    });

    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      this.applyFiltersAndRenderTable();
    });

    typeSelect?.addEventListener('change', () => {
      this.selectedType = typeSelect.value;
      this.applyFiltersAndRenderTable();
    });

    resetBtn?.addEventListener('click', () => {
      this.searchQuery = '';
      this.selectedType = 'all';
      if (searchInput) searchInput.value = '';
      if (typeSelect) typeSelect.value = 'all';
      this.applyFiltersAndRenderTable();
    });
  }

  private applyFiltersAndRenderTable(): void {
    const tableWrapper = this.container.querySelector('#products-table-wrapper');
    if (!tableWrapper) return;

    const filtered = productService.filterProducts(this.searchQuery, this.selectedType);

    if (filtered.length === 0) {
      tableWrapper.innerHTML = `
        <div class="card empty-state">
          <div class="empty-state-icon">${icons.bakery}</div>
          <div class="empty-state-title">Chưa có loại bánh nào phù hợp</div>
          <p style="margin-bottom: 16px; font-size: 14px;">Thử thay đổi từ khóa tìm kiếm hoặc thêm sản phẩm bánh mới vào hệ thống.</p>
          <button class="btn btn-primary" id="btn-empty-add-product">
            ${icons.plus} Thêm bánh mới
          </button>
        </div>
      `;
      tableWrapper.querySelector('#btn-empty-add-product')?.addEventListener('click', () => {
        this.openProductModal();
      });
      return;
    }

    tableWrapper.innerHTML = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 50px;">Ảnh</th>
              <th style="width: 90px;">Mã</th>
              <th>Tên bánh / Sản phẩm</th>
              <th>Phân loại</th>
              <th>Trọng lượng</th>
              <th style="text-align: right; width: 130px;">Giá bán</th>
              <th style="text-align: right; width: 120px;">Giá vốn</th>
              <th style="text-align: center; width: 110px;">Hiển thị</th>
              <th style="text-align: right; width: 140px;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((p) => this.renderTableRow(p)).join('')}
          </tbody>
        </table>
      </div>
      <div style="margin-top: 12px; font-size: 13px; color: var(--text-muted); display: flex; justify-content: space-between;">
        <span>Tổng cộng: <strong>${filtered.length}</strong> sản phẩm</span>
      </div>
    `;

    this.attachTableActionEvents(tableWrapper);
  }

  private renderTableRow(p: Product): string {
    const catLabel = p.category || ((p.type && PRODUCT_TYPE_LABELS[p.type]) ? PRODUCT_TYPE_LABELS[p.type] : p.type || 'Bánh nướng');
    const typeClass = (p.type && PRODUCT_TYPE_BADGE_CLASSES[p.type]) ? PRODUCT_TYPE_BADGE_CLASSES[p.type] : 'badge-pending';
    const weightText = p.weight && p.weight > 0 ? `${p.weight}g` : '-';
    const imgUrl = this.imageCache.get(p.id) || DEFAULT_PRODUCT_PLACEHOLDER;
    const isVisible = p.isVisible !== false;

    return `
      <tr data-product-id="${escapeHtml(p.id)}">
        <td>
          <img src="${imgUrl}" alt="${escapeHtml(p.name)}" class="table-prod-thumb" loading="lazy" />
        </td>
        <td><strong style="color: var(--primary); font-family: monospace;">${escapeHtml(p.id)}</strong></td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${escapeHtml(p.name)}</div>
          ${p.description ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(p.description)}</div>` : ''}
        </td>
        <td><span class="badge ${typeClass}">${escapeHtml(catLabel)}</span></td>
        <td style="font-size: 13px; color: var(--text-secondary);">${weightText}</td>
        <td style="text-align: right;">
          <strong style="color: var(--primary); font-size: 14px;">${formatCurrency(p.unitPrice)}</strong>
        </td>
        <td style="text-align: right; font-size: 13px;">
          ${
            p.costPrice !== undefined
              ? `<span style="color: var(--text-secondary);">${formatCurrency(p.costPrice)}</span>`
              : `<span style="color: var(--text-muted); font-style: italic;">Chưa nhập</span>`
          }
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn-toggle-visibility ${isVisible ? 'visible' : 'hidden'}" data-id="${escapeHtml(p.id)}" title="${isVisible ? 'Đang hiện trên POS (Bấm để ẩn)' : 'Đang ẩn khỏi POS (Bấm để hiện)'}">
            ${isVisible ? '🟢 Hiện' : '⚪ Ẩn'}
          </button>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm btn-product-edit" data-id="${escapeHtml(p.id)}" title="Sửa bánh">
            ${icons.edit} <span>Sửa</span>
          </button>
          <button class="btn btn-secondary btn-sm btn-product-delete" data-id="${escapeHtml(p.id)}" style="margin-left: 4px; color: #dc2626;" title="Xóa bánh">
            ${icons.trash}
          </button>
        </td>
      </tr>
    `;
  }

  private attachTableActionEvents(wrapper: Element): void {
    // Visibility toggle button
    wrapper.querySelectorAll('.btn-toggle-visibility').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (!id) return;

        const prod = await productService.getProductById(id);
        if (!prod) return;

        const nextVisible = prod.isVisible === false ? true : false;
        await productService.updateProduct(id, { isVisible: nextVisible });
        toast.show('Cập nhật', `Đã ${nextVisible ? 'hiển thị' : 'ẩn'} món "${prod.name}" trên màn hình Tạo đơn.`, 'info');
        this.applyFiltersAndRenderTable();
      });
    });

    // Edit button
    wrapper.querySelectorAll('.btn-product-edit').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id) {
          const product = await productService.getProductById(id);
          if (product) {
            this.openProductModal(product);
          }
        }
      });
    });

    // Delete button
    wrapper.querySelectorAll('.btn-product-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (!id) return;

        const product = await productService.getProductById(id);
        if (!product) return;

        const confirmed = await showConfirmModal({
          title: `Xác nhận xóa sản phẩm ${product.name}`,
          message: `Bạn có chắc chắn muốn xóa "${product.name}" (Mã: ${product.id}) khỏi danh mục bánh không? Các đơn hàng cũ có bánh này vẫn được giữ nguyên.`,
          confirmText: 'Xóa bánh này',
          cancelText: 'Hủy',
          isDanger: true,
        });

        if (confirmed) {
          const success = await productService.deleteProduct(product.id);
          if (success) {
            toast.show('Đã xóa', `Đã xóa thành công sản phẩm ${product.name}`, 'success');
            this.applyFiltersAndRenderTable();
          } else {
            toast.show('Lỗi', 'Không thể xóa sản phẩm.', 'error');
          }
        }
      });
    });
  }

  /**
   * Modal to Add or Edit a Product with Local Image Picker and Dynamic Categories
   */
  private async openProductModal(existing?: Product): Promise<void> {
    const isEdit = !!existing;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const allProducts = await productService.getAllProducts();
    const categoriesSet = new Set<string>([
      'Bánh nướng',
      'Bánh dẻo',
      'Vỏ hộp / Quà tặng',
      'Bánh chay',
      'Set Combo',
    ]);
    for (const p of allProducts) {
      if (p.category && p.category.trim()) categoriesSet.add(p.category.trim());
      else if (p.type && PRODUCT_TYPE_LABELS[p.type]) categoriesSet.add(PRODUCT_TYPE_LABELS[p.type]);
    }
    const availableCategories = Array.from(categoriesSet);

    let selectedImageRef = existing?.imageUrl;
    let previewUrl = existing?.imageUrl
      ? await imageService.resolveImageUrl(existing.imageUrl)
      : await imageService.resolveImageUrl();

    const currentCategory = existing?.category || (existing?.type && PRODUCT_TYPE_LABELS[existing.type]) || 'Bánh nướng';

    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 560px;">
        <div class="modal-header">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">
              ${isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm bánh mới'}
            </div>
            <h3 class="modal-title" style="margin-top: 2px;">
              ${isEdit ? `${existing?.id} - ${existing?.name}` : 'Thêm sản phẩm vào menu'}
            </h3>
          </div>
          <button class="modal-close-btn" id="modal-product-close">✕</button>
        </div>

        <form id="product-form" novalidate>
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto;">
            
            <!-- Hidden File Input for Image Selection -->
            <input type="file" id="prod-file-input" accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml" style="display: none;" />

            <!-- Image Selector Row -->
            <div style="display: flex; gap: 16px; align-items: center; background: #faf8f5; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px;">
              <div id="prod-img-preview-wrap" style="width: 72px; height: 72px; border-radius: var(--radius-md); overflow: hidden; background: #fff; border: 2px dashed var(--border-color); flex-shrink: 0; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Bấm để chọn ảnh từ máy hoặc kéo thả ảnh vào đây">
                <img id="prod-img-preview" src="${previewUrl}" alt="Ảnh xem trước" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 13px; color: var(--text-primary);">Ảnh sản phẩm</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">Bấm chọn ảnh hoặc kéo thả trực tiếp từ máy tính.</div>
                <div style="display: flex; gap: 8px;">
                  <button type="button" class="btn btn-secondary btn-sm" id="btn-pick-prod-img">
                    📁 Chọn ảnh từ máy tính
                  </button>
                  ${
                    selectedImageRef
                      ? `<button type="button" class="btn btn-secondary btn-sm" id="btn-clear-prod-img" style="color: #dc2626;">Xóa ảnh</button>`
                      : ''
                  }
                </div>
              </div>
            </div>

            <!-- Tên bánh -->
            <div class="form-group">
              <label class="form-label" for="prod-name">Tên bánh / Sản phẩm <span class="required">*</span></label>
              <input
                type="text"
                id="prod-name"
                class="form-control"
                placeholder="Ví dụ: Thập cẩm gà quay, Đậu xanh hạt sen, Bánh dẻo lá dứa..."
                value="${existing ? escapeHtml(existing.name) : ''}"
                required
              />
              <div class="form-error" id="err-prod-name"></div>
            </div>

            <!-- Phân loại (Tự điền hoặc chọn danh mục có sẵn) -->
            <div class="form-group">
              <label class="form-label" for="prod-category">
                Phân loại / Danh mục <span class="required">*</span>
              </label>
              <input
                type="text"
                id="prod-category"
                list="prod-category-datalist"
                class="form-control"
                placeholder="Nhập hoặc chọn danh mục (tự gõ danh mục mới thoải mái)..."
                value="${escapeHtml(currentCategory)}"
                required
              />
              <datalist id="prod-category-datalist">
                ${availableCategories.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('')}
              </datalist>
              <div class="category-quick-chips" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px;">
                ${availableCategories.slice(0, 6).map((cat) => `
                  <button type="button" class="btn-cat-chip" data-val="${escapeHtml(cat)}" style="font-size: 11px; padding: 2px 8px; border-radius: 12px; border: 1px solid var(--border-color); background: #fcfbf9; cursor: pointer; color: var(--text-secondary);">
                    + ${escapeHtml(cat)}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Trọng lượng & Đơn giá bán -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label" for="prod-weight">Trọng lượng (gram)</label>
                <input
                  type="number"
                  id="prod-weight"
                  class="form-control"
                  placeholder="150, 180, 200..."
                  value="${existing?.weight !== undefined ? existing.weight : 200}"
                  min="0"
                  step="10"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="prod-price">Giá bán (VNĐ) <span class="required">*</span></label>
                <input
                  type="number"
                  id="prod-price"
                  class="form-control"
                  placeholder="Ví dụ: 85000"
                  value="${existing ? existing.unitPrice : 85000}"
                  min="0"
                  step="1000"
                  required
                />
                <div class="form-error" id="err-prod-price"></div>
              </div>
            </div>

            <!-- Giá vốn & Trạng thái hiển thị -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label" for="prod-cost">Giá vốn ước tính (VNĐ)</label>
                <input
                  type="number"
                  id="prod-cost"
                  class="form-control"
                  placeholder="Tùy chọn (để tính lãi)..."
                  value="${existing?.costPrice !== undefined ? existing.costPrice : ''}"
                  min="0"
                  step="1000"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="prod-visible">Hiển thị trên màn hình Tạo đơn</label>
                <select id="prod-visible" class="form-control">
                  <option value="true" ${!existing || existing.isVisible !== false ? 'selected' : ''}>🟢 Có (Hiển thị để chọn bán)</option>
                  <option value="false" ${existing && existing.isVisible === false ? 'selected' : ''}>⚪ Không (Tạm ẩn)</option>
                </select>
              </div>
            </div>

            <!-- Mô tả -->
            <div class="form-group">
              <label class="form-label" for="prod-desc">Mô tả nhân / Độ ngọt / Ghi chú</label>
              <input
                type="text"
                id="prod-desc"
                class="form-control"
                placeholder="Ví dụ: Ít ngọt, đậu xanh sên tay, dùng trứng vịt muối tự muối..."
                value="${existing?.description ? escapeHtml(existing.description) : ''}"
              />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="modal-product-cancel">Hủy</button>
            <button type="submit" class="btn btn-primary" id="modal-product-submit">
              ${icons.check} <span>${isEdit ? 'Lưu cập nhật' : 'Thêm vào menu'}</span>
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);

    overlay.querySelector('#modal-product-close')?.addEventListener('click', close);
    overlay.querySelector('#modal-product-cancel')?.addEventListener('click', close);

    // Quick category chips
    const categoryInput = overlay.querySelector('#prod-category') as HTMLInputElement;
    overlay.querySelectorAll('.btn-cat-chip').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const val = (e.currentTarget as HTMLElement).getAttribute('data-val');
        if (val && categoryInput) {
          categoryInput.value = val;
          categoryInput.focus();
        }
      });
    });

    // Image file selection handler
    const fileInput = overlay.querySelector('#prod-file-input') as HTMLInputElement;
    const previewEl = overlay.querySelector('#prod-img-preview') as HTMLImageElement;
    const previewWrap = overlay.querySelector('#prod-img-preview-wrap') as HTMLElement;

    const handleFile = async (file: File) => {
      try {
        const optimized = await imageService.optimizeAndConvertFile(file, 600);
        selectedImageRef = optimized;
        if (previewEl) previewEl.src = optimized;
        toast.show('Thành công', 'Đã tải ảnh lên thành công.', 'success');
      } catch (err) {
        toast.show('Lỗi', String(err instanceof Error ? err.message : err), 'error');
      }
    };

    overlay.querySelector('#btn-pick-prod-img')?.addEventListener('click', () => {
      fileInput.click();
    });

    previewWrap?.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) handleFile(file);
    });

    // Drag and drop image
    previewWrap?.addEventListener('dragover', (e: Event) => {
      e.preventDefault();
      if (previewWrap) previewWrap.style.borderColor = 'var(--primary)';
    });

    previewWrap?.addEventListener('dragleave', () => {
      if (previewWrap) previewWrap.style.borderColor = 'var(--border-color)';
    });

    previewWrap?.addEventListener('drop', (e: Event) => {
      e.preventDefault();
      if (previewWrap) previewWrap.style.borderColor = 'var(--border-color)';
      const dragEvt = e as DragEvent;
      const file = dragEvt.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        handleFile(file);
      }
    });

    // Clear image
    overlay.querySelector('#btn-clear-prod-img')?.addEventListener('click', async () => {
      selectedImageRef = undefined;
      const placeholder = await imageService.resolveImageUrl();
      if (previewEl) previewEl.src = placeholder;
    });

    const form = overlay.querySelector('#product-form') as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameInput = form.querySelector('#prod-name') as HTMLInputElement;
      const weightInput = form.querySelector('#prod-weight') as HTMLInputElement;
      const priceInput = form.querySelector('#prod-price') as HTMLInputElement;
      const costInput = form.querySelector('#prod-cost') as HTMLInputElement;
      const visibleInput = form.querySelector('#prod-visible') as HTMLSelectElement;
      const descInput = form.querySelector('#prod-desc') as HTMLInputElement;

      const name = nameInput.value.trim();
      const unitPrice = Number(priceInput.value);
      const category = categoryInput.value.trim() || 'Bánh nướng';

      if (!name) {
        const err = form.querySelector('#err-prod-name') as HTMLElement;
        if (err) err.textContent = 'Vui lòng nhập tên sản phẩm.';
        return;
      }

      if (isNaN(unitPrice) || unitPrice < 0) {
        const err = form.querySelector('#err-prod-price') as HTMLElement;
        if (err) err.textContent = 'Đơn giá không hợp lệ.';
        return;
      }

      // Infer product type for backward compatibility
      let derivedType: ProductType = 'baked';
      const catLower = category.toLowerCase();
      if (catLower.includes('dẻo')) derivedType = 'snowskin';
      else if (catLower.includes('hộp') || catLower.includes('túi') || catLower.includes('quà')) derivedType = 'box';
      else if (catLower.includes('combo') || catLower.includes('set')) derivedType = 'combo';

      const costPriceVal = costInput.value.trim() !== '' ? Math.max(0, Number(costInput.value)) : undefined;

      try {
        if (isEdit && existing) {
          await productService.updateProduct(existing.id, {
            name,
            category,
            type: derivedType,
            weight: Number(weightInput.value) || 0,
            unitPrice,
            costPrice: costPriceVal,
            imageUrl: selectedImageRef,
            isVisible: visibleInput.value === 'true',
            description: descInput.value.trim() || undefined,
          });
          toast.show('Thành công', `Đã cập nhật bánh ${existing.id}`, 'success');
        } else {
          const created = await productService.addProduct({
            name,
            category,
            type: derivedType,
            weight: Number(weightInput.value) || 0,
            unitPrice,
            costPrice: costPriceVal,
            imageUrl: selectedImageRef,
            isVisible: visibleInput.value === 'true',
            description: descInput.value.trim() || undefined,
          });
          toast.show('Thành công', `Đã thêm món "${created.name}" (Mã: ${created.id})`, 'success');
        }

        close();
        await this.render();
      } catch (err) {
        toast.show('Lỗi', err instanceof Error ? err.message : String(err), 'error');
      }
    });
  }
}
