import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import {
  fetchPromotions,
  PROMOTION_BOOKING_TYPES,
  PROMOTION_TYPE,
} from "../../../services/promotionService";
import { fetchAllRoutes } from "../../../services/routeService";
import { notify } from "../../../utils/swalToast";
import { ImageWithFallback } from "../../../components/ImageWithFallback";

const formatMoney = (value) =>
  value == null ? "—" : `${Number(value).toLocaleString("vi-VN")}đ`;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN");
};

const dayLabel = (day, lang) => {
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

const bookingTypeLabel = (type, lang) => {
  if (type === PROMOTION_BOOKING_TYPES.SEAT) return lang === "VN" ? "Đặt ghế" : "Seat booking";
  if (type === PROMOTION_BOOKING_TYPES.CHARTER) return lang === "VN" ? "Thuê tàu" : "Request Booking";
  return type;
};

const statusTone = (status) => {
  switch (status) {
    case "Active":
      return "text-emerald-600 dark:text-emerald-400";
    case "Draft":
      return "text-amber-700 dark:text-amber-400";
    case "Paused":
      return "text-sky-700 dark:text-sky-400";
    default:
      return "text-slate-500 dark:text-slate-400";
  }
};

const STATUS_LABELS = {
  Active: { vn: "Đang hoạt động", en: "Active" },
  Draft: { vn: "Nháp", en: "Draft" },
  Paused: { vn: "Tạm dừng", en: "Paused" },
  Archived: { vn: "Đã lưu trữ", en: "Archived" },
};

const statusLabel = (status, lang) => {
  const entry = STATUS_LABELS[status];
  if (!entry) return status || "—";
  return lang === "VN" ? entry.vn : entry.en;
};

function InfoRow({ label, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3 py-2 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="text-xs font-bold text-slate-800 dark:text-slate-100 wrap-break-words">{children}</dd>
    </div>
  );
}

export function ViewPromotion() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

  const [promo, setPromo] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const routeById = useMemo(() => {
    const map = new Map();
    (routes || []).forEach((r) => {
      const id = String(r.routeId || r.id || "");
      if (id) map.set(id, r);
    });
    return map;
  }, [routes]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const [list, routeList] = await Promise.all([
          fetchPromotions(),
          fetchAllRoutes().catch(() => []),
        ]);
        setRoutes(routeList || []);

        const preloaded = location.state?.promotion;
        if (preloaded && String(preloaded.id) === String(id)) {
          setPromo(preloaded);
          return;
        }
        const found = list.find((p) => String(p.id) === String(id));
        if (!found) {
          notify({
            icon: "error",
            title: lang === "VN" ? "Không tìm thấy khuyến mãi!" : "Promotion not found!",
            confirmButtonColor: "#124757",
          }).then(() => navigate("/admin/promotions"));
          return;
        }
        setPromo(found);
      } catch (error) {
        console.error(error);
        notify({
          icon: "error",
          title: lang === "VN" ? "Lỗi tải dữ liệu" : "Failed to load",
          confirmButtonColor: "#124757",
        }).then(() => navigate("/admin/promotions"));
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (isLoading || !promo) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  const scope = promo.scope || {};
  const discountLabel =
    promo.promotionType === PROMOTION_TYPE.PERCENT
      ? `${promo.discountValue}%`
      : formatMoney(promo.discountValue);

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-4xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/promotions")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide truncate">
            {promo.promotionName}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-headline font-black tracking-wider">
            {promo.promotionCode}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-base font-headline font-black uppercase tracking-wide shrink-0 ${statusTone(promo.status)}`}>
          {statusLabel(promo.status, lang)}
        </span>
        <button
          type="button"
          onClick={() => navigate(`/admin/promotions/edit/${promo.id}`, { state: { promotion: promo } })}
          className="px-4 py-2.5 rounded-xl bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 text-[10px] font-headline font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0"
        >
          <span className="material-symbols-outlined text-sm">edit</span>
          {lang === "VN" ? "Chỉnh sửa" : "Edit"}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <ImageWithFallback
          src={promo.imageUrl}
          alt={promo.promotionName}
          className="w-full h-72"
          imgClassName="w-full h-full object-cover"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2 mb-2">
            {lang === "VN" ? "Thông tin cơ bản" : "Basic info"}
          </h3>
          <dl>
            <InfoRow label={lang === "VN" ? "Loại giảm" : "Type"}>
              {promo.promotionType === PROMOTION_TYPE.PERCENT
                ? lang === "VN"
                  ? "Phần trăm"
                  : "Percent"
                : lang === "VN"
                  ? "Số tiền cố định"
                  : "Fixed"}
            </InfoRow>
            <InfoRow label={lang === "VN" ? "Giá trị giảm" : "Discount"}>{discountLabel}</InfoRow>
            <InfoRow label={lang === "VN" ? "Giảm tối đa" : "Max discount"}>
              {promo.promotionType === PROMOTION_TYPE.PERCENT
                ? formatMoney(promo.maxDiscountAmount)
                : "—"}
            </InfoRow>
            <InfoRow label={lang === "VN" ? "Đơn tối thiểu" : "Min order"}>
              {formatMoney(promo.minOrderValue)}
            </InfoRow>
            <InfoRow label={lang === "VN" ? "Hiển thị" : "Visibility"}>{promo.visibility || "—"}</InfoRow>
            <InfoRow label={lang === "VN" ? "Mô tả" : "Description"}>
              {promo.description || (lang === "VN" ? "Không có" : "None")}
            </InfoRow>
          </dl>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2 mb-2">
            {lang === "VN" ? "Thời gian & hạn mức" : "Validity & limits"}
          </h3>
          <dl>
            <InfoRow label={lang === "VN" ? "Hiệu lực từ" : "Valid from"}>
              {formatDateTime(promo.validFrom)}
            </InfoRow>
            <InfoRow label={lang === "VN" ? "Hiệu lực đến" : "Valid to"}>
              {formatDateTime(promo.validTo)}
            </InfoRow>
            <InfoRow label={lang === "VN" ? "Lượt dùng" : "Usage"}>
              {promo.usageCount}/{promo.usageLimit ?? "∞"}
            </InfoRow>
            <InfoRow label={lang === "VN" ? "Tối đa / TK" : "Max / account"}>
              {promo.maxUsesPerAccount ?? "∞"}
            </InfoRow>
            <InfoRow label={lang === "VN" ? "Ngân sách" : "Budget"}>
              {formatMoney(promo.budgetCap)}
            </InfoRow>
            <InfoRow label={lang === "VN" ? "Booking đầu" : "First booking"}>
              {promo.firstBookingOnly
                ? lang === "VN"
                  ? "Có"
                  : "Yes"
                : lang === "VN"
                  ? "Không"
                  : "No"}
            </InfoRow>
          </dl>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2 mb-2">
          {lang === "VN" ? "Phạm vi (scope)" : "Scope"}
        </h3>
        {!scope.bookingTypes?.length &&
        !scope.routeIds?.length &&
        !scope.daysOfWeek?.length &&
        !scope.departureFrom &&
        !scope.departureTo ? (
          <p className="text-xs text-slate-400 font-semibold py-2">
            {lang === "VN" ? "scope = null — áp dụng mọi nơi." : "scope = null — applies everywhere."}
          </p>
        ) : (
          <dl>
            <InfoRow label={lang === "VN" ? "Loại booking" : "Booking types"}>
              {scope.bookingTypes?.length
                ? scope.bookingTypes.map((t) => bookingTypeLabel(t, lang)).join(", ")
                : "—"}
            </InfoRow>
            <InfoRow label={lang === "VN" ? "Ngày trong tuần" : "Days"}>
              {scope.daysOfWeek?.length
                ? scope.daysOfWeek.map((d) => dayLabel(d, lang)).join(", ")
                : "—"}
            </InfoRow>
            <InfoRow label={lang === "VN" ? "Giờ khởi hành" : "Departure"}>
              {scope.departureFrom || scope.departureTo
                ? `${scope.departureFrom || "—"} → ${scope.departureTo || "—"}`
                : "—"}
            </InfoRow>
            <InfoRow label={lang === "VN" ? "Tuyến áp dụng" : "Routes"}>
              {scope.routeIds?.length ? (
                <ul className="space-y-1.5">
                  {scope.routeIds.map((rid) => {
                    const route = routeById.get(String(rid));
                    return (
                      <li key={rid} className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {route ? (
                          <>
                            <span className="font-headline font-black tracking-wide text-[#124757] dark:text-yellow-400">
                              {route.routeCode}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400"> · {route.routeName}</span>
                          </>
                        ) : (
                          <span className="font-mono text-[10px] text-slate-400">{rid}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                "—"
              )}
            </InfoRow>
          </dl>
        )}
      </div>
    </div>
  );
}
