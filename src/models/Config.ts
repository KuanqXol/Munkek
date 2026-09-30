export interface AppConfig {
  dataPath: string; // Đường dẫn thư mục dữ liệu, mặc định là "./data"
  configPath?: string; // Đường dẫn file config đang nạp
  shopName: string;
  lastOpened: string;
  autoBackup: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  dataPath: './data',
  shopName: 'MunKek - Tiệm Bánh Trung Thu',
  lastOpened: new Date().toISOString(),
  autoBackup: true,
};
