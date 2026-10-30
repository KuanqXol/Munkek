import { isTauriEnvironment, storageService } from './storageService.ts';

export const DEFAULT_PRODUCT_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="%23b45309" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%23fef3c7;border-radius:12px;"><path d="M12 2a9 9 0 0 0-9 9c0 3.87 2.45 7.17 5.9 8.44L9 22h6l.1-2.56A9.002 9.002 0 0 0 21 11a9 9 0 0 0-9-9z"/><circle cx="12" cy="11" r="3"/><line x1="12" y1="5" x2="12" y2="8"/><line x1="12" y1="14" x2="12" y2="17"/><line x1="6" y1="11" x2="9" y2="11"/><line x1="15" y1="11" x2="18" y2="11"/></svg>`;

class ImageService {
  /**
   * Ensure <dataDir>/images directory exists
   */
  public async ensureImagesFolder(): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      const { exists, mkdir } = await import('@tauri-apps/plugin-fs');
      const { join } = await import('@tauri-apps/api/path');

      const dataDir = storageService.getDataFolderPath();
      const imagesDir = await join(dataDir, 'images');
      if (!(await exists(imagesDir))) {
        await mkdir(imagesDir, { recursive: true });
      }
    } catch (err) {
      console.warn('Could not ensure images directory:', err);
    }
  }

  /**
   * Optimize and resize an image File to a crisp, lightweight Data URL (max 600px).
   * Ensures instant offline rendering without file-path or asset-protocol permission problems.
   */
  public async optimizeAndConvertFile(file: File, maxDim = 600): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) {
          return reject(new Error('Không thể đọc dữ liệu hình ảnh.'));
        }

        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(dataUrl);
          }

          ctx.drawImage(img, 0, 0, width, height);
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const quality = mime === 'image/jpeg' ? 0.88 : undefined;
          resolve(canvas.toDataURL(mime, quality));
        };
        img.onerror = () => reject(new Error('Ảnh không hợp lệ hoặc bị lỗi định dạng.'));
        img.src = dataUrl;
      };
      reader.onerror = () => reject(new Error('Lỗi khi đọc file ảnh từ máy tính.'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Pick an image via native file dialog and copy it into <dataDir>/images/
   * Returns relative path, e.g. "images/prod_1690000000.png"
   */
  public async pickAndSaveProductImage(): Promise<string | null> {
    if (!isTauriEnvironment()) {
      return null;
    }

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { copyFile } = await import('@tauri-apps/plugin-fs');
      const { join } = await import('@tauri-apps/api/path');

      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Hình ảnh (PNG, JPG, WEBP)',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'],
          },
        ],
        title: 'Chọn ảnh sản phẩm từ máy tính',
      });

      if (!selected || typeof selected !== 'string') {
        return null;
      }

      await this.ensureImagesFolder();

      // Extract extension
      const extMatch = selected.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
      const safeFilename = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

      const dataDir = storageService.getDataFolderPath();
      const targetPath = await join(dataDir, 'images', safeFilename);

      await copyFile(selected, targetPath);

      return `images/${safeFilename}`;
    } catch (err) {
      console.error('Lỗi khi sao chép ảnh sản phẩm:', err);
      throw new Error(`Không thể lưu ảnh sản phẩm: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Resolve an image reference to a displayable URL:
   * - If relative ("images/foo.png"): resolves to Tauri asset URL using convertFileSrc.
   * - If data URL / http: returns as-is.
   * - If empty: returns DEFAULT_PRODUCT_PLACEHOLDER.
   */
  public async resolveImageUrl(imageRef?: string): Promise<string> {
    if (!imageRef || !imageRef.trim()) {
      return DEFAULT_PRODUCT_PLACEHOLDER;
    }

    const ref = imageRef.trim();

    if (ref.startsWith('data:image') || ref.startsWith('http://') || ref.startsWith('https://')) {
      return ref;
    }

    if (isTauriEnvironment() && (ref.startsWith('images/') || ref.startsWith('images\\'))) {
      try {
        const { join } = await import('@tauri-apps/api/path');
        const { convertFileSrc } = await import('@tauri-apps/api/core');

        const dataDir = storageService.getDataFolderPath();
        const fullPath = await join(dataDir, ref);
        return convertFileSrc(fullPath);
      } catch (err) {
        console.warn('Could not convert image path to asset URL:', err);
        return DEFAULT_PRODUCT_PLACEHOLDER;
      }
    }

    return DEFAULT_PRODUCT_PLACEHOLDER;
  }
}

export const imageService = new ImageService();

