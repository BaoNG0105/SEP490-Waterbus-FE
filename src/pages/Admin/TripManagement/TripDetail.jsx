import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchTripDetail, getTripStatusLabel, normalizeTripStatusKey } from "../../../services/tripService";
import { getApiErrorMessage } from "../../../utils/apiError";

const formatDateTime = (value, lang) => {
  if (value == null || value === "") return "—";
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

/** Chỉ format đúng field — null thì "—", không fallback sang field kia. */
const pickStopArrival = (stop) =>
  stop?.scheduledArrival ?? stop?.plannedArrivalTime ?? null;

const pickStopDeparture = (stop) =>
  stop?.scheduledDeparture ?? stop?.plannedDepartureTime ?? null;

const pickStaffName = (staff) => {
  if (!staff || typeof staff !== "object") return "—";
  return staff.fullName
    || staff.name
    || staff.staffName
    || staff.staffFullName
    || staff.displayName
    || staff.user?.fullName
    || staff.user?.name
    || staff.userName
    || staff.email
    || "—";
};

const normalizeStaffList = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
};

/** BE trả boat: { vesselId, vesselName, vesselCode, capacity, status } — fallback field cũ. */
const resolveBoatDisplay = (trip) => {
  const boat = trip?.boat || trip?.vessel || null;
  if (!boat && !trip?.boatCode && !trip?.boatName && !trip?.vesselCode) {
    return { code: "", name: "", capacity: null, status: "", empty: true };
  }
  const code = boat?.vesselCode
    || boat?.boatCode
    || boat?.code
    || trip?.boatCode
    || trip?.vesselCode
    || "";
  const name = boat?.vesselName
    || boat?.boatName
    || boat?.name
    || trip?.boatName
    || trip?.vesselName
    || "";
  const capacity = boat?.capacity
    ?? boat?.seatCount
    ?? trip?.capacitySnapshot
    ?? null;
  const status = boat?.status || boat?.boatStatus || "";
  return {
    code,
    name,
    capacity,
    status,
    id: boat?.vesselId || boat?.boatId || boat?.id || trip?.boatId || "",
    empty: !code && !name,
  };
};

