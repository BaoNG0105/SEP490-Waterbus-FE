import { useEffect, useMemo, useRef, useState } from "react";
import { SeatMapIcon, seatToneFromOccupancyRole } from "./SeatMapIcon";
import { BoatBowLabel } from "./ShipWheelIcon";
import { fetchTripDetail, fetchTripSeatMap } from "../services/tripService";
import { formatTicketTypeLabel } from "../services/ticketTypeService";
import { getApiErrorMessage } from "../utils/apiError";
import { formatTripClock } from "../utils/tripClock";
import {
  SEAT_ROLE_STYLES,
  buildDeckLayout,
  buildSeatOccupancyAtStop,
  normalizeSeatKeys,
  resolveLiveTripStop,
  rowLetterToIndex,
  sortTripStops,
  summarizeOccupancy,
} from "../utils/tripStationSeatBoard";

const stopKeyOf = (stop) =>
  `${stop?.stopOrder || 0}:${stop?.stationId || stop?.stationCode || stop?.stationName}`;

const findSharedSeatCompanions = (holder, allPassengers = []) => {
  if (!holder || holder.isLapInfant) return [];
  const name = String(holder.passengerName || "").trim().toLowerCase();
  const booking = String(holder.bookingCode || "").trim().toUpperCase();
  const ticket = String(holder.ticketCode || "").trim().toUpperCase();
  return (Array.isArray(allPassengers) ? allPassengers : []).filter((row) => {
    if (!row?.isLapInfant) return false;
    const companion = String(row.companionPassengerName || "").trim().toLowerCase();
    if (companion && name && companion === name) return true;
    const infantBooking = String(row.bookingCode || "").trim().toUpperCase();
    if (booking && infantBooking && booking !== "—" && booking === infantBooking) return true;
    const infantTicket = String(row.ticketCode || "").trim().toUpperCase();
    if (ticket && infantTicket && ticket === infantTicket) return true;
    return false;
  });
};

/** Danh sách theo vai trò: người lớn + lapInfants[]; count = tổng hành khách (gồm trẻ em cùng ghế). */
const collectActionPeople = (occupiedSeats, allPassengers = []) => {
  const alighting = [];
  const boarding = [];
  const through = [];
  let alightingCount = 0;
  let boardingCount = 0;
  let throughCount = 0;

  const pushGroup = (target, holders, seatNumber, bump) => {
    (holders || []).forEach((person) => {
      const lapInfants = findSharedSeatCompanions(person, allPassengers).map((child) => ({
        ...child,
        seatNumber,
        sharesSeat: true,
        companionPassengerName: child.companionPassengerName || person.passengerName,
      }));
      target.push({ ...person, seatNumber, sharesSeat: false, lapInfants });
      bump(1 + lapInfants.length);
    });
  };

  (Array.isArray(occupiedSeats) ? occupiedSeats : []).forEach((seat) => {
    const seatNumber = seat.seatNumber || "—";
    pushGroup(alighting, seat.alighting, seatNumber, (n) => { alightingCount += n; });
    pushGroup(boarding, seat.boarding, seatNumber, (n) => { boardingCount += n; });
    pushGroup(through, seat.through, seatNumber, (n) => { throughCount += n; });
  });

  return {
    alighting,
    boarding,
    through,
    counts: {
      alighting: alightingCount,
      boarding: boardingCount,
      through: throughCount,
    },
  };
};

const ticketTypeTone = (code) => {
  const key = String(code || "").toUpperCase();
  if (key === "SENIOR") {
    return "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-100";
  }
  if (key === "DISABLED") {
    return "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-100";
  }
  if (key === "CHILD") {
    return "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/20 dark:text-sky-100";
  }
  if (key === "INFANT") {
    return "border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-500/40 dark:bg-violet-500/20 dark:text-violet-100";
  }
  return "border-slate-200 bg-white/80 text-slate-600 dark:border-slate-600 dark:bg-slate-950/40 dark:text-slate-200";
};

const PassengerTypeBadge = ({ person, lang = "VN" }) => {
  const code = String(person?.ticketTypeCode || person?.ticketTypeName || "").trim();
  const label = formatTicketTypeLabel(code, lang);
  if (!label || label === "—") return null;
  return (
    <span className={`mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-headline font-black uppercase tracking-wide ${ticketTypeTone(code)}`}>
      {label}
    </span>
  );
};

