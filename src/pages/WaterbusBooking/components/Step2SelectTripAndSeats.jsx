import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Swal from "sweetalert2";
import { useApp } from "../../../context/AppContext";
import { SeatMapIcon, seatToneFromCode } from "../../../components/SeatMapIcon";
import { BoatBowLabel } from "../../../components/ShipWheelIcon";
import { fetchTripDetail, fetchTripSeatMap, holdSeats, releaseSeats } from "../../../services/tripService";

const MAX_SEATS_PER_LEG = 10;
const LOCKED_STATUSES = ["Held", "Booked", "Blocked"];

const formatTripTime = (isoString) => {
  if (!isoString) return "--";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const formatTripDuration = (departureIso, arrivalIso) => {
  if (!departureIso || !arrivalIso) return "--";
  const start = new Date(departureIso);
  const end = new Date(arrivalIso);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return "--";
  return `${minutes} min`;
};

const getTripHourBucket = (isoString) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "all";
  return date.getHours() < 12 ? "morning" : "afternoon";
};

// Trip search trả về giờ theo cả tuyến (departureTime/arrivalTime) lẫn theo đúng chặng khách chọn
// (fromStopScheduledDeparture/toStopScheduledArrival) — luôn ưu tiên giờ theo chặng để hiển thị đúng
// khi khách lên/xuống ở các bến trung gian khác nhau (VD: A→C và B→C không cùng giờ khởi hành).
const getSegmentDeparture = (trip) => trip?.fromStopScheduledDeparture || trip?.departureTime;
const getSegmentArrival = (trip) => trip?.toStopScheduledArrival || trip?.arrivalTime;

// Chuyển ký tự hàng ghế (A, B, C...) thành số thứ tự hàng cho CSS grid
const rowLetterToIndex = (row) => {
  const letter = String(row || "A").toUpperCase();
  const code = letter.charCodeAt(letter.length - 1) - 64;
  return code > 0 ? code : 1;
};

// Gom danh sách ghế phẳng từ API thành từng tầng (deck) để vẽ lưới giống trang Seat Layout Editor
const buildDeckLayout = (seats) => {
  const deckMap = new Map();
  seats.forEach((seat) => {
    const deckNumber = Number(seat.deck) || 1;
    if (!deckMap.has(deckNumber)) deckMap.set(deckNumber, []);
    deckMap.get(deckNumber).push(seat);
  });

  return [...deckMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([deckNumber, deckSeats]) => ({
      deckNumber,
      seats: deckSeats,
      rowCount: deckSeats.reduce((max, s) => Math.max(max, rowLetterToIndex(s.row)), 0),
      columnCount: deckSeats.reduce((max, s) => Math.max(max, Number(s.column) || 0), 0),
    }));
};

// Tìm bến dừng khớp theo stationId đã chọn ở Bước 1 trong danh sách stops (trả về từ trip detail)
const findStop = (stops, stationId) => {
  if (!Array.isArray(stops) || !stationId) return null;
  return stops.find((s) => String(s.stationId) === String(stationId)) || null;
};

// Tìm mã bến (stationCode) từ danh sách stops của chuyến, khớp theo stationId đã chọn ở Bước 1
const findStationCode = (stops, stationId) => findStop(stops, stationId)?.stationCode || "";

