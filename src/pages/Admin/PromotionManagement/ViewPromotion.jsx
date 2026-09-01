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
import { ArrowLeft, CalendarDays, ExternalLink, Pencil, TicketPercent } from "lucide-react";

const formatMoney = (value) =>
  value == null ? "—" : `${Number(value).toLocaleString("vi-VN")}đ`;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    <div className="grid grid-cols-[112px_1fr] gap-3 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-700/60 sm:grid-cols-[128px_1fr]">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="wrap-break-words text-xs font-semibold text-slate-700 dark:text-slate-100">{children}</dd>
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
  const hasScope = Boolean(
    scope.bookingTypes?.length ||
    scope.routeIds?.length ||
    scope.daysOfWeek?.length ||
    scope.departureFrom ||
    scope.departureTo
  );
  const discountLabel =
    promo.promotionType === PROMOTION_TYPE.PERCENT
      ? `${promo.discountValue}%`
      : formatMoney(promo.discountValue);

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-2 pb-10 font-body animate-fade-in sm:px-4">
      <div className="flex flex-wrap items-center gap-3 rounded-4xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => navigate("/admin/promotions")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-[#124757] hover:text-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-yellow-400 dark:hover:text-yellow-400"
          title={lang === "VN" ? "Quay lại" : "Back"}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="truncate font-headline text-lg font-black text-[#124757] dark:text-yellow-400 md:text-xl">
            {promo.promotionName}
          </h2>
          <p className="mt-0.5 font-headline text-[10px] font-black tracking-wider text-slate-400">
            {promo.promotionCode}
          </p>
        </div>
        <span className={`inline-flex shrink-0 rounded-full bg-slate-50 px-2.5 py-1 font-headline text-[10px] font-black uppercase tracking-wide dark:bg-slate-900 ${statusTone(promo.status)}`}>
          {statusLabel(promo.status, lang)}
        </span>
        <button
          type="button"
          onClick={() => navigate(`/admin/promotions/edit/${promo.id}`, { state: { promotion: promo } })}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#124757] px-3.5 py-2.5 font-headline text-[10px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#0d3946] dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300"
        >
          <Pencil size={14} aria-hidden="true" />
          {lang === "VN" ? "Chỉnh sửa" : "Edit"}
        </button>
      </div>

      <div className="overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="grid lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.1fr)]">
          <div className="relative border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50 lg:border-b-0 lg:border-r">
            {promo.imageUrl && (
              <a
                href={promo.imageUrl}
                target="_blank"
                rel="noreferrer"
                title={lang === "VN" ? "Mở ảnh gốc" : "Open original image"}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-500 shadow-sm transition-colors hover:border-[#124757] hover:text-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:hover:border-yellow-400 dark:hover:text-yellow-400"
              >
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            )}
            <ImageWithFallback
              src={promo.imageUrl}
              alt={promo.promotionName}
              className="h-[280px] w-full bg-transparent p-2 sm:h-[340px] dark:bg-transparent"
              imgClassName="h-full w-full object-contain"
              iconClassName="h-20 w-20"
            />
          </div>

          <section className="flex flex-col justify-center p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <TicketPercent size={15} aria-hidden="true" />
              {promo.promotionType === PROMOTION_TYPE.PERCENT
                ? (lang === "VN" ? "Giảm theo phần trăm" : "Percentage discount")
                : (lang === "VN" ? "Giảm số tiền cố định" : "Fixed discount")}
            </div>
            <strong className="font-headline text-4xl font-black text-[#124757] dark:text-yellow-400">{discountLabel}</strong>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {promo.description || (lang === "VN" ? "Chưa có mô tả cho khuyến mãi này." : "No description for this promotion.")}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-4 dark:border-slate-700/60 sm:grid-cols-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{lang === "VN" ? "Đơn tối thiểu" : "Min order"}</p>
                <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-100">{formatMoney(promo.minOrderValue)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{lang === "VN" ? "Lượt sử dụng" : "Usage"}</p>
                <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-100">{promo.usageCount || 0}/{promo.usageLimit ?? "∞"}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{lang === "VN" ? "Hiển thị" : "Visibility"}</p>
                <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-100">{promo.visibility || "—"}</p>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3">
              <CalendarDays size={17} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-1 text-xs sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatDateTime(promo.validFrom)}</span>
                <span className="hidden text-slate-300 sm:inline">→</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200 sm:text-right">{formatDateTime(promo.validTo)}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="grid border-t border-slate-200 dark:border-slate-700 lg:grid-cols-2">
          <section className="p-5 sm:p-6 lg:border-r lg:border-slate-200 lg:dark:border-slate-700">
            <h3 className="mb-2 font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Điều kiện sử dụng" : "Usage conditions"}
            </h3>
            <dl>
              <InfoRow label={lang === "VN" ? "Giảm tối đa" : "Max discount"}>
                {promo.promotionType === PROMOTION_TYPE.PERCENT ? formatMoney(promo.maxDiscountAmount) : "—"}
              </InfoRow>
              <InfoRow label={lang === "VN" ? "Tối đa / TK" : "Max / account"}>{promo.maxUsesPerAccount ?? "∞"}</InfoRow>
              <InfoRow label={lang === "VN" ? "Ngân sách" : "Budget"}>
                {promo.budgetCap == null ? (lang === "VN" ? "Không giới hạn" : "Unlimited") : formatMoney(promo.budgetCap)}
              </InfoRow>
              <InfoRow label={lang === "VN" ? "Đơn đầu tiên" : "First booking"}>
                {promo.firstBookingOnly ? (lang === "VN" ? "Có" : "Yes") : (lang === "VN" ? "Không" : "No")}
              </InfoRow>
            </dl>
          </section>

          <section className="border-t border-slate-200 p-5 dark:border-slate-700 sm:p-6 lg:border-t-0">
            <h3 className="mb-2 font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Phạm vi áp dụng" : "Applies to"}
            </h3>
            {!hasScope ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                {lang === "VN" ? "Áp dụng cho tất cả loại đặt chỗ, tuyến và thời gian." : "Applies to all booking types, routes and times."}
              </p>
            ) : (
              <dl>
                <InfoRow label={lang === "VN" ? "Loại đặt chỗ" : "Booking types"}>
                  {scope.bookingTypes?.length ? scope.bookingTypes.map((t) => bookingTypeLabel(t, lang)).join(", ") : (lang === "VN" ? "Tất cả" : "All")}
                </InfoRow>
                <InfoRow label={lang === "VN" ? "Ngày áp dụng" : "Days"}>
                  {scope.daysOfWeek?.length ? scope.daysOfWeek.map((d) => dayLabel(d, lang)).join(", ") : (lang === "VN" ? "Tất cả" : "All")}
                </InfoRow>
                <InfoRow label={lang === "VN" ? "Khung giờ" : "Departure"}>
                  {scope.departureFrom || scope.departureTo ? `${scope.departureFrom || "—"} → ${scope.departureTo || "—"}` : (lang === "VN" ? "Cả ngày" : "All day")}
                </InfoRow>
                <InfoRow label={lang === "VN" ? "Tuyến" : "Routes"}>
                  {scope.routeIds?.length ? (
                    <ul className="space-y-1">
                      {scope.routeIds.map((rid) => {
                        const route = routeById.get(String(rid));
                        return (
                          <li key={rid}>
                            {route ? `${route.routeCode} · ${route.routeName}` : <span className="font-mono text-[10px] text-slate-400">{rid}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (lang === "VN" ? "Tất cả tuyến" : "All routes")}
                </InfoRow>
              </dl>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
