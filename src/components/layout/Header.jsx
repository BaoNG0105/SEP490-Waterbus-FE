import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export const Header = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // State theo dõi trạng thái cuộn trang
  const [isScrolled, setIsScrolled] = useState(false);
  // State quản lý việc đóng/mở Mobile Menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Hook lắng nghe sự kiện scroll
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

  // Đóng mobile menu khi cuộn trang để tránh cản trở tầm nhìn
  useEffect(() => {
    const handleScrollClose = () => {
      if (isMobileMenuOpen) setIsMobileMenuOpen(false);
    };
    window.addEventListener("scroll", handleScrollClose);
    return () => window.removeEventListener("scroll", handleScrollClose);
  }, [isMobileMenuOpen]);

  return (
    <nav
      className={`fixed top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-[1200px] z-100 rounded-full transition-all duration-500 ${
        isScrolled
          ? "bg-white shadow-2xl border border-surface-variant/50 py-1"
          : "bg-transparent border border-transparent shadow-none py-2"
      } ${isMobileMenuOpen ? "bg-white" : ""}`} // Ép nền trắng khi mở menu để không bị lỗi màu
    >
      <div className="px-6 md:px-8 py-2.5 flex justify-between items-center transition-all duration-300">
        {/* Logo (Hiển thị mọi màn hình) */}
        <div className="text-lg font-bold tracking-tighter text-slate-900 font-headline flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-xl">
            waves
          </span>
          WaterBus
        </div>

        {/* Main Links (Chỉ hiện trên Desktop - màn hình lớn 'lg') */}
        <div className="hidden lg:flex items-center gap-6">
          <a
            className="text-xs font-bold text-white bg-primary px-4 py-2 rounded-full font-headline"
            href="/"
          >
            Trang chủ
          </a>

          <div className="relative group">
            <button className="flex items-center gap-1 text-xs font-medium text-on-surface-variant group-hover:text-primary font-headline transition-colors">
              Bến tàu
              <span className="material-symbols-outlined text-xs">
                expand_more
              </span>
            </button>
            <div className="absolute top-full left-0 mt-3 w-48 bg-white shadow-xl rounded-xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 border border-surface-variant z-50">
              <Link
                to="/stations/bach-dang"
                className="block px-4 py-2 text-xs hover:bg-surface-container-low transition-colors"
              >
                Bạch Đằng
              </Link>
              <Link
                to="/stations/thu-thiem"
                className="block px-4 py-2 text-xs hover:bg-surface-container-low transition-colors"
              >
                Thủ Thiêm
              </Link>
              <Link
                to="/stations/binh-an"
                className="block px-4 py-2 text-xs hover:bg-surface-container-low transition-colors"
              >
                Bình An
              </Link>
              <Link
                to="/stations/thanh-da"
                className="block px-4 py-2 text-xs hover:bg-surface-container-low transition-colors"
              >
                Thanh Đa
              </Link>
              <Link
                to="/stations/linh-dong"
                className="block px-4 py-2 text-xs hover:bg-surface-container-low transition-colors"
              >
                Linh Đông
              </Link>
            </div>
          </div>

          <a
            className="text-xs font-medium text-on-surface-variant hover:text-primary transition-colors font-headline"
            href="#"
          >
            Lịch khởi hành
          </a>

          <div className="relative group">
            <button className="flex items-center gap-1 text-xs font-medium text-on-surface-variant group-hover:text-primary font-headline">
              Dịch vụ
              <span className="material-symbols-outlined text-xs">
                expand_more
              </span>
            </button>
            <div className="absolute top-full left-0 mt-3 w-48 bg-white shadow-xl rounded-xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 border border-surface-variant">
              <a
                className="block px-4 py-2 text-xs hover:bg-surface-container-low transition-colors"
                href="#"
              >
                Đặt vé online
              </a>
              <a
                className="block px-4 py-2 text-xs hover:bg-surface-container-low transition-colors"
                href="#"
              >
                Hướng dẫn đặt vé
              </a>
            </div>
          </div>

          <a
            className="text-xs font-medium text-on-surface-variant hover:text-primary transition-colors font-headline"
            href="#"
          >
            Khuyến Mãi
          </a>
          <a
            className="text-xs font-medium text-on-surface-variant hover:text-primary transition-colors font-headline"
            href="#"
          >
            Liên hệ
          </a>
        </div>

        {/* Cụm chức năng bên phải: Lang, Booking, Auth, Hamburger Menu */}
        <div className="flex items-center gap-3 lg:gap-4">
          {/* Lang & Booking (Chỉ hiện trên Desktop, ẩn trên Mobile) */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-4 bg-surface-container-low/50 px-5 py-2 rounded-full border border-surface-variant/30">
              <button className="text-[11px] font-bold text-primary font-headline tracking-widest">
                ENG
              </button>
              <span className="text-outline/30">|</span>
              <button className="text-[11px] font-bold text-on-surface-variant/60 font-headline tracking-widest hover:text-primary transition-colors">
                VN
              </button>
            </div>
            <a
              className="bg-primary-container text-on-primary-fixed px-8 py-2.5 rounded-full font-bold text-sm font-headline hover:brightness-105 transition-all shadow-md"
              href="#booking-section"
            >
              Booking
            </a>
          </div>

          {/* User Auth (Hiện trên cả Mobile và Desktop) */}
          <div className="flex items-center gap-2 lg:pl-4 lg:border-l border-surface-variant/30">
            {isLoggedIn ? (
              <button
                onClick={() => setIsLoggedIn(false)}
                className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-primary-container overflow-hidden border-2 border-transparent hover:border-primary transition-colors cursor-pointer shrink-0"
                title="Đăng xuất"
              >
                <img
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJgEa1CJ6nEykaMCLialWDQWttf8sV3FmrwfpNsqm6OO9JzpZ8RcUQ1TWOwuutMrcEIMzEMozSlrOI28PIho2BdBNTFUC6OzHhjFH6UfeVhwuWTTTw3dFZtDn4rSlgsCXg6TGY88SStie6-CNRXxbboKK4EiEwhyYik6ZU2tM5ytXTRHz2M_OPltBXE3K4LGi2qWZoUw6EDd5-C-Uqc-tBO_-Tgj9zqYcTicR6MYKwEvvgdWXOqHahk_6FCxc0FkAqulS6IJiVBEJc"
                />
              </button>
            ) : (
              <a
                href="/login"
                className="text-sm font-bold font-headline text-on-surface hover:text-primary transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-lg">login</span>
                {/* Ẩn chữ Sign In trên màn hình quá nhỏ để tiết kiệm chỗ */}
                <span className="hidden sm:inline">Sign In</span>
              </a>
            )}
          </div>

          {/* Nút Hamburger (Chỉ hiện trên Mobile) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden flex items-center justify-center text-slate-900 hover:text-primary transition-colors p-1"
          >
            <span className="material-symbols-outlined text-2xl">
              {isMobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================= */}
      {/* MOBILE MENU DROPDOWN */}
      {/* ========================================= */}
      <div
        className={`absolute top-[105%] left-0 w-full bg-white shadow-2xl rounded-2xl border border-surface-variant/50 transition-all duration-300 origin-top flex flex-col overflow-hidden lg:hidden ${
          isMobileMenuOpen
            ? "scale-y-100 opacity-100 visible"
            : "scale-y-0 opacity-0 invisible"
        } max-h-[80vh] overflow-y-auto no-scrollbar`}
      >
        <div className="p-6 flex flex-col gap-5">
          <a
            href="/"
            className="font-bold text-slate-900 text-base"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Trang chủ
          </a>

          <div className="flex flex-col gap-2">
            <span className="font-bold text-slate-900 text-base">Bến tàu</span>
            <div className="flex flex-col gap-3 pl-4 border-l-2 border-surface-variant/50 ml-2 mt-1">
              <a
                href="#"
                className="text-slate-600 text-sm font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Bạch Đằng
              </a>
              <a
                href="#"
                className="text-slate-600 text-sm font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Bình An
              </a>
              <a
                href="#"
                className="text-slate-600 text-sm font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Thanh Đa
              </a>
              <a
                href="#"
                className="text-slate-600 text-sm font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Hiệp Bình Chánh
              </a>
              <a
                href="#"
                className="text-slate-600 text-sm font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Linh Đông
              </a>
            </div>
          </div>

          <a
            href="#"
            className="font-bold text-slate-900 text-base"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Lịch khởi hành
          </a>

          <div className="flex flex-col gap-2">
            <span className="font-bold text-slate-900 text-base">Dịch vụ</span>
            <div className="flex flex-col gap-3 pl-4 border-l-2 border-surface-variant/50 ml-2 mt-1">
              <a
                href="#"
                className="text-slate-600 text-sm font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Đặt vé online
              </a>
              <a
                href="#"
                className="text-slate-600 text-sm font-medium"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Hướng dẫn đặt vé
              </a>
            </div>
          </div>

          <a
            href="#"
            className="font-bold text-slate-900 text-base"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Khuyến Mãi
          </a>
          <a
            href="#"
            className="font-bold text-slate-900 text-base"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Liên hệ
          </a>

          <hr className="border-surface-variant/50 my-2" />

          {/* Button Booking Mobile */}
          <a
            href="#booking-section"
            onClick={(e) => {
              setIsMobileMenuOpen(false);
              // Hỗ trợ trượt xuống khi bấm Booking ở Mobile Menu
              if (window.location.pathname === "/") {
                e.preventDefault();
                document
                  .querySelector("#booking-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            className="bg-primary-container text-center text-on-primary-fixed px-8 py-3.5 rounded-xl font-bold text-sm font-headline hover:brightness-105 transition-all shadow-md"
          >
            Booking Now
          </a>

          {/* Language Mobile */}
          <div className="flex justify-center items-center gap-4 bg-surface-container-low/50 px-5 py-3 rounded-xl border border-surface-variant/30 mt-1">
            <button className="text-xs font-bold text-primary font-headline tracking-widest">
              ENG
            </button>
            <span className="text-outline/30">|</span>
            <button className="text-xs font-bold text-on-surface-variant/60 font-headline tracking-widest hover:text-primary transition-colors">
              VN
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
