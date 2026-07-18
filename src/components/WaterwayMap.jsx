import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import { useApp } from "../context/AppContext";
import { DEFAULT_BOAT_IMAGE, getBoatImageUrl } from "../utils/charterBookingAdmin";
import { isBoatUnderMaintenance, resolveBoatLiveStatus } from "../utils/boatTracking";

const DEFAULT_STATION_IMAGE =
  "https://res.cloudinary.com/dygipvoal/image/upload/v1776077167/vbxeolfuttvnbyql60ct.jpg";

const getStationImageUrl = (station) => {
  const primary = String(station?.imageUrl || "").trim();
  if (primary) return primary;
  const fromList = Array.isArray(station?.imageUrls)
    ? station.imageUrls.map((url) => String(url || "").trim()).find(Boolean)
    : "";
  return fromList || DEFAULT_STATION_IMAGE;
};

const isValidLatLng = (lat, lng) => (
  Number.isFinite(Number(lat))
  && Number.isFinite(Number(lng))
  && Math.abs(Number(lat)) <= 90
  && Math.abs(Number(lng)) <= 180
);

const safeMapAction = (map, action) => {
  try {
    if (!map || !map._loaded || typeof map.getContainer !== "function") return;
    const container = map.getContainer();
    if (!container || !container.isConnected) return;
    action(map);
  } catch (error) {
    // Leaflet crash khi map bị unmount giữa lúc zoom/pan — bỏ qua an toàn.
    console.warn("WaterwayMap: skipped map action", error);
  }
};

