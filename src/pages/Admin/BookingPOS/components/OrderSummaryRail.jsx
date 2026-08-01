import { useEffect, useState } from "react";

const formatTripTime = (isoString) => {
  if (!isoString) return "--:--";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const getSegmentDeparture = (trip) => trip?.fromStopScheduledDeparture || trip?.departureTime;
const getSegmentArrival = (trip) => trip?.toStopScheduledArrival || trip?.arrivalTime;

const formatDateLabel = (raw, lang) => {
  const m = String(raw || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw || "--";
  return lang === "VN" ? `${m[3]}/${m[2]}/${m[1]}` : `${m[2]}/${m[3]}/${m[1]}`;
};

const msUntil = (expiresAt) => {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Number.isFinite(ms) ? ms : null;
};

const formatCountdown = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

function LegChip({ label, trip, seats, lang }) {
  if (!trip) return null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 dark:border-slate-700/60 dark:bg-slate-900/40">
      <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-xs font-headline font-black tabular-nums text-[#124757] dark:text-yellow-400">
        {formatTripTime(getSegmentDeparture(trip))} <span className="text-slate-300">→</span>{" "}
        {formatTripTime(getSegmentArrival(trip))}
      </span>
      {seats.length === 0 ? (
        <span className="text-[11px] font-semibold text-rose-500">
          {lang === "VN" ? "chưa chọn ghế" : "no seats"}
        </span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {seats.map((seat) => (
            <span
              key={seat.seatNumber}
              className="inline-flex items-center rounded-md bg-[#124757] px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-yellow-400 dark:text-slate-900"
            >
              {seat.seatNumber}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Thanh "đơn hàng hiện tại" ngang, gọn — chỉ phản ánh lại state đã có trong bookingData, không gọi API riêng.
 *  Đặt full-width phía trên nội dung bước (không chia cột) để không bóp hẹp khung chọn chuyến/ghế bên trong. */
export function OrderSummaryRail({ lang, service, bookingData, currentStep, onNewSale }) {
  const {
    isRoundTrip,
    fromWharfName,
    toWharfName,
    routeType,
    departureDate,
    selectedDepartureTrip,
    selectedReturnTrip,
    selectedSeatsDeparture = [],
    selectedSeatsReturn = [],
    seatHoldExpiresAt,
  } = bookingData || {};

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!seatHoldExpiresAt) return undefined;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [seatHoldExpiresAt]);

  const isLoop = routeType === "SightseeingLoop";
  const hasSelection = Boolean(fromWharfName || toWharfName || selectedDepartureTrip);
  const totalSeats = selectedSeatsDeparture.length + (isRoundTrip ? selectedSeatsReturn.length : 0);
  const holdMs = msUntil(seatHoldExpiresAt);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#124757] text-xs font-headline font-black text-white dark:bg-yellow-400 dark:text-slate-900">
          {currentStep}
        </span>
        <div className="leading-tight">
          <p className="text-[9px] font-headline font-black uppercase tracking-widest text-slate-400">
            {lang === "VN" ? "Đơn hiện tại" : "Current order"}
          </p>
          <p className="text-xs font-headline font-black text-[#124757] dark:text-yellow-400">
            {service === "waterbus"
              ? lang === "VN"
                ? "Vé Waterbus"
                : "Waterbus ticket"
              : lang === "VN"
                ? "Vé tham quan"
                : "Sightseeing ticket"}
          </p>
        </div>
      </div>

      {!hasSelection ? (
        <span className="text-xs font-bold text-slate-400">
          {lang === "VN" ? "Chưa có lựa chọn nào." : "Nothing selected yet."}
        </span>
      ) : (
        <>
          <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-slate-500 dark:text-slate-300">
            {isLoop ? (
              <span className="uppercase text-[#124757] dark:text-yellow-400">{fromWharfName || "--"}</span>
            ) : (
              <>
                <span className="uppercase text-[#124757] dark:text-yellow-400">{fromWharfName || "--"}</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                <span className="uppercase text-[#124757] dark:text-yellow-400">{toWharfName || "--"}</span>
              </>
            )}
            <span className="text-slate-300">·</span>
            <span>{formatDateLabel(departureDate, lang)}</span>
            {isRoundTrip ? (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                {lang === "VN" ? "Khứ hồi" : "Round trip"}
              </span>
            ) : null}
          </div>

          <LegChip
            label={lang === "VN" ? "Đi" : "Dep"}
            trip={selectedDepartureTrip}
            seats={selectedSeatsDeparture}
            lang={lang}
          />
          {isRoundTrip ? (
            <LegChip
              label={lang === "VN" ? "Về" : "Ret"}
              trip={selectedReturnTrip}
              seats={selectedSeatsReturn}
              lang={lang}
            />
          ) : null}

          <div className="flex items-center gap-1.5 rounded-xl border border-[#FFD100]/30 bg-[#FFD100]/10 px-2.5 py-1 dark:border-yellow-400/20 dark:bg-yellow-400/10">
            <span className="text-[10px] font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-300">
              {lang === "VN" ? "Ghế" : "Seats"}
            </span>
            <span className="text-xs font-headline font-black text-[#124757] dark:text-yellow-300">{totalSeats}</span>
          </div>

          {holdMs != null ? (
            <span
              className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${
                holdMs > 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              }`}
            >
              {holdMs > 0
                ? lang === "VN"
                  ? `Giữ ghế ${formatCountdown(holdMs)}`
                  : `Hold ${formatCountdown(holdMs)}`
                : lang === "VN"
                  ? "Hết hạn giữ ghế"
                  : "Hold expired"}
            </span>
          ) : null}
        </>
      )}

      <button
        type="button"
        onClick={onNewSale}
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-rose-300"
      >
        <span className="material-symbols-outlined text-sm">refresh</span>
        {lang === "VN" ? "Đơn mới" : "New sale"}
      </button>
    </div>
  );
}
