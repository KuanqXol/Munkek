# MunKek - Ứng Dụng Quản Lý Đơn Bánh Ngọt (Desktop Windows)

MunKek là ứng dụng desktop độc lập dành cho Windows được thiết kế tối ưu cho các tiệm bánh ngọt cá nhân, quy mô dữ liệu từ vài trăm đến vài nghìn đơn hàng. Ứng dụng chú trọng tối đa vào tính thân thiện, dễ sử dụng cho người không rành công nghệ, hoạt động 100% offline và tách biệt hoàn toàn dữ liệu với bộ cài đặt ứng dụng.

---

## 1. Công nghệ sử dụng

- **Frontend**: HTML5, Vanilla CSS, TypeScript.
- **Build tool**: Vite 6.
- **Desktop framework**: Tauri v2.
- **Local Storage**: File JSON (`orders.json`) lưu tại thư mục hệ thống `AppData\Roaming\MunKek` với kỹ thuật ghi file an toàn (Atomic File Replacement via temporary file).
- **Auto Updater**: Tauri v2 official updater (`@tauri-apps/plugin-updater`) kết hợp GitHub Releases.

---

## 2. Cấu trúc dự án (Project Structure)

```text
munkek/
├── .github/
│   └── workflows/
│       └── release.yml          # CI/CD tự động build NSIS installer và ký số updater khi push tag
├── public/
│   └── cake.svg                 # Favicon ứng dụng
├── src/
│   ├── components/
│   │   ├── ConfirmModal.ts      # Hộp thoại xác nhận an toàn (Xóa đơn, Restore...)
│   │   ├── OrderDetailsModal.ts # Modal xem chi tiết đơn hàng & phân tích tài chính
│   │   ├── Toast.ts             # Hệ thống thông báo toast tự tắt
│   │   └── UpdateDialog.ts      # Hộp thoại thông báo và tải bản cập nhật mới
│   ├── models/
│   │   └── Order.ts             # Định nghĩa schema Order, OrderStatus, OrdersDocument
│   ├── pages/
│   │   ├── DashboardPage.ts     # Thống kê doanh thu, đơn chưa làm, đơn sắp giao
│   │   ├── OrderFormPage.ts     # Form Thêm mới và Sửa đơn bánh (tự tính tiền cọc & còn lại)
│   │   ├── OrdersPage.ts        # Quản lý danh sách, tìm kiếm đa năng, lọc trạng thái/ngày
│   │   └── SettingsPage.ts      # Xuất CSV (Excel), Sao lưu JSON, Khôi phục, Cập nhật app
│   ├── services/
│   │   ├── backupService.ts     # Xuất CSV (UTF-8 BOM), Backup JSON & Restore an toàn
│   │   ├── orderService.ts      # Nghiệp vụ CRUD, auto sinh ID ORD-xxxx, auto tính thành tiền
│   │   ├── storageService.ts    # Đọc/ghi AppData/Roaming/MunKek/orders.json (Atomic write)
│   │   └── updateService.ts     # Quản lý Tauri auto-updater, chế độ offline an toàn
│   ├── styles/
│   │   └── main.css             # Design system ấm cúng phong cách tiệm bánh (Bakery palette)
│   ├── utils/
│   │   ├── formatters.ts        # Định dạng tiền tệ VND, ngày tháng DD/MM/YYYY, nhãn thời hạn
│   │   └── validators.ts        # Kiểm tra tính hợp lệ dữ liệu form với thông báo tiếng Việt
│   └── main.ts                  # Điểm khởi chạy app, navigation và silent update check
├── src-tauri/
│   ├── capabilities/
│   │   └── default.json         # Phân quyền Tauri v2 (fs, dialog, updater, process)
│   ├── icons/                   # Bộ icon đa kích thước (.ico, .png cho Windows NSIS)
│   ├── src/
│   │   ├── lib.rs               # Điểm gắn kết các Tauri plugins
│   │   └── main.rs              # Windows subsystem entry point
│   ├── build.rs                 # Script build của Tauri
│   ├── Cargo.toml               # Khai báo crate Rust và dependencies Tauri v2
│   └── tauri.conf.json          # Cấu hình NSIS installer, updater endpoint và public key
├── checklist.md                 # Danh sách kiểm tra tiến độ dự án
├── index.html                   # HTML gốc của ứng dụng
├── package.json                 # Cấu hình scripts và npm packages
├── tsconfig.json                # Cấu hình TypeScript compiler
└── vite.config.ts               # Cấu hình Vite dev server cho Tauri
```

