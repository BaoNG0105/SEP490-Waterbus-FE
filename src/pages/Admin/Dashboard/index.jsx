import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { getPrimaryRoleLabel, hasRole, isAdminUser, isManagerUser, isStaffUser } from "../../../utils/roleHelpers";

export const Dashboard = () => {
  const { lang } = useApp();
  const { user } = useSelector((state) => state.auth);

  const staffOnly = isStaffUser(user) && !isAdminUser(user) && !isManagerUser(user);

  // Danh mục chức năng quản lý đồng bộ với menu sidebar (AdminSidebar.jsx)
  const dashboardModules = [
    {
      path: "/admin/revenue",
      icon: "payments",
      titleVn: "Báo cáo doanh thu",
      titleEn: "Revenue Financials",
      descVn: "Thống kê dòng tiền, vé bán và hạch toán.",
      descEn: "Track cash flows, ticketing and accounting.",
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400",
      roles: ["ADMIN"],
    },
    {
      path: "/admin/users-management",
      icon: "manage_accounts",
      titleVn: "Quản lý Khách hàng",
      titleEn: "Customer Management",
      descVn: "Xem danh sách tài khoản Khách hàng trong hệ thống.",
      descEn: "View the list of customer accounts.",
      color: "from-indigo-500/10 to-blue-500/10 text-indigo-600 dark:text-indigo-400",
      roles: ["ADMIN"],
    },
    {
      path: "/admin/managers-management",
      icon: "supervisor_account",
      titleVn: "Quản lý Manager",
      titleEn: "Manager Management",
      descVn: "Quản lý tài khoản Quản lý (Manager) và bến phụ trách.",
      descEn: "Manage manager accounts and their assigned stations.",
      color: "from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400",
      roles: ["ADMIN"],
    },
    {
      path: "/admin/staffs-management",
      icon: "badge",
      titleVn: "Quản lý Nhân viên",
      titleEn: "Staff Management",
      descVn: "Tài khoản nhân viên và xếp lịch phân công.",
      descEn: "Staff accounts and shift scheduling.",
      color: "from-sky-500/10 to-blue-500/10 text-sky-600 dark:text-sky-400",
      roles: ["ADMIN", "MANAGER"],
    },
    {
      path: "/admin/charter-bookings-management",
      icon: "directions_boat",
      titleVn: "Quản lý thuê tàu",
      titleEn: "Request Booking Management",
      descVn: "Điều phối yêu cầu thuê tàu riêng, gán tàu và chốt giá.",
      descEn: "Handle private booking requests, boat assignment, and quotes.",
      color: "from-violet-500/10 to-purple-500/10 text-violet-600 dark:text-violet-400",
      roles: ["ADMIN"],
    },
    {
      path: "/admin/bookings",
      icon: "receipt_long",
      titleVn: "Quản lý Booking Waterbus",
      titleEn: "Order Invoice Logs",
      descVn: "Danh sách các Booking của Waterbus & Water SightSeeing.",
      descEn: "Full invoice transactions and status codes.",
      color: "from-amber-500/10 to-yellow-500/10 text-amber-600 dark:text-amber-500",
      roles: ["ADMIN"],
    },
    {
      path: "/admin/stations-management",
      icon: "storefront",
      titleVn: "Quản lý nhà ga bến",
      titleEn: "Wharf Station Hubs",
      descVn: "Cấu hình thông tin bến tàu, dịch vụ bến.",
      descEn: "Configure river terminal piers and utilities.",
      color: "from-teal-500/10 to-emerald-500/10 text-teal-600 dark:text-teal-400",
      roles: ["ADMIN", "MANAGER"],
    },
    {
      path: "/admin/boats-management",
      icon: "directions_boat",
      titleVn: "Quản lý đội tàu",
      titleEn: "Boat Fleet Matrix",
      descVn: "Theo dõi trạng thái, bảo trì phương tiện.",
      descEn: "Track watercraft assets and maintenance.",
      color: "from-cyan-500/10 to-sky-500/10 text-cyan-600 dark:text-cyan-400",
      roles: ["ADMIN"],
    },
    {
      path: "/admin/live-tracking",
      icon: "my_location",
      titleVn: "Theo dõi tàu trực tiếp",
      titleEn: "Live Fleet Tracking",
      titleVnStaff: "Theo dõi tàu",
      titleEnStaff: "Boat tracking",
      descVn: "Giám sát vị trí và hành trình tàu theo thời gian thực.",
      descEn: "Monitor real-time boat positions and routes.",
      descVnStaff: "Xem vị trí tàu realtime và ghi nhận sự cố trên tuyến.",
      descEnStaff: "View live boat GPS and log on-route incidents.",
      color: "from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400",
      roles: ["ADMIN", "MANAGER", "STAFF"],
    },
    {
      path: "/admin/incidents",
      icon: "emergency",
      titleVn: "Sự cố / Cứu hộ",
      titleEn: "Incidents & Rescue",
      descVn: "Ghi nhận và xử lý sự cố khẩn cấp trên tuyến.",
      descEn: "Log and resolve on-route emergencies.",
      color: "from-red-500/10 to-rose-500/10 text-red-600 dark:text-red-400",
      roles: ["ADMIN"],
    },
    {
      path: "/admin/staffs-management?view=assignments",
      icon: "event_available",
      titleVn: "Phân công Nhân viên",
      titleEn: "Staff Assignments",
      titleVnStaff: "Lịch làm việc của tôi",
      titleEnStaff: "My Schedule",
      descVn: "Sắp xếp ca trực và phân công nhân viên theo tuyến.",
      descEn: "Schedule shifts and assign staff to routes.",
      descVnStaff: "Xem lịch trực và phân công của bạn.",
      descEnStaff: "View your assigned shifts and routes.",
      color: "from-purple-500/10 to-violet-500/10 text-purple-600 dark:text-purple-400",
      roles: ["STAFF"],
    },
    {
      path: "/admin/staff/my-trips",
      icon: "directions_boat",
      titleVn: "Chuyến của tôi",
      titleEn: "My Trips",
      descVn: "Danh sách chuyến tàu bạn được phân công.",
      descEn: "View the trips assigned to you.",
      color: "from-cyan-500/10 to-teal-500/10 text-cyan-600 dark:text-cyan-400",
      roles: ["STAFF"],
    },
    {
      path: "/admin/staff/ticket-scan",
      icon: "qr_code_scanner",
      titleVn: "Quét vé",
      titleEn: "Ticket Scan",
      descVn: "Quét mã QR kiểm soát vé lên tàu.",
      descEn: "Scan QR tickets at boarding.",
      color: "from-sky-500/10 to-blue-500/10 text-sky-600 dark:text-sky-400",
      roles: ["STAFF"],
    },
    {
      path: "/admin/staff/scan-history",
      icon: "history",
      titleVn: "Lịch sử quét vé",
      titleEn: "Scan History",
      descVn: "Tra cứu lịch sử các lượt quét vé đã thực hiện.",
      descEn: "Review your past ticket scan activity.",
      color: "from-slate-500/10 to-gray-500/10 text-slate-600 dark:text-slate-300",
      roles: ["STAFF"],
    },
    {
      path: "/admin/insurance-management",
      icon: "shield",
      titleVn: "Quản lý bảo hiểm",
      titleEn: "Insurance Packages",
      descVn: "Cấu hình các gói bảo hiểm hành khách.",
      descEn: "Configure passenger insurance packages.",
      color: "from-emerald-500/10 to-green-500/10 text-emerald-600 dark:text-emerald-400",
      roles: ["ADMIN"],
    },
    {
      path: "/admin/trips-management",
      icon: "sailing",
      titleVn: "Quản lý chuyến tàu",
      titleEn: "Trip Management",
      descVn: "Thiết lập khung giờ chạy, tần suất chuyến.",
      descEn: "Setup daily departure hours and intervals.",
      color: "from-lime-500/10 to-emerald-500/10 text-lime-700 dark:text-lime-400",
      roles: ["ADMIN", "MANAGER"],
    },
    {
      path: "/admin/routes-management",
      icon: "alt_route",
      titleVn: "Quản lý tuyến chạy",
      titleEn: "Route Canal Networks",
      descVn: "Quản lý lộ trình kết nối các bến sông.",
      descEn: "Control destination paths along the river.",
      color: "from-fuchsia-500/10 to-pink-500/10 text-fuchsia-600 dark:text-fuchsia-400",
      roles: ["ADMIN"],
    },
    {
      path: "/admin/promotions",
      icon: "local_offer",
      titleVn: "Quản lý khuyến mãi",
      titleEn: "Promo Offers & Vouchers",
      descVn: "Phát hành mã voucher giảm giá, chiến dịch.",
      descEn: "Issue promotional discount code campaigns.",
      color: "from-red-500/10 to-orange-500/10 text-red-600 dark:text-red-400",
      roles: ["ADMIN"],
    },
    {
      path: "/admin/news",
      icon: "feed",
      titleVn: "Quản lý Blog/News",
      titleEn: "CMS News Hub Feed",
      descVn: "Viết bài thông báo lịch trình, tin sự kiện.",
      descEn: "Publish announcements and holiday news.",
      color: "from-yellow-500/10 to-amber-500/10 text-amber-700 dark:text-amber-400",
      roles: ["ADMIN"],
    },
    {
      path: "/admin/knowledge-management",
      icon: "database",
      titleVn: "Cơ sở tri thức",
      titleEn: "Knowledge Base",
      descVn: "Quản lý nội dung chính sách, quy định cho chatbot & trang Điều khoản.",
      descEn: "Manage policy & rules content for the chatbot and Terms page.",
      color: "from-emerald-500/10 to-cyan-500/10 text-teal-700 dark:text-teal-400",
      roles: ["ADMIN"],
    },
  ];

  // Staff thuần chỉ thấy các mục vận hành cá nhân, không thấy các trang quản lý cấp cao.
  const staffDashboardPaths = new Set([
    "/admin/live-tracking",
    "/admin/staffs-management?view=assignments",
    "/admin/staff/my-trips",
    "/admin/staff/ticket-scan",
    "/admin/staff/scan-history",
  ]);

  const visibleModules = staffOnly
    ? dashboardModules.filter((module) => staffDashboardPaths.has(module.path))
    : dashboardModules.filter((module) => hasRole(user, ...module.roles));

  return (
    <div className="p-1.5 md:p-4 min-h-screen bg-slate-50 dark:bg-slate-900/40 text-slate-800 dark:text-slate-100 transition-colors duration-300">

      {/* --- MỚI: KHỐI BANNER HERO CHÀO MỪNG SỬ DỤNG BACKGROUND IMAGE CAO CẤP --- */}
      <div className="relative h-55 md:h-65 rounded-[2.5rem] overflow-hidden mb-8 shadow-md border border-slate-100 dark:border-slate-800 group select-none">

        {/* Hình ảnh nền gốc của bạn */}
        <img
          src="https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png"
          alt="Admin Navigator Banner"
          className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-[1.03] transition-transform duration-1000 ease-out"
        />

        {/* Lớp phủ Layer màu xanh đậm #124757 giúp chữ trắng rõ nét tinh tế */}
        <div className="absolute inset-0 bg-linear-to-r from-[#124757]/95 via-[#124757]/80 to-transparent dark:from-slate-950 dark:via-slate-900/90"></div>

        {/* Khung nội dung text nổi lớp trên */}
        <div className="absolute inset-0 z-10 p-6 md:p-10 flex flex-col justify-between items-start">

          {/* Badge chỉ số trực tuyến đồng bộ góc trái */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-headline font-black text-white uppercase tracking-wider">
              {lang === "VN" ? "Trung tâm điều hành" : "Operation Live"}
            </span>
          </div>

          {/* Tiêu đề "Xin chào" cùng lời bình luận */}
          <div className="space-y-1">
            <h2 className="text-3xl md:text-4xl font-headline font-black text-[#FFD100] drop-shadow-sm">
              {lang === "VN"
                ? `Xin chào, ${getPrimaryRoleLabel(user, lang)}!`
                : `Welcome back, ${getPrimaryRoleLabel(user, lang)}!`}
            </h2>
            <p className="text-sm font-medium text-white/70 max-w-xl font-body leading-relaxed">
              {lang === "VN"
                ? "Hệ thống đường thủy trung tâm đang hoạt động ổn định. Hãy theo dõi ma trận dữ liệu phía dưới để điều phối chính xác."
                : "The central waterway transit matrix is fully stable. Use the control boards below to command fleet protocols."}
            </p>
          </div>

        </div>
      </div>

      {/* SECTION 1: LƯỚI MA TRẬN DANH MỤC QUẢN LÝ BENTO HỘP KHỐI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {visibleModules.map((module) => {
          const title = staffOnly && module.titleVnStaff
            ? (lang === "VN" ? module.titleVnStaff : module.titleEnStaff)
            : (lang === "VN" ? module.titleVn : module.titleEn);
          const desc = staffOnly && module.descVnStaff
            ? (lang === "VN" ? module.descVnStaff : module.descEnStaff)
            : (lang === "VN" ? module.descVn : module.descEn);

          return (
            <Link
              key={module.path}
              to={module.path}
              className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-4xl p-6 shadow-sm hover:shadow-xl hover:border-[#124757]/30 dark:hover:border-yellow-400/30 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group cursor-pointer"
            >
              {/* Lớp đầu: Icon tròn phủ mờ kết hợp dòng trạng thái nhanh */}
              <div className="flex items-start justify-between gap-4">
                <div className={`w-12 h-12 rounded-2xl bg-linear-to-br ${module.color} flex items-center justify-center shadow-inner shrink-0`}>
                  <span className="material-symbols-outlined text-[24px] font-bold">
                    {module.icon}
                  </span>
                </div>
              </div>

              {/* Lớp nội dung chữ ở dưới */}
              <div className="mt-8 space-y-2">
                <h3 className="font-headline font-black text-base text-[#124757] dark:text-white leading-tight group-hover:text-yellow-500 dark:group-hover:text-yellow-400 transition-colors">
                  {title}
                </h3>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-400 font-body leading-relaxed line-clamp-2">
                  {desc}
                </p>
              </div>

              {/* Mũi tên khép góc tạo chiều hướng hành động */}
              <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50 flex justify-end">
                <span className="material-symbols-outlined text-sm font-black text-slate-300 group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-transform duration-300 group-hover:translate-x-1">
                  arrow_forward
                </span>
              </div>
            </Link>
          );
        })}
      </div>

    </div>
  );
};
