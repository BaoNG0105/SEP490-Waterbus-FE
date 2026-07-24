import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { FormSelect } from "../../../components/FormSelect";
import { AppDateInput } from "../../../components/AppDateInput";
import { fetchAllStations } from "../../../services/stationService";
import { fetchTripSearch } from "../../../services/tripService";
import { getTodayDateString } from "../../../utils/dateOnly";
import { getApiErrorMessage } from "../../../utils/apiError";

const getStationId = (station) => String(station.stationId || station.id || "");
const getStationName = (station) => station.stationName || station.name || "--";
const getStationCode = (station) => String(station?.stationCode || station?.code || "").trim();
const isActiveWaterbusStation = (station) => {
  const status = String(station?.status || "Active").toLowerCase();
  return status === "active" && station?.isWaterbusStation === true;
};

const selectClassName =
  "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-sm font-medium dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] disabled:opacity-50";

export default function Step1Search({ bookingData, updateData, onNext }) {
  const { lang } = useApp();
  const { isRoundTrip, fromWharf, toWharf, departureDate, returnDate } = bookingData;

  const [stations, setStations] = useState([]);
  const [isLoadingStations, setIsLoadingStations] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

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
