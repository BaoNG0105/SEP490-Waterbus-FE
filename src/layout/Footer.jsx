import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";

// Import file ảnh logo từ thư mục assets
import logo from "../assets/logo.png";

export const Footer = () => {
  const { lang } = useApp();

  return (
    <footer className="w-full bg-[#124757] dark:bg-slate-900 text-white py-12 md:py-16 px-6 md:px-12 border-t border-white/10 dark:border-slate-800/80 transition-all duration-300 select-none font-body">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 items-center justify-between gap-10 md:gap-12">

        {/* Cột trái: Logo & Slogan */}
        <div className="flex flex-col gap-4 items-center md:items-start text-center md:text-left">
          <Link to="/" className="inline-block">
            <img
              src={logo}
              alt="WaterBus Logo"
              className="w-32 md:w-70 h-auto brightness-100 transition-transform hover:scale-105"
            />
          </Link>
          <p className="text-white/70 dark:text-slate-400 text-sm">
            {lang === "VN"
              ? "Định nghĩa lại phương thức di chuyển đô thị trên mặt nước."
              : "Redefining city mobility through the water."}
          </p>
        </div>

        {/* Cột giữa: Các liên kết chính */}
        <div className="flex justify-center gap-6 md:gap-10 text-xs font-bold uppercase tracking-widest font-headline">
          <a
            className="text-white/70 dark:text-slate-300 hover:text-white dark:hover:text-yellow-400 transition-colors"
            href="https://www.facebook.com/SaigonWaterbus.Official"
            target="_blank"
            rel="noreferrer"
          >
            Facebook
          </a>
          <a
            className="text-white/70 dark:text-slate-300 hover:text-white dark:hover:text-yellow-400 transition-colors"
            href="https://www.instagram.com/saigonwaterbus/"
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
          <Link
            className="text-white/70 dark:text-slate-300 hover:text-white dark:hover:text-yellow-400 transition-colors"
            to="/contact"
          >
            {lang === "VN" ? "Liên hệ" : "Contact Us"}
          </Link>
        </div>

        {/* Cột phải: Bản quyền thương hiệu */}
        <div className="text-center md:text-right text-[10px] text-white/50 dark:text-slate-500 uppercase tracking-widest leading-relaxed">
          © 2026 Waterbus. All rights reserved.
        </div>
      </div>
    </footer>
  );
};