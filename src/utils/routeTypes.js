/**
 * Nhãn BE `routeLabel` ngắn: Bus | GPS | Sightseeing | Charter
 * + map từ routeType cũ khi BE chưa trả routeLabel.
 */
export const resolveRouteLabelKey = (routeOrTypeOrLabel) => {
  if (routeOrTypeOrLabel == null) return "";
  if (typeof routeOrTypeOrLabel === "string") {
    const raw = routeOrTypeOrLabel.trim();
    const key = raw.toLowerCase().replace(/[_-\s]/g, "");
    if (["bus", "regular"].includes(key)) return "Bus";
    if (["gps", "charterreference"].includes(key)) return "GPS";
    if (["sightseeing", "sightseeingloop"].includes(key)) return "Sightseeing";
    if (key === "charter") return "Charter";
    return raw;
  }

  const fromLabel = String(routeOrTypeOrLabel.routeLabel || "").trim();
  if (fromLabel) return resolveRouteLabelKey(fromLabel);
  return resolveRouteLabelKey(routeOrTypeOrLabel.routeType || "");
};

/** Nhãn hiển thị đầy đủ theo routeLabel / routeType. */
export const getRouteKindLabel = (routeTypeOrRoute, lang = "VN") => {
  const key = resolveRouteLabelKey(routeTypeOrRoute);
  const isVn = lang === "VN";
  switch (key) {
    case "Bus":
      return isVn ? "Tuyến bán vé thường" : "Regular ticket route";
    case "GPS":
      return isVn ? "Route nguồn GPS" : "GPS source route";
    case "Sightseeing":
      return isVn ? "Route vòng tham quan" : "Sightseeing route";
    case "Charter":
      return isVn ? "Route charter" : "Charter route";
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
