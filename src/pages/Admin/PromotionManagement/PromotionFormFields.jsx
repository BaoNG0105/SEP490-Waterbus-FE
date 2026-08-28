import { useEffect, useMemo, useState } from "react";
import { fetchAllRoutes } from "../../../services/routeService";
import { FormSelect } from "../../../components/FormSelect";
import {
  PROMOTION_BOOKING_TYPES,
  PROMOTION_DAYS,
  PROMOTION_STATUS,
  PROMOTION_TYPE,
  PROMOTION_VISIBILITY,
  getPromotionRouteKindLabel,
  isRouteSelectableForPromotion,
} from "../../../services/promotionService";

import { required, RequiredStar } from "../../../utils/requiredStar";
const inputStyle =
  "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all disabled:opacity-50";
const labelStyle =
  "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";

/** Format datetime gọn cho gợi ý: "23/08 22:35" (VN) hoặc "Aug 23 10:35 PM" (EN). */
const formatDateTimeHint = (date, lang) => {
  const pad = (n) => String(n).padStart(2, "0");
  if (lang === "VN") {
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let h = date.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${months[date.getMonth()]} ${date.getDate()} ${h}:${pad(date.getMinutes())} ${ampm}`;
};

/** Trích message string từ error object/string (backward compatible). */
const errMessage = (e) => {
  if (!e) return "";
  if (typeof e === "string") return e;
  return e.message || "";
};
const errSeverity = (e) => (e && typeof e === "object" ? e.severity || "error" : "error");

/** Box thông báo validation: icon + message (đậm) + hint (gợi ý nhỏ hơn, mờ hơn). */
const FieldError = ({ error, className = "" }) => {
  const msg = errMessage(error);
  const severity = errSeverity(error);
  if (!msg) return <div className={`min-h-[18px] mt-1 ${className}`} />;

  const colors =
    severity === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-500 dark:text-red-400";
  const icon =
    severity === "warn" ? "⚠" : "✕";

  return (
    <div className={`mt-1 min-h-[18px] leading-tight ${className}`}>
      <p className={`text-[10px] font-bold ${colors} flex items-start gap-1`}>
        <span className="shrink-0 leading-none mt-px">{icon}</span>
        <span className="break-words">{msg}</span>
      </p>
    </div>
  );
};

const OptionalNumberField = ({
  lang,
  labelVn,
  labelEn,
  enabled,
  onToggle,
  value,
  onChange,
  error,
  dataField,
  placeholder,
  unit,
  inputProps = {},
}) => {
  const onLabel = lang === "VN" ? "Bật giới hạn" : "Enable limit";
  const offLabel = lang === "VN" ? "Không giới hạn" : "Unlimited";
  return (
    <div className="flex flex-col h-full" data-field={dataField}>
      <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[32px]">
        <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider leading-tight min-w-0 flex-1">
          {lang === "VN" ? labelVn : labelEn}
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? onLabel : offLabel}
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 ${
            enabled
              ? "bg-[#124757] dark:bg-yellow-400"
              : "bg-slate-300 dark:bg-slate-600"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
              enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <div className="relative">
        <input
          type="number"
          min={0}
          disabled={!enabled}
          value={enabled ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            enabled
              ? lang === "VN"
                ? "Nhập..."
                : "Enter..."
              : `∞ ${offLabel.toLowerCase()}`
          }
          className={`${inputStyle} pr-12 ${!enabled ? "opacity-60 italic" : ""} ${error ? "border-red-400 dark:border-red-500" : ""}`}
          {...inputProps}
        />
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
            {unit}
          </span>
        )}
      </div>
      <FieldError error={error} />
    </div>
  );
};

// Cùng layout với OptionalNumberField nhưng bắt buộc, không có toggle.
const RequiredNumberField = ({
  lang,
  labelVn,
  labelEn,
  value,
  onChange,
  error,
  dataField,
  inputProps = {},
  unit,
}) => (
  <div className="flex flex-col h-full" data-field={dataField}>
    <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[32px]">
      <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider leading-tight min-w-0 flex-1">
        {lang === "VN" ? labelVn : labelEn}
      </label>
      <span className="text-[9px] font-black uppercase tracking-wider text-rose-400 shrink-0">
        *
      </span>
    </div>
    <div className="relative">
      <input
        type="number"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputStyle} pr-12 ${error ? "border-red-400 dark:border-red-500" : ""}`}
        {...inputProps}
      />
      {unit && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
          {unit}
        </span>
      )}
    </div>
    <FieldError error={error} />
  </div>
);

