import { getBoatSeatCount } from "./charterBookingAdmin";
import { INSURANCE_BOOKING_TYPES } from "../services/insuranceService";

export const CHARTER_INSURANCE_PENDING_MESSAGE = {
  VN: "Phí = đơn giá × (người lớn + trẻ em) — xem trước trên form / báo giá.",
  EN: "Fee = unit price × (adults + children) — previewed on the form / quote.",
};

export const CHARTER_INSURANCE_NOTE = {
  VN: {
    title: "Phí bảo hiểm theo số hành khách",
    body: "Hệ thống tính unitPremiumAmount × (adultCount + childCount). Không còn tính theo số ghế tàu.",
    formulaLabel: "Cách tính phí",
    unitLabel: "Đơn giá / khách",
    quantityLabel: "Số hành khách",
    totalLabel: "Tổng phí",
    quantityPending: "Theo số khách đã nhập",
    totalPending: "—",
    referencePrice: "Đơn giá tham khảo",
  },
  EN: {
    title: "Insurance is based on passenger count",
    body: "Fee is unitPremiumAmount × (adultCount + childCount). It is no longer based on boat seat capacity.",
    formulaLabel: "How it is calculated",
    unitLabel: "Unit / passenger",
    quantityLabel: "Passengers",
    totalLabel: "Total fee",
    quantityPending: "From entered passenger count",
    totalPending: "—",
    referencePrice: "Reference unit price",
  },
};

export const SEAT_INSURANCE_PENDING_MESSAGE = {
  VN: "Phí bảo hiểm = đơn giá × tổng dòng vé (kể cả khứ hồi) + em bé.",
  EN: "Insurance fee = unit price × total ticket items (including return) + infants.",
};

// Giữ alias cũ để tránh vỡ import
export const TICKET_INSURANCE_PENDING_MESSAGE = SEAT_INSURANCE_PENDING_MESSAGE;

export const getTotalSeatCountOfBoats = (boats = []) => (
  (Array.isArray(boats) ? boats : []).reduce(
    (sum, boat) => sum + getBoatSeatCount(boat),
    0,
  )
);

export const calculateTicketInsurancePreview = ({ unitPremiumAmount, passengerCount }) => {
  const quantity = Math.max(0, Number(passengerCount) || 0);
  const unitPremium = Number(unitPremiumAmount) || 0;

  return {
    canPreview: quantity > 0,
    quantity,
    unitPremium,
    total: unitPremium * quantity,
    quantityLabel: "passenger",
  };
};

/** Charter: quantity = adultCount + childCount (BE PassengerInsurance). */
export const calculateCharterInsurancePreview = ({
  unitPremiumAmount,
  adultCount = 0,
  childCount = 0,
  passengerCount,
  selectedBoats = [],
}) => {
  const fromPassengers = passengerCount != null
    ? Math.max(0, Number(passengerCount) || 0)
    : Math.max(0, (Number(adultCount) || 0) + (Number(childCount) || 0));

  // Fallback cực hẹp nếu form chưa có số khách (hiếm).
  const quantity = fromPassengers > 0
    ? fromPassengers
    : getTotalSeatCountOfBoats(selectedBoats);
  const unitPremium = Number(unitPremiumAmount) || 0;

  return {
    canPreview: quantity > 0,
    quantity,
    unitPremium,
    total: unitPremium * quantity,
    quantityLabel: "passenger",
  };
};

export const getInsurancePreview = ({
  bookingType = INSURANCE_BOOKING_TYPES.PASSENGER,
  unitPremiumAmount,
  passengerCount = 0,
  adultCount = 0,
  childCount = 0,
  selectedBoats = [],
}) => {
  const fromPassengers = Math.max(
    0,
    Number(passengerCount) || ((Number(adultCount) || 0) + (Number(childCount) || 0)),
  );

  // Mọi bookingType mới đều theo số hành khách; selectedBoats chỉ fallback cũ.
  if (fromPassengers > 0 || String(bookingType) !== INSURANCE_BOOKING_TYPES.CHARTER) {
    return calculateTicketInsurancePreview({
      unitPremiumAmount,
      passengerCount: fromPassengers,
    });
  }

  return calculateCharterInsurancePreview({
    unitPremiumAmount,
    adultCount,
    childCount,
    passengerCount: fromPassengers,
    selectedBoats,
  });
};

