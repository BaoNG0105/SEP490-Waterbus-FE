import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { addNewVessel } from "../../../services/vesselService"; 

export function CreateVessel() {
  const { lang } = useApp();
  const navigate = useNavigate();

  // ==========================================
  // STATE CẤU HÌNH FORM DỮ LIỆU TÀU (Đã gỡ bỏ status và service)
  // ==========================================
  const [formData, setFormData] = useState({
    code: "",                        // Số hiệu tàu
    name: "",                        // Tên tàu
    seatCount: 1,                   // Sức chứa (Tổng số ghế)
    passengerCapacity: 1,           // Sức chứa hành khách tối đa
    numberOfDecks: 1,                // Số tầng
    seatSetupType: "FullStandard",   // Kiểu thiết lập ghế: FullStandard | StandardAndVip
    registrationNumber: "",          // Số đăng ký/Đăng kiểm
    maxSpeedKmh: 0,                 // Tốc độ tối đa
    yearBuilt: new Date().getFullYear(), // Năm đóng tàu
    description: "",                 // Mô tả tàu
    imageUrl: ""                     // URL xem trước ảnh
  });

  const [selectedImage, setSelectedImage] = useState(null); // File ảnh thật
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ==========================================
  // XỬ LÝ CHỌN VÀ VALIDATE ẢNH (<= 5MB, JPEG/PNG/WEBP)
  // ==========================================
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 1. Validate định dạng
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert(lang === "VN" ? "Chỉ hỗ trợ định dạng ảnh JPEG, PNG hoặc WebP." : "Only JPEG, PNG, or WebP images are supported.");
        e.target.value = null; // Reset input
        return;
      }

      // 2. Validate dung lượng (< 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB in Bytes
      if (file.size > maxSize) {
        alert(lang === "VN" ? "Dung lượng ảnh tối đa không được vượt quá 5MB." : "Maximum image size must not exceed 5MB.");
        e.target.value = null; // Reset input
        return;
      }

      setSelectedImage(file);
      const fakeUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, imageUrl: fakeUrl }));
    }
  };

  // ==========================================
  // XỬ LÝ SUBMIT (TỰ ĐỘNG CHIA NHÁNH JSON HOẶC FORMDATA)
  // ==========================================
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg("");

      // Chuẩn hóa Code in hoa theo rule BE
      const normalizedCode = formData.code.trim().toUpperCase();
      let payload;

      if (selectedImage) {
        // TRƯỜNG HỢP CÓ ẢNH -> DÙNG MULTIPART/FORM-DATA
        payload = new FormData();
        payload.append("code", normalizedCode);
        payload.append("name", formData.name.trim());
        payload.append("seatCount", formData.seatCount);
        payload.append("passengerCapacity", formData.passengerCapacity);
        payload.append("numberOfDecks", formData.numberOfDecks);
        payload.append("seatSetupType", formData.seatSetupType);
        payload.append("registrationNumber", formData.registrationNumber.trim());
        payload.append("maxSpeedKmh", formData.maxSpeedKmh);
        payload.append("yearBuilt", formData.yearBuilt);
        payload.append("description", formData.description.trim());
        payload.append("image", selectedImage); // Field ảnh
      } else {
        // TRƯỜNG HỢP KHÔNG ẢNH -> DÙNG APPLICATION/JSON
        payload = {
          code: normalizedCode,
          name: formData.name.trim(),
          seatCount: formData.seatCount,
          passengerCapacity: formData.passengerCapacity,
          numberOfDecks: formData.numberOfDecks,
          seatSetupType: formData.seatSetupType,
          registrationNumber: formData.registrationNumber.trim(),
          maxSpeedKmh: formData.maxSpeedKmh,
          yearBuilt: formData.yearBuilt,
          description: formData.description.trim()
        };
      }

      await addNewVessel(payload);

      alert(lang === "VN" ? "✓ Đăng ký phương tiện mới thành công!" : "✓ New vessel registered successfully!");
      navigate("/admin/vessels-management");
    } catch (error) {
      console.error("Lỗi khi tạo tàu:", error);
      const backendMsg = error.response?.data?.message;
      
      // Bóc tách lỗi Validation (Đặc biệt để bắt lỗi trùng RegistrationNumber)
      let validationMsg = "";
      if (error.response?.data?.errors) {
        const validationErrors = Object.values(error.response.data.errors).flat().join(" | ");
        validationMsg = `Lỗi Validation: ${validationErrors}`;
      }

      setErrorMsg(validationMsg || backendMsg || (lang === "VN" ? "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin." : "Registration failed. Please check the provided details."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-body max-w-4xl mx-auto">
      
      {/* HEADER CONTROLS */}
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/vessels-management")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Đăng ký phương tiện mới" : "Register New Vessel"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN" ? "Nhập thông tin hành chính để thêm tàu mới vào hạm đội. (Sơ đồ ghế sẽ được thiết lập sau)." : "Input administrative details to append a new fleet vessel. (Seat architecture will be configured later)."}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100 dark:border-red-500/20">
          <span className="material-symbols-outlined">error</span>
          {errorMsg}
        </div>
      )}

      {/* KHU VỰC FORM ĐIỀN THÔNG TIN */}
      <form onSubmit={handleSubmitForm} className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
        <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b pb-2 mb-2">
          📋 {lang === "VN" ? "Thông số kỹ thuật & Hành chính" : "Technical & Administrative Specs"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Mã hiệu (Code) (*)" : "Vessel Code Identifier"}</label>
            <input
              type="text" required value={formData.code}
              onChange={(e) => handleInputChange("code", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner uppercase"
              placeholder="VD: WB_001"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Tên phương tiện (*)" : "Vessel Label Name"}</label>
            <input
              type="text" required value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              placeholder="VD: Saigon Waterbus 01"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Số Đăng kiểm (*)" : "Registration Number"}</label>
            <input
              type="text" required value={formData.registrationNumber}
              onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              placeholder="VD: SG-WB-001"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Kiểu setup sơ đồ ghế" : "Seat Setup Type"}</label>
            <select
              value={formData.seatSetupType}
              onChange={(e) => handleInputChange("seatSetupType", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
            >
              <option value="FullStandard">{lang === "VN" ? "Toàn bộ ghế Thường (Full Standard)" : "Full Standard Seating"}</option>
              <option value="StandardAndVip">{lang === "VN" ? "Có kết hợp ghế VIP (Standard & VIP)" : "Standard & VIP Seating"}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Sức chứa (Tổng số ghế) (*)" : "Total Seat Capacity"}</label>
            <input
              type="number" required min={1} max={500} value={formData.seatCount}
              onChange={(e) => handleInputChange("seatCount", Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Tối đa hành khách (*)" : "Passenger Capacity"}</label>
            <input
              type="number" required min={1} max={500} value={formData.passengerCapacity}
              onChange={(e) => handleInputChange("passengerCapacity", Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Số tầng" : "Number of Decks"}</label>
            <input
              type="number" required min={1} max={3} value={formData.numberOfDecks}
              onChange={(e) => handleInputChange("numberOfDecks", Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Tốc độ tối đa (km/h)" : "Cruising Max Speed"}</label>
            <input
              type="number" value={formData.maxSpeedKmh}
              onChange={(e) => handleInputChange("maxSpeedKmh", Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Năm đóng tàu" : "Year Built"}</label>
            <input
              type="number" value={formData.yearBuilt}
              onChange={(e) => handleInputChange("yearBuilt", Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Mô tả phương tiện" : "Vessel Description"}</label>
          <textarea
            rows={3} value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner resize-none"
            placeholder={lang === "VN" ? "Nhập thông tin giới thiệu, mô tả về tàu..." : "Enter vessel details..."}
          />
        </div>

        {/* KHU VỰC UPLOAD ẢNH */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">{lang === "VN" ? "Hình ảnh đại diện" : "Vessel Image Profile"}</label>
          <div className="flex flex-wrap items-center gap-6">
            <div className="w-32 h-20 rounded-2xl border bg-slate-50 dark:bg-slate-900 overflow-hidden flex items-center justify-center relative group shadow-inner">
              {formData.imageUrl ? (
                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-slate-300 text-3xl">directions_boat</span>
              )}
            </div>
            <label className="bg-slate-100 hover:bg-[#124757] hover:text-white dark:bg-slate-900 border px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm">
              <span>{lang === "VN" ? "Chọn hình ảnh" : "Upload Image"}</span>
              <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleImageChange} className="hidden" />
            </label>
            <p className="text-[10px] text-slate-400 font-medium">
              * {lang === "VN" ? "Hỗ trợ JPEG, PNG, WebP (Tối đa 5MB)." : "JPEG, PNG, WebP supported (Max 5MB)."}
            </p>
          </div>
        </div>

        {/* NÚT SUBMIT */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
          <button
            type="submit" disabled={isSubmitting}
            className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-md hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                {lang === "VN" ? "Đăng ký tàu" : "Register Vessel"}
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}