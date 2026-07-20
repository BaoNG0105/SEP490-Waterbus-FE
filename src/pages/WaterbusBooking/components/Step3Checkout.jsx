import { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { PayOSLogo, payosButtonLgClassName } from "../../../components/PayOSLogo";
import { submitBooking } from "../../../services/bookingService";
import { createBookingPayment } from "../../../services/paymentService";
import { releaseSeats } from "../../../services/tripService";
import { fetchCurrentUserProfile } from "../../../services/authService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { notify, showToast } from "../../../utils/swalToast";

const TICKET_TYPE_OPTIONS = [
  { value: "ADULT", labelVn: "Người lớn", labelEn: "Adult" },
  { value: "SENIOR", labelVn: "Người cao tuổi (miễn phí)", labelEn: "Senior (free)" },
  { value: "DISABLED", labelVn: "Người khuyết tật (miễn phí)", labelEn: "Disabled (free)" },
];

const formatTripTime = (isoString) => {
  if (!isoString) return "--";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

// Ưu tiên giờ theo đúng chặng khách đã chọn (fromStopScheduledDeparture) thay vì giờ khởi hành
// đầu tuyến (departureTime) — hai bến lên tàu khác nhau trên cùng chuyến sẽ có giờ khác nhau.
const getSegmentDeparture = (trip) => trip?.fromStopScheduledDeparture || trip?.departureTime;
const getSegmentArrival = (trip) => trip?.toStopScheduledArrival || trip?.arrivalTime;

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

// Tìm mã bến (stationCode) từ danh sách stops của chuyến, khớp theo stationId đã chọn ở Bước 1
const findStationCode = (stops, stationId) => {
  if (!Array.isArray(stops) || !stationId) return "";
  const stop = stops.find((s) => String(s.stationId) === String(stationId));
  return stop?.stationCode || "";
};

const formatCountdown = (msRemaining) => {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export default function Step3Checkout({ bookingData, onBack, onExpire }) {
  const { lang } = useApp();
  const {
    isRoundTrip,
    fromWharf,
    toWharf,
    routeType,
    fromWharfName,
    toWharfName,
    departureDate,
    returnDate,
    selectedDepartureTrip,
    selectedReturnTrip,
    selectedSeatsDeparture,
    selectedSeatsReturn,
    seatHoldExpiresAt
  } = bookingData;

  // Tuyến tham quan vòng (SightseeingLoop) không bán ghế theo chặng nên không bắt buộc phải tra
  // được stationCode theo cặp bến đi/đến như tuyến Regular.
  const isLoopRoute = routeType === "SightseeingLoop";

  // Đếm ngược thời gian giữ ghế (ghế đã được giữ ở Bước 2 khi bấm "Tiếp tục thanh toán")
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const holdRemainingMs = seatHoldExpiresAt ? new Date(seatHoldExpiresAt).getTime() - nowTick : 0;
  const isHoldExpired = Boolean(seatHoldExpiresAt) && holdRemainingMs <= 0;

  // Hết thời gian giữ ghế: báo cho khách và đẩy về lại Bước 1 để tìm chuyến từ đầu
  useEffect(() => {
    if (!isHoldExpired) return;
    notify({
      dialog: true,
      icon: "warning",
      tone: "warning",
      title: lang === "VN" ? "Hết thời gian giữ ghế" : "Seat hold expired",
      text: lang === "VN"
        ? "Đã quá thời gian giữ ghế. Vui lòng tìm chuyến và chọn lại từ đầu."
        : "The seat hold has expired. Please search and select your trip again.",
      confirmButtonText: "OK",
      allowOutsideClick: false,
      showCancelButton: false,
    }).then(() => {
      onExpire?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHoldExpired]);

  // Quay lại Bước 2: nhả toàn bộ ghế đang giữ để người khác có thể đặt
  const handleBack = () => {
    if (selectedDepartureTrip?.tripId && selectedSeatsDeparture.length) {
      const fromCode = findStationCode(selectedDepartureTrip.stops, fromWharf);
      const toCode = findStationCode(selectedDepartureTrip.stops, toWharf);
      releaseSeats(selectedDepartureTrip.tripId, selectedSeatsDeparture.map((s) => s.seatNumber), fromCode, toCode).catch(() => {});
    }
    if (isRoundTrip && selectedReturnTrip?.tripId && selectedSeatsReturn.length) {
      const fromCode = findStationCode(selectedReturnTrip.stops, toWharf);
      const toCode = findStationCode(selectedReturnTrip.stops, fromWharf);
      releaseSeats(selectedReturnTrip.tripId, selectedSeatsReturn.map((s) => s.seatNumber), fromCode, toCode).catch(() => {});
    }
    onBack();
  };

  // 1. STATE: THÔNG TIN LIÊN HỆ (Người đặt vé — dùng chung cho mọi hành khách có ghế)
  const [contact, setContact] = useState({
    name: "",
    phone: "",
    email: "",
    notes: ""
  });

  // 2. STATE: THÔNG TIN TỪNG HÀNH KHÁCH CÓ GHẾ (ADULT/SENIOR/DISABLED)
  // Phone/Email để trống sẽ dùng thông tin liên hệ chung; nhập riêng nếu muốn hành khách đó
  // nhận vé điện tử (QR) riêng về số/email của mình.
  const [passengers, setPassengers] = useState(
    Array.from({ length: selectedSeatsDeparture.length }, () => ({
      name: "",
      ticketType: "ADULT",
      phone: "",
      email: "",
    }))
  );

  const handlePassengerChange = (index, field, value) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  // Kéo tên/SĐT/email từ tài khoản đang đăng nhập xuống Thông tin liên hệ (người đặt)
  const [isLoadingAccountInfo, setIsLoadingAccountInfo] = useState(false);
  const handleUseAccountInfo = async () => {
    setIsLoadingAccountInfo(true);
    try {
      const profile = await fetchCurrentUserProfile();
      const accountName = profile?.fullName || profile?.name || "";
      const accountPhone = profile?.phoneNumber || profile?.phone || "";
      const accountEmail = profile?.email || "";

      setContact((prev) => ({
        ...prev,
        name: accountName || prev.name,
        phone: accountPhone || prev.phone,
        email: accountEmail || prev.email,
      }));
    } catch (error) {
      console.error("Lỗi khi lấy thông tin tài khoản:", error);
      showToast({
        icon: "error",
        title: lang === "VN" ? "Không lấy được thông tin tài khoản" : "Unable to load account info",
        text: lang === "VN" ? "Vui lòng nhập thông tin thủ công." : "Please enter the information manually.",
      });
    } finally {
      setIsLoadingAccountInfo(false);
    }
  };

  // Chiếu tên/SĐT/email từ Thông tin liên hệ (đã điền ở trên) xuống Hành khách 1
  const handleUseContactInfoForPassenger = (index) => {
    setPassengers((prev) => prev.map((passenger, i) => (
      i === index
        ? {
          ...passenger,
          name: contact.name || passenger.name,
          phone: contact.phone || passenger.phone,
          email: contact.email || passenger.email,
        }
        : passenger
    )));
  };

  // 3. STATE: HÀNH KHÁCH TRẺ EM DƯỚI 2 TUỔI (INFANT — không chiếm ghế, miễn phí, đi kèm chuyến của người lớn)
  const [infants, setInfants] = useState([]);

  const handleAddInfant = () => {
    setInfants((prev) => [...prev, { name: "", birthYear: "" }]);
  };

  const handleInfantChange = (index, field, value) => {
    setInfants((prev) => prev.map((inf, i) => (i === index ? { ...inf, [field]: value } : inf)));
  };

  const handleRemoveInfant = (index) => {
    setInfants((prev) => prev.filter((_, i) => i !== index));
  };

  // 4. STATE: MÃ GIẢM GIÁ & SUBMIT
  const [promoCode, setPromoCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Tổng số lượng ghế = Ghế chiều đi + Ghế chiều về (nếu có)
  const totalSeatsCount = isRoundTrip
    ? (selectedSeatsDeparture.length + selectedSeatsReturn.length)
    : selectedSeatsDeparture.length;

  // Ước tính giá vé: chỉ ADULT trả nguyên giá theo basePrice thật của ghế, SENIOR/DISABLED/INFANT miễn phí
  const sumSeatsPrice = (seats) => seats.reduce((sum, seat, i) => {
    const ticketType = passengers[i]?.ticketType || "ADULT";
    return sum + (ticketType === "ADULT" ? Number(seat.basePrice || 0) : 0);
  }, 0);
  const subtotal = sumSeatsPrice(selectedSeatsDeparture) + (isRoundTrip ? sumSeatsPrice(selectedSeatsReturn) : 0);

  const showError = (title, text) => {
    showToast({ icon: "warning", title, text });
  };

  const buildLegItems = (seats, fromStationCode, toStationCode) => [
    ...seats.map((seat, i) => ({
      seatNumber: seat.seatNumber,
      ticketTypeCode: passengers[i]?.ticketType || "ADULT",
      fromStationCode,
      toStationCode,
      passengerName: passengers[i]?.name.trim(),
      passengerPhone: (passengers[i]?.phone.trim() || contact.phone.trim()),
      passengerEmail: (passengers[i]?.email.trim() || contact.email.trim()),
    })),
    ...infants.map((infant) => ({
      seatNumber: null,
      ticketTypeCode: "INFANT",
      fromStationCode,
      toStationCode,
      passengerName: infant.name.trim(),
      birthYear: Number(infant.birthYear),
    })),
  ];

  const handlePayment = async () => {
    setSubmitError("");

    if (!contact.name.trim() || !contact.phone.trim() || !contact.email.trim()) {
      showError(
        lang === "VN" ? "Thiếu thông tin liên hệ" : "Missing contact information",
        lang === "VN" ? "Vui lòng nhập đầy đủ họ tên, số điện thoại và email liên hệ." : "Please fill in your full name, phone number and email."
      );
      return;
    }

    if (passengers.some((p) => !p.name.trim())) {
      showError(
        lang === "VN" ? "Thiếu thông tin hành khách" : "Missing passenger information",
        lang === "VN" ? "Vui lòng nhập họ tên cho tất cả hành khách có ghế." : "Please enter the full name for every seated passenger."
      );
      return;
    }

    if (infants.some((inf) => !inf.name.trim() || !inf.birthYear)) {
      showError(
        lang === "VN" ? "Thiếu thông tin em bé" : "Missing infant information",
        lang === "VN" ? "Vui lòng nhập họ tên và năm sinh cho tất cả em bé đi kèm." : "Please enter the name and birth year for every infant."
      );
      return;
    }

    const departureFromCode = findStationCode(selectedDepartureTrip?.stops, fromWharf);
    const departureToCode = findStationCode(selectedDepartureTrip?.stops, toWharf);
    if (!isLoopRoute && (!departureFromCode || !departureToCode)) {
      showError(
        lang === "VN" ? "Thiếu mã bến" : "Missing station code",
        lang === "VN" ? "Không xác định được mã bến của chuyến đi. Vui lòng quay lại chọn chuyến." : "Unable to resolve the departure trip's station codes. Please go back and reselect the trip."
      );
      return;
    }

    const payload = {
      tripCode: selectedDepartureTrip.tripCode,
      items: buildLegItems(selectedSeatsDeparture, departureFromCode || null, departureToCode || null),
      promotionCode: promoCode.trim() || null,
    };

    if (isRoundTrip) {
      const returnFromCode = findStationCode(selectedReturnTrip?.stops, toWharf);
      const returnToCode = findStationCode(selectedReturnTrip?.stops, fromWharf);
      if (!isLoopRoute && (!returnFromCode || !returnToCode)) {
        showError(
          lang === "VN" ? "Thiếu mã bến" : "Missing station code",
          lang === "VN" ? "Không xác định được mã bến của chuyến về. Vui lòng quay lại chọn chuyến." : "Unable to resolve the return trip's station codes. Please go back and reselect the trip."
        );
        return;
      }
      payload.returnTripCode = selectedReturnTrip.tripCode;
      payload.returnItems = buildLegItems(selectedSeatsReturn, returnFromCode, returnToCode);
    }

    setIsSubmitting(true);
    try {
      const booking = await submitBooking(payload);
      const bookingId = pick(booking, ["id", "bookingId", "data.id", "data.bookingId"]);
      if (!bookingId) {
        throw new Error("Booking created but no booking id was returned.");
      }

      const payment = await createBookingPayment({
        bookingId,
        paymentOption: "Full",
        promotionCode: promoCode.trim() || null,
      });
      const checkoutUrl = pick(payment, [
        "checkoutUrl", "paymentUrl", "paymentLink", "payUrl", "url",
        "data.checkoutUrl", "data.paymentUrl", "data.paymentLink", "data.payUrl", "data.url",
        "payment.checkoutUrl", "payment.paymentUrl",
        "data.payment.checkoutUrl", "data.payment.paymentUrl",
      ]);
      if (!checkoutUrl) {
        throw new Error("Payment created but no checkout URL was returned.");
      }

      // Ghi nhớ bookingId theo paymentId / orderCode để /payment/success nhận diện Waterbus
      // (không phải charter) và sync PayOS rồi về "Vé Waterbus của tôi".
      const paymentId = pick(payment, ["id", "paymentId", "data.id", "data.paymentId", "payment.id", "payment.paymentId"]);
      const orderCode = pick(payment, [
        "orderCode", "paymentOrderCode", "payosOrderCode",
        "data.orderCode", "data.paymentOrderCode", "data.payosOrderCode",
        "payment.orderCode", "data.payment.orderCode",
      ]);
      if (paymentId) {
        sessionStorage.setItem(`waterbusPaymentBooking:${paymentId}`, bookingId);
      }
      if (orderCode) {
        sessionStorage.setItem(`waterbusPaymentBookingOrder:${orderCode}`, bookingId);
        sessionStorage.setItem("latestWaterbusPaymentOrderCode", String(orderCode));
      }
      sessionStorage.setItem("latestWaterbusPaymentBooking", bookingId);

      window.location.assign(checkoutUrl);
    } catch (error) {
      console.error("Lỗi khi tạo booking/thanh toán:", error);
      setSubmitError(getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể tạo booking hoặc thanh toán. Vui lòng thử lại." : "Unable to create the booking or payment. Please try again."
      ));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

      {/* CỘT TRÁI (7/12) - CÁC FORM ĐIỀN THÔNG TIN */}
      <div className="lg:col-span-7 space-y-6">

        {/* 1. FORM THÔNG TIN LIÊN HỆ */}
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
            <h3 className="text-xl font-headline font-bold text-[#124757] dark:text-white">
              {lang === "VN" ? "Thông tin liên hệ (Người đặt)" : "Contact Details"}
            </h3>
            <button
              type="button"
              onClick={handleUseAccountInfo}
              disabled={isLoadingAccountInfo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#124757]/20 dark:border-yellow-400/20 bg-[#124757]/5 dark:bg-yellow-400/10 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 hover:bg-[#124757]/10 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-sm ${isLoadingAccountInfo ? "animate-spin" : ""}`}>
                {isLoadingAccountInfo ? "progress_activity" : "person"}
              </span>
              {lang === "VN" ? "Dùng thông tin tài khoản" : "Use account info"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">{lang === "VN" ? "Họ và tên *" : "Full Name *"}</label>
              <input type="text" placeholder="Nguyễn Văn A" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#124757] dark:focus:border-[#FFD100] rounded-xl px-4 py-3 text-sm w-full outline-none transition-colors" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">{lang === "VN" ? "Số điện thoại *" : "Phone Number *"}</label>
              <input type="tel" placeholder="0901234567" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#124757] dark:focus:border-[#FFD100] rounded-xl px-4 py-3 text-sm w-full outline-none transition-colors" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">{lang === "VN" ? "Địa chỉ Email *" : "Email Address *"}</label>
            <input type="email" placeholder="example@domain.com" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#124757] dark:focus:border-[#FFD100] rounded-xl px-4 py-3 text-sm w-full outline-none transition-colors" required />
            <p className="text-[11px] text-slate-400">
              {lang === "VN" ? "Vé điện tử (QR) sẽ được gửi về email này sau khi thanh toán." : "E-tickets (QR) will be sent to this email after payment."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">{lang === "VN" ? "Ghi chú (Không bắt buộc)" : "Notes (Optional)"}</label>
            <textarea
              rows="2"
              placeholder={lang === "VN" ? "Nhập yêu cầu đặc biệt nếu có..." : "Any special requests..."}
              value={contact.notes}
              onChange={(e) => setContact({ ...contact, notes: e.target.value })}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#124757] dark:focus:border-[#FFD100] rounded-xl px-4 py-3 text-sm w-full outline-none transition-colors resize-none"
            />
          </div>
        </div>

        {/* 2. FORM THÔNG TIN HÀNH KHÁCH CÓ GHẾ */}
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50 space-y-5">
          <h3 className="text-xl font-headline font-bold text-[#124757] dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
            {lang === "VN" ? "Thông tin hành khách" : "Passenger Informations"}
          </h3>

          <div className="space-y-5 max-h-500px overflow-y-auto pr-2 custom-scrollbar">
            {passengers.map((passenger, index) => (
              <div key={index} className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">

                {/* Header của thẻ hành khách hiển thị ghế tương ứng */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#124757] text-[#FFD100] w-8 h-8 rounded-full flex items-center justify-center font-headline font-black text-sm shadow-sm">
                      {index + 1}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className="font-headline font-bold text-[#124757] dark:text-white">
                        {lang === "VN" ? `Hành khách ${index + 1}` : `Passenger ${index + 1}`}
                      </span>
                      <div className="flex gap-2">
                        <span className="bg-white dark:bg-slate-800 border dark:border-slate-600 text-xs font-bold px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 shadow-sm">
                          Đi: {selectedSeatsDeparture[index]?.seatNumber}
                        </span>
                        {isRoundTrip && (
                          <span className="bg-white dark:bg-slate-800 border dark:border-slate-600 text-xs font-bold px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 shadow-sm">
                            Về: {selectedSeatsReturn[index]?.seatNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {index === 0 && (
                    <button
                      type="button"
                      onClick={() => handleUseContactInfoForPassenger(0)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#124757]/20 dark:border-yellow-400/20 bg-[#124757]/5 dark:bg-yellow-400/10 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 hover:bg-[#124757]/10"
                    >
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                      {lang === "VN" ? "Dùng thông tin liên hệ" : "Use contact info"}
                    </button>
                  )}
                </div>

                {/* Các trường điền thông tin */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Họ và tên *" : "Full Name *"}</label>
                    <input
                      type="text"
                      value={passenger.name}
                      onChange={(e) => handlePassengerChange(index, "name", e.target.value)}
                      placeholder={lang === "VN" ? "Nguyễn Văn A..." : "Enter full name..."}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]"
                      required
                    />
                  </div>

                  {!isLoopRoute && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Loại vé" : "Ticket Type"}</label>
                      <select
                        value={passenger.ticketType}
                        onChange={(e) => handlePassengerChange(index, "ticketType", e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]"
                      >
                        {TICKET_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {lang === "VN" ? option.labelVn : option.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Số điện thoại (Không bắt buộc)" : "Phone Number (Optional)"}</label>
                    <input
                      type="tel"
                      value={passenger.phone}
                      onChange={(e) => handlePassengerChange(index, "phone", e.target.value)}
                      placeholder={lang === "VN" ? "Để trống dùng SĐT liên hệ" : "Leave blank to use contact phone"}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Email (Không bắt buộc)" : "Email (Optional)"}</label>
                    <input
                      type="email"
                      value={passenger.email}
                      onChange={(e) => handlePassengerChange(index, "email", e.target.value)}
                      placeholder={lang === "VN" ? "Để trống dùng email liên hệ" : "Leave blank to use contact email"}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. HÀNH KHÁCH TRẺ EM DƯỚI 2 TUỔI (KHÔNG CHIẾM GHẾ, MIỄN PHÍ) */}
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <h3 className="text-xl font-headline font-bold text-[#124757] dark:text-white flex items-center gap-2">
              {lang === "VN" ? "Em bé dưới 2 tuổi (không tính ghế)" : "Infants under 2 (no seat)"}
            </h3>
            <button
              type="button"
              onClick={handleAddInfant}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#124757]/20 dark:border-yellow-400/20 bg-[#124757]/5 dark:bg-yellow-400/10 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 hover:bg-[#124757]/10"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              {lang === "VN" ? "Thêm em bé" : "Add infant"}
            </button>
          </div>

          {infants.length === 0 ? (
            <p className="text-xs text-slate-400">
              {lang === "VN" ? "Không có em bé đi kèm. Bấm \"Thêm em bé\" nếu có trẻ dưới 2 tuổi ngồi cùng người lớn." : "No infants added. Click \"Add infant\" if a child under 2 will sit with an adult."}
            </p>
          ) : (
            <div className="space-y-4">
              {infants.map((infant, index) => (
                <div key={index} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Họ và tên em bé *" : "Infant Full Name *"}</label>
                    <input
                      type="text"
                      value={infant.name}
                      onChange={(e) => handleInfantChange(index, "name", e.target.value)}
                      placeholder={lang === "VN" ? "Nhập tên em bé..." : "Enter infant's name..."}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]"
                    />
                  </div>
                  <div className="w-full sm:w-32 space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Năm sinh" : "Birth Year"}</label>
                    <input
                      type="number"
                      min="2020"
                      max={new Date().getFullYear()}
                      value={infant.birthYear}
                      onChange={(e) => handleInfantChange(index, "birthYear", e.target.value)}
                      placeholder="YYYY"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveInfant(index)}
                    className="shrink-0 w-10 h-10 rounded-xl border border-rose-200 dark:border-rose-500/30 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CỘT PHẢI (5/12) - BILL TÍNH HÓA ĐƠN & ĐẶT VÉ */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700/50 space-y-6 sticky top-28">
        <h3 className="text-xl font-headline font-bold text-[#124757] dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
          {lang === "VN" ? "Chi tiết hóa đơn" : "Invoice Summary"}
        </h3>

        {seatHoldExpiresAt && (
          <div className={`rounded-xl px-4 py-3 text-center border ${isHoldExpired ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80">
              {isHoldExpired
                ? (lang === "VN" ? "Ghế đã hết hạn giữ chỗ" : "Seat hold has expired")
                : (lang === "VN" ? "Ghế đang được giữ, hoàn tất trong" : "Seats held — complete checkout within")}
            </p>
            {!isHoldExpired && (
              <p className="font-headline font-black text-lg tabular-nums">{formatCountdown(holdRemainingMs)}</p>
            )}
            {isHoldExpired && (
              <p className="text-[11px] font-bold mt-1">
                {lang === "VN" ? "Vui lòng quay lại chọn ghế để giữ chỗ lại." : "Please go back and reselect seats to hold them again."}
              </p>
            )}
          </div>
        )}

        {/* Khung tóm tắt tuyến đi */}
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 text-[10px] font-bold uppercase px-2 py-1 rounded">
                {isLoopRoute
                  ? (lang === "VN" ? "Chuyến tham quan" : "Sightseeing Trip")
                  : (lang === "VN" ? "Chiều đi" : "Departure")}
              </span>
            </div>
            {isLoopRoute ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-xs font-bold uppercase text-slate-400 shrink-0">{lang === "VN" ? "Bến đón:" : "Pickup:"}</span>
                  <span className="font-headline font-black text-[#124757] dark:text-white">{(fromWharfName || "--").toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-xs font-bold uppercase text-slate-400 shrink-0">{lang === "VN" ? "Bến trả:" : "Drop-off:"}</span>
                  <span className="font-headline font-black text-[#124757] dark:text-white">{(toWharfName || "--").toUpperCase()}</span>
                </div>
              </div>
            ) : (
              <div className="font-headline font-black text-[#124757] dark:text-white flex items-center gap-2 text-lg">
                {(fromWharfName || "--").toUpperCase()}
                <span className="material-symbols-outlined text-sm text-[#FFD100]">arrow_forward</span>
                {(toWharfName || "--").toUpperCase()}
              </div>
            )}
            <div className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>{lang === "VN" ? "Giờ khởi hành:" : "Departure:"} <span className="text-[#124757] dark:text-[#FFD100]">{formatTripTime(getSegmentDeparture(selectedDepartureTrip))}</span></span>
              <span>{lang === "VN" ? "Giờ đến:" : "Arrival:"} <span className="text-[#124757] dark:text-[#FFD100]">{formatTripTime(getSegmentArrival(selectedDepartureTrip))}</span></span>
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">{departureDate}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">
              Ghế: {selectedSeatsDeparture.map((seat) => seat.seatNumber).join(", ")}
            </div>
          </div>

          {/* Chiều về (nếu có) */}
          {isRoundTrip && (
            <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <span className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-[10px] font-bold uppercase px-2 py-1 rounded">
                  {lang === "VN" ? "Chiều về" : "Return"}
                </span>
              </div>
              <div className="font-headline font-black text-[#124757] dark:text-white flex items-center gap-2 text-lg">
                {(toWharfName || "--").toUpperCase()}
                <span className="material-symbols-outlined text-sm text-[#FFD100]">arrow_forward</span>
                {(fromWharfName || "--").toUpperCase()}
              </div>
              <div className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>{lang === "VN" ? "Giờ khởi hành:" : "Departure:"} <span className="text-[#124757] dark:text-[#FFD100]">{formatTripTime(getSegmentDeparture(selectedReturnTrip))}</span></span>
                <span>{lang === "VN" ? "Giờ đến:" : "Arrival:"} <span className="text-[#124757] dark:text-[#FFD100]">{formatTripTime(getSegmentArrival(selectedReturnTrip))}</span></span>
              </div>
              <div className="text-xs text-slate-500 font-medium mt-1">{returnDate}</div>
              <div className="text-xs text-slate-500 font-medium mt-1">
                Ghế: {selectedSeatsReturn.map((seat) => seat.seatNumber).join(", ")}
              </div>
            </div>
          )}
        </div>

        {/* Nhập mã giảm giá */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{lang === "VN" ? "Mã ưu đãi (Promotion Code)" : "Discount Code"}</label>
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm uppercase outline-none tracking-widest font-black text-[#124757] dark:text-white"
          />
          <p className="text-[11px] text-slate-400">
            {lang === "VN" ? "Mã giảm giá (nếu có) sẽ được áp dụng khi tạo giao dịch thanh toán." : "Any discount code will be applied when the payment is created."}
          </p>
        </div>

        {/* Bảng giá chi tiết (ước tính) */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700 text-sm font-medium">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>{lang === "VN" ? "Tổng số lượng ghế" : "Total Seats Quantity"}</span>
            <span className="font-bold">x{totalSeatsCount}</span>
          </div>
          {infants.length > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>{lang === "VN" ? "Em bé (miễn phí)" : "Infants (free)"}</span>
              <span className="font-bold">x{infants.length}</span>
            </div>
          )}

          <div className="flex justify-between items-end pt-4 border-t border-dashed border-slate-300 dark:border-slate-600">
            <span className="font-headline font-bold text-base text-[#124757] dark:text-white">
              {lang === "VN" ? "Tạm tính:" : "Estimated total:"}
            </span>
            <span className="text-3xl font-headline font-black text-[#124757] dark:text-[#FFD100]">
              {subtotal.toLocaleString()} <span className="text-lg">VND</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {lang === "VN"
              ? "Số tiền cuối cùng (kèm mã khuyến mãi nếu có) sẽ hiển thị chính xác trên trang thanh toán PayOS."
              : "The final amount (with any discount applied) will be shown exactly on the PayOS checkout page."}
          </p>
        </div>

        {submitError && (
          <p className="text-xs font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-3">
            {submitError}
          </p>
        )}

        {/* Hành động */}
        <div className="pt-2 space-y-4">
          <button
            type="button"
            onClick={handlePayment}
            disabled={isSubmitting || isHoldExpired}
            className={payosButtonLgClassName}
          >
            {!isSubmitting && <PayOSLogo variant="white" className="h-6 w-auto" />}
            <span>
              {isSubmitting
                ? (lang === "VN" ? "Đang tạo giao dịch..." : "Creating payment...")
                : (lang === "VN" ? "Đặt vé & Thanh toán" : "Book & Pay Now")}
            </span>
          </button>
          <button
            type="button"
            onClick={handleBack}
            disabled={isSubmitting}
            className="w-full text-center text-xs font-bold text-slate-400 hover:text-[#124757] dark:hover:text-white transition-colors disabled:opacity-50"
          >
            {lang === "VN" ? "← Quay lại sửa chọn chuyến/ghế" : "← Back to seats selection"}
          </button>
        </div>

      </div>
    </div>
  );
}
