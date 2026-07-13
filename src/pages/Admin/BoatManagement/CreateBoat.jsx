import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { addNewBoat } from "../../../services/boatService";
import { FormSelect } from "../../../components/FormSelect";
import Swal from "sweetalert2";

export function CreateBoat() {
  const { lang } = useApp();
  const navigate = useNavigate();

  // STATE CẤU HÌNH FORM DỮ LIỆU TÀU
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    numberOfDecks: 1, // Mặc định 1 tầng
    seatSetupType: "FullStandard",
    registrationNumber: "",
    maxSpeedKmh: 0,
    yearBuilt: new Date().getFullYear(),
    description: "",
    rentalPrices: [] // Mảng động lưu trữ giá thuê
  });

  const [selectedImages, setSelectedImages] = useState([]); // Mảng lưu các file ảnh thật
  const [imagePreviews, setImagePreviews] = useState([]);   // Mảng lưu URL blob để preview
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // XỬ LÝ: THÊM / XÓA / SỬA GIÁ THUÊ (RENTAL PRICES)
  const handleAddRentalPrice = () => {
    setFormData((prev) => ({
      ...prev,
      rentalPrices: [...prev.rentalPrices, { rentalUnit: "Day", unitPrice: 0, currency: "VND", note: "" }]
    }));
  };

  const handleRentalPriceChange = (index, field, value) => {
    const updatedPrices = [...formData.rentalPrices];
    updatedPrices[index][field] = field === "unitPrice" ? Number(value) : value;
    setFormData((prev) => ({ ...prev, rentalPrices: updatedPrices }));
  };

  const handleRemoveRentalPrice = (index) => {
    setFormData((prev) => ({
      ...prev,
      rentalPrices: prev.rentalPrices.filter((_, i) => i !== index)
    }));
  };

  // QUẢN LÝ THƯ VIỆN HÌNH ẢNH UPLOAD (tối đa 3 ảnh)
  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    
    // Ràng buộc giới hạn 3 hình ảnh
    if (imagePreviews.length + files.length > 3) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Quá số lượng" : "Limit Exceeded",
        text: lang === "VN" ? "Hệ thống chỉ cho phép lưu trữ tối đa 3 hình ảnh cho mỗi phương tiện." : "Maximum 3 images allowed per vessel.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5MB
    const newValidFiles = [];
    const newPreviews = [];

    for (let file of files) {
      if (!validTypes.includes(file.type)) continue;
      if (file.size > maxSize) continue;
      newValidFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setSelectedImages((prev) => [...prev, ...newValidFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = null;
  };

  const handleRemoveImage = (indexToRemove) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== indexToRemove));
    setImagePreviews((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  // GỬI PAYLOAD LÊN API TẠO TÀU MỚI
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const payload = new FormData();

      // Gắn các thông số kỹ thuật cơ bản
      payload.append("code", formData.code.trim());
      payload.append("name", formData.name.trim());
      payload.append("numberOfDecks", String(formData.numberOfDecks));
      payload.append("seatSetupType", formData.seatSetupType);
      payload.append("maxSpeedKmh", String(formData.maxSpeedKmh));
      payload.append("yearBuilt", String(formData.yearBuilt));
      if (formData.registrationNumber.trim()) payload.append("registrationNumber", formData.registrationNumber.trim());
      if (formData.description.trim()) payload.append("description", formData.description.trim());

      // Gắn danh sách ảnh
      selectedImages.forEach((file) => payload.append("images", file));

      // Định dạng mảng rentalPrices lồng ghép gửi vào FormData
      if (formData.rentalPrices.length > 0) {
        formData.rentalPrices.forEach((price, idx) => {
          payload.append(`rentalPrices[${idx}].rentalUnit`, price.rentalUnit);
          payload.append(`rentalPrices[${idx}].unitPrice`, String(price.unitPrice));
          payload.append(`rentalPrices[${idx}].currency`, price.currency || "VND");
          if (price.note) payload.append(`rentalPrices[${idx}].note`, price.note.trim());
        });
      }

      await addNewBoat(payload);

      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Tạo tàu thành công!" : "Successfully Created!",
        text: lang === "VN" ? "Phương tiện mới đã được thêm vào hệ thống." : "A new vessel has been registered successfully.",
        confirmButtonColor: "#124757",
      }).then(() => navigate("/admin/boats-management"));

    } catch (error) {
      console.error("Lỗi thêm tàu mới:", error);
      let validationError = "";
      if (error.response?.data?.errors) {
        validationError = Object.values(error.response.data.errors).flat().join(" | ");
      }
      setErrorMsg(validationError || error.response?.data?.message || (lang === "VN" ? "Lưu thông tin thất bại." : "Failed to create vessel."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
  const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
  const selectStyle = `${inputStyle} cursor-pointer`;
  const deckOptions = [
    { value: 1, label: lang === "VN" ? "1 Tầng" : "1 Deck" },
    { value: 2, label: lang === "VN" ? "2 Tầng" : "2 Decks" },
  ];
  const seatSetupOptions = [
    { value: "FullStandard", label: "Waterbus" },
    { value: "StandardAndVip", label: "Water Sightseeing" },
  ];

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-4xl mx-auto animate-fade-in">
      
      {/* KHỐI TIÊU ĐỀ HEADER */}
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button 
          type="button" 
          onClick={() => navigate("/admin/boats-management")} 
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white transition-all flex items-center justify-center shadow-inner shrink-0"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Đăng ký phương tiện mới" : "Register New Vessel"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN" ? "Khai báo thông số kỹ thuật, giá thuê charter và cấu hình thân vỏ cho tàu thủy mới." : "Initialize hardware profile and rental tariffs for a new boat."}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      {/* FORM NHẬP THÔNG TIN */}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        
        {/* KHỐI 1: THÔNG SỐ CƠ BẢN */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
          <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
            {lang === "VN" ? "Thông số chung" : "General Information"}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Mã hiệu tàu (*)" : "Vessel Code (*)"}</label>
              <input type="text" required placeholder="VD: WB_001" value={formData.code} onChange={(e) => handleInputChange("code", e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Tên phương tiện (*)" : "Vessel Name (*)"}</label>
              <input type="text" required placeholder="VD: Waterbus 001" value={formData.name} onChange={(e) => handleInputChange("name", e.target.value)} className={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Mã số đăng ký" : "Registration Number"}</label>
              <input type="text" placeholder="VD: VN-001" value={formData.registrationNumber} onChange={(e) => handleInputChange("registrationNumber", e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Năm đóng tàu" : "Year Built"}</label>
              <input type="number" min={1900} max={2100} required value={formData.yearBuilt} onChange={(e) => handleInputChange("yearBuilt", e.target.value)} className={inputStyle} />
            </div>
          </div>
        </div>

        {/* KHỐI 2: CẤU HÌNH HẠ TẦNG */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5 overflow-visible">
          <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
            {lang === "VN" ? "Cấu trúc hạ tầng" : "Infrastructure"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 overflow-visible">
            <div className="relative z-20">
              <label className={labelStyle}>{lang === "VN" ? "Số tầng tàu" : "Decks"}</label>
              <FormSelect
                value={formData.numberOfDecks}
                onChange={(v) => handleInputChange("numberOfDecks", Number(v))}
                options={deckOptions}
                className={selectStyle}
              />
            </div>
            <div className="relative z-30">
              <label className={labelStyle}>{lang === "VN" ? "Kiểu thiết lập ghế" : "Seat Setup Type"}</label>
              <FormSelect
                value={formData.seatSetupType}
                onChange={(v) => handleInputChange("seatSetupType", v)}
                options={seatSetupOptions}
                className={`${selectStyle} font-bold text-[#124757]`}
              />
            </div>
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Vận tốc tối đa (Kmh)" : "Max Speed (Kmh)"}</label>
              <input type="number" min={0} required value={formData.maxSpeedKmh} onChange={(e) => handleInputChange("maxSpeedKmh", e.target.value)} className={inputStyle} />
            </div>
          </div>

          <div>
            <label className={labelStyle}>{lang === "VN" ? "Mô tả ghi chú kỹ thuật" : "Engineering Notes"}</label>
            <textarea rows={3} placeholder={lang === "VN" ? "Nhập chi tiết về thiết kế, động cơ, đặc quyền..." : "Provide details about engine and perks..."} value={formData.description} onChange={(e) => handleInputChange("description", e.target.value)} className={`${inputStyle} resize-none font-medium`} />
          </div>
        </div>

        {/* KHỐI 3: THƯ VIỆN ẢNH (TỐI ĐA 3 ẢNH) */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
            <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
              {lang === "VN" ? "Bộ sưu tập ảnh" : "Gallery"}
            </h3>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${imagePreviews.length === 3 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
              {imagePreviews.length} / 3
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {imagePreviews.map((previewUrl, index) => (
              <div key={index} className="aspect-4/3 relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group shadow-sm">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                  <button type="button" onClick={() => handleRemoveImage(index)} className="bg-rose-500 text-white p-2 rounded-full hover:scale-110 transition-all shadow-lg">
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
            
            {imagePreviews.length < 3 && (
              <label className="aspect-4/3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center cursor-pointer transition-all">
                <span className="material-symbols-outlined text-2xl text-slate-400 mb-1">add_photo_alternate</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tải ảnh lên</span>
                <input type="file" multiple accept="image/jpeg, image/png, image/webp" onChange={handleImagesChange} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {/* KHỐI 4: BẢNG GIÁ THUÊ TÀU (CHARTER RENTAL) */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
             <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
               {lang === "VN" ? "Giá cho thuê nguyên chuyến" : "Charter Pricing"}
             </h3>
             <button type="button" onClick={handleAddRentalPrice} className="px-3 py-1.5 bg-[#124757]/10 text-[#124757] dark:bg-yellow-400/10 dark:text-yellow-400 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-colors flex items-center gap-1">
               <span className="material-symbols-outlined text-sm">add</span> {lang === "VN" ? "Thêm gói" : "Add"}
             </button>
          </div>

          <div className="space-y-3">
            {formData.rentalPrices.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-400 font-medium">{lang === "VN" ? "Tàu này hiện chưa có cấu hình giá cho thuê Charter." : "No rental tariffs configured for this vessel."}</p>
              </div>
            ) : (
              formData.rentalPrices.map((price, index) => (
                <div key={index} className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 relative group">
                  
                  <button type="button" onClick={() => handleRemoveRentalPrice(index)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 transition-colors">
                    <span className="material-symbols-outlined text-lg">cancel</span>
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pr-6">
                    <div>
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Đơn vị (Unit)</label>
                      <select value={price.rentalUnit} onChange={(e) => handleRentalPriceChange(index, "rentalUnit", e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-[#124757] dark:text-yellow-400 outline-none cursor-pointer">
                        <option value="Day">Theo Ngày (Day)</option>
                        <option value="Hour">Theo Giờ (Hour)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Giá tiền (Price)</label>
                      <input type="number" min={0} value={price.unitPrice} onChange={(e) => handleRentalPriceChange(index, "unitPrice", e.target.value)} placeholder="0" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-[#124757]" />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Ghi chú (Note)</label>
                      <input type="text" value={price.note} onChange={(e) => handleRentalPriceChange(index, "note", e.target.value)} placeholder="VD: Gồm VAT" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-[#124757]" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* NÚT SUBMIT LƯU THÔNG TIN */}
        <div>
          <button
            type="submit" disabled={isSubmitting}
            className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="material-symbols-outlined text-lg"></span>
            )}
            {lang === "VN" ? "Khởi tạo tàu" : "Complete Registration"}
          </button>
        </div>
      </form>

    </div>
  );
}