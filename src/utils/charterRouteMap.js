import { fetchAllRoutes, fetchRouteDetail } from "../services/routeService";
import { fetchAllStations } from "../services/stationService";
import { fetchWaterwayDetail } from "../services/waterwayService";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

export const geometryToCoordinates = (geometry) => {
  if (!geometry) return [];

  if (typeof geometry === "object" && !Array.isArray(geometry)) {
    if (geometry.type === "Feature" && geometry.geometry) {
      return geometryToCoordinates(geometry.geometry);
    }
    if (geometry.type === "FeatureCollection" && Array.isArray(geometry.features)) {
      return geometry.features.flatMap((feature) => geometryToCoordinates(feature));
    }
    if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
      return geometryToCoordinates(geometry.coordinates);
    }
    if (Array.isArray(geometry.coordinates)) {
      return geometryToCoordinates(geometry.coordinates);
    }
    if (Array.isArray(geometry.routeGeometry)) {
      return geometryToCoordinates(geometry.routeGeometry);
    }
  }

  if (!Array.isArray(geometry)) return [];

  return geometry
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map(([lng, lat]) => ({ latitude: Number(lat), longitude: Number(lng) }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
};

export const spliceStationsIntoRouteLine = (linePositions, orderedStations) => {
  if (!linePositions || linePositions.length === 0) return [];
  if (!orderedStations || orderedStations.length === 0) return linePositions;

  const result = [];
  let cursor = 0;

  orderedStations.forEach((station, index) => {
    const stationPos = [station.latitude, station.longitude];
    let nearestIndex = cursor;
    let minDistSq = Infinity;
    for (let i = cursor; i < linePositions.length; i += 1) {
      const dLat = linePositions[i][0] - stationPos[0];
      const dLng = linePositions[i][1] - stationPos[1];
      const distSq = dLat * dLat + dLng * dLng;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearestIndex = i;
      }
    }

    if (index === 0) {
      result.push(stationPos);
    } else {
      result.push(...linePositions.slice(cursor, nearestIndex));
      result.push(stationPos);
    }
    cursor = nearestIndex;
  });

  return result;
};

const getBookingRouteSource = (booking) => booking?.raw || booking;

const toMapStation = (station, fallbackName = "") => {
  const latitude = Number(pick(station, ["latitude", "lat", "station.latitude"], NaN));
  const longitude = Number(pick(station, ["longitude", "lng", "lon", "station.longitude"], NaN));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    stationId: String(pick(station, ["stationId", "id", "station.id"], `${latitude},${longitude}`)),
    stationName: pick(station, ["stationName", "name", "station.stationName"], fallbackName) || fallbackName || "--",
    address: pick(station, ["address", "station.address"], ""),
    latitude,
    longitude,
    status: "Active",
  };
};

const buildFallbackStations = (booking, stationById) => {
  const points = [];
  const pushStation = (stationId, fallbackName, roleKey) => {
    const id = String(stationId || "");
    const fromCatalog = id ? stationById.get(id) : null;
    const mapped = toMapStation(fromCatalog || { stationId: id }, fallbackName);
    if (!mapped) return;
    // Key marker unique kể cả round-trip (from = to cùng bến).
    mapped.stationId = `${mapped.stationId}__${roleKey}`;
    points.push(mapped);
  };

  const fromId = String(booking?.fromStationId || "");
  const toId = String(booking?.toStationId || "");

  pushStation(fromId, booking?.fromStationName || "Bến đón", "from");
  (Array.isArray(booking?.itineraryStops) ? booking.itineraryStops : []).forEach((stop, index) => {
    pushStation(stop.stationId, stop.stationName || `Dừng ${index + 1}`, `stop-${index + 1}`);
  });
  // Round-trip: bỏ marker "to" trùng from — vẫn còn stop giữa.
  if (toId && toId !== fromId) {
    pushStation(toId, booking?.toStationName || "Bến trả", "to");
  }

  return points;
};

/** Nhãn overlay map: chỉ bến → bến, không kèm mã CB- / routeCode. */
const buildBookingStationsLabel = (booking) => {
  const from = String(booking?.fromStationName || "").trim();
  const to = String(booking?.toStationName || "").trim();
  if (from && to) return `${from} → ${to}`;
  if (from) return from;
  if (to) return to;
  return "";
};

const buildStationsOnlyModel = (booking, stationById) => {
  const fallbackStations = buildFallbackStations(booking, stationById);
  return {
    routeName: buildBookingStationsLabel(booking),
    // Chỉ marker bến — chưa vẽ polyline route khi admin chưa chọn / chốt routeId.
    coordinates: [],
    stations: fallbackStations,
    source: "stations-only",
  };
};

