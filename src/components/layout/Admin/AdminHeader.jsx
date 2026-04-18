import { Link, useLocation } from "react-router-dom";
import { useApp } from "../../../context/AppContext";

export const AdminHeader = ({ onMenuClick, title = "Dashboard" }) => {
  // Lấy các state và hàm từ AppContext
  const { isDarkMode, toggleDarkMode, lang, toggleLang } = useApp();
  const location = useLocation();

  // Danh sách thứ tự các trang quản lý để điều hướng Trái/Phải
  const adminRoutes = [
    "/admin",
    "/admin/customers",
    "/admin/staff",
    "/admin/orders",
    "/admin/boats",
    "/admin/revenue",
    "/admin/schedules",
    "/admin/reports",
    "/admin/settings",
  ];

  // Tìm vị trí (index) của trang hiện tại
  const currentIndex = adminRoutes.indexOf(location.pathname);

  // Tính toán trang Trước và Sau (Hỗ trợ vòng lặp)
  const prevPath =
    currentIndex > 0
      ? adminRoutes[currentIndex - 1]
      : adminRoutes[adminRoutes.length - 1];
  const nextPath =
    currentIndex !== -1 && currentIndex < adminRoutes.length - 1
      ? adminRoutes[currentIndex + 1]
      : adminRoutes[0];

  return (
    <header className="fixed top-0 w-full z-40 flex justify-between items-center px-6 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm border-b border-surface-variant/30 dark:border-slate-700 transition-colors duration-300">
      {/* Góc trái: Nút Menu & User */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 hover:bg-surface-container-high dark:hover:bg-slate-800 rounded-full transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>
        <div className="hidden md:flex items-center gap-2 p-1.5 hover:bg-surface-container-high dark:hover:bg-slate-800 rounded-full transition-all cursor-pointer group">
          <img
            alt="Admin User Profile"
            className="w-8 h-8 rounded-full border-2 border-primary-container dark:border-yellow-400/50 group-hover:scale-105 transition-transform"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuADMVsI0H3kN8WDYHnyrq7wm7SdS8nWLXViYjuzhFc3tw238BicYlpjepVsFfiKEUFU6Vnkf7RDiHYcGLbrjIBw1YBVFv7bUIBwo_T5o08XoKUr_zoloAMj0GeU9z77tpwCFqe9GvANih8NQ-ifhmHxN9l9JipFCIIjx4yP_lAMBmFyzyEnoTMV-8iekwOMKa1nESmcglccEloKaITn3KHM_H7HK5zz1p5qVRhnhcdamBT3KJQCLvlegqDMWroSI4UojeqDL0GCKK_A"
          />
          <span className="font-label text-sm font-bold text-slate-900 dark:text-white pr-2">
            {lang === "VN" ? "Quản trị viên" : "Administrator"}
          </span>
        </div>
      </div>

      {/* Chính giữa: Navigation Arrows & Title Trang */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4">
        <Link
          to={prevPath}
          title={lang === "VN" ? "Trang trước" : "Previous Page"}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-yellow-400 transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">
            chevron_left
          </span>
        </Link>

        {/* Title bọc trong div fix cứng width để các mũi tên không bị giật/nhảy khi đổi trang có tên dài/ngắn khác nhau */}
        <div className="min-w-[130px] md:min-w-[180px] text-center">
          <h1 className="font-headline font-bold tracking-tight text-lg md:text-xl text-slate-900 dark:text-white whitespace-nowrap overflow-hidden text-ellipsis">
            {title}
          </h1>
        </div>

        <Link
          to={nextPath}
          title={lang === "VN" ? "Trang sau" : "Next Page"}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-yellow-400 transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">
            chevron_right
          </span>
        </Link>
      </div>

      {/* Góc phải: Toggles & Nút Power Off */}
      <div className="flex items-center gap-1 md:gap-2">
        {/* Nút Toggle Dark Mode */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-surface-container-low dark:hover:bg-slate-800 hover:text-primary dark:hover:text-yellow-400 transition-colors"
          title={
            isDarkMode
              ? lang === "VN"
                ? "Sáng"
                : "Light Mode"
              : lang === "VN"
                ? "Tối"
                : "Dark Mode"
          }
        >
          <span className="material-symbols-outlined text-[20px]">
            {isDarkMode ? "light_mode" : "dark_mode"}
          </span>
        </button>

        {/* Nút Toggle Language */}
        <button
          onClick={toggleLang}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-primary dark:text-yellow-400 font-headline tracking-widest hover:bg-surface-container-low dark:hover:bg-slate-800 transition-colors"
          title={lang === "VN" ? "Đổi ngôn ngữ" : "Change Language"}
        >
          {lang}
        </button>

        {/* Vạch kẻ phân cách */}
        <div className="hidden md:block w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

        {/* Nút Power Off */}
        <Link
          to="/login"
          className="p-2 hover:bg-error-container dark:hover:bg-red-500/20 hover:text-error dark:hover:text-red-400 rounded-full transition-all group flex items-center justify-center"
          title={lang === "VN" ? "Đăng xuất" : "Logout"}
        >
          <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 group-hover:text-error dark:group-hover:text-red-400 transition-colors">
            power_settings_new
          </span>
        </Link>
      </div>
    </header>
  );
};
