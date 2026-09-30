import { productService } from '../services/productService';
import { Product, ProductType, PRODUCT_TYPE_LABELS, PRODUCT_TYPE_BADGE_CLASSES } from '../models/Product';
import { formatCurrency } from '../utils/formatters';
import { showConfirmModal } from '../components/ConfirmModal';
import { toast } from '../components/Toast';
import { validateProductForm, ProductFormData } from '../utils/validators';

export class ProductsPage {
  private container: HTMLElement;
  private searchQuery = '';
  private selectedType = 'all';

  constructor(container: HTMLElement, _onNavigate?: (page: string, param?: string) => void) {
    this.container = container;
  }

  public async render(): Promise<void> {
    await productService.getAllProducts();
    this.renderLayout();
    this.applyFiltersAndRenderTable();
  }

  private renderLayout(): void {
    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h2 style="font-size: 24px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.5px;">Danh mục Bánh Trung Thu</h2>
          <p style="font-size: 14px; color: var(--text-muted); margin-top: 2px;">Quản lý các loại bánh, vị nhân, trọng lượng, số trứng và bảng giá</p>
        </div>
        <button class="btn btn-primary btn-lg" id="btn-add-product">
          <span style="font-size: 18px;">➕</span> Thêm bánh mới
        </button>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="filter-bar">
        <!-- Search Input -->
        <div class="search-input-wrap">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            id="products-search-input"
            class="form-control"
            placeholder="Tìm theo tên bánh, mã số hoặc vị nhân..."
            value="${this.searchQuery}"
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
          <span>🔄</span> Đặt lại
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
      searchInput.value = '';
      typeSelect.value = 'all';
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
          <div class="empty-state-icon">🥮</div>
          <div class="empty-state-title">Chưa có loại bánh nào phù hợp</div>
          <p style="margin-bottom: 16px;">Thử thay đổi từ khóa tìm kiếm hoặc thêm sản phẩm bánh mới vào hệ thống.</p>
          <button class="btn btn-primary" id="btn-empty-add-product">
            ➕ Thêm bánh mới
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
              <th>Mã</th>
              <th>Tên bánh / Sản phẩm</th>
              <th>Phân loại</th>
              <th>Quy cách</th>
              <th>Số trứng</th>
              <th>Đơn giá niêm yết</th>
              <th>Trạng thái</th>
              <th style="text-align: right;">Thao tác</th>
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
    const typeLabel = PRODUCT_TYPE_LABELS[p.type] || p.type;
    const typeClass = PRODUCT_TYPE_BADGE_CLASSES[p.type] || 'badge-pending';
    const eggText = p.type === 'box' ? '-' : (p.eggCount === 0 ? '0 trứng (chay)' : `${p.eggCount} trứng`);
    const weightText = p.weight > 0 ? `${p.weight}g` : '-';

    return `
      <tr data-product-id="${p.id}">
        <td><strong style="color: var(--primary);">${p.id}</strong></td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 14px;">${p.name}</div>
          ${p.description ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${p.description}</div>` : ''}
        </td>
        <td><span class="badge ${typeClass}">${typeLabel}</span></td>
        <td><strong>${weightText}</strong></td>
        <td>${eggText}</td>
        <td>
          <strong style="color: var(--primary); font-size: 14px;">${formatCurrency(p.unitPrice)}</strong>
          ${p.costPrice ? `<div style="font-size: 11px; color: var(--text-muted);">Vốn: ${formatCurrency(p.costPrice)}</div>` : ''}
        </td>
        <td>
          ${p.isAvailable
            ? '<span class="badge badge-completed">Còn làm</span>'
            : '<span class="badge badge-cancelled">Tạm hết</span>'}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm btn-product-edit" data-id="${p.id}" title="Sửa bánh">
            ✏️ Sửa
          </button>
          <button class="btn btn-danger btn-sm btn-product-delete" data-id="${p.id}" style="margin-left: 4px;" title="Xóa bánh">
            🗑️ Xóa
          </button>
        </td>
      </tr>
    `;
  }

  private attachTableActionEvents(wrapper: Element): void {
    // Edit
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

    // Delete
    wrapper.querySelectorAll('.btn-product-delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (!id) return;

        const product = await productService.getProductById(id);
        if (!product) return;

        const confirmed = await showConfirmModal({
          title: `Xóa sản phẩm ${product.name}`,
          message: `Bạn có chắc chắn muốn xóa "${product.name}" (Mã: ${product.id}) khỏi danh mục bánh không?`,
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
   * Modal to Add or Edit a Product
   */
  private openProductModal(existing?: Product): void {
    const isEdit = !!existing;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-card" style="max-width: 540px;">
        <div class="modal-header">
          <div>
            <div style="font-size: 13px; font-weight: 700; color: var(--primary); text-transform: uppercase;">
              ${isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm bánh mới'}
            </div>
            <h3 class="modal-title" style="margin-top: 2px;">
              ${isEdit ? `${existing?.id} - ${existing?.name}` : 'Thêm Bánh Trung Thu vào menu'}
            </h3>
          </div>
          <button class="modal-close-btn" id="modal-product-close">✕</button>
        </div>

        <form id="product-form" novalidate>
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
            <!-- Tên bánh -->
            <div class="form-group">
              <label class="form-label" for="prod-name">Tên bánh / Sản phẩm <span class="required">*</span></label>
              <input
                type="text"
                id="prod-name"
                class="form-control"
                placeholder="Ví dụ: Thập cẩm gà quay 2 trứng, Bánh dẻo đậu xanh..."
                value="${existing ? existing.name : ''}"
                required
              />
              <div class="form-error" id="err-prod-name"></div>
            </div>

            <!-- Loại & Số trứng -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label" for="prod-type">Phân loại <span class="required">*</span></label>
                <select id="prod-type" class="form-control">
                  <option value="baked" ${!existing || existing.type === 'baked' ? 'selected' : ''}>Bánh nướng</option>
                  <option value="snowskin" ${existing?.type === 'snowskin' ? 'selected' : ''}>Bánh dẻo</option>
                  <option value="box" ${existing?.type === 'box' ? 'selected' : ''}>Vỏ hộp / Túi quà</option>
                  <option value="combo" ${existing?.type === 'combo' ? 'selected' : ''}>Set Combo</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="prod-egg">Số trứng muối</label>
                <select id="prod-egg" class="form-control">
                  <option value="0" ${existing?.eggCount === 0 ? 'selected' : ''}>0 trứng (Chay / Không trứng)</option>
                  <option value="1" ${!existing || existing.eggCount === 1 ? 'selected' : ''}>1 trứng</option>
                  <option value="2" ${existing?.eggCount === 2 ? 'selected' : ''}>2 trứng</option>
                </select>
              </div>
            </div>

            <!-- Trọng lượng & Đơn giá -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label" for="prod-weight">Trọng lượng (gram)</label>
                <input
                  type="number"
                  id="prod-weight"
                  class="form-control"
                  placeholder="150, 180, 200..."
                  value="${existing ? existing.weight : 200}"
                  min="0"
                  step="10"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="prod-price">Đơn giá niêm yết (VNĐ) <span class="required">*</span></label>
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

            <!-- Giá vốn & Trạng thái -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label class="form-label" for="prod-cost">Giá vốn ước tính (VNĐ)</label>
                <input
                  type="number"
                  id="prod-cost"
                  class="form-control"
                  placeholder="Tùy chọn..."
                  value="${existing?.costPrice !== undefined ? existing.costPrice : ''}"
                  min="0"
                  step="1000"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="prod-available">Tình trạng nhận làm</label>
                <select id="prod-available" class="form-control">
                  <option value="true" ${!existing || existing.isAvailable ? 'selected' : ''}>Còn nhận làm</option>
                  <option value="false" ${existing && !existing.isAvailable ? 'selected' : ''}>Tạm ngưng / Hết nhân</option>
                </select>
              </div>
            </div>

            <!-- Mô tả -->
            <div class="form-group">
              <label class="form-label" for="prod-desc">Mô tả nhân / Độ ngọt</label>
              <input
                type="text"
                id="prod-desc"
                class="form-control"
                placeholder="Ví dụ: Ít ngọt, hạt sen tươi sên tay, thơm lá dứa..."
                value="${existing?.description || ''}"
              />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="modal-product-cancel">Hủy</button>
            <button type="submit" class="btn btn-primary" id="modal-product-submit">
              <span>💾</span> ${isEdit ? 'Lưu cập nhật' : 'Thêm vào menu'}
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

    const form = overlay.querySelector('#product-form') as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nameInput = form.querySelector('#prod-name') as HTMLInputElement;
      const typeInput = form.querySelector('#prod-type') as HTMLSelectElement;
      const eggInput = form.querySelector('#prod-egg') as HTMLSelectElement;
      const weightInput = form.querySelector('#prod-weight') as HTMLInputElement;
      const priceInput = form.querySelector('#prod-price') as HTMLInputElement;
      const costInput = form.querySelector('#prod-cost') as HTMLInputElement;
      const availInput = form.querySelector('#prod-available') as HTMLSelectElement;
      const descInput = form.querySelector('#prod-desc') as HTMLInputElement;

      const formData: ProductFormData = {
        name: nameInput.value,
        type: typeInput.value as ProductType,
        eggCount: Number(eggInput.value) || 0,
        weight: Number(weightInput.value) || 0,
        unitPrice: Number(priceInput.value) || 0,
        costPrice: costInput.value ? Number(costInput.value) : undefined,
        isAvailable: availInput.value === 'true',
        description: descInput.value,
      };

      const val = validateProductForm(formData);
      if (!val.isValid) {
        const errName = form.querySelector('#err-prod-name') as HTMLElement;
        const errPrice = form.querySelector('#err-prod-price') as HTMLElement;
        if (val.errors.name && errName) errName.textContent = val.errors.name;
        if (val.errors.unitPrice && errPrice) errPrice.textContent = val.errors.unitPrice;
        return;
      }

      try {
        if (isEdit && existing) {
          await productService.updateProduct(existing.id, {
            name: formData.name,
            type: formData.type,
            eggCount: Number(formData.eggCount),
            weight: Number(formData.weight),
            unitPrice: Number(formData.unitPrice),
            costPrice: formData.costPrice !== undefined ? Number(formData.costPrice) : undefined,
            isAvailable: formData.isAvailable,
            description: formData.description,
          });
          toast.show('Thành công', `Đã cập nhật bánh ${existing.id}`, 'success');
        } else {
          const created = await productService.addProduct({
            name: formData.name,
            type: formData.type,
            eggCount: Number(formData.eggCount),
            weight: Number(formData.weight),
            unitPrice: Number(formData.unitPrice),
            costPrice: formData.costPrice !== undefined ? Number(formData.costPrice) : undefined,
            isAvailable: formData.isAvailable,
            description: formData.description,
          });
          toast.show('Thành công', `Đã thêm món "${created.name}" (Mã: ${created.id})`, 'success');
        }

        close();
        this.applyFiltersAndRenderTable();
      } catch (err) {
        toast.show('Lỗi', err instanceof Error ? err.message : String(err), 'error');
      }
    });
  }
}
