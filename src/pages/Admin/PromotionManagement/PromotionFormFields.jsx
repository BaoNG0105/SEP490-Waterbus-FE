import { useEffect, useState } from "react";
import { fetchAllRoutes } from "../../../services/routeService";
import {
  PROMOTION_BOOKING_TYPES,
  PROMOTION_DAYS,
  PROMOTION_STATUS,
  PROMOTION_TYPE,
  PROMOTION_VISIBILITY,
  getPromotionRouteKindLabel,
  isRouteSelectableForPromotion,
} from "../../../services/promotionService";

const labelStyle =
  "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
const inputStyle =
  "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all disabled:opacity-50";

const OptionalNumberField = ({
  lang,
  labelVn,
  labelEn,
  enabled,
  onToggle,
  value,
  onChange,
  unlimitedVn = "Không giới hạn",
  unlimitedEn = "Unlimited",
}) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
        {lang === "VN" ? labelVn : labelEn}
      </label>
      <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 cursor-pointer">
        <input
          type="checkbox"
          checked={!enabled}
          onChange={(e) => onToggle(!e.target.checked)}
          className="w-3.5 h-3.5 rounded text-[#124757] focus:ring-0 cursor-pointer"
        />
        {lang === "VN" ? unlimitedVn : unlimitedEn}
      </label>
    </div>
    <input
      type="number"
      min={0}
      disabled={!enabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputStyle}
    />
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
}) {
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    fetchAllRoutes()
      .then((data) => setRoutes(data || []))
      .catch(() => setRoutes([]));
  }, []);

  const setField = (field, value) => onChange(field, value);
  const isPercent = formData.promotionType === PROMOTION_TYPE.PERCENT;

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
    <>
      <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
        <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
          {lang === "VN" ? "Thông tin cơ bản" : "Basic Information"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelStyle}>
              {lang === "VN" ? "Mã khuyến mãi (*)" : "Promotion Code (*)"}
            </label>
            <input
              type="text"
              required
              maxLength={50}
              disabled={lockCode}
              placeholder="WELCOME10"
              value={formData.promotionCode}
              onChange={(e) => setField("promotionCode", e.target.value.toUpperCase())}
              className={`${inputStyle} uppercase tracking-wider ${lockCode ? "cursor-not-allowed opacity-60" : ""}`}
            />
            <p className="text-[10px] text-slate-400 mt-1">
              {lang === "VN" ? "Tối đa 50 ký tự, tự chuyển hoa, không sửa sau khi tạo." : "Max 50 chars, uppercase, locked after create."}
            </p>
          </div>
          <div>
            <label className={labelStyle}>
              {lang === "VN" ? "Tên khuyến mãi (*)" : "Promotion Name (*)"}
            </label>
            <input
              type="text"
              required
              maxLength={150}
              value={formData.promotionName}
              onChange={(e) => setField("promotionName", e.target.value)}
              className={inputStyle}
            />
          </div>
        </div>

        <div>
          <label className={labelStyle}>{lang === "VN" ? "Mô tả" : "Description"}</label>
          <textarea
            rows={2}
            maxLength={1000}
            value={formData.description}
            onChange={(e) => setField("description", e.target.value)}
            className={`${inputStyle} resize-none font-medium`}
          />
          <p className="text-[10px] text-slate-400 mt-1">{formData.description?.length || 0}/1000</p>
        </div>

        <div>
          <label className={labelStyle}>{lang === "VN" ? "Ảnh khuyến mãi" : "Promotion image"}</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImagePick}
            className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#124757] file:px-3 file:py-2 file:text-[10px] file:font-black file:uppercase file:text-white dark:file:bg-yellow-400 dark:file:text-slate-900"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            {lang === "VN"
              ? "JPEG / PNG / WebP. Upload qua PUT /promotions/{id}/image sau khi tạo."
              : "JPEG / PNG / WebP. Uploaded via PUT /promotions/{id}/image after create."}
          </p>
          {formData.imagePreviewUrl ? (
            <img
              src={formData.imagePreviewUrl}
              alt=""
              className="mt-3 h-28 w-auto rounded-xl border border-slate-200 object-cover dark:border-slate-700"
            />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelStyle}>
              {isPercent
                ? lang === "VN"
                  ? "Phần trăm giảm (%) (*)"
                  : "Discount Percent (%) (*)"
                : lang === "VN"
                  ? "Số tiền giảm (VND) (*)"
                  : "Discount Amount (VND) (*)"}
            </label>
            <input
              type="number"
              required
              min={0.01}
              step="any"
              max={isPercent ? 100 : undefined}
              value={formData.discountValue}
              onChange={(e) => setField("discountValue", e.target.value)}
              className={inputStyle}
            />
          </div>
          {isPercent ? (
            <OptionalNumberField
              lang={lang}
              labelVn="Giảm tối đa (VND)"
              labelEn="Max discount (VND)"
              enabled={formData.hasMaxDiscountAmount}
              onToggle={(v) => setField("hasMaxDiscountAmount", v)}
              value={formData.maxDiscountAmount}
              onChange={(v) => setField("maxDiscountAmount", v)}
              unlimitedVn="Không giới hạn"
              unlimitedEn="No max"
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-3 text-[10px] text-slate-400 font-semibold">
              {lang === "VN"
                ? "Fixed: maxDiscountAmount luôn null."
                : "Fixed: maxDiscountAmount is always null."}
            </div>
          )}
        </div>

        <OptionalNumberField
          lang={lang}
          labelVn="Giá trị đơn tối thiểu (VND)"
          labelEn="Minimum order (VND)"
          enabled={formData.hasMinOrderValue}
          onToggle={(v) => setField("hasMinOrderValue", v)}
          value={formData.minOrderValue}
          onChange={(v) => setField("minOrderValue", v)}
          unlimitedVn="Không yêu cầu"
          unlimitedEn="No minimum"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
        <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
          {lang === "VN" ? "Thời gian & hạn mức" : "Validity & limits"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Hiệu lực từ (*)" : "Valid from (*)"}</label>
            <input
              type="datetime-local"
              required
              value={formData.validFrom}
              onChange={(e) => setField("validFrom", e.target.value)}
              className={inputStyle}
            />
          </div>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Hiệu lực đến (*)" : "Valid to (*)"}</label>
            <input
              type="datetime-local"
              required
              value={formData.validTo}
              onChange={(e) => setField("validTo", e.target.value)}
              className={inputStyle}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <OptionalNumberField
            lang={lang}
            labelVn="Giới hạn lượt dùng tổng"
            labelEn="Total usage limit"
            enabled={formData.hasUsageLimit}
            onToggle={(v) => setField("hasUsageLimit", v)}
            value={formData.usageLimit}
            onChange={(v) => setField("usageLimit", v)}
          />
          <OptionalNumberField
            lang={lang}
            labelVn="Tối đa / tài khoản"
            labelEn="Max uses / account"
            enabled={formData.hasMaxUsesPerAccount}
            onToggle={(v) => setField("hasMaxUsesPerAccount", v)}
            value={formData.maxUsesPerAccount}
            onChange={(v) => setField("maxUsesPerAccount", v)}
          />
        </div>

        <OptionalNumberField
          lang={lang}
          labelVn="Ngân sách tối đa (VND)"
          labelEn="Budget cap (VND)"
          enabled={formData.hasBudgetCap}
          onToggle={(v) => setField("hasBudgetCap", v)}
          value={formData.budgetCap}
          onChange={(v) => setField("budgetCap", v)}
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.firstBookingOnly}
            onChange={(e) => setField("firstBookingOnly", e.target.checked)}
            className="w-4 h-4 rounded text-[#124757] focus:ring-0"
          />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            {lang === "VN" ? "Chỉ áp dụng booking đầu tiên" : "First booking only"}
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Hiển thị" : "Visibility"}</label>
            <select
              value={formData.visibility}
              onChange={(e) => setField("visibility", e.target.value)}
              className={inputStyle}
            >
              <option value={PROMOTION_VISIBILITY.PUBLIC}>{lang === "VN" ? "Công khai" : "Public"}</option>
              <option value={PROMOTION_VISIBILITY.PRIVATE}>{lang === "VN" ? "Riêng tư" : "Private"}</option>
            </select>
          </div>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Trạng thái" : "Status"}</label>
            <select
              value={formData.status}
              onChange={(e) => setField("status", e.target.value)}
              className={inputStyle}
            >
              <option value={PROMOTION_STATUS.DRAFT}>Draft</option>
              <option value={PROMOTION_STATUS.ACTIVE}>Active</option>
              <option value={PROMOTION_STATUS.PAUSED}>Paused</option>
              {!isCreate && <option value={PROMOTION_STATUS.ARCHIVED}>Archived</option>}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
        <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
          {lang === "VN" ? "Phạm vi áp dụng (scope)" : "Scope"}
        </h3>
        <p className="text-[10px] text-slate-400 font-semibold">
          {lang === "VN"
            ? "Để trống toàn bộ = scope null (áp dụng mọi nơi)."
            : "Leave all empty = scope null (applies everywhere)."}
        </p>

        <div>
          <label className={labelStyle}>{lang === "VN" ? "Loại booking" : "Booking types"}</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: PROMOTION_BOOKING_TYPES.SEAT, vn: "Đặt ghế", en: "Seat booking" },
              { value: PROMOTION_BOOKING_TYPES.CHARTER, vn: "Thuê tàu", en: "Charter" },
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
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setField("daysOfWeek", toggleInList(formData.daysOfWeek, day))}
                  className={`w-10 h-10 rounded-xl text-[10px] font-black border transition ${
                    on
                      ? "bg-[#124757] text-white border-[#124757] dark:bg-yellow-400 dark:text-slate-900"
                      : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:border-slate-700"
                  }`}
                >
                  {dayLabel(day)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Giờ khởi hành từ (HH:mm)" : "Departure from (HH:mm)"}</label>
            <input
              type="time"
              value={formData.departureFrom}
              onChange={(e) => setField("departureFrom", e.target.value)}
              className={inputStyle}
            />
          </div>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Giờ khởi hành đến (HH:mm)" : "Departure to (HH:mm)"}</label>
            <input
              type="time"
              value={formData.departureTo}
              onChange={(e) => setField("departureTo", e.target.value)}
              className={inputStyle}
            />
          </div>
        </div>

        <div>
          <label className={labelStyle}>{lang === "VN" ? "Tuyến áp dụng" : "Routes"}</label>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {(routes || []).length === 0 ? (
              <p className="text-xs text-slate-400 p-3 italic">
                {lang === "VN" ? "Không tải được danh sách tuyến." : "No routes loaded."}
              </p>
            ) : (
              routes.map((route) => {
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
    </>
  );
}
