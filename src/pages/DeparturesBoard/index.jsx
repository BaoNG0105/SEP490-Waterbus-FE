import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { FormSelect } from "../../components/FormSelect";
import { useOperationsSchedule } from "../../hooks/useOperationsSchedule";
import { getMovementStatusLabel } from "../../services/operationsService";
import { fetchAllStations } from "../../services/stationService";
import { resolveTripKindKey } from "../../utils/routeTypes";

const pad = (n) => String(n).padStart(2, "0");

const formatClock = (iso) => {
  if (!iso) return "--:--";
  const ms = Date.parse(String(iso));
  if (Number.isNaN(ms)) {
    const m = String(iso).match(/(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : "--:--";
  }
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatBoardDate = (date, lang) => {
  const daysVn = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const daysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = (lang === "VN" ? daysVn : daysEn)[date.getDay()];
  return `${day} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(2)}`;
};

const statusTone = (status) => {
  const key = String(status || "").toLowerCase().replace(/[_\s-]/g, "");
  if (key === "delayed") return "text-orange-400";
  if (key === "boarding") return "text-amber-300";
  if (key === "moving" || key === "departed" || key === "departing") return "text-cyan-300";
  if (key === "arriving" || key === "atstation" || key === "arrived") return "text-sky-300";
  if (key === "completed") return "text-slate-400";
  if (key === "cancelled" || key === "canceled") return "text-rose-400";
  return "text-white";
};

const shortStatusLabel = (status, lang, delayMinutes) => {
  const key = String(status || "").toLowerCase().replace(/[_\s-]/g, "");
  const isVn = lang === "VN";
  if (key === "delayed" || (Number(delayMinutes) > 0 && (key === "scheduled" || key === "boarding"))) {
    const mins = Number(delayMinutes) || 0;
    if (mins > 0) return isVn ? `Trễ ${mins}p` : `Delayed ${mins}m`;
    return isVn ? "Trễ" : "Delayed";
  }
  if (key === "boarding") return isVn ? "Đang lên tàu" : "Boarding";
  if (key === "moving") return isVn ? "Đang chạy" : "En route";
  if (key === "arriving") return isVn ? "Sắp cập bến" : "Arriving";
  if (key === "atstation" || key === "arrived") return isVn ? "Đã cập bến" : "At berth";
  if (key === "departed" || key === "departing") return isVn ? "Đã rời bến" : "Departed";
  if (key === "completed") return isVn ? "Hoàn tất" : "Completed";
  if (key === "cancelled" || key === "canceled") return isVn ? "Hủy" : "Cancelled";
  if (key === "scheduled") return isVn ? "Chờ xuất bến" : "On time";
  return getMovementStatusLabel(status, lang) || (isVn ? "—" : "—");
};

const getStationId = (station) => String(station?.stationId || station?.id || "").trim();
const getStationName = (station) => String(station?.stationName || station?.name || "").trim();

const departureIso = (trip) =>
  trip?.displayStartAt
  || trip?.startAt
  || trip?.scheduledDepartureAt
  || trip?.adjustedStartAt
  || "";

const toBoardRow = (trip, lang) => {
  const kind = resolveTripKindKey(trip);
  const status = trip?.movementStatus || trip?.operationStatus || trip?.tripStatus || "Scheduled";
  const delay = Number(trip?.delayMinutes) || 0;
  return {
    id: String(trip?.tripId || trip?.tripCode || Math.random()),
    time: formatClock(departureIso(trip)),
    sortMs: Date.parse(String(departureIso(trip))) || Number.MAX_SAFE_INTEGER,
    boatCode: String(trip?.boatCode || "—").trim() || "—",
    tripCode: String(trip?.tripCode || "—").trim() || "—",
    destination: String(trip?.toLocation || trip?.routeName || "—").trim().toUpperCase() || "—",
    fromLabel: String(trip?.fromLocation || trip?.currentStationName || "—").trim().toUpperCase() || "—",
    kind,
    kindLabel: kind === "Sightseeing"
      ? (lang === "VN" ? "NGẮM CẢNH" : "SIGHTSEE")
      : (lang === "VN" ? "WATERBUS" : "WATERBUS"),
    status,
    statusLabel: shortStatusLabel(status, lang, delay),
    statusClass: statusTone(delay > 0 && !/cancel|complete/i.test(String(status)) ? "delayed" : status),
    ended: /^(completed|cancelled|canceled)$/i.test(String(status).replace(/[_\s-]/g, "")),
  };
};

function BoardColumn({ rows, lang }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 hidden grid-cols-[4.5rem_3.5rem_minmax(5rem,1fr)_minmax(6rem,1.4fr)_5.5rem_minmax(6rem,1fr)] gap-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:grid lg:grid-cols-[4.5rem_3.5rem_minmax(5.5rem,1fr)_minmax(7rem,1.5fr)_5.5rem_minmax(6.5rem,1fr)]">
        <span>{lang === "VN" ? "Giờ" : "Time"}</span>
        <span>{lang === "VN" ? "Tàu" : "Boat"}</span>
        <span>{lang === "VN" ? "Mã" : "Code"}</span>
        <span>{lang === "VN" ? "Đến" : "To"}</span>
        <span>{lang === "VN" ? "Đi" : "From"}</span>
        <span>{lang === "VN" ? "Trạng thái" : "Status"}</span>
      </div>
      <div className="divide-y divide-white/5">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`grid grid-cols-1 items-center gap-1 px-2 py-2.5 sm:grid-cols-[4.5rem_3.5rem_minmax(5rem,1fr)_minmax(6rem,1.4fr)_5.5rem_minmax(6rem,1fr)] sm:gap-2 lg:grid-cols-[4.5rem_3.5rem_minmax(5.5rem,1fr)_minmax(7rem,1.5fr)_5.5rem_minmax(6.5rem,1fr)] ${
              row.ended ? "opacity-45" : ""
            }`}
          >
            <div className="font-mono text-lg font-bold tabular-nums tracking-tight text-white sm:text-base lg:text-lg">
              {row.time}
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#1e3a5f] text-[10px] font-black tracking-wide text-yellow-300">
              {String(row.boatCode).slice(0, 3)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-mono text-xs font-bold text-white sm:text-[11px] lg:text-xs">
                {row.tripCode}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{row.kindLabel}</p>
            </div>
            <div className="truncate text-sm font-bold uppercase tracking-wide text-white sm:text-xs lg:text-sm">
              {row.destination}
            </div>
            <div>
              <span className="inline-block max-w-full truncate rounded bg-[#e11d48] px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                {row.fromLabel}
              </span>
            </div>
            <div className={`truncate text-right text-xs font-bold uppercase tracking-wide sm:text-left ${row.statusClass}`}>
              {row.statusLabel}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeparturesBoard() {
  const { lang } = useApp();
  const { entries, isLoading, errorMsg } = useOperationsSchedule({
    enabled: true,
    serviceType: "booking",
    skipAuth: true,
  });
  const [now, setNow] = useState(() => new Date());
  const [stations, setStations] = useState([]);
  const [stationId, setStationId] = useState("");

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchAllStations()
      .then((data) => {
        if (!alive) return;
        const list = (Array.isArray(data) ? data : data?.items || data?.data || [])
          .filter((s) => String(s?.status || "Active").toLowerCase() === "active");
        setStations(list);
      })
      .catch(() => {
        if (alive) setStations([]);
      });
    return () => { alive = false; };
  }, []);

  const stationOptions = useMemo(
    () => [
      { value: "", label: lang === "VN" ? "Tất cả bến" : "All stations" },
      ...stations.map((s) => ({
        value: getStationId(s),
        label: getStationName(s) || getStationId(s),
      })),
    ],
    [stations, lang],
  );

  const rows = useMemo(() => {
    const selected = stations.find((s) => getStationId(s) === stationId);
    const filtered = (entries || [])
      .filter((trip) => {
        const type = String(trip?.tripType || trip?.serviceType || "").toLowerCase();
        if (type.includes("charter")) return false;
        if (!selected) return true;
        const from = String(trip?.fromLocation || "").toLowerCase();
        const name = getStationName(selected).toLowerCase();
        const code = String(selected?.stationCode || selected?.code || "").toLowerCase();
        if (name && from.includes(name)) return true;
        if (code && from.includes(code)) return true;
        const stops = Array.isArray(trip?.stops) ? trip.stops : [];
        return stops.some((stop) => {
          const sid = String(stop?.stationId || stop?.station?.stationId || "");
          return sid && sid === stationId;
        });
      })
      .map((trip) => toBoardRow(trip, lang))
      .sort((a, b) => a.sortMs - b.sortMs);
    return filtered;
  }, [entries, stationId, stations, lang]);

  const mid = Math.ceil(rows.length / 2) || 0;
  const leftRows = rows.slice(0, mid);
  const rightRows = rows.slice(mid);

  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  return (
    <div className="min-h-screen bg-[#07111f] text-white font-body">
      <div className="border-b border-yellow-500/30 bg-[#0b1a2e] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/schedule"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/5"
              title={lang === "VN" ? "Lịch đặt vé" : "Booking schedule"}
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <p className="font-headline text-xl font-black uppercase tracking-[0.12em] text-yellow-400 sm:text-2xl">
                {lang === "VN" ? "Khởi hành trong ngày" : "Today's departures"}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Waterbus · {lang === "VN" ? "Bảng điện tử" : "Departures board"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-[200px]">
              <FormSelect
                value={stationId}
                onChange={setStationId}
                options={stationOptions}
                searchable
                placeholder={lang === "VN" ? "Lọc theo bến" : "Filter station"}
                className="w-full rounded-lg border border-white/15 bg-[#12233a] px-3 py-2 text-xs font-bold text-white outline-none"
              />
            </div>
            <div className="rounded-lg bg-[#143052] px-3 py-2 text-right">
              <p className="font-mono text-2xl font-bold tabular-nums tracking-wider text-yellow-300">{clock}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {formatBoardDate(now, lang)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-white/10 bg-[#0e4d92] px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
          <p className="font-headline text-sm font-black uppercase tracking-[0.14em] text-white sm:text-base">
            {lang === "VN" ? "Đi trong ngày / Departures" : "Departures / Khởi hành"}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-100/80">
            {isLoading
              ? (lang === "VN" ? "Đang tải…" : "Loading…")
              : (lang === "VN" ? `${rows.length} chuyến · cập nhật trực tiếp` : `${rows.length} trips · live`)}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-5">
        {errorMsg ? (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300">
            {errorMsg}
          </div>
        ) : null}

        {!isLoading && rows.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-slate-400">
            <span className="material-symbols-outlined text-4xl">departure_board</span>
            <p className="text-sm font-bold">
              {lang === "VN" ? "Chưa có chuyến trong ngày." : "No departures today."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
            <BoardColumn rows={leftRows} lang={lang} />
            {rightRows.length > 0 && (
              <>
                <div className="hidden w-px shrink-0 bg-white/10 lg:block" />
                <BoardColumn rows={rightRows} lang={lang} />
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-[#0b1a2e] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span>waterbus.vn</span>
          <Link to="/schedule" className="text-sky-300 hover:text-yellow-300">
            {lang === "VN" ? "Xem lịch đặt vé →" : "Booking schedule →"}
          </Link>
          <span>{formatBoardDate(now, lang)}</span>
        </div>
      </div>
    </div>
  );
}