// Tự động căn chỉnh góc nhìn — không animate để tránh _leaflet_pos khi remount.
const MapController = ({ positions, centerPoint, multiMarkers, focusView, fitKey }) => {
  const map = useMap();
  const isInitialized = useRef(false);
  const lastFitKey = useRef("");

  const lat = centerPoint ? centerPoint[0] : undefined;
  const lng = centerPoint ? centerPoint[1] : undefined;
  const focusLat = focusView?.[0];
  const focusLng = focusView?.[1];

  useEffect(() => {
    const key = String(fitKey || "");
    // Chỉ fit lại khi tập marker "sẵn sàng" lần đầu (số lượng đổi từ 0 → N), không phải mỗi GPS tick.
    if (isInitialized.current && key === lastFitKey.current) return;
    if (!key || key.endsWith("-s0") && key.startsWith("b0")) return;

    safeMapAction(map, (activeMap) => {
      if (positions && positions.length > 0) {
        const bounds = L.latLngBounds(positions);
        if (bounds.isValid()) {
          activeMap.fitBounds(bounds, { padding: [40, 40], animate: false });
          isInitialized.current = true;
          lastFitKey.current = key;
          return;
        }
      }
      if (multiMarkers && multiMarkers.length > 0) {
        const points = multiMarkers
          .filter((m) => isValidLatLng(m.latitude, m.longitude))
          .map((m) => [m.latitude, m.longitude]);
        if (points.length > 0) {
          const bounds = L.latLngBounds(points);
          if (bounds.isValid()) {
            activeMap.fitBounds(bounds, { padding: [80, 80], animate: false });
            isInitialized.current = true;
            lastFitKey.current = key;
            return;
          }
        }
      }
      if (lat !== undefined && lng !== undefined && isValidLatLng(lat, lng)) {
        activeMap.setView([lat, lng], 16, { animate: false });
        isInitialized.current = true;
        lastFitKey.current = key;
      }
    });
  }, [positions, multiMarkers, fitKey, lat, lng, map]);

  useEffect(() => {
    if (!isInitialized.current) return;
    if (lat === undefined || lng === undefined || !isValidLatLng(lat, lng)) return;
    safeMapAction(map, (activeMap) => {
      activeMap.setView([lat, lng], activeMap.getZoom() || 16, { animate: false });
    });
  }, [lat, lng, map]);

  useEffect(() => {
    if (!isInitialized.current) return;
    if (focusLat === undefined || focusLng === undefined || !isValidLatLng(focusLat, focusLng)) return;
    safeMapAction(map, (activeMap) => {
      activeMap.panTo([focusLat, focusLng], { animate: true, duration: 0.35 });
    });
  }, [focusLat, focusLng, map]);

  useEffect(() => {
    const onResize = () => {
      safeMapAction(map, (activeMap) => {
        activeMap.invalidateSize({ animate: false });
      });
    };
    window.addEventListener("resize", onResize);
    const timer = window.setTimeout(onResize, 120);
    const container = typeof map.getContainer === "function" ? map.getContainer() : null;
    const observer = container && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(onResize)
      : null;
    if (observer && container) observer.observe(container);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [map]);

  return null;
};

const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      if (onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

/**
 * Marker tàu — cùng icon thân tàu, chỉ khác màu:
 * - deck1: xanh brand (#124757)
 * - deck2: xanh dương (#1D4ED8)
 * - rescue: cam (#EA580C)
 * Sự cố ưu tiên đỏ.
 */
const boatLeafletIcons = new Map();

const BOAT_KIND_COLORS = {
  deck1: { fill: "#124757", deck: "#5EC8D6" },
  deck2: { fill: "#1D4ED8", deck: "#93C5FD" },
  rescue: { fill: "#EA580C", deck: "#FED7AA" },
};

const resolveBoatMarkerKind = (boat = {}) => {
  const service = String(boat.serviceType || boat.ServiceType || "").toLowerCase();
  const code = String(boat.boatCode || boat.code || "").toUpperCase();
  if (service === "rescue" || code.startsWith("SOS") || code.startsWith("RS_")) return "rescue";

  const decksRaw = boat.numberOfDecks ?? boat.NumberOfDecks ?? boat.deckCount;
  const decks = Number(decksRaw);
  if (Number.isFinite(decks) && decks >= 2) return "deck2";

  const setup = String(boat.seatSetupType || boat.SeatSetupType || "")
    .toLowerCase()
    .replace(/[_\s-]/g, "");
  if (setup === "standardandvip") return "deck2";

  return "deck1";
};

const boatHullSvg = (fill, ring, deck) => `
  <svg width="100%" height="100%" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M24 4
      C30 10 33 17 33 27
      C33 32 32.5 36 31.5 39
      C31 40.5 30 41.5 28.5 41.5
      L19.5 41.5
      C18 41.5 17 40.5 16.5 39
      C15.5 36 15 32 15 27
      C15 17 18 10 24 4 Z"
      fill="${fill}" stroke="${ring}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M24 13
      C27 16 28.5 20 28.5 25
      C28.5 28 28 31 27.5 33
      L20.5 33
      C20 31 19.5 28 19.5 25
      C19.5 20 21 16 24 13 Z"
      fill="${deck}"/>
    <circle cx="24" cy="9.5" r="1.8" fill="${ring}"/>
  </svg>
`;

const getBoatLeafletIcon = ({
  selected = false,
  dimmed = false,
  maintenance = false,
  incident = false,
  heading = null,
  kind = "deck1",
} = {}) => {
  const markerKind = ["rescue", "deck2", "deck1"].includes(kind) ? kind : "deck1";
  const palette = BOAT_KIND_COLORS[markerKind] || BOAT_KIND_COLORS.deck1;
  const state = incident
    ? "incident"
    : maintenance
      ? "maintenance"
      : selected
        ? "selected"
        : dimmed
          ? "offline"
          : "online";
  const rot = Number.isFinite(Number(heading)) ? Math.round(Number(heading) / 5) * 5 : 0;
  const key = `${markerKind}|${state}|${rot}`;
  if (boatLeafletIcons.has(key)) return boatLeafletIcons.get(key);

  const size = selected || incident ? 50 : 44;
  let fill = palette.fill;
  let deck = palette.deck;
  if (incident) {
    fill = "#DC2626";
    deck = "#FEE2E2";
  } else if (selected) {
    fill = "#FFD100";
    deck = "#0E4050";
  } else if (maintenance) {
    fill = "#64748B";
    deck = "#CBD5E1";
  }

  const ring = "#FFFFFF";
  const online = !dimmed && !maintenance;
  const html = `
    <div class="wb-boat is-${markerKind} ${dimmed ? "is-offline" : ""} ${maintenance ? "is-maintenance" : ""} ${incident ? "is-incident" : ""}" style="width:${size}px;height:${size}px;">
      ${incident ? `<span class="wb-boat__pulse wb-boat__pulse--incident"></span>` : ""}
      ${online && !incident ? `<span class="wb-boat__pulse" style="border-color:${fill};"></span>` : ""}
      <span class="wb-boat__rot" style="transform:rotate(${rot}deg);">
        ${boatHullSvg(fill, ring, deck)}
      </span>
    </div>
  `;

  const icon = L.divIcon({
    className: "live-boat-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
  boatLeafletIcons.set(key, icon);
  if (boatLeafletIcons.size > 320) {
    const first = boatLeafletIcons.keys().next().value;
    boatLeafletIcons.delete(first);
  }
  return icon;
};

/** Marker bến: ô mã xám + cột + tên bến (kiểu như bản đồ waterbus). */
const stationIconCache = new Map();

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** ST-BD / ST_BD → BD — chỉ hiện phần mã ngắn trên cờ. */
const shortStationCode = (code) => {
  const raw = String(code || "").trim().toUpperCase();
  if (!raw) return "—";
  return raw.replace(/^ST[-_\s]*/i, "") || raw;
};

const getStationPinIcon = (code) => {
  const label = shortStationCode(code);
  const cacheKey = `code:${label}`;
  const cached = stationIconCache.get(cacheKey);
  if (cached) return cached;

  const safeCode = escapeHtml(label);

  const html = `
    <div class="wb-flagcode">
      <span class="wb-flagcode__badge">${safeCode}</span>
      <span class="wb-flagcode__pole"></span>
      <span class="wb-flagcode__tip"></span>
    </div>
  `;

  // Neo tại chân cột (giữa tip) — badge nằm phía trên
  const icon = L.divIcon({
    className: "live-boat-marker",
    html,
    iconSize: [40, 36],
    iconAnchor: [20, 34],
    popupAnchor: [0, -36],
  });
  stationIconCache.set(cacheKey, icon);
  if (stationIconCache.size > 200) {
    stationIconCache.delete(stationIconCache.keys().next().value);
  }
  return icon;
};

/** Cờ tên bến (trang Home): lá cờ #124757 + cột + chân. */
const getStationNameFlagIcon = (name) => {
  const label = String(name || "—").trim() || "—";
  const cacheKey = `name:${label}`;
  const cached = stationIconCache.get(cacheKey);
  if (cached) return cached;

  const safeName = escapeHtml(label);
  const html = `
    <div class="wb-flagname">
      <span class="wb-flagname__badge">${safeName}</span>
      <span class="wb-flagname__pole"></span>
      <span class="wb-flagname__tip"></span>
    </div>
  `;

  const icon = L.divIcon({
    className: "live-boat-marker",
    html,
    iconSize: [120, 44],
    iconAnchor: [60, 42],
    popupAnchor: [0, -42],
  });
  stationIconCache.set(cacheKey, icon);
  if (stationIconCache.size > 200) {
    stationIconCache.delete(stationIconCache.keys().next().value);
  }
  return icon;
};

export const WaterwayMap = ({
  coordinates = [],
  waterwayName = "",
  overlayEyebrow = "Đang hiển thị tuyến",
  stationPoint = null,
  stationsList = [],
  boatMarkers = [],
  selectedBoatId = "",
  focusView = null,
  onLocationSelect,
  hideStationLink = false,
  lineWeight = 5,
  lineOpacity = 0.85,
  fitBoatMarkers = false,
  stationAsFlag = false,
  /** Hiện tên bến cố định trên map (trang Home). */
  showStationLabels = false,
  /** Hiện ảnh bến trong popup. */
  showStationImages = false,
  /** Tuyến nền (chỉ xem): [{ id, positions: [[lat,lng],...], label? }] */
  routeOverlays = [],
  className = "",
}) => {
  const navigate = useNavigate();
  const { lang } = useApp();
  const polylinePositions = (coordinates || [])
    .filter((point) => isValidLatLng(point?.latitude, point?.longitude))
    .map((point) => [point.latitude, point.longitude]);
  const centerPoint = stationPoint && isValidLatLng(stationPoint.latitude, stationPoint.longitude)
    ? [stationPoint.latitude, stationPoint.longitude]
    : [10.7719, 106.7067];
  const focusPoint = focusView && isValidLatLng(focusView.latitude, focusView.longitude)
    ? [focusView.latitude, focusView.longitude]
    : null;
  const visibleStations = (stationsList || []).filter((station) => {
    const status = String(station?.status || "Active").toLowerCase();
    const active = status === "active" || status === "";
    return active && isValidLatLng(station?.latitude, station?.longitude);
  });
  const visibleBoats = (boatMarkers || []).filter((boat) =>
    isValidLatLng(boat?.latitude, boat?.longitude),
  );
  const visibleRouteOverlays = (routeOverlays || [])
    .map((route) => {
      const positions = (route?.positions || [])
        .filter((point) => Array.isArray(point) && isValidLatLng(point[0], point[1]))
        .map((point) => [Number(point[0]), Number(point[1])]);
      if (positions.length < 2) return null;
      return {
        id: route.id || route.routeId || route.routeCode || JSON.stringify(positions[0]),
        label: route.label || route.routeCode || route.routeName || "",
        positions,
      };
    })
    .filter(Boolean);
  // Chỉ dùng id list cho fit lần đầu — tránh remount MapController mỗi tick GPS.
  const fitMarkerKey = fitBoatMarkers
    ? `b${visibleBoats.length}-s${visibleStations.length}`
    : `s${visibleStations.length}`;
  const fitMarkers = fitBoatMarkers
    ? (visibleBoats.length > 0 ? visibleBoats : visibleStations)
    : visibleStations;

  return (
    <div className={`relative z-10 h-full min-h-0 w-full overflow-hidden border-0 ${className}`}>

      {waterwayName && (
        <div className="absolute top-4 right-4 z-1000 max-w-[min(100%-2rem,20rem)] bg-white/90 dark:bg-slate-800/90 backdrop-blur px-4 py-2 rounded-xl shadow-sm pointer-events-none">
          <span className="text-[10px] font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider block">
            {overlayEyebrow}
          </span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {waterwayName}
          </span>
        </div>
      )}

      <MapContainer center={centerPoint} zoom={13} className="w-full h-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Tuyến nền mờ — chỉ xem, không tương tác / không sửa FID */}
        {visibleRouteOverlays.map((route) => (
          <Polyline
            key={`overlay-${route.id}`}
            positions={route.positions}
            interactive={false}
            pathOptions={{
              color: "#5b8a9a",
              weight: 3,
              opacity: 0.28,
              lineJoin: "round",
              lineCap: "round",
            }}
          />
        ))}

        {polylinePositions.length > 0 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#124757",
              weight: lineWeight,
              opacity: lineOpacity,
              lineJoin: "round",
            }}
          />
        )}

        {stationPoint && isValidLatLng(stationPoint.latitude, stationPoint.longitude) && (
          <Marker position={centerPoint}>
            <Popup>
              <div className="text-center font-body p-1">
                <p className="font-black text-[#124757] text-xs uppercase m-0 leading-tight">{stationPoint.name}</p>
                <p className="text-[10px] text-slate-400 mt-1 m-0">Lat: {stationPoint.latitude?.toFixed(6)} <br /> Lng: {stationPoint.longitude?.toFixed(6)}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {visibleStations.length > 0 && (
          visibleStations.map((station, index) => {
            const stationName = station.stationName || station.name || "—";
            const stationImage = getStationImageUrl(station);
            const useNameFlag = stationAsFlag && showStationLabels;
            const markerIcon = useNameFlag
              ? getStationNameFlagIcon(stationName)
              : stationAsFlag
                ? getStationPinIcon(station.stationCode)
                : undefined;
            return (
              <Marker
                key={`${station.stationId || "st"}-${index}`}
                position={[station.latitude, station.longitude]}
                {...(markerIcon ? { icon: markerIcon } : {})}
              >
                {showStationLabels && !stationAsFlag ? (
                  <Tooltip
                    permanent
                    direction="top"
                    offset={[0, -36]}
                    opacity={1}
                    className="station-name-tooltip"
                  >
                    {stationName}
                  </Tooltip>
                ) : null}
                <Popup>
                  <div className="min-w-[11.5rem] max-w-[15rem] space-y-2 p-1 font-body text-center">
                    {showStationImages ? (
                      <img
                        src={stationImage}
                        alt={stationName}
                        className="h-24 w-full rounded-lg object-cover"
                        onError={(event) => {
                          event.currentTarget.src = DEFAULT_STATION_IMAGE;
                        }}
                      />
                    ) : null}
                    <p className="m-0 text-xs font-black uppercase leading-tight text-[#124757]">
                      {stationName}
                    </p>
                    <p className="m-0 line-clamp-2 text-[10px] text-slate-400">
                      {station.address || (lang === "VN" ? "Bến tàu Saigon Waterbus" : "Saigon Waterbus station")}
                    </p>
                    {!hideStationLink ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/station/${station.stationId}`)}
                        className="mt-1 block w-full cursor-pointer rounded-lg bg-[#124757] px-3 py-1.5 text-[10px] font-bold uppercase text-white shadow-sm transition-all hover:brightness-110"
                      >
                        {lang === "VN" ? "Xem chi tiết bến" : "View station details"}
                      </button>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            );
          })
        )}

        {visibleBoats.map((boat) => {
          const selected = String(selectedBoatId) === String(boat.boatId);
          const underMaintenance = isBoatUnderMaintenance(boat);
          const dimmed = boat.isOnline === false;
          const imageSrc = getBoatImageUrl(boat, DEFAULT_BOAT_IMAGE);
          const seatCount = Number(boat.seatCount);
          const passengerCount = Number(boat.passengerCount);
          const hasSeats = Number.isFinite(seatCount) && seatCount > 0;
          const hasPassengers = Number.isFinite(passengerCount) && passengerCount >= 0;
          const occupancyValue = hasSeats
            ? (hasPassengers ? `${passengerCount}/${seatCount}` : String(seatCount))
            : null;
          const liveStatus = resolveBoatLiveStatus(boat);
          const isIncident = liveStatus.key === "incident";
          const markerKind = resolveBoatMarkerKind(boat);
          const kindLabel = markerKind === "rescue"
            ? "Cứu hộ"
            : markerKind === "deck2"
              ? "2 tầng"
              : "1 tầng";
          const kindColor = markerKind === "rescue"
            ? "#EA580C"
            : markerKind === "deck2"
              ? "#1D4ED8"
              : "#124757";

          const boatCard = (
            <div className={`wb-boat-card ${underMaintenance ? "wb-boat-card--maintenance" : ""}`}>
              <img
                className="wb-boat-card__img"
                src={imageSrc}
                alt={boat.boatCode || "boat"}
                onError={(event) => {
                  event.currentTarget.src = DEFAULT_BOAT_IMAGE;
                }}
              />
              <div className="wb-boat-card__body">
                <div className="wb-boat-card__top">
                  <p className="wb-boat-card__code">{boat.boatCode || boat.boatId}</p>
                  <span
                    className={`wb-boat-card__dot wb-boat-card__dot--${liveStatus.tone}`}
                    title={liveStatus.labelVn}
                    aria-label={liveStatus.labelVn}
                  />
                </div>
                {boat.boatName ? (
                  <p className="wb-boat-card__name">{boat.boatName}</p>
                ) : null}
                <p className="wb-boat-card__kind" style={{ color: isIncident ? "#DC2626" : kindColor }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: isIncident ? "#DC2626" : kindColor,
                      marginRight: 5,
                      verticalAlign: "middle",
                    }}
                  />
                  {kindLabel}
                </p>
                {boat.rescuingBoatCode ? (
                  <p className="wb-boat-card__note" style={{ color: "#EA580C" }}>
                    Đang cứu {boat.rescuingBoatCode}
                  </p>
                ) : boat.rescuedByBoatCode ? (
                  <p className="wb-boat-card__note" style={{ color: "#DC2626" }}>
                    {boat.rescuedByBoatCode} đang kéo
                  </p>
                ) : isIncident ? (
                  <p className="wb-boat-card__note">Sự cố</p>
                ) : underMaintenance ? (
                  <p className="wb-boat-card__note">Đang bảo trì</p>
                ) : occupancyValue ? (
                  <p className="wb-boat-card__seats">
                    <strong>{occupancyValue}</strong>
                  </p>
                ) : null}
              </div>
            </div>
          );

          return (
            <Marker
              key={`boat-${String(boat.boatCode || boat.boatId).toUpperCase()}`}
              position={[boat.latitude, boat.longitude]}
              icon={getBoatLeafletIcon({
                selected,
                dimmed,
                maintenance: underMaintenance && !isIncident,
                incident: isIncident,
                heading: boat.heading,
                kind: markerKind,
              })}
              zIndexOffset={selected ? 1000 : isIncident ? 400 : markerKind === "rescue" ? 350 : underMaintenance ? 80 : dimmed ? 100 : 200}
              eventHandlers={{
                click: (event) => {
                  // Chỉ 1 card (tooltip) — không mở Popup chồng lên.
                  L.DomEvent.stopPropagation(event);
                  event.target.openTooltip();
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={1} sticky className="wb-boat-tip">
                {boatCard}
              </Tooltip>
            </Marker>
          );
        })}

        <MapController
          positions={polylinePositions}
          centerPoint={stationPoint && isValidLatLng(stationPoint.latitude, stationPoint.longitude) ? centerPoint : null}
          focusView={focusPoint}
          multiMarkers={fitMarkers}
          fitKey={fitMarkerKey}
        />
        <MapClickHandler onLocationSelect={onLocationSelect} />
      </MapContainer>
    </div>
  );
};
