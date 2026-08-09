import { useEffect, useState } from "react";
import { useApp } from "../../../../context/AppContext";
import { AppDateInput } from "../../../../components/AppDateInput";
import { fetchSightseeingTripSearch } from "../../../../services/tripService";
import { getTodayDateString } from "../../../../utils/dateOnly";

const SIGHTSEEING_ROUTE_TYPE = "SightseeingLoop";

const extractWharfLabel = (routeName) => {
  if (!routeName) return "";
  const [station] = String(routeName).split("·");
  return (station || routeName).trim();
};

export default function Step1SearchSightseeingCounter({ bookingData, updateData, onNext }) {
  const { lang } = useApp();
  const { departureDate } = bookingData;

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    updateData({ isRoundTrip: false, routeType: SIGHTSEEING_ROUTE_TYPE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    setSearchError("");
    setIsSearching(true);
    try {
      const departureTripOptions = await fetchSightseeingTripSearch({ departureDate });

      if (!departureTripOptions.length) {
        setSearchError(
          lang === "VN" ? "Không tìm thấy chuyến tham quan phù hợp. Thử ngày khác." : "No sightseeing trips found for this date. Try another date."
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
      setSearchError(lang === "VN" ? "Đã xảy ra lỗi khi tìm chuyến. Vui lòng thử lại." : "Something went wrong while searching trips. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 md:p-6">
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 dark:border-slate-700">
        <h2 className="font-headline text-lg font-bold text-[#124757] dark:text-white">
          {lang === "VN" ? "Tìm chuyến tham quan" : "Search Sightseeing Trip"}
        </h2>
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-2 space-y-1.5">
          <label className="text-[11px] font-bold uppercase text-slate-400">{lang === "VN" ? "Hành trình" : "Route"}</label>
          <div className="w-full truncate rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {lang === "VN" ? "Tour tham quan sông Sài Gòn" : "Saigon River Sightseeing Tour"}
          </div>
        </div>
        <div className="min-w-35 flex-1 space-y-1.5">
          <label className="text-[11px] font-bold uppercase text-slate-400">{lang === "VN" ? "Ngày tham quan" : "Date"}</label>
          <AppDateInput
            value={departureDate}
            min={getTodayDateString()}
            onChange={(e) => updateData({ departureDate: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <button
          type="button"
          disabled={!departureDate || isSearching}
          onClick={handleSearch}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FFD100] px-8 py-3.5 text-sm font-headline font-bold uppercase tracking-wider text-[#124757] shadow-md transition-all hover:brightness-105 disabled:opacity-40"
        >
          {isSearching ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#124757]/30 border-t-[#124757]" />
          ) : (
            <span className="material-symbols-outlined text-lg">search</span>
          )}
          {isSearching ? (lang === "VN" ? "Đang tìm..." : "Searching...") : (lang === "VN" ? "Tìm chuyến" : "Search")}
        </button>
      </div>

      {searchError && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {searchError}
        </p>
      )}
    </div>
  );
}
