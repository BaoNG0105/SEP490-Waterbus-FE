import { useState, useEffect, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { fetchPublicPromotions, PROMOTION_TYPE } from "../../services/promotionService";

const formatDiscount = (promo, lang) => {
  if (promo.promotionType === PROMOTION_TYPE.PERCENT) {
    return lang === "VN" ? `Giảm ${promo.discountValue}%` : `${promo.discountValue}% off`;
  }
  return lang === "VN"
    ? `Giảm ${(Number(promo.discountValue) || 0).toLocaleString("vi-VN")}đ`
    : `${(Number(promo.discountValue) || 0).toLocaleString("en-US")} VND off`;
};

const fallbackImg =
  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=2000";

export const Promotions = () => {
  const { lang } = useApp();
  const [promotions, setPromotions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedPromo, setSelectedPromo] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setErrorMsg("");
        const data = await fetchPublicPromotions();
        setPromotions(data || []);
      } catch (error) {
        console.error(error);
        setErrorMsg(
          lang === "VN"
            ? "Không tải được danh sách ưu đãi."
            : "Failed to load promotions."
        );
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [lang]);

  const heroPromos = useMemo(
    () => (promotions.length > 0 ? promotions.slice(0, 3) : []),
    [promotions]
  );

  useEffect(() => {
    if (heroPromos.length <= 1) return undefined;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroPromos.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroPromos.length]);

  return (
    <main className="pt-28 pb-20 bg-surface dark:bg-slate-900 transition-colors duration-300 min-h-screen relative">
      <section className="px-4 md:px-8 max-w-7xl mx-auto mb-20">
        <div className="relative w-full h-[420px] md:h-[500px] rounded-[2rem] overflow-hidden group shadow-2xl bg-slate-800">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-white/20 border-t-yellow-400 rounded-full animate-spin" />
            </div>
          ) : heroPromos.length === 0 ? (
            <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16">
              <h1 className="text-4xl md:text-5xl font-bold font-headline text-white tracking-tighter">
                {lang === "VN" ? "Ưu đãi WaterBus" : "WaterBus Offers"}
              </h1>
              <p className="mt-4 text-white/70 max-w-xl">
                {errorMsg ||
                  (lang === "VN"
                    ? "Hiện chưa có khuyến mãi công khai."
                    : "No public promotions right now.")}
              </p>
            </div>
          ) : (
            heroPromos.map((slide, index) => (
              <div
                key={slide.id}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
              >
                <div className="absolute inset-0">
                  <img
                    alt={slide.promotionName}
                    className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-[10s]"
                    src={slide.imageUrl || fallbackImg}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-transparent" />
                </div>
                <div className="relative h-full flex flex-col justify-center px-8 md:px-16 max-w-3xl">
                  <p className="text-yellow-400 font-headline font-black text-xs uppercase tracking-widest mb-3">
                    {slide.promotionCode} · {formatDiscount(slide, lang)}
                  </p>
                  <h1 className="text-4xl md:text-6xl font-bold font-headline text-white leading-[1.1] mb-6 tracking-tighter">
                    {slide.promotionName}
                  </h1>
                  <p className="text-base md:text-lg text-white/80 font-body mb-8 max-w-xl line-clamp-3">
                    {slide.description || formatDiscount(slide, lang)}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("promotions-grid")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                    className="w-fit bg-primary-container dark:bg-yellow-400 text-slate-900 px-8 py-4 rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-lg"
                  >
                    {lang === "VN" ? "Khám phá ngay" : "Explore Now"}
                    <span className="material-symbols-outlined">arrow_downward</span>
                  </button>
                </div>
              </div>
            ))
          )}

          {heroPromos.length > 1 && (
            <div className="absolute bottom-10 right-10 md:right-16 flex gap-3 z-20">
              {heroPromos.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    currentSlide === idx
                      ? "w-12 bg-primary-container dark:bg-yellow-400"
                      : "w-6 bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="promotions-grid" className="px-4 md:px-8 max-w-7xl mx-auto scroll-mt-24">
        <div className="flex flex-col mb-12">
          <h2 className="text-4xl font-bold font-headline tracking-tighter mb-2 text-slate-900 dark:text-white">
            {lang === "VN" ? "Ưu đãi hiện hành" : "Current Offers"}
          </h2>
          <p className="text-on-surface-variant dark:text-white/60 font-label">
            {lang === "VN"
              ? "Dữ liệu từ GET /promotions/public."
              : "Loaded from GET /promotions/public."}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
          </div>
        ) : promotions.length === 0 ? (
          <p className="text-center text-slate-400 py-16 font-bold">
            {errorMsg || (lang === "VN" ? "Chưa có ưu đãi." : "No offers available.")}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className="group bg-surface-container-lowest dark:bg-slate-800 rounded-[2.5rem] p-4 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 border border-surface-variant dark:border-slate-700"
              >
                <div
                  className="relative h-64 rounded-[2rem] overflow-hidden mb-6 cursor-pointer"
                  onClick={() => setSelectedPromo(promo)}
                >
                  <img
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    alt={promo.promotionName}
                    src={promo.imageUrl || fallbackImg}
                  />
                </div>
                <div className="px-4 pb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#124757] dark:text-yellow-400 mb-2">
                    {promo.promotionCode} · {formatDiscount(promo, lang)}
                  </p>
                  <h3 className="text-2xl font-bold font-headline mb-3 tracking-tight text-slate-900 dark:text-white">
                    {promo.promotionName}
                  </h3>
                  <p className="text-on-surface-variant dark:text-white/70 text-sm mb-6 line-clamp-3 leading-relaxed">
                    {promo.description || formatDiscount(promo, lang)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedPromo(promo)}
                    className="w-full py-4 rounded-xl border-2 border-outline-variant dark:border-slate-600 font-bold text-sm text-slate-700 dark:text-white hover:bg-primary hover:border-primary hover:text-white dark:hover:bg-yellow-400 dark:hover:border-yellow-400 dark:hover:text-slate-900 transition-colors"
                  >
                    {lang === "VN" ? "Xem chi tiết" : "View Details"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedPromo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl relative flex flex-col md:flex-row max-h-[90vh]">
            <button
              type="button"
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 text-white hover:bg-black/40"
              onClick={() => setSelectedPromo(null)}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="md:w-5/12 h-48 md:h-auto shrink-0 relative">
              <img
                alt={selectedPromo.promotionName}
                className="w-full h-full object-cover"
                src={selectedPromo.imageUrl || fallbackImg}
              />
            </div>
            <div className="p-8 md:p-10 overflow-y-auto flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#124757] dark:text-yellow-400 mb-2">
                {selectedPromo.promotionCode}
              </p>
              <h3 className="text-3xl font-bold font-headline text-slate-900 dark:text-white mb-3">
                {selectedPromo.promotionName}
              </h3>
              <p className="text-lg font-black text-[#124757] dark:text-yellow-400 mb-4">
                {formatDiscount(selectedPromo, lang)}
              </p>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {selectedPromo.description ||
                  (lang === "VN" ? "Không có mô tả chi tiết." : "No detailed description.")}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
