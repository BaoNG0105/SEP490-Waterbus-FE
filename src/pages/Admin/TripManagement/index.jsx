import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAllTrips, toOperatingDateQuery, getTripStatusLabel, normalizeTripStatusKey, sortTripsForOpsList } from "../../../services/tripService";
import { fetchAllRoutes, fetchRouteDetail } from "../../../services/routeService";
import { trackingHub } from "../../../services/trackingHubClient";
import { FormSelect } from "../../../components/FormSelect";
import { AppDateInput } from "../../../components/AppDateInput";
import { resolveTripKindKey } from "../../../utils/routeTypes";
import { getApiErrorMessage } from "../../../utils/apiError";
import {
  applyDelayPayloadToTrip,
  formatActiveDelayLine,
  formatAffectedTripLine,
  formatPostResumeDelayLine,
  isDelayActive,
  mergeAffectedTripsIntoList,
  pickAffectedTrips,
  pickDelayMinutes,
  pickDisplayArrival,
  pickDisplayDeparture,
} from "../../../utils/tripDelay";

const todayInputValue = () => {
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

const pickDateFromSearch = (params) => {
    const raw = String(params.get("date") || params.get("operatingDate") || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayInputValue();
};

const tripStatusBadgeClass = (status) => {
    switch (normalizeTripStatusKey(status)) {
        case "Scheduled":
            return "text-blue-600 dark:text-blue-400";
        case "Boarding":
            return "text-amber-600 dark:text-amber-400";
        case "InProgress":
            return "text-teal-700 dark:text-teal-300";
        case "Delayed":
            return "text-orange-600 dark:text-orange-400";
        case "Completed":
            return "text-slate-500 dark:text-slate-400";
        case "Cancelled":
            return "text-rose-500 dark:text-rose-400";
        default:
            return "text-slate-500 dark:text-slate-400";
    }
};

const tripStatusDotClass = (status) => {
    switch (normalizeTripStatusKey(status)) {
        case "Scheduled": return "bg-blue-500";
        case "Boarding": return "bg-amber-500";
        case "InProgress": return "bg-teal-500";
        case "Delayed": return "bg-orange-500";
        case "Completed": return "bg-slate-400";
        case "Cancelled": return "bg-rose-500";
        default: return "bg-slate-400";
    }
};

const formatTime = (iso) => {
    if (!iso) return "—";
    const time = new Date(iso);
    if (Number.isNaN(time.getTime())) return "—";
    const pad2 = (n) => String(n).padStart(2, "0");
    return `${pad2(time.getHours())}:${pad2(time.getMinutes())}`;
};

const isUuid = (value) => /^[0-9a-f-]{36}$/i.test(String(value || "").trim());

const cleanLabel = (value) => {
    const text = String(value ?? "").trim();
    if (!text || isUuid(text)) return "";
    return text;
};

/** Lấy nhãn bến từ object / string / stop list — không hiện UUID. */
const labelFromStationLike = (station) => {
    if (station == null || station === "") return "";
    if (typeof station === "string") return cleanLabel(station);
    return cleanLabel(
        station.stationName
        || station.name
        || station.StationName
        || station.stationCode
        || station.code
        || station.StationCode,
    );
};

const labelFromStop = (stop) => {
    if (!stop) return "";
    // Stop trên trip chỉ còn stationId + stationName.
    return cleanLabel(stop.stationName)
        || labelFromStationLike(stop.station)
        || labelFromStationLike(stop.Station)
        || cleanLabel(stop.station?.stationName);
};

/** Mã tuyến kiểu WB-BD-LB / RS-TT-BD → [BD, LB] */
const codesFromRouteCode = (routeCode) => {
    const parts = String(routeCode || "")
        .trim()
        .toUpperCase()
        .split("-")
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length < 3) return null;
    // Bỏ prefix dịch vụ (WB, RS, CH, SOS…)
    const stations = parts.slice(1);
    if (stations.length < 2) return null;
    return { from: stations[0], to: stations[stations.length - 1] };
};

/** "WATERBUS - BACH DANG - LINH DONG" → BACH DANG / LINH DONG */
const namesFromRouteName = (routeName) => {
    const parts = String(routeName || "")
        .split(/\s[-–—]\s/)
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length < 2) return null;
    const skip = /^(waterbus|bus|sightseeing|charter|tuyến)$/i;
    const stations = skip.test(parts[0]) ? parts.slice(1) : parts;
    if (stations.length < 2) return null;
    return { from: stations[0], to: stations[stations.length - 1] };
};

