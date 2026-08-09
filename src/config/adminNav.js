import { hasRole, isAdminUser, isManagerUser, isStaffUser } from "../utils/roleHelpers";

// Nguồn dữ liệu điều hướng khu Admin dùng chung cho AdminSidebar (hiển thị menu) và
// Login (chọn trang landing sau đăng nhập) — giữ 1 nơi duy nhất để 2 chỗ không lệch nhau.
// Nhóm sidebar theo nghiệp vụ — header chỉ là nhãn, luôn hiện mục con.
export const ADMIN_MENU_GROUPS = [
  {
    id: "overview",
    labelVn: "Tổng quan",
    labelEn: "Overview",
    items: [
      { path: "/admin", labelVn: "Dashboard", labelEn: "Dashboard", roles: ["ADMIN"] },
      { path: "/admin/revenue", labelVn: "Doanh thu", labelEn: "Revenue", roles: ["ADMIN"] },
    ],
  },
  {
    id: "people",
    labelVn: "Nhân sự",
    labelEn: "People",
    items: [
      { path: "/admin/users-management", labelVn: "Khách hàng", labelEn: "Customers", roles: ["ADMIN"] },
      { path: "/admin/managers-management", labelVn: "Quản lí", labelEn: "Managers", roles: ["ADMIN"] },
      {
        path: "/admin/staffs-management",
        labelVn: "Nhân viên",
        labelEn: "Staff",
        labelVnStaff: "Lịch của tôi",
        labelEnStaff: "My schedule",
        roles: ["ADMIN", "MANAGER", "STAFF"],
      },
    ],
  },
  {
    id: "ops",
    labelVn: "Vận hành",
    labelEn: "Operations",
    items: [
      { path: "/admin/trips-management", labelVn: "Chuyến tàu", labelEn: "Trips", roles: ["ADMIN", "MANAGER"] },
      { path: "/admin/operations-schedule", labelVn: "Lịch vận hành", labelEn: "Ops schedule", roles: ["ADMIN", "MANAGER", "STAFF"] },
      { path: "/admin/routes-management", labelVn: "Tuyến", labelEn: "Routes", roles: ["ADMIN"] },
      { path: "/admin/stations-management", labelVn: "Nhà ga", labelEn: "Stations", roles: ["ADMIN", "MANAGER"] },
      { path: "/admin/landmarks-management", labelVn: "Landmark thuyết minh", labelEn: "Landmarks", roles: ["ADMIN"] },
      { path: "/admin/boats-management", labelVn: "Tàu", labelEn: "Boats", roles: ["ADMIN"] },
      { path: "/admin/seat-types", labelVn: "Chính sách giá", labelEn: "Fare Policy", roles: ["ADMIN"] },
      { path: "/admin/live-tracking", labelVn: "Theo dõi tàu", labelEn: "Boat tracking", labelVnStaff: "Theo dõi tàu", labelEnStaff: "Boat tracking", roles: ["ADMIN"] },
      { path: "/admin/staff/my-trips", labelVn: "Chuyến của tôi", labelEn: "My trips", roles: ["STAFF"] },
      { path: "/admin/staff/ticket-scan", labelVn: "Quét vé", labelEn: "Ticket scan", roles: ["STAFF"] },
      { path: "/admin/staff/scan-history", labelVn: "Lịch sử quét", labelEn: "Scan history", roles: ["STAFF"] },
    ],
  },
  {
    id: "bookings",
    labelVn: "Đặt chỗ & BH",
    labelEn: "Bookings & Insurance",
    items: [
      { path: "/admin/booking-pos", labelVn: "Bán vé (POS)", labelEn: "Sell tickets (POS)", roles: ["MANAGER", "STAFF"] },
      { path: "/admin/charter-bookings-management", labelVn: "Thuê tàu", labelEn: "Request Booking", roles: ["ADMIN"] },
      { path: "/admin/insurance-management", labelVn: "Bảo hiểm", labelEn: "Insurance", roles: ["ADMIN"] },
      { path: "/admin/reviews-management", labelVn: "Đánh giá", labelEn: "Reviews", roles: ["ADMIN"] },
    ],
  },
  {
    id: "content",
    labelVn: "Marketing",
    labelEn: "Marketing",
    items: [
      { path: "/admin/promotions", labelVn: "Khuyến mãi", labelEn: "Promotions", roles: ["ADMIN"] },
      {
        path: "/admin/news",
        labelVn: "Blog / News",
        labelEn: "Blog & Articles",
        labelVnStaff: "Blog / Tin tức",
        labelEnStaff: "Blog / News",
        roles: ["ADMIN"],
      },
      { path: "/admin/system-data", labelVn: "Dữ liệu hệ thống", labelEn: "System Data", roles: ["ADMIN"] },
    ],
  },
];

// Staff thuần (không kiêm Admin/Manager) chỉ thấy các trang vận hành cá nhân — danh sách path
// cố định, độc lập với field `roles` ở trên (Dashboard đã bỏ khỏi đây vì giờ chỉ Admin truy cập).
export const STAFF_MENU_PATHS = new Set([
  "/admin/live-tracking",
  "/admin/operations-schedule",
  "/admin/staffs-management",
  "/admin/staff/my-trips",
  "/admin/staff/ticket-scan",
  "/admin/staff/scan-history",
  "/admin/booking-pos",
]);

/** true nếu user chỉ có role Staff (không kiêm Admin/Manager) — dùng chung logic với sidebar. */
export const isStaffOnlyUser = (user) => isStaffUser(user) && !isAdminUser(user) && !isManagerUser(user);

const isNavItemVisible = (user, item, staffOnly) => {
  if (staffOnly) return STAFF_MENU_PATHS.has(item.path);
  return !item.roles || hasRole(user, ...item.roles);
};

/** Danh sách nav (theo đúng thứ tự sidebar) mà user hiện tại được phép truy cập. */
export const getVisibleAdminNavPaths = (user) => {
  const staffOnly = isStaffOnlyUser(user);
  return ADMIN_MENU_GROUPS.flatMap((group) => group.items)
    .filter((item) => isNavItemVisible(user, item, staffOnly))
    .map((item) => item.path);
};

/** Trang landing mặc định sau đăng nhập / khi vào thẳng "/admin" — mục đầu tiên user có quyền xem. */
export const getDefaultAdminLandingPath = (user) => {
  const [firstPath] = getVisibleAdminNavPaths(user);
  return firstPath || "/";
};
