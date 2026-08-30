import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { FormSelect } from "../../../components/FormSelect";
import { AppDateInput } from "../../../components/AppDateInput";
import { fetchAllStations } from "../../../services/stationService";
import { fetchTripSearch } from "../../../services/tripService";
import { getTodayDateString, getMaxBookableDateString } from "../../../utils/dateOnly";
import { getApiErrorMessage } from "../../../utils/apiError";

const getStationId = (station) => String(station.stationId || station.id || "");
const getStationName = (station) => station.stationName || station.name || "--";
const getStationCode = (station) => String(station?.stationCode || station?.code || "").trim();
const isActiveWaterbusStation = (station) => {
  const status = String(station?.status || "Active").toLowerCase();
  return status === "active" && station?.isWaterbusStation === true;
};

const selectClassName =
  "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-4 px-3.5 text-sm font-medium dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] disabled:opacity-50";

// Điểm đến gần đây — lưu tạm các tuyến đã tìm kiếm gần nhất vào localStorage (riêng máy/trình
// duyệt của khách), để lần sau quay lại trang search có thể chọn nhanh lại đúng tuyến đó.
const RECENT_ROUTES_STORAGE_KEY = "waterbus_recent_search_routes";
const MAX_RECENT_ROUTES = 5;

const isValidRouteEntry = (entry) => Boolean(entry?.fromWharf && entry?.toWharf);
const isSameRoute = (a, b) => String(a.fromWharf) === String(b.fromWharf) && String(a.toWharf) === String(b.toWharf);

const loadRecentRoutes = () => {
  try {
    const raw = localStorage.getItem(RECENT_ROUTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidRouteEntry) : [];
  } catch {
    return [];
  }
};

const persistRecentRoutes = (routes) => {
  try {
    localStorage.setItem(RECENT_ROUTES_STORAGE_KEY, JSON.stringify(routes));
  } catch {
    // localStorage có thể không dùng được (private mode, hết quota...) — bỏ qua, không critical.
  }
};

// Thêm 1 tuyến mới vào đầu danh sách — nếu đã có (trùng cả bến đi lẫn bến đến) thì bỏ bản cũ,
// đẩy bản mới nhất lên đầu; giới hạn số lượng lưu để không phình localStorage.
const addRecentRoute = (route) => {
  const current = loadRecentRoutes().filter((r) => !isSameRoute(r, route));
  const next = [route, ...current].slice(0, MAX_RECENT_ROUTES);
  persistRecentRoutes(next);
  return next;
};

const removeRecentRoute = (route) => {
  const next = loadRecentRoutes().filter((r) => !isSameRoute(r, route));
  persistRecentRoutes(next);
  return next;
};

