import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import {
  fetchPublicPromotions,
  PROMOTION_TYPE,
  PROMOTION_BOOKING_TYPES,
} from "../../services/promotionService";
import { notify } from "../../utils/swalToast";
import { ImageWithFallback } from "../../components/ImageWithFallback";

const formatCurrency = (value, lang) =>
  (Number(value) || 0).toLocaleString(lang === "VN" ? "vi-VN" : "en-US") + (lang === "VN" ? "đ" : " VND");

const formatDate = (value, lang) =>
  value ? new Date(value).toLocaleDateString(lang === "VN" ? "vi-VN" : "en-US") : "";

const DAY_LABELS = {
  Sunday: { vn: "Chủ nhật", en: "Sun" },
  Monday: { vn: "Thứ 2", en: "Mon" },
  Tuesday: { vn: "Thứ 3", en: "Tue" },
  Wednesday: { vn: "Thứ 4", en: "Wed" },
  Thursday: { vn: "Thứ 5", en: "Thu" },
  Friday: { vn: "Thứ 6", en: "Fri" },
  Saturday: { vn: "Thứ 7", en: "Sat" },
};

export function PromotionDetail() {
  const { lang } = useApp();
  const { code } = useParams();
  const navigate = useNavigate();

  const [promo, setPromo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadPromotion = async () => {
      try {
        setIsLoading(true);
        setError(false);
        const data = await fetchPublicPromotions();
        const found = (data || []).find(
          (item) => String(item.promotionCode).toLowerCase() === String(code).toLowerCase()
        );
        if (!found) {
          setError(true);
        } else {
          setPromo(found);
        }
      } catch (err) {
        console.error("Không tìm thấy khuyến mãi hoặc lỗi máy chủ:", err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };
    loadPromotion();
  }, [code]);

  const handleCopyCode = () => {
    if (!promo?.promotionCode) return;
    navigator.clipboard?.writeText(promo.promotionCode);
    notify({
      icon: "success",
      title: lang === "VN" ? "Đã sao chép mã!" : "Code Copied!",
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 2500,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96 w-full bg-white dark:bg-slate-900 pt-28 md:pt-32">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !promo) {
    return (
      <div className="max-w-xl mx-auto text-center pt-28 md:pt-32 pb-24 px-6 font-body">
        <span className="material-symbols-outlined text-5xl text-rose-500 mb-2">local_offer</span>
        <h3 className="text-xl font-headline font-black text-[#124757] dark:text-white uppercase">
          {lang === "VN" ? "Khuyến mãi không tồn tại" : "Promotion Not Found"}
        </h3>
        <p className="text-xs text-slate-400 mt-2">
          {lang === "VN"
            ? "Ưu đãi này đã bị gỡ bỏ, hết hạn hoặc đường dẫn không chính xác."
            : "This offer has been removed, expired, or the link is invalid."}
        </p>
        <button
          onClick={() => navigate("/promotions")}
          className="mt-6 px-6 py-2.5 bg-[#124757] text-white text-xs font-bold rounded-xl shadow-md uppercase tracking-wider"
        >
          {lang === "VN" ? "Quay về trang ưu đãi" : "Back to Promotions"}
        </button>
      </div>
    );
  }

  const bookingTypes = promo.scope?.bookingTypes || [];
  const showWaterbusCta = bookingTypes.length === 0 || bookingTypes.includes(PROMOTION_BOOKING_TYPES.SEAT);
  const showCharterCta = bookingTypes.includes(PROMOTION_BOOKING_TYPES.CHARTER);
  const daysOfWeek = promo.scope?.daysOfWeek || [];
  const remainingUses =
    promo.usageLimit != null ? Math.max(0, promo.usageLimit - (promo.usageCount || 0)) : null;

  return (
    <div className="w-full bg-white dark:bg-slate-900 transition-colors duration-300 min-h-screen pt-28 md:pt-32 pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 space-y-8 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* CỘT TRÁI: ẢNH BANNER */}
          <div className="lg:col-span-6">
            <div className="w-full aspect-square overflow-hidden shadow-xl bg-slate-50 dark:bg-slate-800">
              <ImageWithFallback
                src={promo.imageUrl}
                alt={promo.promotionName}
                className="w-full h-full"
                iconClassName="w-1/4 h-1/4"
              />
            </div>
          </div>

          {/* CỘT PHẢI: NỘI DUNG CHI TIẾT */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-headline font-black text-[#124757] dark:text-white leading-tight">
                {promo.promotionName}
              </h1>
              <p className="text-slate-600 dark:text-slate-300 font-body leading-relaxed whitespace-pre-line">
                {promo.description ||
                  (lang === "VN" ? "Không có mô tả chi tiết." : "No detailed description.")}
              </p>
            </div>

            {/* MÃ KHUYẾN MÃI + NÚT SAO CHÉP */}
            <div className="flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 rounded-2xl px-5 py-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {lang === "VN" ? "Mã khuyến mãi" : "Promotion Code"}
                </p>
                <p className="text-lg font-black font-headline text-[#124757] dark:text-yellow-400 tracking-wider">
                  {promo.promotionCode}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="shrink-0 bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm hover:brightness-110 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">content_copy</span>
                {lang === "VN" ? "Sao chép" : "Copy"}
              </button>
            </div>

            {/* ĐIỀU KIỆN ÁP DỤNG */}
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-6">
              <h3 className="text-sm font-headline font-black text-slate-800 dark:text-white uppercase tracking-wider">
                {lang === "VN" ? "Điều kiện áp dụng" : "Terms & Conditions"}
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 font-body">
                <li className="flex items-start gap-2">
                  {lang === "VN"
                    ? `Hiệu lực từ ${formatDate(promo.validFrom, lang)} đến ${formatDate(promo.validTo, lang)}`
                    : `Valid from ${formatDate(promo.validFrom, lang)} to ${formatDate(promo.validTo, lang)}`}
                </li>
                {promo.minOrderValue != null && (
                  <li className="flex items-start gap-2">
                    {lang === "VN"
                      ? `Áp dụng cho đơn hàng từ ${formatCurrency(promo.minOrderValue, lang)}`
                      : `Applies to orders from ${formatCurrency(promo.minOrderValue, lang)}`}
                  </li>
                )}
                {promo.promotionType === PROMOTION_TYPE.PERCENT && promo.maxDiscountAmount != null && (
                  <li className="flex items-start gap-2">
                    {lang === "VN"
                      ? `Giảm tối đa ${formatCurrency(promo.maxDiscountAmount, lang)}`
                      : `Maximum discount of ${formatCurrency(promo.maxDiscountAmount, lang)}`}
                  </li>
                )}
                {promo.maxUsesPerAccount != null && (
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base text-[#124757] dark:text-yellow-400 mt-0.5">person</span>
                    {lang === "VN"
                      ? `Mỗi tài khoản dùng tối đa ${promo.maxUsesPerAccount} lần`
                      : `Limited to ${promo.maxUsesPerAccount} use(s) per account`}
                  </li>
                )}
                {remainingUses !== null && (
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base text-[#124757] dark:text-yellow-400 mt-0.5">confirmation_number</span>
                    {lang === "VN"
                      ? `Còn lại ${remainingUses} lượt sử dụng`
                      : `${remainingUses} use(s) remaining`}
                  </li>
                )}
                {promo.firstBookingOnly && (
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base text-[#124757] dark:text-yellow-400 mt-0.5">star</span>
                    {lang === "VN" ? "Chỉ áp dụng cho lượt đặt vé đầu tiên" : "Applies to first booking only"}
                  </li>
                )}
                {daysOfWeek.length > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base text-[#124757] dark:text-yellow-400 mt-0.5">calendar_month</span>
                    {lang === "VN" ? "Áp dụng vào: " : "Applies on: "}
                    {daysOfWeek.map((day) => DAY_LABELS[day]?.[lang === "VN" ? "vn" : "en"] || day).join(", ")}
                  </li>
                )}
                {(promo.scope?.departureFrom || promo.scope?.departureTo) && (
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base text-[#124757] dark:text-yellow-400 mt-0.5">schedule</span>
                    {lang === "VN"
                      ? `Khung giờ khởi hành: ${promo.scope.departureFrom || "00:00"} - ${promo.scope.departureTo || "23:59"}`
                      : `Departure window: ${promo.scope.departureFrom || "00:00"} - ${promo.scope.departureTo || "23:59"}`}
                  </li>
                )}
              </ul>
            </div>

            {/* CTA ĐẶT VÉ */}
            <div className="flex flex-wrap gap-4 pt-2">
              {showWaterbusCta && (
                <Link
                  to="/#services-section"
                  className="bg-yellow-400 text-[#124757] px-8 py-3.5 rounded-full font-headline font-bold text-sm uppercase tracking-wider shadow-lg hover:bg-yellow-300 hover:scale-105 hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                >
                  {lang === "VN" ? "Đặt vé ngay" : "Book Now"}
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
              )}
              {showCharterCta && (
                <Link
                  to="/charter-booking"
                  className="bg-white dark:bg-slate-800 text-[#124757] dark:text-yellow-400 border border-slate-200 dark:border-slate-700 px-8 py-3.5 rounded-full font-headline font-bold text-sm uppercase tracking-wider shadow-md hover:bg-yellow-400 hover:text-[#124757] dark:hover:bg-yellow-400 dark:hover:text-slate-900 hover:border-transparent transition-all duration-300 flex items-center gap-2"
                >
                  {lang === "VN" ? "Đặt thuê tàu riêng" : "Request a Boat"}
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}