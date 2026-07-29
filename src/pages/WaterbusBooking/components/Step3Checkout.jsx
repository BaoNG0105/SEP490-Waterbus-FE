import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { FormSelect } from "../../../components/FormSelect";
import { PayOSLogo, payosButtonLgClassName } from "../../../components/PayOSLogo";
import { SelectablePublicVouchers } from "../../../components/SelectablePublicVouchers";
import { submitBooking, fetchMyBookingDetail } from "../../../services/bookingService";
import { createBookingPayment } from "../../../services/paymentService";
import { fetchCurrentUserProfile } from "../../../services/authService";
import { fetchTicketTypes, DEFAULT_TICKET_TYPES, formatTicketTypeLabel, resolveTicketPriceModifier } from "../../../services/ticketTypeService";
import { fetchMyPointBalance, fetchMyPoints, getMaxPointsToUse, estimateEarnPoints } from "../../../services/pointService";
import {
  fetchActiveInsurancePackages,
  findInsurancePackageById,
  getInsurancePackageId,
  isSameInsurancePackageId,
  INSURANCE_BOOKING_TYPES,
} from "../../../services/insuranceService";
import { PROMOTION_BOOKING_TYPES, checkPromotionCode, normalizePromotionValidateResult } from "../../../services/promotionService";
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

// Nhãn loại hành khách / vé
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
import {
  classifyPassengerAgeBand,
  getAgeFromBirthYear,
  getTravelYear,
  getVietnamCalendarYear,
  isTicketTypeMatchingBirthYear,
  SENIOR_MIN_AGE,
  ticketTypeAgeHint,
} from "../../../utils/passengerAge";

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