export default function Step1Search({ bookingData, updateData, onNext }) {
  const { lang } = useApp();
  const { isRoundTrip, fromWharf, toWharf, departureDate, returnDate } = bookingData;

  const [stations, setStations] = useState([]);
  const [isLoadingStations, setIsLoadingStations] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [recentRoutes, setRecentRoutes] = useState(() => loadRecentRoutes());
  const [recentRoutesCollapsed, setRecentRoutesCollapsed] = useState(false);

  const fromOptions = useMemo(
    () => stations.map((station) => ({
      value: getStationId(station),
      label: getStationName(station),
    })),
    [stations],
  );

  const toOptions = useMemo(
    () => fromOptions.filter((opt) => String(opt.value) !== String(fromWharf)),
    [fromOptions, fromWharf],
  );

  // Chỉ hiện các tuyến mà cả 2 bến đã lưu vẫn còn tồn tại/active trong danh sách hiện tại
  // (tránh gợi ý bến đã bị xoá/ngưng hoạt động).
  const visibleRecentRoutes = useMemo(() => {
    if (isLoadingStations) return [];
    return recentRoutes.filter((route) =>
      stations.some((s) => getStationId(s) === String(route.fromWharf))
      && stations.some((s) => getStationId(s) === String(route.toWharf))
    );
  }, [recentRoutes, stations, isLoadingStations]);

  const applyRecentRoute = (route) => {
    updateData({ fromWharf: route.fromWharf, toWharf: route.toWharf });
  };

  const handleRemoveRecentRoute = (route) => {
    setRecentRoutes(removeRecentRoute(route));
  };

  useEffect(() => {
    const loadStations = async () => {
      try {
        setIsLoadingStations(true);
        const data = await fetchAllStations();
        setStations((data || []).filter(isActiveWaterbusStation));
      } catch (error) {
        console.error("Lỗi tải danh sách bến Waterbus:", error);
      } finally {
        setIsLoadingStations(false);
      }
    };
    loadStations();
  }, []);

  const handleSearch = async () => {
    setSearchError("");
    setIsSearching(true);
    try {
      const departureTripOptions = await fetchTripSearch({
        fromStationId: fromWharf,
        toStationId: toWharf,
        departureDate,
      });

      if (!departureTripOptions.length) {
        setSearchError(
          lang === "VN"
            ? "Hiện chưa có chuyến phù hợp cho ngày và chặng bạn chọn. Vui lòng thử ngày khác hoặc đổi bến đi/đến."
            : "No trips are available for this date and route. Please try another date or change your stations."
        );
        return;
      }

      let returnTripOptions = [];
      if (isRoundTrip) {
        returnTripOptions = await fetchTripSearch({
          fromStationId: toWharf,
          toStationId: fromWharf,
          departureDate: returnDate,
        });
        if (!returnTripOptions.length) {
          setSearchError(
            lang === "VN"
              ? "Không tìm thấy chuyến tàu phù hợp cho chiều về. Vui lòng thử ngày khác."
              : "No matching trips found for the return leg. Please try another date."
          );
          return;
        }
      }

      const fromStation = stations.find((s) => getStationId(s) === String(fromWharf));
      const toStation = stations.find((s) => getStationId(s) === String(toWharf));

      setRecentRoutes(addRecentRoute({
        fromWharf: String(fromWharf),
        toWharf: String(toWharf),
        fromWharfName: fromStation ? getStationName(fromStation) : "",
        toWharfName: toStation ? getStationName(toStation) : "",
      }));

      updateData({
        departureTripOptions,
        returnTripOptions,
        fromWharfName: fromStation ? getStationName(fromStation) : "",
        toWharfName: toStation ? getStationName(toStation) : "",
        // Mã bến lấy từ catalog stations — không đọc stationCode trên trip.stops.
        fromWharfCode: fromStation ? getStationCode(fromStation) : "",
        toWharfCode: toStation ? getStationCode(toStation) : "",
        selectedDepartureTrip: null,
        selectedReturnTrip: null,
        selectedSeatsDeparture: [],
        selectedSeatsReturn: [],
      });
      onNext();
    } catch (error) {
      console.error("Lỗi tìm chuyến tàu:", error);
      setSearchError(
        getApiErrorMessage(
          error,
          lang === "VN"
            ? "Đã xảy ra lỗi khi tìm chuyến. Vui lòng thử lại."
            : "Something went wrong while searching trips. Please try again.",
        ),
      );
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-6 md:p-8 rounded-4xl shadow-xl border border-slate-100 dark:border-slate-700/50 space-y-6">
      <h2 className="text-2xl font-headline font-bold text-[#124757] dark:text-white border-b pb-3">
        {lang === "VN" ? "Tra cứu thông tin hành trình" : "Search Waterbus Journey"}
      </h2>

      {/* Một chiều / Khứ hồi */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => updateData({ isRoundTrip: false })}
          className={`px-5 py-2.5 rounded-xl text-xs font-headline font-bold uppercase transition-all ${!isRoundTrip ? "bg-[#124757] text-white shadow-md" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
        >
          {lang === "VN" ? "Một chiều" : "One-Way"}
        </button>
        <button
          type="button"
          onClick={() => updateData({ isRoundTrip: true })}
          className={`px-5 py-2.5 rounded-xl text-xs font-headline font-bold uppercase transition-all ${isRoundTrip ? "bg-[#124757] text-white shadow-md" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
        >
          {lang === "VN" ? "Khứ hồi" : "Round-Trip"}
        </button>
      </div>

      {/* Điểm đến gần đây — lịch sử tuyến đã tìm, lưu trong localStorage của trình duyệt */}
      {visibleRecentRoutes.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in">
          <button
            type="button"
            onClick={() => setRecentRoutesCollapsed((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="text-xs font-headline font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">
              {lang === "VN" ? `Điểm đến gần đây (${visibleRecentRoutes.length})` : `Recent destinations (${visibleRecentRoutes.length})`}
            </span>
            <span className={`material-symbols-outlined text-lg text-slate-400 transition-transform ${recentRoutesCollapsed ? "" : "rotate-180"}`}>
              expand_more
            </span>
          </button>
          {!recentRoutesCollapsed && (
            <div className="flex flex-wrap gap-2 p-3">
              {visibleRecentRoutes.map((route) => (
                <div
                  key={`${route.fromWharf}-${route.toWharf}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white pl-3.5 pr-2 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <button
                    type="button"
                    onClick={() => applyRecentRoute(route)}
                    className="transition-colors hover:text-[#124757] dark:hover:text-yellow-400"
                  >
                    {route.fromWharfName || "--"} - {route.toWharfName || "--"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveRecentRoute(route)}
                    title={lang === "VN" ? "Xoá" : "Remove"}
                    aria-label={lang === "VN" ? "Xoá" : "Remove"}
                    className="text-slate-300 transition-colors hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Điểm đi / Điểm đến */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 sm:items-end sm:gap-4">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-slate-400">{lang === "VN" ? "Bến đi" : "From"}</label>
          <FormSelect
            value={fromWharf}
            onChange={(next) => updateData({ fromWharf: next, toWharf: next === toWharf ? "" : toWharf })}
            disabled={isLoadingStations}
            className={selectClassName}
            placeholder={`-- ${isLoadingStations ? (lang === "VN" ? "Đang tải bến..." : "Loading stations...") : (lang === "VN" ? "Chọn bến xuất phát" : "Select Departure Wharf")} --`}
            options={fromOptions}
          />
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => updateData({ fromWharf: toWharf, toWharf: fromWharf })}
            disabled={!fromWharf && !toWharf}
            title={lang === "VN" ? "Đảo bến đi/đến" : "Swap stations"}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-[#124757] hover:text-[#124757] hover:rotate-180 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-[#FFD100]"
          >
            <span className="material-symbols-outlined text-xl">swap_horiz</span>
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-slate-400">{lang === "VN" ? "Bến đến" : "To"}</label>
          <FormSelect
            value={toWharf}
            onChange={(next) => updateData({ toWharf: next })}
            disabled={isLoadingStations || !fromWharf}
            className={selectClassName}
            placeholder={`-- ${isLoadingStations ? (lang === "VN" ? "Đang tải bến..." : "Loading stations...") : (lang === "VN" ? "Chọn bến cập bến" : "Select Destination Wharf")} --`}
            options={toOptions}
          />
        </div>
      </div>

      {/* Ngày đi / Ngày về */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-slate-400">{lang === "VN" ? "Ngày đi" : "Departure Date"}</label>
          <AppDateInput
            value={departureDate}
            min={getTodayDateString()}
            max={getMaxBookableDateString()}
            onChange={(e) => {
              const next = e.target.value;
              const patch = { departureDate: next };
              // Khứ hồi: nếu ngày đi đẩy quá ngày về → kéo ngày về theo
              if (isRoundTrip && next && returnDate && returnDate < next) {
                patch.returnDate = next;
              }
              updateData(patch);
            }}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-sm font-medium dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]"
          />
        </div>
        {isRoundTrip && (
          <div className="space-y-2 animate-fade-in">
            <label className="text-xs font-bold uppercase text-slate-400">{lang === "VN" ? "Ngày về" : "Return Date"}</label>
            <AppDateInput
              value={returnDate}
              min={departureDate || getTodayDateString()}
              max={getMaxBookableDateString()}
              onChange={(e) => updateData({ returnDate: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-sm font-medium dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]"
            />
          </div>
        )}
      </div>

      {searchError && (
        <p className="text-xs font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-3">
          {searchError}
        </p>
      )}

      <div className="pt-4 flex justify-end">
        <button
          type="button"
          disabled={!fromWharf || !toWharf || !departureDate || (isRoundTrip && !returnDate) || isSearching}
          onClick={handleSearch}
          className="bg-[#FFD100] text-[#124757] font-headline font-bold uppercase tracking-wider text-sm px-10 py-4 rounded-xl shadow-md hover:brightness-105 transition-all disabled:opacity-40 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">search</span>
          {isSearching && <span className="w-4 h-4 border-2 border-[#124757]/30 border-t-[#124757] rounded-full animate-spin"></span>}
          {isSearching
            ? (lang === "VN" ? "Đang tìm..." : "Searching...")
            : (lang === "VN" ? "Tìm chuyến" : "Search Trips")}
        </button>
      </div>
    </div>
  );
}
