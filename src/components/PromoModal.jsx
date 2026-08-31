import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { ImageWithFallback } from "./ImageWithFallback";

/**
 * Modal quảng cáo khuyến mãi hiện trên trang chủ — poster xoay vòng lấy từ
 * danh sách khuyến mãi có ảnh (promoPosterSlides), do trang cha quản lý state hiện/ẩn + slide.
 */
export function PromoModal({ open, slides, activeIndex, onClose }) {
  const { lang } = useApp();

  if (!open) return null;

  const activePromo = slides[activeIndex];

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-4xl overflow-hidden shadow-2xl animate-[fadeIn_0.4s_ease-out]">
        <button
          className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-md transition-colors"
          onClick={onClose}
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
        <div className="relative w-full aspect-4/5 bg-slate-100 dark:bg-slate-800">
          {slides.map((promo, index) => (
            <ImageWithFallback
              key={promo.promotionCode}
              src={promo.imageUrl}
              alt={promo.promotionName}
              className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${index === activeIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
              imgClassName="w-full h-full object-cover"
            />
          ))}
          <div className="absolute inset-0 bg-linear-to-t from-slate-900/90 via-slate-900/20 to-transparent z-20"></div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col items-center text-center z-30">
          <h3 className="text-2xl font-headline font-bold text-white mb-6 shadow-sm line-clamp-2">
            {activePromo?.promotionName ||
              (lang === "VN"
                ? "Nhận Deal hấp dẫn cùng WaterBus"
                : "Get attractive deals with WaterBus")}
          </h3>
          <Link
            to={activePromo ? `/promotions/${activePromo.promotionCode}` : "/promotions"}
            className="w-full bg-primary-container dark:bg-yellow-400 text-on-primary-fixed dark:text-slate-900 py-4 rounded-xl font-headline font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg"
          >
            {lang === "VN"
              ? "Xem chi tiết ưu đãi"
              : "View Promotion Details"}
          </Link>
        </div>
        <div className="absolute top-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
          {slides.map((promo, index) => (
            <div
              key={promo.promotionCode}
              className={`h-1.5 rounded-full transition-all duration-300 ${index === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
            ></div>
          ))}
        </div>
      </div>
    </div>
  );
}