export default function Step3Checkout({ bookingData, onBack, onExpire, onBookingCreated }) {
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
  const vietnamCalendarYear = getVietnamCalendarYear();
  const travelYear = getTravelYear(departureDate) || vietnamCalendarYear;
  // INFANT ≤ 2 tuổi theo năm đi.
  const infantBirthYearMin = travelYear - 2;

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

  // 0. LOẠI VÉ TỪ BE (GET /api/ticket-types): priceModifier / sightseeingPriceModifier theo routeType.
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
    if (!found) return String(code || "").toUpperCase() === "ADULT" ? 1 : 0;
    return resolveTicketPriceModifier(found, routeType);
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

  // 2. STATE: THÔNG TIN TỪNG HÀNH KHÁCH CÓ GHẾ (ADULT/CHILD/SENIOR/DISABLED)
  // Phone/Email để trống sẽ dùng thông tin liên hệ chung; nhập riêng nếu muốn hành khách đó
  // nhận vé điện tử (QR) riêng về số/email của mình.
  // ticketTypeCode gửi theo từng item khi tạo booking — không suy từ số thứ tự ghế.
  const [passengers, setPassengers] = useState(
    Array.from({ length: selectedSeatsDeparture.length }, () => ({
      name: "",
      ticketType: "ADULT",
      birthYear: "",
      phone: "",
      email: "",
      infant: null,
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

  // 3. Em bé ≤2 tuổi (INFANT) gắn với hành khách ADULT đi kèm — không chiếm ghế.
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
          ? "Em bé (dưới 2 tuổi) phải đi kèm một hành khách người lớn."
          : "Infants (under 2 years) must accompany an adult passenger.",
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

  // 4. STATE: MÃ GIẢM GIÁ, ĐIỂM TÍCH LŨY, BẢO HIỂM & SUBMIT
  const [promoCode, setPromoCode] = useState("");
  const [promoPreview, setPromoPreview] = useState(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const promoValidateSeqRef = useRef(0);
  const [pointBalance, setPointBalance] = useState(0);
  const [pointsToUseInput, setPointsToUseInput] = useState("");
  const [insurancePackages, setInsurancePackages] = useState([]);
  const [isInsuranceLoading, setIsInsuranceLoading] = useState(true);
  const [insuranceLoadError, setInsuranceLoadError] = useState("");
  const [selectedInsurancePackageId, setSelectedInsurancePackageId] = useState(null);
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
        setInsuranceLoadError(
          getApiErrorMessage(
            error,
            lang === "VN" ? "Không tải được gói bảo hiểm." : "Could not load insurance packages.",
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setIsInsuranceLoading(false);
      });
    return () => { cancelled = true; };
  }, [lang]);

  // Tổng số lượng ghế = Ghế chiều đi + Ghế chiều về (nếu có)
  const totalSeatsCount = isRoundTrip
    ? (selectedSeatsDeparture.length + selectedSeatsReturn.length)
    : selectedSeatsDeparture.length;

  // Phí BH theo tổng passenger items (ghế đi + ghế về nếu khứ hồi + em bé).
  const insurancePassengerCount =
    selectedSeatsDeparture.length
    + (isRoundTrip ? selectedSeatsReturn.length : 0)
    + infants.length;
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

  // Ước tính giá vé: finalPrice = seat.basePrice * modifier (SightseeingLoop → sightseeingPriceModifier).
  // Giá chuẩn cuối cùng vẫn do BE chốt (subtotalAmount / discountAmount / totalAmount).
  const sumSeatsPrice = (seats) => seats.reduce((sum, seat, i) => {
    const modifier = getPriceModifier(passengers[i]?.ticketType || "ADULT");
    return sum + Number(seat.basePrice || 0) * modifier;
  }, 0);
  const subtotal = sumSeatsPrice(selectedSeatsDeparture) + (isRoundTrip ? sumSeatsPrice(selectedSeatsReturn) : 0);
  // Tổng đơn hàng trước giảm giá = giá vé + bảo hiểm (giống base BE dùng để validate mã).
  const orderBeforeDiscount = subtotal + insuranceFee;

  // Giảm giá chỉ tính khi mã đã validate khớp với promoCode hiện tại.
  const promoApplied =
    Boolean(promoPreview?.ok)
    && String(promoPreview?.code || "").trim().toUpperCase() === String(promoCode || "").trim().toUpperCase();
  const discountAmount = promoApplied
    ? Math.min(orderBeforeDiscount, Math.max(0, Number(promoPreview.discountAmount) || 0))
    : 0;
  const orderAfterDiscount = Math.max(0, orderBeforeDiscount - discountAmount);
  const estimatedOrderAmount = orderAfterDiscount;

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

  // Preview giảm giá trước PayOS: validate mã theo tổng đơn (giá vé + bảo hiểm).
  useEffect(() => {
    const code = String(promoCode || "").trim();
    if (!code || code.length < 3) {
      setPromoPreview(null);
      setPromoChecking(false);
      return undefined;
    }
    const base = orderBeforeDiscount;
    if (base <= 0) {
      setPromoPreview({ ok: false, error: lang === "VN" ? "Chưa có số tiền để áp dụng mã." : "No amount to apply the code." });
      return undefined;
    }
    const seq = ++promoValidateSeqRef.current;
    setPromoChecking(true);
    const timer = window.setTimeout(async () => {
      try {
        const payload = await checkPromotionCode(code, base);
        if (seq !== promoValidateSeqRef.current) return;
        const normalized = normalizePromotionValidateResult(payload, base);
        if (!normalized.ok) {
          setPromoPreview({ ok: false, error: normalized.message || (lang === "VN" ? "Mã không hợp lệ" : "Invalid code") });
          return;
        }
        setPromoPreview({
          ok: true,
          discountAmount: normalized.discountAmount,
          finalAmount: normalized.finalAmount,
          baseAmount: normalized.baseAmount,
          message: normalized.message,
          code: normalized.code || code,
        });
      } catch (error) {
        if (seq !== promoValidateSeqRef.current) return;
        setPromoPreview({
          ok: false,
          error: getApiErrorMessage(error, lang === "VN" ? "Không kiểm tra được mã khuyến mãi." : "Could not validate promo code."),
        });
      } finally {
        if (seq === promoValidateSeqRef.current) setPromoChecking(false);
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [promoCode, orderBeforeDiscount, lang]);

  const showError = (title, text) => {
    showToast({ icon: "warning", title, text });
  };

  // Thứ tự giống form điền: từng ghế/hành khách, em bé ngay sau người lớn đi kèm.
  const buildLegItems = (seats, fromStationCode, toStationCode) => (
    seats.flatMap((seat, i) => {
      const passenger = passengers[i];
      const seated = {
        seatNumber: seat.seatNumber,
        ticketTypeCode: passenger?.ticketType || "ADULT",
        fromStationCode,
        toStationCode,
        passengerName: passenger?.name.trim(),
        passengerPhone: (passenger?.phone.trim() || contact.phone.trim()),
        passengerEmail: (passenger?.email.trim() || contact.email.trim()),
        birthYear: Number(passenger?.birthYear),
      };
      if (!passenger?.infant) return [seated];
      return [
        seated,
        {
          seatNumber: null,
          ticketTypeCode: "INFANT",
          fromStationCode,
          toStationCode,
          passengerName: passenger.infant.name.trim(),
          birthYear: Number(passenger.infant.birthYear),
          companionPassengerName: passenger.name.trim(),
        },
      ];
    })
  );

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

    if (passengers.some((p) => !String(p.birthYear || "").trim())) {
      showError(
        lang === "VN" ? "Thiếu năm sinh" : "Missing birth year",
        lang === "VN"
          ? "Vui lòng nhập năm sinh cho tất cả hành khách có ghế."
          : "Please enter the birth year for every seated passenger.",
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
        lang === "VN"
          ? `Năm sinh phải từ 1900 đến ${travelYear} (năm đi).`
          : `Birth year must be between 1900 and ${travelYear} (travel year).`,
      );
      return;
    }

    const mismatchedType = passengers.find((p) => (
      !isTicketTypeMatchingBirthYear(p.ticketType, p.birthYear, travelYear)
    ));
    if (mismatchedType) {
      const band = classifyPassengerAgeBand(mismatchedType.birthYear, travelYear);
      const type = String(mismatchedType.ticketType || "").toUpperCase();
      const age = getAgeFromBirthYear(mismatchedType.birthYear, travelYear);
      const seniorHint = type === "SENIOR"
        ? (lang === "VN"
          ? ` Người cao tuổi cần ≥ ${SENIOR_MIN_AGE} tuổi tại năm đi ${travelYear} (hiện ${age ?? "—"} tuổi).`
          : ` Senior needs age ≥ ${SENIOR_MIN_AGE} in travel year ${travelYear} (now ${age ?? "—"}).`)
        : "";
      showError(
        lang === "VN" ? "Loại vé không khớp năm sinh" : "Ticket type does not match birth year",
        lang === "VN"
          ? `「${mismatchedType.name || "Hành khách"}」 loại ${type} nhưng theo năm sinh thuộc nhóm ${band} (năm đi ${travelYear}). CHILD: >2–≤12 tuổi; từ 13 tuổi chọn ADULT; ≤2 tuổi dùng em bé đi kèm.${seniorHint}`
          : `"${mismatchedType.name || "Passenger"}" is ${type} but age band is ${band} (travel year ${travelYear}). CHILD: >2–≤12; age 13+ use ADULT; ≤2 use accompanying infant.${seniorHint}`,
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

    const invalidInfantBirth = infants.find((inf) => {
      const year = Number(inf.birthYear);
      return !Number.isInteger(year) || year > travelYear || year < 1900
        || classifyPassengerAgeBand(year, travelYear) !== "INFANT";
    });
    if (invalidInfantBirth) {
      showError(
        lang === "VN" ? "Năm sinh em bé không hợp lệ" : "Invalid infant birth year",
        lang === "VN"
          ? `Em bé phải dưới 2 tuổi theo năm đi ${travelYear} (sinh từ ${travelYear - 2}–${travelYear}).`
          : `Infant must be under 2 years for travel year ${travelYear} (born ${travelYear - 2}–${travelYear}).`,
      );
      return;
    }

    const adultCount = passengers.filter((p) => String(p.ticketType || "").toUpperCase() === "ADULT").length;
    const childCount = passengers.filter((p) => String(p.ticketType || "").toUpperCase() === "CHILD").length;
    const infantCount = infants.length;
    // BE: booking có CHILD/INFANT cần ≥ 1 ADULT cùng chiều/chặng (không bắt 1:1).
    if ((childCount + infantCount) > 0 && adultCount === 0) {
      showError(
        lang === "VN" ? "Thiếu người lớn đi kèm" : "Adult companion required",
        lang === "VN"
          ? "Trẻ em / em bé phải có ít nhất 1 người lớn (ADULT) đi cùng."
          : "A booking with child/infant needs at least 1 adult (ADULT) come with.",
      );
      return;
    }

    const infantOnNonAdult = passengers.find((p) => (
      p.infant && String(p.ticketType || "").toUpperCase() !== "ADULT"
    ));
    if (infantOnNonAdult) {
      showError(
        lang === "VN" ? "Em bé phải đi kèm người lớn" : "Infant must accompany an adult",
        lang === "VN"
          ? "Chỉ thêm em bé dưới hành khách loại Người lớn."
          : "Add infants only under an Adult passenger.",
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
      // Booking đã tồn tại ở BE — dọn draft Step 1-2 lưu tạm cho F5, tránh khôi phục nhầm lần đặt cũ.
      onBookingCreated?.();

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
      const bookingStatus = String(pick(booking, [
        "bookingStatus", "status",
        "data.bookingStatus", "data.status",
      ], "")).trim();
      const cappedPoints = getMaxPointsToUse(pointBalance, orderAmount);
      const pointsForPayment = Math.min(pointsToUse, cappedPoints);

      const paymentServiceType = isLoopRoute ? "Sightseeing" : "Waterbus";
      const myTicketsPath = `/profile/my-bookings?type=${paymentServiceType}`;

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
        navigate(`${myTicketsPath}&highlightBookingId=${encodeURIComponent(bookingId)}`, {
          replace: true,
          state: { highlightBookingId: bookingId, paymentOutcome: "success", freeTicket: true, serviceType: paymentServiceType },
        });
      };

      // Vé 0đ: BE chốt Confirmed tự động → GET detail lấy ticketCode/QR rồi vào màn vé (không PayOS).
      if (orderAmount === 0 && bookingStatus.toLowerCase() === "confirmed") {
        try {
          await fetchMyBookingDetail(bookingId);
        } catch (detailError) {
          console.warn("Không tải được detail booking 0đ (vẫn điều hướng màn vé):", detailError);
        }
        await finishFreeBooking();
        return;
      }

      // Vé có tiền: tạo payment PayOS như cũ.
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

      // Điểm/promo về 0đ sau create payment: Paid + không checkoutUrl → không sang PayOS.
      const isFreePaid = !checkoutUrl && (
        paymentStatus.toLowerCase() === "paid"
        || paymentAmount === 0
      );
      if (isFreePaid) {
        try {
          await fetchMyBookingDetail(bookingId);
        } catch (detailError) {
          console.warn("Không tải được detail booking free-paid (vẫn điều hướng màn vé):", detailError);
        }
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

          <div className="max-h-125 space-y-5 overflow-y-auto pr-2 custom-scrollbar">
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
                      <div className="flex gap-2 flex-wrap">
                        <span className="bg-white dark:bg-slate-800 border dark:border-slate-600 text-xs font-bold px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 shadow-sm">
                          Đi: {selectedSeatsDeparture[index]?.seatNumber}
                        </span>
                        {isRoundTrip && (
                          <span className="bg-white dark:bg-slate-800 border dark:border-slate-600 text-xs font-bold px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 shadow-sm">
                            Về: {selectedSeatsReturn[index]?.seatNumber}
                          </span>
                        )}
                        <span className="bg-[#124757]/8 dark:bg-yellow-400/15 border border-[#124757]/15 dark:border-yellow-400/20 text-xs font-bold px-2 py-1 rounded-md text-[#124757] dark:text-yellow-400 shadow-sm">
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

                  <div className="relative z-10 space-y-1.5 sm:col-span-2">
                    <label className="text-[11px] font-bold uppercase text-slate-500">
                      {lang === "VN" ? "Loại hành khách *" : "Passenger type *"}
                    </label>
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

                  <div className="space-y-1.5 sm:col-span-2 sm:max-w-48">
                    <label className="text-[11px] font-bold uppercase text-slate-500">
                      {lang === "VN" ? "Năm sinh *" : "Birth year *"}
                    </label>
                    <input
                      type="number"
                      min={1900}
                      max={travelYear}
                      value={passenger.birthYear}
                      onChange={(e) => handlePassengerChange(index, "birthYear", e.target.value)}
                      placeholder="YYYY"
                      required
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]"
                    />
                  </div>

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

                {/* INFANT ≤2: không ghế, bắt buộc birthYear; chỉ gắn dưới ADULT. */}
                <div className="border-t border-slate-200/60 dark:border-slate-700 pt-4">
                    {String(passenger.ticketType || "").toUpperCase() !== "ADULT" ? (
                      <p className="text-[10px] font-medium text-slate-400">
                        {lang === "VN"
                          ? "Chỉ hành khách là Người lớn mới thêm được em bé đi kèm."
                          : "Only Adult passengers can add an accompanying infant."}
                      </p>
                    ) : !passenger.infant ? (
                      <button
                        type="button"
                        onClick={() => handleToggleInfant(index)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#124757]/20 dark:border-yellow-400/20 bg-[#124757]/5 dark:bg-yellow-400/10 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 hover:bg-[#124757]/10"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        {lang === "VN" ? "Thêm em bé đi kèm (dưới 2 tuổi)" : "Add accompanying infant (≤ 2)"}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-500">
                            {lang === "VN" ? "Em bé đi kèm (không tính ghế, miễn phí)" : "Accompanying infant (no seat, free)"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleInfant(index)}
                            className="shrink-0 w-8 h-8 rounded-lg border border-rose-200 dark:border-rose-500/30 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1 space-y-1.5">
                            <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Họ và tên em bé *" : "Infant Full Name *"}</label>
                            <input
                              type="text"
                              value={passenger.infant.name}
                              onChange={(e) => handleInfantChange(index, "name", e.target.value)}
                              placeholder={lang === "VN" ? "Nhập tên em bé..." : "Enter infant's name..."}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]"
                            />
                          </div>
                          <div className="w-full sm:w-32 space-y-1.5">
                            <label className="text-[11px] font-bold uppercase text-slate-500">{lang === "VN" ? "Năm sinh *" : "Birth Year *"}</label>
                            <input
                              type="number"
                              min={infantBirthYearMin}
                              max={travelYear}
                              value={passenger.infant.birthYear}
                              onChange={(e) => handleInfantChange(index, "birthYear", e.target.value)}
                              placeholder="YYYY"
                              required
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#124757] dark:focus:border-[#FFD100]"
                            />
                            <p className="text-[10px] text-slate-400">
                              {lang === "VN"
                                ? `dưới 2 tuổi · sinh ${infantBirthYearMin}–${travelYear}.`
                                : `under 2 yrs · born ${infantBirthYearMin}–${travelYear}.`}
                            </p>
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

      {/* CỘT PHẢI (5/12) - BILL TÍNH HÓA ĐƠN & ĐẶT VÉ */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-5 md:p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700/50 space-y-4 sticky top-28">
        <h3 className="text-lg font-headline font-bold text-[#124757] dark:text-white">
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

        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-md bg-[#124757]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-400">
                {isLoopRoute
                  ? (lang === "VN" ? "Chuyến tham quan" : "Sightseeing")
                  : (lang === "VN" ? "Chiều đi" : "Outbound")}
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
              {formatTripTime(getSegmentDeparture(selectedDepartureTrip))}
              {" → "}
              {formatTripTime(getSegmentArrival(selectedDepartureTrip))}
              {!isLoopRoute ? ` · ${formatSegmentDistanceLabel(pickSegmentDistanceKm(selectedDepartureTrip), lang)}` : ""}
              {formatFareAdjustmentLabel(selectedDepartureTrip?.fareAdjustment, lang)
                ? ` · ${formatFareAdjustmentLabel(selectedDepartureTrip?.fareAdjustment, lang)}`
                : ""}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {lang === "VN" ? "Ghế" : "Seats"}: {selectedSeatsDeparture.map((seat) => seat.seatNumber).join(", ") || "—"}
            </p>
          </div>

          {isRoundTrip && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                  {lang === "VN" ? "Chiều về" : "Return"}
                </span>
                <span className="text-[11px] font-medium text-slate-400">{returnDate || "—"}</span>
              </div>
              <p className="font-headline text-base font-black text-[#124757] dark:text-white">
                {(toWharfName || "—").toUpperCase()}
                <span className="material-symbols-outlined mx-1 align-middle text-sm text-[#FFD100]">arrow_forward</span>
                {(fromWharfName || "—").toUpperCase()}
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {formatTripTime(getSegmentDeparture(selectedReturnTrip))}
                {" → "}
                {formatTripTime(getSegmentArrival(selectedReturnTrip))}
                {` · ${formatSegmentDistanceLabel(pickSegmentDistanceKm(selectedReturnTrip), lang)}`}
                {formatFareAdjustmentLabel(selectedReturnTrip?.fareAdjustment, lang)
                  ? ` · ${formatFareAdjustmentLabel(selectedReturnTrip?.fareAdjustment, lang)}`
                  : ""}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {lang === "VN" ? "Ghế" : "Seats"}: {selectedSeatsReturn.map((seat) => seat.seatNumber).join(", ") || "—"}
              </p>
            </div>
          )}
        </div>

        {/* Ưu đãi + bảo hiểm */}
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-700 dark:bg-slate-900/40">
          {(() => {
            const formatVnd = (value) => `${(Number(value) || 0).toLocaleString("vi-VN")}đ`;
            const wantsInsurance = selectedInsurancePackageId != null;
            const displayPackage = selectedInsurancePackage || insurancePackages[0];
            const providerName = displayPackage?.providerName || "";
            const providerLogoUrl = displayPackage?.providerLogoUrl || "";

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

            if (isInsuranceLoading) {
              return (
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#124757]/10 text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-400">
                      <span className="material-symbols-outlined text-xl">verified_user</span>
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">
                        {lang === "VN" ? "Bảo hiểm hành khách" : "Passenger insurance"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {lang === "VN" ? "Đang tải gói bảo hiểm…" : "Loading insurance…"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            if (!insurancePackages.length) {
              return (
                <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 dark:bg-slate-900 dark:text-amber-300">
                      <span className="material-symbols-outlined text-xl">verified_user</span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-white">
                        {lang === "VN" ? "Bảo hiểm hành khách" : "Passenger insurance"}
                      </p>
                      <p className="mt-1 text-[11px] font-medium leading-5 text-slate-600 dark:text-slate-300">
                        {insuranceLoadError
                          || (lang === "VN"
                            ? "Chưa có gói Active PassengerInsurance. Admin → Bảo hiểm tạo gói (mặc định gửi PassengerInsurance)."
                            : "No Active PassengerInsurance package yet. Create one in Admin → Insurance.")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
                      providerLogoUrl
                        ? "bg-white p-1 ring-1 ring-slate-200 dark:ring-slate-600"
                        : "bg-[#124757]/10 text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-400"
                    }`}>
                      {providerLogoUrl ? (
                        <img src={providerLogoUrl} alt={providerName || "Insurance"} className="h-full w-full object-contain" />
                      ) : (
                        <span className="material-symbols-outlined text-xl">verified_user</span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-white">
                        {lang === "VN" ? "Bảo hiểm hành khách" : "Passenger insurance"}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {wantsInsurance && selectedInsurancePackage
                          ? `${selectedInsurancePackage.name || providerName} · ${formatVnd(insuranceFee)}`
                          : (lang === "VN" ? "Tùy chọn thêm khi thanh toán" : "Optional add-on at checkout")}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={wantsInsurance}
                    disabled={insuranceRequired || isSubmitting}
                    onClick={() => handleInsuranceToggle(!wantsInsurance)}
                    className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
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

                {wantsInsurance ? (
                  <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-700">
                    {insurancePackages.length > 1 ? (
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
                                  : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                              }`}
                            >
                              <span className="block">{pkg.name || pkg.code}</span>
                              <span className="mt-0.5 block text-slate-400">
                                {formatVnd(pkg.unitPremiumAmount)}/{lang === "VN" ? "khách" : "pax"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    {selectedInsurancePackage ? (
                      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        <span>
                          {formatVnd(insurancePreview.unitPremium)} × {insurancePreview.quantity}{" "}
                          {lang === "VN" ? "khách" : "pax"}
                          {Number(selectedInsurancePackage.coverageAmount) > 0
                            ? ` · ${lang === "VN" ? "BH" : "Cover"} ${formatVnd(selectedInsurancePackage.coverageAmount)}`
                            : ""}
                        </span>
                        <button
                          type="button"
                          onClick={handleShowTerms}
                          className="shrink-0 font-bold text-[#124757] hover:underline dark:text-yellow-400"
                        >
                          {lang === "VN" ? "Điều khoản" : "Terms"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleShowTerms}
                    className="mt-2 text-[11px] font-bold text-[#124757] hover:underline dark:text-yellow-400"
                  >
                    {lang === "VN" ? "Xem điều khoản bảo hiểm" : "View insurance terms"}
                  </button>
                )}
              </div>
            );
          })()}

          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
            <SelectablePublicVouchers
              lang={lang}
              bookingType={PROMOTION_BOOKING_TYPES.SEAT}
              selectedCode={promoCode}
              disabled={isSubmitting}
              onChangeCode={setPromoCode}
              onSelect={(code) => setPromoCode(code)}
              onClear={() => setPromoCode("")}
            />
          </div>
        </div>

        {/* Điểm tích lũy */}
        <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800 dark:text-white">
              {lang === "VN" ? "Điểm tích lũy" : "Loyalty points"}
            </p>
            <span className="text-[11px] font-bold text-slate-500">
              {lang === "VN" ? "Số dư" : "Balance"} {pointBalance.toLocaleString()}
            </span>
          </div>
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
          <p className="mt-1.5 text-[10px] text-slate-400">
            {lang === "VN"
              ? `1 điểm = 1 VND`
              : `1 point = 1 VND`}
          </p>
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
            <div className="flex items-start justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
              <div>
                <p>{lang === "VN" ? "Bảo hiểm" : "Insurance"}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {insurancePreview.unitPremium.toLocaleString()}đ × {insurancePreview.quantity}{" "}
                  {lang === "VN" ? "hành khách" : "passenger(s)"}
                </p>
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-200">+{insuranceFee.toLocaleString()}đ</span>
            </div>
          )}
          {promoCode.trim() ? (
            <div className="flex items-start justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
              <div>
                <p>{lang === "VN" ? "Mã giảm giá" : "Promo code"}</p>
                <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[#124757] dark:text-yellow-400">
                  {promoCode.trim()}
                </p>
                {promoApplied && discountAmount > 0 ? (
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {lang === "VN"
                      ? `Áp dụng trên ${orderBeforeDiscount.toLocaleString()}đ`
                      : `Applied on ${orderBeforeDiscount.toLocaleString()}đ`}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-right">
                {promoChecking ? (
                  <span className="text-[11px] font-bold text-slate-400">
                    {lang === "VN" ? "Đang kiểm tra…" : "Checking…"}
                  </span>
                ) : promoApplied && discountAmount > 0 ? (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    -{discountAmount.toLocaleString()}đ
                  </span>
                ) : promoPreview && !promoPreview.ok ? (
                  <span className="text-[11px] font-bold text-rose-500">
                    {promoPreview.error || (lang === "VN" ? "Không hợp lệ" : "Invalid")}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-400">
                    {lang === "VN" ? "Chờ BE xác nhận" : "Pending"}
                  </span>
                )}
              </span>
            </div>
          ) : null}
          {pointsToUse > 0 && (
            <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
              <span>{lang === "VN" ? "Điểm dùng" : "Points used"}</span>
              <span className="font-bold">-{pointsToUse.toLocaleString()}</span>
            </div>
          )}

          <div className="border-t border-dashed border-slate-200 pt-3 dark:border-slate-600">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-slate-400">
                  {lang === "VN" ? "Tổng tiền thanh toán" : "Amount to pay"}
                </p>
              </div>
              <p className="font-headline text-2xl font-black tabular-nums text-[#124757] dark:text-yellow-400">
                {estimatedPayable.toLocaleString()}
                <span className="ml-1 text-sm font-bold">VND</span>
              </p>
            </div>
          </div>
          {estimatedEarn > 0 && (
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {lang === "VN"
                ? `Cộng ~${estimatedEarn.toLocaleString()} điểm sau chuyến`
                : `Est. ~${estimatedEarn.toLocaleString()} points after trip`}
            </p>
          )}
        </div>

        {submitError && (
          <p className="text-xs font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-3">
            {submitError}
          </p>
        )}

        {/* Hành động */}
        <div className="space-y-3 pt-1">
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
