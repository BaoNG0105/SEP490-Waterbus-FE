import { useState, useEffect } from "react";

export const Header = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Thêm state để theo dõi trạng thái cuộn trang
  const [isScrolled, setIsScrolled] = useState(false);

  // Hook lắng nghe sự kiện scroll
  useEffect(() => {
    const handleScroll = () => {
      // Nếu cuộn xuống quá 20px thì đổi trạng thái
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    // Gắn sự kiện khi component mount
    window.addEventListener("scroll", handleScroll);

    // Dọn dẹp sự kiện khi component unmount
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      // Sử dụng Template Literal (``) để thay đổi class dựa trên isScrolled
      className={`fixed top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-[1200px] z-100 rounded-full transition-all duration-500 ${
        isScrolled
          ? "bg-white shadow-2xl border border-surface-variant/50 py-1" // Đã xóa dark:bg-slate-900
          : "bg-transparent border border-transparent shadow-none py-2"
      }`}
    >
      {/* Thêm transition-all cho padding để tạo hiệu ứng thu nhỏ nhẹ khi scroll */}
      <div className="px-8 py-2.5 flex justify-between items-center transition-all duration-300">
        {/* Logo */}
        <div className="text-lg font-bold tracking-tighter text-slate-900 font-headline flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-xl">
            waves
          </span>
          WaterBus
        </div>

        {/* Main Links */}
        <div className="hidden lg:flex items-center gap-6">
          <a
            className="text-xs font-bold text-white bg-primary px-4 py-2 rounded-full font-headline"
            href="#"
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
              <a
                className="block px-4 py-2 text-xs hover:bg-surface-container-low transition-colors"
                href="#"
              >
                Bạch Đằng
              </a>
              <a
                className="block px-4 py-2 text-xs hover:bg-surface-container-low transition-colors"
                href="#"
              >
                Bình An
              </a>
              <a
                className="block px-4 py-2 text-xs hover:bg-surface-container-low transition-colors"
                href="#"
              >
                Thanh Đa
              </a>
              <a
                className="block px-4 py-2 text-xs hover:bg-surface-container-low transition-colors"
                href="#"
              >
                Hiệp Bình Chánh
              </a>
              <a
                className="block px-4 py-2 text-xs hover:bg-surface-container-low transition-colors"
                href="#"
              >
                Linh Đông
              </a>
            </div>
          </div>

          <a
            className="text-xs font-medium text-on-surface-variant hover:text-primary transition-colors font-headline"
            href="#"
          >
            Lịch khởi hành
          </a>

          {/* Booking Dropdown */}
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

        {/* User, Lang & Auth */}
        <div className="flex items-center gap-4">
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

          <div className="flex items-center gap-2 pl-4 border-l border-surface-variant/30">
            {isLoggedIn ? (
              <button
                onClick={() => setIsLoggedIn(false)}
                className="w-8 h-8 rounded-full bg-primary-container overflow-hidden border-2 border-transparent hover:border-primary transition-colors cursor-pointer"
                title="Đăng xuất (Test)"
              >
                <img
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJgEa1CJ6nEykaMCLialWDQWttf8sV3FmrwfpNsqm6OO9JzpZ8RcUQ1TWOwuutMrcEIMzEMozSlrOI28PIho2BdBNTFUC6OzHhjFH6UfeVhwuWTTTw3dFZtDn4rSlgsCXg6TGY88SStie6-CNRXxbboKK4EiEwhyYik6ZU2tM5ytXTRHz2M_OPltBXE3K4LGi2qWZoUw6EDd5-C-Uqc-tBO_-Tgj9zqYcTicR6MYKwEvvgdWXOqHahk_6FCxc0FkAqulS6IJiVBEJc"
                />
              </button>
            ) : (
              <button
                onClick={() => setIsLoggedIn(true)}
                className="text-sm font-bold font-headline text-on-surface hover:text-primary transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-lg">login</span>
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
