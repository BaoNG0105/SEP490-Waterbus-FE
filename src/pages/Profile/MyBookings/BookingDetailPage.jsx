import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { QRCodeSVG } from "qrcode.react";
import { useApp } from "../../../context/AppContext";
import { fetchMyBookingDetail } from "../../../services/bookingService";
import { PayOSLogo, payosButtonClassName } from "../../../components/PayOSLogo";
import { CharterInsuranceInfo } from "../../../components/CharterInsuranceInfo";
import { getBookingServiceConfig } from "../../../utils/bookingServiceType";
import {
  getBookingInsurancePackageId,
  normalizeInsuranceFromBooking,
  resolveInsuranceSelected,
} from "../../../utils/insurancePreview";
import { INSURANCE_BOOKING_TYPES } from "../../../services/insuranceService";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const STATUS_STYLES = {
  pendingpayment: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  completed: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700/40 dark:text-slate-400 dark:border-slate-600",
  expired: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  used: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
};

const STATUS_LABELS = {
  pendingpayment: { vn: "Chờ thanh toán", en: "Pending payment" },
  confirmed: { vn: "Đã xác nhận", en: "Confirmed" },
  completed: { vn: "Hoàn thành", en: "Completed" },
  cancelled: { vn: "Đã hủy", en: "Cancelled" },
  expired: { vn: "Hết hạn", en: "Expired" },
  paid: { vn: "Đã thanh toán", en: "Paid" },
  active: { vn: "Còn hiệu lực", en: "Active" },
  pending: { vn: "Chờ xử lý", en: "Pending" },
  used: { vn: "Đã sử dụng", en: "Used" },
};

const getStatusKey = (status) => String(status || "").toLowerCase().replace(/[\s_-]/g, "");
const getStatusClasses = (status) => STATUS_STYLES[getStatusKey(status)]
  || "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700/40 dark:text-slate-400 dark:border-slate-600";
const getStatusLabel = (status, lang = "VN") => {
  const entry = STATUS_LABELS[getStatusKey(status)];
  if (!entry) return status || "--";
  return lang === "VN" ? entry.vn : entry.en;
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
};

const formatTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const formatDateOnly = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const normalizeItem = (item) => ({
  id: pick(item, ["bookingItemId", "id"], ""),
  tripCode: pick(item, ["tripCode"], ""),
  passengerName: pick(item, ["passengerName"], "--"),
  passengerPhone: pick(item, ["passengerPhone"], ""),
  ticketTypeName: pick(item, ["ticketTypeName", "ticketTypeCode"], ""),
  seatNumber: pick(item, ["seatNumber"], ""),
  fromStationName: pick(item, ["fromStationName"], "--"),
  toStationName: pick(item, ["toStationName"], "--"),
  scheduledDeparture: pick(item, ["scheduledDeparture"], ""),
  scheduledArrival: pick(item, ["scheduledArrival"], ""),
  unitPrice: Number(pick(item, ["unitPrice"], 0)),
  itemStatus: pick(item, ["itemStatus"], ""),
  ticketCode: pick(item, ["ticketCode"], ""),
  ticketQrToken: pick(item, ["ticketQrToken"], ""),
  ticketStatus: pick(item, ["ticketStatus"], ""),
});

const normalizePayment = (payment) => ({
  id: pick(payment, ["paymentId", "id"], ""),
  paymentCode: pick(payment, ["paymentCode"], "--"),
  provider: pick(payment, ["provider"], ""),
  amount: Number(pick(payment, ["amount"], 0)),
  paymentMethod: pick(payment, ["paymentMethod"], ""),
  paymentPurpose: pick(payment, ["paymentPurpose"], ""),
  paymentStatus: pick(payment, ["paymentStatus"], ""),
  checkoutUrl: pick(payment, ["checkoutUrl"], ""),
  qrCode: pick(payment, ["qrCode"], ""),
  paidAt: pick(payment, ["paidAt"], ""),
  expiresAt: pick(payment, ["expiresAt"], ""),
  refundAmount: Number(pick(payment, ["refundAmount"], 0)),
});

