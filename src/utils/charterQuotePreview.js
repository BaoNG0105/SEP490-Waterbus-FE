import { getCharterDepositAmount } from "./charterBookingActions";
import { normalizeInsuranceFromBooking } from "./insurancePreview";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

export const QUOTE_FREE_STOP_MINUTES = 30;
export const QUOTE_BUFFER_RATE = 0.1;

export const getQuoteChargeableMinutes = (decimalHours, routeEstimate = null) => {
  const hours = Number(decimalHours) || 0;
  if (hours <= 0) return 0;

  const fromHours = Math.round(hours * 60);
  const chargeableMinutes = Number(routeEstimate?.chargeableDurationMinutes);
  if (Number.isFinite(chargeableMinutes) && chargeableMinutes > 0) {
    return chargeableMinutes;
  }

  const travelMinutes = Number(
    Number.isFinite(Number(routeEstimate?.estimatedDurationMinutes)) && Number(routeEstimate?.estimatedDurationMinutes) > 0
      ? routeEstimate.estimatedDurationMinutes
      : routeEstimate?.estimatedTravelMinutes,
  );
  if (Number.isFinite(travelMinutes) && travelMinutes > 0) {
    const withBuffer = Math.round(travelMinutes + Math.ceil(travelMinutes * QUOTE_BUFFER_RATE));
    return fromHours || withBuffer;
  }
  return fromHours;
};

export const formatQuoteHumanDuration = (totalMinutes, lang = "VN") => {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours > 0 && remainder > 0) {
    return lang === "VN" ? `${hours} giờ ${remainder} phút` : `${hours}h ${remainder}m`;
  }
  if (hours > 0) {
    return lang === "VN" ? `${hours} giờ` : `${hours}h`;
  }
  return lang === "VN" ? `${minutes} phút` : `${minutes} min`;
};

export const resolveQuoteRentalUnit = (preview, { defaultRentalUnit = "Day", forcedRentalUnit = "" } = {}) => {
  if (forcedRentalUnit === "Day" || forcedRentalUnit === "Hour") return forcedRentalUnit;

  const routeEstimate = preview?.routeEstimate;
  const routeUnit = typeof routeEstimate === "object"
    ? pick(routeEstimate, ["rentalUnit"], "")
    : "";
  const previewUnit = pick(preview, ["rentalUnit"], "");
  return previewUnit || routeUnit || defaultRentalUnit || "Day";
};

export const isHourlyQuoteRental = (rentalUnit) => String(rentalUnit || "") === "Hour";

export const formatQuoteRentalUnit = (rentalUnit, lang = "VN") => {
  if (isHourlyQuoteRental(rentalUnit)) return lang === "VN" ? "Theo giờ" : "Hourly";
  return lang === "VN" ? "Theo ngày" : "Daily";
};

export const formatQuoteUnitPriceLabel = (unitPrice, rentalUnit, currencyFormatter, lang = "VN") => {
  const suffix = isHourlyQuoteRental(rentalUnit)
    ? (lang === "VN" ? "/giờ" : "/hr")
    : (lang === "VN" ? "/ngày" : "/day");
  return `${currencyFormatter.format(Number(unitPrice) || 0)}${suffix}`;
};

export const formatQuoteChargeableDuration = (value, rentalUnit, lang = "VN", routeEstimate = null) => {
  const amount = Number(value) || 0;
  if (amount <= 0) return "--";

  if (isHourlyQuoteRental(rentalUnit)) {
    const chargeableMinutes = getQuoteChargeableMinutes(amount, routeEstimate);
    return lang === "VN"
      ? `${chargeableMinutes} phút (${formatQuoteHumanDuration(chargeableMinutes, lang)})`
      : `${chargeableMinutes} min (${formatQuoteHumanDuration(chargeableMinutes, lang)})`;
  }

  const dayLabel = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, "");
  return lang === "VN" ? `${dayLabel} ngày` : `${dayLabel} day(s)`;
};

