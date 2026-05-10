import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../../features/auth/authSlice";
import Swal from "sweetalert2";

export const Header = () => {
  const { isDarkMode, toggleDarkMode, lang, toggleLang } = useApp();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const location = useLocation();
  const currentPath = location.pathname;

  // Khởi tạo dispatch và navigate
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isHomeActive = currentPath === "/";
  // Đã xóa biến isStationsActive
  const isPromotionsActive = currentPath.startsWith("/promotions");
  const isContactActive = currentPath === "/contact";

  // LẤY DỮ LIỆU TỪ REDUX STORE (Thay cho localStorage)
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  // logic hiển thị tên và ảnh
  const defaultAvatar =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCJgEa1CJ6nEykaMCLialWDQWttf8sV3FmrwfpNsqm6OO9JzpZ8RcUQ1TWOwuutMrcEIMzEMozSlrOI28PIho2BdBNTFUC6OzHhjFH6UfeVhwuWTTTw3dFZtDn4rSlgsCXg6TGY88SStie6-CNRXxbboKK4EiEwhyYik6ZU2tM5ytXTRHz2M_OPltBXE3K4LGi2qWZoUw6EDd5-C-Uqc-tBO_-Tgj9zqYcTicR6MYKwEvvgdWXOqHahk_6FCxc0FkAqulS6IJiVBEJc";
  const displayAvatar = user?.avatarUrl || defaultAvatar;
  const displayUserName =
    user?.fullName || (lang === "VN" ? "Thành viên" : "Member");

  // Logic tự động đăng xuất sau 30p
  useEffect(() => {
    // Chỉ chạy nếu đã đăng nhập
    if (!isAuthenticated) return;

    const expirationTime = localStorage.getItem("expirationTime");
    if (!expirationTime) return;

    // Tính toán thời gian còn lại
    const currentTime = new Date().getTime();
    const timeLeft = parseInt(expirationTime) - currentTime;

    const handleForceLogout = () => {
      dispatch(logout()); // Xóa sạch dữ liệu Redux và LocalStorage

      Swal.fire({
        icon: 'info',
        title: lang === "VN" ? 'Hết phiên đăng nhập' : 'Session Expired',
        text: lang === "VN"
          ? 'Tài khoản của bạn đã tự động đăng xuất sau 30 phút để bảo mật.'
          : 'You have been automatically logged out after 30 minutes for security.',
        confirmButtonColor: "#3085d6",
        confirmButtonText: lang === "VN" ? 'Đăng nhập lại' : 'Sign in again',
        background: isDarkMode ? '#1e293b' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#0f172a',
        allowOutsideClick: false // Bắt buộc người dùng phải bấm nút
      }).then(() => {
        navigate('/login');
      });
    };

    // Nếu F5 mà thấy đã quá 30 phút -> Kích văng ra ngoài luôn
    if (timeLeft <= 0) {
      handleForceLogout();
    } else {
      // Đặt bộ đếm đếm ngược đúng số giây còn lại
      const timer = setTimeout(() => {
        handleForceLogout();
      }, timeLeft);

      // Dọn dẹp timer nếu component unmount (ví dụ user tự bấm logout trước)
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, dispatch, navigate, lang, isDarkMode]);

  // logic scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleScrollClose = () => {
      if (isMobileMenuOpen) setIsMobileMenuOpen(false);
    };
    window.addEventListener("scroll", handleScrollClose);
    return () => window.removeEventListener("scroll", handleScrollClose);
  }, [isMobileMenuOpen]);

  return (
    <nav
      className={`fixed top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-1200px z-100 rounded-full transition-all duration-500 ${isScrolled
        ? "bg-white dark:bg-slate-900 shadow-2xl border border-surface-variant/50 dark:border-slate-700 py-1"
        : "bg-transparent border border-transparent shadow-none py-2"
        } ${isMobileMenuOpen ? "bg-white dark:bg-slate-900" : ""}`}
    >
      <div className="px-6 md:px-8 py-2.5 flex justify-between items-center transition-all duration-300">
        {/* Home */}
        <div className="hidden lg:flex items-center gap-6">
          <Link
            className={`text-xs font-bold px-4 py-2 rounded-full font-headline transition-colors ${isHomeActive
              ? "bg-primary dark:bg-yellow-400 text-white dark:text-slate-900"
              : "text-on-surface-variant dark:text-white/80 hover:text-primary dark:hover:text-yellow-400"
              }`}
            to="/"
          >
            {lang === "VN" ? "Trang chủ" : "Home"}
          </Link>

          {/* Schedule */}
          <Link
            className={`text-xs font-medium font-headline transition-colors ${currentPath === "/schedule"
              ? "text-primary dark:text-yellow-400 font-bold"
              : "text-on-surface-variant dark:text-white/80 hover:text-primary dark:hover:text-yellow-400"
              }`}
            to="/"
          >
            {lang === "VN" ? "Lịch khởi hành" : "Schedule"}
          </Link>

          {/* Booking */}
          <div className="relative group">
            <button className="flex items-center gap-1 text-xs font-medium text-on-surface-variant dark:text-white/80 group-hover:text-primary dark:group-hover:text-yellow-400 font-headline transition-colors">
              {lang === "VN" ? "Dịch vụ" : "Services"}
              <span className="material-symbols-outlined text-xs">
                expand_more
              </span>
            </button>
            <div className="absolute top-full left-0 mt-3 w-48 bg-white dark:bg-slate-800 shadow-xl rounded-xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 border border-surface-variant dark:border-slate-700">
              <Link
                className="block px-4 py-2 text-xs text-slate-900 dark:text-white hover:bg-surface-container-low dark:hover:bg-slate-700 transition-colors"
                to="/"
              >
                {lang === "VN"
                  ? "Đặt vé online & hướng dẫn"
                  : "Book Online & Guide"}
              </Link>
              <Link
                className="block px-4 py-2 text-xs text-slate-900 dark:text-white hover:bg-surface-container-low dark:hover:bg-slate-700 transition-colors"
                to="/"
              >
                {lang === "VN" ? "Kiểm tra vé" : "Check Ticket"}
              </Link>
            </div>
          </div>

          {/* Promotion */}
          <Link
            className={`text-xs font-bold px-4 py-2 rounded-full font-headline transition-colors ${isPromotionsActive
              ? "bg-primary dark:bg-yellow-400 text-white dark:text-slate-900"
              : "text-on-surface-variant dark:text-white/80 hover:text-primary dark:hover:text-yellow-400"
              }`}
            to="/promotions"
          >
            {lang === "VN" ? "Khuyến Mãi" : "Promotions"}
          </Link>

          {/* Contact */}
          <Link
            className={`text-xs font-bold px-4 py-2 rounded-full font-headline transition-colors ${isContactActive
              ? "bg-primary dark:bg-yellow-400 text-white dark:text-slate-900"
              : "text-on-surface-variant dark:text-white/80 hover:text-primary dark:hover:text-yellow-400"
              }`}
            to="/contact"
          >
            {lang === "VN" ? "Liên hệ" : "Contact"}
          </Link>
        </div>

        {/* Darkmode & Booking */}
        <div className="flex items-center gap-3 lg:gap-4">
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-low/50 dark:bg-slate-800/50 border border-surface-variant/30 dark:border-slate-600 text-on-surface-variant dark:text-white hover:text-primary dark:hover:text-yellow-400 hover:bg-surface-container dark:hover:bg-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDarkMode ? "light_mode" : "dark_mode"}
              </span>
            </button>

            <button
              onClick={toggleLang}
              className="w-12 h-10 rounded-full flex items-center justify-center bg-surface-container-low/50 dark:bg-slate-800/50 border border-surface-variant/30 dark:border-slate-600 text-[11px] font-bold text-primary dark:text-yellow-400 font-headline tracking-widest hover:bg-surface-container dark:hover:bg-slate-700 transition-colors"
            >
              {lang}
            </button>

            <a
              className="bg-primary-container dark:bg-yellow-400 text-on-primary-fixed dark:text-slate-900 px-8 py-2.5 rounded-full font-bold text-sm font-headline hover:brightness-105 transition-all shadow-md ml-1"
              href="/#booking-section"
            >
              {lang === "VN" ? "Đặt vé ngay" : "Book Now"}
            </a>
          </div>

          {/* User */}
          <div className="flex items-center gap-2 lg:pl-4 lg:border-l border-surface-variant/30 dark:border-slate-600">
            {isAuthenticated ? (
              <Link
                to="/profile"
                className="flex items-center gap-2 pl-1 pr-1 sm:pr-3 py-1 rounded-full bg-surface-container-low dark:bg-slate-800/80 border border-surface-variant/30 dark:border-slate-600 hover:border-primary dark:hover:border-yellow-400 transition-colors cursor-pointer"
                title={lang === "VN" ? "Hồ sơ của tôi" : "My Profile"}
              >
                <div className="w-8 h-8 rounded-full bg-primary-container overflow-hidden shrink-0">
                  <img
                    alt="User Avatar"
                    className="w-full h-full object-cover"
                    src={displayAvatar}
                  />
                </div>
                <span className="hidden sm:block text-xs font-bold font-headline text-slate-900 dark:text-white line-clamp-1 max-w-80px">
                  {displayUserName}
                </span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-sm font-bold font-headline text-on-surface dark:text-white hover:text-primary dark:hover:text-yellow-400 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-lg">login</span>
                <span className="hidden sm:inline">
                  {lang === "VN" ? "Đăng nhập" : "Sign In"}
                </span>
              </Link>
            )}
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden flex items-center justify-center text-slate-900 dark:text-white hover:text-primary dark:hover:text-yellow-400 transition-colors p-1"
          >
            <span className="material-symbols-outlined text-2xl">
              {isMobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* MOBILE MENU DROPDOWN */}
      <div
        className={`absolute top-[105%] left-0 w-full bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-surface-variant/50 dark:border-slate-700 transition-all duration-300 origin-top flex flex-col overflow-hidden lg:hidden ${isMobileMenuOpen
          ? "scale-y-100 opacity-100 visible"
          : "scale-y-0 opacity-0 invisible"
          } max-h-[80vh] overflow-y-auto no-scrollbar`}
      >
        <div className="p-6 flex flex-col gap-5">
          <Link
            to="/"
            className={`font-bold text-base ${isHomeActive ? "text-primary dark:text-yellow-400" : "text-slate-900 dark:text-white"}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {lang === "VN" ? "Trang chủ" : "Home"}
          </Link>

          <Link
            to="/"
            className="font-bold text-slate-900 dark:text-white text-base"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {lang === "VN" ? "Lịch khởi hành" : "Schedule"}
          </Link>

          <div className="flex flex-col gap-2">
            <span className="font-bold text-slate-900 dark:text-white text-base">
              {lang === "VN" ? "Dịch vụ" : "Services"}
            </span>
            <div className="flex flex-col gap-3 pl-4 border-l-2 border-surface-variant/50 dark:border-slate-700 ml-2 mt-1">
              <Link
                to="/"
                className="text-slate-600 dark:text-slate-300 text-sm font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {lang === "VN"
                  ? "Đặt vé online & hướng dẫn"
                  : "Book Online & Guide"}
              </Link>
              <Link
                to="/"
                className="text-slate-600 dark:text-slate-300 text-sm font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {lang === "VN" ? "Kiểm tra vé" : "Check Ticket"}
              </Link>
            </div>
          </div>

          <Link
            to="/promotions"
            className="font-bold text-slate-900 dark:text-white text-base"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {lang === "VN" ? "Khuyến Mãi" : "Promotions"}
          </Link>
          <Link
            to="/contact"
            className="font-bold text-slate-900 dark:text-white text-base"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {lang === "VN" ? "Liên hệ" : "Contact"}
          </Link>

          <hr className="border-surface-variant/50 dark:border-slate-700 my-2" />

          {/* Button Booking Mobile */}
          <a
            href="/#booking-section"
            onClick={(e) => {
              setIsMobileMenuOpen(false);
              if (window.location.pathname === "/") {
                e.preventDefault();
                document
                  .querySelector("#booking-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            className="bg-primary-container dark:bg-yellow-400 text-center text-on-primary-fixed dark:text-slate-900 px-8 py-3.5 rounded-xl font-bold text-sm font-headline hover:brightness-105 transition-all shadow-md"
          >
            {lang === "VN" ? "Đặt vé ngay" : "Book Now"}
          </a>

          {/* Theme & Language Mobile */}
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              onClick={toggleDarkMode}
              className="flex justify-center items-center gap-2 bg-surface-container-low/50 dark:bg-slate-800 border border-surface-variant/30 dark:border-slate-600 px-5 py-3 rounded-xl text-on-surface-variant dark:text-white hover:text-primary dark:hover:text-yellow-400 transition-colors font-headline text-sm font-bold"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDarkMode ? "light_mode" : "dark_mode"}
              </span>
              {isDarkMode ? "Sáng" : "Tối"}
            </button>

            <button
              onClick={toggleLang}
              className="flex justify-center items-center gap-2 bg-surface-container-low/50 dark:bg-slate-800 border border-surface-variant/30 dark:border-slate-600 px-5 py-3 rounded-xl text-primary dark:text-yellow-400 font-headline text-sm font-bold tracking-widest hover:brightness-110 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                translate
              </span>
              {lang}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};