import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchStaffMeTrips } from "../../../services/staffMeService";

const pad2 = (n) => String(n).padStart(2, "0");
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const formatDateTime = (value, lang) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(lang === "VN" ? "vi-VN" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function StaffMyTripsPage() {
  const { lang } = useApp();
  const [date, setDate] = useState(todayKey);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchStaffMeTrips({ date });
      setTrips(data);
    } catch {
      setTrips([]);
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 pb-10 font-body">
      <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-headline font-black text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Chuyến của tôi" : "My trips"}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {lang === "VN"
              ? "Chuyến theo ca bến/tàu của bạn trong ngày."
              : "Trips for your station/boat duty on the selected day."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
              {lang === "VN" ? "Ngày" : "Date"}
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <Link
            to="/admin/staff/ticket-scan"
            className="inline-flex items-center gap-2 rounded-xl bg-[#124757] px-4 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900"
          >
            <span className="material-symbols-outlined text-base">qr_code_scanner</span>
            {lang === "VN" ? "Quét vé" : "Scan"}
          </Link>
        </div>
      </div>

      <div className="rounded-4xl border border-slate-100 bg-white shadow-sm overflow-hidden dark:border-slate-700/50 dark:bg-slate-800">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
          </div>
        ) : trips.length === 0 ? (
          <p className="py-14 text-center text-xs font-bold text-slate-400">
            {lang === "VN" ? "Không có chuyến trong ngày này." : "No trips on this day."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {trips.map((trip) => (
              <li key={trip.tripId || trip.tripCode} className="px-5 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-900/20">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-white truncate">{trip.routeName}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {[trip.tripCode, trip.boatCode || trip.boatName].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {[trip.fromStationName, trip.toStationName].filter(Boolean).join(" → ") || "—"}
                    </p>
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 sm:text-right shrink-0">
                    <p>{formatDateTime(trip.departureAt, lang)}</p>
                    {trip.arrivalAt && <p className="text-slate-400 mt-0.5">→ {formatDateTime(trip.arrivalAt, lang)}</p>}
                    {trip.status && (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{trip.status}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
