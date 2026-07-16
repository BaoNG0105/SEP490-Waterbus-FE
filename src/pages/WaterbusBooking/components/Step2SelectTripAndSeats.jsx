import { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { SeatMapIcon, seatToneFromCode } from "../../../components/SeatMapIcon";
import { fetchTripDetail, fetchTripSeatMap } from "../../../services/tripService";

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

export default function Step2SelectTripAndSeats({ bookingData, updateData, onNext, onBack }) {
  const { lang } = useApp();
  const {
    isRoundTrip, passengerCount,
    departureTripOptions, returnTripOptions,
    selectedDepartureTrip, selectedReturnTrip,
    selectedSeatsDeparture, selectedSeatsReturn
  } = bookingData;

  // Quản lý tab nội bộ của bước 2 nếu là khứ hồi: 'departure' (chiều đi) hoặc 'return' (chiều về)
  const [activeLeg, setActiveLeg] = useState("departure");
  const [filterTime, setFilterTime] = useState("all");

  // Sơ đồ ghế thực tế lấy từ API, lưu riêng theo từng chiều (departure/return)
  const [seatMapByLeg, setSeatMapByLeg] = useState({ departure: [], return: [] });
  const [isLoadingSeats, setIsLoadingSeats] = useState(false);
  const [seatMapError, setSeatMapError] = useState("");

  const tripOptions = activeLeg === "departure" ? departureTripOptions : returnTripOptions;
  const currentTrip = activeLeg === "departure" ? selectedDepartureTrip : selectedReturnTrip;
  const currentSeats = activeLeg === "departure" ? selectedSeatsDeparture : selectedSeatsReturn;
  const currentSeatMap = seatMapByLeg[activeLeg] || [];

  const filteredTripOptions = (tripOptions || []).filter((trip) => {
    if (filterTime === "all") return true;
    return getTripHourBucket(trip.departureTime) === filterTime;
  });

  // Khi người dùng chọn 1 chuyến: tải chi tiết chuyến (bến dừng) + sơ đồ ghế thực tế song song
  const handleSelectTrip = async (trip) => {
    if (trip.availableSeats <= 0 || trip.tripStatus !== "Scheduled") return;

    setSeatMapError("");
    setIsLoadingSeats(true);
    try {
      const [tripDetail, seatMapResponse] = await Promise.all([
        fetchTripDetail(trip.tripId),
        fetchTripSeatMap(trip.tripId),
      ]);

      const mergedTrip = { ...trip, stops: tripDetail?.stops || [] };
      setSeatMapByLeg((prev) => ({ ...prev, [activeLeg]: seatMapResponse?.seats || [] }));

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

  // Hàm xử lý tương tác click chọn ghế linh hoạt (chỉ cho phép chọn ghế còn trống - status "Available")
  const handleSeatClick = (seat, leg) => {
    const isSelected = (leg === "departure" ? selectedSeatsDeparture : selectedSeatsReturn)
      .some((s) => s.seatNumber === seat.seatNumber);

    if (seat.status !== "Available" && !isSelected) return;

    if (leg === "departure") {
      if (isSelected) {
        updateData({ selectedSeatsDeparture: selectedSeatsDeparture.filter((s) => s.seatNumber !== seat.seatNumber) });
      } else if (selectedSeatsDeparture.length < passengerCount) {
        updateData({ selectedSeatsDeparture: [...selectedSeatsDeparture, seat] });
      }
    } else {
      if (isSelected) {
        updateData({ selectedSeatsReturn: selectedSeatsReturn.filter((s) => s.seatNumber !== seat.seatNumber) });
      } else if (selectedSeatsReturn.length < passengerCount) {
        updateData({ selectedSeatsReturn: [...selectedSeatsReturn, seat] });
      }
    }
  };

  // Nhóm ghế theo hàng (row) rồi sắp xếp theo cột để dựng lưới sơ đồ khoang tàu
  const seatRows = currentSeatMap.reduce((rows, seat) => {
    const rowKey = seat.row || "-";
    if (!rows[rowKey]) rows[rowKey] = [];
    rows[rowKey].push(seat);
    return rows;
  }, {});
  Object.values(seatRows).forEach((row) => row.sort((a, b) => a.column - b.column));
  const sortedRowKeys = Object.keys(seatRows).sort();

  // Kiểm tra xem đã hoàn thành điều kiện để ấn nút "Tiếp tục" sang bước thanh toán chưa
  const isStepComplete = selectedDepartureTrip && selectedSeatsDeparture.length === passengerCount &&
    (!isRoundTrip || (selectedReturnTrip && selectedSeatsReturn.length === passengerCount));

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

      {/* --- BỐ CỤC CHÍNH ĐƯỢC CHIA ĐÔI: TRÁI CHỌN TUYẾN - PHẢI CHỌN GHẾ --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* CỘT TRÁI (Tỷ lệ 7/12): DANH SÁCH CHUYẾN TÀU CHẠY TRONG NGÀY (dữ liệu thật từ API tìm chuyến) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm flex justify-between items-center">
            <h3 className="text-lg font-headline font-bold text-[#124757] dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#124757] dark:text-[#FFD100]">sailing</span>
              {activeLeg === "departure"
                ? (lang === "VN" ? `Chuyến đi (${bookingData.departureDate})` : `Departure Voyage (${bookingData.departureDate})`)
                : (lang === "VN" ? `Chuyến về (${bookingData.returnDate})` : `Return Voyage (${bookingData.returnDate})`)}
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
                    <div className="text-2xl font-headline font-black text-[#124757] dark:text-white">{formatTripTime(trip.departureTime)}</div>
                    <div>
                      <div className="font-bold text-sm text-slate-800 dark:text-white">{trip.tripCode}</div>
                      <div className="text-xs text-slate-400">{lang === "VN" ? `Thời gian đi: ${formatTripDuration(trip.departureTime, trip.arrivalTime)}` : `Duration: ${formatTripDuration(trip.departureTime, trip.arrivalTime)}`}</div>
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

        {/* CỘT PHẢI (Tỷ lệ 5/12): SƠ ĐỒ GHẾ NGỒI (TỰ ĐỘNG ĐỔI THEO CHUYẾN ĐANG CHỌN, DỮ LIỆU THẬT TỪ API SEATS) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-6 rounded-2rem shadow-sm border border-slate-100 dark:border-slate-700/50 space-y-6">
          <div className="text-center border-b pb-4">
            <h4 className="font-headline font-bold text-base text-[#124757] dark:text-white">
              {lang === "VN" ? "Sơ đồ vị trí cabin chọn ghế" : "Cabin Seats Selection"}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              {currentTrip
                ? (lang === "VN" ? `Đã chọn: ${currentSeats.length}/${passengerCount} ghế` : `Picked: ${currentSeats.length}/${passengerCount} seats`)
                : (lang === "VN" ? "Vui lòng chọn một chuyến tàu ở bên trái trước" : "Please choose a voyage list first")}
            </p>
          </div>

          {seatMapError && (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-3">
              {seatMapError}
            </p>
          )}

          {isLoadingSeats ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
          ) : currentTrip ? (
            <div className="space-y-6 animate-fade-in">
              {/* Chú thích trạng thái ghế */}
              <div className="flex justify-center gap-4 text-[11px] font-bold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-6 w-5"><SeatMapIcon tone="cabin" showLabel={false} /></span>
                  {lang === "VN" ? "Trống" : "Free"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-6 w-5"><SeatMapIcon tone="cabin" selected showLabel={false} /></span>
                  {lang === "VN" ? "Đang chọn" : "Selected"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-6 w-5"><SeatMapIcon disabled showLabel={false} /></span>
                  {lang === "VN" ? "Đã khóa" : "Locked"}
                </div>
              </div>

              {/* Mô phỏng mô hình tàu */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border max-w-sm mx-auto">
                <div className="w-full bg-slate-200 dark:bg-slate-700 text-center py-1.5 rounded-lg text-[10px] font-bold uppercase text-slate-500 mb-6 tracking-wider">
                  {lang === "VN" ? "Hướng mũi tàu chạy" : "Front Heading"}
                </div>

                <div className="space-y-2.5">
                  {sortedRowKeys.length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-6">
                      {lang === "VN" ? "Chuyến này chưa có sơ đồ ghế." : "No seat map available for this trip."}
                    </p>
                  )}
                  {sortedRowKeys.map((rowKey) => (
                    <div key={rowKey} className="grid grid-cols-3 gap-1.5">
                      {seatRows[rowKey].map((seat) => {
                        const isBooked = seat.status !== "Available";
                        const isSelected = currentSeats.some((s) => s.seatNumber === seat.seatNumber);
                        return (
                          <button
                            key={seat.seatNumber}
                            type="button"
                            disabled={isBooked && !isSelected}
                            onClick={() => handleSeatClick(seat, activeLeg)}
                            className={`aspect-[48/52] p-0.5 rounded-lg transition-all ${
                              isBooked && !isSelected ? "cursor-not-allowed opacity-80" :
                              isSelected ? "scale-95 ring-2 ring-[#124757]/25 rounded-xl" :
                              "hover:scale-105"
                            }`}
                          >
                            <SeatMapIcon
                              label={seat.seatNumber}
                              tone={seatToneFromCode(seat.seatTypeCode)}
                              disabled={isBooked && !isSelected}
                              selected={isSelected}
                            />
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-2xl bg-slate-50/50 text-slate-400 text-xs gap-2">
              <span className="material-symbols-outlined text-3xl">event_seat</span>
              <p>{lang === "VN" ? "Vui lòng click chọn chuyến tàu mong muốn để hiển thị sơ đồ khoang ghế ngồi tương ứng." : "Please click on a voyage to unlock cabin layouts grid."}</p>
            </div>
          )}
        </div>

      </div>

      {/* --- NÚT ĐIỀU HƯỚNG CHUYỂN BƯỚC DƯỚI CÙNG --- */}
      <div className="pt-6 border-t flex justify-between">
        <button type="button" onClick={onBack} className="border px-6 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800">
          {lang === "VN" ? "Quay lại" : "Back"}
        </button>

        {/* Nút hỗ trợ chuyển tab phụ thông minh cho vé khứ hồi trước khi cho bấm sang bước checkout */}
        {isRoundTrip && activeLeg === "departure" && selectedDepartureTrip && selectedSeatsDeparture.length === passengerCount ? (
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
            disabled={!isStepComplete}
            onClick={onNext}
            className="bg-[#124757] text-white font-headline font-bold px-8 py-3 rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {lang === "VN" ? "Tiếp tục thanh toán" : "Continue to Checkout"}
          </button>
        )}
      </div>

    </div>
  );
}
