import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Tự động căn chỉnh góc nhìn zoom mượt mà
const MapController = ({ positions, centerPoint }) => {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (centerPoint) {
      map.setView(centerPoint, 16, { animate: true });
    }
  }, [positions, centerPoint, map]);
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

// Fix lỗi icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export const WaterwayMap = ({ coordinates = [], waterwayName = "", stationPoint = null, onLocationSelect }) => {
  const polylinePositions = coordinates.map((point) => [point.latitude, point.longitude]);
  const centerPoint = stationPoint ? [stationPoint.latitude, stationPoint.longitude] : [10.7719, 106.7067];

  return (
    <div className="w-full h-100 rounded-4xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md relative z-10 cursor-crosshair">
      
      {/* 💡 ĐÃ KHÔI PHỤC: Thẻ Label nổi hiển thị waterwayName để không bị dư biến */}
      {waterwayName && (
        <div className="absolute top-4 left-4 z-1000 bg-white/90 dark:bg-slate-800/90 backdrop-blur px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm pointer-events-none">
          <span className="text-[10px] font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider block">
            Đang hiển thị tuyến
          </span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {waterwayName}
          </span>
        </div>
      )}

      <MapContainer center={centerPoint} zoom={15} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {polylinePositions.length > 0 && (
          <Polyline positions={polylinePositions} pathOptions={{ color: "#124757", weight: 5, opacity: 0.85, lineJoin: "round" }} />
        )}

        {stationPoint && (
          <Marker position={centerPoint}>
            <Popup>
              <div className="text-center font-body p-1">
                <p className="font-black text-[#124757] text-xs uppercase m-0 leading-tight">{stationPoint.name}</p>
                <p className="text-[10px] text-slate-400 mt-1 m-0">Lat: {stationPoint.latitude?.toFixed(6)} <br/> Lng: {stationPoint.longitude?.toFixed(6)}</p>
              </div>
            </Popup>
          </Marker>
        )}

        <MapController positions={polylinePositions} centerPoint={stationPoint ? centerPoint : null} />
        <MapClickHandler onLocationSelect={onLocationSelect} />
      </MapContainer>
    </div>
  );
};