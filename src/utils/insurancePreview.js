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

// Giữ alias cũ để tránh vỡ import
export const TICKET_INSURANCE_PENDING_MESSAGE = {
  VN: "",
  EN: "",
};

export const SEAT_INSURANCE_PENDING_MESSAGE = {
  VN: "",
  EN: "",
};

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

// Seat-map trả effectivePrice = giá ghế + phí bảo hiểm mặc định (bắt buộc) của Waterbus.
// Bước 2 chỉ hiển thị phần giá ghế; phần bảo hiểm mặc định được tách ra hiển thị ở Bước 3 (checkout).
export const getSeatDefaultInsurancePremium = (seat) => {
  const effectivePrice = Number(seat?.effectivePrice ?? seat?.basePrice ?? 0) || 0;
  const basePrice = Number(seat?.basePrice);
  const explicitPremium = Number(seat?.waterbusInsurancePremium);
  if (Number.isFinite(explicitPremium)) return Math.max(0, explicitPremium);
  return Number.isFinite(basePrice) ? Math.max(0, effectivePrice - basePrice) : 0;
};

/** Giá ghế thuần (chưa gồm bảo hiểm mặc định) — dùng cho mọi chỗ hiển thị giá ở Bước 2. */
export const getSeatBaseFare = (seat) => {
  const basePrice = Number(seat?.basePrice);
  if (Number.isFinite(basePrice)) return Math.max(0, basePrice);
  const effectivePrice = Number(seat?.effectivePrice ?? 0) || 0;
  return Math.max(0, effectivePrice - getSeatDefaultInsurancePremium(seat));
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
  if (Array.isArray(booking?.insurances) && booking.insurances.length > 0) return true;
  if (booking?.insurance && typeof booking.insurance === "object") {
    const totalAmount = Number(
      booking.insurance.totalAmount ?? booking.insurance.amount ?? booking.insurance.premiumAmount,
    ) || 0;
    if (totalAmount > 0) return true;
  }
  return null;
};

const pickNumber = (...values) => {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num) && num !== 0) return num;
  }
  return 0;
};

const normalizeInsuranceLeg = (leg) => {
  if (!leg || typeof leg !== "object") return null;
  const quantity = Number(leg.quantity ?? leg.seatCount) || 0;
  const unitPremiumAmount = Number(leg.unitPremiumAmount ?? leg.unitAmount) || 0;
  const coverageAmount = Number(leg.coverageAmount ?? leg.coverage) || 0;
  const totalAmount = pickNumber(
    leg.totalAmount,
    leg.amount,
    leg.premiumAmount,
    quantity * unitPremiumAmount,
  );
  const packageId = leg.insurancePackageId
    ?? leg.packageId
    ?? leg.id
    ?? null;
  const packageCode = leg.code ?? leg.packageCode ?? "";
  const packageName = leg.packageName ?? leg.name ?? "";
  const providerName = leg.providerName ?? "";
  const providerLogoUrl = leg.providerLogoUrl
    ?? leg.ProviderLogoUrl
    ?? leg.logoUrl
    ?? leg.LogoUrl
    ?? leg.imageUrl
    ?? leg.ImageUrl
    ?? leg.provider?.logoUrl
    ?? leg.provider?.providerLogoUrl
    ?? leg.provider?.imageUrl
    ?? leg.insuranceProvider?.logoUrl
    ?? leg.insuranceProvider?.providerLogoUrl
    ?? leg.insuranceProvider?.imageUrl
    ?? "";
  const terms = leg.terms ?? leg.conditions ?? leg.termUrl ?? leg.termsUrl ?? "";
  const source = leg.source ?? leg.providerSource ?? leg.provider?.source ?? "";

  if (!quantity && !totalAmount && !unitPremiumAmount && !packageName && !packageId) {
    return null;
  }

  return {
    packageId,
    packageCode,
    packageName,
    providerName,
    providerLogoUrl,
    source,
    quantity,
    unitPremiumAmount,
    coverageAmount,
    totalAmount,
    terms,
  };
};

