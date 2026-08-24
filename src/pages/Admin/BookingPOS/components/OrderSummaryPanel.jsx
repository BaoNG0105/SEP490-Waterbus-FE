const formatTripTime = (isoString) => {
  if (!isoString) return "--";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const getSegmentDeparture = (trip) => trip?.fromStopScheduledDeparture || trip?.departureTime;
const getSegmentArrival = (trip) => trip?.toStopScheduledArrival || trip?.arrivalTime;


export function OrderSummaryPanel({ lang, bookingData, activeLeg }) {
  const {
    isRoundTrip,
    fromWharfName,
    toWharfName,
    routeType,
    selectedDepartureTrip,
    selectedReturnTrip,
    selectedSeatsDeparture = [],
    selectedSeatsReturn = [],
  } = bookingData || {};

  const isLoopRoute = routeType === "SightseeingLoop";

  const roundTripSeatCountMismatch = isRoundTrip
    && selectedSeatsDeparture.length > 0
    && selectedSeatsReturn.length > 0
    && selectedSeatsDeparture.length !== selectedSeatsReturn.length;

  const legs = [
    { key: "departure", label: lang === "VN" ? "Chiều đi" : "Departure", trip: selectedDepartureTrip, seats: selectedSeatsDeparture },
    ...(isRoundTrip ? [{ key: "return", label: lang === "VN" ? "Chiều về" : "Return", trip: selectedReturnTrip, seats: selectedSeatsReturn }] : []),
  ];

  const totalSubtotal = selectedSeatsDeparture.reduce((sum, s) => sum + Number(s.effectivePrice || s.basePrice || 0), 0)
    + (isRoundTrip ? selectedSeatsReturn.reduce((sum, s) => sum + Number(s.effectivePrice || s.basePrice || 0), 0) : 0);

  return (
    <div className="sticky top-28 space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-xl dark:border-slate-700/50 dark:bg-slate-800 md:p-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-700">
        <div>
          <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
            {lang === "VN" ? "Tóm tắt đơn" : "Order summary"}
          </p>
          <h3 className="mt-0.5 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
            {isLoopRoute ? (lang === "VN" ? "Tour tham quan" : "Sightseeing tour") : (lang === "VN" ? "Vé Waterbus" : "Waterbus ticket")}
          </h3>
        </div>
      </div>

      {fromWharfName || toWharfName ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-slate-500 dark:text-slate-300">
          {isLoopRoute ? (
            <span className="uppercase text-[#124757] dark:text-yellow-400">{fromWharfName || "--"}</span>
          ) : (
            <>
              <span className="uppercase text-[#124757] dark:text-yellow-400">{fromWharfName || "--"}</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
              <span className="uppercase text-[#124757] dark:text-yellow-400">{toWharfName || "--"}</span>
            </>
          )}
          {isRoundTrip ? (
            <span className=" px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {lang === "VN" ? "Khứ hồi" : "Round trip"}
            </span>
          ) : null}
        </div>
      ) : (
        <p className="text-xs font-semibold text-slate-400">
          {lang === "VN" ? "Chưa tìm chuyến. Bắt đầu ở bước 1." : "No search yet. Start at step 1."}
        </p>
      )}

      {legs.map((leg) => (
        <div
          key={leg.key}
          className={`rounded-2xl border p-4 ${activeLeg === leg.key ? "border-[#124757]/30 bg-[#124757]/5 dark:border-yellow-400/30 dark:bg-yellow-400/5" : "border-slate-100 dark:border-slate-700"}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{leg.label}</span>
            {leg.trip ? <span className="material-symbols-outlined text-base text-emerald-500">check_circle</span> : null}
          </div>
          {leg.trip ? (
            <>
              <p className="mt-1 font-headline text-base font-black tabular-nums text-[#124757] dark:text-white">
                {formatTripTime(getSegmentDeparture(leg.trip))} <span className="text-slate-300">→</span> {formatTripTime(getSegmentArrival(leg.trip))}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {leg.seats.length === 0 ? (
                  <span className="text-[11px] font-semibold text-rose-500">{lang === "VN" ? "Chưa chọn ghế" : "No seats yet"}</span>
                ) : leg.seats.map((seat) => (
                  <span key={seat.seatNumber} className="rounded-md bg-[#124757] px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-yellow-400 dark:text-slate-900">
                    {seat.seatNumber}
                  </span>
                ))}
              </div>
              {leg.seats.length > 0 ? (
                <p className="mt-2 text-right text-sm font-headline font-black text-[#124757] dark:text-yellow-400">
                  {leg.seats.reduce((sum, s) => sum + Number(s.effectivePrice || s.basePrice || 0), 0).toLocaleString()}đ
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-[11px] font-semibold text-slate-400">{lang === "VN" ? "Chưa chọn chuyến" : "No trip selected"}</p>
          )}
        </div>
      ))}

      {roundTripSeatCountMismatch && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {lang === "VN"
            ? `Số ghế chiều đi (${selectedSeatsDeparture.length}) và chiều về (${selectedSeatsReturn.length}) phải bằng nhau.`
            : `Departure seat count (${selectedSeatsDeparture.length}) and return seat count (${selectedSeatsReturn.length}) must match.`}
        </p>
      )}

      <div className="flex items-center justify-between rounded-xl border border-[#FFD100]/30 bg-[#FFD100]/10 px-3 py-2.5 dark:border-yellow-400/20 dark:bg-yellow-400/10">
        <span className="text-[11px] font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-300">
          {lang === "VN" ? "Tổng số ghế" : "Total seats"}
        </span>
        <span className="text-base font-headline font-black text-[#124757] dark:text-yellow-300">
          {selectedSeatsDeparture.length + (isRoundTrip ? selectedSeatsReturn.length : 0)}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-3 dark:border-slate-600">
        <span className="text-[11px] font-medium text-slate-400">{lang === "VN" ? "Tạm tính" : "Subtotal"}</span>
        <span className="font-headline text-xl font-black text-[#124757] dark:text-yellow-400">
          {totalSubtotal.toLocaleString()}đ
        </span>
      </div>
    </div>
  );
}