/** Route IDs được phép vẽ official trên map: selectedRoute / routePlan đã chọn — không lấy matchedRoute* auto. */
export const resolveCharterDisplayRouteIds = (booking) => {
  const ids = [];
  const pushId = (value) => {
    const id = String(value || "").trim();
    if (id && !ids.includes(id)) ids.push(id);
  };

  pushId(booking?.selectedRoute?.routeId);
  pushId(booking?.selectedRouteId);
  pushId(pick(booking?.raw || {}, ["selectedRoute.routeId", "selectedRoute.id", "selectedRouteId"], ""));

  const plan = Array.isArray(booking?.routePlan) ? booking.routePlan : [];
  plan.forEach((row) => pushId(row?.routeId));

  // Customer detail đôi khi chỉ có matchedRoute sau khi admin đã chốt giá.
  const status = String(booking?.status || "");
  const alreadyQuoted = Boolean(status) && status !== "PendingQuote";
  if (ids.length === 0 && alreadyQuoted) {
    pushId(booking?.matchedRouteId);
    pushId(pick(booking?.raw || {}, ["matchedRouteId", "routeId", "matchedRoute.routeId"], ""));
    (Array.isArray(booking?.routeLegs) ? booking.routeLegs : []).forEach((leg) => {
      pushId(leg?.matchedRouteId);
    });
    const estimateLegs = Array.isArray(booking?.routeEstimate?.legs) ? booking.routeEstimate.legs : [];
    estimateLegs.forEach((leg) => {
      pushId(pick(leg, ["matchedRouteId", "routeId", "matchedRoute.routeId", "matchedRoute.id"], ""));
    });
  }

  return ids;
};

export const resolveCharterDisplayRouteCodes = (booking) => {
  const codes = [];
  const pushCode = (value) => {
    const code = String(value || "").trim();
    if (code && !codes.includes(code)) codes.push(code);
  };

  pushCode(booking?.selectedRoute?.routeCode);
  pushCode(pick(booking?.raw || {}, ["selectedRoute.routeCode", "selectedRouteCode"], ""));

  const status = String(booking?.status || "");
  const alreadyQuoted = Boolean(status) && status !== "PendingQuote";
  if (codes.length === 0 && alreadyQuoted) {
    pushCode(booking?.matchedRouteCode);
    pushCode(pick(booking?.raw || {}, ["matchedRouteCode", "routeCode"], ""));
    (Array.isArray(booking?.routeLegs) ? booking.routeLegs : []).forEach((leg) => {
      pushCode(leg?.matchedRouteCode);
    });
  }

  return codes;
};

const extractEmbeddedRouteGeometry = (booking) => {
  const source = getBookingRouteSource(booking);
  // Chỉ lấy geometry từ selectedRoute đã chốt — không lấy matched estimate.
  const selected = booking?.selectedRoute || source?.selectedRoute;
  const candidates = [
    selected?.routeGeometry,
    selected?.geometry,
    source?.selectedRouteGeometry,
  ];

  for (const candidate of candidates) {
    const coordinates = geometryToCoordinates(candidate);
    if (coordinates.length >= 2) return coordinates;
  }
  return [];
};

const loadRouteMapData = async (routeId, stationById, routeDetail = null) => {
  const detail = routeDetail || await fetchRouteDetail(routeId);
  const stops = (detail?.stops || []).slice().sort((a, b) => (a.stopOrder || 0) - (b.stopOrder || 0));
  const mapStations = stops
    .map((stop) => {
      const stationInfo = stationById.get(String(stop.stationId)) || stop;
      return toMapStation({
        ...stationInfo,
        stationId: stop.stationId,
        stationName: stop.stationName || stationInfo?.stationName,
      });
    })
    .filter(Boolean);

  let coordinates = geometryToCoordinates(detail?.routeGeometry);

  if (coordinates.length === 0 && Array.isArray(detail?.segments) && detail.segments.length > 0) {
    const sortedSegments = detail.segments.slice().sort((a, b) => (a.segmentOrder || 0) - (b.segmentOrder || 0));
    const waterwayIds = sortedSegments.map((seg) => seg.waterwayId || seg.wayId).filter(Boolean);
    const waterwayDetails = await Promise.all(
      waterwayIds.map((waterwayId) => fetchWaterwayDetail(waterwayId).catch(() => null)),
    );
    coordinates = waterwayDetails
      .filter(Boolean)
      .flatMap((wd) => (wd.segments || [])
        .slice()
        .sort((a, b) => a.segmentOrder - b.segmentOrder)
        .flatMap((segment) => geometryToCoordinates(segment.coordinates || segment.geometry || [])));
  }

  if (coordinates.length > 0 && mapStations.length > 0) {
    const linePositions = coordinates.map((point) => [point.latitude, point.longitude]);
    const spliced = spliceStationsIntoRouteLine(linePositions, mapStations);
    coordinates = spliced.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
  }

  return {
    routeId: String(detail?.routeId || detail?.id || routeId),
    routeName: detail?.routeName || detail?.routeCode || "",
    coordinates,
    stations: mapStations,
  };
};

