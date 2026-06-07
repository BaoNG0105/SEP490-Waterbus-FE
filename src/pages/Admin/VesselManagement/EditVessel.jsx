import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext";

export function EditVessel() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { id } = useParams(); // Lấy ID tàu từ URL (Ví dụ: /admin/boats/edit/SWB-001)

  // ==========================================
  // STATE QUẢN LÝ DỮ LIỆU & UI
  // ==========================================
  const [formData, setFormData] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Giả lập gọi API lấy dữ liệu tàu cũ dựa vào mã ID nhận từ URL
  useEffect(() => {
    const fetchBoatData = setTimeout(() => {
      // Cấu trúc object dữ liệu giả lập đổ lên form chỉnh sửa
      const mockFetchedData = {
        id: id,
        name: id === "SWB-001" ? "Saigon Waterbus 01" : `Vessel ${id}`,
        type: "Standard",
        capacity: 66,
        status: "Active",
        description: "Phương tiện vận hành tốt, vừa hoàn thành bảo dưỡng chân vịt định kỳ kỹ thuật.",
        image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png"
      };
      
      setFormData(mockFetchedData);
      setSelectedImage(mockFetchedData.image);
      setIsLoading(false);
    }, 600);

    return () => clearTimeout(fetchBoatData);
  }, [id]);

  // Xử lý cập nhật state khi admin thay đổi text input
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "capacity" ? Math.max(1, parseInt(value) || 0) : value,
    }));
  };

  // Xem trước hình ảnh mới khi chọn file tải lên
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(URL.createObjectURL(file));
    }
  };

  // Hàm tự động tính toán sinh ma trận hiển thị danh sách ghế ngồi theo thời gian thực
  const generatePreviewSeats = () => {
    if (!formData) return { leftRow: [], rightRow: [] };
    const totalSeats = formData.capacity;
    const seatsPerSide = Math.ceil(totalSeats / 2);
    
    const leftRow = Array.from({ length: seatsPerSide }, (_, i) => `A${i + 1}`);
    const rightRow = Array.from({ length: totalSeats - seatsPerSide }, (_, i) => `B${i + 1}`);
    
    return { leftRow, rightRow };
  };

  // Gửi form xử lý gọi API PUT/PATCH cập nhật dữ liệu lên hệ thống
  const handleSubmitForm = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      alert(lang === "VN" ? "✓ Cập nhật thông tin cấu hình tàu thành công!" : "✓ Vessel configurations successfully saved!");
      navigate("/admin/vessels-management"); // Đồng bộ điều hướng quay về trang danh sách
    }, 1200);
  };

  // Màn hình hiệu ứng chờ tải dữ liệu ban đầu
  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-slate-700 dark:border-t-yellow-400 rounded-full animate-spin"></div>
        <p className="text-xs font-bold animate-pulse">{lang === "VN" ? "Đang truy vấn dữ liệu tàu thủy..." : "Fetching vessel hardware data..."}</p>
      </div>
    );
  }

  const { leftRow, rightRow } = generatePreviewSeats();

  return (
    <div className="space-y-6 select-none font-body max-w-6xl mx-auto animate-fade-in">
      
      {/* THANH TIÊU ĐỀ & ĐIỀU HƯỚNG QUAY LẠI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/admin/vessels-management")}
            className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner"
            title={lang === "VN" ? "Quay lại danh sách" : "Back"}
          >
            <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
          </button>
          <div>
            <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide flex flex-wrap items-center gap-2">
              {lang === "VN" ? "Cấu Hình Chỉnh Sửa Tàu" : "Modify Fleet Vessel"}
              <span className="text-xs bg-slate-100 dark:bg-slate-900 text-slate-500 font-mono px-2.5 py-1 rounded-lg border dark:border-slate-700">{formData.id}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === "VN" ? "Thay đổi thông số kỹ thuật phần cứng, cập nhật trạng thái vận hành của phương tiện." : "Update technical hardware metrics and override operational status codes."}
            </p>
          </div>
        </div>
      </div>

      {/* KHỐI FORM LỚN CHIA LÀM HAI CỘT */}
      <form onSubmit={handleSubmitForm} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* CỘT TRÁI (Tỷ lệ 7/12): ĐIỀN THÔNG TIN */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
          <h3 className="text-base font-headline font-black text-[#124757] dark:text-white border-b pb-2.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFD100]">edit_note</span>
            {lang === "VN" ? "Thông số kỹ thuật điều chỉnh" : "Vessel Specifications"}
          </h3>

          {/* Ô Mã số tàu (Khóa chính - Khóa không cho sửa) & Tên Tàu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 opacity-60">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Mã đăng ký (Cố định)" : "Registration ID (Locked)"}</label>
              <input
                type="text"
                disabled
                value={formData.id}
                className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 cursor-not-allowed uppercase shadow-inner"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Tên phương tiện tàu *" : "Vessel Name *"}</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all"
              />
            </div>
          </div>

          {/* Phân loại và Trạng thái */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Phân loại phân lớp *" : "Classification *"}</label>
              <select name="type" value={formData.type} onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] cursor-pointer">
                <option value="Standard">Standard Vessel (Tàu thường)</option>
                <option value="Express">Express Vessel (Tàu tốc hành)</option>
                <option value="Taxi">Water Taxi (Tàu nhỏ trung chuyển)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Trạng thái vận hành *" : "Operational Status *"}</label>
              <select name="status" value={formData.status} onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] cursor-pointer">
                <option value="Active">Active (Sẵn sàng hoạt động)</option>
                <option value="Maintenance">Maintenance (Đang bảo trì tại xưởng)</option>
                <option value="Inactive">Inactive (Tạm ngưng hoạt động)</option>
              </select>
            </div>
          </div>

          {/* Cấu hình sức chứa ghế ngồi (Sửa lỗi dấu gạch chéo ngược) */}
          <div className="space-y-1.5 max-w-60">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Sức chứa tối đa (Số ghế) *" : "Max Seating Capacity *"}</label>
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 shadow-inner">
              <button 
                type="button" 
                onClick={() => setFormData(p => ({ ...p, capacity: Math.max(1, p.capacity - 2) }))} 
                className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border flex items-center justify-center font-black active:scale-95 transition-all text-slate-600 dark:text-slate-200 shadow-sm"
              >
                -2
              </button>
              <input 
                type="number" 
                name="capacity" 
                value={formData.capacity} 
                onChange={handleInputChange} 
                className="w-16 bg-transparent text-center font-headline font-black text-lg text-[#124757] dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
              />
              <button 
                type="button" 
                onClick={() => setFormData(p => ({ ...p, capacity: Math.min(200, p.capacity + 2) }))} 
                className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border flex items-center justify-center font-black active:scale-95 transition-all text-slate-600 dark:text-slate-200 shadow-sm"
              >
                +2
              </button>
            </div>
          </div>

          {/* Mô tả chi tiết */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Mô tả lý lịch phương tiện" : "Vessel Hardware Description"}</label>
            <textarea name="description" rows="3" value={formData.description} onChange={handleInputChange} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#124757] rounded-xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all resize-none" />
          </div>

          {/* Upload hình ảnh đại diện tàu */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Hình ảnh đại diện tàu" : "Vessel Photo Blueprint"}</label>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-7 relative h-36 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-[#124757] dark:hover:border-yellow-400 rounded-2xl bg-slate-50 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center p-4 cursor-pointer transition-colors group">
                <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
                <span className="material-symbols-outlined text-3xl text-slate-300 group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-colors mb-1">add_a_photo</span>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide group-hover:text-[#124757] dark:group-hover:text-yellow-400">{lang === "VN" ? "Thay đổi hình ảnh mới" : "Upload New Image"}</p>
              </div>
              <div className="sm:col-span-5 flex justify-center">
                <div className="w-full h-36 rounded-2xl border dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-inner relative flex items-center justify-center">
                  {selectedImage && <img src={selectedImage} alt="Vessel Blueprint Preview" className="w-full h-full object-cover animate-fade-in" />}
                </div>
              </div>
            </div>
          </div>

          {/* HÀNH ĐỘNG NÚT BẤM DƯỚI CÙNG FORM */}
          <div className="pt-4 border-t border-slate-50 dark:border-slate-700/60 flex justify-end gap-3">
            <button type="button" onClick={() => navigate("/admin/vessels-management")} className="border px-6 py-3 rounded-xl text-xs font-bold text-slate-500 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50/50 transition-colors">{lang === "VN" ? "Hủy bỏ" : "Cancel"}</button>
            <button type="submit" disabled={isSubmitting} className="bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider px-8 py-3.5 rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2">
              {isSubmitting ? <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"></div> : <span className="material-symbols-outlined text-base">save_as</span>}
              {lang === "VN" ? "Lưu lại thay đổi" : "Save Changes"}
            </button>
          </div>
        </div>

        {/* CỘT PHẢI (Tỷ lệ 5/12): REAL-TIME PREVIEW SƠ ĐỒ GHẾ CABIN TÀU THỦY */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
          <div className="text-center border-b pb-4">
            <h4 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
              {lang === "VN" ? "Sơ đồ ma trận cabin xem trước" : "Live Cabin Layout Matrix"}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 font-medium font-body leading-tight">
              {lang === "VN" ? `Đang đồng bộ lưới lưới tự động cho: ${formData.capacity} vị trí ghế.` : `Live mapping active tracking grid for: ${formData.capacity} paxes layout.`}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border max-w-sm mx-auto">
            <div className="w-full bg-slate-200 dark:bg-slate-700 text-center py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 mb-6">
              {lang === "VN" ? "Hướng mũi tàu di chuyển" : "Forward Hull"}
            </div>

            <div className="max-h-95 overflow-y-auto pr-1 no-scrollbar custom-scrollbar grid grid-cols-2 gap-8 sm:gap-10">
              {/* Dãy A trái */}
              <div className="grid grid-cols-3 gap-1.5">
                {leftRow.map((seat) => (
                  <div key={seat} className="aspect-square rounded-md text-[9px] font-headline font-black bg-white dark:bg-slate-800 text-[#124757] dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm select-none">{seat}</div>
                ))}
              </div>
              {/* Dãy B phải */}
              <div className="grid grid-cols-3 gap-1.5">
                {rightRow.map((seat) => (
                  <div key={seat} className="aspect-square rounded-md text-[9px] font-headline font-black bg-white dark:bg-slate-800 text-[#124757] dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm select-none">{seat}</div>
                ))}
              </div>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 text-center py-1 rounded-lg text-[9px] font-bold text-slate-400 mt-6 tracking-wider">
              {lang === "VN" ? "Lối thoát hiểm đuôi tàu" : "Aft Exit"}
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}