const resolveStationLabel = (trip, edge = "from", routeMeta = null) => {
    const station = edge === "to"
        ? (trip?.toStation ?? trip?.ToStation)
        : (trip?.fromStation ?? trip?.FromStation);
    const fallbackName = edge === "to"
        ? (trip?.toStationName ?? trip?.ToStationName ?? trip?.endStationName ?? trip?.destinationName)
        : (trip?.fromStationName ?? trip?.FromStationName ?? trip?.startStationName ?? trip?.originName);
    const fallbackCode = edge === "to"
        ? (trip?.toStationCode ?? trip?.ToStationCode ?? trip?.endStationCode)
        : (trip?.fromStationCode ?? trip?.FromStationCode ?? trip?.startStationCode);

    const direct = labelFromStationLike(station) || cleanLabel(fallbackName) || cleanLabel(fallbackCode);
    if (direct) return direct;

    const list = Array.isArray(trip?.stops)
        ? [...trip.stops].sort((a, b) => Number(a?.stopOrder ?? 0) - Number(b?.stopOrder ?? 0))
        : [];
    if (list.length) {
        const stop = edge === "to" ? list[list.length - 1] : list[0];
        const fromStop = labelFromStop(stop);
        if (fromStop) return fromStop;
    }

    const routeStops = Array.isArray(routeMeta?.stops)
        ? [...routeMeta.stops].sort((a, b) => Number(a?.stopOrder ?? 0) - Number(b?.stopOrder ?? 0))
        : [];
    if (routeStops.length) {
        const stop = edge === "to" ? routeStops[routeStops.length - 1] : routeStops[0];
        const fromRouteStop = labelFromStop(stop);
        if (fromRouteStop) return fromRouteStop;
    }

    const fromRouteName = namesFromRouteName(trip?.routeName || routeMeta?.routeName);
    if (fromRouteName) return edge === "to" ? fromRouteName.to : fromRouteName.from;

    const fromCode = codesFromRouteCode(trip?.routeCode || routeMeta?.routeCode);
    if (fromCode) return edge === "to" ? fromCode.to : fromCode.from;

    return "—";
};

const resolveBoatLabel = (trip, lang) => {
    const boat = trip?.boat || trip?.Boat || trip?.vessel || trip?.Vessel || {};
    // List/admin chỉ dùng boatId + boatName (hoặc vesselId/vesselName nested).
    const name = cleanLabel(
        trip?.boatName
        || trip?.BoatName
        || boat.vesselName
        || boat.boatName
        || boat.name
        || boat.BoatName,
    );
    if (name) return name;

    const boatId = trip?.boatId || trip?.BoatId || boat.vesselId || boat.boatId || boat.id;
    const hasCapacity = trip?.capacitySnapshot != null || boat.capacity != null || boat.seatCount != null;
    if (boatId || hasCapacity) {
        return lang === "VN" ? "Đã gán tàu" : "Boat assigned";
    }
    return lang === "VN" ? "Chưa gán tàu" : "No boat";
};

const resolveBoatCode = (trip) => {
    const boat = trip?.boat || trip?.Boat || trip?.vessel || trip?.Vessel || {};
    return cleanLabel(
        trip?.boatCode
        || trip?.BoatCode
        || boat.boatCode
        || boat.code
        || boat.BoatCode
        || boat.Code,
    );
};

const resolveBoatFilterKey = (trip) => {
    const boat = trip?.boat || trip?.Boat || trip?.vessel || trip?.Vessel || {};
    const id = String(
        trip?.boatId || trip?.BoatId || boat.vesselId || boat.boatId || boat.id || "",
    ).trim();
    if (id) return `id:${id}`;
    const code = resolveBoatCode(trip);
    if (code) return `code:${code}`;
    const name = resolveBoatLabel(trip, "VN");
    return name ? `name:${name}` : "none";
};

