import { getBoatSeatCount } from "./charterBookingAdmin";

export const CHARTER_INSURANCE_PENDING_MESSAGE = {
  VN: "Phí tính theo tổng ghế tàu được gán — sẽ có trong báo giá.",
  EN: "Fee is based on assigned boat seats — shown in the quote.",
};

export const CHARTER_INSURANCE_NOTE = {
  VN: {
    title: "Phí bảo hiểm không tính theo số khách bạn nhập",
    body: "Khi thuê nguyên tàu, hệ thống tính theo tổng sức chứa (số ghế) của tàu được gán — không dựa vào số người lớn/trẻ em ở bước trên.",
    formulaLabel: "Cách tính phí",
    unitLabel: "Đơn giá",
    quantityLabel: "Tổng ghế tàu",
    totalLabel: "Tổng phí",
    quantityPending: "Có trong báo giá",
    totalPending: "—",
    referencePrice: "Đơn giá tham khảo",
  },
  EN: {
    title: "Insurance is not based on the passenger count above",
    body: "For full-boat charter, the fee is calculated from total seat capacity of assigned boats — not from the adults/children fields.",
    formulaLabel: "How it is calculated",
    unitLabel: "Unit price",
    quantityLabel: "Total boat seats",
    totalLabel: "Total fee",
    quantityPending: "In final quote",
    totalPending: "—",
    referencePrice: "Reference unit price",
  },
};

export const SEAT_INSURANCE_PENDING_MESSAGE = {
  VN: "Phí bảo hiểm sẽ được tính theo số khách khi thanh toán.",
  EN: "Insurance fee will be calculated from passenger count at checkout.",
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

export const calculateCharterInsurancePreview = ({ unitPremiumAmount, selectedBoats = [] }) => {
  const quantity = getTotalSeatCountOfBoats(selectedBoats);
  const unitPremium = Number(unitPremiumAmount) || 0;

  return {
    canPreview: quantity > 0,
    quantity,
    unitPremium,
    total: unitPremium * quantity,
    quantityLabel: "seat",
  };
};

export const getInsurancePreview = ({
  bookingType = "CharterBooking",
  unitPremiumAmount,
  passengerCount = 0,
  selectedBoats = [],
}) => {
  if (bookingType === "SeatBooking" || bookingType === "TicketBooking") {
    return calculateTicketInsurancePreview({ unitPremiumAmount, passengerCount });
  }

  return calculateCharterInsurancePreview({ unitPremiumAmount, selectedBoats });
};

export const getInsurancePendingMessage = (bookingType = "CharterBooking", lang = "VN") => {
  const language = lang === "VN" ? "VN" : "EN";
  return bookingType === "SeatBooking" || bookingType === "TicketBooking"
    ? SEAT_INSURANCE_PENDING_MESSAGE[language]
    : CHARTER_INSURANCE_PENDING_MESSAGE[language];
};

export const getCharterInsuranceNote = (lang = "VN") => (
  CHARTER_INSURANCE_NOTE[lang === "VN" ? "VN" : "EN"]
);

export const normalizeInsuranceFromBooking = (booking) => {
  const insurance = booking?.insurance;
  if (!insurance || typeof insurance !== "object") return null;

  const quantity = Number(insurance.quantity ?? insurance.seatCount ?? insurance.passengerCount) || 0;
  const totalAmount = Number(insurance.totalAmount ?? insurance.amount ?? insurance.premiumAmount) || 0;
  const unitPremiumAmount = Number(insurance.unitPremiumAmount ?? insurance.unitAmount) || 0;

  if (!quantity && !totalAmount && !unitPremiumAmount) return null;

  return {
    packageName: insurance.packageName ?? insurance.name ?? "",
    providerName: insurance.providerName ?? "",
    quantity,
    unitPremiumAmount,
    totalAmount: totalAmount || (unitPremiumAmount * quantity),
    selected: insurance.selected ?? insurance.isSelected ?? true,
  };
};
