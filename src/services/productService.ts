import { Product, ProductType } from '../models/Product';
import { storageService } from './storageService';

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

  public async getProductById(id: string): Promise<Product | undefined> {
    await this.ensureLoaded();
    return this.products.find((p) => p.id === id);
  }

  public generateNextId(type: ProductType): string {
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

  public async addProduct(input: {
    name: string;
    type: ProductType;
    eggCount: number;
    weight: number;
    unitPrice: number;
    costPrice?: number;
    isAvailable: boolean;
    description?: string;
  }): Promise<Product> {
    await this.ensureLoaded();

    const newProduct: Product = {
      id: this.generateNextId(input.type),
      name: input.name.trim(),
      type: input.type,
      eggCount: Math.max(0, Number(input.eggCount) || 0),
      weight: Math.max(0, Number(input.weight) || 0),
      unitPrice: Math.max(0, Number(input.unitPrice) || 0),
      costPrice: input.costPrice ? Math.max(0, Number(input.costPrice)) : undefined,
      isAvailable: input.isAvailable !== false,
      description: (input.description || '').trim(),
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

  public filterProducts(query?: string, type?: string): Product[] {
    let list = [...this.products];

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    if (type && type !== 'all') {
      list = list.filter((p) => p.type === type);
    }

    return list;
  }
}

export const productService = new ProductService();
