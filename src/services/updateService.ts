import { isTauriEnvironment } from './storageService';

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  body?: string;
  date?: string;
}

export type UpdateCheckResult =
  | { status: 'AVAILABLE'; info: UpdateInfo }
  | { status: 'UP_TO_DATE' }
  | { status: 'OFFLINE_OR_ERROR'; message: string };

class UpdateService {
  private isChecking = false;
  private isDownloading = false;
  // Hold current update instance in memory if available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingUpdateInstance: any = null;

  /**
   * Check for updates safely. Never throws or crashes the app.
   */
  public async checkForUpdates(isSilent = false): Promise<UpdateCheckResult> {
    if (this.isChecking) {
      return { status: 'OFFLINE_OR_ERROR', message: 'Đang trong quá trình kiểm tra cập nhật.' };
    }

    this.isChecking = true;

    try {
      if (!isTauriEnvironment()) {
        if (!isSilent) {
          console.log('[UpdateService] Đang chạy trong môi trường trình duyệt, bỏ qua Tauri updater.');
        }
        return { status: 'UP_TO_DATE' };
      }

      // Dynamically import Tauri updater plugin
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update && update.available) {
        this.pendingUpdateInstance = update;
        return {
          status: 'AVAILABLE',
          info: {
            version: update.version,
            currentVersion: update.currentVersion,
            body: update.body || 'Không có ghi chú bản phát hành.',
            date: update.date,
          },
        };
      }

      return { status: 'UP_TO_DATE' };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (!isSilent) {
        console.warn('[UpdateService] Không thể kết nối tới server cập nhật (offline hoặc lỗi mạng):', errMsg);
      }
      return {
        status: 'OFFLINE_OR_ERROR',
        message: 'Không thể kết nối đến máy chủ cập nhật. Ứng dụng vẫn hoạt động bình thường ở chế độ offline.',
      };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Download and install the pending update, then relaunch
   */
  public async downloadAndInstall(
    onProgress?: (downloadedBytes: number, totalBytes?: number) => void
  ): Promise<void> {
    if (!this.pendingUpdateInstance) {
      throw new Error('Không có bản cập nhật nào đang chờ cài đặt.');
    }

    if (this.isDownloading) {
      throw new Error('Bản cập nhật đang được tải xuống...');
    }

    this.isDownloading = true;

    try {
      let downloaded = 0;
      let total: number | undefined;

      await this.pendingUpdateInstance.downloadAndInstall(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event: any) => {
          if (event.event === 'Started') {
            total = event.data?.contentLength;
            if (onProgress) onProgress(0, total);
          } else if (event.event === 'Progress') {
            downloaded += event.data?.chunkLength || 0;
            if (onProgress) onProgress(downloaded, total);
          } else if (event.event === 'Finished') {
            if (onProgress) onProgress(downloaded, total);
          }
        }
      );

      // Successfully downloaded and verified signatures!
      // Now relaunch the app using Tauri process plugin
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } finally {
      this.isDownloading = false;
    }
  }
}

export const updateService = new UpdateService();
