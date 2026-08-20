import { useEffect, useId, useRef, useState } from "react";
import {
  fetchSelectablePublicVouchers,
  formatPromotionDiscountLabel,
} from "../services/promotionService";

const formatExpiry = (isoValue, lang = "VN") => {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(lang === "VN" ? "vi-VN" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

/**
 * Xét nhanh (chỉ phía FE, không gọi API) 1 voucher có còn khả năng áp dụng hay không, dựa trên
 * các điều kiện khách quan đã có sẵn trong dữ liệu voucher: còn hiệu lực theo thời gian, còn lượt
 * dùng, và đơn hàng hiện tại (nếu biết `orderAmount`) có đạt `minOrderValue` không. Các điều kiện
 * phức tạp hơn (tuyến/khung giờ/ngày trong tuần, lượt dùng theo tài khoản...) vẫn để BE quyết định
 * khi bấm "Áp dụng" thật — đây chỉ để làm mờ + khóa trước những voucher rõ ràng không dùng được,
 * tránh người dùng chọn nhầm rồi mới thấy lỗi.
 */
const getVoucherApplicability = (promo, orderAmount, lang = "VN") => {
  const now = Date.now();

  if (promo.validFrom) {
    const from = new Date(promo.validFrom).getTime();
    if (Number.isFinite(from) && now < from) {
      return { applicable: false, reason: lang === "VN" ? "Chưa bắt đầu" : "Not started yet" };
    }
  }
  if (promo.validTo) {
    const to = new Date(promo.validTo).getTime();
    if (Number.isFinite(to) && now > to) {
      return { applicable: false, reason: lang === "VN" ? "Đã hết hạn" : "Expired" };
    }
  }
  if (promo.usageLimit != null && Number(promo.usageCount) >= Number(promo.usageLimit)) {
    return { applicable: false, reason: lang === "VN" ? "Đã hết lượt dùng" : "Fully redeemed" };
  }
  if (promo.minOrderValue != null && orderAmount != null && Number(orderAmount) < Number(promo.minOrderValue)) {
    const formatted = Number(promo.minOrderValue).toLocaleString(lang === "VN" ? "vi-VN" : "en-US");
    return {
      applicable: false,
      reason: lang === "VN" ? `Đơn tối thiểu ${formatted}đ` : `Min order ${formatted}`,
    };
  }

  return { applicable: true, reason: "" };
};

/**
 * UI chọn voucher: header + ô nhập + carousel thẻ ngang.
 */
export function SelectablePublicVouchers({
  lang = "VN",
  bookingType,
  selectedCode = "",
  /** Tổng tiền đơn hàng hiện tại (trước giảm giá) — dùng để làm mờ + khóa các voucher chưa đạt
   * minOrderValue. Bỏ qua (không lọc theo mức tối thiểu) nếu không truyền vào. */
  orderAmount = null,
  onSelect,
  onChangeCode,
  onClear,
  disabled = false,
  showManualInput = true,
  hint,
  className = "",
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [vouchers, setVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!bookingType) {
      setVouchers([]);
      setIsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setIsLoading(true);
    setLoadFailed(false);
    fetchSelectablePublicVouchers(bookingType)
      .then((list) => {
        if (!cancelled) setVouchers(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) {
          setVouchers([]);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingType]);

  const selected = String(selectedCode || "").trim().toUpperCase();
  const hasSelection = Boolean(selected);

  const handleApplyCode = (code) => {
    const next = String(code || "").trim().toUpperCase();
    if (!next || disabled) return;
    onChangeCode?.(next);
    onSelect?.(next);
  };

  let emptyMessage = "";
  if (!isLoading && !vouchers.length) {
    emptyMessage = loadFailed
      ? (lang === "VN" ? "Không tải được danh sách voucher." : "Could not load vouchers.")
      : (lang === "VN" ? "Hiện chưa có voucher phù hợp." : "No eligible vouchers currently.");
  }

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-800 dark:text-white">
            {lang === "VN" ? "Mã giảm giá" : "Discount code"}
          </h4>
        </div>
        {showManualInput ? (
          <label
            htmlFor={inputId}
            className="flex min-w-0 max-w-[62%] cursor-text items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-600 dark:bg-slate-900"
            onClick={() => inputRef.current?.focus()}
          >
            <span className="material-symbols-outlined text-[16px] text-[#124757] dark:text-yellow-400">
              sell
            </span>
            <input
              id={inputId}
              ref={inputRef}
              type="text"
              value={selectedCode}
              disabled={disabled}
              maxLength={80}
              onChange={(e) => onChangeCode?.(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApplyCode(selectedCode);
                }
              }}
              placeholder={lang === "VN" ? "Nhập hoặc chọn mã" : "Enter or choose code"}
              className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold uppercase tracking-wide text-[#124757] outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 dark:text-yellow-400 dark:placeholder:text-slate-500"
            />
            {hasSelection ? (
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChangeCode?.("");
                  onClear?.();
                }}
                className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title={lang === "VN" ? "Xóa mã" : "Clear code"}
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            ) : null}
          </label>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-[11px] font-medium text-slate-400">
          {lang === "VN" ? "Đang tải voucher…" : "Loading vouchers…"}
        </p>
      ) : null}

      {emptyMessage ? (
        <p className="text-[11px] font-medium text-slate-400">{emptyMessage}</p>
      ) : null}

      {!isLoading && vouchers.length > 0 ? (
        <div className="-mx-0.5 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {vouchers.map((promo) => {
            const code = String(promo.promotionCode || "").trim().toUpperCase();
            const active = code && code === selected;
            const discountLabel = formatPromotionDiscountLabel(promo, lang);
            const title = promo.promotionName || discountLabel || code;
            const expiry = formatExpiry(promo.validTo, lang);
            const { applicable, reason } = getVoucherApplicability(promo, orderAmount, lang);
            return (
              <article
                key={promo.id || code}
                title={!applicable ? reason : undefined}
                className={`relative w-50 shrink-0 rounded-2xl border bg-white p-3 dark:bg-slate-900 ${
                  !applicable
                    ? "opacity-50 grayscale-35 border-slate-200 dark:border-slate-700"
                    : active
                      ? "border-[#124757] shadow-sm dark:border-yellow-400"
                      : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <p className="line-clamp-2 min-h-9 text-[13px] font-bold leading-snug text-slate-800 dark:text-white">
                  {title}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                  {code}
                  {discountLabel && discountLabel !== title ? ` · ${discountLabel}` : ""}
                </p>
                <div className="mt-2.5 flex items-end justify-between gap-2 border-t border-dashed border-slate-200 pt-2.5 dark:border-slate-700">
                  <p className="text-[10px] font-medium text-slate-400">
                    {!applicable
                      ? reason
                      : expiry
                        ? `${lang === "VN" ? "HSD" : "Exp"}: ${expiry}`
                        : (lang === "VN" ? "Không HSD" : "No expiry")}
                  </p>
                  <button
                    type="button"
                    disabled={disabled || !code || !applicable}
                    onClick={() => handleApplyCode(code)}
                    className={`shrink-0 text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-[#124757] hover:underline dark:text-yellow-400"
                    }`}
                  >
                    {active
                      ? (lang === "VN" ? "Đã chọn" : "Selected")
                      : (lang === "VN" ? "Áp dụng" : "Apply")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}
