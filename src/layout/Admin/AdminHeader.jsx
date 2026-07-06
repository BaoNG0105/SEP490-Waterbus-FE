import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export const AdminHeader = ({ onMenuClick, title = "Dashboard" }) => {
  // Lấy các state và hàm từ AppContext
  const { isDarkMode, toggleDarkMode, lang, toggleLang } = useApp();

  return (
    <header className="fixed top-0 w-full z-40 flex justify-between items-center px-6 h-16 bg-[#124757] dark:bg-slate-900/80 text-white dark:text-slate-200 backdrop-blur-xl shadow-md border-b border-white/10 dark:border-slate-700 transition-colors duration-300">

      {/* KHỐI TRÁI & GIỮA: Tự động lùi sang phải một khoảng lg:pl-60 trên Desktop để nhường chỗ cho Sidebar cố định */}
      <div className="flex items-center gap-4 lg:pl-60 transition-all duration-300">

        {/* Nút mở Menu Drawer - Chỉ xuất hiện trên giao diện Mobile */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-white/10 dark:hover:bg-slate-800 rounded-xl text-white transition-colors"
          title="Open Menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        {/* Tiêu đề trang: Sẽ đứng ngay cạnh mép phải của Sidebar trên Desktop */}
        <div className="flex items-center">
          <h1 className="font-headline font-black text-sm sm:text-base md:text-lg uppercase tracking-wider text-white dark:text-yellow-400 select-none whitespace-nowrap">
            {title}
          </h1>
        </div>
      </div>

      {/* KHỐI PHẢI: Các nút cấu hình hệ thống nhanh (Darkmode, Ngôn ngữ, Đăng xuất) */}
      <div className="flex items-center gap-2">
        {/* Nút Toggle Dark Mode */}
        <button
          onClick={toggleDarkMode}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white/90 hover:bg-white/10 dark:text-yellow-400 dark:hover:bg-slate-800 transition-colors"
          title={
            isDarkMode
              ? lang === "VN" ? "Chế độ Sáng" : "Light Mode"
              : lang === "VN" ? "Chế độ Tối" : "Dark Mode"
          }
        >
          <span className="material-symbols-outlined text-[20px]">
            {isDarkMode ? "light_mode" : "dark_mode"}
          </span>
        </button>

        {/* Nút Toggle Language */}
        <button
          onClick={toggleLang}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black font-headline tracking-widest text-white hover:bg-white/10 dark:text-yellow-400 dark:hover:bg-slate-800 transition-colors"
          title={lang === "VN" ? "Đổi ngôn ngữ" : "Change Language"}
        >
          {lang}
        </button>

        {/* Vạch chia ngăn cách */}
        <div className="hidden md:block w-1px h-5 bg-white/20 dark:bg-slate-700 mx-1"></div>

        {/* Nút Đăng xuất tài khoản Admin */}
        <Link
          to="/"
          className="p-2 text-white/80 hover:text-red-400 hover:bg-white/10 dark:hover:bg-red-500/20 dark:hover:text-red-400 rounded-full transition-all flex items-center justify-center"
          title={lang === "VN" ? "Đăng xuất" : "Logout"}
        >
          <span className="material-symbols-outlined text-[20px]">power_settings_new</span>
        </Link>
      </div>
    </header>
  );
};