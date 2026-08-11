/**
 * Nhãn BE `routeLabel` ngắn: Bus | GPS | Sightseeing | Charter
 * + map từ routeType cũ khi BE chưa trả routeLabel.
 * + fallback đọc mã tuyến (routeCode): BB / BS / BR / CH-CB / GPS.
 */
export const resolveRouteLabelKeyFromCode = (routeCode) => {
  const code = String(routeCode || "").trim().toUpperCase();
  if (!code) return "";
  if (/^CH[-_]?CB[-_]/i.test(code) || /^BR[-_]/i.test(code)) return "Charter";
  if (/^BB[-_]/i.test(code)) return "Bus";
  if (/^BS[-_]/i.test(code)) return "Sightseeing";
  if (/^GPS[-_]/i.test(code) || /^CR[-_]/i.test(code)) return "GPS";
  return "";
};

export const resolveRouteLabelKey = (routeOrTypeOrLabel) => {
  if (routeOrTypeOrLabel == null) return "";
  if (typeof routeOrTypeOrLabel === "string") {
    const raw = routeOrTypeOrLabel.trim();
    const fromCode = resolveRouteLabelKeyFromCode(raw);
    if (fromCode) return fromCode;
    const key = raw.toLowerCase().replace(/[_-\s]/g, "");
    if (["bus", "regular"].includes(key)) return "Bus";
    if (["gps", "charterreference"].includes(key)) return "GPS";
    if (["sightseeing", "sightseeingloop"].includes(key)) return "Sightseeing";
    if (key === "charter") return "Charter";
    return raw;
  }

  const fromLabel = String(routeOrTypeOrLabel.routeLabel || "").trim();
  if (fromLabel) return resolveRouteLabelKey(fromLabel);

  const fromType = resolveRouteLabelKey(routeOrTypeOrLabel.routeType || "");
  if (["Bus", "GPS", "Sightseeing", "Charter"].includes(fromType)) return fromType;

  // FE nhận định loại tuyến qua mã khi BE thiếu routeLabel/routeType.
  return resolveRouteLabelKeyFromCode(routeOrTypeOrLabel.routeCode || routeOrTypeOrLabel.code);
};

/**
 * Loại chuyến: ưu tiên serviceType BE (Bus | Sightseeing | Charter),
 * rồi routeLabel / routeType / tripType.
 * Prefix BB/BS/BR trên tripCode chỉ dùng fallback im lặng (không hiện badge).
 */
export const resolveTripKindKey = (tripOrCode) => {
  if (tripOrCode && typeof tripOrCode === "object") {
    const fromService = resolveRouteLabelKey(
      tripOrCode.serviceType || tripOrCode.ServiceType || "",
    );
    if (["Bus", "Sightseeing", "Charter"].includes(fromService)) return fromService;

    if (String(tripOrCode.tripType || "") === "Charter") return "Charter";

    const fromRoute = resolveRouteLabelKey(tripOrCode);
    if (fromRoute === "GPS") return "Charter";
    if (["Bus", "Sightseeing", "Charter"].includes(fromRoute)) return fromRoute;
  }

  const code = typeof tripOrCode === "string"
    ? tripOrCode
    : (tripOrCode?.tripCode || tripOrCode?.TripCode || "");
  const prefix = String(code).trim().toUpperCase().slice(0, 2);
  if (prefix === "BB") return "Bus";
  if (prefix === "BS") return "Sightseeing";
  if (prefix === "BR") return "Charter";
  return "";
};

/** Nhãn ngắn: Bus | Sightseeing | Request (Charter). */
export const getTripKindShortLabel = (tripOrCode) => {
  const key = resolveTripKindKey(tripOrCode);
  if (key === "Charter") return "Request (Charter)";
  return key || "";
};

/** Nhãn hiển thị đầy đủ theo routeLabel / routeType. */
export const getRouteKindLabel = (routeTypeOrRoute, lang = "VN") => {
  const key = resolveRouteLabelKey(routeTypeOrRoute);
  const isVn = lang === "VN";
  switch (key) {
    case "Bus":
      return isVn ? "Tuyến Waterbus" : "Waterbus route";
    case "GPS":
      return isVn ? "Tuyến nguồn GPS" : "GPS source route";
    case "Sightseeing":
      return isVn ? "Tuyến WaterSightseeing" : "WaterSightseeing route";
    case "Charter":
      return isVn ? "Tuyến Request" : "Request route";
    default:
      return key || "—";
  }
};

/** Badge ngắn trên UI (ưu tiên routeLabel BE). */
export const getRouteShortLabel = (routeOrTypeOrLabel, lang = "VN") => {
  const key = resolveRouteLabelKey(routeOrTypeOrLabel);
  if (["Bus", "GPS", "Sightseeing", "Charter"].includes(key)) return key;
  return getRouteKindLabel(routeOrTypeOrLabel, lang);
};

/** Màu chữ theo loại tuyến — dùng ở nơi chỉ cần chữ màu, không có khung/nền badge. */
export const getRouteKindTextColorClass = (routeOrTypeOrLabel) => {
  const key = resolveRouteLabelKey(routeOrTypeOrLabel);
  switch (key) {
    case "GPS":
      return "text-amber-700 dark:text-amber-300";
    case "Charter":
      return "text-[#124757] dark:text-yellow-400";
    case "Sightseeing":
      return "text-violet-700 dark:text-violet-300";
    case "Bus":
      return "text-teal-700 dark:text-teal-300";
    default:
      return "text-slate-500 dark:text-slate-400";
  }
};

