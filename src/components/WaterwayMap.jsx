import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

// Component phụ trách tự động zoom và di chuyển bản đồ đến vùng có tọa độ đường sông
const MapController = ({ positions }) => {
  const map = useMap();

  useEffect(() => {
    if (positions && positions.length > 0) {
      // Tạo một khung bao chứa toàn bộ các điểm tọa độ
      const bounds = L.latLngBounds(positions);
      // Ép bản đồ fit trọn vào khung bao đó kèm một khoảng đệm padding mượt mà
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [positions, map]);

  return null;
};

export const WaterwayMap = ({ coordinates = [], waterwayName = "" }) => {
  // 💡 CHUYỂN ĐỔI DATA: Định dạng API .NET trả về là { longitude, latitude }
  // Nhưng Leaflet yêu cầu mảng các cặp số theo thứ tự: [latitude, longitude]
  const polylinePositions = coordinates.map((point) => [
    point.latitude,
    point.longitude,
  ]);

  // Vị trí trung tâm mặc định (Ví dụ: Bến Bạch Đằng, Sài Gòn) phòng trường hợp chưa có dữ liệu tuyến
  const defaultCenter = [10.7719, 106.7067]; 

  return (
    <div className="w-full h-[400px] md:h-[500px] rounded-[2rem] overflow-hidden border border-slate-200 dark:border-slate-700/60 shadow-md relative group">
      
      {/* Label hiển thị tên tuyến sông đè lên bản đồ */}
      {waterwayName && (
        <div className="absolute top-4 left-4 z-[1000] bg-white/90 dark:bg-slate-800/90 backdrop-blur px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm pointer-events-none">
          <span className="text-[10px] font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider block">
            Đang hiển thị tuyến
          </span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {waterwayName}
          </span>
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={13}
        className="w-full h-full"
        zoomControl={true}
      >
        {/* Layer Bản đồ nền miễn phí từ OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Nếu có tọa độ -> Vẽ đường uốn lượn theo lòng sông */}
        {polylinePositions.length > 0 && (
          <>
            {/* Đường vẽ chính (Polyline) */}
            <Polyline
              positions={polylinePositions}
              pathOptions={{
                color: "#124757",       // Màu xanh đậm đồng bộ thương hiệu dự án của bạn
                weight: 5,             // Độ dày nét vẽ đường sông
                opacity: 0.85,          // Độ mờ của đường nét
                lineJoin: "round",     // Bo tròn các góc nối để đường lượn sóng mượt mà
              }}
            />
            {/* Bộ điều khiển auto-zoom góc nhìn bản đồ */}
            <MapController positions={polylinePositions} />
          </>
        )}
      </MapContainer>
    </div>
  );
};