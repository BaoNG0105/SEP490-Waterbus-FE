import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { AppDateInput } from "../../components/AppDateInput";
import { FormSelect } from "../../components/FormSelect";
import { fetchOperationsSchedule, toOperationsScheduleDate } from "../../services/operationsService";
import { fetchAllStations } from "../../services/stationService";
import { getApiErrorMessage } from "../../utils/apiError";
import { getTodayDateString } from "../../utils/dateOnly";
import { resolveTripKindKey } from "../../utils/routeTypes";
import {
  pickStopDisplayArrival,
  pickStopDisplayDeparture,
} from "../../utils/tripStopTimes";

/** Customer: tối đa 7 ngày (hôm nay → +6). */
const CUSTOMER_SCHEDULE_MAX_DAYS = 7;

const getStationId = (station) => String(station?.stationId || station?.id || "").trim();
const getStationName = (station) => String(station?.stationName || station?.name || "").trim();
const getStationCode = (station) => String(station?.stationCode || station?.code || "").trim();
const isActiveWaterbusStation = (station) => {
  const status = String(station?.status || "Active").toLowerCase();
  return status === "active" && station?.isWaterbusStation === true;
};

const addDaysYmd = (ymd, days) => {
  const [y, m, d] = String(ymd || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toOperationsScheduleDate(date);
};

const formatClock = (iso) => {
  if (!iso) return "—";
  const ms = Date.parse(String(iso));
  if (Number.isNaN(ms)) {
    const m = String(iso).match(/(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : "—";
  }
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const clockSortMs = (iso) => {
  const ms = Date.parse(String(iso || ""));
  return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
};

/** Chuyến đã qua giờ khởi hành (hoặc BE báo hoàn tất/hủy). */
const isTripEnded = (trip, viewTime) => {
  const status = String(trip?.movementStatus || trip?.operationStatus || trip?.tripStatus || "")
    .toLowerCase()
    .replace(/[_\s-]/g, "");
  if (status === "completed" || status === "cancelled" || status === "canceled") return true;
  const ms = Date.parse(String(viewTime || ""));
  if (Number.isNaN(ms)) return false;
  return ms < Date.now();
};

const tripDayKey = (trip) => {
  const raw = trip?.displayStartAt
    || trip?.startAt
    || trip?.scheduledDepartureAt
    || trip?.operatingDate
    || "";
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const ms = Date.parse(s);
  if (!Number.isNaN(ms)) return toOperationsScheduleDate(new Date(ms));
  return "";
};

const kindBadgeClass = (kind) => {
  if (kind === "Sightseeing") {
    return "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300";
  }
  if (kind === "Bus") {
    return "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300";
  }
  return "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300";
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const stopStationId = (stop) => String(stop?.stationId || stop?.station?.stationId || "").trim();
const stopStationCode = (stop) => normalizeText(stop?.stationCode || stop?.station?.stationCode || "");
const stopStationName = (stop) => String(
  stop?.stationName || stop?.station?.stationName || stop?.station?.name || "",
).trim();

const sortedStops = (trip) => {
  const stops = Array.isArray(trip?.stops) ? [...trip.stops] : [];
  return stops.sort((a, b) => Number(a?.stopOrder ?? 0) - Number(b?.stopOrder ?? 0));
};

const sameStation = (stop, station) => {
  if (!stop || !station) return false;
  const id = getStationId(station);
  const code = normalizeText(getStationCode(station));
  const name = normalizeText(getStationName(station));
  const sid = stopStationId(stop);
  const scode = stopStationCode(stop);
  const sname = normalizeText(stopStationName(stop));
  if (id && sid && id === sid) return true;
  if (code && scode && code === scode) return true;
  if (name && sname && name === sname) return true;
  return false;
};

/**
 * Chỉ lấy chuyến có điểm ĐI tại bến đã chọn và còn đi tiếp tới bến khác.
 * (Không lấy chuyến chỉ cập / điểm cuối tại bến đó.)
 */
const resolveDepartureLeg = (trip, station) => {
  const stops = sortedStops(trip);
  const fromName = String(trip?.fromLocation || stops[0] && stopStationName(stops[0]) || "").trim();
  const toName = String(
    trip?.toLocation || (stops.length ? stopStationName(stops[stops.length - 1]) : "") || "",
  ).trim();

  if (!station) {
    if (!fromName && !toName) return null;
    return {
      fromLabel: fromName || "—",
      toLabel: toName || "—",
      viewTime: trip?.displayStartAt || trip?.startAt || trip?.scheduledDepartureAt || null,
      endTime: trip?.displayEndAt || trip?.endAt || null,
    };
  }

  if (stops.length >= 2) {
    for (let i = 0; i < stops.length - 1; i += 1) {
      if (!sameStation(stops[i], station)) continue;
      // Tìm bến khác phía sau — ưu tiên điểm cuối tuyến (sau điểm lên).
      let dest = null;
      for (let j = stops.length - 1; j > i; j -= 1) {
        const a = stopStationId(stops[i]) || stopStationCode(stops[i]) || normalizeText(stopStationName(stops[i]));
        const b = stopStationId(stops[j]) || stopStationCode(stops[j]) || normalizeText(stopStationName(stops[j]));
        if (a && b && a !== b) {
          dest = stops[j];
          break;
        }
        if (!a && stopStationName(stops[j]) && normalizeText(stopStationName(stops[i])) !== normalizeText(stopStationName(stops[j]))) {
          dest = stops[j];
          break;
        }
      }
      if (!dest) continue;
      return {
        fromLabel: stopStationName(stops[i]) || getStationName(station),
        toLabel: stopStationName(dest) || toName,
        viewTime: pickStopDisplayDeparture(stops[i])
          || pickStopDisplayArrival(stops[i])
          || trip?.displayStartAt
          || null,
        endTime: pickStopDisplayArrival(dest)
          || pickStopDisplayDeparture(dest)
          || trip?.displayEndAt
          || null,
      };
    }
    return null;
  }

  // Không có stops[]: chỉ nhận khi from = bến chọn và to khác from.
  const name = normalizeText(getStationName(station));
  const code = normalizeText(getStationCode(station));
  const from = normalizeText(fromName);
  const to = normalizeText(toName);
  const fromMatch = (name && from.includes(name)) || (code && from === code);
  if (!fromMatch) return null;
  if (!to || from === to) return null;
  return {
    fromLabel: fromName || getStationName(station),
    toLabel: toName,
    viewTime: trip?.displayStartAt || trip?.startAt || trip?.scheduledDepartureAt || null,
    endTime: trip?.displayEndAt || trip?.endAt || null,
  };
};

export function Schedule() {
  const { lang } = useApp();
  const today = getTodayDateString();
  const maxDate = addDaysYmd(today, CUSTOMER_SCHEDULE_MAX_DAYS - 1);

  const [selectedDate, setSelectedDate] = useState(today);
  const [stationId, setStationId] = useState("");
  const [stations, setStations] = useState([]);
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let active = true;
    fetchAllStations()
      .then((data) => {
        if (!active) return;
        setStations((data || []).filter(isActiveWaterbusStation));
      })
      .catch(() => {
        if (active) setStations([]);
      });
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const list = await fetchOperationsSchedule({
        fromDate: today,
        toDate: maxDate,
        serviceType: "booking",
        includeCancelled: false,
        stationId: stationId || undefined,
      });
      setEntries(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Failed to load customer schedule:", error);
      setEntries([]);
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN"
            ? "Không tải được lịch khởi hành."
            : "Unable to load departure schedule.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [today, maxDate, lang, stationId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedStation = useMemo(
    () => stations.find((s) => getStationId(s) === String(stationId)) || null,
    [stations, stationId],
  );

  const stationOptions = useMemo(() => {
    const opts = stations
      .map((s) => ({ value: getStationId(s), label: getStationName(s) || getStationCode(s) || "—" }))
      .filter((o) => o.value)
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
    return [
      { value: "", label: lang === "VN" ? "Tất cả bến" : "All stations" },
      ...opts,
    ];
  }, [stations, lang]);

  const filteredTrips = useMemo(() => {
    const day = selectedDate || today;
    // Ngoài cửa sổ 7 ngày (BE/customer) → không có lịch để hiện.
    if (day > maxDate || day < today) return [];
    return entries
      .filter((trip) => {
        const kind = resolveTripKindKey(trip);
        if (kind === "Charter") return false;
        const key = tripDayKey(trip);
        if (key && key !== day) return false;
        return true;
      })
      .map((trip) => {
        const leg = resolveDepartureLeg(trip, selectedStation);
        if (!leg) return null;
        return { trip, ...leg };
      })
      .filter(Boolean)
      .sort((a, b) => clockSortMs(a.viewTime) - clockSortMs(b.viewTime));
  }, [entries, selectedDate, today, maxDate, selectedStation]);

  const isOutsideScheduleWindow = Boolean(
    selectedDate && (selectedDate > maxDate || selectedDate < today),
  );

  const onDateChange = (value) => {
    if (!value) return;
    setSelectedDate(value);
  };

  return (
    <main className="min-h-screen bg-[#F4F7F8] pb-20 pt-28 font-body transition-colors duration-300 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl space-y-5 px-4 sm:px-6">
        <header className="border-b border-slate-200/80 pb-6 dark:border-slate-800">
          <h1 className="font-headline text-2xl font-black tracking-tight text-[#124757] dark:text-yellow-400 md:text-3xl">
            {lang === "VN" ? "Lịch khởi hành" : "Departure Schedule"}
          </h1>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[11rem]">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {lang === "VN" ? "Ngày" : "Date"}
              </label>
              <AppDateInput
                value={selectedDate}
                min={today}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#124757] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div className="min-w-[14rem] flex-1 sm:max-w-xs">
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {lang === "VN" ? "Bến đi" : "From station"}
              </label>
              <FormSelect
                value={stationId}
                onChange={setStationId}
                options={stationOptions}
                searchable
                searchPlaceholder={lang === "VN" ? "Tìm bến…" : "Search station…"}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>
        </header>

        {errorMsg ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {errorMsg}
          </div>
        ) : null}

        <section>
          {isLoading ? (
            <div className="rounded-3xl bg-white px-6 py-16 text-center text-slate-400 shadow-sm dark:bg-slate-900">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757]" />
              <p className="text-xs font-medium tracking-wider">
                {lang === "VN" ? "Đang tải lịch khởi hành…" : "Loading schedule…"}
              </p>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="rounded-3xl bg-white px-6 py-16 text-center shadow-sm dark:bg-slate-900">
              <p className="font-headline text-sm font-black text-slate-500 dark:text-slate-300">
                {isOutsideScheduleWindow
                  ? (lang === "VN" ? "Chưa có lịch." : "No schedule yet.")
                  : selectedStation
                    ? (lang === "VN"
                      ? "Không có chuyến khởi hành từ bến này trong ngày đã chọn."
                      : "No departures from this station on the selected day.")
                    : (lang === "VN" ? "Chưa có lịch." : "No schedule yet.")}
              </p>
              {!isOutsideScheduleWindow ? (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link
                    to="/waterbus-booking"
                    className="rounded-full bg-[#FFD100] px-5 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-slate-900"
                  >
                    {lang === "VN" ? "Đặt vé Bus" : "Book Bus"}
                  </Link>
                  <Link
                    to="/watersightseeing-booking"
                    className="rounded-full border border-slate-200 px-5 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:border-slate-600 dark:text-yellow-400"
                  >
                    {lang === "VN" ? "Đặt Sightseeing" : "Book Sightseeing"}
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredTrips.map(({ trip, viewTime, fromLabel, toLabel, endTime }) => {
                const kind = resolveTripKindKey(trip);
                const delayMins = Number(trip.delayMinutes);
                const bookTo = kind === "Sightseeing"
                  ? "/watersightseeing-booking"
                  : "/waterbus-booking";
                const ended = isTripEnded(trip, viewTime);

                return (
                  <li
                    key={String(trip.tripId || trip.tripCode || `${fromLabel}-${viewTime}`)}
                    className={`rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-100 transition dark:bg-slate-900 dark:ring-slate-800 sm:px-6 ${
                      ended ? "opacity-70" : "hover:ring-[#124757]/20 dark:hover:ring-yellow-400/30"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                        <div className="shrink-0">
                          <p className={`font-headline text-[1.75rem] font-black tabular-nums leading-none tracking-tight ${
                            ended
                              ? "text-slate-400 dark:text-slate-500"
                              : "text-[#124757] dark:text-yellow-400"
                          }`}>
                            {formatClock(viewTime)}
                          </p>
                        </div>

                        <div className="h-10 w-px shrink-0 bg-slate-100 dark:bg-slate-800" aria-hidden />

                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${kindBadgeClass(kind)}`}>
                              {kind || "—"}
                            </span>
                            {Number.isFinite(delayMins) && delayMins > 0 && !ended ? (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-300">
                                {lang === "VN" ? `Trễ ${delayMins} phút` : `Delayed ${delayMins} min`}
                              </span>
                            ) : null}
                          </div>
                          <p className={`truncate font-headline text-sm font-bold sm:text-base ${
                            ended ? "text-slate-500 dark:text-slate-400" : "text-slate-800 dark:text-white"
                          }`} title={`${fromLabel} → ${toLabel}`}>
                            {fromLabel}
                            <span className="mx-1.5 text-[#FFD100]">→</span>
                            {toLabel}
                          </p>
                          {endTime ? (
                            <p className="text-[11px] font-medium text-slate-400">
                              {lang === "VN" ? "Đến" : "Arrives"} {formatClock(endTime)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {ended ? (
                        <span className="inline-flex shrink-0 self-start rounded-full bg-slate-100 px-4 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:self-center">
                          {lang === "VN" ? "Đã kết thúc" : "Ended"}
                        </span>
                      ) : (
                        <Link
                          to={bookTo}
                          className="inline-flex shrink-0 self-start rounded-full bg-[#FFD100] px-5 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-slate-900 transition hover:brightness-95 sm:self-center"
                        >
                          {lang === "VN" ? "Đặt vé" : "Book"}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
