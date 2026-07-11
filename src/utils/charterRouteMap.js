import { fetchAllRoutes, fetchRouteDetail } from "../services/routeService";
import { fetchAllStations } from "../services/stationService";
import { fetchWaterwayDetail } from "../services/waterwayService";
import { getMatchedRouteSummary, normalizeRouteEstimateLegs } from "./charterBookingAdmin";

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

export const resolveCharterMatchedRouteIds = (booking) => {
  const source = getBookingRouteSource(booking);
  const legs = Array.isArray(booking?.routeLegs) && booking.routeLegs.length > 0
    ? booking.routeLegs
    : normalizeRouteEstimateLegs(source?.routeEstimate || booking?.routeEstimate);
  const summary = getMatchedRouteSummary(source?.routeEstimate || booking?.routeEstimate, legs);
  const ids = [];

  const pushId = (value) => {
    const id = String(value || "").trim();
    if (id && !ids.includes(id)) ids.push(id);
  };

  pushId(booking?.matchedRouteId);
  pushId(source?.matchedRouteId);
  pushId(pick(source, ["matchedRoute.routeId", "matchedRoute.id"], ""));
  pushId(summary.matchedRouteId);
  legs.forEach((leg) => {
    pushId(leg.matchedRouteId);
    pushId(pick(leg, ["matchedRoute.routeId", "matchedRoute.id", "routeId"], ""));
  });

  return ids;
};

export const resolveCharterMatchedRouteCodes = (booking) => {
  const source = getBookingRouteSource(booking);
  const legs = Array.isArray(booking?.routeLegs) && booking.routeLegs.length > 0
    ? booking.routeLegs
    : normalizeRouteEstimateLegs(source?.routeEstimate || booking?.routeEstimate);
  const summary = getMatchedRouteSummary(source?.routeEstimate || booking?.routeEstimate, legs);
  const codes = [];

  const pushCode = (value) => {
    const code = String(value || "").trim();
    if (code && !codes.includes(code)) codes.push(code);
  };

  pushCode(booking?.matchedRouteCode);
  pushCode(source?.matchedRouteCode);
  pushCode(summary.matchedRouteCode);
  legs.forEach((leg) => {
    pushCode(leg.matchedRouteCode);
    pushCode(pick(leg, ["matchedRoute.routeCode", "routeCode"], ""));
  });

  return codes;
};

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
  const pushStation = (stationId, fallbackName) => {
    const id = String(stationId || "");
    const fromCatalog = id ? stationById.get(id) : null;
    const mapped = toMapStation(fromCatalog || { stationId: id }, fallbackName);
    if (mapped) points.push(mapped);
  };

  pushStation(booking?.fromStationId, booking?.fromStationName || "Bến đón");
  (Array.isArray(booking?.itineraryStops) ? booking.itineraryStops : []).forEach((stop, index) => {
    pushStation(stop.stationId, stop.stationName || `Dừng ${index + 1}`);
  });
  pushStation(booking?.toStationId, booking?.toStationName || "Bến trả");

  return points;
};

const buildStationsFallbackModel = (booking, stationById) => {
  const fallbackStations = buildFallbackStations(booking, stationById);
  return {
    routeName: booking?.fromStationName && booking?.toStationName
      ? `${booking.fromStationName} → ${booking.toStationName}`
      : "",
    coordinates: fallbackStations.length >= 2
      ? fallbackStations.map((station) => ({
        latitude: station.latitude,
        longitude: station.longitude,
      }))
      : [],
    stations: fallbackStations,
    source: "stations-fallback",
  };
};

const extractEmbeddedRouteGeometry = (booking) => {
  const source = getBookingRouteSource(booking);
  const estimate = source?.routeEstimate || booking?.routeEstimate;
  const candidates = [
    source?.routeGeometry,
    estimate?.routeGeometry,
    estimate?.geometry,
    estimate?.matchedRoute?.routeGeometry,
  ];

  const legs = normalizeRouteEstimateLegs(estimate);
  legs.forEach((leg) => {
    candidates.push(leg.routeGeometry, leg.geometry, leg.matchedRoute?.routeGeometry);
  });

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
 * Load map polyline + station markers for a charter booking from matched Route Master.
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
  const embeddedCoordinates = extractEmbeddedRouteGeometry(booking);
  const routeIds = resolveCharterMatchedRouteIds(booking);
  const routeCodes = resolveCharterMatchedRouteCodes(booking);
  const summary = getMatchedRouteSummary(
    getBookingRouteSource(booking)?.routeEstimate || booking?.routeEstimate,
  );
  const officialRouteName = [
    summary.matchedRouteName,
    summary.matchedRouteCode,
    booking?.matchedRouteName,
    booking?.matchedRouteCode,
  ].find(Boolean) || "";

  if (embeddedCoordinates.length >= 3) {
    return {
      routeName: officialRouteName
        || (booking?.fromStationName && booking?.toStationName
          ? `${booking.fromStationName} → ${booking.toStationName}`
          : ""),
      coordinates: embeddedCoordinates,
      stations: bookingStations.length > 0 ? bookingStations : [],
      source: "route-master",
    };
  }

  if (routeIds.length === 0 && routeCodes.length === 0) {
    return buildStationsFallbackModel(booking, stationById);
  }

  const routeMaps = [];
  for (const routeId of routeIds) {
    try {
      routeMaps.push(await loadRouteMapData(routeId, stationById));
    } catch (error) {
      console.error(`Không tải được bản đồ tuyến ${routeId}:`, error);
    }
  }

  if (routeMaps.length === 0) {
    const catalogRoutes = await resolveRoutesFromCatalog(routeIds, routeCodes);
    for (const route of catalogRoutes) {
      try {
        const routeId = String(route.routeId || route.id);
        // List payload may already include geometry; otherwise fetch detail.
        if (geometryToCoordinates(route.routeGeometry).length >= 2 || Array.isArray(route.stops)) {
          routeMaps.push(await loadRouteMapData(routeId, stationById, route));
        } else {
          routeMaps.push(await loadRouteMapData(routeId, stationById));
        }
      } catch (error) {
        console.error("Không tải được tuyến từ catalog:", error);
      }
    }
  }

  const richRouteMaps = routeMaps.filter((item) => item.coordinates.length >= 3);
  const usableRouteMaps = richRouteMaps.length > 0 ? richRouteMaps : routeMaps.filter((item) => item.coordinates.length >= 2);

  if (usableRouteMaps.length === 0) {
    if (embeddedCoordinates.length >= 2) {
      return {
        routeName: officialRouteName || "",
        coordinates: embeddedCoordinates,
        stations: bookingStations,
        source: "route-master",
      };
    }
    return buildStationsFallbackModel(booking, stationById);
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

  return {
    routeName: usableRouteMaps.map((item) => item.routeName).filter(Boolean).join(" · ")
      || officialRouteName
      || "",
    coordinates: usableRouteMaps.flatMap((item) => item.coordinates),
    // Marker theo lộ trình charter (đón / dừng / trả), đường vẽ theo Route Master.
    stations: bookingStations.length >= 2 ? bookingStations : routeStations,
    source: "route-master",
  };
};
