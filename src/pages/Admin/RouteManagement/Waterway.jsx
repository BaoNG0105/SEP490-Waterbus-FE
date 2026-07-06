import { useState, useEffect } from "react";
import { fetchWaterways, fetchWaterwayDetail } from "../../../services/waterwayService";
import { WaterwayMap } from "../../../components/WaterwayMap"; // Import component vừa tạo

export function Waterway() {
  const [waterwayList, setWaterwaysList] = useState([]);
  const [selectedWaterway, setSelectedWaterway] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Bộ lọc tìm kiếm gửi lên API GET /waterways
  const [searchName, setSearchTerm] = useState("");
  const [filterType, setTypeFilter] = useState("All");

  // Load danh sách lòng sông khi gõ chữ hoặc đổi loại
  useEffect(() => {
    const getList = async () => {
      try {
        const queryParams = {};
        if (searchName.trim()) queryParams.name = searchName.trim();
        if (filterType !== "All") queryParams.type = filterType;
        
        const data = await fetchWaterways(queryParams);
        setWaterwaysList(data || []);
      } catch (err) {
        console.error("Lỗi lấy danh sách waterways", err);
      }
    };
    getList();
  }, [searchName, filterType]);

  // Khi Admin click chọn lòng sông từ Dropdown/Danh sách
  const handleSelectWaterway = async (waterwayId) => {
    if (!waterwayId) {
      setSelectedWaterway(null);
      return;
    }
    try {
      setIsLoading(true);
      // Gọi API số 2 lấy chi tiết kèm mảng coordinates phân đoạn
      const detail = await fetchWaterwayDetail(waterwayId);
      
      // Gom toàn bộ tọa độ từ tất cả các phân đoạn (segments) thành 1 mảng phẳng
      const allCoordinates = detail.segments
        ? detail.segments.sort((a,b) => a.segmentOrder - b.segmentOrder).flatMap(s => s.coordinates)
        : [];

      setSelectedWaterway({
        name: detail.waterwayName || "Tuyến sông không tên",
        coordinates: allCoordinates
      });
    } catch (err) {
      console.error("Không tải được tọa độ sông", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 font-body">
      {/* KHỐI TRÁI: BỘ LỌC TÌM KIẾM TUYẾN SÔNG */}
      <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-[2rem] border space-y-4 shadow-sm">
        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
          🗺️ Lựa chọn tuyến đường sông OSM
        </h3>
        
        <div>
          <input
            type="text"
            placeholder="Tìm tên sông (Ví dụ: Rạch Dơi...)"
            value={searchName}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-yellow-400 shadow-inner"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["All", "river", "canal"].map((type) => (
            <button
              key={type} type="button"
              onClick={() => setTypeFilter(type)}
              className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                filterType === type 
                  ? "bg-[#124757] text-white border-transparent" 
                  : "bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {type === "All" ? "Tất cả" : type}
            </button>
          ))}
        </div>

        {/* Ô Select hiển thị kết quả lọc từ API waterways */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-400 uppercase">Danh sách kết quả ({waterwayList.length})</label>
          <select
            onChange={(e) => handleSelectWaterway(e.target.value)}
            className="w-full bg-slate-50 border rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="">-- Click chọn tuyến sông --</option>
            {waterwayList.map((w) => (
              <option key={w.id} value={w.id}>
                {w.waterwayName || `Sông không tên (${w.osmId})`} [{w.totalLengthKm} km]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KHỐI PHẢI: MAP CONTAINER PHẲNG KHÔNG VIỀN BAO CHIA ĐỀU BỐ CỤC */}
      <div className="lg:col-span-2 space-y-3">
        {isLoading ? (
          <div className="w-full h-[400px] flex items-center justify-center bg-slate-50 rounded-[2rem] border border-dashed">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] rounded-full animate-spin"></div>
          </div>
        ) : (
          <WaterwayMap 
            coordinates={selectedWaterway?.coordinates || []} 
            waterwayName={selectedWaterway?.name || ""} 
          />
        )}
      </div>
    </div>
  );
}
