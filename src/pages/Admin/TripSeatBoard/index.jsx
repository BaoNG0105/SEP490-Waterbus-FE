import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { TripStationSeatBoard } from "../../../components/TripStationSeatBoard";
import {
  fetchTripDetail,
  fetchTripPassengers,
  groupTripPassengersForDisplay,
  normalizeTripPassenger,
  normalizeTripStatusKey,
} from "../../../services/tripService";
import {
  fetchAssignedCharterBookingDetail,
  fetchCharterBookingManifestByCode,
} from "../../../services/charterBookingService";
import { formatTicketTypeLabel } from "../../../services/ticketTypeService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { pickDisplayArrival, pickDisplayDeparture } from "../../../utils/tripDelay";
import { enrichPassengersWithStopTimes } from "../../../utils/tripStationSeatBoard";
import { resolveTripKindKey } from "../../../utils/routeTypes";
import { formatTripClock } from "../../../utils/tripClock";

const pad2 = (n) => String(n).padStart(2, "0");

/** Ẩn nút Live GPS khi chuyến đã kết thúc / hủy. */
const canOpenLiveGps = (trip) => {
  if (!trip) return false;
  const key = normalizeTripStatusKey(trip?.tripStatus || trip?.status);
  return key !== "Completed" && key !== "Cancelled";
};

/** Tên bến từ string hoặc object BE ({ stationName, name, ... }). */
const stationLabel = (value) => {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text === "[object Object]" ? "" : text;
  }
  if (typeof value === "object") {
    return String(
      value.stationName
      || value.name
      || value.stationCode
      || value.code
      || value.fromStationName
      || value.toStationName
      || "",
    ).trim();
  }
  return "";
};

const formatClock = (value) => {
  return formatTripClock(value);
};

const unwrapCharterManifest = (payload) => {
  let current = payload;
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current || typeof current !== "object" || Array.isArray(current)) break;
    if (Array.isArray(current.passengers) || Array.isArray(current.tickets)) return current;
    const nested = current.manifest || current.booking || current.data || current.result;
    if (!nested || nested === current) break;
    current = nested;
  }
  return current && typeof current === "object" ? current : null;
};

