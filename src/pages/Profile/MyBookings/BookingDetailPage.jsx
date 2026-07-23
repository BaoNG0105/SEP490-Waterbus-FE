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
      // Clipboard API unavailable — silently ignore, code is still visible to copy manually.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Click to copy"
      className={`flex w-full items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left font-mono text-[11px] font-bold text-slate-600 transition hover:border-[#124757]/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${className}`}
    >
      <span className="min-w-0 flex-1 break-all">{value}</span>
      <span className="material-symbols-outlined shrink-0 text-sm">{copied ? "check" : "content_copy"}</span>
    </button>
  );
}

// Vé/booking dùng qrToken làm mã quét (staff scan sẽ decode lại đúng chuỗi này để tra cứu) —
// nên phải encode thành ảnh QR thật để quét được, không chỉ hiển thị dạng text.
function QrCodeBlock({ value, label, size = 88 }) {
  const [isEnlarged, setIsEnlarged] = useState(false);
  if (!value) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsEnlarged(true)}
        title={label}
        className="group inline-flex flex-col items-center gap-1.5"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition group-hover:border-[#124757]/40 dark:border-slate-700">
          <QRCodeSVG value={value} size={size} />
        </div>
        <span className="text-[9px] font-headline font-black uppercase tracking-wider text-slate-400 group-hover:text-[#124757] dark:group-hover:text-yellow-400">
          {label}
        </span>
      </button>

      {isEnlarged && (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={() => setIsEnlarged(false)}
        >
          <div
            className="max-w-xs rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-800"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">{label}</span>
              <button type="button" onClick={() => setIsEnlarged(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex justify-center">
              <QRCodeSVG value={value} size={240} />
            </div>
            <p className="mt-4 break-all text-center font-mono text-[11px] text-slate-500 dark:text-slate-400">{value}</p>
          </div>
        </div>
      )}
    </>
  );
}

const DetailSkeleton = () => (
  <div className="mx-auto max-w-4xl animate-pulse space-y-4">
    <div className="h-32 rounded-3xl bg-slate-200 dark:bg-slate-700" />
    <div className="h-48 rounded-3xl bg-slate-100 dark:bg-slate-800" />
    <div className="h-48 rounded-3xl bg-slate-100 dark:bg-slate-800" />
  </div>
);

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

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
    []
  );

  const loadDetail = useCallback(async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg("");
      setNotFound(false);
      const data = await fetchMyBookingDetail(id);
      setBooking(normalizeBookingDetail(data));
    } catch (error) {
      console.error(`Lỗi tải chi tiết booking ${id}:`, error);
      if (error?.response?.status === 404) {
        setNotFound(true);
      } else {
        setErrorMsg(error.response?.data?.message || (lang === "VN" ? "Không thể tải chi tiết booking." : "Unable to load this booking."));
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, isAuthenticated, lang, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadDetail();
  }, [loadDetail]);

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
      <main className="mx-auto max-w-6xl space-y-6">
        <button
          type="button"
          onClick={() => navigate(config.basePath)}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#124757] dark:text-slate-400 dark:hover:text-yellow-400"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          {lang === "VN" ? "Về danh sách vé" : "Back to bookings"}
        </button>

        {/* HEADER */}
        <section className="overflow-hidden rounded-4xl border border-slate-100 bg-linear-to-br from-[#124757] via-[#165a6d] to-[#0e3540] shadow-xl dark:border-slate-700/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          <div className="flex flex-col justify-between gap-4 px-6 py-8 text-white md:flex-row md:items-center md:px-8">
            <div>
              <h1 className="mt-1 font-headline text-2xl font-black md:text-3xl">{booking.bookingCode}</h1>
              <p className="mt-2 text-sm font-medium text-white/75">
                {lang === "VN" ? "Đặt lúc" : "Booked at"}: {formatDateTime(booking.bookedAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wide ${getStatusClasses(booking.status)}`}>
                {getStatusLabel(booking.status, lang)}
              </span>
              {booking.paymentStatus && (
                <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wide ${getStatusClasses(booking.paymentStatus)}`}>
                  {getStatusLabel(booking.paymentStatus, lang)}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* BỐ CỤC 2 CỘT: TRÁI = DANH SÁCH VÉ, PHẢI = CHI TIẾT BOOKING & LỊCH SỬ THANH TOÁN */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">

          {/* CỘT TRÁI (7/12): DANH SÁCH VÉ THEO TỪNG CHUYẾN */}
          <div className="space-y-6 lg:col-span-7">
            {groupedTrips.map((group) => (
              <section key={group.tripCode} className="overflow-hidden rounded-4xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-6 py-4 dark:border-slate-700 md:px-8">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase ${group.isReturn ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" : "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300"}`}>
                      {group.isReturn ? (lang === "VN" ? "Chiều về" : "Return") : (lang === "VN" ? "Chiều đi" : "Departure")}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    {group.items.length} {lang === "VN" ? "vé" : "ticket(s)"}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {group.items.map((item) => {
                    const isLoopTour = item.fromStationName && item.fromStationName === item.toStationName;
                    return (
                      <div key={item.id} className="p-6 md:p-8 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-headline font-black text-[#124757] dark:text-white flex items-center gap-2 text-base">
                            {isLoopTour ? (
                              <>
                                {lang === "VN" ? `Tour vòng quanh ${item.fromStationName}` : `Loop tour around ${item.fromStationName}`}
                              </>
                            ) : (
                              <>
                                {item.fromStationName}
                                <span className="material-symbols-outlined text-sm text-[#FFD100]">arrow_forward</span>
                                {item.toStationName}
                              </>
                            )}
                          </div>
                          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wide ${getStatusClasses(item.ticketStatus || item.itemStatus)}`}>
                            {getStatusLabel(item.ticketStatus || item.itemStatus, lang)}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                          <span>
                            {formatDateOnly(item.scheduledDeparture)} · {formatTime(item.scheduledDeparture)} → {formatDateOnly(item.scheduledArrival) !== formatDateOnly(item.scheduledDeparture) ? `${formatDateOnly(item.scheduledArrival)} ` : ""}{formatTime(item.scheduledArrival)}
                          </span>
                          <span>{lang === "VN" ? "Ghế" : "Seat"}: <span className="text-[#124757] dark:text-yellow-400">{item.seatNumber || "--"}</span></span>
                          <span>{item.ticketTypeName}</span>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                              {lang === "VN" ? "Hành khách" : "Passenger"}
                            </p>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                              {item.passengerName}{item.passengerPhone ? ` · ${item.passengerPhone}` : ""}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                              {lang === "VN" ? "Giá vé" : "Fare"}
                            </p>
                            <p className="text-sm font-bold text-[#124757] dark:text-yellow-400">
                              {currencyFormatter.format(item.unitPrice)}
                            </p>
                          </div>
                        </div>

                        {(item.ticketCode || item.ticketQrToken) && (
                          <div className="flex items-start gap-4 pt-1">
                            {item.ticketQrToken && (
                              <QrCodeBlock
                                value={item.ticketQrToken}
                                label={lang === "VN" ? "Mã QR vé" : "Ticket QR"}
                                size={72}
                              />
                            )}
                            {item.ticketCode && (
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <span className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                                  {lang === "VN" ? "Mã vé" : "Ticket code"}
                                </span>
                                <CopyableCode value={item.ticketCode} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* CỘT PHẢI (5/12): CHI TIẾT BOOKING & LỊCH SỬ THANH TOÁN */}
          <div className="space-y-6 lg:sticky lg:top-28 lg:col-span-5">

            {/* CHI TIẾT BOOKING */}
            <section className="overflow-hidden rounded-4xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
              <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-700 md:px-8">
                <h3 className="font-headline font-black text-[#124757] dark:text-white">
                  {lang === "VN" ? "Chi tiết booking" : "Booking details"}
                </h3>
              </div>
              <div className="space-y-4 p-6 md:p-8">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>{lang === "VN" ? "Tạm tính" : "Subtotal"}</span>
                    <span className="font-bold">{currencyFormatter.format(booking.subtotalAmount)}</span>
                  </div>
                  <div className={`flex justify-between ${booking.discountAmount > 0 ? "font-bold text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"}`}>
                    <span>{lang === "VN" ? "Giảm giá" : "Discount"}</span>
                    <span className="font-bold">{booking.discountAmount > 0 ? `-${currencyFormatter.format(booking.discountAmount)}` : currencyFormatter.format(0)}</span>
                  </div>
                  {Number(booking.insurance?.totalAmount) > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>{lang === "VN" ? "Bảo hiểm" : "Insurance"}</span>
                      <span className="font-bold">{currencyFormatter.format(booking.insurance.totalAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>{lang === "VN" ? "Mã ưu đãi" : "Promotion code"}</span>
                    <span className={booking.promotionCode ? "font-mono font-bold text-[#124757] dark:text-yellow-400" : "font-bold"}>
                      {booking.promotionCode || "--"}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>{lang === "VN" ? "Điểm đã dùng" : "Points used"}</span>
                    <span className="font-bold">{booking.pointsUsed > 0 ? `-${booking.pointsUsed}` : 0}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>{lang === "VN" ? "Điểm tích được" : "Points earned"}</span>
                    <span className="font-bold">{booking.pointsEarned > 0 ? `+${booking.pointsEarned}` : 0}</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
                    <span className="font-headline font-black text-[#124757] dark:text-white">{lang === "VN" ? "Tổng cộng" : "Total"}</span>
                    <span className="font-headline text-xl font-black text-[#124757] dark:text-yellow-400">{currencyFormatter.format(booking.totalAmount)}</span>
                  </div>
                </div>

                {getStatusKey(booking.status) === "pendingpayment" && booking.holdExpiresAt && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                    {lang === "VN" ? "Giữ chỗ đến" : "Held until"}: {formatDateTime(booking.holdExpiresAt)}
                  </div>
                )}

                {booking.bookingQrToken && (
                  <div className="flex items-start gap-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                    <QrCodeBlock
                      value={booking.bookingQrToken}
                      label={lang === "VN" ? "Mã QR booking" : "Booking QR"}
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                        {lang === "VN" ? "Mã QR booking" : "Booking QR code"}
                      </p>
                      <CopyableCode value={booking.bookingQrToken} />
                    </div>
                  </div>
                )}
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

            {/* LỊCH SỬ THANH TOÁN */}
            {booking.payments.length > 0 && (
              <section className="overflow-hidden rounded-4xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-700 md:px-8">
                  <h3 className="font-headline font-black text-[#124757] dark:text-white">
                    {lang === "VN" ? "Lịch sử thanh toán" : "Payment history"}
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {booking.payments.map((payment) => {
                    const isPayable = getStatusKey(payment.paymentStatus) === "pending"
                      && payment.checkoutUrl
                      && (!payment.expiresAt || new Date(payment.expiresAt).getTime() > Date.now());
                    return (
                      <div key={payment.id} className="p-6 md:px-8 space-y-4">
                        <div className="flex flex-col gap-3">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">{payment.paymentCode}</span>
                              <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wide ${getStatusClasses(payment.paymentStatus)}`}>
                                {getStatusLabel(payment.paymentStatus, lang)}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-400">
                              {payment.paymentMethod}
                              {payment.paidAt ? ` · ${lang === "VN" ? "Thanh toán lúc" : "Paid at"} ${formatDateTime(payment.paidAt)}` : ""}
                            </p>
                            {payment.refundAmount > 0 && (
                              <p className="text-xs font-bold text-rose-500">
                                {lang === "VN" ? "Đã hoàn" : "Refunded"}: {currencyFormatter.format(payment.refundAmount)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                              {currencyFormatter.format(payment.amount)}
                            </span>
                            {isPayable && (
                              <a
                                href={payment.checkoutUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={payosButtonClassName}
                              >
                                <PayOSLogo variant="white" className="h-4 w-auto" />
                                {lang === "VN" ? "Thanh toán" : "Pay"}
                              </a>
                            )}
                          </div>
                        </div>

                        {isPayable && payment.qrCode && (
                          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center dark:border-slate-700 dark:bg-slate-900/50">
                            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700">
                              <QRCodeSVG value={payment.qrCode} size={128} />
                            </div>
                            <div>
                              <p className="text-xs font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                                {lang === "VN" ? "Quét mã VietQR để thanh toán" : "Scan the VietQR code to pay"}
                              </p>
                              <p className="mt-1 text-[11px] font-medium text-slate-400">
                                {lang === "VN"
                                  ? "Mở app ngân hàng hoặc ví điện tử hỗ trợ VietQR và quét mã, hoặc bấm nút Thanh toán để mở PayOS."
                                  : "Open your banking app or e-wallet that supports VietQR and scan, or tap Pay to open PayOS."}
                              </p>
                            </div>
                          </div>
                        )}
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