const resolvePaxLabel = (trip) => {
    // Tổng số khách của chuyến — không dùng ghế còn / sức chứa.
    const pax = trip?.totalPassengerCount
        ?? trip?.TotalPassengerCount
        ?? trip?.uniquePassengerCount
        ?? trip?.onboardPassengerCount
        ?? trip?.passengerCount
        ?? trip?.boardingPassengerCount;
    const paxN = pax === null || pax === undefined || pax === "" ? null : Number(pax);
    if (Number.isFinite(paxN)) return String(paxN);
    return "—";
};

export function TripManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [trips, setTrips] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    const [routes, setRoutes] = useState([]);
    const [routeDetailsByCode, setRouteDetailsByCode] = useState({});
    const [operatingDate, setOperatingDate] = useState(() => pickDateFromSearch(searchParams));
    const [statusFilter, setStatusFilter] = useState("All");
    const [boatFilter, setBoatFilter] = useState("All");
    const [serviceKindFilter, setServiceKindFilter] = useState("All");

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        const next = pickDateFromSearch(searchParams);
        setOperatingDate((prev) => (prev === next ? prev : next));
    }, [searchParams]);

    const handleOperatingDateChange = (value) => {
        const next = String(value || "").trim();
        setOperatingDate(next);
        const params = new URLSearchParams(searchParams);
        if (next) params.set("date", next);
        else params.delete("date");
        params.delete("operatingDate");
        setSearchParams(params, { replace: true });
    };

    useEffect(() => {
        fetchAllRoutes()
            .then((data) => {
                const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
                setRoutes(list);
            })
            .catch((error) => console.error("Lỗi tải danh sách tuyến cho bộ lọc:", error));
    }, []);

    useEffect(() => {
        const getTripsData = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");
                const params = {};
                if (operatingDate) params.operatingDate = toOperatingDateQuery(operatingDate);
                if (statusFilter !== "All") params.status = statusFilter;
                const data = await fetchAllTrips(params);
                const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
                setTrips(sortTripsForOpsList(list));
            } catch (error) {
                console.error("Lỗi giao diện tải danh sách chuyến tàu:", error);
                setErrorMsg(getApiErrorMessage(
                    error,
                    lang === "VN"
                        ? "Không thể tải danh sách chuyến tàu (lỗi máy chủ). Báo BE kiểm tra GET /api/trips."
                        : "Unable to load trips (server error). Ask BE to check GET /api/trips.",
                ));
            } finally {
                setIsLoading(false);
            }
        };
        getTripsData();
    }, [lang, operatingDate, statusFilter]);

    const boatIdsKey = useMemo(
      () => [...new Set(
        trips.map((t) => String(
          t?.boatId
          || t?.boat?.vesselId
          || t?.boat?.boatId
          || t?.BoatId
          || "",
        ).trim()).filter(Boolean),
      )].sort().join("|"),
      [trips],
    );

    // JoinBoat theo danh sách + merge tripDelayUpdated / affectedTrips (không tự tính lan delay).
    useEffect(() => {
      const boatIds = boatIdsKey ? boatIdsKey.split("|") : [];
      if (!boatIds.length) return undefined;

      boatIds.forEach((boatId) => {
        trackingHub.joinBoat(boatId).catch(() => {});
      });

      const unsub = trackingHub.subscribeTripDelayUpdated((payload) => {
        if (!payload) return;
        setTrips((prev) => {
          let next = prev.map((trip) => applyDelayPayloadToTrip(trip, payload));
          next = mergeAffectedTripsIntoList(next, pickAffectedTrips(payload));
          return next;
        });
      });

      return () => {
        unsub();
        boatIds.forEach((boatId) => {
          trackingHub.leaveBoat(boatId).catch(() => {});
        });
      };
    }, [boatIdsKey]);

    // Enrich tuyến (kèm stops) để hiện hành trình khi list trip không trả from/to.
    useEffect(() => {
        const codes = [...new Set(
            trips.map((t) => String(t?.routeCode || "").trim()).filter(Boolean),
        )];
        if (!codes.length || !routes.length) return undefined;

        let active = true;
        const enrich = async () => {
            const next = { ...routeDetailsByCode };
            await Promise.all(codes.map(async (code) => {
                if (next[code]?.stops?.length) return;
                const summary = routes.find((r) => String(r.routeCode || "").toUpperCase() === code.toUpperCase());
                if (summary?.stops?.length) {
                    next[code] = summary;
                    return;
                }
                const routeId = summary?.routeId || summary?.id;
                if (!routeId) {
                    next[code] = summary || { routeCode: code, routeName: summary?.routeName };
                    return;
                }
                try {
                    const detail = await fetchRouteDetail(routeId);
                    const unwrapped = detail?.data && typeof detail.data === "object" ? detail.data : detail;
                    if (unwrapped) next[code] = unwrapped;
                } catch {
                    next[code] = summary || { routeCode: code };
                }
            }));
            if (active) setRouteDetailsByCode(next);
        };
        enrich();
        return () => { active = false; };
    // Chỉ chạy khi trips/routes đổi — không phụ thuộc routeDetailsByCode để tránh loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trips, routes]);

    const routeByCode = useMemo(() => {
        const map = { ...routeDetailsByCode };
        routes.forEach((route) => {
            const code = String(route?.routeCode || "").trim();
            if (!code) return;
            if (!map[code]) map[code] = route;
        });
        return map;
    }, [routes, routeDetailsByCode]);

    const stats = useMemo(() => {
        let sightseeing = 0;
        let charter = 0;
        let bus = 0;
        trips.forEach((trip) => {
            const key = resolveTripKindKey(trip);
            if (key === "Sightseeing") sightseeing += 1;
            else if (key === "Charter") charter += 1;
            else if (key === "Bus") bus += 1;
        });
        return {
            total: trips.length,
            sightseeing,
            charter,
            bus,
        };
    }, [trips]);

    const statusOptions = [
        { value: "All", label: lang === "VN" ? "Tất cả trạng thái" : "All status" },
        { value: "Scheduled", label: getTripStatusLabel("Scheduled", lang) },
        { value: "Boarding", label: getTripStatusLabel("Boarding", lang) },
        { value: "InProgress", label: getTripStatusLabel("InProgress", lang) },
        { value: "Delayed", label: getTripStatusLabel("Delayed", lang) },
        { value: "Completed", label: getTripStatusLabel("Completed", lang) },
        { value: "Cancelled", label: getTripStatusLabel("Cancelled", lang) },
    ];

    const serviceKindOptions = [
        { value: "All", label: lang === "VN" ? "Tất cả loại dịch vụ" : "All service types" },
        { value: "Bus", label: "Waterbus" },
        { value: "Sightseeing", label: "Watersightseeing" },
        { value: "Charter", label: lang === "VN" ? "Request" : "Request" },
    ];

    const boatOptions = useMemo(() => {
        const map = new Map();
        trips.forEach((trip) => {
            const key = resolveBoatFilterKey(trip);
            if (key === "none" || map.has(key)) return;
            const code = resolveBoatCode(trip);
            const name = resolveBoatLabel(trip, lang);
            map.set(key, {
                value: key,
                label: code && name && code !== name ? `${code} — ${name}` : (code || name),
            });
        });
        return [
            { value: "All", label: lang === "VN" ? "Tất cả tàu" : "All boats" },
            ...[...map.values()].sort((a, b) => a.label.localeCompare(b.label, lang === "VN" ? "vi" : "en")),
        ];
    }, [trips, lang]);

    const displayedTrips = useMemo(() => {
        return trips.filter((trip) => {
            if (boatFilter !== "All" && resolveBoatFilterKey(trip) !== boatFilter) return false;
            if (serviceKindFilter !== "All" && resolveTripKindKey(trip) !== serviceKindFilter) return false;
            return true;
        });
    }, [trips, boatFilter, serviceKindFilter]);

    // Đổi ngày / trạng thái → reset lọc tàu (danh sách tàu theo ngày).
    useEffect(() => {
        setBoatFilter("All");
    }, [operatingDate, statusFilter]);

    // Đổi bộ lọc → quay về trang 1.
    useEffect(() => {
        setCurrentPage(1);
    }, [operatingDate, statusFilter, boatFilter, serviceKindFilter]);

    const totalPages = Math.ceil(displayedTrips.length / ITEMS_PER_PAGE);
    const currentTrips = displayedTrips.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const startIndex = displayedTrips.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, displayedTrips.length);

    const getPaginationGroup = () => {
        let pages = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 3) {
                pages = [1, 2, 3, 4, '...', totalPages];
            } else if (currentPage >= totalPages - 2) {
                pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            } else {
                pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
            }
        }
        return pages;
    };

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">

            {/* KHỐI TIÊU ĐỀ CHÍNH & PHỤ + NÚT THÊM CHUYẾN MỚI */}
            <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Quản lý Chuyến tàu" : "Trip Management"}
                    </h2>
                </div>
                <button
                    type="button"
                    onClick={() => navigate("/admin/trips-management/create")}
                    className="px-5 py-3 bg-yellow-400 text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
                >
                    <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
                    {lang === "VN" ? "Thêm chuyến mới" : "Add New Trip"}
                </button>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
                    {errorMsg}
                </div>
            )}

            {/* SECTION 1: KHỐI CARD THỐNG KÊ SỐ LIỆU */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số chuyến" : "Total Trips"}</span>
                        <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{isLoading ? "..." : stats.total}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Watersightseeing</span>
                        <h3 className="text-xl font-black font-headline text-violet-600 dark:text-violet-400 mt-0.5">{isLoading ? "..." : stats.sightseeing}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Request</span>
                        <h3 className="text-xl font-black font-headline text-amber-600 dark:text-amber-400 mt-0.5">{isLoading ? "..." : stats.charter}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Waterbus</span>
                        <h3 className="text-xl font-black font-headline text-teal-600 dark:text-teal-400 mt-0.5">{isLoading ? "..." : stats.bus}</h3>
                    </div>
                </div>
            </div>

            {/* THANH BỘ LỌC */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col lg:flex-row gap-3 items-stretch lg:items-center overflow-visible relative z-20">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                        {lang === "VN" ? "Ngày vận hành" : "Operating date"}
                    </span>
                    <AppDateInput
                        value={operatingDate}
                        onChange={(e) => handleOperatingDateChange(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                    />
                </div>

                <div className="relative z-20 flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                        {lang === "VN" ? "Tàu" : "Boat"}
                    </span>
                    <FormSelect
                        value={boatFilter}
                        onChange={setBoatFilter}
                        options={boatOptions}
                        searchable
                        className="min-w-52 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                    />
                </div>

                <div className="relative z-20 flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                        {lang === "VN" ? "Loại dịch vụ" : "Service type"}
                    </span>
                    <FormSelect
                        value={serviceKindFilter}
                        onChange={setServiceKindFilter}
                        options={serviceKindOptions}
                        className="min-w-48 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                    />
                </div>

                <div className="relative z-20 flex items-center gap-2 min-w-0 lg:ml-auto">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                        {lang === "VN" ? "Trạng thái" : "Status"}
                    </span>
                    <FormSelect
                        value={statusFilter}
                        onChange={setStatusFilter}
                        menuAlign="right"
                        options={statusOptions}
                        className="min-w-48 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                    />
                </div>
            </div>

            {/* BẢNG DANH SÁCH CHUYẾN TÀU */}
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full table-fixed text-left border-collapse">
                        <colgroup>
                            <col className="w-[18%]" />
                            <col className="w-[10%]" />
                            <col className="w-[14%]" />
                            <col className="w-[18%]" />
                            <col className="w-[12%]" />
                            <col className="w-[8%]" />
                            <col className="w-[12%]" />
                            <col className="w-[8%]" />
                        </colgroup>
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                                <th className="py-3.5 px-5 text-left">{lang === "VN" ? "Mã chuyến" : "Trip code"}</th>
                                <th className="py-3.5 px-3 text-left">{lang === "VN" ? "Dịch vụ" : "Service"}</th>
                                <th className="py-3.5 px-3 text-left">{lang === "VN" ? "Tàu" : "Boat"}</th>
                                <th className="py-3.5 px-4 text-left">{lang === "VN" ? "Hành trình" : "Stations"}</th>
                                <th className="py-3.5 px-3 text-left">{lang === "VN" ? "Giờ chạy" : "Time"}</th>
                                <th className="py-3.5 px-3 text-left">{lang === "VN" ? "HK" : "Pax"}</th>
                                <th className="py-3.5 px-3 text-left">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-3.5 px-3 text-left">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-16 text-slate-400 font-medium">
                                        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] rounded-full animate-spin mx-auto mb-2"></div>
                                        <p className="text-xs tracking-wider animate-pulse">{lang === "VN" ? "Đang tải danh sách chuyến tàu..." : "Loading trip list..."}</p>
                                    </td>
                                </tr>
                            ) : displayedTrips.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        {lang === "VN" ? "Không có chuyến tàu nào phù hợp với bộ lọc." : "No trips found matching filters."}
                                    </td>
                                </tr>
                            ) : (
                                currentTrips.map((trip) => {
                                    const boatLabel = resolveBoatLabel(trip, lang);
                                    const boatCode = resolveBoatCode(trip);
                                    const routeMeta = routeByCode[String(trip.routeCode || "").trim()] || null;
                                    const fromLabel = resolveStationLabel(trip, "from", routeMeta);
                                    const toLabel = resolveStationLabel(trip, "to", routeMeta);
                                    const kindKey = resolveTripKindKey(trip);
                                    const kindLabel = kindKey === "Sightseeing"
                                        ? "Watersightseeing"
                                        : kindKey === "Charter"
                                            ? (lang === "VN" ? "Request" : "Request")
                                            : kindKey === "Bus"
                                                ? "Waterbus"
                                                : "—";
                                    const kindBadgeClass = kindKey === "Sightseeing"
                                        ? "text-violet-700 dark:text-violet-300"
                                        : kindKey === "Charter"
                                            ? "text-amber-700 dark:text-amber-300"
                                            : kindKey === "Bus"
                                                ? "text-teal-700 dark:text-teal-300"
                                                : "text-slate-500 dark:text-slate-300";

                                    return (
                                        <tr key={trip.tripId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors group">
                                            <td className="py-3.5 px-5 align-middle">
                                                <h4 className="truncate font-headline text-xs font-black tracking-wide text-slate-800 dark:text-white" title={trip.tripCode}>
                                                    {trip.tripCode}
                                                </h4>
                                            </td>

                                            <td className="py-3.5 px-3 align-middle">
                                                <span className={`text-[10px] font-headline font-black uppercase tracking-wide ${kindBadgeClass}`}>
                                                    {kindLabel}
                                                </span>
                                            </td>

                                            <td className="py-3.5 px-3 align-middle">
                                                <div className="min-w-0">
                                                    {boatCode ? (
                                                        <p className="truncate font-mono text-[11px] font-black text-[#124757] dark:text-yellow-400">
                                                            {boatCode}
                                                        </p>
                                                    ) : null}
                                                    <p className={`truncate text-[11px] font-bold ${boatCode ? "text-slate-500" : "text-slate-700 dark:text-slate-200"}`}>
                                                        {boatLabel}
                                                    </p>
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4 align-middle">
                                                <div className="flex min-w-0 items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                                                    <span className="max-w-26 truncate" title={fromLabel}>{fromLabel}</span>
                                                    <span className="material-symbols-outlined shrink-0 text-[14px] text-[#FFD100]">arrow_forward</span>
                                                    <span className="max-w-26 truncate" title={toLabel}>{toLabel}</span>
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                                                <span className="font-bold tabular-nums text-slate-600 dark:text-slate-300">
                                                    {formatTime(pickDisplayDeparture(trip))}
                                                    <span className="mx-1 text-slate-300">→</span>
                                                    {formatTime(pickDisplayArrival(trip))}
                                                </span>
                                                {(() => {
                                                    const active = isDelayActive(trip);
                                                    const mins = pickDelayMinutes(trip);
                                                    const affectedLine = formatAffectedTripLine(trip, lang);
                                                    if (active) {
                                                        return (
                                                            <p className="mt-1 max-w-44 text-[10px] font-bold leading-snug text-amber-700 dark:text-amber-300">
                                                                {formatActiveDelayLine(trip, { lang, stops: trip.stops })}
                                                            </p>
                                                        );
                                                    }
                                                    if (affectedLine) {
                                                        return (
                                                            <p className="mt-1 max-w-44 text-[10px] font-bold leading-snug text-orange-700 dark:text-orange-300">
                                                                {affectedLine}
                                                            </p>
                                                        );
                                                    }
                                                    if (mins > 0) {
                                                        return (
                                                            <p className="mt-1 text-[10px] font-bold text-orange-700 dark:text-orange-300">
                                                                {formatPostResumeDelayLine(trip, lang)}
                                                            </p>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </td>

                                            <td className="py-3.5 px-3 align-middle">
                                                <span className="text-xs font-black tabular-nums text-[#124757] dark:text-yellow-400">
                                                    {resolvePaxLabel(trip)}
                                                </span>
                                            </td>

                                            <td className="py-3.5 px-3 align-middle">
                                                <div className="flex flex-col items-start gap-1">
                                                    <span
                                                        title={trip.statusNote || ""}
                                                        className={`inline-flex items-center gap-1 text-[10px] font-headline font-black uppercase tracking-wide ${tripStatusBadgeClass(trip.tripStatus)}`}
                                                    >
                                                        <span className={`h-1.5 w-1.5 rounded-full ${tripStatusDotClass(trip.tripStatus)}`} />
                                                        {getTripStatusLabel(trip.tripStatus, lang)}
                                                    </span>
                                                    {isDelayActive(trip) ? (
                                                        <span className="inline-flex rounded-lg border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-headline font-black uppercase tracking-wide text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                                                            {lang === "VN" ? "Đang dừng / Delay" : "Stopped / Delay"}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-3 align-middle">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/admin/trips-management/${trip.tripId}`)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:text-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:hover:text-yellow-400"
                                                    title={lang === "VN" ? "Xem chi tiết chuyến" : "View trip detail"}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* KHỐI PHÂN TRANG (PAGINATION) */}
            {totalPages > 0 && (
                <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
                    <span className="text-xs font-bold text-slate-400">
                        {lang === "VN"
                            ? `Hiển thị ${startIndex}-${endIndex} trong số ${displayedTrips.length} kết quả`
                            : `Showing ${startIndex}-${endIndex} of ${displayedTrips.length} entries`}
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">

                        <button
                            type="button"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${currentPage === 1
                                ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                                }`}
                        >
                            <span className="material-symbols-outlined text-base">chevron_left</span>
                        </button>

                        {getPaginationGroup().map((item, index) => {
                            if (item === '...') {
                                return (
                                    <span key={`ellipsis-${index}`} className="w-8 h-8 flex items-center justify-center text-slate-400 font-bold tracking-widest shrink-0">
                                        ...
                                    </span>
                                );
                            }
                            return (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setCurrentPage(item)}
                                    className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black font-headline text-xs transition-all ${currentPage === item
                                        ? "bg-[#124757] text-white shadow-md border-transparent dark:bg-yellow-400 dark:text-slate-900"
                                        : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 hover:bg-slate-50"
                                        }`}
                                >
                                    {item}
                                </button>
                            );
                        })}

                        <button
                            type="button"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${currentPage === totalPages
                                ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                                }`}
                        >
                            <span className="material-symbols-outlined text-base">chevron_right</span>
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}

export { CreateTrip } from "./CreateTrip";
export { TripDetail } from "./TripDetail";