const getRoutePricingBreakdown = (routeEstimate, lang = "VN") => {
  if (!routeEstimate || typeof routeEstimate !== "object") return [];

  const distance = Number(routeEstimate.totalDistanceKm);
  const estimatedDurationMinutes = Number(routeEstimate.estimatedDurationMinutes);
  const travelMinutes = Number.isFinite(estimatedDurationMinutes) && estimatedDurationMinutes > 0
    ? estimatedDurationMinutes
    : Number(routeEstimate.estimatedTravelMinutes);
  const bufferMinutes = Number.isFinite(travelMinutes) && travelMinutes > 0
    ? Math.ceil(travelMinutes * QUOTE_BUFFER_RATE)
    : Number(pick(routeEstimate, ["bufferMinutes", "bufferDurationMinutes"], 0)) || 0;
  const freeStopMinutes = Number(pick(routeEstimate, ["freeWaitingMinutesPerStop", "freeStopMinutes"], QUOTE_FREE_STOP_MINUTES)) || QUOTE_FREE_STOP_MINUTES;
  const stopChargeAmount = Number(pick(routeEstimate, [
    "stopWaitingChargeAmount",
    "stopChargeAmount",
    "totalStopChargeAmount",
    "waitingChargeAmount",
    "stopFeeAmount",
  ], 0)) || 0;
  const stopChargeMinutes = Number(pick(routeEstimate, [
    "chargeableStopMinutes",
    "totalStopWaitingMinutes",
    "stopWaitingMinutes",
    "billableStopMinutes",
  ], 0)) || 0;

  const lines = [];

  if (Number.isFinite(distance) && distance > 0) {
    lines.push({
      key: "distance",
      label: lang === "VN" ? "Quãng đường di chuyển" : "Travel distance",
      detail: `${distance.toFixed(1)} km`,
    });
  }
  if (Number.isFinite(travelMinutes) && travelMinutes > 0) {
    lines.push({
      key: "travel",
      label: lang === "VN" ? "Thời gian di chuyển" : "Travel time",
      detail: `${travelMinutes} ${lang === "VN" ? "phút" : "min"}`,
    });
  }
  if (stopChargeAmount > 0 || stopChargeMinutes > 0) {
    lines.push({
      key: "stop",
      label: lang === "VN"
        ? `Phí dừng tại điểm (>${freeStopMinutes} phút miễn phí)`
        : `Stop fee (>${freeStopMinutes} min free)`,
      detail: stopChargeMinutes > 0
        ? `${stopChargeMinutes} ${lang === "VN" ? "phút tính phí" : "billable min"}`
        : "",
      amount: stopChargeAmount > 0 ? stopChargeAmount : null,
    });
  }
  if (bufferMinutes > 0) {
    lines.push({
      key: "buffer",
      label: lang === "VN" ? "Phụ phí buffer 10%" : "10% buffer surcharge",
      detail: `+${bufferMinutes} ${lang === "VN" ? "phút" : "min"}`,
    });
  }

  return lines;
};