const resolveCharterBookingTotal = (payload) => {
  const source = payload?.data && typeof payload.data === "object"
    ? payload.data
    : payload;
  const raw = source?.totalAmount
    ?? source?.finalAmount
    ?? source?.quoteBreakdown?.totalAmount
    ?? source?.pricing?.totalAmount;
  if (raw === null || raw === undefined || raw === "") return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

const resolveCharterBookingCode = (trip) => {
  const direct = String(
    trip?.bookingCode
    || trip?.BookingCode
    || trip?.charterBookingCode
    || trip?.CharterBookingCode
    || "",
  ).trim();
  if (direct) return direct;
  const tripCode = String(trip?.tripCode || trip?.TripCode || "");
  return tripCode.match(/CB-\d{8}-[A-Z0-9]+/i)?.[0] || "";
};

const passengerMatchTokens = (row) => [
  row?.passengerId && `passenger:${String(row.passengerId).toLowerCase()}`,
  row?.tripSeatId && `trip-seat:${String(row.tripSeatId).toLowerCase()}`,
  row?.ticketCode && row.ticketCode !== "—" && `ticket:${String(row.ticketCode).toUpperCase()}`,
  row?.seatNumber && row.seatNumber !== "—" && `seat:${String(row.seatNumber).toUpperCase()}`,
].filter(Boolean);

const buildCharterManifestPassengers = (payload, tripId) => {
  const manifest = unwrapCharterManifest(payload);
  if (!manifest) return [];
  const passengers = Array.isArray(manifest.passengers) ? manifest.passengers : [];
  const tickets = Array.isArray(manifest.tickets) ? manifest.tickets : [];
  const expectedTripId = String(tripId || "").trim().toLowerCase();
  const belongsToTrip = (row) => {
    const rowTripId = String(row?.tripId || row?.TripId || "").trim().toLowerCase();
    return !expectedTripId || !rowTripId || rowTripId === expectedTripId;
  };
  const tripTickets = tickets.filter(belongsToTrip);
  const usedTickets = new Set();
  const findTicket = (passenger) => {
    const passengerId = String(passenger?.passengerId || passenger?.PassengerId || "").toLowerCase();
    const tripSeatId = String(passenger?.tripSeatId || passenger?.TripSeatId || "").toLowerCase();
    const seatCode = String(passenger?.seatCode || passenger?.seatNumber || "").toUpperCase();
    const index = tripTickets.findIndex((ticket, ticketIndex) => {
      if (usedTickets.has(ticketIndex)) return false;
      const ticketPassengerId = String(ticket?.passengerId || ticket?.PassengerId || "").toLowerCase();
      const ticketTripSeatId = String(ticket?.tripSeatId || ticket?.TripSeatId || "").toLowerCase();
      const ticketSeatCode = String(ticket?.seatCode || ticket?.seatNumber || "").toUpperCase();
      return Boolean(
        (passengerId && passengerId === ticketPassengerId)
        || (tripSeatId && tripSeatId === ticketTripSeatId)
        || (seatCode && seatCode === ticketSeatCode),
      );
    });
    if (index < 0) return null;
    usedTickets.add(index);
    return tripTickets[index];
  };
  const rootFields = {
    bookingCode: manifest.bookingCode || manifest.BookingCode || "",
    contactPhone: manifest.contactPhone || manifest.ContactPhone || "",
    contactEmail: manifest.contactEmail || manifest.ContactEmail || "",
    fromStationId: manifest.fromStationId || manifest.FromStationId || "",
    fromStationName: manifest.fromStationName || manifest.FromStationName || "",
    toStationId: manifest.toStationId || manifest.ToStationId || "",
    toStationName: manifest.toStationName || manifest.ToStationName || "",
  };
  const rows = passengers.filter(belongsToTrip).map((passenger) => normalizeTripPassenger({
    ...rootFields,
    ...(findTicket(passenger) || {}),
    ...passenger,
  })).filter(Boolean);

  tripTickets.forEach((ticket, ticketIndex) => {
    if (usedTickets.has(ticketIndex)) return;
    const normalized = normalizeTripPassenger({ ...rootFields, ...ticket });
    if (normalized) rows.push(normalized);
  });
  return rows;
};

const mergeTripPassengerSources = (tripRows, charterRows) => {
  const primary = Array.isArray(tripRows) ? tripRows : [];
  const fallback = Array.isArray(charterRows) ? charterRows : [];
  if (!primary.length) return fallback;
  if (!fallback.length) return primary;

  const fallbackByToken = new Map();
  fallback.forEach((row) => passengerMatchTokens(row).forEach((token) => fallbackByToken.set(token, row)));
  const matchedFallback = new Set();
  const merged = primary.map((row) => {
    const match = passengerMatchTokens(row).map((token) => fallbackByToken.get(token)).find(Boolean);
    if (!match) return row;
    matchedFallback.add(match);
    return normalizeTripPassenger({ ...(match.raw || {}), ...(row.raw || {}) }) || row;
  });
  fallback.forEach((row) => {
    if (!matchedFallback.has(row)) merged.push(row);
  });
  return merged;
};

const formatDateOfBirth = (value, birthYear) => {
  if (value) {
    const raw = String(value).trim();
    if (raw) {
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) return raw;
      const ms = Date.parse(raw);
      if (!Number.isNaN(ms)) {
        const d = new Date(ms);
        return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
      }
      const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
      return raw;
    }
  }
  const year = Number(birthYear);
  if (Number.isFinite(year) && year > 1900) return String(year);
  return "—";
};

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("vi-VN")}đ`;
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const ms = Date.parse(String(value));
  if (Number.isNaN(ms)) return String(value);
  return new Date(ms).toLocaleString("vi-VN");
};

/** Trạng thái lên/xuống tàu từ ticketStatus + checkedInAt/Out (contract BE). */
const attendanceOf = (row) => {
  const raw = String(row?.ticketStatus || "").toLowerCase().replace(/[\s_-]/g, "");
  // Used = display status khi Active nhưng chuyến đã xong — terminal, không còn trên tàu.
  if (raw === "used" || raw.includes("expired") || raw.includes("cancel")) {
    return "used";
  }
  if (row?.checkedOutAt || raw.includes("checkout") || raw.includes("complete")) {
    return "checkedOut";
  }
  if (row?.checkedInAt || raw.includes("checkedin")) {
    return "checkedIn";
  }
  if (raw === "active" || raw === "" || raw === "confirmed") {
    return "pending";
  }
  return raw || "pending";
};

const attendanceBadge = (row, lang) => {
  const key = attendanceOf(row);
  if (key === "used") {
    return {
      label: lang === "VN" ? "Đã sử dụng" : "Used",
      className: "border-slate-400 bg-slate-700 text-white dark:border-slate-500 dark:bg-slate-300 dark:text-slate-900",
    };
  }
  if (key === "checkedOut") {
    return {
      label: lang === "VN" ? "Đã check-out" : "Checked out",
      className: "border-slate-400 bg-slate-800 text-white dark:border-slate-500 dark:bg-slate-200 dark:text-slate-900",
    };
  }
  if (key === "checkedIn") {
    return {
      label: lang === "VN" ? "Đã check-in" : "Checked in",
      className: "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950",
    };
  }
  return {
    label: lang === "VN" ? "Chưa check-in" : "Not checked in",
    className: "border-amber-500 bg-amber-400 text-amber-950 dark:border-amber-400 dark:bg-amber-400 dark:text-amber-950",
  };
};

const needsEligibilityVerify = (row) => {
  const code = String(row?.ticketTypeCode || "").toUpperCase();
  return ["CHILD", "INFANT", "SENIOR", "DISABLED"].includes(code);
};

const ticketTypeLabel = (code, lang) => formatTicketTypeLabel(code, lang);

const passengerSearchBlob = (row) => ([
  row?.passengerName,
  row?.seatNumber,
  row?.bookingCode,
  row?.ticketCode,
  row?.ticketTypeCode,
  row?.ticketStatus,
  row?.dateOfBirth,
  row?.birthYear,
  row?.fromStationName,
  row?.toStationName,
  ...(Array.isArray(row?.lapInfants)
    ? row.lapInfants.flatMap((infant) => [
      infant?.passengerName,
      infant?.ticketCode,
      infant?.bookingCode,
      infant?.dateOfBirth,
    ])
    : []),
].filter(Boolean).join(" ").toLowerCase());

/** Trang đầy đủ: sơ đồ ghế theo bến + danh sách khách của 1 chuyến. */
export function TripSeatBoardPage() {
  const { tripId: tripIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lang } = useApp();

  const tripId = String(tripIdParam || "").trim();
  const initialStationId = searchParams.get("stationId") || "";

  const [tab, setTab] = useState("seats");
  const [trip, setTrip] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [charterBookingTotal, setCharterBookingTotal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [paxError, setPaxError] = useState("");
  const [expandedPaxKeys, setExpandedPaxKeys] = useState(() => new Set());
  const [paxQuery, setPaxQuery] = useState("");

  const showLiveGpsButton = canOpenLiveGps(trip);

  const openLiveGps = () => {
    if (!trip) return;
    const params = new URLSearchParams();
    const boatId = trip.boatId || trip.boat?.boatId || trip.boat?.vesselId || "";
    const boatCode = trip.boatCode || trip.boat?.boatCode || trip.boat?.code || "";
    const routeId = trip.routeId || trip.route?.routeId || trip.route?.id || "";
    const routeCode = trip.routeCode || trip.route?.routeCode || "";
    if (boatId) params.set("boatId", String(boatId));
    if (boatCode) params.set("boatCode", String(boatCode));
    if (routeId) params.set("routeId", String(routeId));
    if (routeCode) params.set("routeCode", String(routeCode));
    if (trip.tripId || tripId) params.set("tripId", String(trip.tripId || tripId));
    if (trip.tripCode) params.set("tripCode", String(trip.tripCode));
    // Seed onboard count từ danh sách khách đang mở (đã check-in, chưa check-out).
    const onboardSeed = (Array.isArray(passengers) ? passengers : []).reduce((sum, row) => {
      const status = String(row?.ticketStatus || "").toLowerCase().replace(/[\s_-]/g, "");
      const checkedOut = Boolean(row?.checkedOutAt)
        || status.includes("checkout")
        || status.includes("cancelled")
        || status.includes("canceled")
        || status.includes("used")
        || status.includes("expired")
        || status.includes("complete");
      if (checkedOut) return sum;
      const checkedIn = Boolean(row?.checkedInAt) || status.includes("checkedin");
      return checkedIn ? sum + 1 : sum;
    }, 0);
    params.set("onboard", String(onboardSeed));
    params.set("focus", "1");
    navigate(`/admin/live-tracking?${params.toString()}`);
  };

  const togglePaxRow = (key) => {
    setExpandedPaxKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
        setPaxError("");
        const detail = await fetchTripDetail(tripId);
        if (!alive) return;
        setTrip(detail);
        let tripPassengerRows = [];
        let tripPassengerError = null;
        try {
          tripPassengerRows = await fetchTripPassengers(tripId);
        } catch (error) {
          tripPassengerError = error;
        }

        let charterRows = [];
        let nextCharterBookingTotal = null;
        const charterBookingCode = resolveTripKindKey(detail) === "Charter"
          ? resolveCharterBookingCode(detail)
          : "";
        if (charterBookingCode) {
          try {
            const manifest = await fetchCharterBookingManifestByCode(charterBookingCode);
            const manifestRoot = unwrapCharterManifest(manifest);
            nextCharterBookingTotal = resolveCharterBookingTotal(manifestRoot);
            const charterBookingId = String(
              manifestRoot?.bookingId || manifestRoot?.charterBookingId || "",
            ).trim();
            if (nextCharterBookingTotal === null && charterBookingId) {
              try {
                const assignedBooking = await fetchAssignedCharterBookingDetail(charterBookingId);
                nextCharterBookingTotal = resolveCharterBookingTotal(assignedBooking);
              } catch {
                // Passenger manifest remains usable when price detail is unavailable.
              }
            }
            charterRows = buildCharterManifestPassengers(manifest, tripId);
          } catch (error) {
            if (!tripPassengerRows.length) tripPassengerError = error;
          }
        }

        if (!alive) return;
        const mergedRows = mergeTripPassengerSources(tripPassengerRows, charterRows);
        setPassengers(mergedRows);
        setCharterBookingTotal(nextCharterBookingTotal);
        if (tripPassengerError && !mergedRows.length) {
          setPaxError(
            getApiErrorMessage(
              tripPassengerError,
              lang === "VN" ? "Không tải được danh sách khách." : "Unable to load passengers.",
            ),
          );
        }
      } catch (error) {
        if (!alive) return;
        setErrorMsg(
          getApiErrorMessage(
            error,
            lang === "VN" ? "Không tải được chuyến." : "Unable to load trip.",
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
  }, [tripId, lang]);

  const passengersWithTimes = useMemo(
    () => enrichPassengersWithStopTimes(passengers, trip?.stops || []),
    [passengers, trip],
  );

  const passengerGroups = useMemo(
    () => groupTripPassengersForDisplay(passengersWithTimes),
    [passengersWithTimes],
  );

  const filteredPassengerGroups = useMemo(() => {
    const q = paxQuery.trim().toLowerCase();
    if (!q) return passengerGroups;
    return passengerGroups.filter((row) => passengerSearchBlob(row).includes(q));
  }, [passengerGroups, paxQuery]);

  const isCharterTrip = resolveTripKindKey(trip) === "Charter";

  const totalPassengerCount = passengersWithTimes.length;
  const filteredPassengerCount = useMemo(
    () => filteredPassengerGroups.reduce(
      (sum, row) => sum + 1 + (Array.isArray(row.lapInfants) ? row.lapInfants.length : 0),
      0,
    ),
    [filteredPassengerGroups],
  );

  const headerMeta = useMemo(() => {
    if (!trip) return { subtitle: "", boat: "", route: "", from: "", to: "" };
    const stops = Array.isArray(trip.stops) ? trip.stops : [];
    const firstStop = stops[0];
    const lastStop = stops.length ? stops[stops.length - 1] : null;

    const from = stationLabel(trip.fromStationName)
      || stationLabel(trip.fromLocation)
      || stationLabel(trip.fromStation)
      || stationLabel(firstStop?.stationName)
      || stationLabel(firstStop);

    const to = stationLabel(trip.toStationName)
      || stationLabel(trip.toLocation)
      || stationLabel(trip.destinationStationName)
      || stationLabel(trip.toStation)
      || stationLabel(lastStop?.stationName)
      || stationLabel(lastStop);

    const boat = stationLabel(trip.boatName)
      || stationLabel(trip.boatCode)
      || stationLabel(trip.boat?.name)
      || stationLabel(trip.boat?.code)
      || "";

    const route = stationLabel(trip.routeName) || stationLabel(trip.routeCode) || "";

    return {
      subtitle: [
        `${formatClock(pickDisplayDeparture(trip) || trip.departureAt)} → ${formatClock(pickDisplayArrival(trip) || trip.arrivalAt)}`,
        from || to ? `${from || "—"} → ${to || "—"}` : "",
      ].filter(Boolean).join(" · "),
      boat,
      route,
      from,
      to,
    };
  }, [trip]);

  return (
    <div className="mx-auto w-full max-w-[72rem] space-y-5 pb-10 font-body">
      <div className="overflow-hidden rounded-4xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <div className="border-b border-slate-100 bg-gradient-to-br from-[#F4FAFB] via-white to-white px-5 py-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-800 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                {lang === "VN" ? "Vận hành theo bến" : "Station operations"}
              </p>
              <h2 className="mt-1 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400 md:text-3xl">
                {trip?.tripCode || tripId || "—"}
              </h2>
              {headerMeta.subtitle ? (
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">{headerMeta.subtitle}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {headerMeta.boat ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <span className="material-symbols-outlined text-sm" aria-hidden>directions_boat</span>
                    {headerMeta.boat}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <span className="material-symbols-outlined text-sm" aria-hidden>group</span>
                  {totalPassengerCount} {lang === "VN" ? "khách" : "pax"}
                </span>
                {Array.isArray(trip?.stops) ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <span className="material-symbols-outlined text-sm" aria-hidden>pin_drop</span>
                    {trip.stops.length} {lang === "VN" ? "bến" : "stops"}
                  </span>
                ) : null}
                {isCharterTrip && charterBookingTotal !== null ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <span className="material-symbols-outlined text-sm" aria-hidden>payments</span>
                    {lang === "VN" ? "Tổng booking" : "Booking total"}: {formatMoney(charterBookingTotal)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {showLiveGpsButton ? (
                <button
                  type="button"
                  onClick={openLiveGps}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-slate-600 transition hover:border-[#124757]/30 hover:text-[#124757] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-yellow-400/40 dark:hover:text-yellow-400"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden>my_location</span>
                  {lang === "VN" ? "Theo dõi GPS" : "Live GPS"}
                </button>
              ) : null}
              <Link
                to="/admin/staff/ticket-scan"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-[#124757] px-3.5 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900"
              >
                <span className="material-symbols-outlined text-base" aria-hidden>qr_code_scanner</span>
                {lang === "VN" ? "Quét vé" : "Scan"}
              </Link>
            </div>
          </div>
        </div>

        <div className="flex gap-1 px-3 pt-3 sm:px-4">
          {[
            { id: "seats", vn: "Sơ đồ ghế", en: "Seat board", icon: "airline_seat_recline_normal" },
            { id: "list", vn: "Danh sách khách", en: "Passenger list", icon: "format_list_bulleted" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider ${
                tab === item.id
                  ? "bg-slate-100 text-[#124757] dark:bg-slate-900 dark:text-yellow-400"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="material-symbols-outlined text-base" aria-hidden>{item.icon}</span>
              {lang === "VN" ? item.vn : item.en}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center rounded-4xl border border-slate-100 bg-white py-20 dark:border-slate-700/50 dark:bg-slate-800">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400" />
        </div>
      ) : errorMsg ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {errorMsg}
        </div>
      ) : tab === "seats" ? (
        <div className="mx-auto w-full max-w-[72rem] rounded-4xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-6">
          {paxError ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {lang === "VN"
                ? `Không tải được danh sách khách (${paxError}). Vẫn hiện sơ đồ ghế.`
                : `Passengers failed (${paxError}). Seat map still shown.`}
            </div>
          ) : null}
          <TripStationSeatBoard
            trip={trip}
            passengers={passengersWithTimes}
            lang={lang}
            initialStationId={initialStationId}
          />
        </div>
      ) : (
        <div className="rounded-4xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-6">
          {paxError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {paxError}
            </div>
          ) : passengersWithTimes.length === 0 ? (
            <p className="py-14 text-center text-xs font-bold text-slate-400">
              {lang === "VN" ? "Chuyến này chưa có khách mua vé." : "No ticketed passengers on this trip."}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] font-bold text-slate-500">
                  {paxQuery.trim()
                    ? `${filteredPassengerCount}/${totalPassengerCount}`
                    : totalPassengerCount}
                  {" "}
                  {lang === "VN" ? "khách" : "pax"}
                  {filteredPassengerGroups.length !== filteredPassengerCount
                    ? ` · ${filteredPassengerGroups.length} ${lang === "VN" ? "vé/ghế" : "seats"}`
                    : ""}
                </p>
                <label className="relative block w-full sm:max-w-xs">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400" aria-hidden>
                    search
                  </span>
                  <input
                    type="search"
                    value={paxQuery}
                    onChange={(event) => setPaxQuery(event.target.value)}
                    placeholder={lang === "VN"
                      ? "Tìm tên, ghế, booking, vé, bến…"
                      : "Search name, seat, booking, ticket…"}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-xs font-bold text-slate-700 outline-none ring-[#124757]/20 placeholder:font-medium placeholder:text-slate-400 focus:border-[#124757]/40 focus:ring-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-yellow-400/50 dark:focus:ring-yellow-400/20"
                  />
                </label>
              </div>

              {filteredPassengerGroups.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-xs font-bold text-slate-400 dark:border-slate-600">
                  {lang === "VN" ? "Không tìm thấy khách phù hợp." : "No matching passengers."}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="min-w-[780px]">
                    <div className="grid grid-cols-[minmax(150px,1.4fr)_56px_minmax(110px,0.9fr)_minmax(150px,1.3fr)_88px_minmax(120px,1fr)_36px] gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-900/60">
                      <span>{lang === "VN" ? "Khách" : "Passenger"}</span>
                      <span>{lang === "VN" ? "Ghế" : "Seat"}</span>
                      <span>{lang === "VN" ? "Trạng thái" : "Status"}</span>
                      <span>{lang === "VN" ? "Tuyến" : "Route"}</span>
                      <span>{lang === "VN" ? "Giờ" : "Time"}</span>
                      <span>{lang === "VN" ? "Mã vé" : "Ticket"}</span>
                      <span />
                    </div>

                    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                      {filteredPassengerGroups.map((row, index) => {
                        const rowKey = `${row.ticketCode || row.bookingCode}-${row.passengerName}-${index}`;
                        const companions = Array.isArray(row.lapInfants) ? row.lapInfants : [];
                        const expanded = expandedPaxKeys.has(rowKey);
                        const badge = attendanceBadge(row, lang);
                        const dob = formatDateOfBirth(row.dateOfBirth, row.birthYear);
                        const verifyType = needsEligibilityVerify(row);
                        const missingDob = verifyType && dob === "—";
                        const displayedPrice = isCharterTrip ? charterBookingTotal : row.price;
                        const hasPrice = displayedPrice !== null && displayedPrice !== undefined && displayedPrice !== "";
                        const isFree = hasPrice && Number(displayedPrice) === 0;

                        return (
                          <li key={rowKey} className="bg-white dark:bg-slate-800">
                            <button
                              type="button"
                              onClick={() => togglePaxRow(rowKey)}
                              className="grid w-full grid-cols-[minmax(150px,1.4fr)_56px_minmax(110px,0.9fr)_minmax(150px,1.3fr)_88px_minmax(120px,1fr)_36px] items-center gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/40"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-[#124757] dark:text-yellow-400">
                                  {row.passengerName}
                                </p>
                                <p className={`truncate text-[10px] font-black ${
                                  verifyType
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-slate-500 dark:text-slate-400"
                                }`}>
                                  {ticketTypeLabel(row.ticketTypeCode, lang)}
                                  {companions.length > 0
                                    ? ` · +${companions.length} ${lang === "VN" ? "cùng ghế" : "shared"}`
                                    : ""}
                                </p>
                              </div>
                              <span className="font-headline text-sm font-black tabular-nums text-[#124757] dark:text-yellow-400">
                                {row.seatNumber || "—"}
                              </span>
                              <span>
                                <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wide shadow-sm ${badge.className}`}>
                                  {badge.label}
                                </span>
                              </span>
                              <span className="truncate text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                {(row.fromStationName || "—")} → {(row.toStationName || "—")}
                              </span>
                              <span className="text-[11px] font-black tabular-nums text-slate-700 dark:text-slate-200">
                                {formatClock(row.scheduledDeparture)}→{formatClock(row.scheduledArrival)}
                              </span>
                              <span className="truncate text-[11px] font-black text-slate-800 dark:text-slate-100">
                                {row.ticketCode || "—"}
                              </span>
                              <span className="flex justify-center">
                                <span
                                  className={`material-symbols-outlined text-lg text-slate-400 transition ${
                                    expanded ? "rotate-90" : ""
                                  }`}
                                  aria-hidden
                                >
                                  chevron_right
                                </span>
                              </span>
                            </button>

                            {expanded ? (
                              <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/40">
                                <div>
                                  <p className="mb-2 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                                    {lang === "VN" ? "Đối chiếu (chi tiết)" : "Verify (details)"}
                                  </p>
                                  <div className="grid gap-3 text-[11px] sm:grid-cols-2 lg:grid-cols-3">
                                    <div className={missingDob ? "rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-2 dark:border-amber-500/40 dark:bg-amber-500/15" : ""}>
                                      <p className="font-bold uppercase tracking-wider text-slate-400">
                                        {lang === "VN" ? "Ngày sinh" : "Date of birth"}
                                      </p>
                                      <p className={`mt-0.5 text-sm font-black ${
                                        missingDob
                                          ? "text-amber-900 dark:text-amber-100"
                                          : "text-[#124757] dark:text-yellow-400"
                                      }`}>
                                        {missingDob
                                          ? (lang === "VN" ? "Thiếu — cần đối chiếu" : "Missing — verify")
                                          : dob}
                                      </p>
                                    </div>
                                    <div className={isFree ? "rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-2 dark:border-amber-500/40 dark:bg-amber-500/15" : ""}>
                                      <p className="font-bold uppercase tracking-wider text-slate-400">
                                        {isCharterTrip
                                          ? (lang === "VN" ? "Tổng giá booking" : "Booking total")
                                          : (lang === "VN" ? "Giá vé" : "Fare")}
                                      </p>
                                      <p className={`mt-0.5 text-sm font-black ${
                                        isFree
                                          ? "text-amber-900 dark:text-amber-100"
                                          : "text-[#124757] dark:text-yellow-400"
                                      }`}>
                                        {formatMoney(displayedPrice)}
                                        {isFree ? (
                                          <span className="ml-1 text-[10px] uppercase">
                                            {lang === "VN" ? "· Miễn phí" : "· Free"}
                                          </span>
                                        ) : null}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-bold uppercase tracking-wider text-slate-400">Booking</p>
                                      <p className="mt-0.5 break-all text-sm font-black text-slate-800 dark:text-slate-100">
                                        {row.bookingCode || "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-bold uppercase tracking-wider text-slate-400">
                                        {lang === "VN" ? "Số điện thoại" : "Phone"}
                                      </p>
                                      <p className="mt-0.5 break-all text-sm font-black text-slate-800 dark:text-slate-100">
                                        {row.phoneNumber || row.contactPhone || "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-bold uppercase tracking-wider text-slate-400">Email</p>
                                      <p className="mt-0.5 break-all text-sm font-black text-slate-800 dark:text-slate-100">
                                        {row.email || row.contactEmail || "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="font-bold uppercase tracking-wider text-slate-400">
                                        {lang === "VN" ? "Mã vé" : "Ticket"}
                                      </p>
                                      <p className="mt-0.5 break-all text-sm font-black text-slate-800 dark:text-slate-100">
                                        {row.ticketCode || "—"}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <p className="mb-2 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                                    {lang === "VN" ? "Lịch sử lên / xuống" : "Boarding history"}
                                  </p>
                                  <div className="grid gap-3 text-[11px] sm:grid-cols-2">
                                    <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-50 px-3 py-2.5 dark:border-emerald-400/40 dark:bg-emerald-500/15">
                                      <p className="text-[10px] font-headline font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                                        Check-in
                                      </p>
                                      <p className="mt-1 font-headline text-base font-black tabular-nums text-emerald-950 dark:text-emerald-50">
                                        {formatDateTime(row.checkedInAt)}
                                      </p>
                                      {row.checkedInByName ? (
                                        <p className="mt-0.5 text-[11px] font-black text-emerald-900/80 dark:text-emerald-100/80">
                                          {row.checkedInByName}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="rounded-xl border-2 border-slate-400/50 bg-white px-3 py-2.5 dark:border-slate-500 dark:bg-slate-900">
                                      <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                        Check-out
                                      </p>
                                      <p className="mt-1 font-headline text-base font-black tabular-nums text-slate-900 dark:text-white">
                                        {formatDateTime(row.checkedOutAt)}
                                      </p>
                                      {row.checkedOutByName ? (
                                        <p className="mt-0.5 text-[11px] font-black text-slate-700 dark:text-slate-200">
                                          {row.checkedOutByName}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                {companions.length > 0 ? (
                                  <div>
                                    <p className="mb-2 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                                      {lang === "VN" ? "Đi cùng ghế" : "Shared seat"}
                                    </p>
                                    <div className="space-y-1.5">
                                      {companions.map((infant, infantIndex) => (
                                        <div
                                          key={`lap-${infant.passengerName}-${infantIndex}`}
                                          className="rounded-xl border-2 border-violet-300 bg-violet-50 px-3 py-2 dark:border-violet-500/40 dark:bg-violet-500/15"
                                        >
                                          <p className="text-[9px] font-headline font-black uppercase tracking-wider text-violet-800 dark:text-violet-200">
                                            {String(infant.ticketTypeCode || "").toUpperCase() === "CHILD"
                                              ? (lang === "VN" ? "Trẻ em" : "Child")
                                              : (lang === "VN" ? "Em bé" : "Infant")}
                                          </p>
                                          <p className="mt-0.5 truncate text-sm font-black text-violet-950 dark:text-violet-50">
                                            {infant.passengerName}
                                          </p>
                                          {formatDateOfBirth(infant.dateOfBirth, infant.birthYear) !== "—" ? (
                                            <p className="mt-0.5 text-[11px] font-black text-violet-800 dark:text-violet-200">
                                              {lang === "VN" ? "Ngày sinh" : "DOB"}: {formatDateOfBirth(infant.dateOfBirth, infant.birthYear)}
                                            </p>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
