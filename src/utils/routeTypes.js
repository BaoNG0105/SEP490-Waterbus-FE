/** Nhãn hiển thị theo routeType BE. */
export const getRouteKindLabel = (routeType, lang = "VN") => {
  switch (routeType) {
    case "CharterReference":
      return lang === "VN" ? "Route nguồn GPS" : "GPS source route";
    case "Charter":
      // BE ghép từ các chặng GPS cho 1 booking charter (không phải nguồn GPS).
      return lang === "VN" ? "Tuyến thuê riêng" : "Charter route";
    case "SightseeingLoop":
      return lang === "VN" ? "Vòng tham quan" : "Sightseeing loop";
    case "Regular":
      return lang === "VN" ? "Tuyến booking" : "Booking route";
    default:
      return routeType || "—";
  }
};

export const isCharterSourceRoute = (route) =>
  String(route?.routeType || "") === "CharterReference";

export const isCharterComposedRoute = (routeOrType) => {
  const type = typeof routeOrType === "string" ? routeOrType : routeOrType?.routeType;
  return String(type || "") === "Charter";
};

export const isSightseeingLoopRoute = (routeOrType) => {
  const type = typeof routeOrType === "string" ? routeOrType : routeOrType?.routeType;
  return String(type || "") === "SightseeingLoop";
};

/** Chỉ được ghép route nguồn GPS (CharterReference). */
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
        ? "Chỉ được ghép Route nguồn GPS (không ghép Vòng tham quan / Tuyến booking / Tuyến thuê riêng)."
        : "Only GPS source routes can be merged (not sightseeing / booking / charter routes).";
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
      ? "Không ghép thành vòng kín (điểm đầu = điểm cuối). Chiều về tạo tuyến booking riêng."
      : "Cannot merge into a closed loop (start = end). Create a separate return booking route.";
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
