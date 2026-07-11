import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";

// Tự động căn chỉnh góc nhìn zoom mượt mà
const MapController = ({ positions, centerPoint, multiMarkers }) => {
  const map = useMap();
  const isInitialized = useRef(false);

  // Tách mảng centerPoint [lat, lng] ra thành số thực tế để đưa vào dependency
  const lat = centerPoint ? centerPoint[0] : undefined;
  const lng = centerPoint ? centerPoint[1] : undefined;

  useEffect(() => {
    // Chỉ auto-zoom bao quát vào lần đầu tiên load trang
    if (isInitialized.current) return;

    if (positions && positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40] });
      isInitialized.current = true;
    } else if (multiMarkers && multiMarkers.length > 0) {
      const bounds = L.latLngBounds(multiMarkers.map(m => [m.latitude, m.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
      isInitialized.current = true;
    } else if (lat !== undefined && lng !== undefined) {
      map.setView([lat, lng], 16, { animate: true });
      isInitialized.current = true;
    }
  }, [positions, multiMarkers, lat, lng, map]);

  // Lắng nghe thao tác Click/Gõ tay tọa độ của Admin để lướt Map theo 
  useEffect(() => {
    if (lat !== undefined && lng !== undefined && isInitialized.current) {
      map.setView([lat, lng], 16, { animate: true });
    }
  }, [lat, lng, map]);

  return null;
};

// Component lắng nghe sự kiện Click lên bản đồ
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

// Khắc phục lỗi icon Leaflet với Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Thêm prop stationsList phục vụ trang chủ khách hàng công cộng
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
  const polylinePositions = coordinates.map((point) => [point.latitude, point.longitude]);
  const centerPoint = stationPoint ? [stationPoint.latitude, stationPoint.longitude] : [10.7719, 106.7067];
  const visibleStations = (stationsList || []).filter((station) => {
    const status = String(station?.status || "Active").toLowerCase();
    return status === "active" || status === "";
  });

  return (
    <div className="w-full h-full min-h-112.5 overflow-hidden border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10">

      {waterwayName && (
        <div className="absolute top-4 left-4 z-1000 bg-white/90 dark:bg-slate-800/90 backdrop-blur px-4 py-2 rounded-xl shadow-sm pointer-events-none">
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

        {/* TRƯỜNG HỢP 1: HIỂN THỊ 1 ĐIỂM MARKER ĐƠN LẺ (DÀNH CHO ADMIN CONFIG) */}
        {stationPoint && (
          <Marker position={centerPoint}>
            <Popup>
              <div className="text-center font-body p-1">
                <p className="font-black text-[#124757] text-xs uppercase m-0 leading-tight">{stationPoint.name}</p>
                <p className="text-[10px] text-slate-400 mt-1 m-0">Lat: {stationPoint.latitude?.toFixed(6)} <br /> Lng: {stationPoint.longitude?.toFixed(6)}</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* TRƯỜNG HỢP 2: HIỂN THỊ DANH SÁCH HÀNG LOẠT NHÀ GA (DÀNH CHO TRANG CHỦ HOME TƯƠNG TÁC) */}
        {visibleStations.length > 0 && (
          visibleStations.map((station) => (
            <Marker
              key={station.stationId}
              position={[station.latitude, station.longitude]}
            >
              <Popup>
                <div className="text-center font-body p-2 space-y-2 min-w-37.5">
                  <p className="font-black text-[#124757] text-xs uppercase leading-tight m-0">{station.stationName}</p>
                  <p className="text-[10px] text-slate-400 line-clamp-2 m-0">{station.address || "Bến tàu Saigon Waterbus"}</p>

                  {/* Nút bấm điều hướng sang trang chi tiết nhà ga */}
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
          centerPoint={stationPoint ? centerPoint : null}
          multiMarkers={visibleStations}
        />
        <MapClickHandler onLocationSelect={onLocationSelect} />
      </MapContainer>
    </div>
  );
};