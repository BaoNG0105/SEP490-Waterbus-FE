import { Link } from "react-router-dom";
import { useApp } from "../../../context/AppContext";

export const Dashboard = () => {
  const { lang } = useApp();

  // Định nghĩa mảng 16 danh mục chức năng quản lý tối ưu cho trang chủ Dashboard
  const dashboardModules = [
    {
      path: "/admin",
      icon: "dashboard",
      titleVn: "Tổng quan Dashboard",
      titleEn: "System Overview",
      descVn: "Xem biểu đồ phân tích và hiệu suất hệ thống.",
      descEn: "Analyze system charts and core performance.",
      color: "from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400"
    },
    {
      path: "/admin/revenue",
      icon: "payments",
      titleVn: "Báo cáo doanh thu",
      titleEn: "Revenue Financials",
      descVn: "Thống kê dòng tiền, vé bán và hạch toán.",
      descEn: "Track cash flows, ticketing and accounting.",
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400"
    },
    {
      path: "/admin/staff-management",
      icon: "badge",
      titleVn: "Quản lý nhân viên",
      titleEn: "Staff Management",
      descVn: "Điều hành thủy thủ đoàn, nhân viên bến tàu.",
      descEn: "Manage captain crews and station officers.",
      color: "from-purple-500/10 to-indigo-500/10 text-purple-600 dark:text-purple-400"
    },
    {
      path: "/admin/customers-management",
      icon: "groups",
      titleVn: "Quản lý khách hàng",
      titleEn: "CRM Analytics",
      descVn: "Thông tin tài khoản, lịch sử đặt vé khách.",
      descEn: "Customer accounts and booking footprints.",
      color: "from-orange-500/10 to-amber-500/10 text-orange-600 dark:text-orange-400"
    },
    {
      path: "/admin/ticketing",
      icon: "local_activity",
      titleVn: "Hệ thống bán vé",
      titleEn: "POS Counter Sales",
      descVn: "Xuất vé trực tiếp tại quầy ga trung tâm.",
      descEn: "Issue physical tickets at wharf box office.",
      color: "from-pink-500/10 to-rose-500/10 text-pink-600 dark:text-pink-400"
    },
    {
      path: "/admin/verification",
      icon: "qr_code_scanner",
      titleVn: "Kiểm soát soát vé",
      titleEn: "Ticket Gate Scanning",
      descVn: "Giám sát quét mã QR tại các cửa kiểm soát.",
      descEn: "Monitor QR access control at boat boarding.",
      color: "from-sky-500/10 to-blue-500/10 text-sky-600 dark:text-sky-400"
    },
    {
      path: "/admin/tours",
      icon: "map",
      titleVn: "Quản lý tour booking",
      titleEn: "Tour Cruise Packages",
      descVn: "Điều phối tour tham quan, thuê tàu charter.",
      descEn: "Handle private charters and river tours.",
      color: "from-violet-500/10 to-purple-500/10 text-violet-600 dark:text-violet-400"
    },
    {
      path: "/admin/orders",
      icon: "receipt_long",
      titleVn: "Quản lý đơn đặt hàng",
      titleEn: "Order Invoice Logs",
      descVn: "Danh sách giao dịch hóa đơn và trạng thái.",
      descEn: "Full invoice transactions and status codes.",
      color: "from-amber-500/10 to-yellow-500/10 text-amber-600 dark:text-amber-500"
    },
    {
      path: "/admin/stations-management",
      icon: "storefront",
      titleVn: "Quản lý nhà ga bến",
      titleEn: "Wharf Station Hubs",
      descVn: "Cấu hình thông tin bến tàu, dịch vụ bến.",
      descEn: "Configure river terminal piers and utilities.",
      color: "from-teal-500/10 to-emerald-500/10 text-teal-600 dark:text-teal-400"
    },
    {
      path: "/admin/boats-management",
      icon: "directions_boat",
      titleVn: "Quản lý đội tàu",
      titleEn: "Boat Fleet Matrix",
      descVn: "Theo dõi trạng thái, bảo trì phương tiện.",
      descEn: "Track watercraft assets and maintenance.",
      color: "from-cyan-500/10 to-sky-500/10 text-cyan-600 dark:text-cyan-400"
    },
    {
      path: "/admin/schedules",
      icon: "calendar_month",
      titleVn: "Quản lý lịch trình",
      titleEn: "Trip Timetable Matrix",
      descVn: "Thiết lập khung giờ chạy, tần suất chuyến.",
      descEn: "Setup daily departure hours and intervals.",
      color: "from-lime-500/10 to-emerald-500/10 text-lime-700 dark:text-lime-400"
    },
    {
      path: "/admin/routes-management",
      icon: "alt_route",
      titleVn: "Quản lý tuyến chạy",
      titleEn: "Route Canal Networks",
      descVn: "Quản lý lộ trình kết nối các bến sông.",
      descEn: "Control destination paths along the river.",
      color: "from-fuchsia-500/10 to-pink-500/10 text-fuchsia-600 dark:text-fuchsia-400"
    },
    {
      path: "/admin/promotions",
      icon: "local_offer",
      titleVn: "Quản lý khuyến mãi",
      titleEn: "Promo Offers & Vouchers",
      descVn: "Phát hành mã voucher giảm giá, chiến dịch.",
      descEn: "Issue promotional discount code campaigns.",
      color: "from-red-500/10 to-orange-500/10 text-red-600 dark:text-red-400"
    },
    {
      path: "/admin/news",
      icon: "feed",
      titleVn: "Quản lý Blog/News",
      titleEn: "CMS News Hub Feed",
      descVn: "Viết bài thông báo lịch trình, tin sự kiện.",
      descEn: "Publish announcements and holiday news.",
      color: "from-yellow-500/10 to-amber-500/10 text-amber-700 dark:text-amber-400"
    },
    {
      path: "/admin/cskh",
      icon: "support_agent",
      titleVn: "Bộ phận CSKH",
      titleEn: "Customer Care Center",
      descVn: "Hộp thư phản hồi, xử lý khiếu nại hoàn vé.",
      descEn: "Support tickets, feedback and refunds.",
      color: "from-indigo-500/10 to-purple-500/10 text-indigo-600 dark:text-indigo-400"
    },
    {
      path: "/admin/ai-data",
      icon: "database",
      titleVn: "AI Data Context Hub",
      titleEn: "AI Context Training",
      descVn: "Nạp dữ liệu kiến thức cho chatbot thông minh.",
      descEn: "Feed knowledge data into context engine.",
      color: "from-emerald-500/10 to-cyan-500/10 text-teal-700 dark:text-teal-400"
    }
  ];

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
              {lang === "VN" ? "Xin chào, Quản trị viên!" : "Welcome back, Admin!"}
            </h2>
            <p className="text-sm font-medium text-white/70 max-w-xl font-body leading-relaxed">
              {lang === "VN"
                ? "Hệ thống đường thủy trung tâm đang hoạt động ổn định. Hãy theo dõi ma trận dữ liệu phía dưới để điều phối chính xác."
                : "The central waterway transit matrix is fully stable. Use the control boards below to command fleet protocols."}
            </p>
          </div>

        </div>
      </div>

      {/* SECTION 1: LƯỚI MA TRẬN 16 DANH MỤC QUẢN LÝ BENTO HỘP KHỐI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {dashboardModules.map((module, index) => (
          <Link
            key={index}
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
                {lang === "VN" ? module.titleVn : module.titleEn}
              </h3>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-400 font-body leading-relaxed line-clamp-2">
                {lang === "VN" ? module.descVn : module.descEn}
              </p>
            </div>

            {/* Mũi tên khép góc tạo chiều hướng hành động */}
            <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50 flex justify-end">
              <span className="material-symbols-outlined text-sm font-black text-slate-300 group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-transform duration-300 group-hover:translate-x-1">
                arrow_forward
              </span>
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
};