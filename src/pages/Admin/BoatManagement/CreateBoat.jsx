import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { addNewBoat } from "../../../services/boatService";

export function CreateBoat() {
  const { lang } = useApp();
  const navigate = useNavigate();

  // ==========================================
  // STATE CẤU HÌNH FORM DỮ LIỆU TÀU
  // ==========================================
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    seatCount: 1,
    numberOfDecks: 1,
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

  // ==========================================
  // XỬ LÝ: THÊM / XÓA / SỬA GIÁ THUÊ (RENTAL PRICES)
  // ==========================================
  const handleAddRentalPrice = () => {
    setFormData((prev) => ({
      ...prev,
      rentalPrices: [
        ...prev.rentalPrices,
        { rentalUnit: "Day", unitPrice: 0, currency: "VND", note: "" }
      ]
    }));
  };

  const handleRemoveRentalPrice = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      rentalPrices: prev.rentalPrices.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleRentalPriceChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedPrices = [...prev.rentalPrices];
      updatedPrices[index] = { ...updatedPrices[index], [field]: value };
      return { ...prev, rentalPrices: updatedPrices };
    });
  };

  // ==========================================
  // XỬ LÝ UPLOAD NHIỀU ẢNH (MAX 10 ẢNH, <= 5MB)
  // ==========================================
  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);

    // Kiểm tra giới hạn số lượng ảnh (Tối đa 10)
    if (selectedImages.length + files.length > 10) {
      alert(lang === "VN" ? "Mỗi tàu chỉ được tải lên tối đa 10 ảnh." : "Maximum 10 images allowed per boat.");
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    const newValidFiles = [];
    const newPreviews = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!validTypes.includes(file.type)) {
        alert(lang === "VN" ? `File ${file.name} không đúng định dạng JPEG/PNG/WebP.` : `File ${file.name} must be JPEG, PNG, or WebP.`);
        continue;
      }
      if (file.size > maxSize) {
        alert(lang === "VN" ? `File ${file.name} vượt quá dung lượng 5MB.` : `File ${file.name} exceeds 5MB.`);
        continue;
      }

      newValidFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    setSelectedImages((prev) => [...prev, ...newValidFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = null; // Reset input
  };

  const handleRemoveImage = (indexToRemove) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== indexToRemove));
    setImagePreviews((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  // ==========================================
  // SUBMIT GỬI LÊN BACKEND (PHÂN CHIA JSON / MULTIPART)
  // ==========================================
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const normalizedCode = formData.code.trim().toUpperCase();
      let payload;

      if (selectedImages.length > 0) {
        // TRƯỜNG HỢP 1: CÓ ẢNH -> GỬI FORMDATA (Ép kiểu String)
        payload = new FormData();
        payload.append("code", normalizedCode);
        payload.append("name", formData.name.trim());
        payload.append("seatCount", String(formData.seatCount));
        payload.append("numberOfDecks", String(formData.numberOfDecks));
        payload.append("seatSetupType", formData.seatSetupType);
        payload.append("registrationNumber", formData.registrationNumber.trim() || "");
        payload.append("maxSpeedKmh", String(formData.maxSpeedKmh));
        payload.append("yearBuilt", String(formData.yearBuilt));
        payload.append("description", formData.description.trim() || "");

        // Map mảng giá thuê sang FormData theo format BE yêu cầu
        formData.rentalPrices.forEach((price, index) => {
          payload.append(`rentalPrices[${index}].rentalUnit`, price.rentalUnit);
          payload.append(`rentalPrices[${index}].unitPrice`, String(price.unitPrice));
          payload.append(`rentalPrices[${index}].currency`, price.currency || "VND");
          payload.append(`rentalPrices[${index}].note`, price.note.trim() || "");
        });

        // Đính kèm các file ảnh
        selectedImages.forEach((img) => {
          payload.append("images", img);
        });

      } else {
        // TRƯỜNG HỢP 2: KHÔNG ẢNH -> GỬI JSON (Ép kiểu Number)
        payload = {
          code: normalizedCode,
          name: formData.name.trim(),
          seatCount: Number(formData.seatCount),
          numberOfDecks: Number(formData.numberOfDecks),
          seatSetupType: formData.seatSetupType,
          registrationNumber: formData.registrationNumber.trim() || "",
          maxSpeedKmh: Number(formData.maxSpeedKmh),
          yearBuilt: Number(formData.yearBuilt),
          description: formData.description.trim() || "",
          imageUrls: [], // Mặc định tạo mới không ảnh thì list rỗng
          rentalPrices: formData.rentalPrices.map((p) => ({
            rentalUnit: p.rentalUnit,
            unitPrice: Number(p.unitPrice),
            currency: p.currency || "VND",
            note: p.note.trim() || ""
          }))
        };
      }

      await addNewBoat(payload);

      alert(lang === "VN" ? "✓ Đăng ký phương tiện mới thành công!" : "✓ New boat registered successfully!");
      navigate("/admin/boats-management");
    } catch (error) {
      console.error("Lỗi khi tạo tàu:", error);
      const backendMsg = error.response?.data?.message;

      let validationMsg = "";
      if (error.response?.data?.errors) {
        const validationErrors = Object.values(error.response.data.errors).flat().join(" | ");
        validationMsg = `Lỗi Validation: ${validationErrors}`;
      }

      setErrorMsg(validationMsg || backendMsg || (lang === "VN" ? "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin." : "Registration failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-body max-w-4xl mx-auto pb-10">

      {/* HEADER CONTROLS */}
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button
          type="button" onClick={() => navigate("/admin/boats-management")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Đăng ký phương tiện mới" : "Register New Boat"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN" ? "Nhập thông tin, upload ảnh và cài đặt giá thuê tàu." : "Input details, upload pictures, and setup rental prices."}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100 dark:border-red-500/20">
          <span className="material-symbols-outlined">error</span>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmitForm} className="space-y-6">

        {/* KHỐI 1: THÔNG SỐ KỸ THUẬT & HÀNH CHÍNH */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
          <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b pb-2">
            {lang === "VN" ? "Thông số kỹ thuật & Hành chính" : "Technical & Administrative Specs"}
          </h3>
          {/* code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Mã hiệu (Code) (*)" : "Boat Code"}</label>
              <input
                type="text" required value={formData.code}
                onChange={(e) => handleInputChange("code", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner uppercase"
                placeholder="VD: WB_001"
              />
            </div>
            {/* name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Tên phương tiện (*)" : "Boat Name"}</label>
              <input
                type="text" required value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
                placeholder="VD: Waterbus 01"
              />
            </div>
            {/* registrationNumber */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Số Đăng kiểm (*)" : "Registration Number"}</label>
              <input
                type="text" required value={formData.registrationNumber}
                onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
                placeholder="VD: VN-001"
              />
            </div>
            {/* seatSetupType */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Kiểu setup sơ đồ ghế" : "Seat Setup Type"}</label>
              <select
                value={formData.seatSetupType}
                onChange={(e) => handleInputChange("seatSetupType", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              >
                <option value="FullStandard">{lang === "VN" ? "Toàn bộ ghế Thường (Full Standard)" : "Full Standard"}</option>
                <option value="StandardAndVip">{lang === "VN" ? "Có kết hợp ghế VIP (Standard & VIP)" : "Standard & VIP"}</option>
              </select>
            </div>
            {/* seatCount */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Sức chứa (Tổng số ghế) (*)" : "Total Seat Capacity"}</label>
              <input
                type="number" required min={1} max={500} value={formData.seatCount}
                onChange={(e) => handleInputChange("seatCount", Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>
            {/* numberOfDecks */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Số tầng (*)" : "Number of Decks"}</label>
              <input
                type="number" required min={1} max={3} value={formData.numberOfDecks}
                onChange={(e) => handleInputChange("numberOfDecks", Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>
            {/* maxSpeedKmh */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Tốc độ tối đa (km/h)" : "Max Speed (Kmh)"}</label>
              <input
                type="number" value={formData.maxSpeedKmh}
                onChange={(e) => handleInputChange("maxSpeedKmh", Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>
            {/* yearBuilt */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Năm đóng tàu" : "Year Built"}</label>
              <input
                type="number" value={formData.yearBuilt}
                onChange={(e) => handleInputChange("yearBuilt", Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>
          </div>
          {/* description */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Mô tả phương tiện" : "Boat Description"}</label>
            <textarea
              rows={3} value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner resize-none"
              placeholder={lang === "VN" ? "Nhập mô tả về tàu..." : "Enter boat details..."}
            />
          </div>
        </div>

        {/* KHỐI 2: UPLOAD NHIỀU ẢNH PHƯƠNG TIỆN */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
              {lang === "VN" ? "Thư viện ảnh phương tiện" : "Boat Image Gallery"}
            </h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg">
              {selectedImages.length} / 10
            </span>
          </div>

          <div className="space-y-4">
            {/* Grid hiển thị ảnh */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
              {imagePreviews.map((previewUrl, index) => (
                <div key={index} className="aspect-video relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group shadow-sm">
                  <img src={previewUrl} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button" onClick={() => handleRemoveImage(index)}
                      className="bg-rose-500 text-white p-2 rounded-full hover:bg-rose-600 hover:scale-110 transition-all shadow-md"
                      title={lang === "VN" ? "Xóa ảnh" : "Remove"}
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Nút Thêm ảnh */}
              {selectedImages.length < 10 && (
                <label className="aspect-video rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center cursor-pointer transition-all group shadow-inner">
                  <span className="material-symbols-outlined text-3xl text-slate-400 group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-colors mb-1">add_photo_alternate</span>
                  <span className="text-[10px] font-bold uppercase text-slate-400 group-hover:text-[#124757] dark:group-hover:text-yellow-400">
                    {lang === "VN" ? "Thêm ảnh" : "Add Images"}
                  </span>
                  <input type="file" multiple accept="image/jpeg, image/png, image/webp" onChange={handleImagesChange} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-[10px] font-medium text-slate-400 italic">
              * {lang === "VN" ? "Hỗ trợ định dạng JPEG, PNG, WebP. Tối đa 5MB mỗi ảnh." : "Supports JPEG, PNG, WebP. Max 5MB per image."}
            </p>
          </div>
        </div>

        {/* KHỐI 3: CẤU HÌNH GIÁ THUÊ TÀU (RENTAL PRICES) */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
              {lang === "VN" ? "Bảng giá cho thuê (Rental)" : "Rental Price Configurations"}
            </h3>
            <button
              type="button" onClick={handleAddRentalPrice}
              className="text-[10px] font-bold text-[#124757] dark:text-yellow-400 bg-[#124757]/10 dark:bg-yellow-400/10 px-3 py-1.5 rounded-lg hover:bg-[#124757]/20 dark:hover:bg-yellow-400/20 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              {lang === "VN" ? "Thêm mức giá" : "Add Price"}
            </button>
          </div>

          <div className="space-y-4">
            {formData.rentalPrices.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">request_quote</span>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {lang === "VN" ? "Tàu chưa được thiết lập giá thuê." : "No rental prices configured yet."}
                </p>
              </div>
            ) : (
              formData.rentalPrices.map((price, index) => (
                <div key={index} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm relative group">
                  <button
                    type="button" onClick={() => handleRemoveRentalPrice(index)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 transition-colors bg-white dark:bg-slate-800 rounded-full p-1 shadow-sm border border-slate-200 dark:border-slate-700"
                    title={lang === "VN" ? "Xóa" : "Remove"}
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pr-8">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Đơn vị (Unit)</label>
                      <select
                        value={price.rentalUnit} onChange={(e) => handleRentalPriceChange(index, "rentalUnit", e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400"
                      >
                        <option value="Hour">Theo Giờ (Hour)</option>
                        <option value="Day">Theo Ngày (Day)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Đơn giá (Price)</label>
                      <input
                        type="number" min={0} required value={price.unitPrice} onChange={(e) => handleRentalPriceChange(index, "unitPrice", Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 border rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Tiền tệ</label>
                      <input
                        type="text" value={price.currency} onChange={(e) => handleRentalPriceChange(index, "currency", e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Ghi chú (Note)</label>
                      <input
                        type="text" value={price.note} onChange={(e) => handleRentalPriceChange(index, "note", e.target.value)}
                        placeholder="VD: Không gồm VAT"
                        className="w-full bg-white dark:bg-slate-800 border rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400"
                      />
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
            className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] hover:shadow-2xl disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                {lang === "VN" ? "Tạo tàu" : "Registration"}
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}