import { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { fetchTripSearch } from "../../../services/tripService";

// Bến Bạch Đằng — điểm đi/đến cố định của tuyến tham quan vòng quanh thành phố
const SIGHTSEEING_STATION_ID = "e9f94591-62a0-491a-8287-fc0de0adea30";
const SIGHTSEEING_ROUTE_TYPE = "SightseeingLoop";

export default function Step1SearchSightseeing({ bookingData, updateData, onNext }) {
  const { lang } = useApp();
  const { departureDate } = bookingData;

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Tuyến tham quan chỉ có 1 hành trình vòng cố định xuất phát/kết thúc tại bến Bạch Đằng
  // nên tự động gán sẵn điểm đi/đến, người dùng chỉ cần chọn ngày.
  useEffect(() => {
    updateData({
      isRoundTrip: false,
      fromWharf: SIGHTSEEING_STATION_ID,
      toWharf: SIGHTSEEING_STATION_ID,
      routeType: SIGHTSEEING_ROUTE_TYPE,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    setSearchError("");
    setIsSearching(true);
    try {
      const departureTripOptions = await fetchTripSearch({
        fromStationId: SIGHTSEEING_STATION_ID,
        toStationId: SIGHTSEEING_STATION_ID,
        departureDate,
        routeType: SIGHTSEEING_ROUTE_TYPE,
      });

      if (!departureTripOptions.length) {
        setSearchError(
          lang === "VN"
            ? "Không tìm thấy chuyến tham quan phù hợp. Vui lòng thử ngày khác."
            : "No sightseeing trips found for this date. Please try another date."
        );
        return;
      }

      updateData({
        departureTripOptions,
        returnTripOptions: [],
        routeType: SIGHTSEEING_ROUTE_TYPE,
        fromWharfName: lang === "VN" ? "Bến Bạch Đằng" : "Bach Dang Wharf",
        toWharfName: lang === "VN" ? "Bến Bạch Đằng" : "Bach Dang Wharf",
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
