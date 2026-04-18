import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export const AdminDashboard = () => {
  const { lang } = useApp();

  // Dữ liệu biểu đồ cột (Bar Chart) hỗ trợ đa ngôn ngữ
  const barChartData = [
    { labelVN: "Th 2", labelEN: "Mon", height: "45%" },
    { labelVN: "Th 3", labelEN: "Tue", height: "60%" },
    { labelVN: "Th 4", labelEN: "Wed", height: "30%" },
    { labelVN: "Th 5", labelEN: "Thu", height: "85%", isMax: true },
    { labelVN: "Th 6", labelEN: "Fri", height: "55%" },
    { labelVN: "Th 7", labelEN: "Sat", height: "70%" },
    { labelVN: "CN", labelEN: "Sun", height: "95%" },
  ];

  return (
    <>
      {/* HERO SECTION */}
      <section className="relative h-[320px] rounded-3xl overflow-hidden mb-12 shadow-lg group">
        <img
          alt="River Navigator Hero"
          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAqlVAtCgnfL97zvsROw8COOvEtGNZPGNDpCOFfNy2YJ28yhRD150SoVPkeTiW19EflgNP3NyDJEfhHW9SVmYjb7Lx1UdNEIkr_nhWDwvkv62DCdGhwpjlqNx3aYWNs7ziKeys_xOWKItwWtUSJMdSgJfwXheVBg3AMB6VwvRUuFEl4smcO6xwqLKdwcKwPMLLs4SOQNfOau7Ifsp7ohcVu8KJti2fvU6hvLur3SQ7sSRu7AObRsk_mJ9tLuU6BAJpc3qa108iqB69v"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent flex items-end p-8">
          <div>
            <span className="inline-block px-4 py-1.5 bg-primary-container dark:bg-yellow-400 text-on-primary-fixed dark:text-slate-900 text-xs font-bold font-label rounded-full mb-4 uppercase tracking-widest shadow-sm">
              {lang === "VN" ? "Trạng thái hệ thống" : "System Status"}
            </span>
            <h2 className="text-white font-headline text-3xl md:text-4xl font-bold tracking-tight">
              {lang === "VN"
                ? "Hành trình hôm nay đang diễn ra suôn sẻ"
                : "Today's journeys are running smoothly"}
            </h2>
          </div>
        </div>
      </section>

      {/* SECTION 1: LỐI TẮT (QUICK LINKS) */}
      <section className="mb-16">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h3 className="font-headline text-2xl font-bold text-on-surface dark:text-white tracking-tight mb-1">
              {lang === "VN" ? "Lối tắt quản lý" : "Quick Management"}
            </h3>
            <p className="text-sm font-label text-slate-500 dark:text-slate-400">
              {lang === "VN" ? "Thao tác nhanh chóng" : "Quick actions"}
            </p>
          </div>
        </div>

        {/* Lưới các Lối tắt (Cards) - Thay đổi div thành thẻ Link */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {/* Card Doanh thu (Highlighted) */}
          <Link
            to="/admin/revenue"
            className="bg-surface-container-highest dark:bg-slate-800 p-6 rounded-[2rem] border-b-4 border-primary-container dark:border-yellow-400 hover:-translate-y-1 transition-all cursor-pointer group shadow-sm hover:shadow-md block"
          >
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-700 flex items-center justify-center mb-4 shadow-sm group-hover:shadow-md transition-shadow">
              <span className="material-symbols-outlined text-primary dark:text-yellow-400 text-3xl">
                payments
              </span>
            </div>
            <span className="block font-headline text-xl md:text-2xl font-bold text-on-surface dark:text-white mb-1">
              {lang === "VN" ? "Doanh thu" : "Revenue"}
            </span>
            <span className="text-xs font-label text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">
              Money
            </span>
          </Link>
          {[
            {
              icon: "badge",
              titleVN: "Nhân viên",
              titleEN: "Staff",
              sub: "HR",
              path: "/admin/staff",
            },
            {
              icon: "groups",
              titleVN: "Khách hàng",
              titleEN: "Customers",
              sub: "Users",
              path: "/admin/customers",
            },
            {
              icon: "book_online",
              titleVN: "Đặt vé",
              titleEN: "Booking",
              sub: "Tickets",
              path: "/admin/orders",
            },
            {
              icon: "directions_boat",
              titleVN: "Tàu cao tốc",
              titleEN: "Boats",
              sub: "Fleet",
              path: "/admin/boats",
            },
            {
              icon: "event_repeat",
              titleVN: "Lịch trình",
              titleEN: "Schedule",
              sub: "Routes",
              path: "/admin/schedules",
            },
            {
              icon: "analytics",
              titleVN: "Báo cáo",
              titleEN: "Reports",
              sub: "Data",
              path: "/admin/reports",
            },
            {
              icon: "settings",
              titleVN: "Cài đặt",
              titleEN: "Settings",
              sub: "System",
              path: "/admin/settings",
            },
          ].map((item, idx) => (
            <Link
              key={idx}
              to={item.path}
              className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] hover:-translate-y-1 transition-all cursor-pointer group shadow-sm hover:shadow-md border border-slate-100 dark:border-slate-700 block"
            >
              <div className="w-12 h-12 rounded-2xl bg-surface-container-low dark:bg-slate-700 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary dark:text-yellow-400 text-3xl">
                  {item.icon}
                </span>
              </div>
              <span className="block font-headline text-xl md:text-2xl font-bold text-on-surface dark:text-white mb-1">
                {lang === "VN" ? item.titleVN : item.titleEN}
              </span>
              <span className="text-xs font-label text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">
                {item.sub}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION 2: TỔNG QUAN DỮ LIỆU (CHARTS) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bar Chart (Biểu đồ cột) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-headline text-2xl font-bold text-on-surface dark:text-white tracking-tight">
              {lang === "VN" ? "Thống kê doanh thu" : "Revenue Statistics"}
            </h3>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-full border border-transparent dark:border-slate-700">
              <button className="px-4 py-1.5 text-xs font-bold font-label bg-white dark:bg-slate-700 rounded-full shadow-sm text-slate-900 dark:text-white transition-colors">
                {lang === "VN" ? "Theo tuần" : "Weekly"}
              </button>
              <button className="px-4 py-1.5 text-xs font-bold font-label text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                {lang === "VN" ? "Theo tháng" : "Monthly"}
              </button>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
            <div className="flex items-end justify-between h-64 gap-2">
              {barChartData.map((item, index) => (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center gap-4 group"
                >
                  <div
                    className={`w-full rounded-t-xl transition-all duration-500 group-hover:bg-primary-container dark:group-hover:bg-yellow-400/80 ${
                      item.isMax
                        ? "bg-primary dark:bg-yellow-400 shadow-lg"
                        : "bg-surface-container dark:bg-slate-700"
                    }`}
                    style={{ height: item.height }}
                  ></div>
                  <span
                    className={`text-xs font-label ${
                      item.isMax
                        ? "font-bold text-slate-900 dark:text-white"
                        : "text-slate-400 dark:text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors"
                    }`}
                  >
                    {lang === "VN" ? item.labelVN : item.labelEN}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pie Chart (Biểu đồ tròn cơ cấu) */}
        <div className="space-y-6">
          <h3 className="font-headline text-2xl font-bold text-on-surface dark:text-white tracking-tight">
            {lang === "VN" ? "Cơ cấu đặt vé" : "Booking Structure"}
          </h3>
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center transition-colors">
            {/* CSS Trick tạo biểu đồ tròn cơ bản bằng clip-path */}
            <div className="relative w-48 h-48 rounded-full border-[12px] border-surface-container-low dark:border-slate-700 flex items-center justify-center overflow-hidden transition-colors">
              <div
                className="absolute inset-0 bg-primary-container dark:bg-yellow-400/50"
                style={{
                  clipPath: "polygon(50% 50%, 50% 0, 100% 0, 100% 50%)",
                }}
              ></div>
              <div
                className="absolute inset-0 bg-primary dark:bg-yellow-400"
                style={{
                  clipPath: "polygon(50% 50%, 50% 0, 0 0, 0 100%, 50% 100%)",
                }}
              ></div>
              <div className="absolute inset-2 bg-white dark:bg-slate-800 rounded-full flex flex-col items-center justify-center z-10 shadow-inner transition-colors">
                <span className="font-headline text-3xl font-bold text-slate-900 dark:text-white">
                  1.2k
                </span>
                <span className="text-[10px] font-bold font-label text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {lang === "VN" ? "Vé/Ngày" : "Tkts/Day"}
                </span>
              </div>
            </div>

            {/* Chú thích biểu đồ */}
            <div className="mt-8 w-full space-y-4">
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-primary dark:bg-yellow-400 shadow-sm"></span>
                  <span className="text-sm font-label font-medium text-slate-600 dark:text-slate-300">
                    {lang === "VN" ? "Khách nội địa" : "Domestic"}
                  </span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  65%
                </span>
              </div>
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-primary-container dark:bg-yellow-400/50 shadow-sm"></span>
                  <span className="text-sm font-label font-medium text-slate-600 dark:text-slate-300">
                    {lang === "VN" ? "Khách quốc tế" : "International"}
                  </span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  25%
                </span>
              </div>
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-surface-container-low dark:bg-slate-600 shadow-sm"></span>
                  <span className="text-sm font-label font-medium text-slate-600 dark:text-slate-300">
                    {lang === "VN" ? "Đoàn khách VIP" : "VIP Groups"}
                  </span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  10%
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
