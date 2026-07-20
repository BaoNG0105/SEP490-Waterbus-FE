import { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { fetchSightseeingTripSearch } from "../../../services/tripService";

const SIGHTSEEING_ROUTE_TYPE = "SightseeingLoop";

// routeName BE trả dạng "Bến Bạch Đằng · Vòng sightseeing" — tách phần tên bến trước dấu "·"
// để hiển thị bến đón/bến trả mà không cần hardcode tên/ID bến ở FE.
const extractWharfLabel = (routeName) => {
  if (!routeName) return "";
  const [station] = String(routeName).split("·");
  return (station || routeName).trim();
};

export default function Step1SearchSightseeing({ bookingData, updateData, onNext }) {
  const { lang } = useApp();
  const { departureDate } = bookingData;

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Tuyến tham quan là vòng lặp (bến bắt đầu = bến kết thúc) nên người dùng chỉ cần chọn ngày,
  // không cần chọn bến đi/bến đến.
  useEffect(() => {
    updateData({
      isRoundTrip: false,
      routeType: SIGHTSEEING_ROUTE_TYPE,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    setSearchError("");
    setIsSearching(true);
    try {
      const departureTripOptions = await fetchSightseeingTripSearch({ departureDate });

      if (!departureTripOptions.length) {
        setSearchError(
          lang === "VN"
            ? "Không tìm thấy chuyến tham quan phù hợp. Vui lòng thử ngày khác."
            : "No sightseeing trips found for this date. Please try another date."
        );
        return;
      }

      const wharfLabel = extractWharfLabel(departureTripOptions[0]?.routeName);

      updateData({
        departureTripOptions,
        returnTripOptions: [],
        routeType: SIGHTSEEING_ROUTE_TYPE,
        fromWharfName: wharfLabel,
        toWharfName: wharfLabel,
        selectedDepartureTrip: null,
        selectedReturnTrip: null,
        selectedSeatsDeparture: [],
        selectedSeatsReturn: [],
      });
      onNext();
    } catch (error) {
      console.error("Lỗi tìm chuyến tham quan:", error);
      setSearchError(
        lang === "VN"
          ? "Đã xảy ra lỗi khi tìm chuyến. Vui lòng thử lại."
          : "Something went wrong while searching trips. Please try again."
      );
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-6 md:p-8 rounded-4xl shadow-xl border border-slate-100 dark:border-slate-700/50 space-y-6">
      <h2 className="text-2xl font-headline font-bold text-[#124757] dark:text-white border-b pb-3">
        {lang === "VN" ? "Tra cứu hành trình tham quan" : "Search Sightseeing Journey"}
      </h2>

      <div className="flex flex-col sm:flex-row gap-4 bg-sky-50 dark:bg-slate-900 rounded-2xl p-4 border border-sky-100 dark:border-slate-700">
        <div className="flex-1 space-y-1.5 min-w-0">
          <label className="text-xs font-bold uppercase text-slate-400">{lang === "VN" ? "Hành trình" : "Route"}</label>
          <div className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-sm font-bold text-slate-600 dark:text-slate-300 truncate">
            {lang === "VN" ? "Khám Phá Thành Phố - Tàu 2 Tầng" : "City Discovery Tour - Double Deck Boat"}
          </div>
        </div>
        <div className="sm:w-56 space-y-1.5">
          <label className="text-xs font-bold uppercase text-slate-400">{lang === "VN" ? "Ngày tham quan" : "Date"}</label>
          <input
            type="date"
            value={departureDate}
            onChange={(e) => updateData({ departureDate: e.target.value })}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-sm font-medium dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            disabled={!departureDate || isSearching}
            onClick={handleSearch}
            className="w-full sm:w-auto bg-[#FFD100] text-[#124757] font-headline font-bold uppercase tracking-wider text-sm px-8 py-3.5 rounded-xl shadow-md hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isSearching && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
            <span className="material-symbols-outlined text-lg">search</span>
            {isSearching
              ? (lang === "VN" ? "Đang tìm..." : "Searching...")
              : (lang === "VN" ? "Tìm chuyến" : "Search Trips")}
          </button>
        </div>
      </div>

      {searchError && (
        <p className="text-xs font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-3">
          {searchError}
        </p>
      )}
    </div>
  );
}