export const buildQuotePreviewModel = (preview, options = {}) => {
  const {
    defaultRentalUnit = "Day",
    forcedRentalUnit = "",
    boatsCatalog = [],
    quoteBoats = [],
    getBoatId = (boat) => String(boat?.id || boat?.boatId || ""),
    getBoatPrice = null,
    currencyFormatter,
    lang = "VN",
  } = options;

  const formatMoney = (value) => (
    currencyFormatter
      ? currencyFormatter.format(Number(value) || 0)
      : Number(value || 0).toLocaleString("vi-VN")
  );

  const routeEstimate = pick(preview, ["routeEstimate"], null);
  const rentalUnit = resolveQuoteRentalUnit(preview, { defaultRentalUnit, forcedRentalUnit });
  const boats = Array.isArray(preview?.boats) ? preview.boats : [];
  const routeLines = isHourlyQuoteRental(rentalUnit) ? getRoutePricingBreakdown(routeEstimate, lang) : [];
  const findCatalogBoat = (boatId) => (
    Array.isArray(boatsCatalog)
      ? boatsCatalog.find((boat) => String(getBoatId(boat)) === String(boatId))
      : null
  );

  const boatRows = boats.map((boat, index) => {
    const boatOrder = Number(pick(boat, ["boatOrder"], index + 1)) || index + 1;
    const boatName = pick(boat, ["boatName", "name", "boat.name"], "");
    const selectedBoatId = quoteBoats.find((item) => Number(item.boatOrder) === boatOrder)?.boatId
      || pick(boat, ["boatId", "id", "boat.id"], "");
    const catalogBoat = findCatalogBoat(selectedBoatId);

    let rowRentalUnit = pick(boat, ["rentalUnit"], rentalUnit) || rentalUnit;
    let unitPrice = Number(pick(boat, ["unitPrice"], 0)) || 0;
    let chargeableDuration = Number(pick(boat, ["chargeableDurationValue", "durationValue"], 0)) || 0;
    let lineTotal = Number(pick(boat, ["subtotalAmount", "lineTotal"], 0)) || 0;

    // Admin selected Day/Hour must win over BE response when they disagree.
    if (forcedRentalUnit === "Day" || forcedRentalUnit === "Hour") {
      rowRentalUnit = forcedRentalUnit;
      if (typeof getBoatPrice === "function" && catalogBoat) {
        const catalogPrice = Number(getBoatPrice(catalogBoat, forcedRentalUnit)) || 0;
        if (catalogPrice > 0) unitPrice = catalogPrice;
      }
      if (forcedRentalUnit === "Day") {
        chargeableDuration = chargeableDuration > 0 && !isHourlyQuoteRental(pick(boat, ["rentalUnit"], ""))
          ? chargeableDuration
          : 1;
        lineTotal = unitPrice * chargeableDuration;
      } else if (forcedRentalUnit === "Hour") {
        // Keep BE chargeable duration/minutes when hourly; refresh unit price from catalog if available.
        if (lineTotal <= 0 && unitPrice > 0 && chargeableDuration > 0) {
          lineTotal = unitPrice * chargeableDuration;
        }
      }
    }

    const chargeableMinutes = isHourlyQuoteRental(rowRentalUnit)
      ? getQuoteChargeableMinutes(chargeableDuration, routeEstimate)
      : 0;

    return {
      boatOrder,
      boatName,
      rentalUnit: rowRentalUnit,
      unitPrice,
      chargeableDuration,
      chargeableMinutes,
      durationLabel: formatQuoteChargeableDuration(chargeableDuration, rowRentalUnit, lang, routeEstimate),
      lineTotal,
      unitPriceLabel: formatQuoteUnitPriceLabel(unitPrice, rowRentalUnit, currencyFormatter, lang),
    };
  });

  const autoSubtotal = boatRows.reduce((sum, row) => sum + row.lineTotal, 0);
  const apiSubtotal = Number(pick(preview, ["subtotalAmount", "subtotalBeforeDiscount"], 0)) || 0;
  const useForcedDayTotals = forcedRentalUnit === "Day";
  const subtotalBeforeDiscount = useForcedDayTotals
    ? autoSubtotal
    : (apiSubtotal > 0 ? apiSubtotal : autoSubtotal);

  const discountAmount = useForcedDayTotals
    ? 0
    : (Number(pick(preview, ["discountAmount"], 0)) || 0);
  const totalAmount = useForcedDayTotals
    ? Math.max(subtotalBeforeDiscount - discountAmount, 0)
    : (Number(pick(preview, ["totalAmount", "finalAmount"], 0))
      || Math.max(subtotalBeforeDiscount - discountAmount, 0));

  const promotionCode = useForcedDayTotals ? "" : (pick(preview, ["promotionCode"], "") || pick(preview, ["promotion.code"], ""));
  const promotionType = useForcedDayTotals ? "" : pick(preview, ["promotion.type", "promotionType"], "");
  const promotionValue = useForcedDayTotals
    ? 0
    : (Number(pick(preview, ["promotion.discountValue", "promotionDiscountValue"], 0)) || 0);

  const deposit = getCharterDepositAmount(totalAmount, useForcedDayTotals ? 0 : (Number(pick(preview, ["depositAmount"], 0)) || 0));
  const insuranceSource = {
    insuranceSelected: preview?.insuranceSelected ?? options.booking?.insuranceSelected,
    insurancePackageId: preview?.insurancePackageId ?? options.booking?.insurancePackageId,
    insurance: preview?.insurance ?? options.booking?.insurance,
  };
  const insurance = normalizeInsuranceFromBooking(insuranceSource);

  return {
    rentalUnit,
    rentalUnitLabel: formatQuoteRentalUnit(rentalUnit, lang),
    routeLines,
    boatRows,
    autoSubtotal,
    subtotalBeforeDiscount,
    discountAmount,
    totalAmount,
    promotionCode,
    promotionType,
    promotionValue,
    deposit,
    insurance,
    routeEstimate,
    formatMoney,
  };
};

export const getQuoteDiscountLabel = (model, lang = "VN") => {
  if (!model?.discountAmount) {
    return lang === "VN" ? "Giảm giá" : "Discount";
  }
  if (model.promotionCode) {
    if (model.promotionType === "Percent" && model.promotionValue > 0) {
      return lang === "VN"
        ? `Giảm giá · ${model.promotionCode} (${model.promotionValue}%)`
        : `Discount · ${model.promotionCode} (${model.promotionValue}%)`;
    }
    return lang === "VN"
      ? `Giảm giá · ${model.promotionCode}`
      : `Discount · ${model.promotionCode}`;
  }
  return lang === "VN" ? "Giảm giá" : "Discount";
};

export const formatQuoteRouteEstimate = (routeEstimate, lang = "VN", defaultRentalUnit = "Day") => {
  if (!routeEstimate) return "";
  if (typeof routeEstimate === "string") return routeEstimate;
  if (typeof routeEstimate !== "object") return String(routeEstimate);

  return getRoutePricingBreakdown(routeEstimate, lang)
    .map((line) => `${line.label}: ${line.detail}${line.amount ? ` · ${line.amount}` : ""}`)
    .join(" · ");
};

export const formatQuoteRentalDuration = formatQuoteChargeableDuration;
