import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// react-leaflet không tự resolve được icon mặc định qua bundler — trỏ thẳng về CDN.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const isValidLatLng = (lat, lng) => (
  Number.isFinite(Number(lat))
  && Number.isFinite(Number(lng))
  && Math.abs(Number(lat)) <= 90
  && Math.abs(Number(lng)) <= 180
);

// Bến ga hiển thị trong 1 khung nhỏ ngay khi mount (chưa kịp layout ổn định) nên Leaflet
// có thể đo sai kích thước container ban đầu — ép đo lại sau khi khung đã lên kích thước thật.
const InvalidateSizeOnMount = () => {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize({ animate: false }), 100);
    return () => window.clearTimeout(timer);
  }, [map]);
  return null;
};

/** Bản đồ OpenStreetMap đơn giản, ghim đúng 1 vị trí bến (dùng latitude/longitude từ API). */
export function StationLocationMap({ latitude, longitude, label, className = "" }) {
  if (!isValidLatLng(latitude, longitude)) return null;
  const position = [Number(latitude), Number(longitude)];

  return (
    // isolate: chặn các pane/control của Leaflet (z-index tới 1000) tràn ra ngoài khung nhỏ
    // này và đè lên header cố định của trang — z-index chỉ còn so sánh trong nội bộ khung.
    <div className={`relative isolate overflow-hidden ${className}`}>
      <MapContainer
        center={position}
        zoom={16}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <InvalidateSizeOnMount />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position}>
          {label ? <Popup>{label}</Popup> : null}
        </Marker>
      </MapContainer>
    </div>
  );
}
