import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../../../context/AppContext";
import { FormSelect } from "../../../../components/FormSelect";
import { AppDateInput } from "../../../../components/AppDateInput";
import { fetchAllStations } from "../../../../services/stationService";
import { fetchTripSearch } from "../../../../services/tripService";
import { getTodayDateString } from "../../../../utils/dateOnly";
import { getApiErrorMessage } from "../../../../utils/apiError";

const getStationId = (station) => String(station.stationId || station.id || "");
const getStationName = (station) => station.stationName || station.name || "--";
const getStationCode = (station) => String(station?.stationCode || station?.code || "").trim();
const isActiveWaterbusStation = (station) => {
  const status = String(station?.status || "Active").toLowerCase();
  return status === "active" && station?.isWaterbusStation === true;
};

const selectClassName =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[#FFD100] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

export default function Step1SearchCounter({ bookingData, updateData, onNext }) {
  const { lang } = useApp();
  const { isRoundTrip, fromWharf, toWharf, departureDate, returnDate } = bookingData;

  const [stations, setStations] = useState([]);
  const [isLoadingStations, setIsLoadingStations] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const fromOptions = useMemo(
    () => stations.map((station) => ({ value: getStationId(station), label: getStationName(station) })),
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
      const departureTripOptions = await fetchTripSearch({ fromStationId: fromWharf, toStationId: toWharf, departureDate });

      if (!departureTripOptions.length) {
        setSearchError(
          lang === "VN"
            ? "Không có chuyến phù hợp cho ngày và chặng đã chọn. Thử ngày khác hoặc đổi bến."
            : "No trips available for this date and route. Try another date or station pair."
        );
        return;
      }

      let returnTripOptions = [];
      if (isRoundTrip) {
        returnTripOptions = await fetchTripSearch({ fromStationId: toWharf, toStationId: fromWharf, departureDate: returnDate });
        if (!returnTripOptions.length) {
          setSearchError(
            lang === "VN" ? "Không tìm thấy chuyến cho chiều về. Thử ngày khác." : "No matching trips for the return leg. Try another date."
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
        getApiErrorMessage(error, lang === "VN" ? "Đã xảy ra lỗi khi tìm chuyến. Vui lòng thử lại." : "Something went wrong while searching trips. Please try again.")
      );
    } finally {
      setIsSearching(false);
    }
  };

  const canSearch = fromWharf && toWharf && departureDate && (!isRoundTrip || returnDate) && !isSearching;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <h2 className="font-headline text-lg font-bold text-[#124757] dark:text-white">
            {lang === "VN" ? "Tìm chuyến Waterbus" : "Search Waterbus Trip"}
          </h2>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => updateData({ isRoundTrip: false })}
            className={`rounded-lg px-4 py-2 text-[11px] font-headline font-black uppercase tracking-wide transition-all ${!isRoundTrip ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900" : "text-slate-500 dark:text-slate-400"
              }`}
          >
            {lang === "VN" ? "Một chiều" : "One-Way"}
          </button>
          <button
            type="button"
            onClick={() => updateData({ isRoundTrip: true })}
            className={`rounded-lg px-4 py-2 text-[11px] font-headline font-black uppercase tracking-wide transition-all ${isRoundTrip ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900" : "text-slate-500 dark:text-slate-400"
              }`}
          >
            {lang === "VN" ? "Khứ hồi" : "Round-Trip"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 pt-5">
        <div className="min-w-40 flex-1 space-y-1.5">
          <label className="text-[11px] font-bold uppercase text-slate-400">{lang === "VN" ? "Bến đi" : "From"}</label>
          <FormSelect
            value={fromWharf}
            onChange={(next) => updateData({ fromWharf: next, toWharf: next === toWharf ? "" : toWharf })}
            disabled={isLoadingStations}
            className={selectClassName}
            placeholder={`-- ${isLoadingStations ? (lang === "VN" ? "Đang tải..." : "Loading...") : (lang === "VN" ? "Chọn bến đi" : "Select origin")} --`}
            options={fromOptions}
          />
        </div>

        <button
          type="button"
          onClick={() => updateData({ fromWharf: toWharf, toWharf: fromWharf })}
          disabled={!fromWharf && !toWharf}
          title={lang === "VN" ? "Đảo bến đi/đến" : "Swap stations"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:rotate-180 hover:border-[#124757] hover:text-[#124757] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-[#FFD100]"
        >
          <span className="material-symbols-outlined text-xl">swap_horiz</span>
        </button>

        <div className="min-w-40 flex-1 space-y-1.5">
          <label className="text-[11px] font-bold uppercase text-slate-400">{lang === "VN" ? "Bến đến" : "To"}</label>
          <FormSelect
            value={toWharf}
            onChange={(next) => updateData({ toWharf: next })}
            disabled={isLoadingStations || !fromWharf}
            className={selectClassName}
            placeholder={`-- ${isLoadingStations ? (lang === "VN" ? "Đang tải..." : "Loading...") : (lang === "VN" ? "Chọn bến đến" : "Select destination")} --`}
            options={toOptions}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-35 flex-1 space-y-1.5">
          <label className="text-[11px] font-bold uppercase text-slate-400">{lang === "VN" ? "Ngày đi" : "Departure Date"}</label>
          <AppDateInput
            value={departureDate}
            min={getTodayDateString()}
            onChange={(e) => {
              const next = e.target.value;
              const patch = { departureDate: next };
              if (isRoundTrip && next && returnDate && returnDate < next) patch.returnDate = next;
              updateData(patch);
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        {isRoundTrip ? (
          <div className="min-w-35 flex-1 animate-fade-in space-y-1.5">
            <label className="text-[11px] font-bold uppercase text-slate-400">{lang === "VN" ? "Ngày về" : "Return Date"}</label>
            <AppDateInput
              value={returnDate}
              min={departureDate || getTodayDateString()}
              onChange={(e) => updateData({ returnDate: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
        ) : null}

        <button
          type="button"
          disabled={!canSearch}
          onClick={handleSearch}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FFD100] px-8 py-3.5 text-sm font-headline font-bold uppercase tracking-wider text-[#124757] shadow-md transition-all hover:brightness-105 disabled:opacity-40"
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
