import type { Product, ProductType } from '../models/Product.ts';
import { storageService } from './storageService.ts';
import { removeVietnameseTones } from '../utils/formatters.ts';

class ProductService {
  private products: Product[] = [];
  private isInitialized = false;

  public async init(): Promise<Product[]> {
    this.products = await storageService.loadProducts();
    this.isInitialized = true;
    return this.products;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  public async getAllProducts(): Promise<Product[]> {
    await this.ensureLoaded();
    return [...this.products];
  }

  /**
   * Get all visible products for the main POS screen
   */
  public async getVisibleProducts(): Promise<Product[]> {
    await this.ensureLoaded();
    return this.products
      .filter((p) => p.isVisible !== false)
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  }

  public async getProductById(id: string): Promise<Product | undefined> {
    await this.ensureLoaded();
    return this.products.find((p) => p.id === id);
  }

  public generateNextId(type: ProductType = 'baked'): string {
    const prefix = type === 'box' ? 'BOX' : 'BTT';
    let max = 0;
    const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');

    for (const p of this.products) {
      const match = p.id.match(regex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return `${prefix}-${String(max + 1).padStart(2, '0')}`;
  }

  public async addProduct(input: Partial<Product> & { name: string; unitPrice: number }): Promise<Product> {
    await this.ensureLoaded();

    const newProduct: Product = {
      id: input.id || this.generateNextId(input.type || 'baked'),
      name: input.name.trim(),
      unitPrice: Math.max(0, Number(input.unitPrice) || 0),
      costPrice: input.costPrice !== undefined ? Math.max(0, Number(input.costPrice)) : undefined,
      imageUrl: input.imageUrl ? input.imageUrl.trim() : undefined,
      category: input.category ? input.category.trim() : undefined,
      type: input.type || 'baked',
      eggCount: input.eggCount !== undefined ? Math.max(0, Number(input.eggCount)) : undefined,
      weight: input.weight !== undefined ? Math.max(0, Number(input.weight)) : undefined,
      isAvailable: input.isAvailable !== false,
      isVisible: input.isVisible !== false,
      sortOrder: input.sortOrder ?? this.products.length + 1,
      description: input.description ? input.description.trim() : undefined,
    };

    this.products.push(newProduct);
    await storageService.saveProducts(this.products);
    return newProduct;
  }

  public async updateProduct(id: string, input: Partial<Product>): Promise<Product> {
    await this.ensureLoaded();

    const index = this.products.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Không tìm thấy sản phẩm có mã ${id}`);
    }

    const updated: Product = {
      ...this.products[index],
      ...input,
      id, // keep ID unchanged
    };

    this.products[index] = updated;
    await storageService.saveProducts(this.products);
    return updated;
  }

  public async deleteProduct(id: string): Promise<boolean> {
    await this.ensureLoaded();

    const index = this.products.findIndex((p) => p.id === id);
    if (index === -1) return false;

    this.products.splice(index, 1);
    await storageService.saveProducts(this.products);
    return true;
  }

  public async toggleVisibility(id: string): Promise<boolean> {
    await this.ensureLoaded();
    const p = this.products.find((prod) => prod.id === id);
    if (!p) return false;
    p.isVisible = p.isVisible === false ? true : false;
    await storageService.saveProducts(this.products);
    return p.isVisible;
  }

  /**
   * Search and filter products with Vietnamese unaccented search and dynamic category
   */
  public filterProducts(searchQuery: string, category = 'all'): Product[] {
    const qClean = removeVietnameseTones(searchQuery.trim());

    return this.products.filter((p) => {
      if (category !== 'all') {
        const matchesCategory = p.category && p.category.toLowerCase() === category.toLowerCase();
        const matchesType = p.type && p.type.toLowerCase() === category.toLowerCase();
        if (!matchesCategory && !matchesType) {
          return false;
        }
      }
      if (!qClean) return true;

      const nameClean = removeVietnameseTones(p.name);
      const idClean = p.id.toLowerCase();
      const descClean = p.description ? removeVietnameseTones(p.description) : '';
      return nameClean.includes(qClean) || idClean.includes(qClean) || descClean.includes(qClean);
    });
  }
}

export const productService = new ProductService();
