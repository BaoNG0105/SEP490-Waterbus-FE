# WaterBus – Frontend

Ứng dụng Web cho hệ thống **WaterBus** – nền tảng đặt vé tàu buýt đường thủy (Waterbus), tour tham quan bằng đường thủy (WaterSightseeing) và thuê tàu theo chuyến yêu cầu của Khách hàng (Request booking), kèm theo hệ thống quản trị/vận hành nội bộ cho quản lý, nhân viên bến (Station Staff) và nhân viên trên tàu (on-board staff).

Đây là đồ án tốt nghiệp (Capstone) – SEP490, FPT University.

## Tính năng chính

### Phía khách hàng (Client)
- Đặt vé tàu buýt theo tuyến/trạm, đặt tour tham quan đường thủy, đặt thuê tàu theo yêu cầu (charter booking) với vẽ tuyến trên bản đồ.
- Quản lý hồ sơ cá nhân, lịch sử đặt vé, điểm thưởng (loyalty points), mã khuyến mãi/voucher.
- Thanh toán trực tuyến qua PayOS, xem kết quả thanh toán.
- Theo dõi hành trình tàu theo thời gian thực (live tracking) trên bản đồ (Leaflet).
- Vé điện tử dạng QR code.
- Xem thông tin trạm, tuyến, blog, ưu đãi, đánh giá chuyến đi, chính sách bảo hiểm.
- Trợ lý ảo (AI Chatbot) hỗ trợ khách hàng.
- Đăng nhập/đăng ký bằng tài khoản hoặc Google OAuth, quên mật khẩu, đổi mật khẩu.
- Thông báo (notifications) real-time.
- Đa ngôn ngữ / quốc tịch (i18n-iso-countries, flag-icons).

### Phía quản trị & vận hành (Admin)
- Quản lý tàu (boat), tuyến đường (route), trạm (station), loại ghế (seat type), sơ đồ ghế.
- Quản lý chuyến đi (trip), lịch vận hành (operations schedule), bảng ghế theo chuyến (trip seat board).
- Quản lý đặt vé (booking summary), bán vé tại quầy (booking POS), quản lý đặt thuê tàu (charter booking).
- Quản lý nhân sự: tài khoản người dùng, quản lý (manager), nhân viên, phân công ca trực (staff assignment), chuyến của tôi (staff my trips).
- Quét vé QR (ticket scan) và lịch sử quét vé.
- Theo dõi trực tiếp (live tracking, live ops) toàn hệ thống.
- Xử lý sự cố (incident management), tái lập lịch trình khi có sự cố (replan preview).
- Quản lý bảo hiểm, chính sách giá vé (fare policy), khuyến mãi, đánh giá, landmark, blog.
- Báo cáo doanh thu (revenue report), thông báo hệ thống.
- Quản lý dữ liệu hệ thống, quản lý prompt cho trợ lý AI (assistant prompt management).
- Phân quyền theo vai trò: Admin, Manager, Ground Staff, On-board Staff, Customer (route guard riêng cho từng vai trò).

## Công nghệ sử dụng

- **React 19** + **Vite 8** – build tool & dev server (HMR nhanh).
- **React Router 7** – định tuyến (routing) phía client.
- **Redux Toolkit** + **React Redux** – quản lý state toàn cục (auth, ...).
- **Tailwind CSS 4** (`@tailwindcss/vite`) – styling.
- **Axios** – gọi REST API.
- **@microsoft/signalr** – kết nối real-time (tracking, charter booking hub, incident hub).
- **Leaflet** + **react-leaflet** – bản đồ, vẽ tuyến, theo dõi vị trí tàu.
- **@react-oauth/google** – đăng nhập Google.
- **html5-qrcode** / **qrcode.react** – quét và tạo mã QR vé.
- **lottie-react** – hiệu ứng animation.
- **react-markdown** – hiển thị nội dung dạng Markdown (blog, chatbot...).
- **sweetalert2** – thông báo/alert dạng popup.
- **lucide-react** – bộ icon.
- **ESLint** – kiểm tra chất lượng mã nguồn.

## Cấu trúc thư mục

```
src/
├── api/            # Các hàm gọi API (axios instance + endpoint theo module)
├── services/       # Lớp nghiệp vụ bọc quanh api/, SignalR hub clients
├── redux/          # Redux store & slices (authSlice, ...)
├── context/         # React Context (AppContext)
├── components/     # Component dùng chung (form, map, bảng, modal, route guard...)
│   └── charts/      # Component biểu đồ (báo cáo doanh thu, thống kê...)
├── layout/         # Layout tổng thể (Header, Footer...) và layout khu vực Admin
│   └── Admin/
├── pages/          # Các trang theo tính năng (routing-level)
│   └── Admin/       # Các trang quản trị/vận hành
├── hooks/          # Custom React hooks
├── data/           # Dữ liệu tĩnh/dùng chung
├── utils/          # Hàm tiện ích
├── assets/         # Hình ảnh, tài nguyên tĩnh
├── App.jsx         # Khai báo route & bố cục ứng dụng
└── main.jsx        # Điểm khởi chạy ứng dụng
```

## Yêu cầu môi trường

- Node.js `>=20 <24` (khuyến nghị dùng bản trong [.nvmrc](.nvmrc): Node 22)
- npm

## Cài đặt

```bash
git clone <repository-url>
cd waterbus
npm install
```

## Cấu hình biến môi trường

Tạo file `.env` ở thư mục gốc (tham khảo các biến bên dưới):

```env
VITE_GOOGLE_CLIENT_ID=<Google OAuth Client ID>
VITE_API_BASE_URL=<URL gốc của backend API, ví dụ: https://your-backend.example.com/api>
# Tùy chọn: cổng chạy dev server (mặc định 5174)
VITE_DEV_PORT=5174
```

Khi chạy `npm run dev`, Vite sẽ tự động proxy các request `/api` và `/hubs` (SignalR) sang `VITE_API_BASE_URL` để tránh lỗi CORS/cookie khi phát triển local (xem [vite.config.js](vite.config.js)).

## Các lệnh script

| Lệnh              | Mô tả                                             |
| ----------------- | -------------------------------------------------- |
| `npm run dev`      | Chạy ứng dụng ở chế độ phát triển (dev server)      |
| `npm run build`    | Build ứng dụng cho môi trường production            |
| `npm run preview`  | Xem trước bản build production ở local              |
| `npm run lint`     | Kiểm tra lỗi/định dạng code bằng ESLint             |

## Triển khai (Deployment)

Dự án được cấu hình sẵn để triển khai trên **Vercel** ([vercel.json](vercel.json)), với rewrite toàn bộ route về `index.html` để hỗ trợ client-side routing của React Router.

```bash
npm run build
```

Thư mục build output nằm ở `dist/`.

## Đóng góp

1. Tạo nhánh mới từ `main`: `git checkout -b feature/ten-tinh-nang`
2. Thực hiện thay đổi, đảm bảo `npm run lint` không báo lỗi.
3. Commit và tạo Pull Request để review.

## Giấy phép

Dự án phục vụ mục đích học tập/đồ án tốt nghiệp (Capstone Project – SEP490, FPT University).