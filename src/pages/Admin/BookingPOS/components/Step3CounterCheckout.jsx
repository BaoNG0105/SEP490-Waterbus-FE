import { useEffect, useRef, useState } from "react";
import { useApp } from "../../../../context/AppContext";
import { FormSelect } from "../../../../components/FormSelect";
import {
  fetchTicketTypes,
  DEFAULT_TICKET_TYPES,
  formatTicketTypeLabel,
  resolveTicketPriceModifier,
} from "../../../../services/ticketTypeService";
import { getMaxPointsToUse, estimateEarnPoints } from "../../../../services/pointService";
import {
  fetchActiveInsurancePackages,
  findInsurancePackageById,
  getInsurancePackageId,
  isSameInsurancePackageId,
  INSURANCE_BOOKING_TYPES,
} from "../../../../services/insuranceService";
import { lookupCounterCustomers, submitCounterBooking } from "../../../../services/counterBookingService";
import { syncBookingPayment } from "../../../../services/paymentService";
import { calculateTicketInsurancePreview } from "../../../../utils/insurancePreview";
import { getApiErrorMessage } from "../../../../utils/apiError";
import { notify, showToast } from "../../../../utils/swalToast";
import {
  formatFareAdjustmentLabel,
  formatSegmentDistanceLabel,
  pickSegmentDistanceKm,
} from "../../../../utils/bookingFareMessages";
import { confirmLeaveCheckout, releaseHeldBookingSeats } from "../../../../utils/bookingWizardGuard";
import {
  classifyPassengerAgeBand,
  getAgeFromBirthYear,
  getTravelYear,
  getVietnamCalendarYear,
  isTicketTypeMatchingBirthYear,
  SENIOR_MIN_AGE,
  ticketTypeAgeHint,
} from "../../../../utils/passengerAge";

const TICKET_TYPE_LABELS = {
  ADULT: { vn: "Người lớn", en: "Adult" },
  CHILD: { vn: "Trẻ em (3-12 tuổi)", en: "Child (3-12 years)" },
  SENIOR: { vn: "Người cao tuổi", en: "Senior" },
  DISABLED: { vn: "Người khuyết tật", en: "Disabled" },
  INFANT: { vn: "Em bé dưới 2 tuổi (không tính ghế)", en: "Infant under 2 (no seat)" },
};

const getTicketTypeLabel = (ticketType, lang, routeType) => {
  const code = String(ticketType?.code || "").toUpperCase();
  const base = TICKET_TYPE_LABELS[code]?.[lang === "VN" ? "vn" : "en"]
    || formatTicketTypeLabel(code || ticketType?.name, lang);
  const modifier = resolveTicketPriceModifier(ticketType, routeType);
  if (modifier === 1) return base;
  if (modifier === 0) return `${base} (${lang === "VN" ? "Miễn phí" : "Free"})`;
  const pct = Math.round((1 - modifier) * 100);
  return `${base} (−${pct}%)`;
};