const findNearestCoordIndex = (coordinates, station, startAt = 0) => {
  if (!station || !Array.isArray(coordinates) || coordinates.length === 0) return startAt;
  let best = Math.min(Math.max(0, startAt), coordinates.length - 1);
  let minDistSq = Infinity;
  for (let i = best; i < coordinates.length; i += 1) {
    const dLat = coordinates[i].latitude - station.latitude;
    const dLng = coordinates[i].longitude - station.longitude;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistSq) {
      minDistSq = distSq;
      best = i;
    }
  }
  return best;
};

/**
 * Cắt polyline + stops của 1 route nguồn về đúng đoạn chặng (from → to).
 * Khi FE có 2+ tuyến: mỗi chặng cắt riêng rồi nối lên map, không vẽ cả vòng A→…→A.
 */
export const cropRouteMapToLeg = (routeMap, fromStationId, toStationId) => {
  if (!routeMap) return routeMap;
  const fromId = String(fromStationId || "").trim();
  const toId = String(toStationId || "").trim();
  if (!fromId || !toId) return routeMap;

  const stations = Array.isArray(routeMap.stations) ? routeMap.stations : [];
  const fromIdx = stations.findIndex((station) => String(station.stationId) === fromId);
  const toIdx = stations.findIndex((station) => String(station.stationId) === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= toIdx) return routeMap;

  const legStations = stations.slice(fromIdx, toIdx + 1);
  const coordinates = Array.isArray(routeMap.coordinates) ? routeMap.coordinates : [];
  if (coordinates.length < 2) {
    return { ...routeMap, stations: legStations };
  }

  const startCoord = findNearestCoordIndex(coordinates, stations[fromIdx], 0);
  const endCoord = findNearestCoordIndex(coordinates, stations[toIdx], startCoord);
  const cropped = coordinates.slice(startCoord, endCoord + 1);
  if (cropped.length < 2) {
    return { ...routeMap, stations: legStations };
  }

  return {
    ...routeMap,
    coordinates: cropped,
    stations: legStations,
  };
};

/** Nối đoạn đường nhiều tuyến; bỏ điểm trùng ở mối nối. */
export const stitchRouteMapCoordinates = (routeMaps) => {
  const list = Array.isArray(routeMaps) ? routeMaps : [];
  return list.reduce((acc, item, index) => {
    const coords = Array.isArray(item?.coordinates) ? item.coordinates : [];
    if (coords.length === 0) return acc;
    if (index === 0 || acc.length === 0) return acc.concat(coords);

    const prev = acc[acc.length - 1];
    const next = coords[0];
    const samePoint = prev
      && next
      && Math.abs(prev.latitude - next.latitude) < 1e-7
      && Math.abs(prev.longitude - next.longitude) < 1e-7;
    return acc.concat(samePoint ? coords.slice(1) : coords);
  }, []);
};