export const isCharterSourceRoute = (route) => {
  const key = resolveRouteLabelKey(route);
  if (key === "GPS") return true;
  return String(route?.routeType || "") === "CharterReference";
};

export const isCharterComposedRoute = (routeOrType) => {
  const key = resolveRouteLabelKey(routeOrType);
  if (key === "Charter") return true;
  const type = typeof routeOrType === "string" ? routeOrType : routeOrType?.routeType;
  return String(type || "") === "Charter";
};

export const isSightseeingLoopRoute = (routeOrType) => {
  const key = resolveRouteLabelKey(routeOrType);
  if (key === "Sightseeing") return true;
  const type = typeof routeOrType === "string" ? routeOrType : routeOrType?.routeType;
  return String(type || "") === "SightseeingLoop";
};

/**
 * Nhãn tuyến hiển thị cho khách — bỏ jargon BE (SightseeingLoop, "Vòng sightseeing").
 * VD: "Bến Bạch Đằng · Vòng sightseeing" → "Bến Bạch Đằng"
 */
export const formatCustomerRouteTitle = (routeName, routeCode = "", lang = "VN") => {
  let name = String(routeName || "").trim();
  name = name
    .replace(/\s*[·•|/]\s*Vòng\s*sightseeing\s*$/i, "")
    .replace(/\s*[·•|/]\s*Sightseeing\s*Loop\s*$/i, "")
    .replace(/\s*[·•|/]\s*SightseeingLoop\s*$/i, "")
    .replace(/\bSightseeingLoop\b/gi, "")
    .replace(/\bVòng\s*sightseeing\b/gi, "")
    .replace(/\bSightseeing\s*Loop\b/gi, "")
    .replace(/\s*[·•|/]\s*$/g, "")
    .replace(/^\s*[·•|/]\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (name) return name;

  const code = String(routeCode || "").trim();
  if (code && !/sightseeing|loop/i.test(code)) return code;
  return lang === "VN" ? "Tour tham quan" : "Sightseeing tour";
};

export const isGeneratedBookingRoute = (route) => {
  if (!route || typeof route !== "object") return false;
  if (route.isGeneratedForBooking === true) return true;
  return isCharterComposedRoute(route);
};

/** Chỉ được ghép route nguồn GPS (CharterReference / GPS). */
export const canSelectForMerge = (route) => isCharterSourceRoute(route);

/**
 * Chuỗi ghép A-B + B-C: cuối đoạn trước = đầu đoạn sau.
 * Không cho thành vòng kín A → … → A.
 */
export const validateMergeRouteChain = (orderedRoutes, lang = "VN") => {
  if (!Array.isArray(orderedRoutes) || orderedRoutes.length < 2) {
    return lang === "VN" ? "Cần chọn ít nhất 2 tuyến để ghép." : "Select at least 2 routes to merge.";
  }

  for (const route of orderedRoutes) {
    if (!isCharterSourceRoute(route)) {
      return lang === "VN"
        ? "Chỉ được ghép Route nguồn GPS (không ghép Vòng tham quan / Tuyến bán vé / Route charter)."
        : "Only GPS source routes can be merged (not sightseeing / bus / charter routes).";
    }
  }

  for (let i = 0; i < orderedRoutes.length - 1; i += 1) {
    const currentStops = (orderedRoutes[i].stops || []).slice().sort((a, b) => a.stopOrder - b.stopOrder);
    const nextStops = (orderedRoutes[i + 1].stops || []).slice().sort((a, b) => a.stopOrder - b.stopOrder);
    const endId = String(currentStops[currentStops.length - 1]?.stationId || "");
    const startId = String(nextStops[0]?.stationId || "");
    if (!endId || !startId || endId !== startId) {
      return lang === "VN"
        ? `Không nối được: tuyến ${i + 1} kết thúc khác điểm đầu tuyến ${i + 2} (cần A-B + B-C).`
        : `Cannot chain: route ${i + 1} end must equal route ${i + 2} start (A-B + B-C).`;
    }
  }

  const firstStops = (orderedRoutes[0].stops || []).slice().sort((a, b) => a.stopOrder - b.stopOrder);
  const lastStops = (orderedRoutes[orderedRoutes.length - 1].stops || [])
    .slice()
    .sort((a, b) => a.stopOrder - b.stopOrder);
  const chainStartId = String(firstStops[0]?.stationId || "");
  const chainEndId = String(lastStops[lastStops.length - 1]?.stationId || "");
  if (chainStartId && chainEndId && chainStartId === chainEndId) {
    return lang === "VN"
      ? "Không ghép thành vòng kín (điểm đầu = điểm cuối). Chiều về tạo tuyến bán vé riêng."
      : "Cannot merge into a closed loop (start = end). Create a separate return bus route.";
  }

  return null;
};

/** Tuyến từ GPS / đã ghép / tuyến thuê riêng — cảnh báo không chỉnh bến. */
export const isGpsOrMergedRoute = (route) => {
  if (!route) return false;
  if (route.fromGps === true || route.isFromGps === true || route.createdFromGps === true) return true;
  if (String(route.source || route.createdVia || "").toLowerCase().includes("gps")) return true;
  if (Array.isArray(route.sourceRouteIds) && route.sourceRouteIds.length > 0) return true;
  if (isCharterSourceRoute(route)) return true;
  if (isCharterComposedRoute(route)) return true;
  return false;
};