---

## 3. Hướng dẫn Phát triển (Development)

### Yêu cầu tiên quyết (Prerequisites)
1. **Node.js**: Phiên bản 18+ trở lên (khuyến nghị v20 hoặc v22 LTS).
2. **Rust & Cargo**: Toolchain `stable-x86_64-pc-windows-msvc`.
3. **C++ Build Tools**: Microsoft Visual C++ Build Tools (hoặc Visual Studio với workload "Desktop development with C++").

### Cài đặt dependencies
```powershell
npm install
```

### Chạy chế độ Development

#### Cách 1: Chạy trực tiếp qua trình duyệt (Web preview)
Bạn có thể mở giao diện và test toàn bộ logic bằng trình duyệt mà chưa cần khởi động cửa sổ desktop:
```powershell
npm run dev
```
Truy cập: `http://localhost:1420` (Dữ liệu sẽ tự động lưu vào LocalStorage trong chế độ này).

#### Cách 2: Chạy đầy đủ ứng dụng Desktop qua Tauri
```powershell
npm run tauri dev
```
Ứng dụng sẽ tự động biên dịch backend Rust, mở cửa sổ desktop Windows native và đọc/ghi file `orders.json` trực tiếp từ thư mục `AppData`.

---

## 4. Đóng gói Bộ cài đặt Windows (Build Windows Installer)

### Lệnh đóng gói
```powershell
npm run tauri build
```

### Vị trí file Installer sau khi build
Sau khi hoàn tất quá trình build, file cài đặt NSIS sẽ nằm tại thư mục:
```text
src-tauri\target\release\bundle\nsis\MunKek_1.0.0_x64-setup.exe
```

Người dùng cuối chỉ cần tải file `MunKek_1.0.0_x64-setup.exe`, nhấp đúp chuột để cài đặt và sử dụng ngay mà không cần cài đặt Node.js hay Rust.

---

## 5. Quy trình Nâng cấp Phiên bản (Version Update)

Khi bạn muốn cập nhật từ phiên bản `1.0.0` lên phiên bản `1.1.0`:

1. **`package.json`**:
   Đổi `"version": "1.0.0"` thành `"version": "1.1.0"`.

2. **`src-tauri/Cargo.toml`**:
   Đổi `version = "1.0.0"` thành `version = "1.1.0"`.

3. **`src-tauri/tauri.conf.json`**:
   Đổi `"version": "1.0.0"` thành `"version": "1.1.0"`.

4. **`src/pages/SettingsPage.ts`**:
   Cập nhật hiển thị số phiên bản giao diện (nếu có hardcode string hiển thị).

---

## 6. Quy trình Phát hành Tự động (Release Process qua GitHub Actions)

Dự án đã được tích hợp sẵn GitHub Actions workflow tại `.github/workflows/release.yml`.

### Các bước phát hành:
1. Commit toàn bộ thay đổi mã nguồn:
   ```powershell
   git add .
   git commit -m "chore: release version 1.1.0"
   git push origin main
   ```

2. Tạo tag phiên bản theo chuẩn Semantic Versioning và push lên GitHub:
   ```powershell
   git tag v1.1.0
   git push origin v1.1.0
   ```

