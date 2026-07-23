import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { PayOSLogo, payosButtonLgClassName } from "../../../components/PayOSLogo";
import { submitBooking } from "../../../services/bookingService";
import { createBookingPayment } from "../../../services/paymentService";
import { fetchCurrentUserProfile } from "../../../services/authService";
import { fetchTicketTypes, DEFAULT_TICKET_TYPES } from "../../../services/ticketTypeService";
import { fetchMyPointBalance, fetchMyPoints, getMaxPointsToUse, estimateEarnPoints } from "../../../services/pointService";
import {
  fetchActiveInsurancePackages,
  findInsurancePackageById,
  getInsurancePackageId,
  isSameInsurancePackageId,
  INSURANCE_BOOKING_TYPES,
} from "../../../services/insuranceService";
import { calculateTicketInsurancePreview } from "../../../utils/insurancePreview";
import { getApiErrorMessage } from "../../../utils/apiError";
import { notify, showToast } from "../../../utils/swalToast";
import {
  formatFareAdjustmentLabel,
  formatSegmentDistanceLabel,
  pickSegmentDistanceKm,
} from "../../../utils/bookingFareMessages";
import {
  confirmLeaveCheckout,
  releaseHeldBookingSeats,
} from "../../../utils/bookingWizardGuard";

// Nhãn tiếng Việt/Anh quen thuộc cho các mã loại vé BE đang có; mã lạ thì dùng name từ BE.
const TICKET_TYPE_LABELS = {
  ADULT: { vn: "Người lớn", en: "Adult" },
  SENIOR: { vn: "Người cao tuổi", en: "Senior" },
  DISABLED: { vn: "Người khuyết tật", en: "Disabled" },
  INFANT: { vn: "Em bé dưới 2 tuổi", en: "Infant" },
};

const getTicketTypeLabel = (ticketType, lang) => {
  const base = TICKET_TYPE_LABELS[ticketType.code]?.[lang === "VN" ? "vn" : "en"] || ticketType.name;
  if (Number(ticketType.priceModifier) === 0) {
    return `${base} (${lang === "VN" ? "miễn phí" : "free"})`;
  }
  if (Number(ticketType.priceModifier) !== 1) {
    return `${base} (x${ticketType.priceModifier})`;
  }
  return base;
};

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

// Mã bến lấy từ catalog Step1 — không đọc stationCode trên trip.stops.

const formatCountdown = (msRemaining) => {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const formatHoldDeadline = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
};