export const normalizeInsuranceFromBooking = (booking) => {
  const insurance = booking?.insurance;
  const selected = resolveInsuranceSelected(booking);

  // Booking detail mới trả toàn bộ snapshot: mặc định + gói khách chọn thêm.
  const snapshots = Array.isArray(booking?.insurances) ? booking.insurances : [];
  if (snapshots.length > 0) {
    const legs = snapshots.map(normalizeInsuranceLeg).filter(Boolean);
    const defaultLeg = legs.find((leg, index) => Boolean(snapshots[index]?.isWaterbusDefault)) || null;
    const optionalLeg = legs.find((leg, index) => !snapshots[index]?.isWaterbusDefault) || null;
    const defaultAmount = Number(defaultLeg?.totalAmount) || 0;
    const optionalAmount = Number(optionalLeg?.totalAmount) || 0;
    const primary = defaultLeg || optionalLeg;
    return {
      mode: defaultLeg && optionalLeg ? "default+optional" : (defaultLeg ? "default" : "optional"),
      default: defaultLeg,
      optional: optionalLeg,
      defaultInsuranceAmount: defaultAmount,
      optionalInsuranceAmount: optionalAmount,
      totalInsuranceAmount: legs.reduce((sum, leg) => sum + (Number(leg.totalAmount) || 0), 0),
      quantity: (defaultLeg?.quantity || 0) + (optionalLeg?.quantity || 0),
      unitPremiumAmount: primary?.unitPremiumAmount || 0,
      coverageAmount: primary?.coverageAmount || 0,
      totalAmount: legs.reduce((sum, leg) => sum + (Number(leg.totalAmount) || 0), 0),
      packageId: primary?.packageId || null,
      packageCode: primary?.packageCode || "",
      packageName: primary?.packageName || "",
      providerName: primary?.providerName || "",
      providerLogoUrl: primary?.providerLogoUrl || "",
      terms: primary?.terms || "",
      selected: true,
    };
  }

  if (!insurance || typeof insurance !== "object") {
    if (selected === true) {
      const fallbackPackageId = getBookingInsurancePackageId(booking);
      const legacyAmount = pickNumber(
        booking?.insurance?.totalAmount,
        booking?.insurance?.amount,
        booking?.insurance?.premiumAmount,
      );
      return {
        mode: "default",
        default: {
          packageId: fallbackPackageId,
          packageCode: "",
          packageName: "",
          providerName: "",
          providerLogoUrl: "",
          source: "",
          quantity: 0,
          unitPremiumAmount: 0,
          coverageAmount: 0,
          totalAmount: legacyAmount,
          terms: "",
        },
        optional: null,
        defaultInsuranceAmount: legacyAmount,
        optionalInsuranceAmount: 0,
        totalInsuranceAmount: legacyAmount,
        quantity: 0,
        totalAmount: legacyAmount,
        terms: "",
        selected: true,
      };
    }
    return null;
  }

  // Chuẩn hoá: backend có thể trả defaultInsuranceAmount + optionalInsuranceAmount,
  // hoặc nested default/optional object, hoặc payload cũ (quantity/unit/totalAmount phẳng).
  const defaultLegRaw = insurance.default ?? insurance.defaultInsurance ?? null;
  const optionalLegRaw = insurance.optional ?? insurance.optionalInsurance ?? null;

  const defaultLeg = normalizeInsuranceLeg(defaultLegRaw);
  const optionalLeg = normalizeInsuranceLeg(optionalLegRaw);

  let defaultAmount = pickNumber(
    insurance.defaultInsuranceAmount,
    insurance.defaultAmount,
    defaultLeg?.totalAmount,
  );
  let optionalAmount = pickNumber(
    insurance.optionalInsuranceAmount,
    insurance.optionalAmount,
    optionalLeg?.totalAmount,
  );

  // Nếu BE không tách rõ default vs optional mà trả về phẳng,
  // suy ra default = unitPremiumAmount × (số khách - optionalPackageId? 1:0).
  if (!defaultLeg && !optionalLeg) {
    const quantity = Number(insurance.quantity ?? insurance.seatCount) || 0;
    const unitPremiumAmount = Number(insurance.unitPremiumAmount ?? insurance.unitAmount) || 0;
    const coverageAmount = Number(insurance.coverageAmount ?? insurance.coverage) || 0;
    const totalAmount = pickNumber(
      insurance.totalAmount,
      insurance.amount,
      insurance.premiumAmount,
      quantity * unitPremiumAmount,
    );
    const packageId = getBookingInsurancePackageId(booking);
    const packageCode = insurance.code ?? insurance.packageCode ?? "";
    const packageName = insurance.packageName ?? insurance.name ?? "";
    const providerName = insurance.providerName ?? "";
    const providerLogoUrl = insurance.providerLogoUrl
      ?? insurance.ProviderLogoUrl
      ?? insurance.logoUrl
      ?? insurance.LogoUrl
      ?? insurance.imageUrl
      ?? insurance.ImageUrl
      ?? insurance.provider?.logoUrl
      ?? insurance.provider?.providerLogoUrl
      ?? insurance.provider?.imageUrl
      ?? insurance.insuranceProvider?.logoUrl
      ?? insurance.insuranceProvider?.providerLogoUrl
      ?? insurance.insuranceProvider?.imageUrl
      ?? "";
    const terms = insurance.terms ?? insurance.conditions ?? insurance.termUrl ?? insurance.termsUrl ?? "";

    if (!quantity && !totalAmount && !unitPremiumAmount && !packageName && !packageId) {
      return null;
    }

    // Fallback: coi như default-only (chế độ cũ).
    return {
      mode: "default",
      default: {
        packageId,
        packageCode,
        packageName,
        providerName,
        providerLogoUrl,
        source: "",
        quantity,
        unitPremiumAmount,
        coverageAmount,
        totalAmount,
        terms,
      },
      optional: null,
      defaultInsuranceAmount: totalAmount,
      optionalInsuranceAmount: 0,
      totalInsuranceAmount: totalAmount,
      quantity,
      unitPremiumAmount,
      coverageAmount,
      totalAmount,
      packageId,
      packageCode,
      packageName,
      providerName,
      providerLogoUrl,
      terms,
      selected: selected !== false,
    };
  }

  // Trường hợp có defaultLeg nhưng BE không trả defaultAmount riêng → tự tính từ leg.totalAmount.
  if (defaultLeg && defaultAmount === 0) defaultAmount = defaultLeg.totalAmount;
  if (optionalLeg && optionalAmount === 0) optionalAmount = optionalLeg.totalAmount;

  const totalAmount = defaultAmount + optionalAmount;
  const primary = defaultLeg || optionalLeg;
  const mode = defaultLeg && optionalLeg
    ? "default+optional"
    : (defaultLeg ? "default" : "optional");

  return {
    mode,
    default: defaultLeg,
    optional: optionalLeg,
    defaultInsuranceAmount: defaultAmount,
    optionalInsuranceAmount: optionalAmount,
    totalInsuranceAmount: totalAmount,
    quantity: (defaultLeg?.quantity || 0) + (optionalLeg?.quantity || 0),
    unitPremiumAmount: primary?.unitPremiumAmount || 0,
    coverageAmount: primary?.coverageAmount || 0,
    totalAmount,
    packageId: primary?.packageId || null,
    packageCode: primary?.packageCode || "",
    packageName: primary?.packageName || "",
    providerName: primary?.providerName || "",
    providerLogoUrl: primary?.providerLogoUrl || "",
    terms: primary?.terms || "",
    selected: selected !== false,
  };
};
