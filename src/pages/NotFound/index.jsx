import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export const NotFound = () => {
  const { lang } = useApp();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 font-body px-6 select-none transition-colors duration-300">
      
      {/* Icon trang trí chủ đề sông nước */}
      <div className="text-[#124757] dark:text-[#FFD100] mb-6">
        <span className="material-symbols-outlined text-8xl md:text-[120px] drop-shadow-sm animate-bounce" aria-hidden>
          sailing
        </span>
      </div>

      {/* Tiêu đề lỗi 404 */}
      <h1 className="text-7xl md:text-9xl font-headline font-black text-slate-800 dark:text-white tracking-tighter mb-2">
        404
      </h1>

      {/* Thông báo lỗi */}
      <h2 className="text-2xl md:text-3xl font-bold text-[#124757] dark:text-[#FFD100] mb-4 text-center">
        {lang === "VN" ? "Ôi không! Tàu của bạn đã đi lạc." : "Oh no! Your boat drifted off course."}
      </h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base font-medium max-w-md text-center mb-10 leading-relaxed">
        {lang === "VN" 
          ? "Trang bạn đang cố gắng truy cập không tồn tại, đã bị gỡ bỏ hoặc bạn không có quyền truy cập vào khu vực này." 
          : "The page you are looking for might have been removed, had its name changed, or is temporarily unavailable."}
      </p>

      {/* Các nút hành động điều hướng */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
        
        {/* Nút Quay lại trang trước đó */}
        <button
          onClick={() => navigate(-1)}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-base" aria-hidden>arrow_back</span>
          {lang === "VN" ? "Quay lại" : "Go Back"}
        </button>

        {/* Nút Về thẳng trang chủ */}
        <Link
          to="/"
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#124757] dark:bg-[#FFD100] text-white dark:text-slate-900 font-headline font-black uppercase text-sm tracking-wider shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-base" aria-hidden>home</span>
          {lang === "VN" ? "Về Trang Chủ" : "Back to Home"}
        </Link>
        
      </div>
    </div>
  );
};