export function TripDetail() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setIsLoading(true);
        setErrorMsg("");
        const detail = await fetchTripDetail(id);
        if (!active) return;
        setTrip(detail || null);
      } catch (error) {
        console.error("Lỗi tải chi tiết chuyến:", error);
        if (active) {
          setErrorMsg(getApiErrorMessage(
            error,
            lang === "VN" ? "Không tải được chi tiết chuyến." : "Unable to load trip detail.",
          ));
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id, lang]);

  const boat = resolveBoatDisplay(trip);
  const stops = Array.isArray(trip?.stops) ? [...trip.stops].sort(
    (a, b) => Number(a?.stopOrder ?? 0) - Number(b?.stopOrder ?? 0),
  ) : [];
  const onBoardStaff = normalizeStaffList(
    trip?.onBoardStaff ?? trip?.onboardStaff ?? trip?.OnBoardStaff,
  );
  const lastStopIndex = stops.length - 1;

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-5xl mx-auto animate-fade-in">
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/trips-management")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white transition-all flex items-center justify-center shadow-inner shrink-0"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide truncate">
            {trip?.tripCode || id}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "Chi tiết chuyến: tàu, bến dừng, staff onboard, staff quét vé, số HK lên tàu."
              : "Trip detail: boat, stops, onboard staff, scanning staff, boarding counts."}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700 p-16 text-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400">{lang === "VN" ? "Đang tải…" : "Loading…"}</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 p-4 rounded-xl text-xs font-bold border border-rose-100 dark:border-rose-500/20">
          {errorMsg}
        </div>
      ) : !trip ? (
        <div className="bg-white dark:bg-slate-800 rounded-4xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400 text-sm font-bold">
          {lang === "VN" ? "Không có dữ liệu chuyến." : "No trip data."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Trạng thái" : "Status"}</p>
              <p className="mt-2 text-sm font-headline font-black text-[#124757] dark:text-yellow-400">
                {getTripStatusLabel(trip.tripStatus || trip.status, lang) || normalizeTripStatusKey(trip.tripStatus)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Tàu" : "Boat"}</p>
              {boat.empty ? (
                <p className="mt-2 text-sm font-bold text-slate-400">—</p>
              ) : (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-white">
                    {boat.code || "—"}
                    {boat.name ? ` · ${boat.name}` : ""}
                  </p>
                  <p className="text-[11px] font-medium text-slate-400">
                    {[
                      boat.capacity != null ? `${lang === "VN" ? "Sức chứa" : "Capacity"}: ${boat.capacity}` : null,
                      boat.status || null,
                    ].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Giờ chạy" : "Schedule"}</p>
              <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                {formatDateTime(trip.departureTime, lang)} → {formatDateTime(trip.arrivalTime, lang)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Staff onboard" : "Onboard staff"}
              </h3>
            </div>
            <div className="p-5">
              {onBoardStaff.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">
                  {lang === "VN"
                    ? "Chưa phân công staff onboard (gắn theo boatId)."
                    : "No onboard staff assigned yet (linked by boatId)."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {onBoardStaff.map((staff, index) => (
                    <li key={staff.staffUserId || staff.userId || staff.id || index} className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {pickStaffName(staff)}
                      {staff.dutyRole ? <span className="ml-2 text-[10px] uppercase text-slate-400">{staff.dutyRole}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Bến dừng (stops)" : "Stops"}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">{lang === "VN" ? "Bến" : "Station"}</th>
                    <th className="px-4 py-3">{lang === "VN" ? "Đi" : "Depart"}</th>
                    <th className="px-4 py-3">{lang === "VN" ? "Đến" : "Arrive"}</th>
                    <th className="px-4 py-3">{lang === "VN" ? "Phút dừng" : "Stay"}</th>
                    <th className="px-4 py-3">{lang === "VN" ? "Staff quét vé" : "Scanning staff"}</th>
                    <th className="px-4 py-3">{lang === "VN" ? "HK lên tàu" : "Boarding"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {stops.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                        {lang === "VN" ? "Không có stops[]." : "No stops[]."}
                      </td>
                    </tr>
                  ) : (
                    stops.map((stop, index) => {
                      const scanning = normalizeStaffList(stop.scanningStaff);
                      const boardingCount = stop.boardingPassengerCount
                        ?? stop.boardingCount
                        ?? stop.passengerBoardingCount
                        ?? "—";
                      // Bến đầu: chỉ giờ đi. Bến cuối: chỉ giờ đến. Không copy field kia khi null.
                      const isFirst = index === 0;
                      const isLast = index === lastStopIndex;
                      const arrivalRaw = isFirst ? null : pickStopArrival(stop);
                      const departureRaw = isLast ? null : pickStopDeparture(stop);
                      return (
                        <tr key={stop.tripStopId || `${stop.stopOrder}-${stop.stationId}`} className="text-slate-700 dark:text-slate-200">
                          <td className="px-4 py-3 font-black">{stop.stopOrder ?? "—"}</td>
                          <td className="px-4 py-3 font-bold">
                            {stop.stationName || stop.station?.stationName || stop.stationCode || "—"}
                            {stop.tripStopId ? (
                              <span className="block text-[10px] font-medium text-slate-400 mt-0.5">{stop.tripStopId}</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 font-medium">{formatDateTime(departureRaw, lang)}</td>
                          <td className="px-4 py-3 font-medium">{formatDateTime(arrivalRaw, lang)}</td>
                          <td className="px-4 py-3 font-bold">{stop.stayDurationMinutes ?? "—"}</td>
                          <td className="px-4 py-3">
                            {scanning.length === 0
                              ? "—"
                              : scanning.map((s, i) => (
                                <span key={s.staffUserId || s.userId || s.id || i} className="block font-bold">
                                  {pickStaffName(s)}
                                </span>
                              ))}
                          </td>
                          <td className="px-4 py-3 font-black">{boardingCount}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