const toggleInList = (list, value) =>
  list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

export function PromotionFormFields({
  lang,
  formData,
  onChange,
  lockCode = false,
  lockType = false,
  isCreate = true,
  onErrorsChange,
}) {
  const [routes, setRoutes] = useState([]);
  const [errors, setErrors] = useState({});
  // Tick mỗi phút để min của validFrom không bị stale (user mở form lâu).
  const [now, setNow] = useState(() => new Date());
  // Field đang focus — dùng để ẩn/hiện hint phụ, gọn gàng hơn khi chưa gõ.
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    fetchAllRoutes()
      .then((data) => setRoutes(data || []))
      .catch(() => setRoutes([]));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Format "YYYY-MM-DDTHH:mm" cho thuộc tính `min` của input datetime-local.
  const minDateTime = useMemo(() => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }, [now]);

  const validateField = (field, value) => {
    const err = (severity, message, hint) =>
      hint ? { severity, message, hint } : { severity, message };

    switch (field) {
      case "promotionCode": {
        const v = String(value || "").trim();
        if (!v) return err("error", lang === "VN" ? "Mã khuyến mãi bắt buộc." : "Promotion code is required.");
        if (v.length > 50) return err("error", lang === "VN" ? `Mã đang ${v.length}/50 ký tự — vượt giới hạn.` : `Code is ${v.length}/50 — over the limit.`);
        if (!/^[A-Z0-9]+$/.test(v))
          return err(
            "error",
            lang === "VN" ? "Mã chỉ được chữ IN HOA và số." : "Code must be uppercase letters and digits only.",
            lang === "VN" ? "Không dấu, không khoảng trắng. VD: SUMMER50" : "No spaces or symbols. e.g. SUMMER50"
          );
        return null;
      }
      case "promotionName": {
        const v = String(value || "").trim();
        if (!v) return err("error", lang === "VN" ? "Tên khuyến mãi bắt buộc." : "Promotion name is required.", lang === "VN" ? "Tên sẽ hiển thị cho khách hàng." : "This name will be shown to customers.");
        if (v.length > 150) return err("error", lang === "VN" ? `Tên đang ${v.length}/150 ký tự — vượt giới hạn.` : `Name is ${v.length}/150 — over the limit.`);
        return null;
      }
      case "description": {
        const v = String(value || "");
        if (v.length > 1000) return err("error", lang === "VN" ? `Mô tả đang ${v.length}/1000 ký tự — vượt giới hạn.` : `Description is ${v.length}/1000 — over the limit.`);
        return null;
      }
      case "discountValue": {
        if (value === "" || value === null || value === undefined)
          return err("error", lang === "VN" ? "Chưa nhập giá trị giảm." : "Discount value is empty.", lang === "VN" ? "Nhập phần trăm từ 1–100 hoặc số tiền giảm theo VND." : "Enter a percentage from 1–100 or a fixed VND amount.");
        const num = Number(value);
        if (!Number.isFinite(num))
          return err("error", lang === "VN" ? "Giá trị giảm không hợp lệ." : "Discount value is invalid.", lang === "VN" ? "Chỉ nhập số, ví dụ: 50000 hoặc 15." : "Numbers only, e.g. 50000 or 15.");
        if (num <= 0)
          return err("error", lang === "VN" ? "Giá trị giảm phải lớn hơn 0." : "Discount must be greater than 0.", lang === "VN" ? "Nhập giá trị dương cho khuyến mãi này." : "Enter a positive value for this promotion.");
        if (isPercent && num > 100)
          return err("error", lang === "VN" ? `Phần trăm giảm tối đa 100% — bạn đang nhập ${num}%.` : `Percent discount max is 100% — you entered ${num}%.`, lang === "VN" ? "Nếu muốn giảm nhiều hơn, đổi sang loại giảm theo VND." : "For larger discounts, switch to a fixed-amount (VND) promotion.");
        return null;
      }
      case "maxDiscountAmount": {
        if (formData.hasMaxDiscountAmount && value !== "" && value !== null) {
          const num = Number(value);
          if (!Number.isFinite(num))
            return err("error", lang === "VN" ? "Giảm tối đa không hợp lệ." : "Max discount is invalid.");
          if (num < 1000)
            return err(
              "error",
              lang === "VN" ? "Giảm tối đa phải từ 1.000đ." : "Max discount must be at least 1,000 VND.",
              lang === "VN" ? "Tăng giá trị lên tối thiểu 1.000đ hoặc tắt giới hạn giảm tối đa." : "Enter at least 1,000 VND or disable the maximum discount cap."
            );
        }
        return null;
      }
      case "minOrderValue": {
        if (formData.hasMinOrderValue && value !== "" && value !== null) {
          const num = Number(value);
          if (!Number.isFinite(num))
            return err("error", lang === "VN" ? "Đơn tối thiểu không hợp lệ." : "Minimum order is invalid.");
          if (num < 1000)
            return err(
              "error",
              lang === "VN" ? "Đơn tối thiểu phải từ 1.000đ." : "Minimum order must be at least 1,000 VND.",
              lang === "VN" ? "Tăng giá trị lên tối thiểu 1.000đ hoặc tắt điều kiện đơn tối thiểu." : "Enter at least 1,000 VND or disable the minimum-order condition."
            );
        }
        return null;
      }
      case "usageLimit": {
        if (formData.hasUsageLimit && value !== "" && value !== null) {
          const num = Number(value);
          if (!Number.isFinite(num))
            return err("error", lang === "VN" ? "Lượt dùng tổng không hợp lệ." : "Total usage limit is invalid.");
          if (num < 1)
            return err(
              "error",
              lang === "VN" ? "Lượt dùng tổng phải ≥ 1." : "Total usage limit must be ≥ 1.",
              lang === "VN" ? "Nhập ít nhất 1 lượt hoặc tắt giới hạn lượt dùng tổng." : "Enter at least 1 use or disable the total usage limit."
            );
        }
        return null;
      }
      case "maxUsesPerAccount": {
        if (formData.hasMaxUsesPerAccount && value !== "" && value !== null) {
          const num = Number(value);
          if (!Number.isFinite(num))
            return err("error", lang === "VN" ? "Lượt dùng/user không hợp lệ." : "Per-account limit is invalid.");
          if (num < 1)
            return err(
              "error",
              lang === "VN" ? "Lượt dùng/user phải ≥ 1." : "Per-account limit must be ≥ 1.",
              lang === "VN" ? "Nhập ít nhất 1 lượt hoặc tắt giới hạn theo tài khoản." : "Enter at least 1 use or disable the per-account limit."
            );
        }
        return null;
      }
      case "budgetCap": {
        if (formData.hasBudgetCap && value !== "" && value !== null) {
          const num = Number(value);
          if (!Number.isFinite(num))
            return err("error", lang === "VN" ? "Ngân sách không hợp lệ." : "Budget is invalid.");
          if (num < 1000)
            return err(
              "error",
              lang === "VN" ? "Ngân sách phải từ 1.000đ." : "Budget must be at least 1,000 VND.",
              lang === "VN" ? "Tăng ngân sách lên tối thiểu 1.000đ hoặc tắt giới hạn ngân sách." : "Enter at least 1,000 VND or disable the budget cap."
            );
        }
        return null;
      }
      case "validFrom": {
        if (!value) return err("error", lang === "VN" ? "Chưa chọn ngày bắt đầu." : "Start date is empty.", lang === "VN" ? "Chọn thời điểm bắt đầu hiệu lực của khuyến mãi." : "Choose when this promotion starts.");
        const fromTs = new Date(value).getTime();
        if (Number.isFinite(fromTs) && fromTs < now.getTime()) {
          return err(
            "error",
            lang === "VN" ? "Ngày bắt đầu nằm trong quá khứ." : "Start date is in the past.",
            lang === "VN" ? "Chọn ngày trong tương lai." : "Pick a future date."
          );
        }
        if (formData.validTo) {
          const toTs = new Date(formData.validTo).getTime();
          if (Number.isFinite(fromTs) && Number.isFinite(toTs) && toTs <= fromTs)
            return err(
              "error",
              lang === "VN" ? "Ngày bắt đầu phải trước ngày kết thúc." : "Start date must be before end date.",
              lang === "VN" ? "Hiện bạn đang chọn ngày kết thúc sớm hơn hoặc bằng ngày bắt đầu." : "Your end date is on or before the start date."
            );
        }
        return null;
      }
      case "validTo": {
        if (!value) return err("error", lang === "VN" ? "Chưa chọn ngày kết thúc." : "End date is empty.", lang === "VN" ? "Chọn thời điểm kết thúc sau ngày bắt đầu." : "Choose an end time after the start date.");
        const toTs = new Date(value).getTime();
        if (Number.isFinite(toTs) && toTs < now.getTime()) {
          return err(
            "error",
            lang === "VN" ? "Ngày kết thúc nằm trong quá khứ." : "End date is in the past.",
            lang === "VN" ? "Chọn ngày trong tương lai." : "Pick a future date."
          );
        }
        if (formData.validFrom) {
          const fromTs = new Date(formData.validFrom).getTime();
          if (Number.isFinite(fromTs) && Number.isFinite(toTs) && toTs <= fromTs)
            return err(
              "error",
              lang === "VN" ? "Ngày kết thúc phải sau ngày bắt đầu." : "End date must be after start date.",
              lang === "VN" ? `Hiện đang chọn ngày kết thúc sớm hơn ngày bắt đầu.` : `End is set before the start.`
            );
        }
        return null;
      }
      case "departureFrom": {
        if (value && formData.departureTo) {
          if (value > formData.departureTo)
            return err(
              "error",
              lang === "VN" ? "Giờ bắt đầu phải ≤ giờ kết thúc." : "Start time must be ≤ end time.",
              lang === "VN" ? `Bạn đang đặt giờ bắt đầu (${value}) sau giờ kết thúc (${formData.departureTo}).` : `Start (${value}) is after end (${formData.departureTo}).`
            );
        }
        return null;
      }
      case "departureTo": {
        if (formData.departureFrom && value) {
          if (value < formData.departureFrom)
            return err(
              "error",
              lang === "VN" ? "Giờ kết thúc phải ≥ giờ bắt đầu." : "End time must be ≥ start time.",
              lang === "VN" ? `Bạn đang đặt giờ kết thúc (${value}) trước giờ bắt đầu (${formData.departureFrom}).` : `End (${value}) is before start (${formData.departureFrom}).`
            );
        }
        return null;
      }
      case "imageFile": {
        if (value) {
          const type = String(value.type || "").toLowerCase();
          const ok = ["image/jpeg", "image/png", "image/webp"].includes(type);
          if (!ok)
            return err(
              "error",
              lang === "VN" ? "Định dạng ảnh không được hỗ trợ." : "Unsupported image format.",
              lang === "VN" ? `File "${value.name}" là ${type || "không xác định"}. Chỉ chấp nhận JPEG, PNG, WebP.` : `File "${value.name}" is ${type || "unknown"}. Only JPEG, PNG, WebP are supported.`
            );
        }
        return null;
      }
    }
    return null;
  };

  const setField = (field, value) => {
    const err = validateField(field, value);
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      if (onErrorsChange) onErrorsChange(next);
      return next;
    });
    onChange(field, value);
  };
  const toggleOptionalLimit = (toggleField, valueField, enabled) => {
    setField(toggleField, enabled);
    if (!enabled) setField(valueField, "");
  };
  const isPercent = formData.promotionType === PROMOTION_TYPE.PERCENT;
  const promotionRoutes = useMemo(
    () =>
      [...routes].sort(
        (left, right) =>
          Number(isRouteSelectableForPromotion(right)) -
          Number(isRouteSelectableForPromotion(left))
      ),
    [routes]
  );

  const dayNameFromIndex = (i) =>
    ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i] ?? "";

  const availableDays = (() => {
    if (!formData.validFrom || !formData.validTo) return null;
    const from = new Date(formData.validFrom);
    const to = new Date(formData.validTo);
    if (isNaN(from) || isNaN(to) || from > to) return null;
    const days = new Set();
    const cur = new Date(from);
    while (cur <= to) {
      days.add(dayNameFromIndex(cur.getDay()));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  })();

  const dayLabel = (day) => {
    const map = {
      Sunday: ["CN", "Sun"],
      Monday: ["T2", "Mon"],
      Tuesday: ["T3", "Tue"],
      Wednesday: ["T4", "Wed"],
      Thursday: ["T5", "Thu"],
      Friday: ["T6", "Fri"],
      Saturday: ["T7", "Sat"],
    };
    return lang === "VN" ? map[day]?.[0] || day : map[day]?.[1] || day;
  };

  const handleImagePick = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setField("imageFile", null);
      return;
    }
    setField("imageFile", file);
    setField("imagePreviewUrl", URL.createObjectURL(file));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
      <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
        <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2 mb-1">
          {lang === "VN" ? "Thông tin cơ bản" : "Basic Information"}
        </h3>

        <div className="flex flex-wrap items-center gap-3 pt-1 pb-1 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={formData.firstBookingOnly}
              onChange={(e) => setField("firstBookingOnly", e.target.checked)}
              className="w-4 h-4 rounded text-[#124757] focus:ring-0"
            />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              {lang === "VN" ? "Chỉ áp dụng booking đầu tiên" : "First booking only"}
            </span>
          </label>

          <span className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              {lang === "VN" ? "Hiển thị" : "Visibility"}
            </span>
            <FormSelect
              value={formData.visibility}
              onChange={(value) => setField("visibility", value)}
              options={[
                { value: PROMOTION_VISIBILITY.PUBLIC, label: lang === "VN" ? "Công khai" : "Public" },
                { value: PROMOTION_VISIBILITY.PRIVATE, label: lang === "VN" ? "Riêng tư" : "Private" },
              ]}
              className={`${inputStyle} !py-1.5 !text-xs w-[130px]`}
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              {lang === "VN" ? "Trạng thái" : "Status"}
            </span>
            <FormSelect
              value={formData.status}
              onChange={(value) => setField("status", value)}
              options={[
                { value: PROMOTION_STATUS.DRAFT, label: lang === "VN" ? "Nháp" : "Draft" },
                { value: PROMOTION_STATUS.ACTIVE, label: lang === "VN" ? "Đang chạy" : "Active" },
                { value: PROMOTION_STATUS.PAUSED, label: lang === "VN" ? "Tạm dừng" : "Paused" },
                ...(!isCreate ? [{ value: PROMOTION_STATUS.ARCHIVED, label: lang === "VN" ? "Đã lưu trữ" : "Archived" }] : []),
              ]}
              className={`${inputStyle} !py-1.5 !text-xs w-[130px]`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div data-field="promotionCode">
            <label className={labelStyle}>
              {<>{lang === "VN" ? "Mã khuyến mãi" : "Promotion Code"}{required()}</>}
            </label>
            <input
              type="text"
              required
              maxLength={50}
              disabled={lockCode}
              placeholder=""
              value={formData.promotionCode}
              onChange={(e) =>
                setField(
                  "promotionCode",
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                )
              }
              onFocus={() => setFocusedField("promotionCode")}
              onBlur={() => setFocusedField(null)}
              className={`${inputStyle} uppercase tracking-wider ${lockCode ? "cursor-not-allowed opacity-60" : ""} ${errors.promotionCode ? "border-red-400 dark:border-red-500" : ""}`}
            />
            {(formData.promotionCode || focusedField === "promotionCode") && (
              <p className="text-[10px] text-slate-400 mt-1">
                {lang === "VN" ? "Tối đa 50 ký tự, chỉ chữ in hoa và số (A–Z, 0–9), không sửa sau khi tạo." : "Max 50 chars, uppercase letters and digits only (A–Z, 0–9), locked after create."}
              </p>
            )}
            <FieldError error={errors.promotionCode} />
          </div>
          <div data-field="promotionName">
            <label className={labelStyle}>
              {<>{lang === "VN" ? "Tên khuyến mãi" : "Promotion Name"}{required()}</>}
            </label>
            <input
              type="text"
              required
              maxLength={150}
              value={formData.promotionName}
              onChange={(e) => setField("promotionName", e.target.value)}
              className={`${inputStyle} ${errors.promotionName ? "border-red-400 dark:border-red-500" : ""}`}
            />
            <FieldError error={errors.promotionName} />
          </div>
        </div>

        <div data-field="description">
          <label className={labelStyle}>{lang === "VN" ? "Mô tả" : "Description"}</label>
          <textarea
            rows={2}
            maxLength={1000}
            value={formData.description}
            onChange={(e) => setField("description", e.target.value)}
            className={`${inputStyle} resize-none font-medium ${errors.description ? "border-red-400 dark:border-red-500" : ""}`}
          />
          <div className="flex items-start justify-between gap-2 mt-1">
            <FieldError error={errors.description} className="flex-1 mt-0" />
            <p className="text-[10px] text-slate-400 shrink-0">{formData.description?.length || 0}/1000</p>
          </div>
        </div>

        <div data-field="imageFile">
          <label className={labelStyle}>{lang === "VN" ? "Ảnh khuyến mãi" : "Promotion image"}</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImagePick}
            className={`block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#124757] file:px-3 file:py-2 file:text-[10px] file:font-black file:uppercase file:text-white dark:file:bg-yellow-400 dark:file:text-slate-900 ${errors.imageFile ? "ring-1 ring-red-400 dark:ring-red-500 rounded-lg" : ""}`}
          />
          <FieldError error={errors.imageFile} />
          {formData.imagePreviewUrl ? (
            <div className="relative inline-block mt-3">
              <img
                src={formData.imagePreviewUrl}
                alt=""
                className="h-28 w-auto rounded-xl border border-slate-200 object-cover dark:border-slate-700"
              />
            </div>
          ) : null}
        </div>

        <div>
          <label className={labelStyle}>{lang === "VN" ? "Hình thức giảm giá" : "Discount Type"}</label>
          {lockType ? (
            <input
              type="text"
              disabled
              value={
                isPercent
                  ? lang === "VN"
                    ? "Giảm theo %"
                    : "Percent"
                  : lang === "VN"
                    ? "Giảm số tiền"
                    : "Fixed amount"
              }
              className={`${inputStyle} cursor-not-allowed`}
            />
          ) : (
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
              {[
                { value: PROMOTION_TYPE.PERCENT, vn: "Giảm theo %", en: "Percent" },
                { value: PROMOTION_TYPE.FIXED, vn: "Giảm số tiền", en: "Fixed amount" },
              ].map((option) => {
                const selected = formData.promotionType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setField("promotionType", option.value);
                      if (option.value === PROMOTION_TYPE.FIXED) {
                        setField("hasMaxDiscountAmount", false);
                        setField("maxDiscountAmount", "");
                      }
                    }}
                    className={`h-10 rounded-lg px-2 text-[11px] font-headline font-black uppercase tracking-wider transition-all ${
                      selected
                        ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                        : "text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {lang === "VN" ? option.vn : option.en}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
          <RequiredNumberField
            lang={lang}
            labelVn={isPercent
              ? <span>Phần trăm giảm (%)<RequiredStar /></span>
              : <span>Số tiền giảm (VND)<RequiredStar /></span>}
            labelEn={isPercent
              ? <span>Discount Percent (%)<RequiredStar /></span>
              : <span>Discount Amount (VND)<RequiredStar /></span>}
            value={formData.discountValue}
            onChange={(v) => setField("discountValue", v)}
            error={errors.discountValue}
            dataField="discountValue"
            inputProps={{
              min: 0.01,
              step: "any",
              max: isPercent ? 100 : undefined,
            }}
          />
          {isPercent ? (
            <OptionalNumberField
              lang={lang}
              labelVn="Giảm tối đa"
              labelEn="Max discount"
              enabled={formData.hasMaxDiscountAmount}
              onToggle={(v) => toggleOptionalLimit("hasMaxDiscountAmount", "maxDiscountAmount", v)}
              value={formData.maxDiscountAmount}
              onChange={(v) => setField("maxDiscountAmount", v)}
              error={errors.maxDiscountAmount}
              dataField="maxDiscountAmount"
              unit="VND"
              inputProps={{ min: 1000, step: 1000 }}
            />
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between gap-2 mb-1.5 min-h-[32px]">
                <label className={`${labelStyle} min-w-0 flex-1`}>
                  {lang === "VN" ? "Giảm tối đa" : "Max discount"}
                </label>
              </div>
              <div className="flex-1 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-3 text-[10px] text-slate-400 font-semibold flex items-center">
                {lang === "VN"
                  ? "Chỉ áp dụng khi chọn Giảm theo %"
                  : "Only available for % discount type"}
              </div>
              <FieldError />
            </div>
          )}
          <OptionalNumberField
            lang={lang}
            labelVn="Đơn tối thiểu"
            labelEn="Minimum order"
            enabled={formData.hasMinOrderValue}
            onToggle={(v) => toggleOptionalLimit("hasMinOrderValue", "minOrderValue", v)}
            value={formData.minOrderValue}
            onChange={(v) => setField("minOrderValue", v)}
            error={errors.minOrderValue}
            dataField="minOrderValue"
            unit="VND"
            inputProps={{ min: 1000, step: 1000 }}
          />
        </div>
      </div>

      <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
        <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2 mb-1">
          {lang === "VN" ? "Phạm vi áp dụng" : "Scope"}
        </h3>
        <p className="text-[10px] text-slate-400 font-semibold">
          {lang === "VN"
            ? "Để trống toàn bộ = áp dụng mọi nơi."
            : "Leave all empty = applies everywhere."}
        </p>

        <div>
          <label className={labelStyle}>{lang === "VN" ? "Loại booking" : "Booking types"}</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: PROMOTION_BOOKING_TYPES.SEAT, vn: "Đặt ghế", en: "Seat booking" },
              { value: PROMOTION_BOOKING_TYPES.CHARTER, vn: "Thuê tàu", en: "Request Booking" },
            ].map((opt) => {
              const on = formData.bookingTypes.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setField("bookingTypes", toggleInList(formData.bookingTypes, opt.value))}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase border transition ${
                    on
                      ? "bg-[#124757] text-white border-[#124757] dark:bg-yellow-400 dark:text-slate-900 dark:border-yellow-400"
                      : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:border-slate-700"
                  }`}
                >
                  {lang === "VN" ? opt.vn : opt.en}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={labelStyle}>{lang === "VN" ? "Ngày trong tuần" : "Days of week"}</label>
          <div className="flex flex-wrap gap-1.5">
            {PROMOTION_DAYS.map((day) => {
              const on = formData.daysOfWeek.includes(day);
              const available = availableDays ? availableDays.has(day) : true;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => available && setField("daysOfWeek", toggleInList(formData.daysOfWeek, day))}
                  className={`w-10 h-10 rounded-xl text-[10px] font-black border transition ${
                    on
                      ? "bg-[#124757] text-white border-[#124757] dark:bg-yellow-400 dark:text-slate-900"
                      : available
                        ? "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:border-slate-700"
                        : "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-40 dark:bg-slate-800"
                  }`}
                >
                  {dayLabel(day)}
                </button>
                );
            })}
          </div>
          {!availableDays && (
            <p className="text-[10px] text-slate-400 mt-1.5 italic">
              {lang === "VN"
                ? "Chọn ngày hiệu lực để xem ngày khả dụng."
                : "Select validity dates to see available days."}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div data-field="departureFrom">
            <label className={labelStyle}>{lang === "VN" ? "Giờ khởi hành từ (HH:mm)" : "Departure from (HH:mm)"}</label>
            <input
              type="time"
              value={formData.departureFrom}
              onChange={(e) => setField("departureFrom", e.target.value)}
              className={`${inputStyle} ${errors.departureFrom ? "border-red-400 dark:border-red-500" : ""}`}
            />
            <FieldError error={errors.departureFrom} />
          </div>
          <div data-field="departureTo">
            <label className={labelStyle}>{lang === "VN" ? "Giờ khởi hành đến (HH:mm)" : "Departure to (HH:mm)"}</label>
            <input
              type="time"
              value={formData.departureTo}
              onChange={(e) => setField("departureTo", e.target.value)}
              className={`${inputStyle} ${errors.departureTo ? "border-red-400 dark:border-red-500" : ""}`}
            />
            <FieldError error={errors.departureTo} />
          </div>
        </div>

        <div>
          <label className={labelStyle}>{lang === "VN" ? "Tuyến áp dụng" : "Routes"}</label>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {promotionRoutes.length === 0 ? (
              <p className="text-xs text-slate-400 p-3 italic">
                {lang === "VN" ? "Không tải được danh sách tuyến." : "No routes loaded."}
              </p>
            ) : (
              promotionRoutes.map((route) => {
                const id = String(route.routeId || route.id || "");
                const selectable = isRouteSelectableForPromotion(route);
                const checked = formData.routeIds.includes(id);
                return (
                  <label
                    key={id}
                    className={`flex items-start gap-3 px-3 py-2 ${
                      selectable
                        ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40"
                        : "opacity-45 cursor-not-allowed bg-slate-50/60 dark:bg-slate-900/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!selectable}
                      onChange={() =>
                        selectable && setField("routeIds", toggleInList(formData.routeIds, id))
                      }
                      className="mt-1 accent-[#124757] dark:accent-yellow-400 disabled:cursor-not-allowed"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                        {route.routeCode} · {route.routeName}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {getPromotionRouteKindLabel(route.routeType, lang)}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
        <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2 mb-1">
          {lang === "VN" ? "Thời gian & hạn mức" : "Validity & limits"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div data-field="validFrom">
            <label className={labelStyle}>{<>{lang === "VN" ? "Hiệu lực từ" : "Valid from"}{required()}</>}</label>
            <input
              type="datetime-local"
              required
              min={minDateTime}
              value={formData.validFrom}
              onChange={(e) => setField("validFrom", e.target.value)}
              className={`${inputStyle} ${errors.validFrom ? "border-red-400 dark:border-red-500" : ""}`}
            />
            <FieldError error={errors.validFrom} />
          </div>
          <div data-field="validTo">
            <label className={labelStyle}>{<>{lang === "VN" ? "Hiệu lực đến" : "Valid to"}{required()}</>}</label>
            <input
              type="datetime-local"
              required
              min={minDateTime}
              value={formData.validTo}
              onChange={(e) => setField("validTo", e.target.value)}
              className={`${inputStyle} ${errors.validTo ? "border-red-400 dark:border-red-500" : ""}`}
            />
            <FieldError error={errors.validTo} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <OptionalNumberField
            lang={lang}
            labelVn="Giới hạn lượt dùng tổng"
            labelEn="Total usage limit"
            enabled={formData.hasUsageLimit}
            onToggle={(v) => toggleOptionalLimit("hasUsageLimit", "usageLimit", v)}
            value={formData.usageLimit}
            onChange={(v) => setField("usageLimit", v)}
            error={errors.usageLimit}
            dataField="usageLimit"
            inputProps={{ min: 1, step: 1 }}
          />
          <OptionalNumberField
            lang={lang}
            labelVn="Tối đa / tài khoản"
            labelEn="Max uses / account"
            enabled={formData.hasMaxUsesPerAccount}
            onToggle={(v) => toggleOptionalLimit("hasMaxUsesPerAccount", "maxUsesPerAccount", v)}
            value={formData.maxUsesPerAccount}
            onChange={(v) => setField("maxUsesPerAccount", v)}
            error={errors.maxUsesPerAccount}
            dataField="maxUsesPerAccount"
            inputProps={{ min: 1, step: 1 }}
          />
        </div>

        <OptionalNumberField
          lang={lang}
          labelVn="Ngân sách tối đa (VND)"
          labelEn="Budget cap (VND)"
          enabled={formData.hasBudgetCap}
          onToggle={(v) => toggleOptionalLimit("hasBudgetCap", "budgetCap", v)}
          value={formData.budgetCap}
          onChange={(v) => setField("budgetCap", v)}
          error={errors.budgetCap}
          dataField="budgetCap"
          inputProps={{ min: 1000, step: 1000 }}
        />

      </div>

    </div>
  );
}