const sharedSeatLabel = (person, lang = "VN") => {
  const type = String(person?.ticketTypeCode || "").toUpperCase();
  if (lang === "VN") {
    if (type === "INFANT") return "Em bé · cùng ghế / QR người lớn";
    if (type === "CHILD") return "Trẻ em · cùng ghế (legacy)";
    return "Cùng ghế";
  }
  if (type === "INFANT") return "Infant · shared seat / adult QR";
  if (type === "CHILD") return "Child · shared seat (legacy)";
  return "Shared seat";
};

const SharedSeatCompanionCard = ({ infant, lang = "VN" }) => (
  <div className="mt-1.5 rounded-lg border border-violet-200 bg-violet-50/90 px-2.5 py-1.5 dark:border-violet-500/30 dark:bg-violet-500/10">
    <p className="text-[9px] font-headline font-black uppercase tracking-wider text-violet-700 dark:text-violet-200">
      {sharedSeatLabel(infant, lang)}
    </p>
    <p className="mt-0.5 text-[11px] font-black text-violet-950 dark:text-violet-100">
      {infant.passengerName}
    </p>
  </div>
);

const PersonRow = ({ person, accent, onSeatClick, lang = "VN", lapInfants = [] }) => {
  const companions = lapInfants.length
    ? lapInfants
    : (Array.isArray(person.lapInfants) ? person.lapInfants : []);

  return (
    <button
      type="button"
      onClick={() => onSeatClick?.(person.seatNumber)}
      className={`flex w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition hover:brightness-[0.98] ${accent}`}
    >
      <span className="mt-0.5 inline-flex min-w-10 items-center justify-center rounded-lg bg-white/70 px-1.5 py-0.5 text-[10px] font-headline font-black text-slate-700 dark:bg-slate-950/40 dark:text-slate-100">
        {person.seatNumber}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-black">{person.passengerName || "—"}</span>
        <PassengerTypeBadge person={person} lang={lang} />
        <span className="mt-0.5 block truncate text-[10px] font-medium opacity-80">
          {(person.fromStationName || "—")} → {(person.toStationName || "—")}
        </span>
        {companions.map((infant, infantIndex) => (
          <SharedSeatCompanionCard
            key={`lap-${infant.passengerName}-${infantIndex}`}
            infant={infant}
            lang={lang}
          />
        ))}
      </span>
    </button>
  );
};

