import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { TripStationSeatBoard } from "../../../components/TripStationSeatBoard";
import { fetchTripDetail, fetchTripPassengers } from "../../../services/tripService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { pickDisplayArrival, pickDisplayDeparture } from "../../../utils/tripDelay";

const pad2 = (n) => String(n).padStart(2, "0");

const formatClock = (value) => {
  if (!value) return "--:--";
  const ms = Date.parse(String(value));
  if (Number.isNaN(ms)) {
    const m = String(value).match(/(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : "--:--";
  }
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const ms = Date.parse(String(value));
  if (Number.isNaN(ms)) return String(value);
  return new Date(ms).toLocaleString("vi-VN");
};

const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("vi-VN")}đ`;
};

const ticketTypeLabel = (code, lang) => {
  const key = String(code || "").toUpperCase();
  const map = {
    ADULT: { vn: "Người lớn", en: "Adult" },
    CHILD: { vn: "Trẻ em", en: "Child" },
    INFANT: { vn: "Em bé", en: "Infant" },
    SENIOR: { vn: "NCT", en: "Senior" },
    DISABLED: { vn: "NKT", en: "Disabled" },
  };
  return map[key]?.[lang === "VN" ? "vn" : "en"] || code || "—";
};

/** Trang đầy đủ: sơ đồ ghế theo bến + danh sách khách của 1 chuyến. */
export function TripSeatBoardPage() {
  const { tripId: tripIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lang } = useApp();

  const tripId = String(tripIdParam || "").trim();
  const backTo = searchParams.get("from") || "/admin/staff/my-trips";
  const initialStationId = searchParams.get("stationId") || "";

  const [tab, setTab] = useState("seats");
  const [trip, setTrip] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [paxError, setPaxError] = useState("");

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
        try {
          const rows = await fetchTripPassengers(tripId);
          if (!alive) return;
          setPassengers(rows);
        } catch (error) {
          if (!alive) return;
          setPassengers([]);
          setPaxError(
            getApiErrorMessage(
              error,
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

  const subtitle = useMemo(() => {
    if (!trip) return "";
    const from = trip.fromStationName || trip.fromLocation || "";
    const to = trip.toStationName || trip.toLocation || trip.destinationStationName || "";
    return [
      `${formatClock(pickDisplayDeparture(trip) || trip.departureAt)} → ${formatClock(pickDisplayArrival(trip) || trip.arrivalAt)}`,
      trip.routeName || trip.routeCode || "",
      from || to ? `${from || "—"} → ${to || "—"}` : "",
    ].filter(Boolean).join(" · ");
  }, [trip]);

  return (
    <div className="space-y-5 pb-10 font-body">
      <div className="rounded-4xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
              {lang === "VN" ? "Ghế theo bến / Manifest" : "Station seats / Manifest"}
            </p>
            <h2 className="mt-1 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
              {trip?.tripCode || tripId || "—"}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/staff/ticket-scan"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#124757] px-4 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900"
            >
              <span className="material-symbols-outlined text-base" aria-hidden>qr_code_scanner</span>
              {lang === "VN" ? "Quét vé" : "Scan"}
            </Link>
            <button
              type="button"
              onClick={() => navigate(backTo)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
            >
              {lang === "VN" ? "Quay lại" : "Back"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex gap-2 border-b border-slate-100 dark:border-slate-700">
          {[
            { id: "seats", vn: "Sơ đồ ghế", en: "Seat board" },
            { id: "list", vn: "Danh sách khách", en: "Passenger list" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-t-xl px-4 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider ${
                tab === item.id
                  ? "bg-slate-100 text-[#124757] dark:bg-slate-900 dark:text-yellow-400"
                  : "text-slate-400"
              }`}
            >
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
        <div className="rounded-4xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-6">
          {paxError ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {lang === "VN"
                ? `Không tải được danh sách khách (${paxError}). Vẫn hiện sơ đồ ghế.`
                : `Passengers failed (${paxError}). Seat map still shown.`}
            </div>
          ) : null}
          <TripStationSeatBoard
            trip={trip}
            passengers={passengers}
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
          ) : passengers.length === 0 ? (
            <p className="py-14 text-center text-xs font-bold text-slate-400">
              {lang === "VN" ? "Chuyến này chưa có khách mua vé." : "No ticketed passengers on this trip."}
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-slate-500">
                {passengers.length} {lang === "VN" ? "khách" : "passenger(s)"}
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                {passengers.map((row, index) => (
                  <div
                    key={`${row.ticketCode || row.bookingCode}-${index}`}
                    className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-headline font-black text-[#124757] dark:text-yellow-400">
                          {row.passengerName}
                        </p>
                        <p className="text-[11px] font-bold text-slate-500">
                          {row.bookingCode} · {ticketTypeLabel(row.ticketTypeCode, lang)} · {row.seatNumber || "—"}
                        </p>
                      </div>
                      {row.ticketStatus ? (
                        <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {row.ticketStatus}
                        </span>
                      ) : null}
                    </div>
                    <dl className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                      <div>
                        <dt className="font-bold uppercase tracking-wider text-slate-400">
                          {lang === "VN" ? "Ga lên / xuống" : "Boarding / alighting"}
                        </dt>
                        <dd className="font-bold text-slate-700 dark:text-slate-200">
                          {(row.fromStationName || "—")} → {(row.toStationName || "—")}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wider text-slate-400">
                          {lang === "VN" ? "Giờ dự kiến" : "Scheduled"}
                        </dt>
                        <dd className="font-bold text-slate-700 dark:text-slate-200">
                          {formatClock(row.scheduledDeparture)} → {formatClock(row.scheduledArrival)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wider text-slate-400">
                          {lang === "VN" ? "Giá vé" : "Fare"}
                        </dt>
                        <dd className="font-bold text-slate-700 dark:text-slate-200">{formatMoney(row.price)}</dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wider text-slate-400">Ticket</dt>
                        <dd className="break-all font-bold text-slate-700 dark:text-slate-200">
                          {row.ticketCode || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wider text-slate-400">checkedInAt</dt>
                        <dd className="font-bold text-slate-700 dark:text-slate-200">{formatDateTime(row.checkedInAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-bold uppercase tracking-wider text-slate-400">checkedOutAt</dt>
                        <dd className="font-bold text-slate-700 dark:text-slate-200">{formatDateTime(row.checkedOutAt)}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