const normalizeBookingDetail = (data) => ({
  id: String(pick(data, ["bookingId", "id"], "")),
  bookingCode: pick(data, ["bookingCode"], "--"),
  bookedAt: pick(data, ["bookedAt"], ""),
  status: pick(data, ["bookingStatus"], "--"),
  serviceType: pick(data, ["serviceType"], ""),
  subtotalAmount: Number(pick(data, ["subtotalAmount"], 0)),
  discountAmount: Number(pick(data, ["discountAmount"], 0)),
  totalAmount: Number(pick(data, ["totalAmount"], 0)),
  pointsUsed: Number(pick(data, ["pointsUsed"], 0)),
  pointsEarned: Number(pick(data, ["pointsEarned"], 0)),
  promotionCode: pick(data, ["promotionCode"], ""),
  paymentStatus: pick(data, ["paymentStatus"], ""),
  bookingQrToken: pick(data, ["bookingQrToken"], ""),
  holdExpiresAt: pick(data, ["holdExpiresAt"], ""),
  returnTripCode: pick(data, ["returnTripCode"], ""),
  insuranceSelected: resolveInsuranceSelected(data),
  insurancePackageId: getBookingInsurancePackageId(data),
  insurance: normalizeInsuranceFromBooking(data),
  items: Array.isArray(data?.items) ? data.items.map(normalizeItem) : [],
  payments: Array.isArray(data?.payments) ? data.payments.map(normalizePayment) : [],
});

function CopyableCode({ value, className = "" }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — silently ignore.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Click to copy"
      className={`flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left font-mono text-[11px] font-bold text-slate-600 transition hover:border-[#124757]/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${className}`}
    >
      <span className="min-w-0 flex-1 break-all">{value}</span>
      <span className="material-symbols-outlined shrink-0 text-sm text-slate-400">
        {copied ? "check" : "content_copy"}
      </span>
    </button>
  );
}

// Vé/booking dùng qrToken làm mã quét — encode thành ảnh QR thật để staff scan được.
function QrCodeBlock({ value, label, size = 88 }) {
  const [isEnlarged, setIsEnlarged] = useState(false);
  if (!value) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsEnlarged(true)}
        title={label}
        className="inline-flex flex-col items-center gap-1"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700">
          <QRCodeSVG value={value} size={size} />
        </div>
        <span className="text-[10px] font-bold text-slate-400">{label}</span>
      </button>

      {isEnlarged && (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsEnlarged(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setIsEnlarged(false); }}
          role="presentation"
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label={label}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-headline font-black text-[#124757] dark:text-yellow-400">{label}</span>
              <button type="button" onClick={() => setIsEnlarged(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex justify-center">
              <QRCodeSVG value={value} size={240} />
            </div>
            <p className="mt-4 break-all text-center font-mono text-[11px] text-slate-500">{value}</p>
          </div>
        </div>
      )}
    </>
  );
}

const DetailSkeleton = () => (
  <div className="mx-auto max-w-5xl animate-pulse space-y-4">
    <div className="h-28 rounded-3xl bg-slate-200 dark:bg-slate-700" />
    <div className="h-52 rounded-3xl bg-slate-100 dark:bg-slate-800" />
    <div className="h-40 rounded-3xl bg-slate-100 dark:bg-slate-800" />
  </div>
);