export default function Step2SelectTripAndSeats({ bookingData, updateData, onNext, onBack }) {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const {
    isRoundTrip,
    fromWharf, toWharf,
    departureTripOptions, returnTripOptions,
    selectedDepartureTrip, selectedReturnTrip,
    selectedSeatsDeparture, selectedSeatsReturn
  } = bookingData;

  // Mã bến đi/đến của từng chặng — chặng về đi ngược chiều (toWharf -> fromWharf)
  const getLegStationCodes = (leg, trip) => (
    leg === "departure"
      ? { fromStationCode: findStationCode(trip?.stops, fromWharf), toStationCode: findStationCode(trip?.stops, toWharf) }
      : { fromStationCode: findStationCode(trip?.stops, toWharf), toStationCode: findStationCode(trip?.stops, fromWharf) }
  );

  // Quản lý tab nội bộ của bước 2 nếu là khứ hồi: 'departure' (chiều đi) hoặc 'return' (chiều về)
  const [activeLeg, setActiveLeg] = useState("departure");
  const [filterTime, setFilterTime] = useState("all");

  // Sơ đồ ghế thực tế lấy từ API, lưu riêng theo từng chiều (departure/return) — chỉ để hiển thị,
  // việc chọn/bỏ chọn ghế ở bước này thuần local, KHÔNG gọi API giữ ghế.
  const [seatMapByLeg, setSeatMapByLeg] = useState({ departure: [], return: [] });
  const [activeDeckByLeg, setActiveDeckByLeg] = useState({ departure: 1, return: 1 });
  const [isLoadingSeats, setIsLoadingSeats] = useState(false);
  const [seatMapError, setSeatMapError] = useState("");
  const [isConfirmingSeats, setIsConfirmingSeats] = useState(false);

  // Nếu quay lại Bước 2 từ Bước 3 (chuyến đã chọn sẵn trong bookingData), Step2 mount lại từ đầu nên
  // seatMapByLeg rỗng — tải lại sơ đồ ghế thật cho (các) chặng đã chọn để hiển thị đúng, không bị trống.
  useEffect(() => {
    const legsToHydrate = [
      selectedDepartureTrip?.tripId ? ["departure", selectedDepartureTrip] : null,
      selectedReturnTrip?.tripId ? ["return", selectedReturnTrip] : null,
    ].filter(Boolean);

    if (legsToHydrate.length === 0) return;

    let cancelled = false;
    const hydrate = async () => {
      setIsLoadingSeats(true);
      try {
        await Promise.all(legsToHydrate.map(async ([leg, trip]) => {
          const { fromStationCode, toStationCode } = getLegStationCodes(leg, trip);
          if (!fromStationCode || !toStationCode) return;
          const seatMapResponse = await fetchTripSeatMap(trip.tripId, { fromStationCode, toStationCode });
          if (cancelled) return;
          setSeatMapByLeg((prev) => ({ ...prev, [leg]: seatMapResponse?.seats || [] }));
        }));
      } catch (error) {
        if (!cancelled) {
          console.error("Lỗi khi tải lại sơ đồ ghế:", error);
          setSeatMapError(
            lang === "VN"
              ? "Không thể tải lại sơ đồ ghế. Vui lòng chọn lại chuyến."
              : "Unable to reload the seat map. Please reselect the trip."
          );
        }
      } finally {
        if (!cancelled) setIsLoadingSeats(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
    // Chỉ chạy 1 lần khi mount — không tải lại khi người dùng đổi chuyến trong phiên này (đã có handleSelectTrip lo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tripOptions = activeLeg === "departure" ? departureTripOptions : returnTripOptions;
  const currentTrip = activeLeg === "departure" ? selectedDepartureTrip : selectedReturnTrip;
  const currentSeats = activeLeg === "departure" ? selectedSeatsDeparture : selectedSeatsReturn;
  const currentSeatMap = seatMapByLeg[activeLeg];

  const filteredTripOptions = (tripOptions || []).filter((trip) => {
    if (filterTime === "all") return true;
    return getTripHourBucket(getSegmentDeparture(trip)) === filterTime;
  });

  const deckLayout = useMemo(() => buildDeckLayout(currentSeatMap), [currentSeatMap]);
  const activeDeckNumber = activeDeckByLeg[activeLeg] || deckLayout[0]?.deckNumber || 1;
  const activeDeckData = deckLayout.find((d) => d.deckNumber === activeDeckNumber) || deckLayout[0];

  const seatTypesInMap = useMemo(() => {
    const map = new Map();
    currentSeatMap.forEach((seat) => {
      const code = String(seat.seatTypeCode || "STANDARD").toUpperCase();
      if (!map.has(code)) map.set(code, seat.seatTypeName || code);
    });
    return [...map.entries()];
  }, [currentSeatMap]);

  const promptSignIn = () => {
    Swal.fire({
      icon: "info",
      title: lang === "VN" ? "Bạn cần đăng nhập" : "Sign in required",
      text: lang === "VN" ? "Vui lòng đăng nhập để chọn ghế và đặt vé." : "Please sign in to select seats and book tickets.",
      confirmButtonColor: "#124757",
    }).then(() => navigate("/login"));
  };

  // Khi người dùng chọn 1 chuyến: tải chi tiết chuyến (bến dừng) + sơ đồ ghế thực tế của chặng đang xem
  const handleSelectTrip = async (trip) => {
    if (trip.availableSeats <= 0 || trip.tripStatus !== "Scheduled") return;
    if (currentTrip?.tripId === trip.tripId) return;

    if (!isAuthenticated) {
      promptSignIn();
      return;
    }

    setSeatMapError("");
    setIsLoadingSeats(true);
    try {
      const tripDetail = await fetchTripDetail(trip.tripId);
      const stops = tripDetail?.stops || [];

      // Giờ khởi hành/đến đúng theo chặng khách chọn phải lấy từ scheduledDeparture/scheduledArrival
      // của chính bến lên/xuống trong stops[] — không dùng field gợi ý fromStopScheduledDeparture của
      // API search vì field đó không đáng tin cậy (từng trả sai giờ khi đổi bến lên tàu).
      const boardingStationId = activeLeg === "departure" ? fromWharf : toWharf;
      const alightingStationId = activeLeg === "departure" ? toWharf : fromWharf;
      const boardingStop = findStop(stops, boardingStationId);
      const alightingStop = findStop(stops, alightingStationId);

      const mergedTrip = {
        ...trip,
        stops,
        fromStopScheduledDeparture: boardingStop?.scheduledDeparture || trip.fromStopScheduledDeparture || trip.departureTime,
        toStopScheduledArrival: alightingStop?.scheduledArrival || trip.toStopScheduledArrival || trip.arrivalTime,
      };
      const { fromStationCode, toStationCode } = getLegStationCodes(activeLeg, mergedTrip);

      if (!fromStationCode || !toStationCode) {
        setSeatMapError(
          lang === "VN"
            ? "Không xác định được mã bến đón/trả trên chuyến này. Vui lòng chọn chuyến khác."
            : "Unable to resolve the pickup/drop-off station codes for this trip. Please pick another trip."
        );
        return;
      }

      const seatMapResponse = await fetchTripSeatMap(trip.tripId, { fromStationCode, toStationCode });
      setSeatMapByLeg((prev) => ({ ...prev, [activeLeg]: seatMapResponse?.seats || [] }));
      setActiveDeckByLeg((prev) => ({ ...prev, [activeLeg]: 1 }));

      if (activeLeg === "departure") {
        updateData({ selectedDepartureTrip: mergedTrip, selectedSeatsDeparture: [] });
      } else {
        updateData({ selectedReturnTrip: mergedTrip, selectedSeatsReturn: [] });
      }
    } catch (error) {
      console.error("Lỗi khi tải chi tiết chuyến/sơ đồ ghế:", error);
      setSeatMapError(
        lang === "VN"
          ? "Không thể tải sơ đồ ghế cho chuyến này. Vui lòng thử lại."
          : "Unable to load the seat map for this trip. Please try again."
      );
    } finally {
      setIsLoadingSeats(false);
    }
  };

  // Chọn/bỏ chọn ghế: chỉ cập nhật state cục bộ, KHÔNG gọi API giữ/nhả ghế ở bước này
  const handleSeatClick = (seat) => {
    if (!isAuthenticated) {
      promptSignIn();
      return;
    }
    if (!currentTrip?.tripId) return;

    const isSelected = currentSeats.some((s) => s.seatNumber === seat.seatNumber);
    const isLockedByOthers = LOCKED_STATUSES.includes(seat.status) && !isSelected;
    if (isLockedByOthers) return;

    const setLegSeats = (seats) => {
      if (activeLeg === "departure") updateData({ selectedSeatsDeparture: seats });
      else updateData({ selectedSeatsReturn: seats });
    };

    if (isSelected) {
      setLegSeats(currentSeats.filter((s) => s.seatNumber !== seat.seatNumber));
      return;
    }

    if (currentSeats.length >= MAX_SEATS_PER_LEG) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Đã đạt số ghế tối đa" : "Maximum seats reached",
        text: lang === "VN" ? `Chỉ được chọn tối đa ${MAX_SEATS_PER_LEG} ghế trong 1 lần đặt.` : `You can select up to ${MAX_SEATS_PER_LEG} seats per booking.`,
        confirmButtonColor: "#124757",
      });
      return;
    }

    setLegSeats([...currentSeats, seat]);
  };

  // Vé khứ hồi: số ghế chiều về phải bằng số ghế chiều đi (hành khách đi và về là cùng một nhóm người)
  const roundTripSeatCountMismatch = isRoundTrip
    && selectedSeatsDeparture.length > 0
    && selectedSeatsReturn.length > 0
    && selectedSeatsDeparture.length !== selectedSeatsReturn.length;

  // Kiểm tra xem đã hoàn thành điều kiện để ấn nút "Tiếp tục" sang bước thanh toán chưa
  const isStepComplete = selectedDepartureTrip && selectedSeatsDeparture.length > 0 &&
    (!isRoundTrip || (
      selectedReturnTrip
      && selectedSeatsReturn.length > 0
      && selectedSeatsReturn.length === selectedSeatsDeparture.length
    ));

  // Chỉ THỰC SỰ giữ ghế (gọi API hold) khi bấm "Tiếp tục thanh toán" — đây là lúc rời Bước 2 sang Bước 3.
  const handleContinueToCheckout = async () => {
    if (!isStepComplete || isConfirmingSeats) return;

    setSeatMapError("");
    setIsConfirmingSeats(true);
    try {
      const departureCodes = getLegStationCodes("departure", selectedDepartureTrip);
      const departureHold = await holdSeats(
        selectedDepartureTrip.tripId,
        selectedSeatsDeparture.map((s) => s.seatNumber),
        departureCodes.fromStationCode,
        departureCodes.toStationCode
      );
      const departureFailed = departureHold?.failedSeatNumbers || [];

      if (departureFailed.length) {
        setActiveLeg("departure");
        updateData({ selectedSeatsDeparture: selectedSeatsDeparture.filter((s) => !departureFailed.includes(s.seatNumber)) });
        const refreshed = await fetchTripSeatMap(selectedDepartureTrip.tripId, departureCodes);
        setSeatMapByLeg((prev) => ({ ...prev, departure: refreshed?.seats || [] }));
        setSeatMapError(
          lang === "VN"
            ? `Ghế ${departureFailed.join(", ")} (chiều đi) vừa được người khác giữ. Vui lòng chọn lại.`
            : `Seat(s) ${departureFailed.join(", ")} (departure) were just taken by someone else. Please reselect.`
        );
        return;
      }

      let returnExpiresAt = null;
      if (isRoundTrip) {
        const returnCodes = getLegStationCodes("return", selectedReturnTrip);
        const returnHold = await holdSeats(
          selectedReturnTrip.tripId,
          selectedSeatsReturn.map((s) => s.seatNumber),
          returnCodes.fromStationCode,
          returnCodes.toStationCode
        );
        const returnFailed = returnHold?.failedSeatNumbers || [];

        if (returnFailed.length) {
          // Không thể hoàn tất khứ hồi — nhả lại ghế chiều đi vừa giữ để không giữ ghế lãng phí
          releaseSeats(
            selectedDepartureTrip.tripId,
            selectedSeatsDeparture.map((s) => s.seatNumber),
            departureCodes.fromStationCode,
            departureCodes.toStationCode
          ).catch(() => {});

          setActiveLeg("return");
          updateData({ selectedSeatsReturn: selectedSeatsReturn.filter((s) => !returnFailed.includes(s.seatNumber)) });
          const refreshed = await fetchTripSeatMap(selectedReturnTrip.tripId, returnCodes);
          setSeatMapByLeg((prev) => ({ ...prev, return: refreshed?.seats || [] }));
          setSeatMapError(
            lang === "VN"
              ? `Ghế ${returnFailed.join(", ")} (chiều về) vừa được người khác giữ. Vui lòng chọn lại.`
              : `Seat(s) ${returnFailed.join(", ")} (return) were just taken by someone else. Please reselect.`
          );
          return;
        }
        returnExpiresAt = returnHold?.holdExpiresAt || null;
      }

      const expiries = [departureHold?.holdExpiresAt, returnExpiresAt]
        .filter(Boolean)
        .map((d) => new Date(d).getTime());
      const seatHoldExpiresAt = expiries.length ? new Date(Math.min(...expiries)).toISOString() : null;

      updateData({ seatHoldExpiresAt });
      onNext();
    } catch (error) {
      console.error("Lỗi khi giữ ghế:", error);
      setSeatMapError(
        lang === "VN" ? "Không thể giữ ghế đã chọn. Vui lòng thử lại." : "Unable to hold the selected seats. Please try again."
      );
    } finally {
      setIsConfirmingSeats(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* --- SUB-TABS CHUYỂN ĐỔI CHIỀU ĐI / CHIỀU VỀ (CHỈ HIỆN KHI ĐẶT KHỨ HỒI) --- */}
      {isRoundTrip && (
        <div className="flex justify-center border-b border-slate-200 dark:border-slate-700 max-w-md mx-auto gap-4 pb-0">
          <button
            type="button"
            onClick={() => setActiveLeg("departure")}
            className={`pb-3 text-sm font-headline font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 ${
              activeLeg === "departure" ? "border-[#124757] text-[#124757] dark:border-[#FFD100] dark:text-[#FFD100]" : "border-transparent text-slate-400"
            }`}
          >
            {lang === "VN" ? "1. Lựa chọn Chiều Đi" : "1. Departure Leg"}
            {selectedDepartureTrip && <span className="text-xs text-green-500">✓</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveLeg("return")}
            className={`pb-3 text-sm font-headline font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 ${
              activeLeg === "return" ? "border-[#124757] text-[#124757] dark:border-[#FFD100] dark:text-[#FFD100]" : "border-transparent text-slate-400"
            }`}
          >
            {lang === "VN" ? "2. Lựa chọn Chiều Về" : "2. Return Leg"}
            {selectedReturnTrip && <span className="text-xs text-green-500">✓</span>}
          </button>
        </div>
      )}

      {!isAuthenticated && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-3">
          <span className="material-symbols-outlined text-xl">lock</span>
          {lang === "VN" ? "Bạn cần đăng nhập trước khi chọn ghế và đặt vé." : "You need to sign in before selecting seats."}
        </div>
      )}

      {/* --- BỐ CỤC CHÍNH ĐƯỢC CHIA ĐÔI: TRÁI CHỌN TUYẾN - PHẢI CHỌN GHẾ --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* CỘT TRÁI (Tỷ lệ 5/12): DANH SÁCH CHUYẾN TÀU CHẠY TRONG NGÀY (dữ liệu thật từ API tìm chuyến) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm flex justify-between items-center">
            <h3 className="text-lg font-headline font-bold text-[#124757] dark:text-white flex items-center gap-2">
              {activeLeg === "departure"
                ? (lang === "VN" ? "Chuyến đi" : "Departure")
                : (lang === "VN" ? "Chuyến về" : "Return")}
            </h3>
            {/* Bộ lọc giờ nhanh */}
            <select value={filterTime} onChange={(e) => setFilterTime(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border text-xs font-bold rounded-lg p-2 outline-none">
              <option value="all">{lang === "VN" ? "Tất cả khung giờ" : "All times"}</option>
              <option value="morning">{lang === "VN" ? "Buổi sáng" : "Morning"}</option>
              <option value="afternoon">{lang === "VN" ? "Buổi chiều" : "Afternoon"}</option>
            </select>
          </div>

          <div className="space-y-3.5">
            {filteredTripOptions.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm font-medium bg-white dark:bg-slate-800 rounded-2xl border border-dashed">
                {lang === "VN" ? "Không có chuyến nào trong khung giờ này." : "No trips available for this time range."}
              </div>
            )}
            {filteredTripOptions.map((trip) => {
              const isSoldOut = trip.availableSeats <= 0 || trip.tripStatus !== "Scheduled";
              return (
                <div
                  key={trip.tripId}
                  onClick={() => handleSelectTrip(trip)}
                  className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm cursor-pointer transition-all ${
                    currentTrip?.tripId === trip.tripId
                      ? "border-[#124757] ring-2 ring-[#124757]/10 bg-teal-50/5"
                      : "border-slate-100 dark:border-slate-700 hover:border-slate-300"
                  } ${isSoldOut ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center gap-5">
                    <div className="text-2xl font-headline font-black text-[#124757] dark:text-white">{formatTripTime(getSegmentDeparture(trip))}</div>
                    <div>
                      <div className="font-bold text-sm text-slate-800 dark:text-white">{trip.routeName}</div>
                      <div className="text-xs text-slate-400">{lang === "VN" ? `Thời gian đi: ${formatTripDuration(getSegmentDeparture(trip), getSegmentArrival(trip))}` : `Duration: ${formatTripDuration(getSegmentDeparture(trip), getSegmentArrival(trip))}`}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto">
                    <div className="text-right">
                      <div className="text-base font-headline font-black text-[#124757] dark:text-[#FFD100]">{Number(trip.minPrice || 0).toLocaleString()} VND</div>
                      <div className="text-xs text-slate-500">
                        {isSoldOut
                          ? (lang === "VN" ? "Hết chỗ" : "Sold out")
                          : (lang === "VN" ? `Còn trống ${trip.availableSeats} chỗ` : `${trip.availableSeats} left`)}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      currentTrip?.tripId === trip.tripId ? "border-[#124757] dark:border-[#FFD100]" : "border-slate-300"
                    }`}>
                      {currentTrip?.tripId === trip.tripId && <div className="w-2.5 h-2.5 rounded-full bg-[#124757] dark:bg-[#FFD100]"></div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CỘT PHẢI (Tỷ lệ 7/12): SƠ ĐỒ GHẾ NGỒI DẠNG THÂN TÀU — cùng phong cách với trang Seat Layout Editor */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-700/50 space-y-5">
          <div className="border-b pb-4">
            <h4 className="font-headline font-bold text-base text-[#124757] dark:text-white">
              {lang === "VN" ? "Sơ đồ ghế ngồi" : "Seat Map"}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              {currentTrip
                ? (lang === "VN" ? `Đã chọn: ${currentSeats.length} ghế (tối đa ${MAX_SEATS_PER_LEG})` : `Selected: ${currentSeats.length} seats (max ${MAX_SEATS_PER_LEG})`)
                : (lang === "VN" ? "Vui lòng chọn một chuyến tàu ở bên trái trước" : "Please choose a voyage list first")}
            </p>
          </div>

          {seatMapError && (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-3">
              {seatMapError}
            </p>
          )}

          {isLoadingSeats ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
          ) : currentTrip ? (
            <div className="space-y-5 animate-fade-in">
              {/* Chú thích trạng thái ghế */}
              <div className="flex flex-wrap justify-center gap-4 text-[11px] font-bold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-6 w-5"><SeatMapIcon tone="standard" showLabel={false} /></span>
                  {lang === "VN" ? "Trống" : "Free"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-6 w-5"><SeatMapIcon tone="standard" selected showLabel={false} /></span>
                  {lang === "VN" ? "Đang chọn" : "Selected"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-6 w-5"><SeatMapIcon disabled showLabel={false} /></span>
                  {lang === "VN" ? "Đã khóa" : "Locked"}
                </div>
                {seatTypesInMap.map(([code]) => (
                  <div key={code} className="flex items-center gap-1.5">
                    <span className="inline-block h-6 w-5"><SeatMapIcon tone={seatToneFromCode(code)} showLabel={false} /></span>
                    {code}
                  </div>
                ))}
              </div>

              {deckLayout.length > 1 && (
                <div className="flex justify-center gap-2">
                  {deckLayout.map((deck) => (
                    <button
                      key={deck.deckNumber}
                      type="button"
                      onClick={() => setActiveDeckByLeg((prev) => ({ ...prev, [activeLeg]: deck.deckNumber }))}
                      className={`rounded-xl px-4 py-1.5 text-[10px] font-headline font-black uppercase tracking-widest transition ${
                        activeDeckNumber === deck.deckNumber
                          ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                          : "border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      }`}
                    >
                      {lang === "VN" ? `Tầng ${deck.deckNumber}` : `Deck ${deck.deckNumber}`}
                    </button>
                  ))}
                </div>
              )}

              {/* Mô phỏng thân tàu — cùng kiểu dáng với trang quản lý sơ đồ ghế (Seat Layout Editor) */}
              <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900 md:p-6">
                {activeDeckData && activeDeckData.seats.length > 0 ? (
                  <div className="flex flex-col items-center min-w-max mx-auto">
                    <div className={`relative flex min-w-max flex-col items-center overflow-visible rounded-t-[12rem] rounded-b-[3rem] border-8 border-slate-300 bg-slate-100 px-8 pb-10 shadow-xl dark:border-slate-600 dark:bg-slate-900/80 md:px-14 ${activeDeckData.deckNumber === 1 ? "pt-14" : "pt-8"}`}>
                      {activeDeckData.deckNumber === 1 ? (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2">
                          <BoatBowLabel lang={lang} />
                        </div>
                      ) : null}

                      <div
                        className="relative z-10 mx-auto grid gap-2 overflow-visible p-2 md:gap-2.5"
                        style={{
                          gridTemplateColumns: `repeat(${activeDeckData.columnCount}, minmax(40px, 48px))`,
                          gridTemplateRows: `repeat(${activeDeckData.rowCount}, minmax(44px, 52px))`,
                        }}
                      >
                        {activeDeckData.seats.map((seat) => {
                          const isSelected = currentSeats.some((s) => s.seatNumber === seat.seatNumber);
                          const isLockedByOthers = LOCKED_STATUSES.includes(seat.status) && !isSelected;
                          return (
                            <button
                              key={seat.seatNumber}
                              type="button"
                              disabled={isLockedByOthers}
                              onClick={() => handleSeatClick(seat)}
                              className={`relative z-1 flex items-center justify-center rounded-lg transition-all ${
                                isLockedByOthers ? "cursor-not-allowed opacity-70" :
                                isSelected ? "scale-95 ring-2 ring-[#124757]/25 dark:ring-yellow-400/40 rounded-xl" :
                                "hover:scale-105"
                              }`}
                              style={{ gridRow: rowLetterToIndex(seat.row), gridColumn: seat.column }}
                              title={`${seat.seatNumber} · ${seat.seatTypeName || seat.seatTypeCode} · ${Number(seat.basePrice || 0).toLocaleString()} VND`}
                            >
                              <SeatMapIcon
                                label={seat.seatNumber}
                                tone={seatToneFromCode(seat.seatTypeCode)}
                                disabled={isLockedByOthers}
                                selected={isSelected}
                                className="w-[92%] h-[92%]"
                              />
                            </button>
                          );
                        })}
                      </div>

                      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center opacity-60">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                          {lang === "VN" ? "Đuôi tàu" : "Stern"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-400 py-10">
                    {lang === "VN" ? "Chuyến này chưa có sơ đồ ghế." : "No seat map available for this trip."}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-2xl bg-slate-50/50 text-slate-400 text-xs gap-2">
              <p>{lang === "VN" ? "Vui lòng click chọn chuyến tàu mong muốn để hiển thị sơ đồ khoang ghế ngồi tương ứng." : "Please click on a voyage to unlock cabin layouts grid."}</p>
            </div>
          )}
        </div>

      </div>

      {roundTripSeatCountMismatch && (
        <p className="text-xs font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-3">
          {lang === "VN"
            ? `Số ghế chiều đi (${selectedSeatsDeparture.length}) và chiều về (${selectedSeatsReturn.length}) phải bằng nhau.`
            : `Departure seat count (${selectedSeatsDeparture.length}) and return seat count (${selectedSeatsReturn.length}) must match.`}
        </p>
      )}

      {/* --- NÚT ĐIỀU HƯỚNG CHUYỂN BƯỚC DƯỚI CÙNG --- */}
      <div className="pt-6 border-t flex justify-between">
        <button type="button" onClick={onBack} className="border px-6 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800">
          {lang === "VN" ? "Quay lại" : "Back"}
        </button>

        {/* Nút hỗ trợ chuyển tab phụ thông minh cho vé khứ hồi trước khi cho bấm sang bước checkout */}
        {isRoundTrip && activeLeg === "departure" && selectedDepartureTrip && selectedSeatsDeparture.length > 0 ? (
          <button
            type="button"
            onClick={() => setActiveLeg("return")}
            className="bg-[#124757] text-white font-headline font-bold px-8 py-3 rounded-xl text-sm shadow-md hover:opacity-90 transition-all flex items-center gap-2"
          >
            {lang === "VN" ? "Chọn tiếp Chuyến Về" : "Proceed to Return Leg"}
            <span className="material-symbols-outlined text-base">arrow_right_alt</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={!isStepComplete || isConfirmingSeats}
            onClick={handleContinueToCheckout}
            className="bg-[#124757] text-white font-headline font-bold px-8 py-3 rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isConfirmingSeats && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>}
            {isConfirmingSeats
              ? (lang === "VN" ? "Đang giữ ghế..." : "Holding seats...")
              : (lang === "VN" ? "Tiếp tục thanh toán" : "Continue to Checkout")}
          </button>
        )}
      </div>

    </div>
  );
}