const resolveRoutesFromCatalog = async (routeIds, routeCodes) => {
  if (routeIds.length === 0 && routeCodes.length === 0) return [];
  try {
    const routes = await fetchAllRoutes();
    const list = Array.isArray(routes) ? routes : [];
    const matched = [];
    const seen = new Set();

    const pushRoute = (route) => {
      const id = String(route?.routeId || route?.id || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      matched.push(route);
    };

    routeIds.forEach((routeId) => {
      const found = list.find((route) => String(route?.routeId || route?.id) === String(routeId));
      if (found) pushRoute(found);
    });

    routeCodes.forEach((code) => {
      const found = list.find((route) => String(route?.routeCode || "") === String(code));
      if (found) pushRoute(found);
    });

    return matched;
  } catch (error) {
    console.error("Không tải được danh sách tuyến để vẽ bản đồ:", error);
    return [];
  }
};

/**
 * Load map polyline + station markers.
 * Official route line chỉ khi đã có selectedRoute / routePlan — không auto vẽ matchedRoute* (TEST123).
 */
export const loadCharterRouteMapModel = async (booking) => {
  const stationList = await fetchAllStations().catch(() => []);
  const stationById = new Map(
    (Array.isArray(stationList) ? stationList : []).map((station) => [
      String(station.stationId || station.id),
      station,
    ]),
  );

  const bookingStations = buildFallbackStations(booking, stationById);
  const routeIds = resolveCharterDisplayRouteIds(booking);
  const routeCodes = resolveCharterDisplayRouteCodes(booking);
  const stationsLabel = buildBookingStationsLabel(booking);

  // Chưa chọn / chốt route → chỉ hiện marker bến, không vẽ polyline "đã khớp".
  if (routeIds.length === 0 && routeCodes.length === 0) {
    return buildStationsOnlyModel(booking, stationById);
  }

  const embeddedCoordinates = extractEmbeddedRouteGeometry(booking);
  if (embeddedCoordinates.length >= 3) {
    return {
      routeName: stationsLabel,
      coordinates: embeddedCoordinates,
      stations: bookingStations.length > 0 ? bookingStations : [],
      source: "selected-route",
    };
  }

  const routePlan = (Array.isArray(booking?.routePlan) ? booking.routePlan : [])
    .filter((row) => String(row?.routeId || "").trim());
  const planByRouteId = new Map(
    routePlan.map((row) => [String(row.routeId), row]),
  );

  const routeMaps = [];
  const pushCroppedRouteMap = (mapData, routeId) => {
    const planRow = planByRouteId.get(String(routeId || mapData?.routeId || ""));
    if (planRow?.fromStationId && planRow?.toStationId) {
      routeMaps.push(cropRouteMapToLeg(mapData, planRow.fromStationId, planRow.toStationId));
      return;
    }
    routeMaps.push(mapData);
  };

  // Ưu tiên load theo đúng thứ tự routePlan (2+ tuyến → cắt từng chặng rồi nối).
  const orderedRouteIds = routePlan.length > 0
    ? routePlan.map((row) => String(row.routeId))
    : routeIds;

  for (const routeId of orderedRouteIds) {
    try {
      pushCroppedRouteMap(await loadRouteMapData(routeId, stationById), routeId);
    } catch (error) {
      console.error(`Không tải được bản đồ tuyến ${routeId}:`, error);
    }
  }

  if (routeMaps.length === 0) {
    const catalogRoutes = await resolveRoutesFromCatalog(orderedRouteIds, routeCodes);
    for (const route of catalogRoutes) {
      try {
        const routeId = String(route.routeId || route.id);
        if (geometryToCoordinates(route.routeGeometry).length >= 2 || Array.isArray(route.stops)) {
          pushCroppedRouteMap(await loadRouteMapData(routeId, stationById, route), routeId);
        } else {
          pushCroppedRouteMap(await loadRouteMapData(routeId, stationById), routeId);
        }
      } catch (error) {
        console.error("Không tải được tuyến từ catalog:", error);
      }
    }
  }

  const richRouteMaps = routeMaps.filter((item) => item.coordinates.length >= 3);
  const usableRouteMaps = richRouteMaps.length > 0 ? richRouteMaps : routeMaps.filter((item) => item.coordinates.length >= 2);

  if (usableRouteMaps.length === 0) {
    return buildStationsOnlyModel(booking, stationById);
  }

  const routeStations = [];
  const seenStationIds = new Set();
  usableRouteMaps.forEach((routeMap) => {
    routeMap.stations.forEach((station) => {
      if (seenStationIds.has(station.stationId)) return;
      seenStationIds.add(station.stationId);
      routeStations.push(station);
    });
  });

  const hasFinalized = Boolean(
    booking?.selectedRoute?.routeId
    || booking?.selectedRouteId
    || pick(booking?.raw || {}, ["selectedRoute.routeId", "selectedRouteId"], "")
    || (String(booking?.status || "") !== "PendingQuote" && (
      booking?.matchedRouteId
      || (Array.isArray(booking?.routePlan) && booking.routePlan.some((row) => row?.routeId))
    )),
  );

  return {
    routeName: stationsLabel,
    coordinates: stitchRouteMapCoordinates(usableRouteMaps),
    stations: bookingStations.length >= 2 ? bookingStations : routeStations,
    source: hasFinalized ? "selected-route" : "draft-route",
  };
};