const StatusBadge = ({ status, lang }) => {
  if (!status) return null;
  return (
    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wide ${getStatusClasses(status)}`}>
      {getStatusLabel(status, lang)}
    </span>
  );
};

export function BookingDetailPage({ serviceType }) {
  const config = getBookingServiceConfig(serviceType);
  const { lang } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAuthenticated } = useSelector((state) => state.auth);

  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
    []
  );

  const loadDetail = useCallback(async ({ silent = false } = {}) => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    try {
      if (!silent) {
        setIsLoading(true);
        setErrorMsg("");
        setNotFound(false);
      }
      const data = await fetchMyBookingDetail(id);
      setBooking(normalizeBookingDetail(data));
    } catch (error) {
      console.error(`Lỗi tải chi tiết booking ${id}:`, error);
      if (error?.response?.status === 404) {
        setNotFound(true);
      } else if (!silent) {
        setErrorMsg(error.response?.data?.message || (lang === "VN" ? "Không thể tải chi tiết booking." : "Unable to load this booking."));
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [id, isAuthenticated, lang, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadDetail();
  }, [loadDetail]);

  const holdExpiresAtMs = booking?.holdExpiresAt
    ? new Date(booking.holdExpiresAt).getTime()
    : NaN;
  const hasActiveHold = Number.isFinite(holdExpiresAtMs)
    && getStatusKey(booking?.status) === "pendingpayment";
  const hasPendingPaymentDeadline = Boolean(
    booking?.payments?.some((payment) => (
      getStatusKey(payment.paymentStatus) === "pending"
      && payment.expiresAt
    )),
  );

  useEffect(() => {
    if (!hasActiveHold && !hasPendingPaymentDeadline) return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasActiveHold, hasPendingPaymentDeadline]);

  // Hết holdExpiresAt → refetch GET /bookings/{id} để lấy status Expired / ghế đã nhả.
  useEffect(() => {
    if (!hasActiveHold || !Number.isFinite(holdExpiresAtMs)) return undefined;
    const remaining = holdExpiresAtMs - Date.now();
    if (remaining <= 0) {
      loadDetail({ silent: true });
      return undefined;
    }
    const timer = window.setTimeout(() => loadDetail({ silent: true }), remaining + 200);
    return () => window.clearTimeout(timer);
  }, [hasActiveHold, holdExpiresAtMs, loadDetail]);

  const holdRemainingMs = hasActiveHold ? Math.max(0, holdExpiresAtMs - nowTick) : 0;
  const isHoldExpired = hasActiveHold && holdRemainingMs <= 0;
  const isBookingExpired = getStatusKey(booking?.status) === "expired" || isHoldExpired;

  const formatCountdown = (msRemaining) => {
    const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const groupedTrips = useMemo(() => {
    if (!booking) return [];
    const map = new Map();
    booking.items.forEach((item) => {
      if (!map.has(item.tripCode)) map.set(item.tripCode, []);
      map.get(item.tripCode).push(item);
    });
    return [...map.entries()].map(([tripCode, items]) => ({
      tripCode,
      isReturn: Boolean(booking.returnTripCode) && tripCode === booking.returnTripCode,
      items,
    }));
  }, [booking]);

  // BE: ẩn hoàn tiền cho booking thường + sightseeing. Charter dùng luồng riêng (hủy → nhập STK).
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-30 px-4 font-body transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
        <DetailSkeleton />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 py-30 px-4 font-body transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-4xl border border-dashed border-slate-200 bg-white p-16 text-center dark:border-slate-700 dark:bg-slate-800">
          <span className="material-symbols-outlined mb-3 block text-5xl text-slate-300 dark:text-slate-600">search_off</span>
          <p className="font-headline text-lg font-black text-slate-500 dark:text-slate-300">
            {lang === "VN" ? "Không tìm thấy booking này." : "This booking could not be found."}
          </p>
          <button
            type="button"
            onClick={() => navigate(config.basePath)}
            className="mt-4 rounded-xl bg-[#FFD100] px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-slate-900"
          >
            {lang === "VN" ? "Về danh sách vé" : "Back to bookings"}
          </button>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-50 py-30 px-4 font-body transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-100 bg-red-50 p-6 text-sm font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {errorMsg}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-30 px-4 font-body transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-5xl space-y-5">
        <button
          type="button"
          onClick={() => navigate(config.basePath)}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#124757] dark:text-slate-400 dark:hover:text-yellow-400"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          {lang === "VN" ? "Về danh sách vé" : "Back to bookings"}
        </button>

        {/* HEADER — cùng ngôn ngữ card danh sách vé */}
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <div className="flex flex-col gap-4 border-l-4 border-[#124757] p-5 pl-5 dark:border-yellow-400 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-400">
                {lang === "VN" ? "Chi tiết đặt vé" : "Booking detail"}
              </p>
              <h1 className="mt-1 truncate font-headline text-2xl font-black text-[#124757] dark:text-white">
                {booking.bookingCode}
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {lang === "VN" ? "Đặt lúc" : "Booked at"} {formatDateTime(booking.bookedAt)}
                {booking.items.length > 0
                  ? ` · ${booking.items.length} ${lang === "VN" ? "vé" : "ticket(s)"}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={booking.status} lang={lang} />
              {booking.paymentStatus ? <StatusBadge status={booking.paymentStatus} lang={lang} /> : null}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          <div className="space-y-5 lg:col-span-7">
            {groupedTrips.map((group) => (
              <section
                key={group.tripCode}
                className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-700 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-headline font-black text-[#124757] dark:text-yellow-400">
                      {group.isReturn
                        ? (lang === "VN" ? "Chiều về" : "Return")
                        : (lang === "VN" ? "Chiều đi" : "Departure")}
                    </span>
                    {group.tripCode ? (
                      <span className="font-mono text-[11px] font-bold text-slate-400">{group.tripCode}</span>
                    ) : null}
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    {group.items.length} {lang === "VN" ? "vé" : "ticket(s)"}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {group.items.map((item) => {
                    const isLoopTour = item.fromStationName && item.fromStationName === item.toStationName;
                    const sameDay = formatDateOnly(item.scheduledArrival) === formatDateOnly(item.scheduledDeparture);
                    const routeTitle = isLoopTour
                      ? (lang === "VN"
                        ? `Tour vòng quanh ${item.fromStationName}`
                        : `Loop tour around ${item.fromStationName}`)
                      : `${item.fromStationName} → ${item.toStationName}`;
                    const timeLine = `${formatDateOnly(item.scheduledDeparture)} · ${formatTime(item.scheduledDeparture)} → ${sameDay ? "" : `${formatDateOnly(item.scheduledArrival)} `}${formatTime(item.scheduledArrival)}`;

                    return (
                      <article key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:gap-5 sm:p-6">
                        {(item.ticketQrToken || item.ticketCode) ? (
                          <div className="flex shrink-0 items-start gap-3">
                            {item.ticketQrToken ? (
                              <QrCodeBlock
                                value={item.ticketQrToken}
                                label={lang === "VN" ? "QR vé" : "Ticket QR"}
                                size={72}
                              />
                            ) : null}
                          </div>
                        ) : null}

                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h3 className="font-headline text-base font-black text-[#124757] dark:text-white">
                                {routeTitle}
                              </h3>
                              <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                {timeLine}
                              </p>
                            </div>
                            <StatusBadge status={item.ticketStatus || item.itemStatus} lang={lang} />
                          </div>

                          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                            <div>
                              <dt className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Ghế" : "Seat"}</dt>
                              <dd className="font-bold text-[#124757] dark:text-yellow-400">{item.seatNumber || "--"}</dd>
                            </div>
                            <div>
                              <dt className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Loại vé" : "Type"}</dt>
                              <dd className="font-bold text-slate-700 dark:text-slate-200">{item.ticketTypeName || "--"}</dd>
                            </div>
                            <div>
                              <dt className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Giá" : "Fare"}</dt>
                              <dd className="font-bold text-slate-700 dark:text-slate-200">{currencyFormatter.format(item.unitPrice)}</dd>
                            </div>
                            <div className="col-span-2 sm:col-span-3">
                              <dt className="text-[11px] font-bold text-slate-400">{lang === "VN" ? "Hành khách" : "Passenger"}</dt>
                              <dd className="font-bold text-slate-700 dark:text-slate-200">
                                {item.passengerName}
                                {item.passengerPhone ? ` · ${item.passengerPhone}` : ""}
                              </dd>
                            </div>
                          </dl>

                          {item.ticketCode ? (
                            <div>
                              <p className="mb-1 text-[11px] font-bold text-slate-400">
                                {lang === "VN" ? "Mã vé" : "Ticket code"}
                              </p>
                              <CopyableCode value={item.ticketCode} />
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="space-y-5 lg:sticky lg:top-28 lg:col-span-5">
            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
              <div className="border-b border-slate-100 px-5 py-3.5 dark:border-slate-700 sm:px-6">
                <h3 className="font-headline text-sm font-black text-[#124757] dark:text-white">
                  {lang === "VN" ? "Chi tiết booking" : "Booking details"}
                </h3>
              </div>
              <div className="space-y-4 p-5 sm:p-6">
                <div className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between gap-3">
                    <span>{lang === "VN" ? "Tạm tính" : "Subtotal"}</span>
                    <span className="font-bold">{currencyFormatter.format(booking.subtotalAmount)}</span>
                  </div>
                  <div className={`flex justify-between gap-3 ${booking.discountAmount > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                    <span>{lang === "VN" ? "Giảm giá" : "Discount"}</span>
                    <span className="font-bold">
                      {booking.discountAmount > 0
                        ? `-${currencyFormatter.format(booking.discountAmount)}`
                        : currencyFormatter.format(0)}
                    </span>
                  </div>
                  {Number(booking.insurance?.totalAmount) > 0 ? (
                    <div className="flex justify-between gap-3">
                      <span>{lang === "VN" ? "Bảo hiểm" : "Insurance"}</span>
                      <span className="font-bold">{currencyFormatter.format(booking.insurance.totalAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3">
                    <span>{lang === "VN" ? "Mã ưu đãi" : "Promotion"}</span>
                    <span className={`font-bold ${booking.promotionCode ? "font-mono text-[#124757] dark:text-yellow-400" : ""}`}>
                      {booking.promotionCode || "--"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>{lang === "VN" ? "Điểm đã dùng" : "Points used"}</span>
                    <span className="font-bold">{booking.pointsUsed > 0 ? `-${booking.pointsUsed}` : 0}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>{lang === "VN" ? "Điểm tích được" : "Points earned"}</span>
                    <span className="font-bold">{booking.pointsEarned > 0 ? `+${booking.pointsEarned}` : 0}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
                    <span className="font-headline font-black text-[#124757] dark:text-white">
                      {lang === "VN" ? "Tổng cộng" : "Total"}
                    </span>
                    <span className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                      {currencyFormatter.format(booking.totalAmount)}
                    </span>
                  </div>
                </div>

                {getStatusKey(booking.status) === "pendingpayment" && booking.holdExpiresAt ? (
                  <div className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${
                    isBookingExpired
                      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                  }`}
                  >
                    {isBookingExpired ? (
                      <p>{lang === "VN" ? "Booking đã hết hạn" : "Booking has expired"}</p>
                    ) : (
                      <>
                        <p>
                          {lang === "VN" ? "Giữ chỗ đến" : "Held until"}: {formatDateTime(booking.holdExpiresAt)}
                        </p>
                        <p className="mt-1 font-headline text-base font-black tabular-nums">
                          {formatCountdown(holdRemainingMs)}
                        </p>
                        <p className="mt-1 text-[10px] font-medium opacity-80">
                          {lang === "VN"
                            ? "Thời gian giữ chỗ có thể ngắn hơn nếu gần giờ tàu chạy."
                            : "Hold time may be shorter when departure is near."}
                        </p>
                      </>
                    )}
                  </div>
                ) : null}

                {getStatusKey(booking.status) === "expired" && !booking.holdExpiresAt ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                    {lang === "VN" ? "Booking đã hết hạn" : "Booking has expired"}
                  </div>
                ) : null}

                {booking.bookingQrToken ? (
                  <div className="flex items-start gap-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                    <QrCodeBlock
                      value={booking.bookingQrToken}
                      label={lang === "VN" ? "QR booking" : "Booking QR"}
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-400">
                        {lang === "VN" ? "Mã QR booking" : "Booking QR code"}
                      </p>
                      <CopyableCode value={booking.bookingQrToken} />
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            {(booking.insuranceSelected === true || booking.insurance || booking.insuranceSelected === false) && (
              <CharterInsuranceInfo
                booking={booking}
                lang={lang}
                currencyFormatter={currencyFormatter}
                bookingType={INSURANCE_BOOKING_TYPES.SEAT}
              />
            )}

            {booking.payments.length > 0 && (
              <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
                <div className="border-b border-slate-100 px-5 py-3.5 dark:border-slate-700 sm:px-6">
                  <h3 className="font-headline text-sm font-black text-[#124757] dark:text-white">
                    {lang === "VN" ? "Lịch sử thanh toán" : "Payment history"}
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {booking.payments.map((payment) => {
                    const paymentExpired = Boolean(
                      payment.expiresAt && new Date(payment.expiresAt).getTime() <= nowTick,
                    );
                    const isPayable = getStatusKey(payment.paymentStatus) === "pending"
                      && payment.checkoutUrl
                      && !isBookingExpired
                      && !paymentExpired;
                    return (
                      <div key={payment.id} className="space-y-2 p-5 sm:px-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500">{payment.paymentCode}</span>
                          <StatusBadge status={payment.paymentStatus} lang={lang} />
                        </div>
                        <p className="text-xs font-medium text-slate-400">
                          {payment.paymentMethod || "PayOS"}
                          {payment.paidAt
                            ? ` · ${lang === "VN" ? "Thanh toán lúc" : "Paid at"} ${formatDateTime(payment.paidAt)}`
                            : ""}
                        </p>
                        {payment.expiresAt && getStatusKey(payment.paymentStatus) === "pending" && !payment.paidAt ? (
                          <p className={`text-xs font-bold ${paymentExpired ? "text-rose-500" : "text-amber-700 dark:text-amber-300"}`}>
                            {paymentExpired
                              ? (lang === "VN" ? "Link thanh toán đã hết hạn" : "Payment link expired")
                              : `${lang === "VN" ? "Hạn thanh toán" : "Pay by"}: ${formatDateTime(payment.expiresAt)}`}
                          </p>
                        ) : null}
                        {payment.refundAmount > 0 ? (
                          <p className="text-xs font-bold text-rose-500">
                            {lang === "VN" ? "Đã hoàn" : "Refunded"}: {currencyFormatter.format(payment.refundAmount)}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <span className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                            {currencyFormatter.format(payment.amount)}
                          </span>
                          {isPayable ? (
                            <a href={payment.checkoutUrl} target="_blank" rel="noreferrer" className={payosButtonClassName}>
                              <PayOSLogo variant="white" className="h-4 w-auto" />
                              {lang === "VN" ? "Thanh toán" : "Pay"}
                            </a>
                          ) : null}
                        </div>
                        {isPayable ? (
                          <p className="text-[11px] font-medium text-slate-400">
                            {lang === "VN"
                              ? "Thanh toán trên cổng PayOS."
                              : "Complete payment on PayOS."}
                          </p>
                        ) : null}
                        {!isPayable && getStatusKey(payment.paymentStatus) === "pending" && (isBookingExpired || paymentExpired) ? (
                          <p className="text-[11px] font-medium text-rose-500">
                            {lang === "VN"
                              ? "Booking/link đã hết hạn. Vui lòng đặt lại hoặc tạo thanh toán mới."
                              : "Booking/link expired. Please book again or create a new payment."}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