export const getInsurancePendingMessage = (bookingType = INSURANCE_BOOKING_TYPES.PASSENGER, lang = "VN") => {
  const language = lang === "VN" ? "VN" : "EN";
  const type = String(bookingType || "");
  if (type === INSURANCE_BOOKING_TYPES.CHARTER) {
    return CHARTER_INSURANCE_PENDING_MESSAGE[language];
  }
  return SEAT_INSURANCE_PENDING_MESSAGE[language];
};

export const getCharterInsuranceNote = (lang = "VN") => (
  CHARTER_INSURANCE_NOTE[lang === "VN" ? "VN" : "EN"]
);

export const getBookingInsurancePackageId = (booking) => (
  booking?.insurancePackageId
  ?? booking?.insurance?.insurancePackageId
  ?? booking?.insurance?.packageId
  ?? booking?.insurance?.id
  ?? null
);

export const resolveInsuranceSelected = (booking) => {
  if (typeof booking?.insuranceSelected === "boolean") return booking.insuranceSelected;
  if (typeof booking?.insurance?.selected === "boolean") return booking.insurance.selected;
  if (typeof booking?.insurance?.isSelected === "boolean") return booking.insurance.isSelected;
  if (getBookingInsurancePackageId(booking)) return true;
  if (booking?.insurance && typeof booking.insurance === "object") {
    const totalAmount = Number(
      booking.insurance.totalAmount ?? booking.insurance.amount ?? booking.insurance.premiumAmount,
    ) || 0;
    if (totalAmount > 0) return true;
  }
  return null;
};

export const normalizeInsuranceFromBooking = (booking) => {
  const insurance = booking?.insurance;
  const selected = resolveInsuranceSelected(booking);
  const packageId = getBookingInsurancePackageId(booking);

  if (!insurance || typeof insurance !== "object") {
    if (selected === true) {
      return {
        packageId,
        packageCode: "",
        packageName: "",
        providerName: "",
        providerLogoUrl: "",
        quantity: 0,
        unitPremiumAmount: 0,
        coverageAmount: 0,
        totalAmount: 0,
        terms: "",
        selected: true,
      };
    }
    return null;
  }

  const quantity = Number(insurance.quantity ?? insurance.seatCount) || 0;
  const totalAmount = Number(insurance.totalAmount ?? insurance.amount ?? insurance.premiumAmount) || 0;
  const unitPremiumAmount = Number(insurance.unitPremiumAmount ?? insurance.unitAmount) || 0;
  const coverageAmount = Number(insurance.coverageAmount ?? insurance.coverage) || 0;
  const packageCode = insurance.code ?? insurance.packageCode ?? "";
  const packageName = insurance.packageName ?? insurance.name ?? "";
  const providerName = insurance.providerName ?? "";
  const providerLogoUrl = insurance.providerLogoUrl
    ?? insurance.logoUrl
    ?? insurance.provider?.logoUrl
    ?? insurance.provider?.providerLogoUrl
    ?? "";
  const terms = insurance.terms ?? insurance.conditions ?? insurance.termUrl ?? insurance.termsUrl ?? "";

  if (!quantity && !totalAmount && !unitPremiumAmount && selected !== true && !packageName && !packageId) {
    return null;
  }

  return {
    packageId,
    packageCode,
    packageName,
    providerName,
    providerLogoUrl,
    quantity,
    unitPremiumAmount,
    coverageAmount,
    totalAmount: quantity > 0 ? (totalAmount || unitPremiumAmount * quantity) : totalAmount,
    terms,
    selected: selected !== false,
  };
};
