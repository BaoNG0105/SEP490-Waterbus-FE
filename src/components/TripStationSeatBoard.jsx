import { useEffect, useMemo, useState } from "react";
import { SeatMapIcon, seatToneFromOccupancyRole } from "./SeatMapIcon";
import { BoatBowLabel } from "./ShipWheelIcon";
import { fetchTripDetail, fetchTripSeatMap } from "../services/tripService";
import { getApiErrorMessage } from "../utils/apiError";
import {
  SEAT_ROLE_STYLES,
  buildDeckLayout,
  buildSeatOccupancyAtStop,
  rowLetterToIndex,
  sortTripStops,
  summarizeOccupancy,
} from "../utils/tripStationSeatBoard";

const formatClock = (value) => {
  if (!value) return "--:--";
  const ms = Date.parse(String(value));
  if (Number.isNaN(ms)) {
    const m = String(value).match(/(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : "--:--";
  }
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Sơ đồ ghế theo bến — cùng kiểu thân tàu + SeatMapIcon như màn đặt vé / Seat Layout.
 * Vàng = xuống, xanh lá = lên, xanh dương = đi tiếp.
 */
export function TripStationSeatBoard({
  trip,
  passengers = [],
  lang = "VN",
  initialStationId = "",
}) {
  const [detail, setDetail] = useState(trip || null);
  const [seats, setSeats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedStopKey, setSelectedStopKey] = useState("");
  const [activeDeck, setActiveDeck] = useState(1);
  const [selectedSeatNumber, setSelectedSeatNumber] = useState("");

  const tripId = String(trip?.tripId || trip?.id || "").trim();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!tripId) {
        setIsLoading(false);
        setErrorMsg(lang === "VN" ? "Thiếu tripId." : "Missing tripId.");
        return;
      }
      try {
        setIsLoading(true);
        setErrorMsg("");
        const [tripDetail, seatMap] = await Promise.all([
          fetchTripDetail(tripId).catch(() => trip),
          fetchTripSeatMap(tripId).catch(() => null),
        ]);
        if (!alive) return;
        setDetail(tripDetail || trip);
        const seatRows = Array.isArray(seatMap?.seats)
          ? seatMap.seats
          : Array.isArray(seatMap)
            ? seatMap
            : [];
        setSeats(seatRows);
        if (!seatRows.length) {
          setErrorMsg(
            lang === "VN"
              ? "Chuyến chưa có sơ đồ ghế (GET /trips/{id}/seats)."
              : "No seat map for this trip (GET /trips/{id}/seats).",
          );
        }
      } catch (error) {
        if (!alive) return;
        setErrorMsg(
          getApiErrorMessage(
            error,
            lang === "VN" ? "Không tải được sơ đồ ghế." : "Unable to load seat map.",
          ),
        );
      } finally {
        if (alive) setIsLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [tripId, trip, lang]);

  const stops = useMemo(
    () => sortTripStops(detail?.stops || trip?.stops || []),
    [detail, trip],
  );

  useEffect(() => {
    if (!stops.length) {
      setSelectedStopKey("");
      return;
    }
    const preferred = initialStationId
      ? stops.find((s) => String(s.stationId) === String(initialStationId))
      : null;
    const first = preferred || stops[0];
    setSelectedStopKey(`${first.stopOrder || 0}:${first.stationId || first.stationCode || first.stationName}`);
  }, [stops, initialStationId]);

  const selectedStop = useMemo(() => {
    if (!selectedStopKey) return stops[0] || null;
    return stops.find(
      (s) => `${s.stopOrder || 0}:${s.stationId || s.stationCode || s.stationName}` === selectedStopKey,
    ) || stops[0] || null;
  }, [stops, selectedStopKey]);

  const occupiedSeats = useMemo(
    () => buildSeatOccupancyAtStop(seats, passengers, selectedStop, stops),
    [seats, passengers, selectedStop, stops],
  );

  const decks = useMemo(() => buildDeckLayout(occupiedSeats), [occupiedSeats]);

  useEffect(() => {
    if (!decks.length) return;
    if (!decks.some((d) => d.deckNumber === activeDeck)) {
      setActiveDeck(decks[0].deckNumber);
    }
  }, [decks, activeDeck]);

  const activeDeckData = decks.find((d) => d.deckNumber === activeDeck) || decks[0];
  const summary = useMemo(() => summarizeOccupancy(occupiedSeats), [occupiedSeats]);

  const seatByNumber = useMemo(() => {
    const map = new Map();
    occupiedSeats.forEach((seat) => {
      map.set(String(seat.seatNumber || "").toUpperCase(), seat);
    });
    return map;
  }, [occupiedSeats]);

  const selectedSeat = selectedSeatNumber
    ? seatByNumber.get(String(selectedSeatNumber).toUpperCase())
    : null;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400" />
      </div>
    );
  }

  if (errorMsg && !seats.length) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        {errorMsg}
      </div>
    );
  }

  if (!stops.length) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        {lang === "VN"
          ? "Chuyến chưa có danh sách bến dừng — không phân loại lên/xuống được."
          : "Trip has no stops — cannot classify boarding/alighting."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
        <label className="mb-1.5 block text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Bến đang xử lý" : "Current station"}
        </label>
        <select
          value={selectedStopKey}
          onChange={(e) => {
            setSelectedStopKey(e.target.value);
            setSelectedSeatNumber("");
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-[#124757] outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-600 dark:bg-slate-800 dark:text-yellow-400"
        >
          {stops.map((stop) => {
            const key = `${stop.stopOrder || 0}:${stop.stationId || stop.stationCode || stop.stationName}`;
            const clock = formatClock(stop.scheduledDeparture || stop.scheduledArrival);
            return (
              <option key={key} value={key}>
                #{stop.stopOrder || "?"} · {stop.stationName || stop.stationCode || "—"} · {clock}
              </option>
            );
          })}
        </select>
        <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-300">
          {lang === "VN"
            ? "Cùng sơ đồ ghế đặt vé. Vàng = xuống (ghế sắp trống). Xanh lá = lên mới. Xanh dương = đi tiếp — không cho xuống nhầm."
            : "Same seat map as booking. Amber = alight. Green = board. Sky = through — do not let them off."}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4 text-[11px] font-bold text-slate-500">
        {[
          ["empty", summary.empty],
          ["occupied", summary.occupied],
          ["alighting", summary.alighting],
          ["boarding", summary.boarding],
          ["through", summary.through],
        ].map(([role, count]) => {
          const style = SEAT_ROLE_STYLES[role];
          return (
            <div key={role} className="flex items-center gap-1.5">
              <span className="inline-block h-6 w-5">
                <SeatMapIcon
                  tone={seatToneFromOccupancyRole(role)}
                  disabled={role === "blocked"}
                  showLabel={false}
                />
              </span>
              {lang === "VN" ? style.labelVn : style.labelEn}: {count}
            </div>
          );
        })}
      </div>

      {decks.length > 1 ? (
        <div className="flex justify-center gap-2">
          {decks.map((deck) => (
            <button
              key={deck.deckNumber}
              type="button"
              onClick={() => setActiveDeck(deck.deckNumber)}
              className={`rounded-xl px-4 py-1.5 text-[10px] font-headline font-black uppercase tracking-widest transition ${
                activeDeck === deck.deckNumber
                  ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                  : "border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {lang === "VN" ? `Tầng ${deck.deckNumber}` : `Deck ${deck.deckNumber}`}
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900 md:p-6">
        {activeDeckData && activeDeckData.seats.length > 0 ? (
          <div className="mx-auto flex min-w-max flex-col items-center">
            <div
              className={`relative flex min-w-max flex-col items-center overflow-visible rounded-t-[12rem] rounded-b-[3rem] border-8 border-slate-300 bg-slate-100 px-8 pb-10 shadow-xl dark:border-slate-600 dark:bg-slate-900/80 md:px-14 ${
                activeDeckData.deckNumber === 1 ? "pt-14" : "pt-8"
              }`}
            >
              {activeDeckData.deckNumber === 1 ? (
                <div className="absolute left-1/2 top-3 -translate-x-1/2">
                  <BoatBowLabel lang={lang} />
                </div>
              ) : null}

              <div
                className="relative z-10 mx-auto grid gap-2 overflow-visible p-2 md:gap-2.5"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(activeDeckData.columnCount, 1)}, minmax(40px, 48px))`,
                  gridTemplateRows: `repeat(${Math.max(activeDeckData.rowCount, 1)}, minmax(44px, 52px))`,
                }}
              >
                {activeDeckData.seats.map((seat) => {
                  const role = seat.occupancyRole || "empty";
                  const selected = String(selectedSeatNumber).toUpperCase() === String(seat.seatNumber).toUpperCase();
                  const tone = seatToneFromOccupancyRole(role);
                  const isBlocked = role === "blocked";
                  const tip = [
                    seat.seatNumber,
                    ...(seat.alighting || []).map((p) => `↓ ${p.passengerName}`),
                    ...(seat.boarding || []).map((p) => `↑ ${p.passengerName}`),
                    ...(seat.through || []).map((p) => `→ ${p.passengerName}`),
                    ...(seat.occupiedPassengers || []).map((p) => `• ${p.passengerName}`),
                  ].filter(Boolean).join(" · ");

                  return (
                    <button
                      key={seat.seatNumber}
                      type="button"
                      title={tip}
                      onClick={() => setSelectedSeatNumber(seat.seatNumber)}
                      className={`group relative z-1 flex items-center justify-center rounded-lg transition-all ${
                        selected
                          ? "scale-95 rounded-xl ring-2 ring-[#124757]/40 dark:ring-yellow-400/50"
                          : "hover:scale-105"
                      }`}
                      style={{
                        gridRow: rowLetterToIndex(seat.row),
                        gridColumn: Number(seat.column) || 1,
                      }}
                    >
                      <SeatMapIcon
                        label={seat.seatNumber}
                        tone={tone}
                        disabled={isBlocked}
                        className="h-[92%] w-[92%]"
                      />
                    </button>
                  );
                })}
              </div>

              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center opacity-60">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                  {lang === "VN" ? "Đuôi tàu" : "Stern"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="py-10 text-center text-xs text-slate-400">
            {lang === "VN" ? "Không có ghế để hiển thị." : "No seats to display."}
          </p>
        )}
      </div>

      {selectedSeat ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="inline-block h-10 w-8">
                <SeatMapIcon
                  label={selectedSeat.seatNumber}
                  tone={seatToneFromOccupancyRole(selectedSeat.occupancyRole)}
                  disabled={selectedSeat.occupancyRole === "blocked"}
                />
              </span>
              <p className="font-headline text-base font-black text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Ghế" : "Seat"} {selectedSeat.seatNumber}
              </p>
            </div>
            <span className={`rounded-lg border px-2 py-1 text-[10px] font-headline font-black uppercase ${
              (SEAT_ROLE_STYLES[selectedSeat.occupancyRole] || SEAT_ROLE_STYLES.empty).cell
            }`}>
              {lang === "VN"
                ? (SEAT_ROLE_STYLES[selectedSeat.occupancyRole] || SEAT_ROLE_STYLES.empty).labelVn
                : (SEAT_ROLE_STYLES[selectedSeat.occupancyRole] || SEAT_ROLE_STYLES.empty).labelEn}
            </span>
          </div>

          {selectedSeat.alighting?.length ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-[10px] font-headline font-black uppercase tracking-wider text-amber-700 dark:text-amber-200">
                {lang === "VN" ? "Phải xuống tại bến này" : "Must alight here"}
              </p>
              {selectedSeat.alighting.map((p, i) => (
                <p key={`a-${i}`} className="mt-1 text-xs font-bold text-amber-900 dark:text-amber-100">
                  {p.passengerName} · {p.toStationName || "—"} · {p.ticketCode || p.bookingCode}
                </p>
              ))}
            </div>
          ) : null}

          {selectedSeat.boarding?.length ? (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-[10px] font-headline font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-200">
                {lang === "VN" ? "Khách mới lên ghế này" : "Boarding into this seat"}
              </p>
              {selectedSeat.boarding.map((p, i) => (
                <p key={`b-${i}`} className="mt-1 text-xs font-bold text-emerald-900 dark:text-emerald-100">
                  {p.passengerName} · {p.fromStationName || "—"} → {p.toStationName || "—"}
                </p>
              ))}
            </div>
          ) : null}

          {selectedSeat.through?.length ? (
            <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 dark:border-sky-500/30 dark:bg-sky-500/10">
              <p className="text-[10px] font-headline font-black uppercase tracking-wider text-sky-700 dark:text-sky-200">
                {lang === "VN" ? "Đi tiếp — chưa được xuống" : "Through — stay on board"}
              </p>
              {selectedSeat.through.map((p, i) => (
                <p key={`t-${i}`} className="mt-1 text-xs font-bold text-sky-900 dark:text-sky-100">
                  {p.passengerName} · {lang === "VN" ? "đích" : "to"} {p.toStationName || "—"}
                </p>
              ))}
            </div>
          ) : null}

          {selectedSeat.occupiedPassengers?.length ? (
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
              <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                {lang === "VN" ? "Khách trên ghế" : "Passenger on seat"}
              </p>
              {selectedSeat.occupiedPassengers.map((p, i) => (
                <p key={`o-${i}`} className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">
                  {p.passengerName} · {(p.fromStationName || "—")} → {(p.toStationName || "—")}
                </p>
              ))}
            </div>
          ) : null}

          {!selectedSeat.alighting?.length
            && !selectedSeat.boarding?.length
            && !selectedSeat.through?.length
            && !selectedSeat.occupiedPassengers?.length
            && selectedSeat.occupancyRole === "occupied" ? (
            <p className="text-xs font-bold text-slate-500">
              {lang === "VN"
                ? "Ghế đã đặt trên chuyến (status Booked)."
                : "Seat is booked on this trip."}
            </p>
          ) : null}

          {!selectedSeat.alighting?.length
            && !selectedSeat.boarding?.length
            && !selectedSeat.through?.length
            && !selectedSeat.occupiedPassengers?.length
            && selectedSeat.occupancyRole === "empty" ? (
            <p className="text-xs font-bold text-slate-500">
              {lang === "VN"
                ? "Ghế trống tại bến này — có thể nhận khách lên."
                : "Empty at this stop — available for boarding."}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-center text-[11px] font-medium text-slate-400">
          {lang === "VN" ? "Chọn một ghế để xem khách lên / xuống." : "Select a seat to see boarding / alighting."}
        </p>
      )}
    </div>
  );
}
