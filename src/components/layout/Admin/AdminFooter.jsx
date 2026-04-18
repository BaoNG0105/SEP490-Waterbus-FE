import { Link } from "react-router-dom";
import { useApp } from "../../../context/AppContext";

export const AdminFooter = () => {
  // Lấy trạng thái ngôn ngữ từ Context
  const { lang } = useApp();

  return (
    <footer className="w-full flex flex-col items-center gap-4 text-center bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 py-8 mt-auto transition-colors duration-300">
      <div className="flex flex-wrap justify-center gap-8 text-slate-400 dark:text-slate-500 text-xs font-label font-bold uppercase tracking-widest">
        <Link
          to="#"
          className="hover:text-primary dark:hover:text-yellow-400 transition-colors"
        >
          {lang === "VN" ? "Chính sách bảo mật" : "Privacy Policy"}
        </Link>
        <Link
          to="#"
          className="hover:text-primary dark:hover:text-yellow-400 transition-colors"
        >
          {lang === "VN" ? "Sổ tay vận hành" : "Operations Manual"}
        </Link>
        <Link
          to="#"
          className="hover:text-primary dark:hover:text-yellow-400 transition-colors"
        >
          {lang === "VN" ? "Liên hệ kỹ thuật" : "Technical Support"}
        </Link>
      </div>
      <p className="font-label text-[10px] uppercase font-bold tracking-widest text-slate-300 dark:text-slate-600">
        © 2026 Future-Classic River Transit Authority. Internal Use Only.
      </p>
    </footer>
  );
};
