import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { fetchWaterways, fetchWaterwayDetail, removeWaterway, removeAllWaterways } from "../../../services/waterwayService";
import { WaterwayMap } from "../../../components/WaterwayMap"; // Import component vừa tạo

export function Waterway() {
  const [waterwayList, setWaterwaysList] = useState([]);
  const [selectedWaterway, setSelectedWaterway] = useState(null);
  const [selectedWaterwayId, setSelectedWaterwayId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

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
    setSelectedWaterwayId(waterwayId);
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

  // Xóa tuyến sông đang chọn: xóa TẤT CẢ segment cùng OsmId + tên + loại (route đã tạo không bị ảnh hưởng)
  const handleDeleteWaterway = async () => {
    if (!selectedWaterwayId) return;

    const confirmResult = await Swal.fire({
      title: "Xóa tuyến sông này?",
      html: `Toàn bộ phân đoạn của <b>${selectedWaterway?.name || "tuyến sông này"}</b> sẽ bị xóa. Các route đã tạo trước đó sẽ không bị ảnh hưởng, nhưng sẽ không thể tạo route mới trên tuyến này.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#124757",
      confirmButtonText: "Xóa",
      cancelButtonText: "Hủy bỏ",
    });
    if (!confirmResult.isConfirmed) return;

    try {
      setIsDeleting(true);
      await removeWaterway(selectedWaterwayId);

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Đã xóa tuyến sông",
        showConfirmButton: false,
        timer: 1600,
      });

      // Bỏ chọn và làm mới danh sách sau khi xóa
      setSelectedWaterway(null);
      setSelectedWaterwayId("");
      const queryParams = {};
      if (searchName.trim()) queryParams.name = searchName.trim();
      if (filterType !== "All") queryParams.type = filterType;
      const data = await fetchWaterways(queryParams);
      setWaterwaysList(data || []);
    } catch (err) {
      console.error("Lỗi khi xóa waterway", err);
      Swal.fire({
        icon: "error",
        title: "Thất bại",
        text: err.response?.data?.message || "Không thể xóa tuyến sông này.",
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Xóa TOÀN BỘ mạng đường sông (xóa sạch bảng waterway_segments) - dùng trước khi re-import GeoJSON
  const handleDeleteAllWaterways = async () => {
    const confirmResult = await Swal.fire({
      title: "Xóa TOÀN BỘ mạng đường sông?",
      html: `Thao tác này sẽ xóa <b>sạch toàn bộ</b> dữ liệu đường sông (waterway_segments) đang có, thường chỉ dùng trước khi re-import GeoJSON mới.<br/>Nhập <b>XOA TAT CA</b> để xác nhận.`,
      icon: "warning",
      input: "text",
      inputPlaceholder: "Nhập XOA TAT CA",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#124757",
      confirmButtonText: "Xóa toàn bộ",
      cancelButtonText: "Hủy bỏ",
      preConfirm: (value) => {
        if (value !== "XOA TAT CA") {
          Swal.showValidationMessage("Vui lòng nhập chính xác: XOA TAT CA");
          return false;
        }
        return true;
      },
    });
    if (!confirmResult.isConfirmed) return;

    try {
      setIsDeletingAll(true);
      await removeAllWaterways();

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Đã xóa toàn bộ mạng đường sông",
        showConfirmButton: false,
        timer: 1600,
      });

      setSelectedWaterway(null);
      setSelectedWaterwayId("");
      setWaterwaysList([]);
    } catch (err) {
      console.error("Lỗi khi xóa toàn bộ waterways", err);
      Swal.fire({
        icon: "error",
        title: "Thất bại",
        text: err.response?.data?.message || "Không thể xóa toàn bộ mạng đường sông.",
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsDeletingAll(false);
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
            value={selectedWaterwayId}
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

        {selectedWaterwayId && (
          <button
            type="button"
            onClick={handleDeleteWaterway}
            disabled={isDeleting}
            className="w-full py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? "Đang xóa..." : "🗑️ Xóa tuyến sông này"}
          </button>
        )}

        {/* VÙNG NGUY HIỂM: Xóa sạch toàn bộ mạng đường sông, dùng trước khi re-import GeoJSON */}
        <div className="pt-3 mt-2 border-t border-dashed space-y-1">
          <label className="text-[9px] font-bold text-red-400 uppercase">Vùng nguy hiểm</label>
          <button
            type="button"
            onClick={handleDeleteAllWaterways}
            disabled={isDeletingAll}
            className="w-full py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeletingAll ? "Đang xóa toàn bộ..." : "⚠️ Xóa TOÀN BỘ mạng đường sông"}
          </button>
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