const formatTripTime = (isoString) => {
  if (!isoString) return "--";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const getSegmentDeparture = (trip) => trip?.fromStopScheduledDeparture || trip?.departureTime;
const getSegmentArrival = (trip) => trip?.toStopScheduledArrival || trip?.arrivalTime;

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const formatVnd = (value) => `${(Number(value) || 0).toLocaleString("vi-VN")}đ`;

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

const PAYMENT_METHODS = [
  { id: "Cash", labelVn: "Tiền mặt", labelEn: "Cash", icon: "payments" },
  { id: "PayOS", labelVn: "PayOS (QR)", labelEn: "PayOS (QR)", icon: "qr_code_2" },
];

/**
 * Bước 3 dành riêng cho quầy bán vé (Staff/Manager): POST /api/bookings/counter thay vì
 * POST /api/bookings + /api/payments. Khác Step3Checkout (khách tự đặt) ở 3 điểm:
 *  - Thông tin liên hệ tra cứu/nhập tay cho KHÁCH, không kéo từ tài khoản đang đăng nhập (nhân viên).
 *  - Không có mã khuyến mãi tại quầy; điểm tích lũy dùng/tích theo khách đã tra cứu (không phải nhân viên).
 *  - Chọn phương thức thu tiền tại quầy: Cash / PayOS.
 * Toàn bộ quy tắc giá vé/tuổi/bảo hiểm tái sử dụng đúng service/util của luồng khách hàng.
 */
export default function Step3CounterCheckout({ bookingData, onBack, onExpire, onBookingCreated, onSaleCompleted }) {
  const { lang } = useApp();
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
    seatHoldExpiresAt,
  } = bookingData;

  const isLoopRoute = routeType === "SightseeingLoop";
  const vietnamCalendarYear = getVietnamCalendarYear();
  const travelYear = getTravelYear(departureDate) || vietnamCalendarYear;
  const infantBirthYearMin = travelYear - 2;

  // Đếm ngược thời gian giữ ghế (giữ ở Bước 2) — chỉ áp dụng trước khi tạo booking quầy.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const holdRemainingMs = seatHoldExpiresAt ? new Date(seatHoldExpiresAt).getTime() - nowTick : 0;
  const isHoldExpired = Boolean(seatHoldExpiresAt) && holdRemainingMs <= 0;

  const [pendingPayment, setPendingPayment] = useState(null);

  useEffect(() => {
    if (!isHoldExpired || pendingPayment) return;
    notify({
      dialog: true,
      icon: "warning",
      tone: "warning",
      title: lang === "VN" ? "Hết thời gian giữ ghế" : "Seat hold expired",
      text: lang === "VN"
        ? "Đã quá thời gian giữ ghế. Vui lòng tìm chuyến và chọn lại từ đầu."
        : "The seat hold has expired. Please search and select the trip again.",
      confirmButtonText: "OK",
      allowOutsideClick: false,
      showCancelButton: false,
    }).then(() => {
      onExpire?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHoldExpired, pendingPayment]);

  const handleBack = async () => {
    const ok = await confirmLeaveCheckout(lang);
    if (!ok) return;
    releaseHeldBookingSeats({
      isRoundTrip, fromWharf, toWharf, selectedDepartureTrip, selectedReturnTrip,
      selectedSeatsDeparture, selectedSeatsReturn,
    });
    onBack();
  };

  // 0. LOẠI VÉ TỪ BE — giống hệt luồng khách hàng.
  const [ticketTypes, setTicketTypes] = useState(DEFAULT_TICKET_TYPES);
  useEffect(() => {
    let cancelled = false;
    fetchTicketTypes().then((list) => { if (!cancelled) setTicketTypes(list); });
    return () => { cancelled = true; };
  }, []);
  const seatedTicketTypes = ticketTypes.filter((t) => t.code !== "INFANT");
  const getPriceModifier = (code) => {
    const found = ticketTypes.find((t) => t.code === String(code || "").toUpperCase());
    if (!found) return String(code || "").toUpperCase() === "ADULT" ? 1 : 0;
    return resolveTicketPriceModifier(found, routeType);
  };
  const isTicketTypeAllowedForPassenger = (ticketType, passengerIndex) => {
    if (!Array.isArray(ticketType.allowedSeatTypeCodes)) return true;
    const seats = [
      selectedSeatsDeparture[passengerIndex],
      ...(isRoundTrip ? [selectedSeatsReturn[passengerIndex]] : []),
    ];
    return seats.every((seat) => {
      const seatTypeCode = String(seat?.seatTypeCode || "").toUpperCase();
      if (!seatTypeCode) return true;
      return ticketType.allowedSeatTypeCodes.includes(seatTypeCode);
    });
  };

  // 1. TRA CỨU KHÁCH HÀNG TẠI QUẦY (thay cho "dùng thông tin tài khoản")
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerSearchDone, setCustomerSearchDone] = useState(false);
  const [linkedCustomer, setLinkedCustomer] = useState(null);

  const [contact, setContact] = useState({ name: "", phone: "", email: "" });

  const handleSearchCustomer = async () => {
    const keyword = customerKeyword.trim();
    if (!keyword) return;
    setIsSearchingCustomer(true);
    setCustomerSearchDone(false);
    try {
      const results = await lookupCounterCustomers(keyword);
      setCustomerResults(results);
      setCustomerSearchDone(true);
    } catch (error) {
      showToast({
        icon: "error",
        title: lang === "VN" ? "Không tra cứu được khách hàng" : "Unable to look up customer",
        text: getApiErrorMessage(error),
      });
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleSelectCustomer = (customer) => {
    setLinkedCustomer(customer);
    setContact({
      name: customer.fullName || "",
      phone: customer.phoneNumber || customer.phone || "",
      email: customer.email || "",
    });
    setCustomerResults([]);
    setCustomerSearchDone(false);
    setCustomerKeyword("");
  };

  const handleUnlinkCustomer = () => {
    setLinkedCustomer(null);
    setPointsToUseInput("");
  };

  // 2. THÔNG TIN TỪNG HÀNH KHÁCH CÓ GHẾ — giống hệt luồng khách hàng.
  const [passengers, setPassengers] = useState(
    Array.from({ length: selectedSeatsDeparture.length }, () => ({
      name: "", ticketType: "ADULT", birthYear: "", phone: "", email: "", infant: null,
    }))
  );

  const handlePassengerChange = (index, field, value) => {
    const updated = [...passengers];
    const next = { ...updated[index], [field]: value };
    if (field === "ticketType" && String(value || "").toUpperCase() !== "ADULT") {
      next.infant = null;
    }
    updated[index] = next;
    setPassengers(updated);
  };

  const handleUseContactInfoForPassenger = (index) => {
    setPassengers((prev) => prev.map((passenger, i) => (
      i === index
        ? { ...passenger, name: contact.name || passenger.name, phone: contact.phone || passenger.phone, email: contact.email || passenger.email }
        : passenger
    )));
  };

  const infants = passengers
    .map((p, index) => (p.infant ? { ...p.infant, companionIndex: index, companionName: p.name } : null))
    .filter(Boolean);

  const handleToggleInfant = (index) => {
    const passenger = passengers[index];
    if (!passenger?.infant && String(passenger?.ticketType || "").toUpperCase() !== "ADULT") {
      showToast({
        icon: "warning",
        title: lang === "VN" ? "Chỉ người lớn mới thêm em bé" : "Only adults can add an infant",
        text: lang === "VN"
          ? "Em bé (≤ 2 tuổi) phải đi kèm một hành khách người lớn."
          : "Infants (≤ 2) must accompany an adult passenger.",
      });
      return;
    }
    setPassengers((prev) => prev.map((p, i) => (
      i === index ? { ...p, infant: p.infant ? null : { name: "", birthYear: "" } } : p
    )));
  };

  const handleInfantChange = (index, field, value) => {
    setPassengers((prev) => prev.map((p, i) => (
      i === index && p.infant ? { ...p, infant: { ...p.infant, [field]: value } } : p
    )));
  };

  // 3. BẢO HIỂM (giống luồng khách hàng)
  const [insurancePackages, setInsurancePackages] = useState([]);
  const [isInsuranceLoading, setIsInsuranceLoading] = useState(true);
  const [insuranceLoadError, setInsuranceLoadError] = useState("");
  const [selectedInsurancePackageId, setSelectedInsurancePackageId] = useState(null);
  const lastInsurancePackageIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setIsInsuranceLoading(true);
    setInsuranceLoadError("");
    fetchActiveInsurancePackages(INSURANCE_BOOKING_TYPES.PASSENGER)
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
      .catch((error) => {
        if (cancelled) return;
        setInsurancePackages([]);
        setInsuranceLoadError(getApiErrorMessage(error, lang === "VN" ? "Không tải được gói bảo hiểm." : "Could not load insurance packages."));
      })
      .finally(() => { if (!cancelled) setIsInsuranceLoading(false); });
    return () => { cancelled = true; };
  }, [lang]);

  const totalSeatsCount = isRoundTrip
    ? (selectedSeatsDeparture.length + selectedSeatsReturn.length)
    : selectedSeatsDeparture.length;

  const insurancePassengerCount = selectedSeatsDeparture.length
    + (isRoundTrip ? selectedSeatsReturn.length : 0)
    + infants.length;
  const selectedInsurancePackage = selectedInsurancePackageId
    ? findInsurancePackageById(insurancePackages, selectedInsurancePackageId)
    : null;
  const insurancePreview = selectedInsurancePackage
    ? calculateTicketInsurancePreview({ unitPremiumAmount: selectedInsurancePackage.unitPremiumAmount, passengerCount: insurancePassengerCount })
    : { canPreview: false, quantity: 0, unitPremium: 0, total: 0 };
  const insuranceFee = selectedInsurancePackageId ? Number(insurancePreview.total) || 0 : 0;
  const insuranceRequired = insurancePackages.some((pkg) => pkg.isRequired);

  // 4. ƯỚC TÍNH GIÁ — không có mã khuyến mãi tại quầy.
  const sumSeatsPrice = (seats) => seats.reduce((sum, seat, i) => {
    const modifier = getPriceModifier(passengers[i]?.ticketType || "ADULT");
    return sum + Number(seat.basePrice || 0) * modifier;
  }, 0);
  const subtotal = sumSeatsPrice(selectedSeatsDeparture) + (isRoundTrip ? sumSeatsPrice(selectedSeatsReturn) : 0);
  const estimatedOrderAmount = subtotal + insuranceFee;

  // Điểm tích lũy: theo khách đã tra cứu, không phải nhân viên đang đăng nhập.
  const pointBalance = linkedCustomer ? Number(linkedCustomer.pointBalance) || 0 : 0;
  const [pointsToUseInput, setPointsToUseInput] = useState("");
  const maxPointsToUse = linkedCustomer ? getMaxPointsToUse(pointBalance, estimatedOrderAmount) : 0;
  const pointsToUse = (() => {
    if (!linkedCustomer) return 0;
    const raw = Math.floor(Number(pointsToUseInput) || 0);
    if (raw <= 0) return 0;
    return Math.min(raw, maxPointsToUse);
  })();
  const estimatedPayable = Math.max(0, estimatedOrderAmount - pointsToUse);
  const estimatedEarn = linkedCustomer ? estimateEarnPoints(estimatedPayable) : 0;

  // 5. PHƯƠNG THỨC THU TIỀN TẠI QUẦY
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSyncingPayment, setIsSyncingPayment] = useState(false);

  const showError = (title, text) => showToast({ icon: "warning", title, text });

  const buildLegItems = (seats, fromStationCode, toStationCode) => (
    seats.flatMap((seat, i) => {
      const passenger = passengers[i];
      const seated = {
        seatNumber: seat.seatNumber,
        ticketTypeCode: passenger?.ticketType || "ADULT",
        fromStationCode,
        toStationCode,
        passengerName: passenger?.name.trim(),
        passengerPhone: passenger?.phone?.trim() || null,
        passengerEmail: passenger?.email?.trim() || null,
        birthYear: Number(passenger?.birthYear),
      };
      if (!passenger?.infant) return [seated];
      const companionName = passenger.name.trim();
      return [
        seated,
        {
          seatNumber: null,
          ticketTypeCode: "INFANT",
          fromStationCode,
          toStationCode,
          passengerName: passenger.infant.name.trim(),
          birthYear: Number(passenger.infant.birthYear),
          companionPassengerName: companionName,
        },
      ];
    })
  );

  const handleSubmit = async () => {
    setSubmitError("");

    if (!contact.name.trim() || !contact.phone.trim() || !contact.email.trim()) {
      showError(
        lang === "VN" ? "Thiếu thông tin liên hệ" : "Missing contact information",
        lang === "VN" ? "Vui lòng nhập đầy đủ họ tên, số điện thoại và email của khách." : "Please fill in the customer's full name, phone number and email."
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
    if (passengers.some((p) => !String(p.birthYear || "").trim())) {
      showError(
        lang === "VN" ? "Thiếu năm sinh" : "Missing birth year",
        lang === "VN" ? "Vui lòng nhập năm sinh cho tất cả hành khách có ghế." : "Please enter the birth year for every seated passenger.",
      );
      return;
    }
    const invalidSeatedBirth = passengers.find((p) => {
      const year = Number(p.birthYear);
      return !Number.isInteger(year) || year > travelYear || year < 1900;
    });
    if (invalidSeatedBirth) {
      showError(
        lang === "VN" ? "Năm sinh không hợp lệ" : "Invalid birth year",
        lang === "VN" ? `Năm sinh phải từ 1900 đến ${travelYear} (năm đi).` : `Birth year must be between 1900 and ${travelYear} (travel year).`,
      );
      return;
    }
    const mismatchedType = passengers.find((p) => !isTicketTypeMatchingBirthYear(p.ticketType, p.birthYear, travelYear));
    if (mismatchedType) {
      const band = classifyPassengerAgeBand(mismatchedType.birthYear, travelYear);
      const type = String(mismatchedType.ticketType || "").toUpperCase();
      const age = getAgeFromBirthYear(mismatchedType.birthYear, travelYear);
      const seniorHint = type === "SENIOR"
        ? (lang === "VN" ? ` Người cao tuổi cần ≥ ${SENIOR_MIN_AGE} tuổi tại năm đi ${travelYear} (hiện ${age ?? "—"} tuổi).` : ` Senior needs age ≥ ${SENIOR_MIN_AGE} in travel year ${travelYear} (now ${age ?? "—"}).`)
        : "";
      showError(
        lang === "VN" ? "Loại vé không khớp năm sinh" : "Ticket type does not match birth year",
        lang === "VN"
          ? `「${mismatchedType.name || "Hành khách"}」 loại ${type} nhưng theo năm sinh thuộc nhóm ${band} (năm đi ${travelYear}).${seniorHint}`
          : `"${mismatchedType.name || "Passenger"}" is ${type} but age band is ${band} (travel year ${travelYear}).${seniorHint}`,
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
      contactName: contact.name.trim(),
      contactPhone: contact.phone.trim(),
      contactEmail: contact.email.trim(),
      insuranceSelected: Boolean(selectedInsurancePackageId),
      insurancePackageId: selectedInsurancePackageId || null,
      paymentMethod,
      customerUserId: linkedCustomer?.customerUserId || null,
      customerConfirmedForPoints: Boolean(linkedCustomer),
      pointsToUse: pointsToUse > 0 ? pointsToUse : 0,
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
      const booking = await submitCounterBooking(payload);
      onBookingCreated?.();

      const bookingId = pick(booking, ["id", "bookingId", "data.id", "data.bookingId"]);
      const totalAmountRaw = pick(booking, ["totalAmount", "data.totalAmount"], null);
      const totalAmount = Number(totalAmountRaw);
      const checkoutUrl = pick(booking, [
        "checkoutUrl", "paymentUrl", "data.checkoutUrl", "data.paymentUrl",
        "payment.checkoutUrl", "data.payment.checkoutUrl",
      ]);

      if (paymentMethod === "PayOS" && checkoutUrl) {
        const qrCode = pick(booking, [
          "qrCode", "qrCodeUrl", "qrCodeData", "data.qrCode", "data.qrCodeUrl",
          "payment.qrCode", "data.payment.qrCode",
        ]);
        const paymentId = pick(booking, [
          "paymentId", "data.paymentId", "payment.paymentId", "payment.id", "data.payment.id",
        ]);
        setPendingPayment({
          bookingId,
          paymentId,
          checkoutUrl,
          qrCode,
          totalAmount: Number.isFinite(totalAmount) ? totalAmount : estimatedPayable,
        });
        return;
      }

      await notify({
        dialog: true,
        icon: "success",
        title: lang === "VN" ? "Bán vé thành công" : "Ticket sold",
        text: lang === "VN"
          ? `Đã ghi nhận thanh toán và phát hành vé. Email vé đã gửi tới ${contact.email.trim()}.`
          : `Payment recorded and ticket issued. The e-ticket email was sent to ${contact.email.trim()}.`,
        confirmButtonText: lang === "VN" ? "Đơn mới" : "New sale",
        allowOutsideClick: false,
        showCancelButton: false,
      });
      onSaleCompleted?.();
    } catch (error) {
      console.error("Lỗi khi tạo booking tại quầy:", error);
      setSubmitError(
        getApiErrorMessage(error, lang === "VN" ? "Không tạo được booking. Vui lòng thử lại." : "Unable to create the booking. Please try again.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncPayment = async () => {
    if (!pendingPayment?.paymentId || isSyncingPayment) return;
    setIsSyncingPayment(true);
    try {
      const result = await syncBookingPayment(pendingPayment.paymentId);
      const status = String(pick(result, ["paymentStatus", "status", "data.paymentStatus", "data.status"], "")).trim().toLowerCase();
      if (status === "paid" || status === "success" || status === "completed" || status === "confirmed") {
        await notify({
          dialog: true,
          icon: "success",
          title: lang === "VN" ? "Đã nhận thanh toán" : "Payment received",
          text: lang === "VN" ? "Vé đã được phát hành và gửi email cho khách." : "The ticket has been issued and emailed to the customer.",
          confirmButtonText: lang === "VN" ? "Đơn mới" : "New sale",
          allowOutsideClick: false,
          showCancelButton: false,
        });
        onSaleCompleted?.();
      } else {
        showToast({
          icon: "info",
          title: lang === "VN" ? "Chưa nhận được thanh toán" : "Payment not received yet",
          text: lang === "VN" ? "Vui lòng chờ khách quét mã hoặc thử kiểm tra lại." : "Wait for the customer to scan the QR, then try again.",
        });
      }
    } catch (error) {
      showToast({
        icon: "error",
        title: lang === "VN" ? "Không đồng bộ được thanh toán" : "Unable to sync payment",
        text: getApiErrorMessage(error),
      });
    } finally {
      setIsSyncingPayment(false);
    }
  };

  // Tự động kiểm tra thanh toán PayOS mỗi 5s trong lúc chờ khách quét.
  useEffect(() => {
    if (!pendingPayment?.paymentId) return undefined;
    const id = setInterval(() => {
      handleSyncPayment();
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPayment?.paymentId]);

  // ===== MÀN CHỜ THANH TOÁN PAYOS =====
  if (pendingPayment) {
    return (
      <div className="mx-auto max-w-md space-y-5 rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-xl dark:border-slate-700/50 dark:bg-slate-800 md:p-8">
        <span className="material-symbols-outlined mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#124757]/10 text-3xl text-[#124757] dark:bg-yellow-400/10 dark:text-yellow-400">
          qr_code_2
        </span>
        <div>
          <h3 className="font-headline text-xl font-black text-[#124757] dark:text-white">
            {lang === "VN" ? "Chờ khách quét mã thanh toán" : "Waiting for the customer to scan"}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {lang === "VN" ? "Tổng tiền" : "Total"}: <span className="font-black text-[#124757] dark:text-yellow-400">{formatVnd(pendingPayment.totalAmount)}</span>
          </p>
        </div>

        {pendingPayment.qrCode ? (
          <img
            src={pendingPayment.qrCode}
            alt="PayOS QR"
            className="mx-auto h-56 w-56 rounded-2xl border border-slate-200 object-contain p-2 dark:border-slate-700"
          />
        ) : null}

        {pendingPayment.checkoutUrl ? (
          <a
            href={pendingPayment.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#124757]/20 bg-[#124757]/5 px-4 py-2.5 text-xs font-headline font-black uppercase tracking-wider text-[#124757] hover:bg-[#124757]/10 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-400"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            {lang === "VN" ? "Mở trang thanh toán" : "Open payment page"}
          </a>
        ) : null}

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={handleSyncPayment}
            disabled={isSyncingPayment}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#124757] px-6 py-3.5 text-sm font-headline font-black uppercase tracking-wider text-white shadow-lg shadow-[#124757]/25 transition hover:bg-[#0e3a46] disabled:opacity-50"
          >
            {isSyncingPayment ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <span className="material-symbols-outlined text-lg">sync</span>
            )}
            {lang === "VN" ? "Kiểm tra thanh toán" : "Check payment"}
          </button>
          <button
            type="button"
            onClick={() => onSaleCompleted?.()}
            className="w-full text-center text-xs font-bold text-slate-400 hover:text-[#124757] dark:hover:text-white"
          >
            {lang === "VN" ? "Hủy chờ / Đơn mới" : "Cancel wait / New sale"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
      {/* CỘT TRÁI (7/12) */}
      <div className="space-y-6 lg:col-span-7">

        {/* 1. TRA CỨU + THÔNG TIN LIÊN HỆ KHÁCH HÀNG */}
        <div className="space-y-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 md:p-8">
          <h3 className="border-b border-slate-100 pb-3 font-headline text-xl font-bold text-[#124757] dark:border-slate-700 dark:text-white">
            {lang === "VN" ? "Thông tin khách hàng" : "Customer Details"}
          </h3>

          {linkedCustomer ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-black text-emerald-800 dark:text-emerald-300">
                  {linkedCustomer.fullName || "--"}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {linkedCustomer.phoneNumber || linkedCustomer.phone} · {linkedCustomer.email} ·{" "}
                  {lang === "VN" ? "Điểm" : "Points"}: {(Number(linkedCustomer.pointBalance) || 0).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={handleUnlinkCustomer}
                className="shrink-0 rounded-lg border border-emerald-300 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:text-emerald-300"
              >
                {lang === "VN" ? "Bỏ chọn" : "Unlink"}
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <label className="text-xs font-bold uppercase text-slate-500">
                {lang === "VN" ? "Tra cứu khách hàng có tài khoản (SĐT hoặc email)" : "Look up an account (phone or email)"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customerKeyword}
                  onChange={(e) => setCustomerKeyword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearchCustomer(); } }}
                  placeholder={lang === "VN" ? "0901234567 hoặc email..." : "0901234567 or email..."}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:focus:border-[#FFD100]"
                />
                <button
                  type="button"
                  onClick={handleSearchCustomer}
                  disabled={!customerKeyword.trim() || isSearchingCustomer}
                  className="shrink-0 rounded-xl bg-[#124757] px-4 py-2.5 text-xs font-headline font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
                >
                  {isSearchingCustomer
                    ? (lang === "VN" ? "Đang tìm..." : "Searching...")
                    : (lang === "VN" ? "Tìm" : "Search")}
                </button>
              </div>

              {customerResults.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {customerResults.map((customer) => (
                    <div
                      key={customer.customerUserId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{customer.fullName}</p>
                        <p className="text-[11px] font-medium text-slate-400">
                          {customer.phoneNumber} · {customer.email} · {lang === "VN" ? "Điểm" : "Points"}: {(Number(customer.pointBalance) || 0).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectCustomer(customer)}
                        className="shrink-0 rounded-lg border border-[#124757]/20 bg-[#124757]/5 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] hover:bg-[#124757]/10 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-400"
                      >
                        {lang === "VN" ? "Xác nhận, tích điểm" : "Confirm & link points"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : customerSearchDone ? (
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                  {lang === "VN"
                    ? "Không tìm thấy tài khoản khớp — vé sẽ tạo cho khách vãng lai (không tích điểm)."
                    : "No matching account — the ticket will be issued as a walk-in (no points earned)."}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">
                  {lang === "VN"
                    ? "Bỏ qua nếu khách không có tài khoản / không muốn tích điểm."
                    : "Skip this if the customer has no account or doesn't want to earn points."}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">{lang === "VN" ? "Họ và tên *" : "Full Name *"}</label>
              <input
                type="text"
                placeholder="Nguyễn Văn A"
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:focus:border-[#FFD100]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">{lang === "VN" ? "Số điện thoại *" : "Phone Number *"}</label>
              <input
                type="tel"
                placeholder="0901234567"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:focus:border-[#FFD100]"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">{lang === "VN" ? "Địa chỉ Email *" : "Email Address *"}</label>
            <input
              type="email"
              placeholder="example@domain.com"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-colors focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:focus:border-[#FFD100]"
              required
            />
            <p className="text-[11px] text-slate-400">
              {lang === "VN" ? "Vé điện tử (QR) sẽ gửi về email này ngay sau khi xác nhận thanh toán." : "The e-ticket (QR) is emailed here right after payment is confirmed."}
            </p>
          </div>
        </div>

        {/* 2. THÔNG TIN HÀNH KHÁCH CÓ GHẾ */}
        <div className="space-y-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 md:p-8">
          <h3 className="flex items-center gap-2 border-b border-slate-100 pb-3 font-headline text-xl font-bold text-[#124757] dark:border-slate-700 dark:text-white">
            {lang === "VN" ? "Thông tin hành khách" : "Passenger Informations"}
          </h3>

          <div className="max-h-125 space-y-5 overflow-y-auto pr-2 custom-scrollbar">
            {passengers.map((passenger, index) => (
              <div key={index} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/50">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-3 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#124757] font-headline text-sm font-black text-[#FFD100] shadow-sm">
                      {index + 1}
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <span className="font-headline font-bold text-[#124757] dark:text-white">
                        {lang === "VN" ? `Hành khách ${index + 1}` : `Passenger ${index + 1}`}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-md border bg-white px-2 py-1 text-xs font-bold text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {lang === "VN" ? "Đi" : "Dep"}: {selectedSeatsDeparture[index]?.seatNumber}
                        </span>
                        {isRoundTrip && (
                          <span className="rounded-md border bg-white px-2 py-1 text-xs font-bold text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {lang === "VN" ? "Về" : "Ret"}: {selectedSeatsReturn[index]?.seatNumber}
                          </span>
                        )}
                        <span className="rounded-md border border-[#124757]/15 bg-[#124757]/8 px-2 py-1 text-xs font-bold text-[#124757] shadow-sm dark:border-yellow-400/20 dark:bg-yellow-400/15 dark:text-yellow-400">
                          {TICKET_TYPE_LABELS[String(passenger.ticketType || "ADULT").toUpperCase()]?.[lang === "VN" ? "vn" : "en"]
                            || formatTicketTypeLabel(passenger.ticketType, lang)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {index === 0 && (
                    <button
                      type="button"
                      onClick={() => handleUseContactInfoForPassenger(0)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#124757]/20 bg-[#124757]/5 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] hover:bg-[#124757]/10 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-400"
                    >
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                      {lang === "VN" ? "Dùng thông tin liên hệ" : "Use contact info"}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Họ và tên *" : "Full Name *"}</label>
                    <input
                      type="text"
                      value={passenger.name}
                      onChange={(e) => handlePassengerChange(index, "name", e.target.value)}
                      placeholder={lang === "VN" ? "Nguyễn Văn A..." : "Enter full name..."}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:focus:border-[#FFD100]"
                      required
                    />
                  </div>

                  <div className="relative z-10 space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Loại hành khách *" : "Passenger type *"}</label>
                    <FormSelect
                      value={passenger.ticketType}
                      onChange={(next) => handlePassengerChange(index, "ticketType", next)}
                      required
                      options={seatedTicketTypes.map((option) => ({
                        value: option.code,
                        label: getTicketTypeLabel(option, lang, routeType),
                        disabled: !isTicketTypeAllowedForPassenger(option, index),
                      }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-[#FFD100]"
                    />
                    {ticketTypeAgeHint(passenger.ticketType, travelYear, lang) ? (
                      <p className="text-[10px] font-medium text-[#124757] dark:text-yellow-400">
                        {ticketTypeAgeHint(passenger.ticketType, travelYear, lang)}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Năm sinh *" : "Birth year *"}</label>
                    <input
                      type="number"
                      min={1900}
                      max={travelYear}
                      value={passenger.birthYear}
                      onChange={(e) => handlePassengerChange(index, "birthYear", e.target.value)}
                      placeholder="YYYY"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:focus:border-[#FFD100]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Số điện thoại (Không bắt buộc)" : "Phone Number (Optional)"}</label>
                    <input
                      type="tel"
                      value={passenger.phone}
                      onChange={(e) => handlePassengerChange(index, "phone", e.target.value)}
                      placeholder={lang === "VN" ? "Không bắt buộc" : "Optional"}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:focus:border-[#FFD100]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Email (Không bắt buộc)" : "Email (Optional)"}</label>
                    <input
                      type="email"
                      value={passenger.email}
                      onChange={(e) => handlePassengerChange(index, "email", e.target.value)}
                      placeholder={lang === "VN" ? "Không bắt buộc" : "Optional"}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:focus:border-[#FFD100]"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200/60 pt-4 dark:border-slate-700">
                  {String(passenger.ticketType || "").toUpperCase() !== "ADULT" ? (
                    <p className="text-[10px] font-medium text-slate-400">
                      {lang === "VN" ? "Chỉ hành khách Người lớn mới thêm được em bé đi kèm." : "Only Adult passengers can add an accompanying infant."}
                    </p>
                  ) : !passenger.infant ? (
                    <button
                      type="button"
                      onClick={() => handleToggleInfant(index)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#124757]/20 bg-[#124757]/5 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] hover:bg-[#124757]/10 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-400"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      {lang === "VN" ? "Thêm em bé đi kèm (≤ 2 tuổi)" : "Add accompanying infant (≤ 2)"}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-500">
                          {lang === "VN" ? "Em bé đi kèm (không ghế, miễn phí)" : "Accompanying infant (no seat, free)"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleInfant(index)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="flex-1 space-y-1.5">
                          <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Họ và tên em bé *" : "Infant Full Name *"}</label>
                          <input
                            type="text"
                            value={passenger.infant.name}
                            onChange={(e) => handleInfantChange(index, "name", e.target.value)}
                            placeholder={lang === "VN" ? "Nhập tên em bé..." : "Enter infant's name..."}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:focus:border-[#FFD100]"
                          />
                        </div>
                        <div className="w-full space-y-1.5 sm:w-32">
                          <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Năm sinh *" : "Birth Year *"}</label>
                          <input
                            type="number"
                            min={infantBirthYearMin}
                            max={travelYear}
                            value={passenger.infant.birthYear}
                            onChange={(e) => handleInfantChange(index, "birthYear", e.target.value)}
                            placeholder="YYYY"
                            required
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:focus:border-[#FFD100]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CỘT PHẢI (5/12): HOÁ ĐƠN */}
      <div className="sticky top-28 space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-xl dark:border-slate-700/50 dark:bg-slate-800 md:p-6 lg:col-span-5">
        <h3 className="font-headline text-lg font-bold text-[#124757] dark:text-white">
          {lang === "VN" ? "Chi tiết hóa đơn" : "Invoice Summary"}
        </h3>

        {seatHoldExpiresAt && (
          <div className={`rounded-xl border px-4 py-3 ${isHoldExpired ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"}`}>
            {isHoldExpired ? (
              <>
                <p className="text-xs font-black uppercase tracking-wide">{lang === "VN" ? "Ghế đã hết hạn giữ chỗ" : "Seat hold has expired"}</p>
                <p className="mt-1 text-[11px] font-bold">{lang === "VN" ? "Vui lòng quay lại chọn ghế để giữ chỗ lại." : "Please go back and reselect seats to hold them again."}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold">
                  {lang === "VN" ? "Giữ chỗ đến" : "Held until"} <span className="font-black">{formatHoldDeadline(seatHoldExpiresAt)}</span>
                </p>
                <p className="mt-1 font-headline text-lg font-black tabular-nums">{formatCountdown(holdRemainingMs)}</p>
              </>
            )}
          </div>
        )}

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#124757] dark:text-yellow-400">
                {isLoopRoute ? (lang === "VN" ? "Chuyến tham quan" : "Sightseeing") : (lang === "VN" ? "Chiều đi" : "Outbound")}
              </span>
              <span className="text-[11px] font-medium text-slate-400">{departureDate || "—"}</span>
            </div>
            {isLoopRoute ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#124757] dark:text-white">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">{lang === "VN" ? "Đón" : "Pickup"} · </span>
                  {(fromWharfName || "—").toUpperCase()}
                </p>
                <p className="text-sm font-bold text-[#124757] dark:text-white">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">{lang === "VN" ? "Trả" : "Drop-off"} · </span>
                  {(toWharfName || "—").toUpperCase()}
                </p>
              </div>
            ) : (
              <p className="font-headline text-base font-black text-[#124757] dark:text-white">
                {(fromWharfName || "—").toUpperCase()}
                <span className="material-symbols-outlined mx-1 align-middle text-sm text-[#FFD100]">arrow_forward</span>
                {(toWharfName || "—").toUpperCase()}
              </p>
            )}
            <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {formatTripTime(getSegmentDeparture(selectedDepartureTrip))} {" → "} {formatTripTime(getSegmentArrival(selectedDepartureTrip))}
              {!isLoopRoute ? ` · ${formatSegmentDistanceLabel(pickSegmentDistanceKm(selectedDepartureTrip), lang)}` : ""}
              {formatFareAdjustmentLabel(selectedDepartureTrip?.fareAdjustment, lang) ? ` · ${formatFareAdjustmentLabel(selectedDepartureTrip?.fareAdjustment, lang)}` : ""}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {lang === "VN" ? "Ghế" : "Seats"}: {selectedSeatsDeparture.map((seat) => seat.seatNumber).join(", ") || "—"}
            </p>
          </div>

          {isRoundTrip && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Chiều về" : "Return"}</span>
                <span className="text-[11px] font-medium text-slate-400">{returnDate || "—"}</span>
              </div>
              <p className="font-headline text-base font-black text-[#124757] dark:text-white">
                {(toWharfName || "—").toUpperCase()}
                <span className="material-symbols-outlined mx-1 align-middle text-sm text-[#FFD100]">arrow_forward</span>
                {(fromWharfName || "—").toUpperCase()}
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {formatTripTime(getSegmentDeparture(selectedReturnTrip))} {" → "} {formatTripTime(getSegmentArrival(selectedReturnTrip))}
                {` · ${formatSegmentDistanceLabel(pickSegmentDistanceKm(selectedReturnTrip), lang)}`}
                {formatFareAdjustmentLabel(selectedReturnTrip?.fareAdjustment, lang) ? ` · ${formatFareAdjustmentLabel(selectedReturnTrip?.fareAdjustment, lang)}` : ""}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {lang === "VN" ? "Ghế" : "Seats"}: {selectedSeatsReturn.map((seat) => seat.seatNumber).join(", ") || "—"}
              </p>
            </div>
          )}
        </div>

        {/* Bảo hiểm */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
          {isInsuranceLoading ? (
            <p className="text-[11px] text-slate-400">{lang === "VN" ? "Đang tải gói bảo hiểm…" : "Loading insurance…"}</p>
          ) : !insurancePackages.length ? (
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {insuranceLoadError || (lang === "VN" ? "Chưa có gói bảo hiểm khả dụng." : "No insurance package available.")}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{lang === "VN" ? "Bảo hiểm hành khách" : "Passenger insurance"}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {selectedInsurancePackageId && selectedInsurancePackage
                      ? `${selectedInsurancePackage.name} · ${formatVnd(insuranceFee)}`
                      : (lang === "VN" ? "Tùy chọn thêm" : "Optional add-on")}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(selectedInsurancePackageId)}
                  disabled={insuranceRequired || isSubmitting}
                  onClick={() => {
                    if (insuranceRequired) return;
                    if (selectedInsurancePackageId) {
                      lastInsurancePackageIdRef.current = String(selectedInsurancePackageId);
                      setSelectedInsurancePackageId(null);
                    } else {
                      setSelectedInsurancePackageId(lastInsurancePackageIdRef.current || getInsurancePackageId(insurancePackages[0]));
                    }
                  }}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${selectedInsurancePackageId ? "bg-[#124757] dark:bg-yellow-400" : "bg-slate-300 dark:bg-slate-600"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${selectedInsurancePackageId ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              {selectedInsurancePackageId && selectedInsurancePackage ? (
                <p className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {formatVnd(insurancePreview.unitPremium)} × {insurancePreview.quantity} {lang === "VN" ? "khách" : "pax"}
                </p>
              ) : null}
            </>
          )}
        </div>

        {/* Điểm tích lũy */}
        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800 dark:text-white">{lang === "VN" ? "Điểm tích lũy" : "Loyalty points"}</p>
            <span className="text-[11px] font-bold text-slate-500">{lang === "VN" ? "Số dư" : "Balance"} {pointBalance.toLocaleString()}</span>
          </div>
          {!linkedCustomer ? (
            <p className="mt-2 text-[11px] text-slate-400">
              {lang === "VN" ? "Tra cứu & xác nhận khách hàng ở trên để dùng/tích điểm." : "Look up and confirm a customer above to use/earn points."}
            </p>
          ) : (
            <>
              <div className="mt-2.5 flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={maxPointsToUse}
                  step={1}
                  value={pointsToUseInput}
                  onChange={(e) => setPointsToUseInput(e.target.value)}
                  placeholder="0"
                  disabled={maxPointsToUse <= 0 || isSubmitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-black text-[#124757] outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  disabled={maxPointsToUse <= 0 || isSubmitting}
                  onClick={() => setPointsToUseInput(String(maxPointsToUse))}
                  className="shrink-0 rounded-xl border border-[#124757]/20 bg-[#124757]/5 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] disabled:opacity-50 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-400"
                >
                  {lang === "VN" ? "Tối đa" : "Max"}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">{lang === "VN" ? "1 điểm = 1 VND · tối đa 50% giá trị đơn" : "1 point = 1 VND · max 50% of order value"}</p>
            </>
          )}
        </div>

        {/* Tổng tiền */}
        <div className="space-y-2.5 rounded-2xl border border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>{lang === "VN" ? "Giá vé" : "Ticket fare"}</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{subtotal.toLocaleString()}đ</span>
          </div>
          <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>{lang === "VN" ? "Ghế" : "Seats"}</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">x{totalSeatsCount}</span>
          </div>
          {infants.length > 0 && (
            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>{lang === "VN" ? "Em bé (miễn phí)" : "Infants (free)"}</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">x{infants.length}</span>
            </div>
          )}
          {insuranceFee > 0 && (
            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>{lang === "VN" ? "Bảo hiểm" : "Insurance"}</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">+{insuranceFee.toLocaleString()}đ</span>
            </div>
          )}
          {pointsToUse > 0 && (
            <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
              <span>{lang === "VN" ? "Điểm dùng" : "Points used"}</span>
              <span className="font-bold">-{pointsToUse.toLocaleString()}</span>
            </div>
          )}
          <div className="border-t border-dashed border-slate-200 pt-3 dark:border-slate-600">
            <div className="flex items-end justify-between gap-3">
              <p className="text-[11px] font-medium text-slate-400">{lang === "VN" ? "Tổng tiền thanh toán" : "Amount to pay"}</p>
              <p className="font-headline text-2xl font-black tabular-nums text-[#124757] dark:text-yellow-400">
                {estimatedPayable.toLocaleString()}<span className="ml-1 text-sm font-bold">VND</span>
              </p>
            </div>
          </div>
          {estimatedEarn > 0 && (
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {lang === "VN" ? `Khách sẽ cộng ~${estimatedEarn.toLocaleString()} điểm sau chuyến` : `Customer earns ~${estimatedEarn.toLocaleString()} points after the trip`}
            </p>
          )}
        </div>

        {/* Phương thức thu tiền */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{lang === "VN" ? "Phương thức thu tiền" : "Payment method"}</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethod(method.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition ${
                  paymentMethod === method.id
                    ? "border-[#124757] bg-[#124757]/8 text-[#124757] dark:border-yellow-400 dark:bg-yellow-400/10 dark:text-yellow-400"
                    : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                }`}
              >
                <span className="material-symbols-outlined text-xl">{method.icon}</span>
                <span className="text-[10px] font-headline font-black uppercase tracking-wide">
                  {lang === "VN" ? method.labelVn : method.labelEn}
                </span>
              </button>
            ))}
          </div>
        </div>

        {submitError && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {submitError}
          </p>
        )}

        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isHoldExpired}
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#124757] px-6 py-4 text-sm font-headline font-black uppercase tracking-wider text-white shadow-lg shadow-[#124757]/25 transition hover:scale-[1.01] hover:bg-[#0e3a46] disabled:opacity-50 disabled:hover:scale-100 dark:bg-yellow-400 dark:text-slate-900"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : null}
            <span>
              {isSubmitting
                ? (lang === "VN" ? "Đang xử lý..." : "Processing...")
                : paymentMethod === "PayOS"
                  ? (lang === "VN" ? "Tạo yêu cầu thanh toán PayOS" : "Create PayOS payment request")
                  : (lang === "VN" ? "Xác nhận đã thu tiền & tạo vé" : "Confirm payment & issue ticket")}
            </span>
          </button>
          <button
            type="button"
            onClick={handleBack}
            disabled={isSubmitting}
            className="w-full text-center text-xs font-bold text-slate-400 transition-colors hover:text-[#124757] disabled:opacity-50 dark:hover:text-white"
          >
            {lang === "VN" ? "← Quay lại sửa chọn chuyến/ghế" : "← Back to seats selection"}
          </button>
        </div>
      </div>
    </div>
  );
}