/**
 * Sơ đồ ghế theo bến — ops board: KPI + timeline bến + map + danh sách hành động.
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
  const [focusRole, setFocusRole] = useState("all");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [isManualBrowse, setIsManualBrowse] = useState(false);
  /** User bấm bến tay → xem tạm; khi tàu tới bến mới vẫn auto nhảy. */
  const userPickedStopRef = useRef(false);
  const lastLiveStopKeyRef = useRef("");

  const tripId = String(trip?.tripId || trip?.id || "").trim();

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async ({ silent = false } = {}) => {
      if (!tripId) {
        if (!silent) {
          setIsLoading(false);
          setErrorMsg(lang === "VN" ? "Thiếu tripId." : "Missing tripId.");
        }
        return;
      }
      try {
        if (!silent) {
          setIsLoading(true);
          setErrorMsg("");
        }
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
        if (!silent && !seatRows.length) {
          setErrorMsg(
            lang === "VN"
              ? "Chuyến chưa có sơ đồ ghế (GET /trips/{id}/seats)."
              : "No seat map for this trip (GET /trips/{id}/seats).",
          );
        }
      } catch (error) {
        if (!alive || silent) return;
        setErrorMsg(
          getApiErrorMessage(
            error,
            lang === "VN" ? "Không tải được sơ đồ ghế." : "Unable to load seat map.",
          ),
        );
      } finally {
        if (alive && !silent) setIsLoading(false);
      }
    };
    load();
    // Poll nhẹ để bắt actualArrival khi tàu cập bến.
    const poll = window.setInterval(() => load({ silent: true }), 20_000);
    return () => {
      alive = false;
      window.clearInterval(poll);
    };
  }, [tripId, trip, lang]);

  const stops = useMemo(
    () => sortTripStops(detail?.stops || trip?.stops || []),
    [detail, trip],
  );

  const followLiveStop = (stop, { clearSeat = true } = {}) => {
    if (!stop) return;
    const nextKey = stopKeyOf(stop);
    lastLiveStopKeyRef.current = nextKey;
    if (nextKey === selectedStopKey) return;
    setSelectedStopKey(nextKey);
    if (clearSeat) {
      setSelectedSeatNumber("");
      setFocusRole("all");
    }
  };

  useEffect(() => {
    if (!stops.length) {
      setSelectedStopKey("");
      lastLiveStopKeyRef.current = "";
      return;
    }

    const live = resolveLiveTripStop(stops, detail || trip, nowTick);
    const liveKey = live ? stopKeyOf(live) : "";
    const liveAdvanced = Boolean(liveKey) && liveKey !== lastLiveStopKeyRef.current;

    // Tàu tới bến mới → luôn nhảy (kể cả đang xem tay).
    if (liveAdvanced) {
      userPickedStopRef.current = false;
      setIsManualBrowse(false);
      followLiveStop(live);
      return;
    }

    if (userPickedStopRef.current) {
      const stillExists = stops.some((s) => stopKeyOf(s) === selectedStopKey);
      if (stillExists) return;
      userPickedStopRef.current = false;
      setIsManualBrowse(false);
    }

    if (!selectedStopKey && initialStationId) {
      const preferred = stops.find((s) => String(s.stationId) === String(initialStationId));
      if (preferred) {
        followLiveStop(preferred);
        return;
      }
    }

    if (!userPickedStopRef.current) {
      followLiveStop(live || stops[0]);
    }
  }, [stops, initialStationId, detail, trip, nowTick, selectedStopKey]);

  const selectedStop = useMemo(() => {
    if (!selectedStopKey) return stops[0] || null;
    return stops.find((s) => stopKeyOf(s) === selectedStopKey) || stops[0] || null;
  }, [stops, selectedStopKey]);

  const selectedStopIndex = useMemo(() => {
    if (!selectedStop) return -1;
    return stops.findIndex((s) => stopKeyOf(s) === stopKeyOf(selectedStop));
  }, [stops, selectedStop]);

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
  const actionPeople = useMemo(
    () => collectActionPeople(occupiedSeats, passengers),
    [occupiedSeats, passengers],
  );

  const freeSeats = summary.empty;

  const seatByNumber = useMemo(() => {
    const map = new Map();
    occupiedSeats.forEach((seat) => {
      normalizeSeatKeys(seat.seatNumber).forEach((key) => {
        if (!map.has(key)) map.set(key, seat);
      });
    });
    return map;
  }, [occupiedSeats]);

  const resolveSeat = (seatNumber) => {
    for (const key of normalizeSeatKeys(seatNumber)) {
      const found = seatByNumber.get(key);
      if (found) return found;
    }
    return null;
  };

  const selectedSeat = selectedSeatNumber ? resolveSeat(selectedSeatNumber) : null;

  const lapInfantsForPassenger = (passenger) => {
    if (!passenger || passenger.isLapInfant) return [];
    const name = String(passenger.passengerName || "").trim().toLowerCase();
    const booking = String(passenger.bookingCode || "").trim().toUpperCase();
    const ticket = String(passenger.ticketCode || "").trim().toUpperCase();
    return passengers.filter((row) => {
      if (!row?.isLapInfant) return false;
      const companion = String(row.companionPassengerName || "").trim().toLowerCase();
      if (companion && name && companion === name) return true;
      const infantBooking = String(row.bookingCode || "").trim().toUpperCase();
      if (booking && infantBooking && booking !== "—" && booking === infantBooking) return true;
      const infantTicket = String(row.ticketCode || "").trim().toUpperCase();
      if (ticket && infantTicket && ticket === infantTicket) return true;
      return false;
    });
  };

  const selectSeat = (seatNumber, { keepFocus = false } = {}) => {
    const trimmed = String(seatNumber || "").trim();
    if (!trimmed || trimmed === "—" || trimmed === "-") return;
    if (!keepFocus) setFocusRole("all");
    setSelectedSeatNumber(trimmed);
  };

  // Cuộn panel chi tiết sau khi React đã render (lần chọn đầu tiên).
  useEffect(() => {
    if (!selectedSeatNumber || !selectedSeat) return;
    const timer = window.setTimeout(() => {
      document.getElementById("trip-seat-detail-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [selectedSeatNumber, selectedSeat]);

  const selectStop = (stop) => {
    userPickedStopRef.current = true;
    setIsManualBrowse(true);
    setSelectedStopKey(stopKeyOf(stop));
    setSelectedSeatNumber("");
    setFocusRole("all");
  };

  const resumeLiveFollow = () => {
    userPickedStopRef.current = false;
    setIsManualBrowse(false);
    const live = resolveLiveTripStop(stops, detail || trip, Date.now());
    followLiveStop(live || stops[0]);
  };

  const handleFocusRole = (role) => {
    const next = focusRole === role ? "all" : role;
    setFocusRole(next);
    if (next === "alighting" && actionPeople.alighting[0]?.seatNumber) {
      selectSeat(actionPeople.alighting[0].seatNumber, { keepFocus: true });
    } else if (next === "boarding" && actionPeople.boarding[0]?.seatNumber) {
      selectSeat(actionPeople.boarding[0].seatNumber, { keepFocus: true });
    } else if (next === "through" && actionPeople.through[0]?.seatNumber) {
      selectSeat(actionPeople.through[0].seatNumber, { keepFocus: true });
    }
  };

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

  const focusList = focusRole === "alighting"
    ? actionPeople.alighting
    : focusRole === "boarding"
      ? actionPeople.boarding
      : focusRole === "through"
        ? actionPeople.through
        : null;

  return (
    <div className="space-y-3">
      {/* Timeline bến — dàn đều hai bên, không nút trước/sau */}
      <section className="rounded-3xl border border-slate-100 bg-gradient-to-br from-[#F4FAFB] via-white to-slate-50 p-3 dark:border-slate-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 sm:p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
              {selectedStop?.stationName || selectedStop?.stationCode || "—"}
            </h3>
            <p className="text-xs font-bold text-slate-500">
              {formatTripClock(selectedStop?.scheduledDeparture || selectedStop?.scheduledArrival)}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-400">
              {isManualBrowse
                ? (lang === "VN" ? "Đang xem tay — tới bến mới sẽ tự nhảy lại." : "Manual view — auto-jumps on next arrival.")
                : (lang === "VN" ? "Tự theo bến tàu đang tới / đang cập." : "Following the live stop.")}
            </p>
          </div>
          {isManualBrowse ? (
            <button
              type="button"
              onClick={resumeLiveFollow}
              className="shrink-0 rounded-xl border border-[#124757]/20 bg-white px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:border-yellow-400/30 dark:bg-slate-900 dark:text-yellow-400"
            >
              {lang === "VN" ? "Theo tàu" : "Follow boat"}
            </button>
          ) : null}
        </div>

        <div className="flex w-full gap-1.5 sm:gap-2">
          {stops.map((stop, index) => {
            const key = stopKeyOf(stop);
            const active = key === selectedStopKey;
            const done = selectedStopIndex >= 0 && index < selectedStopIndex;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectStop(stop)}
                className={`min-w-0 flex-1 rounded-2xl border px-1.5 py-2 text-center transition sm:px-2.5 sm:text-left ${
                  active
                    ? "border-[#124757] bg-[#124757] text-white shadow-md dark:border-yellow-400 dark:bg-yellow-400 dark:text-slate-900"
                    : done
                      ? "border-slate-200 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400"
                      : "border-slate-200 bg-white/80 text-slate-700 hover:border-[#124757]/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                <p className="truncate text-[10px] font-black sm:text-xs">
                  {stop.stationName || stop.stationCode || "—"}
                </p>
                <p className={`mt-0.5 text-[9px] font-bold sm:text-[10px] ${active ? "opacity-80" : "text-slate-400"}`}>
                  {formatTripClock(stop.scheduledDeparture || stop.scheduledArrival)}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Lọc nhanh — không lặp panel tình hình */}
      <section className="flex flex-wrap items-center gap-1.5">
        {[
          {
            key: "alighting",
            label: lang === "VN" ? "Xuống" : "Alight",
            value: actionPeople.counts.alighting,
            activeClass: "bg-amber-100 text-amber-900 ring-amber-400/50 dark:bg-amber-500/20 dark:text-amber-100",
          },
          {
            key: "boarding",
            label: lang === "VN" ? "Lên" : "Board",
            value: actionPeople.counts.boarding,
            activeClass: "bg-emerald-100 text-emerald-900 ring-emerald-400/50 dark:bg-emerald-500/20 dark:text-emerald-100",
          },
          {
            key: "through",
            label: lang === "VN" ? "Đi tiếp" : "Through",
            value: actionPeople.counts.through,
            activeClass: "bg-sky-100 text-sky-900 ring-sky-400/50 dark:bg-sky-500/20 dark:text-sky-100",
          },
        ].map((item) => {
          const active = focusRole === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleFocusRole(item.key)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-headline font-black transition ${
                active
                  ? `ring-2 ${item.activeClass}`
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <span>{item.label}</span>
              <span className="tabular-nums">{item.value}</span>
            </button>
          );
        })}
        <span className="ml-auto text-[11px] font-bold text-slate-400">
          {freeSeats} {lang === "VN" ? "trống" : "free"}
        </span>
        {focusRole !== "all" ? (
          <button
            type="button"
            onClick={() => setFocusRole("all")}
            className="text-[11px] font-bold text-[#124757] dark:text-yellow-400"
          >
            {lang === "VN" ? "Bỏ lọc" : "Clear"}
          </button>
        ) : null}
      </section>

      {decks.length > 1 ? (
        <div className="flex flex-wrap gap-2">
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

      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        {/* Map */}
        <div className="min-w-0 flex-1 overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900 md:p-4">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500">
            {[
              ["alighting", lang === "VN" ? "Xuống" : "Alight"],
              ["boarding", lang === "VN" ? "Lên" : "Board"],
              ["through", lang === "VN" ? "Đi tiếp" : "Through"],
              ["empty", lang === "VN" ? "Trống" : "Free"],
            ].map(([role, label]) => (
              <span key={role} className="inline-flex items-center gap-1">
                <span className="inline-block h-4 w-3.5">
                  <SeatMapIcon tone={seatToneFromOccupancyRole(role)} showLabel={false} />
                </span>
                {label}
              </span>
            ))}
          </div>

          {activeDeckData && activeDeckData.seats.length > 0 ? (
            <div className="mx-auto flex min-w-max flex-col items-center">
              <div
                className={`relative flex min-w-max flex-col items-center overflow-visible rounded-t-[9rem] rounded-b-[2.25rem] border-[6px] border-slate-300 bg-slate-100 px-5 pb-7 shadow-lg dark:border-slate-600 dark:bg-slate-900/80 md:px-8 ${
                  activeDeckData.deckNumber === 1 ? "pt-11" : "pt-6"
                }`}
              >
                {activeDeckData.deckNumber === 1 ? (
                  <div className="absolute left-1/2 top-2 -translate-x-1/2 scale-90">
                    <BoatBowLabel lang={lang} />
                  </div>
                ) : null}

                <div
                  className="relative z-10 mx-auto grid gap-1.5 overflow-visible p-1.5 md:gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(activeDeckData.columnCount, 1)}, minmax(32px, 38px))`,
                    gridTemplateRows: `repeat(${Math.max(activeDeckData.rowCount, 1)}, minmax(36px, 42px))`,
                  }}
                >
                  {activeDeckData.seats.map((seat) => {
                    const role = seat.occupancyRole || "empty";
                    const selected = normalizeSeatKeys(selectedSeatNumber).some((key) =>
                      normalizeSeatKeys(seat.seatNumber).includes(key),
                    );
                    const tone = seatToneFromOccupancyRole(role);
                    const isBlocked = role === "blocked";
                    const dimmed = focusRole !== "all" && !(
                      (focusRole === "alighting" && (role === "alighting" || seat.alighting?.length))
                      || (focusRole === "boarding" && role === "boarding")
                      || (focusRole === "through" && role === "through")
                    );
                    const tipPerson = (arrow, p) => {
                      const type = formatTicketTypeLabel(p.ticketTypeCode || p.ticketTypeName, lang);
                      return `${arrow} ${p.passengerName}${type && type !== "—" ? ` (${type})` : ""}`;
                    };
                    const tip = [
                      seat.seatNumber,
                      ...(seat.alighting || []).map((p) => tipPerson("↓", p)),
                      ...(seat.boarding || []).map((p) => tipPerson("↑", p)),
                      ...(seat.through || []).map((p) => tipPerson("→", p)),
                      ...(seat.occupiedPassengers || []).map((p) => tipPerson("•", p)),
                    ].filter(Boolean).join(" · ");

                    return (
                      <button
                        key={seat.seatNumber}
                        type="button"
                        title={tip}
                        onClick={() => selectSeat(seat.seatNumber)}
                        className={`group relative z-10 flex cursor-pointer items-center justify-center rounded-lg transition-all ${
                          selected
                            ? "scale-95 rounded-xl ring-2 ring-[#124757]/40 dark:ring-yellow-400/50"
                            : "hover:scale-105"
                        } ${dimmed ? "opacity-25" : ""}`}
                        style={{
                          gridRow: rowLetterToIndex(seat.row),
                          gridColumn: Number(seat.column) || 1,
                        }}
                      >
                        <SeatMapIcon
                          label={seat.seatNumber}
                          tone={tone}
                          disabled={isBlocked}
                          className="h-[90%] w-[90%]"
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center opacity-60">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
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

        {/* Side: lọc KPI hoặc chi tiết ghế */}
        <aside className="flex w-full shrink-0 flex-col gap-3 xl:sticky xl:top-4 xl:w-72">
          {focusList ? (
            <div
              id="trip-seat-detail-panel"
              className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                  {focusRole === "alighting"
                    ? (lang === "VN" ? "Phải xuống" : "Alighting")
                    : focusRole === "boarding"
                      ? (lang === "VN" ? "Lên mới" : "Boarding")
                      : (lang === "VN" ? "Đi tiếp" : "Through")}
                </p>
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                  {actionPeople.counts[focusRole] ?? focusList.length}
                </span>
              </div>
              {focusList.length === 0 ? (
                <p className="py-6 text-center text-[11px] font-medium text-slate-400">
                  {lang === "VN" ? "Không có khách." : "No passengers."}
                </p>
              ) : (
                <div className="max-h-[28rem] space-y-1.5 overflow-y-auto">
                  {focusList.map((person, index) => (
                    <PersonRow
                      key={`${person.seatNumber}-${person.ticketCode || person.passengerName}-${index}`}
                      person={person}
                      lang={lang}
                      accent={
                        focusRole === "alighting"
                          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                          : focusRole === "boarding"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
                            : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
                      }
                      onSeatClick={selectSeat}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : selectedSeat ? (
            <div
              id="trip-seat-detail-panel"
              className="rounded-2xl border-2 border-[#124757]/25 bg-white p-3 shadow-sm dark:border-yellow-400/40 dark:bg-slate-900"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-9 w-7">
                    <SeatMapIcon
                      label={selectedSeat.seatNumber}
                      tone={seatToneFromOccupancyRole(selectedSeat.occupancyRole)}
                      disabled={selectedSeat.occupancyRole === "blocked"}
                    />
                  </span>
                  <p className="font-headline text-base font-black text-[#124757] dark:text-yellow-400">
                    {selectedSeat.seatNumber}
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

              {(() => {
                const renderPassengers = (list, boxClass) => (
                  <div className={`rounded-xl border px-3 py-2 ${boxClass}`}>
                    {list.map((p, i) => {
                      const infants = lapInfantsForPassenger(p);
                      return (
                        <div key={`${p.ticketCode || p.passengerName}-${i}`} className={i > 0 ? "mt-2" : ""}>
                          <p className="text-xs font-bold">{p.passengerName}</p>
                          <PassengerTypeBadge person={p} lang={lang} />
                          <p className="mt-0.5 text-[10px] font-medium opacity-80">
                            {(p.fromStationName || "—")} → {(p.toStationName || "—")}
                          </p>
                          {infants.map((infant, infantIndex) => (
                            <SharedSeatCompanionCard
                              key={`lap-${infant.passengerName}-${infantIndex}`}
                              infant={infant}
                              lang={lang}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );

                if (selectedSeat.boarding?.length) {
                  return renderPassengers(
                    selectedSeat.boarding,
                    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
                  );
                }
                if (selectedSeat.through?.length) {
                  return renderPassengers(
                    selectedSeat.through,
                    "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100",
                  );
                }
                if (selectedSeat.occupiedPassengers?.length) {
                  return renderPassengers(
                    selectedSeat.occupiedPassengers,
                    "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
                  );
                }
                if (selectedSeat.alighting?.length) {
                  return renderPassengers(
                    selectedSeat.alighting,
                    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
                  );
                }
                return (
                  <p className="text-xs font-bold text-slate-500">
                    {lang === "VN" ? "Ghế trống" : "Empty"}
                  </p>
                );
              })()}
            </div>
          ) : (
            <div
              id="trip-seat-detail-panel"
              className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center dark:border-slate-600 dark:bg-slate-900/40"
            >
              <p className="text-[11px] font-medium text-slate-400">
                {lang === "VN"
                  ? "Bấm ghế hoặc KPI để xem khách."
                  : "Tap a seat or KPI to view passengers."}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
