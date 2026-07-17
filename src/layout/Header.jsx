import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../redux/authSlice";
import { notify } from "../utils/swalToast";

// Import file ảnh logo từ thư mục assets
import logo from "../assets/logo-1.png";

export const Header = ({ isNoticeVisible }) => {
  const { isDarkMode, toggleDarkMode, lang, toggleLang } = useApp();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileServicesOpen, setIsMobileServicesOpen] = useState(false);

  const location = useLocation();
  const currentPath = location.pathname;

  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Xác định trạng thái Active chuẩn tông màu theo đường dẫn URL
  const isHomeActive = currentPath === "/";
  const isPromotionsActive = currentPath.startsWith("/promotions");
  const isBlogActive = currentPath.startsWith("/blog");
  const isContactActive = currentPath === "/contact";

  // LẤY DỮ LIỆU TỪ REDUX STORE (auth state)
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  // logic hiển thị tên và ảnh đại diện
  const defaultAvatar = "https://res.cloudinary.com/dygipvoal/image/upload/v1782985383/piwocu1i25ijlua88bn0.webp";
  const displayAvatar = user?.avatarUrl || defaultAvatar;
  const displayUserName = user?.fullName || (lang === "VN" ? "Thành viên" : "Member");

  // Kiểm tra quyền quản trị để hiển thị nút chuyển đến trang Admin Dashboard
  const adminRoles = ["ADMIN", "STAFF", "MANAGER"];
  const isAdminUser = isAuthenticated && user?.roles?.some((role) => adminRoles.includes(role.systemName));

  // Logic tự động đăng xuất sau 30p bảo mật
  useEffect(() => {
    if (!isAuthenticated) return;

    const expirationTime = localStorage.getItem("expirationTime");
    if (!expirationTime) return;

    const currentTime = new Date().getTime();
    const timeLeft = parseInt(expirationTime) - currentTime;

    const handleForceLogout = () => {
      dispatch(logout());
      // PayOS return: đừng xóa URL success — để user đăng nhập rồi quay lại sync.
      if (currentPath.startsWith("/payment/")) {
        const next = `${location.pathname}${location.search || ""}`;
        navigate(`/login?redirect=${encodeURIComponent(next)}`, { replace: true });
        return;
      }
      notify({
        dialog: true,
        icon: 'info',
        title: lang === "VN" ? 'Hết phiên đăng nhập' : 'Session Expired',
        text: lang === "VN"
          ? 'Tài khoản của bạn đã hết hạn truy cập. Vui lòng đăng nhập lại để tiếp tục sử dụng dịch vụ.'
          : 'You have been logged out due to inactivity. Please sign in again to continue using the service.',
        confirmButtonText: lang === "VN" ? 'Đăng nhập lại' : 'Sign in again',
        allowOutsideClick: false,
        showCancelButton: false,
      }).then(() => {
        navigate('/login');
      });
    };

    if (timeLeft <= 0) {
      handleForceLogout();
    } else {
      const timer = setTimeout(() => {
        handleForceLogout();
      }, timeLeft);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, dispatch, navigate, lang, isDarkMode, currentPath, location.pathname, location.search]);

  // logic cuộn chuột để thay đổi shadow hiệu ứng nổi
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
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

  useEffect(() => {
    if (!isMobileMenuOpen) setIsMobileServicesOpen(false);
  }, [isMobileMenuOpen]);

  // ĐỒNG BỘ MÀU CHỮ VỚI FOOTER: Nền #124757 nên chữ bình thường màu trắng, active/hover màu vàng rực rỡ
  const linkBaseClasses = "text-sm font-semibold text-white/90 dark:text-slate-300 hover:text-yellow-400 dark:hover:text-yellow-400 pb-1 border-b-2 border-transparent transition-all duration-300";
  const linkActiveClasses = "text-sm font-bold text-yellow-400 dark:text-yellow-400 pb-1 border-b-2 border-yellow-400 dark:border-yellow-400 transition-all duration-300";

  return (
    <nav
      className={`fixed left-0 w-full z-100 bg-[#124757] dark:bg-slate-900 border-b border-white/10 dark:border-slate-800/80 transition-all duration-300 ${isNoticeVisible ? "top-10" : "top-0"
        } ${isScrolled ? "shadow-xl py-1" : "shadow-sm py-2"}`}
    >
      <div className="px-6 md:px-12 flex items-center justify-between">

        {/* Left Section: Logo thương hiệu kích thước to rõ nét */}
        <Link to="/" className="flex items-center shrink-0">
          <img src={logo} alt="WaterBus Logo" className="w-20 md:w-30 h-auto transition-all duration-300" />
        </Link>

        {/* Center Section: Cấu trúc danh sách Menu đồng bộ màu Footer */}
        <div className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {/* Trang chủ */}
          <Link className={isHomeActive ? linkActiveClasses : linkBaseClasses} to="/">
            {lang === "VN" ? "Trang chủ" : "Home"}
          </Link>

          {/* Lịch khởi hành */}
          <Link className={linkBaseClasses} to="/schedule">
            {lang === "VN" ? "Lịch khởi hành" : "Schedule"}
          </Link>

          {/* Khuyến mãi */}
          <Link className={isPromotionsActive ? linkActiveClasses : linkBaseClasses} to="/promotions">
            {lang === "VN" ? "Khuyến mãi" : "Promotions"}
          </Link>

          {/* Dịch vụ với Dropdown */}
          <div className="relative group">
            <button className={`flex items-center gap-1.5 ${linkBaseClasses} group-hover:text-yellow-400 dark:group-hover:text-yellow-400`}>
              {lang === "VN" ? "Dịch vụ" : "Services"}
              <span className="material-symbols-outlined text-xs">expand_more</span>
            </button>
            <div className="absolute top-full left-0 mt-3 w-56 bg-[#FFFFFF] dark:bg-slate-800 shadow-xl rounded-2xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 border border-slate-100 dark:border-slate-700 z-50">
              <Link
                className="block px-5 py-2.5 text-xs font-medium text-[#111C2D] dark:text-white/80 hover:text-[#124757] dark:hover:text-yellow-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                to="/waterbus-booking"
              >
                {lang === "VN" ? "Đặt vé Waterbus" : "Waterbus Booking"}
              </Link>
              <Link
                className="block px-5 py-2.5 text-xs font-medium text-[#111C2D] dark:text-white/80 hover:text-[#124757] dark:hover:text-yellow-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                to="/watersightseeing-booking"
              >
                {lang === "VN" ? "Đặt vé WaterSightseeing" : "WaterSightseeing Booking"}
              </Link>
              <Link
                className="block px-5 py-2.5 text-xs font-medium text-[#111C2D] dark:text-white/80 hover:text-[#124757] dark:hover:text-yellow-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-t border-slate-50 dark:border-slate-700/50 mt-1"
                to="/charter-booking"
              >
                {lang === "VN" ? "Dịch vụ thuê tàu" : "Charter Booking"}
              </Link>
            </div>
          </div>

          {/* Tin tức */}
          <Link className={isBlogActive ? linkActiveClasses : linkBaseClasses} to="/blog">
            {lang === "VN" ? "Tin tức" : "Blog"}
          </Link>

          {/* Liên hệ */}
          <Link className={isContactActive ? linkActiveClasses : linkBaseClasses} to="/contact">
            {lang === "VN" ? "Liên hệ" : "Contact"}
          </Link>
        </div>

        {/* Right Section: Khu vực tính năng xếp chồng phẳng màu trắng sáng */}
        <div className="flex items-center gap-4 md:gap-5">

          <div className="hidden lg:flex flex-col items-center justify-center gap-1 px-1">
            {/* Nút chuyển đổi Dark/Light mode phẳng */}
            <button
              onClick={toggleDarkMode}
              className="text-white hover:text-yellow-400 dark:text-white dark:hover:text-yellow-400 transition-colors p-0.5 flex items-center justify-center outline-none select-none"
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              <span className="material-symbols-outlined text-[18px] leading-none">
                {isDarkMode ? "light_mode" : "dark_mode"}
              </span>
            </button>

            {/* Nút hiển thị Ngôn ngữ phẳng */}
            <button
              onClick={toggleLang}
              className="text-[10px] font-bold text-white/90 dark:text-yellow-400 tracking-wider hover:text-yellow-400 transition-colors uppercase py-0.5 outline-none select-none"
              title="Change Language"
            >
              {lang}
            </button>
          </div>

          {/* Profile cá nhân */}
          <div className="flex items-center gap-2 lg:pl-4 lg:border-l border-white/20 dark:border-slate-700">
            {isAdminUser && (
              <Link
                to="/admin"
                className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-white/10 dark:bg-slate-800 border border-white/10 dark:border-slate-700 hover:border-yellow-400 dark:hover:border-yellow-400 transition-colors text-white hover:text-yellow-400 shrink-0"
                title={lang === "VN" ? "Trang quản trị" : "Admin Dashboard"}
                aria-label={lang === "VN" ? "Trang quản trị" : "Admin Dashboard"}
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">admin_panel_settings</span>
              </Link>
            )}
            {isAuthenticated ? (
              <Link
                to="/profile"
                className="flex items-center justify-center rounded-full bg-white/10 p-0.5 dark:bg-slate-800 border border-white/10 dark:border-slate-700 hover:border-yellow-400 dark:hover:border-yellow-400 transition-colors cursor-pointer shadow-sm shrink-0"
                title={displayUserName}
                aria-label={lang === "VN" ? "Hồ sơ của tôi" : "My Profile"}
              >
                <div className="w-8 h-8 rounded-full bg-white/20 overflow-hidden">
                  <img alt="" className="w-full h-full object-cover" src={displayAvatar} />
                </div>
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-sm font-bold text-white hover:text-yellow-400 dark:text-white dark:hover:text-yellow-400 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-lg">login</span>
                <span className="hidden sm:inline">{lang === "VN" ? "Đăng nhập" : "Sign In"}</span>
              </Link>
            )}
          </div>

          {/* Book Now button nổi bật góc phải */}
          <a
            className="hidden sm:block bg-white dark:bg-yellow-400 text-[#124757] dark:text-slate-900 px-7 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider hover:bg-yellow-400 hover:text-slate-900 dark:hover:brightness-110 transition-all shadow-md"
            href="/#services-section"
          >
            {lang === "VN" ? "Đặt vé ngay" : "Book Now"}
          </a>

          {/* Mobile hamburger menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden flex items-center justify-center text-white hover:text-yellow-400 dark:text-white dark:hover:text-yellow-400 transition-colors p-1"
          >
            <span className="material-symbols-outlined text-2xl">
              {isMobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* MOBILE MENU DROPDOWN */}
      <div
        className="absolute top-full left-0 w-full bg-[#124757] dark:bg-slate-900 shadow-2xl rounded-2xl border border-white/10 dark:border-slate-800 transition-all duration-300 origin-top flex flex-col overflow-hidden lg:hidden"
        style={{
          transform: isMobileMenuOpen ? "scaleY(1)" : "scaleY(0)",
          opacity: isMobileMenuOpen ? 1 : 0,
          visibility: isMobileMenuOpen ? "visible" : "hidden",
          maxHeight: "80vh"
        }}
      >
        <div className="p-6 flex flex-col gap-5 overflow-y-auto no-scrollbar">
          <Link
            to="/"
            className={`font-bold text-base transition-colors ${isHomeActive ? "text-yellow-400" : "text-white"}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {lang === "VN" ? "Trang chủ" : "Home"}
          </Link>

          <Link
            to="/promotions"
            className={`font-bold text-base transition-colors ${isPromotionsActive ? "text-yellow-400" : "text-white"}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {lang === "VN" ? "Khuyến mãi" : "Promotions"}
          </Link>

          <Link
            to="/schedule"
            className="font-bold text-white text-base hover:text-yellow-400"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {lang === "VN" ? "Lịch khởi hành" : "Schedule"}
          </Link>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setIsMobileServicesOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-2 font-bold text-white text-base hover:text-yellow-400 transition-colors"
              aria-expanded={isMobileServicesOpen}
            >
              <span>{lang === "VN" ? "Dịch vụ" : "Services"}</span>
              <span
                className={`material-symbols-outlined text-xl leading-none transition-transform ${isMobileServicesOpen ? "rotate-180" : ""}`}
              >
                expand_more
              </span>
            </button>
            {isMobileServicesOpen ? (
              <div className="flex flex-col gap-3 pl-3">
                <Link
                  to="/waterbus-booking"
                  className="text-white/80 text-sm font-medium hover:text-yellow-400"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {lang === "VN" ? "Đặt vé Waterbus" : "Waterbus Booking"}
                </Link>
                <Link
                  to="/watersightseeing-booking"
                  className="text-white/80 text-sm font-medium hover:text-yellow-400"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {lang === "VN" ? "Đặt vé WaterSightseeing" : "WaterSightseeing Booking"}
                </Link>
                <Link
                  to="/charter-booking"
                  className="text-white/80 text-sm font-medium hover:text-yellow-400"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {lang === "VN" ? "Dịch vụ thuê tàu" : "Charter Booking"}
                </Link>
              </div>
            ) : null}
          </div>

          <Link
            to="/blog"
            className={`font-bold text-base transition-colors ${isBlogActive ? "text-yellow-400" : "text-white"}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {lang === "VN" ? "Tin tức" : "Blog"}
          </Link>

          <Link
            to="/contact"
            className={`font-bold text-base transition-colors ${isContactActive ? "text-yellow-400" : "text-white"}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {lang === "VN" ? "Liên hệ" : "Contact"}
          </Link>

          {isAdminUser && (
            <Link
              to="/admin"
              className="flex items-center gap-2 font-bold text-base text-white hover:text-yellow-400 transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
              {lang === "VN" ? "Trang quản trị" : "Admin Dashboard"}
            </Link>
          )}

          <hr className="border-white/10 dark:border-slate-800 my-2" />

          <a
            href="/#booking-section"
            onClick={(e) => {
              setIsMobileMenuOpen(false);
              if (window.location.pathname === "/") {
                e.preventDefault();
                document.querySelector("#booking-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            className="bg-white dark:bg-yellow-400 text-center text-[#124757] dark:text-slate-900 px-8 py-3.5 rounded-xl font-bold text-sm shadow-md hover:bg-yellow-400 hover:text-slate-900 transition-colors"
          >
            {lang === "VN" ? "Đặt vé ngay" : "Book Now"}
          </a>

          <div className="grid grid-cols-2 gap-3.5 mt-1">
            <button
              onClick={toggleDarkMode}
              className="flex justify-center items-center gap-2.5 bg-white/10 dark:bg-slate-800 border border-white/10 dark:border-slate-700 px-5 py-3 rounded-xl text-white font-bold text-sm shadow-sm hover:text-yellow-400 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDarkMode ? "light_mode" : "dark_mode"}
              </span>
              {isDarkMode ? "Sáng" : "Tối"}
            </button>

            <button
              onClick={toggleLang}
              className="flex justify-center items-center gap-2.5 bg-white/10 dark:bg-slate-800 border border-white/10 dark:border-slate-700 px-5 py-3 rounded-xl text-white dark:text-yellow-400 font-bold text-sm tracking-widest uppercase shadow-sm hover:text-yellow-400 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">translate</span>
              {lang}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
