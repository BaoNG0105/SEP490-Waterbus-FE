import { useState } from "react";
import { useApp } from "../../../context/AppContext";

export default function Step2SelectTripAndSeats({ bookingData, updateData, onNext, onBack }) {
  const { lang } = useApp();
  const { 
    isRoundTrip, passengerCount, 
    selectedDepartureTrip, selectedReturnTrip, 
    selectedSeatsDeparture, selectedSeatsReturn 
  } = bookingData;

  // Quản lý tab nội bộ của bước 2 nếu là khứ hồi: 'departure' (chiều đi) hoặc 'return' (chiều về)
  const [activeLeg, setActiveLeg] = useState("departure");
  const [filterTime, setFilterTime] = useState("all");

  // Dữ liệu mẫu các chuyến tàu
  const sampleTrips = [
    { id: "trip-01", time: "07:30 AM", type: "Standard", price: 15000, available: 42, duration: "45 min" },
    { id: "trip-02", time: "09:00 AM", type: "Express", price: 15000, available: 15, duration: "35 min" },
    { id: "trip-03", time: "14:15 PM", type: "Standard", price: 15000, available: 50, duration: "45 min" },
    { id: "trip-04", time: "17:30 PM", type: "Express", price: 15000, available: 0, duration: "35 min" },
  ];

  // Sơ đồ ghế ngồi cố định
  const seatLayout = {
    leftRow: Array.from({ length: 15 }, (_, i) => `A${i + 1}`),
    rightRow: Array.from({ length: 15 }, (_, i) => `B${i + 1}`),
    bookedSeats: ["A3", "A4", "B10", "B11"] // Giả lập các ghế đã bị mua
  };

  // Hàm xử lý tương tác click chọn ghế linh hoạt
  const handleSeatClick = (seatCode, leg) => {
    if (seatLayout.bookedSeats.includes(seatCode)) return;

    if (leg === "departure") {
      if (selectedSeatsDeparture.includes(seatCode)) {
        updateData({ selectedSeatsDeparture: selectedSeatsDeparture.filter(s => s !== seatCode) });
      } else {
        if (selectedSeatsDeparture.length < passengerCount) {
          updateData({ selectedSeatsDeparture: [...selectedSeatsDeparture, seatCode] });
        }
      }
    } else {
      if (selectedSeatsReturn.includes(seatCode)) {
        updateData({ selectedSeatsReturn: selectedSeatsReturn.filter(s => s !== seatCode) });
      } else {
        if (selectedSeatsReturn.length < passengerCount) {
          updateData({ selectedSeatsReturn: [...selectedSeatsReturn, seatCode] });
        }
      }
    }
  };

  // Xác định chuyến tàu và danh sách ghế đang thao tác theo Tab
  const currentTrip = activeLeg === "departure" ? selectedDepartureTrip : selectedReturnTrip;
  const currentSeats = activeLeg === "departure" ? selectedSeatsDeparture : selectedSeatsReturn;

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
        
        {/* CỘT TRÁI (Tỷ lệ 7/12): DANH SÁCH CHUYẾN TÀU CHẠY TRONG NGÀY */}
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
            {sampleTrips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => {
                  if (trip.available === 0) return;
                  if (activeLeg === "departure") {
                    updateData({ selectedDepartureTrip: trip, selectedSeatsDeparture: [] }); // Reset ghế cũ nếu đổi chuyến
                  } else {
                    updateData({ selectedReturnTrip: trip, selectedSeatsReturn: [] });
                  }
                }}
                className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm cursor-pointer transition-all ${
                  currentTrip?.id === trip.id 
                    ? "border-[#124757] ring-2 ring-[#124757]/10 bg-teal-50/5" 
                    : "border-slate-100 dark:border-slate-700 hover:border-slate-300"
                } ${trip.available === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-5">
                  <div className="text-2xl font-headline font-black text-[#124757] dark:text-white">{trip.time}</div>
                  <div>
                    <div className="font-bold text-sm text-slate-800 dark:text-white">{trip.type} Vessel</div>
                    <div className="text-xs text-slate-400">{lang === "VN" ? `Thời gian đi: ${trip.duration}` : `Duration: ${trip.duration}`}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto">
                  <div className="text-right">
                    <div className="text-base font-headline font-black text-[#124757] dark:text-[#FFD100]">{trip.price.toLocaleString()} VND</div>
                    <div className="text-xs text-slate-500">{lang === "VN" ? `Còn trống ${trip.available} chỗ` : `${trip.available} left`}</div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    currentTrip?.id === trip.id ? "border-[#124757] dark:border-[#FFD100]" : "border-slate-300"
                  }`}>
                    {currentTrip?.id === trip.id && <div className="w-2.5 h-2.5 rounded-full bg-[#124757] dark:bg-[#FFD100]"></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CỘT PHẢI (Tỷ lệ 5/12): SƠ ĐỒ GHẾ NGỒI (TỰ ĐỘNG ĐỔI THEO CHUYẾN ĐANG CHỌN) */}
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

          {currentTrip ? (
            <div className="space-y-6 animate-fade-in">
              {/* Chú thích trạng thái ghế */}
              <div className="flex justify-center gap-4 text-[11px] font-bold text-slate-500">
                <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-slate-100 border"></div>Trống</div>
                <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-[#FFD100]"></div>Đang chọn</div>
                <div className="flex items-center gap-1.5"><div className="w-4 h-4 rounded bg-slate-300 dark:bg-slate-600"></div>Đã khóa</div>
              </div>

              {/* Mô phỏng mô hình tàu */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border max-w-sm mx-auto">
                <div className="w-full bg-slate-200 dark:bg-slate-700 text-center py-1.5 rounded-lg text-[10px] font-bold uppercase text-slate-500 mb-6 tracking-wider">
                  {lang === "VN" ? "Hướng mũi tàu chạy" : "Front Heading"}
                </div>

                <div className="grid grid-cols-2 gap-6 sm:gap-8">
                  {/* Hàng bên trái (A) */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {seatLayout.leftRow.map((seat) => {
                      const isBooked = seatLayout.bookedSeats.includes(seat);
                      const isSelected = currentSeats.includes(seat);
                      return (
                        <button
                          key={seat}
                          type="button"
                          disabled={isBooked}
                          onClick={() => handleSeatClick(seat, activeLeg)}
                          className={`aspect-square rounded-lg text-[10px] font-headline font-black border flex items-center justify-center transition-all ${
                            isBooked ? "bg-slate-300 text-slate-500 dark:bg-slate-600 dark:text-slate-500 cursor-not-allowed border-transparent" :
                            isSelected ? "bg-[#FFD100] text-[#124757] border-transparent font-black scale-95 ring-2 ring-[#124757]/20" :
                            "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          {seat}
                        </button>
                      );
                    })}
                  </div>

                  {/* Hàng bên phải (B) */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {seatLayout.rightRow.map((seat) => {
                      const isBooked = seatLayout.bookedSeats.includes(seat);
                      const isSelected = currentSeats.includes(seat);
                      return (
                        <button
                          key={seat}
                          type="button"
                          disabled={isBooked}
                          onClick={() => handleSeatClick(seat, activeLeg)}
                          className={`aspect-square rounded-lg text-[10px] font-headline font-black border flex items-center justify-center transition-all ${
                            isBooked ? "bg-slate-300 text-slate-500 dark:bg-slate-600 dark:text-slate-500 cursor-not-allowed border-transparent" :
                            isSelected ? "bg-[#FFD100] text-[#124757] border-transparent font-black scale-95 ring-2 ring-[#124757]/20" :
                            "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          {seat}
                        </button>
                      );
                    })}
                  </div>
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