import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";

export function CreateBoat() {
  const { lang } = useApp();
  const navigate = useNavigate();

  // ==========================================
  // STATE CẤU HÌNH FORM DỮ LIỆU TÀU MỚI
  // ==========================================
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    type: "Standard", // Standard, Express, Taxi
    capacity: 66,      // Sức chứa mặc định
    status: "Active",  // Active, Maintenance, Inactive
    description: "",
  });

  const [selectedImage, setSelectedImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Xử lý thay đổi dữ liệu đầu vào thông thường
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "capacity" ? Math.max(1, parseInt(value) || 0) : value,
    }));
  };

  // Giả lập bắt sự kiện chọn file hình ảnh tàu
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(URL.createObjectURL(file));
    }
  };

  // Logic tự động tính toán sinh ma trận xem trước sơ đồ ghế (Real-time Grid Generator)
  const generatePreviewSeats = () => {
    const totalSeats = formData.capacity;
    // Chia đôi số ghế cho 2 dãy trái (A) và phải (B)
    const seatsPerSide = Math.ceil(totalSeats / 2);
    
    const leftRow = Array.from({ length: seatsPerSide }, (_, i) => `A${i + 1}`);
    const rightRow = Array.from({ length: totalSeats - seatsPerSide }, (_, i) => `B${i + 1}`);
    
    return { leftRow, rightRow };
  };

  const { leftRow, rightRow } = generatePreviewSeats();

  // Xử lý gửi Form gọi API POST lưu trữ
  const handleSubmitForm = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Giả lập độ trễ gọi API Server trong 1.5 giây
    setTimeout(() => {
      setIsSubmitting(false);
      alert(lang === "VN" ? "✓ Thêm mới tàu vào hệ thống dữ liệu thành công!" : "✓ New vessel successfully registered into fleet network!");
      navigate("/admin/boats"); // Điều hướng quay trở về danh sách tàu
    }, 1500);
  };

  return (
    <div className="space-y-6 select-none font-body max-w-6xl mx-auto">
      
      {/* THANH ĐIỀU HƯỚNG QUAY LẠI & TIÊU ĐỀ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/admin/boats-management")}
            className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner"
            title={lang === "VN" ? "Quay lại danh sách" : "Back to Fleet List"}
          >
            <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
          </button>
          <div>
            <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
              {lang === "VN" ? "Khai Báo Thiết Lập Phương Tiện" : "Register New Fleet Vessel"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === "VN" ? "Nhập thông số kỹ thuật phần cứng và cấu hình sơ đồ phân lớp cabin tàu." : "Input core technical hardware metrics and cabin seat configuration blueprints."}
            </p>
          </div>
        </div>
      </div>

      {/* KHỐI BỐ CỤC CHÍNH CHIA ĐÔI FORM (LƯỚI GRID 12 CỘT) */}
      <form onSubmit={handleSubmitForm} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* CỘT BÊN TRÁI (7/12): BIỂU MẪU ĐIỀN THÔNG TIN KỸ THUẬT */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
          <h3 className="text-base font-headline font-black text-[#124757] dark:text-white border-b pb-2.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFD100]">app_registration</span>
            {lang === "VN" ? "Thông số vận hành tàu" : "Vessel Specifications"}
          </h3>

          {/* Hàng 1: Mã số tàu & Tên phương tiện */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Mã đăng ký tàu *" : "Registration ID *"}</label>
              <input
                type="text"
                name="id"
                required
                value={formData.id}
                onChange={handleInputChange}
                placeholder="Ví dụ: SWB-006"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Tên phương tiện *" : "Vessel Name *"}</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ví dụ: Saigon Waterbus 06"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all"
              />
            </div>
          </div>

          {/* Hàng 2: Phân loại tàu & Trạng thái hoạt động đầu tiên */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Phân loại phân lớp *" : "Vessel Classification *"}</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] cursor-pointer"
              >
                <option value="Standard">Standard Vessel (Tàu thường)</option>
                <option value="Express">Express Vessel (Tàu tốc hành)</option>
                <option value="Taxi">Water Taxi (Tàu nhỏ trung chuyển)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Trạng thái ban đầu *" : "Operational Status *"}</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] cursor-pointer"
              >
                <option value="Active">Active (Sẵn sàng chạy)</option>
                <option value="Maintenance">Maintenance (Đang bảo trì/Xưởng)</option>
                <option value="Inactive">Inactive (Tạm khóa lưu kho)</option>
              </select>
            </div>
          </div>

          {/* Hàng 3: Ô Sức chứa hành khách (Bấm tăng giảm số lượng) */}
          <div className="space-y-1.5 max-w-[240px]">
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
                min="1"
                max="200"
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

          {/* Hàng 4: Ghi chú mô tả thêm */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Mô tả / Nhật ký kỹ thuật" : "Vessel Logs Description"}</label>
            <textarea
              name="description"
              rows="3"
              value={formData.description}
              onChange={handleInputChange}
              placeholder={lang === "VN" ? "Nhập thông tin xuất xứ, hãng máy, cấu hình đặc biệt nếu có..." : "Enter build origin, engine specs, custom features details..."}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#124757] rounded-xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all resize-none"
            />
          </div>

          {/* Hàng 5: KHU VỰC TẢI ẢNH TÀU LÊN (IMAGE UPLOAD ZONE) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Hình ảnh đại diện phương tiện" : "Vessel Display Photo"}</label>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              {/* Vùng Dropzone bấm chọn File */}
              <div className="sm:col-span-7 relative h-36 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-[#124757] dark:hover:border-yellow-400 rounded-2xl bg-slate-50 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center p-4 cursor-pointer transition-colors group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                />
                <span className="material-symbols-outlined text-3xl text-slate-300 group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-colors mb-1">add_a_photo</span>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-colors">{lang === "VN" ? "Click để chọn ảnh" : "Browse Image File"}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Hỗ trợ định dạng: JPG, PNG, WEBP</p>
              </div>

              {/* Vùng Khung hiển thị xem trước ảnh (Image Preview Card) */}
              <div className="sm:col-span-5 flex justify-center">
                <div className="w-full h-36 rounded-2xl border dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-inner relative flex items-center justify-center text-slate-300">
                  {selectedImage ? (
                    <img src={selectedImage} alt="Vessel Preview" className="w-full h-full object-cover animate-fade-in" />
                  ) : (
                    <div className="text-center p-3 text-slate-400 text-[11px] font-medium flex flex-col items-center gap-1">
                      <span className="material-symbols-outlined text-2xl opacity-40">image_not_supported</span>
                      {lang === "VN" ? "Chưa có ảnh tải lên" : "No photo attached"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* THANH ĐIỀU HƯỚNG ACTION LƯU HOẶC HỦY Ở CUỐI FORM */}
          <div className="pt-4 border-t border-slate-50 dark:border-slate-700/60 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/boats")}
              className="border border-slate-200 px-6 py-3 rounded-xl text-xs font-bold text-slate-500 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
            >
              {lang === "VN" ? "Hủy bỏ" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider px-8 py-3.5 rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"></div>
                  {lang === "VN" ? "Đang xử lý..." : "Saving..."}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">save_as</span>
                  {lang === "VN" ? "Lưu thông tin tàu" : "Save Vessel Fleet"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* CỘT BÊN PHẢI (5/12): BẢN XEM TRƯỚC SƠ ĐỒ GHẾ CABIN THEO THỜI GIAN THỰC */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
          <div className="text-center border-b pb-4">
            <h4 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
              {lang === "VN" ? "Xem trước sơ đồ khoang ghế" : "Live Cabin Layout Preview"}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 font-medium font-body leading-tight">
              {lang === "VN" 
                ? `Hệ thống tự động đồng bộ lưới grid chia dãy A & B gồm tổng cộng: ${formData.capacity} chỗ ngồi.` 
                : `System live tracking updates grid structures rows A & B containing total: ${formData.capacity} paxes.`}
            </p>
          </div>

          {/* Sơ đồ mô phỏng vỏ tàu khách */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border max-w-sm mx-auto">
            <div className="w-full bg-slate-200 dark:bg-slate-700 text-center py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 mb-6">
              {lang === "VN" ? "Mũi tàu di chuyển" : "Forward Heading"}
            </div>

            {/* Khung chứa các dãy ghế cuốn dọc tự động nếu số lượng ghế quá nhiều */}
            <div className="max-h-[380px] overflow-y-auto pr-1 no-scrollbar custom-scrollbar grid grid-cols-2 gap-8 sm:gap-10">
              
              {/* Dãy trái (Dãy A) */}
              <div className="grid grid-cols-3 gap-1.5">
                {leftRow.map((seat) => (
                  <div
                    key={seat}
                    className="aspect-square rounded-md text-[9px] font-headline font-black bg-white dark:bg-slate-800 text-[#124757] dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm select-none"
                  >
                    {seat}
                  </div>
                ))}
              </div>

              {/* Dãy phải (Dãy B) */}
              <div className="grid grid-cols-3 gap-1.5">
                {rightRow.map((seat) => (
                  <div
                    key={seat}
                    className="aspect-square rounded-md text-[9px] font-headline font-black bg-white dark:bg-slate-800 text-[#124757] dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm select-none"
                  >
                    {seat}
                  </div>
                ))}
              </div>

            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 text-center py-1 rounded-lg text-[9px] font-bold text-slate-400 mt-6 tracking-wider">
              {lang === "VN" ? "Đuôi tàu / Lối thoát" : "Aft Deck Exit"}
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}