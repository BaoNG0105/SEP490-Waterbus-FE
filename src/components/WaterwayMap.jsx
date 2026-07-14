import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";

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
const MapController = ({ positions, centerPoint, multiMarkers }) => {
  const map = useMap();
  const isInitialized = useRef(false);

  const lat = centerPoint ? centerPoint[0] : undefined;
  const lng = centerPoint ? centerPoint[1] : undefined;

  useEffect(() => {
    if (isInitialized.current) return;

    safeMapAction(map, (activeMap) => {
      if (positions && positions.length > 0) {
        const bounds = L.latLngBounds(positions);
        if (bounds.isValid()) {
          activeMap.fitBounds(bounds, { padding: [40, 40], animate: false });
          isInitialized.current = true;
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
            activeMap.fitBounds(bounds, { padding: [50, 50], animate: false });
            isInitialized.current = true;
            return;
          }
        }
      }
      if (lat !== undefined && lng !== undefined && isValidLatLng(lat, lng)) {
        activeMap.setView([lat, lng], 16, { animate: false });
        isInitialized.current = true;
      }
    });
  }, [positions, multiMarkers, lat, lng, map]);

  useEffect(() => {
    if (!isInitialized.current) return;
    if (lat === undefined || lng === undefined || !isValidLatLng(lat, lng)) return;
    safeMapAction(map, (activeMap) => {
      activeMap.setView([lat, lng], activeMap.getZoom() || 16, { animate: false });
    });
  }, [lat, lng, map]);

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

export const WaterwayMap = ({
  coordinates = [],
  waterwayName = "",
  overlayEyebrow = "Đang hiển thị tuyến",
  stationPoint = null,
  stationsList = [],
  onLocationSelect,
  hideStationLink = false,
  lineWeight = 5,
  lineOpacity = 0.85,
}) => {
  const navigate = useNavigate();
  const polylinePositions = (coordinates || [])
    .filter((point) => isValidLatLng(point?.latitude, point?.longitude))
    .map((point) => [point.latitude, point.longitude]);
  const centerPoint = stationPoint && isValidLatLng(stationPoint.latitude, stationPoint.longitude)
    ? [stationPoint.latitude, stationPoint.longitude]
    : [10.7719, 106.7067];
  const visibleStations = (stationsList || []).filter((station) => {
    const status = String(station?.status || "Active").toLowerCase();
    const active = status === "active" || status === "";
    return active && isValidLatLng(station?.latitude, station?.longitude);
  });

  return (
    <div className="relative z-10 h-full min-h-112.5 w-full overflow-hidden border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">

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

      <MapContainer center={centerPoint} zoom={13} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

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
          visibleStations.map((station, index) => (
            <Marker
              key={`${station.stationId || "st"}-${index}`}
              position={[station.latitude, station.longitude]}
            >
              <Tooltip permanent direction="top" offset={[0, -38]} className="station-name-tooltip">
                {station.stationName}
              </Tooltip>
              <Popup>
                <div className="text-center font-body p-2 space-y-2 min-w-37.5">
                  <p className="font-black text-[#124757] text-xs uppercase leading-tight m-0">{station.stationName}</p>
                  <p className="text-[10px] text-slate-400 line-clamp-2 m-0">{station.address || "Bến tàu Saigon Waterbus"}</p>

                  {!hideStationLink && (
                    <button
                      type="button"
                      onClick={() => navigate(`/station/${station.stationId}`)}
                      className="w-full bg-[#124757] text-white text-[10px] font-bold uppercase py-1.5 px-3 rounded-lg shadow-sm hover:brightness-110 transition-all cursor-pointer block mt-1"
                    >
                      Xem chi tiết bến
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))
        )}

        <MapController
          positions={polylinePositions}
          centerPoint={stationPoint && isValidLatLng(stationPoint.latitude, stationPoint.longitude) ? centerPoint : null}
          multiMarkers={visibleStations}
        />
        <MapClickHandler onLocationSelect={onLocationSelect} />
      </MapContainer>
    </div>
  );
};
