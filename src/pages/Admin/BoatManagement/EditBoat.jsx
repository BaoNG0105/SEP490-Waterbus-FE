import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchBoatDetail, modifyBoat } from "../../../services/boatService";
import { fetchSeatLayout, deleteSeats } from "../../../services/seatService";
import Swal from "sweetalert2";

export function EditBoat() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState(null);
  const [seatMatrix, setSeatMatrix] = useState(null);
  const [activeDeck, setActiveDeck] = useState(1);
  
  const [selectedImages, setSelectedImages] = useState([]); 
  const [imagePreviews, setImagePreviews] = useState([]);   

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingLayout, setIsDeletingLayout] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadBoatAndSeatsData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");

      const boatDetail = await fetchBoatDetail(id);
      
      setFormData({
        code: boatDetail.code || boatDetail.boatCode || "",
        name: boatDetail.name || boatDetail.boatName || "",
        seatCount: Number(boatDetail.seatCount) || 0,
        numberOfDecks: Number(boatDetail.numberOfDecks) || 1,
        seatSetupType: boatDetail.seatSetupType || "FullStandard",
        registrationNumber: boatDetail.registrationNumber || "",
        maxSpeedKmh: Number(boatDetail.maxSpeedKmh) || 0,
        yearBuilt: Number(boatDetail.yearBuilt) || new Date().getFullYear(),
        description: boatDetail.description || "",
        status: boatDetail.status || "Active",
        rentalPrices: boatDetail.rentalPrices || []
      });

      let legacyImages = [];
      if (boatDetail.imageUrls && boatDetail.imageUrls.length > 0) {
        legacyImages = boatDetail.imageUrls;
      } else if (boatDetail.imageUrl) {
        legacyImages = [boatDetail.imageUrl];
      }
      setImagePreviews(legacyImages.slice(0, 6));

      if (boatDetail.seatsConfigured) {
        const layoutData = await fetchSeatLayout(id);
        setSeatMatrix(layoutData);
        if (layoutData?.decks?.length > 0) {
          setActiveDeck(layoutData.decks[0].deckNumber);
        }
      } else {
        setSeatMatrix(null);
      }

    } catch (error) {
      console.error("Lỗi tải thông tin phương tiện tàu thủy:", error);
      if (error.response?.status === 404) {
        Swal.fire({
          icon: "error",
          title: lang === "VN" ? "Không tìm thấy tàu!" : "Boat Not Found!",
          text: lang === "VN" ? "Mã định danh phương tiện không tồn tại." : "Requested boat records do not exist.",
          confirmButtonColor: "#124757",
        }).then(() => navigate("/admin/boats-management"));
      } else {
        setErrorMsg(lang === "VN" ? "Lỗi đồng bộ hóa dữ liệu từ hệ thống máy chủ." : "Network handshake failure.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBoatAndSeatsData();
  }, [id, lang]);

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // LOGIC XỬ LÝ RENTAL PRICES
  const handlePriceChange = (index, field, value) => {
    const updatedPrices = [...formData.rentalPrices];
    updatedPrices[index][field] = field === "unitPrice" ? Number(value) : value;
    setFormData(prev => ({ ...prev, rentalPrices: updatedPrices }));
  };

  const handleAddPrice = () => {
    setFormData(prev => ({
      ...prev,
      rentalPrices: [...prev.rentalPrices, { rentalUnit: "Day", unitPrice: 0, currency: "VND", note: "" }]
    }));
  };

  const handleRemovePrice = (index) => {
    setFormData(prev => ({
      ...prev,
      rentalPrices: prev.rentalPrices.filter((_, i) => i !== index)
    }));
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    if (selectedImages.length + imagePreviews.length + files.length > 6) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Quá số lượng" : "Limit Exceeded",
        text: lang === "VN" ? "Hệ thống chỉ cho phép lưu trữ tối đa 6 hình ảnh." : "Maximum 6 images allowed per vessel.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024;
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

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const legacyUrls = imagePreviews.filter((p) => p.startsWith("http"));

      // Chỉ đóng gói các trường cho phép gửi/cập nhật
      const commonFields = {
        name: formData.name.trim(),
        numberOfDecks: Number(formData.numberOfDecks),
        seatCount: Number(formData.seatCount),
        seatSetupType: formData.seatSetupType,
        maxSpeedKmh: Number(formData.maxSpeedKmh),
        description: formData.description?.trim() || null,
        status: formData.status
      };

      let payload;

      if (selectedImages.length > 0 || legacyUrls.length !== imagePreviews.length) {
        payload = new FormData();
        Object.entries(commonFields).forEach(([key, value]) => {
          if (value !== null) payload.append(key, String(value));
        });

        selectedImages.forEach((file) => payload.append("images", file));
        
        if (legacyUrls.length > 0) {
          legacyUrls.forEach((url) => payload.append("imageUrls", url));
          payload.append("imageUrl", legacyUrls[0]); 
        }

        // Định dạng rentalPrices array lồng vào FormData
        if (formData.rentalPrices && formData.rentalPrices.length > 0) {
          formData.rentalPrices.forEach((price, idx) => {
            payload.append(`rentalPrices[${idx}].rentalUnit`, price.rentalUnit);
            payload.append(`rentalPrices[${idx}].unitPrice`, String(price.unitPrice));
            payload.append(`rentalPrices[${idx}].currency`, price.currency || "VND");
            if (price.note) payload.append(`rentalPrices[${idx}].note`, price.note);
          });
        }
      } else {
        payload = {
          ...commonFields,
          imageUrl: legacyUrls[0] || null,
          imageUrls: legacyUrls,
          rentalPrices: formData.rentalPrices
        };
      }

      await modifyBoat(id, payload);

      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Cập nhật thành công!" : "Successfully Saved!",
        text: lang === "VN" ? "Thông số hồ sơ phương tiện đã được lưu trữ an toàn." : "Vessel blueprint updated successfully.",
        confirmButtonColor: "#124757",
      }).then(() => navigate("/admin/boats-management"));

    } catch (error) {
      console.error("Lỗi cập nhật tàu:", error);
      let validationError = "";
      if (error.response?.data?.errors) {
        validationError = Object.values(error.response.data.errors).flat().join(" | ");
      }
      setErrorMsg(validationError || error.response?.data?.message || (lang === "VN" ? "Cập nhật thông tin thất bại." : "Failed to apply updates."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLayout = async () => {
    const confirmResult = await Swal.fire({
      title: lang === "VN" ? "Xóa cấu hình ghế?" : "Reset Layout Matrix?",
      text: lang === "VN" ? "Hành động này sẽ xóa sạch toàn bộ sơ đồ ghế hiện tại, sau đó bạn có thể sửa Số ghế và Số tầng!" : "This will wipe all existing seat configurations.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#124757",
      confirmButtonText: lang === "VN" ? "Xác nhận xóa" : "Wipe Matrix",
      cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
    });

    if (!confirmResult.isConfirmed) return;

    try {
      setIsDeletingLayout(true);
      await deleteSeats(id);
      
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã gỡ bỏ!" : "Wiped out!",
        text: lang === "VN" ? "Sơ đồ lưới ghế đã bị xóa sạch thành công. Bạn đã có thể chỉnh sửa lại Sức chứa tàu." : "Matrix database flushed.",
        confirmButtonColor: "#124757",
      });

      loadBoatAndSeatsData();
    } catch (error) {
      console.error(error);
      Swal.fire("Thất bại", lang === "VN" ? "Không thể xóa sơ đồ lưới ghế." : "Failed to reset structure.", "error");
    } finally {
      setIsDeletingLayout(false);
    }
  };

  const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
  const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
  const disabledStyle = "opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-900/40"; // Class chung cho input bị khóa

  if (isLoading || !formData) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="w-10 h-10 border-4 border-[#124757] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // CỜ KIỂM TRA ĐIỀU KIỆN KHÓA: Nếu sơ đồ ghế đã setup -> Khóa Số ghế, Tầng, Loại ghế
  const isSeatConfigured = seatMatrix?.seatsConfigured === true;

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">
      
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button type="button" onClick={() => navigate("/admin/boats-management")} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white transition-all flex items-center justify-center shadow-inner shrink-0">
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? `Hồ sơ kỹ thuật: ${formData.code}` : `Vessel File: ${formData.code}`}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN" ? "Thay đổi thông số cơ bản, cập nhật bộ sưu tập ảnh đại diện và theo dõi sơ đồ phân bổ ghế." : "Modify hardware blueprints, attach media collections and monitor seating grids."}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        
        {/* PANEL TRÁI: FORM ĐIỀN THÔNG TIN */}
        <form onSubmit={handleFormSubmit} className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
          <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
            ⚙️ {lang === "VN" ? "Thông tin kỹ thuật phương tiện" : "Vessel Specifications"}
          </h3>

          <div>
            <label className={labelStyle}>{lang === "VN" ? "Tên phương tiện tàu thủy (*)" : "Vessel Label Name (*)"}</label>
            <input type="text" required value={formData.name} onChange={(e) => handleFieldChange("name", e.target.value)} className={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Mã biển số đăng ký" : "Registration Number"}</label>
              <input type="text" disabled value={formData.registrationNumber || ""} className={`${inputStyle} ${disabledStyle}`} title="Chỉ đọc" />
            </div>
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Năm đóng tàu" : "Year Built"}</label>
              <input type="number" disabled value={formData.yearBuilt || ""} className={`${inputStyle} ${disabledStyle}`} title="Chỉ đọc" />
            </div>
          </div>

          {/* NHÓM CÁC TRƯỜNG BỊ KHÓA KHI ĐÃ CÓ SƠ ĐỒ GHẾ */}
          <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-700/30 rounded-2xl space-y-3 mt-2">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">info</span>
              {isSeatConfigured 
                  ? (lang === "VN" ? "Xóa sơ đồ ghế bên phải để thay đổi các thông số cấu trúc dưới đây." : "Delete active matrix to modify seating parameters.")
                  : (lang === "VN" ? "Có thể tùy chỉnh thông số ghế trước khi sinh ma trận lưới." : "Seat grid parameters are editable.")
              }
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Sức chứa" : "Capacity"}</label>
                <input type="number" min={1} required disabled={isSeatConfigured} value={formData.seatCount} onChange={(e) => handleFieldChange("seatCount", e.target.value)} className={`${inputStyle} ${isSeatConfigured ? disabledStyle : ""}`} />
              </div>
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Số tầng" : "Decks"}</label>
                <input type="number" min={1} max={2} required disabled={isSeatConfigured} value={formData.numberOfDecks} onChange={(e) => handleFieldChange("numberOfDecks", e.target.value)} className={`${inputStyle} ${isSeatConfigured ? disabledStyle : ""}`} />
              </div>
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Cấu hình ghế" : "Seat Setup"}</label>
                <select disabled={isSeatConfigured} value={formData.seatSetupType} onChange={(e) => handleFieldChange("seatSetupType", e.target.value)} className={`${inputStyle} px-2 ${isSeatConfigured ? disabledStyle : "font-bold text-[#124757]"}`}>
                  <option value="FullStandard">Full Standard</option>
                  <option value="StandardAndVip">Standard & VIP</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Vận tốc (Kmh)" : "Max Speed"}</label>
              <input type="number" min={0} required value={formData.maxSpeedKmh} onChange={(e) => handleFieldChange("maxSpeedKmh", e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Trạng thái vận hành" : "Status"}</label>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleFieldChange("status", formData.status === "Active" ? "Inactive" : "Active")}
                  className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 border-2 border-transparent focus:outline-none ${
                    formData.status === "Active" ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-300 ${formData.status === "Active" ? "translate-x-6" : "translate-x-0"}`} />
                </button>
                <span className={`text-[11px] font-black uppercase ${formData.status === "Active" ? "text-emerald-600" : "text-slate-400"}`}>
                  {formData.status}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className={labelStyle}>{lang === "VN" ? "Mô tả ghi chú kỹ thuật" : "Engineering Logs / Notes"}</label>
            <textarea rows={2} value={formData.description} onChange={(e) => handleFieldChange("description", e.target.value)} className={`${inputStyle} resize-none font-medium`} />
          </div>

          {/* KHỐI BẢNG GIÁ THUÊ TÀU (RENTAL PRICES) */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
             <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              <span>{lang === "VN" ? "Bảng giá cho thuê Charter (VND)" : "Rental Tariffs"}</span>
            </div>
            {formData.rentalPrices.map((price, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-700">
                <select value={price.rentalUnit} onChange={(e) => handlePriceChange(idx, "rentalUnit", e.target.value)} className="w-full sm:w-1/3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-[11px] font-bold outline-none">
                  <option value="Day">Theo Ngày (Day)</option>
                  <option value="Hour">Theo Giờ (Hour)</option>
                  <option value="Trip">Theo Chuyến (Trip)</option>
                </select>
                <input type="number" min={0} value={price.unitPrice} onChange={(e) => handlePriceChange(idx, "unitPrice", e.target.value)} placeholder="Giá tiền" className="w-full sm:flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-[11px] font-bold outline-none" />
                <button type="button" onClick={() => handleRemovePrice(idx)} className="w-full sm:w-auto px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                  <span className="material-symbols-outlined text-[16px] block">delete</span>
                </button>
              </div>
            ))}
            <button type="button" onClick={handleAddPrice} className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex justify-center items-center gap-1 border border-dashed border-slate-300 dark:border-slate-600">
               <span className="material-symbols-outlined text-[14px]">add</span> {lang === "VN" ? "Thêm gói giá thuê" : "Add Tariff"}
            </button>
          </div>

          {/* KHỐI ALBUM THƯ VIỆN HÌNH ẢNH */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              <span>{lang === "VN" ? "Thư viện ảnh phương tiện" : "Vessel Image Hub"}</span>
              <span className={imagePreviews.length === 6 ? "text-rose-500" : ""}>{imagePreviews.length} / 6</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {imagePreviews.map((previewUrl, index) => (
                <div key={index} className="aspect-[4/3] relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <button type="button" onClick={() => handleRemoveImage(index)} className="bg-rose-500 text-white p-1.5 rounded-full hover:scale-105 transition-all">
                      <span className="material-symbols-outlined text-xs">delete</span>
                    </button>
                  </div>
                </div>
              ))}
              {imagePreviews.length < 6 && (
                <label className="aspect-[4/3] rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center cursor-pointer transition-all">
                  <span className="material-symbols-outlined text-lg text-slate-400">add_photo_alternate</span>
                  <input type="file" multiple accept="image/jpeg, image/png, image/webp" onChange={handleImagesChange} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 hover:brightness-110 disabled:opacity-50 py-3.5 rounded-xl text-xs font-headline font-black uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 mt-4">
            {isSubmitting && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
            {lang === "VN" ? "Lưu thông số phương tiện" : "Save Specifications"}
          </button>
        </form>

        {/* PANEL BÊN PHẢI (CHIẾM 3/5): SƠ ĐỒ LƯỚI GHẾ KHÔNG THAY ĐỔI */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5 flex flex-col">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 gap-3">
            <div>
              <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                💺 {lang === "VN" ? "Bản xem trước ma trận sơ đồ ghế" : "Cabin Seating Grid Preview"}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                {isSeatConfigured ? (
                  <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 font-bold">
                    <span className="material-symbols-outlined text-[12px]">verified</span>
                    {lang === "VN" ? "Đã cấu hình sơ đồ lưới" : "Active Matrix Layout"}
                  </span>
                ) : (
                  <span className="text-amber-500 inline-flex items-center gap-1 font-bold">
                    <span className="material-symbols-outlined text-[12px]">error</span>
                    {lang === "VN" ? "Chưa khởi tạo cấu hình ghế" : "Pending Setup"}
                  </span>
                )}
              </p>
            </div>

            {isSeatConfigured && seatMatrix?.decks?.length > 0 && (
              <button
                type="button" disabled={isDeletingLayout} onClick={handleDeleteLayout}
                className="px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-100 dark:border-red-500/20 hover:bg-red-100 transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0"
              >
                {isDeletingLayout ? (
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span className="material-symbols-outlined text-base">delete</span>
                )}
                {lang === "VN" ? "Xóa sơ đồ ghế" : "Reset Grid Layout"}
              </button>
            )}
          </div>

          <div className="overflow-x-auto bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center">
            {isSeatConfigured && seatMatrix?.decks?.length > 0 ? (
              <div className="w-full space-y-6">
                
                <div className="flex gap-2 justify-center mb-4">
                  {seatMatrix.decks.map((d) => (
                    <button
                      key={d.deckNumber} type="button" onClick={() => setActiveDeck(d.deckNumber)}
                      className={`px-5 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        activeDeck === d.deckNumber 
                          ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 shadow-md" 
                          : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {lang === "VN" ? `Tầng ${d.deckNumber}` : `Deck ${d.deckNumber}`}
                    </button>
                  ))}
                </div>

                {seatMatrix.decks.filter(d => d.deckNumber === activeDeck).map(deck => {
                  const defaultSeatCode = formData?.seatSetupType === "StandardAndVip" ? "CABIN" : "STANDARD";
                  
                  // Tạo ma trận ảo
                  const grid = Array.from({ length: deck.rowCount }, (_, r) => 
                    Array.from({ length: deck.columnCount }, (_, c) => ({
                      row: r,
                      column: c,
                      type: "Seat",
                      seatTypeCode: defaultSeatCode
                    }))
                  );

                  // Đắp đè cells override
                  if (deck.cells && deck.cells.length > 0) {
                    deck.cells.forEach(overrideCell => {
                      if (
                        overrideCell.row >= 0 && overrideCell.row < deck.rowCount &&
                        overrideCell.column >= 0 && overrideCell.column < deck.columnCount
                      ) {
                        grid[overrideCell.row][overrideCell.column] = overrideCell;
                      }
                    });
                  }

                  return (
                    <div key={deck.deckNumber} className="flex flex-col items-center min-w-max mx-auto">
                      <div className="w-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 py-2.5 rounded-t-2xl text-[10px] font-headline font-black text-center uppercase tracking-[0.2em] mb-4 shadow-sm">
                        {lang === "VN" ? "Hướng Mũi Tàu" : "Bow / Front"}
                      </div>
                      
                      <div 
                        className="grid gap-1.5 md:gap-2 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm"
                        style={{
                          gridTemplateColumns: `repeat(${deck.columnCount}, minmax(36px, 44px))`,
                          gridTemplateRows: `repeat(${deck.rowCount}, minmax(36px, 44px))`
                        }}
                      >
                        {grid.flat().map((cell, idx) => {
                          let bgColor = "bg-white border-dashed border-slate-200 dark:border-slate-700";
                          let icon = "";

                          if (cell.type === "Aisle") {
                            bgColor = "bg-slate-100 border-slate-200 dark:bg-slate-700/50 dark:border-slate-600";
                          } else if (cell.type === "Seat") {
                            if (cell.seatTypeCode === "STANDARD") { bgColor = "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10"; icon = "chair"; }
                            else if (cell.seatTypeCode === "CABIN") { bgColor = "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/10"; icon = "chair_alt"; }
                            else if (cell.seatTypeCode === "RIVER") { bgColor = "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-500/10"; icon = "deck"; }
                            else if (cell.seatTypeCode === "SKY") { bgColor = "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10"; icon = "airline_seat_recline_extra"; }
                          }

                          return (
                            <div key={idx} className={`flex flex-col items-center justify-center rounded-lg border text-[9px] font-bold select-none transition-all ${bgColor}`}>
                              {icon && <span className="material-symbols-outlined text-[16px] leading-none mb-0.5">{icon}</span>}
                              {cell.type === "Seat" && <span className="opacity-50 text-[7px] tracking-tighter">{cell.row}-{cell.column}</span>}
                            </div>
                          );
                        })}
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 py-2.5 rounded-b-2xl text-[10px] font-headline font-black text-center uppercase tracking-[0.2em] mt-4 shadow-sm">
                        {lang === "VN" ? "Hướng Đuôi Tàu" : "Stern / Aft"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <span className="material-symbols-outlined text-3xl text-slate-400">grid_off</span>
                </div>
                <h4 className="text-sm font-headline font-black text-slate-600 dark:text-slate-300 uppercase mb-2">
                  {lang === "VN" ? "Chưa cấu hình sơ đồ ghế" : "No Layout Active"}
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mb-6">
                  {lang === "VN" ? "Chiếc tàu này hiện chưa được khởi tạo sơ đồ lưới ghế. Hãy tiến hành thiết kế để đưa tàu vào vận hành." : "This vessel has no configured seating layout. A matrix must be generated."}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/boats-management/seats/${id}`)}
                  className="bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black text-[11px] uppercase tracking-wider py-3 px-6 rounded-xl shadow-md hover:scale-105 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">design_services</span>
                  {lang === "VN" ? "Mở công cụ thiết kế" : "Open Editor"}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}