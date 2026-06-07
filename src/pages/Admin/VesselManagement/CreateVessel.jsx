import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { addNewVessel } from "../../../services/vesselService"; // Import service tạo tàu thực tế

export function CreateVessel() {
  const { lang } = useApp();
  const navigate = useNavigate();

  // ==========================================
  // STATE CẤU HÌNH FORM DỮ LIỆU TÀU KHỚP PAYLOAD API
  // ==========================================
  const [formData, setFormData] = useState({
    waterbusServiceId: 1,    // 1: Công cộng, 2: Sightseeing
    code: "",                // Số hiệu tàu
    name: "",                // Tên tàu
    status: 1,               // 1: Active, 2: Inactive, 3: Retired, 4: Maintenance
    seatCount: 66,           // Sức chứa ghế ngồi
    numberOfDecks: 1,        // Số tầng (1 hoặc 2)
    registrationNumber: "",  // Số đăng ký (giống code)
    maxSpeedKmh: 20,         // Tốc độ tối đa
    yearBuilt: new Date().getFullYear(), // Năm sản xuất
    description: "",         // Mô tả tàu
    imageUrl: ""             // Chuỗi URL ảnh sau khi upload (ở đây giả lập chuỗi string)
  });

  const [selectedImage, setSelectedImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Xử lý thay đổi dữ liệu đầu vào thông thường
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    setFormData((prev) => {
      let updatedValue = value;

      // Ép kiểu về số (Number) cho các trường số liệu đặc thù của API
      if (["waterbusServiceId", "status", "seatCount", "numberOfDecks", "maxSpeedKmh", "yearBuilt"].includes(name)) {
        updatedValue = Math.max(0, parseInt(value) || 0);
      }

      // Giới hạn biên logic cho số tầng và sức chứa
      if (name === "numberOfDecks") updatedValue = updatedValue > 2 ? 2 : updatedValue < 1 ? 1 : updatedValue;
      if (name === "seatCount") updatedValue = Math.max(1, updatedValue);

      const updatedState = { ...prev, [name]: updatedValue };

      // Quy định nghiệp vụ: registrationNumber luôn giống code và tự động in hoa
      if (name === "code") {
        updatedState.code = value.toUpperCase();
        updatedState.registrationNumber = value.toUpperCase();
      }

      return updatedState;
    });
  };

  // Giám sát và kiểm tra file hình ảnh tải lên (Dưới 5MB, đúng định dạng)
  const handleImageChange = (e) => {
    setErrorMsg("");
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Kiểm tra dung lượng file (5 MB = 5 * 1024 * 1024 bytes)
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg(lang === "VN" ? "Dung lượng ảnh vượt quá 5 MB!" : "Image size exceeds 5 MB!");
        return;
      }

      // Kiểm tra định dạng hình ảnh hợp lệ
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        setErrorMsg(lang === "VN" ? "Ảnh chỉ hỗ trợ định dạng JPEG, PNG hoặc WebP!" : "Only JPEG, PNG or WebP formats are supported!");
        return;
      }

      // Tạo url preview để hiển thị lên màn hình
      setSelectedImage(URL.createObjectURL(file));
      
      // Trong thực tế, bạn sẽ gọi API upload ảnh lên Cloudinary tại đây để lấy URL dạng chuỗi gán vào imageUrl
      setFormData(prev => ({ ...prev, imageUrl: "https://res.cloudinary.com/demo-upload-vessel.png" }));
    }
  };

  // Logic tự động tính toán sinh ma trận xem trước sơ đồ ghế (Real-time Generator)
  const generatePreviewSeats = () => {
    const totalSeats = formData.seatCount;
    const seatsPerSide = Math.ceil(totalSeats / 2);
    
    const leftRow = Array.from({ length: seatsPerSide }, (_, i) => `A${i + 1}`);
    const rightRow = Array.from({ length: totalSeats - seatsPerSide }, (_, i) => `B${i + 1}`);
    
    return { leftRow, rightRow };
  };

  const { leftRow, rightRow } = generatePreviewSeats();

  // Xử lý gửi Form gọi API POST lưu trữ thực tế
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      // Gọi hàm service truyền payload object đã chuẩn hóa cấu trúc
      await addNewVessel(formData);
      
      alert(lang === "VN" ? "✓ Khai báo và thêm mới tàu vào hệ thống thành công!" : "✓ New vessel successfully registered into fleet network!");
      navigate("/admin/vessels-management"); // Điều hướng quay về trang danh sách tàu
    } catch (error) {
        console.error("Create vessel error:", error);
        const backendError = error.response?.data?.message;
        setErrorMsg(
            backendError || 
            (lang === "VN" ? "Lỗi hệ thống, không thể tạo tàu mới. Vui lòng kiểm tra lại dữ liệu." : "System error, failed to register vessel.")
        );
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 select-none font-body max-w-6xl mx-auto">
      
      {/* THANH ĐIỀU HƯỚNG QUAY LẠI & TIÊU ĐỀ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/admin/vessels-management")}
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

      {/* Hiển thị bảng lỗi nếu validate fail */}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 text-red-600 p-4 rounded-2xl text-sm font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">error</span>
          {errorMsg}
        </div>
      )}

      {/* KHỐI BỐ CỤC CHÍNH CHIA ĐÔI FORM */}
      <form onSubmit={handleSubmitForm} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* CỘT BÊN TRÁI (7/12): BIỂU MẪU ĐIỀN THÔNG TIN KỸ THUẬT */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
          <h3 className="text-base font-headline font-black text-[#124757] dark:text-white border-b pb-2.5 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFD100]">app_registration</span>
            {lang === "VN" ? "Thông số vận hành tàu" : "Vessel Specifications"}
          </h3>

          {/* Hàng 1: Loại dịch vụ & Số hiệu tàu (Code) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Mô hình dịch vụ *" : "Waterbus Service *"}</label>
              <select
                name="waterbusServiceId"
                value={formData.waterbusServiceId}
                onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] cursor-pointer"
              >
                <option value={1}>{lang === "VN" ? "Waterbus Công cộng" : "Public Waterbus"}</option>
                <option value={2}>{lang === "VN" ? "Waterbus Sightseeing" : "Sightseeing Waterbus"}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Số hiệu / Mã tàu *" : "Vessel Code *"}</label>
              <input
                type="text"
                name="code"
                required
                value={formData.code}
                onChange={handleInputChange}
                placeholder="Ví dụ: SWB-012"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all uppercase"
              />
            </div>
          </div>

          {/* Hàng 2: Tên phương tiện & Trạng thái ban đầu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Tên tàu thủy *" : "Vessel Name *"}</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ví dụ: Demo Layout 12"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Trạng thái vận hành *" : "Status *"}</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] cursor-pointer"
              >
                <option value={1}>{lang === "VN" ? "Active (Hoạt động)" : "Active"}</option>
                <option value={2}>{lang === "VN" ? "Inactive (Tạm ngưng)" : "Inactive"}</option>
                <option value={3}>{lang === "VN" ? "Retired (Hết hạn)" : "Retired"}</option>
                <option value={4}>{lang === "VN" ? "Maintenance (Bảo trì)" : "Maintenance"}</option>
              </select>
            </div>
          </div>

          {/* Hàng 3: Tốc độ tối đa, Năm sản xuất & Số tầng */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Tốc độ (Km/h) *" : "Max Speed (Kmh) *"}</label>
              <input
                type="number"
                name="maxSpeedKmh"
                required
                min="1"
                value={formData.maxSpeedKmh}
                onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Năm sản xuất *" : "Year Built *"}</label>
              <input
                type="number"
                name="yearBuilt"
                required
                min="1900"
                max={2100}
                value={formData.yearBuilt}
                onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Số kết cấu tầng *" : "Number of Decks *"}</label>
              <select
                name="numberOfDecks"
                value={formData.numberOfDecks}
                onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] cursor-pointer"
              >
                <option value={1}>1 {lang === "VN" ? "Tầng độc lập" : "Deck"}</option>
                <option value={2}>2 {lang === "VN" ? "Tầng cao cấp" : "Decks"}</option>
              </select>
            </div>
          </div>

          {/* Hàng 4: Ô Cấu hình sức chứa hành khách */}
          <div className="space-y-1.5 max-w-[240px]">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Tổng sức chứa (Số ghế) *" : "Seat Count Capacity *"}</label>
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 shadow-inner">
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, seatCount: Math.max(1, p.seatCount - 2) }))}
                className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border flex items-center justify-center font-black active:scale-95 transition-all text-slate-600 dark:text-slate-200 shadow-sm"
              >
                -2
              </button>
              <input
                type="number"
                name="seatCount"
                min="1"
                max="200"
                value={formData.seatCount}
                onChange={handleInputChange}
                className="w-16 bg-transparent text-center font-headline font-black text-lg text-[#124757] dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, seatCount: Math.min(200, p.seatCount + 2) }))}
                className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border flex items-center justify-center font-black active:scale-95 transition-all text-slate-600 dark:text-slate-200 shadow-sm"
              >
                +2
              </button>
            </div>
          </div>

          {/* Hàng 5: Ghi chú mô tả thêm */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Mô tả chi tiết kỹ thuật" : "Vessel Description"}</label>
            <textarea
              name="description"
              rows="3"
              value={formData.description}
              onChange={handleInputChange}
              placeholder={lang === "VN" ? "Nhập thông tin xuất xứ, hãng máy, cấu hình đặc biệt..." : "Enter build origin, engine specs details..."}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#124757] rounded-xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all resize-none"
            />
          </div>

          {/* Hàng 6: KHU VỰC TẢI ẢNH TÀU LÊN (MAX 5MB) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === "VN" ? "Hình ảnh minh họa (Tối đa 5 MB) *" : "Vessel Display Photo (Max 5 MB) *"}</label>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-7 relative h-36 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-[#124757] dark:hover:border-yellow-400 rounded-2xl bg-slate-50 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center p-4 cursor-pointer transition-colors group">
                <input
                  type="file"
                  accept="image/jpeg, image/png, image/webp"
                  onChange={handleImageChange}
                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                />
                <span className="material-symbols-outlined text-3xl text-slate-300 group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-colors mb-1">add_a_photo</span>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-colors">{lang === "VN" ? "Click chọn file ảnh" : "Browse Image File"}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG, WEBP (Tối đa 5MB)</p>
              </div>

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

          {/* ACTION BUTTONS Ở CUỐI FORM */}
          <div className="pt-4 border-t border-slate-50 dark:border-slate-700/60 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/vessels-management")}
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
                  {lang === "VN" ? "Đang gửi API..." : "Saving..."}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">save_as</span>
                  {lang === "VN" ? "Lưu thông tin tàu" : "Save Vessel"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* CỘT BÊN PHẢI (5/12): XEM TRƯỚC SƠ ĐỒ GHẾ CABIN THEO TIME REAL */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
          <div className="text-center border-b pb-4">
            <h4 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
              {lang === "VN" ? "Xem trước sơ đồ khoang ghế" : "Live Cabin Layout Preview"}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 font-medium font-body leading-tight">
              {lang === "VN" 
                ? `Hệ thống tự động đồng bộ lưới grid chia dãy A & B gồm tổng cộng: ${formData.seatCount} chỗ ngồi.` 
                : `System live tracking updates grid structures rows A & B containing total: ${formData.seatCount} paxes.`}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border max-w-sm mx-auto">
            <div className="w-full bg-slate-200 dark:bg-slate-700 text-center py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 mb-6">
              {lang === "VN" ? "Mũi tàu di chuyển" : "Forward Heading"}
            </div>

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