3. GitHub Actions sẽ tự động:
   - Khởi tạo môi trường Windows runner.
   - Biên dịch ứng dụng thành bộ cài đặt NSIS (`MunKek_1.1.0_x64-setup.exe`).
   - Ký số gói cài đặt bằng khóa bí mật từ GitHub Secrets.
   - Tạo GitHub Release mới tương ứng với tag `v1.1.0`.
   - Đăng tải installer, file chữ ký `.sig` và file metadata cập nhật `latest.json`.

---

## 7. Cấu hình Khóa Ký Updater (Updater Signing Keys)

Tauri v2 updater sử dụng cơ chế chữ ký số bất đối xứng (Ed25519) để đảm bảo các bản cập nhật tải về không bị giả mạo.

### 1. Tạo cặp khóa
Chạy lệnh sau trên terminal của nhà phát triển:
```powershell
npx tauri signer generate -w $env:USERPROFILE\.tauri\munkek.key
```
Lệnh này sẽ tạo ra 2 file:
- **Private key**: lưu tại `%USERPROFILE%\.tauri\munkek.key` (hoặc đường dẫn bạn chỉ định).
- **Public key**: in trực tiếp ra màn hình và lưu tại `%USERPROFILE%\.tauri\munkek.key.pub`.

### 2. Cấu hình Public Key vào App
Sao chép chuỗi Public Key vừa tạo vào mục `plugins.updater.pubkey` trong file `src-tauri/tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/KuanqXol/Munkek/releases/latest/download/latest.json"
      ],
      "pubkey": "CHUỖI_PUBLIC_KEY_CỦA_BẠN"
    }
  }
}
```

### 3. Cấu hình GitHub Secrets (Tuyệt đối không commit Private Key lên Git!)
Truy cập kho mã nguồn GitHub của bạn: **Settings -> Secrets and variables -> Actions**, tạo 2 Secrets:
1. `TAURI_SIGNING_PRIVATE_KEY`: Dán toàn bộ nội dung của file private key (`munkek.key`).
2. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Nhập mật khẩu đã đặt khi tạo khóa (để trống nếu không đặt mật khẩu).

---

## 8. Hướng dẫn Sao lưu & Khôi phục Dữ liệu cho Người dùng Cuối

### 1. Cơ chế Lưu trữ Độc lập (Data Persistence Across Updates)
- File dữ liệu chính của tiệm bánh được lưu tại:
  ```text
  C:\Users\<Tên_Người_Dùng>\AppData\Roaming\MunKek\orders.json
  ```
- File này hoàn toàn **độc lập** với thư mục cài đặt phần mềm. Khi người dùng cập nhật phiên bản mới hoặc gỡ cài đặt rồi cài lại, file `orders.json` này **không bao giờ bị mất**.

### 2. Xuất dữ liệu ra Excel (CSV)
- Vào màn hình **Dữ liệu / Cài đặt**.
- Nhấn nút **Xuất danh sách ra CSV**.
- File `orders_YYYY-MM-DD.csv` được mã hóa chuẩn **UTF-8 có BOM**, giúp mở trực tiếp bằng Microsoft Excel mà không bị lỗi font chữ tiếng Việt có dấu.

### 3. Sao lưu định kỳ (JSON)
- Vào màn hình **Dữ liệu / Cài đặt**.
- Nhấn nút **Tạo bản sao lưu JSON**.
- Chọn nơi lưu trữ file (ví dụ lưu vào USB, Google Drive hoặc thư mục cá nhân): `cake-orders-backup-YYYY-MM-DD.json`.

### 4. Khôi phục dữ liệu (Restore)
- Vào màn hình **Dữ liệu / Cài đặt** -> chọn **Chọn file khôi phục**.
- Chọn file `.json` đã sao lưu trước đó.
- Ứng dụng sẽ tự động kiểm tra cấu trúc dữ liệu.
- Trước khi nạp dữ liệu mới, MunKek sẽ **tự động tạo một bản sao lưu an toàn của dữ liệu hiện tại** lưu tại thư mục AppData, đảm bảo người dùng không bao giờ mất đơn hàng do thao tác nhầm.