export default function Step3Checkout({ bookingData, onBack, onExpire }) {
  const { lang } = useApp();
  const navigate = useNavigate();
  const {
    isRoundTrip,
    fromWharf,
    toWharf,
    routeType,
    fromWharfName,
    toWharfName,
    fromWharfCode,
    toWharfCode,
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

  // Quay lại Bước 2: hỏi xác nhận rồi nhả ghế đang giữ
  const handleBack = async () => {
    const ok = await confirmLeaveCheckout(lang);
    if (!ok) return;
    releaseHeldBookingSeats({
      isRoundTrip,
      fromWharf,
      toWharf,
      selectedDepartureTrip,
      selectedReturnTrip,
      selectedSeatsDeparture,
      selectedSeatsReturn,
    });
    onBack();
  };

  // 0. LOẠI VÉ TỪ BE (GET /api/ticket-types): code + priceModifier để preview giá.
  // INFANT không chiếm ghế nên không đưa vào dropdown hành khách có ghế.
  const [ticketTypes, setTicketTypes] = useState(DEFAULT_TICKET_TYPES);
  useEffect(() => {
    let cancelled = false;
    fetchTicketTypes().then((list) => {
      if (!cancelled) setTicketTypes(list);
    });
    return () => { cancelled = true; };
  }, []);
  const seatedTicketTypes = ticketTypes.filter((t) => t.code !== "INFANT");
  const getPriceModifier = (code) => {
    const found = ticketTypes.find((t) => t.code === String(code || "").toUpperCase());
    return found ? Number(found.priceModifier) : (String(code).toUpperCase() === "ADULT" ? 1 : 0);
  };

  // BE: allowedSeatTypeCodes = ["STANDARD"] nghĩa là loại vé đó chỉ ngồi được ghế Standard
  // (SENIOR/DISABLED/INFANT); null = mọi loại ghế. Khứ hồi thì cả ghế đi lẫn ghế về phải hợp lệ.
  const isTicketTypeAllowedForPassenger = (ticketType, passengerIndex) => {
    if (!Array.isArray(ticketType.allowedSeatTypeCodes)) return true;
    const seats = [
      selectedSeatsDeparture[passengerIndex],
      ...(isRoundTrip ? [selectedSeatsReturn[passengerIndex]] : []),
    ];
    return seats.every((seat) => {
      const seatTypeCode = String(seat?.seatTypeCode || "").toUpperCase();
      if (!seatTypeCode) return true; // BE không gửi seatTypeCode thì để BE tự chặn khi tạo booking
      return ticketType.allowedSeatTypeCodes.includes(seatTypeCode);
    });
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

  // 4. STATE: MÃ GIẢM GIÁ, ĐIỂM TÍCH LŨY, BẢO HIỂM & SUBMIT
  const [promoCode, setPromoCode] = useState("");
  const [pointBalance, setPointBalance] = useState(0);
  const [pointsToUseInput, setPointsToUseInput] = useState("");
  const [insurancePackages, setInsurancePackages] = useState([]);
  const [selectedInsurancePackageId, setSelectedInsurancePackageId] = useState(null);
  const [isInsuranceDetailsOpen, setIsInsuranceDetailsOpen] = useState(false);
  const lastInsurancePackageIdRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchMyPointBalance().then((balance) => {
      if (!cancelled) setPointBalance(balance);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchActiveInsurancePackages(INSURANCE_BOOKING_TYPES.SEAT)
      .then((packages) => {
        if (cancelled) return;
        setInsurancePackages(packages);
        setSelectedInsurancePackageId((currentId) => {
          if (currentId && packages.some((pkg) => isSameInsurancePackageId(getInsurancePackageId(pkg), currentId))) {
            lastInsurancePackageIdRef.current = String(currentId);
            return currentId;
          }
          const required = packages.find((pkg) => pkg.isRequired);
          const defaultPkg = required || packages[0];
          const defaultId = getInsurancePackageId(defaultPkg);
          if (defaultId) lastInsurancePackageIdRef.current = defaultId;
          return defaultId;
        });
      })
      .catch(() => {
        if (!cancelled) setInsurancePackages([]);
      });
    return () => { cancelled = true; };
  }, []);

  // Tổng số lượng ghế = Ghế chiều đi + Ghế chiều về (nếu có)
  const totalSeatsCount = isRoundTrip
    ? (selectedSeatsDeparture.length + selectedSeatsReturn.length)
    : selectedSeatsDeparture.length;

  // Phí BH theo số khách (ghế chiều đi + em bé) — không nhân đôi chiều về.
  const insurancePassengerCount = selectedSeatsDeparture.length + infants.length;
  const selectedInsurancePackage = selectedInsurancePackageId
    ? findInsurancePackageById(insurancePackages, selectedInsurancePackageId)
    : null;
  const insurancePreview = selectedInsurancePackage
    ? calculateTicketInsurancePreview({
      unitPremiumAmount: selectedInsurancePackage.unitPremiumAmount,
      passengerCount: insurancePassengerCount,
    })
    : { canPreview: false, quantity: 0, unitPremium: 0, total: 0 };
  const insuranceFee = selectedInsurancePackageId ? Number(insurancePreview.total) || 0 : 0;
  const insuranceRequired = insurancePackages.some((pkg) => pkg.isRequired);

  // Ước tính giá vé theo contract BE: finalPrice = seat.basePrice * ticketType.priceModifier
  // (hiện tại ADULT x1, SENIOR/DISABLED/INFANT x0). Giá chuẩn cuối cùng vẫn do BE chốt sau POST /bookings.
  const sumSeatsPrice = (seats) => seats.reduce((sum, seat, i) => {
    const modifier = getPriceModifier(passengers[i]?.ticketType || "ADULT");
    return sum + Number(seat.basePrice || 0) * modifier;
  }, 0);
  const subtotal = sumSeatsPrice(selectedSeatsDeparture) + (isRoundTrip ? sumSeatsPrice(selectedSeatsReturn) : 0);
  const estimatedOrderAmount = subtotal + insuranceFee;

  // BE: maxPointsToUse = min(pointBalance, floor(orderAmount * 0.5)); 1 điểm = 1 VND
  const maxPointsToUse = getMaxPointsToUse(pointBalance, estimatedOrderAmount);
  const pointsToUse = (() => {
    const raw = Math.floor(Number(pointsToUseInput) || 0);
    if (raw <= 0) return 0;
    return Math.min(raw, maxPointsToUse);
  })();
  const estimatedPayable = Math.max(0, estimatedOrderAmount - pointsToUse);
  const estimatedEarn = estimateEarnPoints(estimatedPayable);
  const isFreeBookingEstimate = estimatedPayable === 0;

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

    const departureFromCode = fromWharfCode || "";
    const departureToCode = toWharfCode || "";
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
      insuranceSelected: Boolean(selectedInsurancePackageId),
      insurancePackageId: selectedInsurancePackageId || null,
    };

    if (isRoundTrip) {
      const returnFromCode = toWharfCode || "";
      const returnToCode = fromWharfCode || "";
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

      // holdExpiresAt do BE tính (min(+15p, giờ đi - 10p)) — không hardcode trên FE.
      const bookingHoldExpiresAt = pick(booking, [
        "holdExpiresAt", "data.holdExpiresAt", "booking.holdExpiresAt", "data.booking.holdExpiresAt",
      ]);
      if (bookingHoldExpiresAt) {
        // Cập nhật mốc giữ chỗ theo booking (có thể ngắn hơn hold ghế ở bước 2).
        // updateData không có trong Step3 — lưu session để payment/detail dùng nếu cần.
        sessionStorage.setItem(`bookingHoldExpiresAt:${bookingId}`, String(bookingHoldExpiresAt));
      }

      // Giá chốt: luôn lấy subtotalAmount / totalAmount từ booking response (không tự khóa tổng trên FE).
      const bookingTotalRaw = pick(booking, ["totalAmount", "data.totalAmount"], null);
      const bookingSubtotalRaw = pick(booking, ["subtotalAmount", "data.subtotalAmount"], null);
      const bookingTotal = Number(bookingTotalRaw);
      const orderAmount = Number.isFinite(bookingTotal)
        ? bookingTotal
        : (Number(bookingSubtotalRaw) || estimatedOrderAmount);
      const cappedPoints = getMaxPointsToUse(pointBalance, orderAmount);
      const pointsForPayment = Math.min(pointsToUse, cappedPoints);

      const paymentServiceType = isLoopRoute ? "Sightseeing" : "Waterbus";
      const myTicketsPath = isLoopRoute
        ? "/profile/my-sightseeing-booking"
        : "/profile/my-waterbus-booking";

      const finishFreeBooking = async () => {
        sessionStorage.setItem("latestWaterbusPaymentBooking", bookingId);
        sessionStorage.setItem("latestTicketPaymentService", paymentServiceType);
        fetchMyPoints({ page: 1, pageSize: 1 }).catch(() => {});
        await notify({
          dialog: true,
          icon: "success",
          title: lang === "VN" ? "Đặt vé thành công" : "Booking confirmed",
          text: lang === "VN"
            ? "Vé đã được xác nhận. Bạn có thể xem vé điện tử trong mục đặt chỗ của mình."
            : "Your booking is confirmed. You can view the e-ticket in My Bookings.",
          confirmButtonText: lang === "VN" ? "Xem vé của tôi" : "View my tickets",
          allowOutsideClick: false,
          showCancelButton: false,
        });
        navigate(`${myTicketsPath}?highlightBookingId=${encodeURIComponent(bookingId)}`, {
          replace: true,
          state: { highlightBookingId: bookingId, paymentOutcome: "success", freeTicket: true },
        });
      };

      // totalAmount === 0 sau tạo booking → hoàn tất, không gọi PayOS / create payment.
      if (orderAmount === 0) {
        await finishFreeBooking();
        return;
      }

      const payment = await createBookingPayment({
        bookingId,
        paymentOption: "Full",
        promotionCode: promoCode.trim() || null,
        pointsToUse: pointsForPayment > 0 ? pointsForPayment : 0,
      });
      const checkoutUrl = pick(payment, [
        "checkoutUrl", "paymentUrl", "paymentLink", "payUrl", "url",
        "data.checkoutUrl", "data.paymentUrl", "data.paymentLink", "data.payUrl", "data.url",
        "payment.checkoutUrl", "payment.paymentUrl",
        "data.payment.checkoutUrl", "data.payment.paymentUrl",
      ]);
      const paymentExpiresAt = pick(payment, [
        "expiresAt", "data.expiresAt", "payment.expiresAt", "data.payment.expiresAt",
      ]);
      const paymentBookingHoldExpiresAt = pick(payment, [
        "bookingHoldExpiresAt", "data.bookingHoldExpiresAt",
        "payment.bookingHoldExpiresAt", "data.payment.bookingHoldExpiresAt",
      ]);
      if (paymentExpiresAt) {
        sessionStorage.setItem(`paymentExpiresAt:${bookingId}`, String(paymentExpiresAt));
      }
      if (paymentBookingHoldExpiresAt) {
        sessionStorage.setItem(`bookingHoldExpiresAt:${bookingId}`, String(paymentBookingHoldExpiresAt));
      }
      const paymentStatus = String(pick(payment, [
        "paymentStatus", "status", "data.paymentStatus", "data.status",
        "payment.paymentStatus", "data.payment.paymentStatus",
      ], "")).trim();
      const paymentAmount = Number(pick(payment, [
        "amount", "totalAmount", "payableAmount",
        "data.amount", "data.totalAmount", "data.payableAmount",
      ], NaN));

      // Điểm/promo về 0đ: Paid + không checkoutUrl → không sang PayOS.
      const isFreePaid = !checkoutUrl && (
        paymentStatus.toLowerCase() === "paid"
        || paymentAmount === 0
      );
      if (isFreePaid) {
        await finishFreeBooking();
        return;
      }

      if (!checkoutUrl) {
        throw new Error("Payment created but no checkout URL was returned.");
      }

      // Ghi nhớ bookingId + loại dịch vụ để /payment/* điều hướng đúng Waterbus / Sightseeing.
      const paymentId = pick(payment, ["id", "paymentId", "data.id", "data.paymentId", "payment.id", "payment.paymentId"]);
      const orderCode = pick(payment, [
        "orderCode", "paymentOrderCode", "payosOrderCode",
        "data.orderCode", "data.paymentOrderCode", "data.payosOrderCode",
        "payment.orderCode", "data.payment.orderCode",
      ]);
      if (paymentId) {
        sessionStorage.setItem(`waterbusPaymentBooking:${paymentId}`, bookingId);
        sessionStorage.setItem(`ticketPaymentService:${paymentId}`, paymentServiceType);
      }
      if (orderCode) {
        sessionStorage.setItem(`waterbusPaymentBookingOrder:${orderCode}`, bookingId);
        sessionStorage.setItem(`ticketPaymentServiceOrder:${orderCode}`, paymentServiceType);
        sessionStorage.setItem("latestWaterbusPaymentOrderCode", String(orderCode));
      }
      sessionStorage.setItem("latestWaterbusPaymentBooking", bookingId);
      sessionStorage.setItem("latestTicketPaymentService", paymentServiceType);

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
                        {seatedTicketTypes.map((option) => (
                          <option
                            key={option.code}
                            value={option.code}
                            disabled={!isTicketTypeAllowedForPassenger(option, index)}
                          >
                            {getTicketTypeLabel(option, lang)}
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

        {/* 3. HÀNH KHÁCH TRẺ EM DƯỚI 2 TUỔI (KHÔNG CHIẾM GHẾ, MIỄN PHÍ)
            BE: vé INFANT chỉ áp dụng waterbus thường, không áp dụng sightseeing → ẩn với tuyến vòng */}
        {!isLoopRoute && (
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
        )}
      </div>

      {/* CỘT PHẢI (5/12) - BILL TÍNH HÓA ĐƠN & ĐẶT VÉ */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700/50 space-y-6 sticky top-28">
        <h3 className="text-xl font-headline font-bold text-[#124757] dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3 flex items-center gap-2">
          {lang === "VN" ? "Chi tiết hóa đơn" : "Invoice Summary"}
        </h3>

        {seatHoldExpiresAt && (
          <div className={`rounded-xl px-4 py-3 border ${isHoldExpired ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"}`}>
            {isHoldExpired ? (
              <>
                <p className="text-xs font-black uppercase tracking-wide">
                  {lang === "VN" ? "Ghế đã hết hạn giữ chỗ" : "Seat hold has expired"}
                </p>
                <p className="mt-1 text-[11px] font-bold">
                  {lang === "VN" ? "Vui lòng quay lại chọn ghế để giữ chỗ lại." : "Please go back and reselect seats to hold them again."}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold">
                  {lang === "VN" ? "Giữ chỗ đến" : "Held until"}{" "}
                  <span className="font-black">{formatHoldDeadline(seatHoldExpiresAt)}</span>
                </p>
                <p className="mt-1 font-headline text-lg font-black tabular-nums">
                  {formatCountdown(holdRemainingMs)}
                </p>
                <p className="mt-1 text-[10px] font-medium opacity-80">
                  {lang === "VN"
                    ? "Thời gian giữ chỗ có thể ngắn hơn nếu gần giờ tàu chạy."
                    : "Hold time may be shorter when departure is near."}
                </p>
              </>
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
            {!isLoopRoute && (
              <div className="text-xs font-bold text-slate-500 mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                <span>{formatSegmentDistanceLabel(pickSegmentDistanceKm(selectedDepartureTrip), lang)}</span>
                {formatFareAdjustmentLabel(selectedDepartureTrip?.fareAdjustment, lang) ? (
                  <span className="text-amber-700 dark:text-amber-300">
                    {formatFareAdjustmentLabel(selectedDepartureTrip?.fareAdjustment, lang)}
                  </span>
                ) : null}
              </div>
            )}
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
              <div className="text-xs font-bold text-slate-500 mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                <span>{formatSegmentDistanceLabel(pickSegmentDistanceKm(selectedReturnTrip), lang)}</span>
                {formatFareAdjustmentLabel(selectedReturnTrip?.fareAdjustment, lang) ? (
                  <span className="text-amber-700 dark:text-amber-300">
                    {formatFareAdjustmentLabel(selectedReturnTrip?.fareAdjustment, lang)}
                  </span>
                ) : null}
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

        {/* Bảo hiểm hành khách (SeatBooking) */}
        {insurancePackages.length > 0 && (() => {
          const wantsInsurance = selectedInsurancePackageId != null;
          const displayPackage = selectedInsurancePackage || insurancePackages[0];
          const providerName = displayPackage?.providerName || "";
          const providerLogoUrl = displayPackage?.providerLogoUrl || "";
          const formatVnd = (value) => `${(Number(value) || 0).toLocaleString("vi-VN")}đ`;

          const handleInsuranceToggle = (enabled) => {
            if (insuranceRequired && !enabled) return;
            if (enabled) {
              const restoreId = lastInsurancePackageIdRef.current || getInsurancePackageId(insurancePackages[0]);
              setSelectedInsurancePackageId(restoreId);
              return;
            }
            if (selectedInsurancePackageId != null) {
              lastInsurancePackageIdRef.current = String(selectedInsurancePackageId);
            }
            setSelectedInsurancePackageId(null);
          };

          const handleSelectPackage = (pkg) => {
            const packageId = getInsurancePackageId(pkg);
            lastInsurancePackageIdRef.current = packageId;
            setSelectedInsurancePackageId(packageId);
          };

          const handleShowTerms = () => {
            const pkg = displayPackage;
            if (!pkg) return;
            const escapeHtml = (value) => String(value ?? "")
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;")
              .replaceAll('"', "&quot;")
              .replaceAll("'", "&#39;");
            const conditions = (Array.isArray(pkg.conditions) ? pkg.conditions : [])
              .map((item) => String(item || "").trim())
              .filter(Boolean);
            const name = pkg.providerName || (lang === "VN" ? "Nhà cung cấp bảo hiểm" : "Insurance provider");
            const logoHtml = pkg.providerLogoUrl
              ? `<img src="${escapeHtml(pkg.providerLogoUrl)}" alt="${escapeHtml(name)}" style="width:72px;height:72px;object-fit:contain;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;padding:8px;margin:0 auto 12px;" />`
              : "";
            const conditionsHtml = conditions.length > 0
              ? `<ul style="text-align:left;margin:12px 0 0;padding-left:18px;color:#64748b;font-size:12px;line-height:1.7;">${conditions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
              : `<p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">${lang === "VN" ? "Chưa có điều kiện chi tiết trên hệ thống." : "No detailed conditions on file."}</p>`;
            const termsHtml = pkg.termsUrl
              ? `<a href="${escapeHtml(pkg.termsUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;margin-top:16px;padding:10px 14px;border-radius:12px;background:#124757;color:#fff;font-weight:800;font-size:12px;text-decoration:none;">${lang === "VN" ? "Mở điều khoản đầy đủ" : "Open full terms"}</a>`
              : `<p style="margin:14px 0 0;color:#94a3b8;font-size:12px;">${lang === "VN" ? "Chưa có link điều khoản." : "No terms link available."}</p>`;

            notify({
              dialog: true,
              title: lang === "VN" ? "Điều khoản bảo hiểm" : "Insurance terms",
              html: `
                ${logoHtml}
                <p style="margin:0;font-weight:800;color:#124757;font-size:15px;">${escapeHtml(name)}</p>
                <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;font-weight:700;">${escapeHtml(pkg.name || "")}</p>
                <p style="margin:14px 0 0;text-align:left;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">${lang === "VN" ? "Điều kiện áp dụng" : "Applicable conditions"}</p>
                ${conditionsHtml}
                ${termsHtml}
              `,
              confirmButtonText: lang === "VN" ? "Đóng" : "Close",
              showCancelButton: false,
            });
          };

          return (
            <div className={`rounded-2xl border overflow-hidden transition-colors ${
              wantsInsurance
                ? "bg-white dark:bg-slate-900 border-[#124757]/40 dark:border-yellow-400/40"
                : "bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700"
            }`}>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setIsInsuranceDetailsOpen((open) => !open)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-expanded={isInsuranceDetailsOpen}
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${
                    providerLogoUrl
                      ? "bg-white p-1.5 ring-1 ring-slate-200/80 dark:ring-slate-200"
                      : "bg-gradient-to-br from-[#124757] to-[#0d3541] text-white dark:from-yellow-400 dark:to-yellow-300 dark:text-slate-900"
                  }`}>
                    {providerLogoUrl ? (
                      <img src={providerLogoUrl} alt={providerName || "Insurance"} className="h-full w-full object-contain" />
                    ) : (
                      <span className="material-symbols-outlined text-xl">verified_user</span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                      {lang === "VN" ? "Bảo hiểm hành khách" : "Passenger insurance"}
                    </span>
                    <span className="block truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                      {wantsInsurance && selectedInsurancePackage
                        ? selectedInsurancePackage.name
                        : (lang === "VN" ? "Không chọn bảo hiểm" : "No insurance")}
                    </span>
                  </span>
                  <span className={`material-symbols-outlined shrink-0 text-xl text-slate-400 transition-transform ${isInsuranceDetailsOpen ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={wantsInsurance}
                  disabled={insuranceRequired}
                  onClick={() => handleInsuranceToggle(!wantsInsurance)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                    wantsInsurance ? "bg-[#124757] dark:bg-yellow-400" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                  title={insuranceRequired
                    ? (lang === "VN" ? "Gói bắt buộc" : "Required package")
                    : undefined}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    wantsInsurance ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {isInsuranceDetailsOpen && (
                <div className="space-y-3 border-t border-slate-100 px-4 py-3 dark:border-slate-700">
                  {wantsInsurance && insurancePackages.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {insurancePackages.map((pkg) => {
                        const packageId = getInsurancePackageId(pkg);
                        const isSelected = isSameInsurancePackageId(selectedInsurancePackageId, packageId);
                        return (
                          <button
                            key={packageId}
                            type="button"
                            onClick={() => handleSelectPackage(pkg)}
                            className={`rounded-xl border px-3 py-2 text-left text-[11px] font-bold transition ${
                              isSelected
                                ? "border-[#124757] bg-[#124757]/8 text-[#124757] dark:border-yellow-400 dark:bg-yellow-400/10 dark:text-yellow-400"
                                : "border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            <span className="block font-headline font-black uppercase tracking-wide">{pkg.name || pkg.code}</span>
                            <span className="mt-0.5 block text-slate-400">{formatVnd(pkg.unitPremiumAmount)}/{lang === "VN" ? "khách" : "pax"}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {wantsInsurance && selectedInsurancePackage ? (
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs dark:bg-slate-800/80">
                      <div className="flex justify-between gap-3 font-medium text-slate-600 dark:text-slate-300">
                        <span>
                          {formatVnd(insurancePreview.unitPremium)}/{lang === "VN" ? "khách" : "pax"}
                          {" × "}
                          {insurancePreview.quantity} {lang === "VN" ? "khách" : "passengers"}
                        </span>
                        <span className="font-black text-[#124757] dark:text-yellow-400">{formatVnd(insuranceFee)}</span>
                      </div>
                      {Number(selectedInsurancePackage.coverageAmount) > 0 && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          {lang === "VN" ? "Mức BH" : "Coverage"}: {formatVnd(selectedInsurancePackage.coverageAmount)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {lang === "VN"
                        ? "Bật bảo hiểm để cộng phí theo số khách khi thanh toán."
                        : "Enable insurance to add a per-passenger fee at checkout."}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleShowTerms}
                    className="text-[11px] font-bold uppercase tracking-wider text-[#124757] underline-offset-2 hover:underline dark:text-yellow-400"
                  >
                    {lang === "VN" ? "Xem điều khoản" : "View terms"}
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Dùng điểm tích lũy — BE cho tối đa 50% giá trị đơn; 1 điểm = 1 VND */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {lang === "VN" ? "Dùng điểm tích lũy" : "Use loyalty points"}
            </label>
            <span className="text-[11px] font-bold text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Số dư:" : "Balance:"} {pointBalance.toLocaleString()}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={maxPointsToUse}
              step={1}
              value={pointsToUseInput}
              onChange={(e) => setPointsToUseInput(e.target.value)}
              placeholder="0"
              disabled={maxPointsToUse <= 0}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none font-black text-[#124757] dark:text-white disabled:opacity-50"
            />
            <button
              type="button"
              disabled={maxPointsToUse <= 0}
              onClick={() => setPointsToUseInput(String(maxPointsToUse))}
              className="shrink-0 rounded-xl border border-[#124757]/20 dark:border-yellow-400/20 bg-[#124757]/5 dark:bg-yellow-400/10 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 disabled:opacity-50"
            >
              {lang === "VN" ? "Tối đa" : "Max"}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            {lang === "VN"
              ? `Tối đa ${maxPointsToUse.toLocaleString()} điểm (≤ 50% tạm tính). 1 điểm = 1 VND.`
              : `Max ${maxPointsToUse.toLocaleString()} points (≤ 50% of estimate). 1 point = 1 VND.`}
          </p>
        </div>

        {/* Bảng giá chi tiết (ước tính) */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700 text-sm font-medium">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>{lang === "VN" ? "Tổng số lượng ghế" : "Total Seats Quantity"}</span>
            <span className="font-bold">x{totalSeatsCount}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>{lang === "VN" ? "Giá vé (ước tính)" : "Ticket fare (est.)"}</span>
            <span className="font-bold">{subtotal.toLocaleString()}đ</span>
          </div>
          {infants.length > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>{lang === "VN" ? "Em bé (miễn phí)" : "Infants (free)"}</span>
              <span className="font-bold">x{infants.length}</span>
            </div>
          )}
          {insuranceFee > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>{lang === "VN" ? "Bảo hiểm hành khách" : "Passenger insurance"}</span>
              <span className="font-bold">+{insuranceFee.toLocaleString()}đ</span>
            </div>
          )}
          {pointsToUse > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>{lang === "VN" ? "Dùng điểm" : "Points used"}</span>
              <span className="font-bold">-{pointsToUse.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between items-end pt-4 border-t border-dashed border-slate-300 dark:border-slate-600">
            <span className="font-headline font-bold text-base text-[#124757] dark:text-white">
              {lang === "VN" ? "Tạm tính:" : "Estimated total:"}
            </span>
            <span className="text-3xl font-headline font-black text-[#124757] dark:text-[#FFD100]">
              {estimatedPayable.toLocaleString()} <span className="text-lg">VND</span>
            </span>
          </div>
          {estimatedEarn > 0 && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              {lang === "VN"
                ? `Ước cộng ~${estimatedEarn.toLocaleString()} điểm sau khi chuyến hoàn tất (1%).`
                : `Est. ~${estimatedEarn.toLocaleString()} points after trip completion (1%).`}
            </p>
          )}
          <p className="text-[11px] text-slate-400">
            {isFreeBookingEstimate
              ? (lang === "VN"
                ? "Số tiền cuối cùng lấy từ booking (subtotalAmount / totalAmount). Vé 0đ sẽ hoàn tất ngay, không qua PayOS."
                : "Final amount comes from the booking (subtotalAmount / totalAmount). A 0 VND ticket completes immediately without PayOS.")
              : (lang === "VN"
                ? "Số tiền cuối cùng (kèm bảo hiểm / mã khuyến mãi / điểm nếu có) sẽ hiển thị chính xác trên trang thanh toán PayOS."
                : "The final amount (with insurance / promo / points if any) will be shown exactly on the PayOS checkout page.")}
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
            className={isFreeBookingEstimate
              ? "inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#124757] px-6 py-4 text-sm font-headline font-black uppercase tracking-wider text-white shadow-lg shadow-[#124757]/25 transition hover:bg-[#0e3a46] hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
              : payosButtonLgClassName}
          >
            {!isSubmitting && !isFreeBookingEstimate && (
              <PayOSLogo variant="white" className="h-6 w-auto" />
            )}
            <span>
              {isSubmitting
                ? (lang === "VN"
                  ? (isFreeBookingEstimate ? "Đang hoàn tất..." : "Đang tạo giao dịch...")
                  : (isFreeBookingEstimate ? "Completing..." : "Creating payment..."))
                : (isFreeBookingEstimate
                  ? (lang === "VN" ? "Hoàn tất đặt vé" : "Complete booking")
                  : (lang === "VN" ? "Đặt vé & Thanh toán" : "Book & Pay Now"))}
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
