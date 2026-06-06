import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export const AdminFooter = () => {
  const { lang } = useApp();

  return (
    <footer className="w-full flex flex-col items-center gap-3 text-center bg-[#124757] dark:bg-slate-900 border-t border-white/10 dark:border-slate-800 py-6 mt-auto transition-colors duration-300 shadow-inner">
      <div className="flex flex-wrap justify-center gap-8 text-white/60 dark:text-slate-500 text-xs font-label font-bold uppercase tracking-widest">
        <Link
          to="#"
          className="hover:text-white dark:hover:text-yellow-400 transition-colors"
        >
          {lang === "VN" ? "Chính sách bảo mật" : "Privacy Policy"}
        </Link>
        <Link
          to="#"
          className="hover:text-white dark:hover:text-yellow-400 transition-colors"
        >
          {lang === "VN" ? "Sổ tay vận hành" : "Operations Manual"}
        </Link>
        <Link
          to="#"
          className="hover:text-white dark:hover:text-yellow-400 transition-colors"
        >
          {lang === "VN" ? "Liên hệ kỹ thuật" : "Technical Support"}
        </Link>
      </div>
      <p className="font-label text-[10px] uppercase font-bold tracking-widest text-white/40 dark:text-slate-600">
        &copy; {new Date().getFullYear()} WaterBus Admin Panel. All Rights Reserved.
      </p>
    </footer>
  );
};