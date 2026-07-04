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

  // STATE CẤU HÌNH ĐỒNG BỘ 100% CÁC FIELD
  const [formData, setFormData] = useState(null);
  const [seatMatrix, setSeatMatrix] = useState(null);
  const [activeDeck, setActiveDeck] = useState(1);
  
  // Quản lý ảnh
  const [selectedImages, setSelectedImages] = useState([]); 
  const [imagePreviews, setImagePreviews] = useState([]);   

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingLayout, setIsDeletingLayout] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // EFFECT: GỌI ĐỒNG THỜI SONG SONG CÁC API THẬT
  const loadBoatAndSeatsData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");

      // 1. Gọi API chi tiết tàu trước để kiểm tra sự tồn tại của ID
      const boatData = await fetchBoatDetail(id);
      
      // Khởi tạo form dữ liệu tương thích hoàn toàn cấu trúc mới
      setFormData({
        code: boatData.code || "",
        name: boatData.name || "",
        seatCount: boatData.seatCount || 0,
        numberOfDecks: boatData.numberOfDecks || 1,
        seatSetupType: boatData.seatSetupType || "FullStandard",
        registrationNumber: boatData.registrationNumber || "",
        maxSpeedKmh: boatData.maxSpeedKmh || 0,
        yearBuilt: boatData.yearBuilt || new Date().getFullYear(),
        description: boatData.description || "",
        rentalPrices: boatData.rentalPrices || []
      });

      // Load ảnh cũ từ server lên khu vực xem trước
      if (boatData.imageUrls && boatData.imageUrls.length > 0) {
        setImagePreviews(boatData.imageUrls);
      } else if (boatData.imageUrl) {
        setImagePreviews([boatData.imageUrl]);
      }

      // 2. Tiếp tục lấy sơ đồ ma trận ghế
      const seatsData = await fetchSeatLayout(id);
      setSeatMatrix(seatsData);
      
      // Tự động focus tầng đầu tiên nếu có dữ liệu sơ đồ
      if (seatsData?.decks?.length > 0) {
        setActiveDeck(seatsData.decks[0].deckNumber);
      }

    } catch (error) {
      console.error("Lỗi khi tải thông tin chi tiết tàu:", error);
      
      if (error.response?.status === 404) {
        Swal.fire({
          icon: "error",
          title: lang === "VN" ? "Không tìm thấy tàu!" : "Boat Not Found!",
          text: lang === "VN" 
            ? "Mã định danh phương tiện này không tồn tại trên hệ thống. Đang quay về danh sách." 
            : "The requested boat ID does not exist. Redirecting to management list...",
          confirmButtonColor: "#124757",
          allowOutsideClick: false
        }).then(() => {
          navigate("/admin/boats-management");
        });
      } else {
        setErrorMsg(
          lang === "VN" 
            ? "Không thể tải dữ liệu phương tiện hoặc sơ đồ ghế. Vui lòng kiểm tra kết nối mạng." 
            : "Failed to load boat records or seating chart matrix."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBoatAndSeatsData();
  }, [id]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // LOGIC ĐỘNG: QUẢN LÝ BẢNG GIÁ THUÊ
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

  // XỬ LÝ UPLOAD/PREVIEW THƯ VIỆN ẢNH
  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    
    if (selectedImages.length + imagePreviews.length + files.length > 10) {
      alert(lang === "VN" ? "Mỗi tàu chỉ được chứa tối đa 10 hình ảnh." : "Maximum 10 images allowed per boat.");
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024;
    const newValidFiles = [];
    const newPreviews = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!validTypes.includes(file.type)) {
        alert(lang === "VN" ? `File ${file.name} sai định dạng JPEG/PNG/WebP.` : `File ${file.name} must be JPEG, PNG, or WebP.`);
        continue;
      }
      if (file.size > maxSize) {
        alert(lang === "VN" ? `File ${file.name} quá nặng (>5MB).` : `File ${file.name} exceeds 5MB.`);
        continue;
      }
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

  // SUBMIT CẬP NHẬT 
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const normalizedCode = formData.code.trim().toUpperCase();
      let payload;

      if (selectedImages.length > 0) {
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

        formData.rentalPrices.forEach((price, index) => {
          payload.append(`rentalPrices[${index}].rentalUnit`, price.rentalUnit);
          payload.append(`rentalPrices[${index}].unitPrice`, String(price.unitPrice));
          payload.append(`rentalPrices[${index}].currency`, price.currency || "VND");
          payload.append(`rentalPrices[${index}].note`, price.note.trim() || "");
        });

        selectedImages.forEach((img) => payload.append("images", img));

        const legacyUrls = imagePreviews.filter(p => p.startsWith("http"));
        legacyUrls.forEach((url) => payload.append("imageUrls", url));
      } else {
        const legacyUrls = imagePreviews.filter(p => p.startsWith("http"));
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
          imageUrls: legacyUrls,
          rentalPrices: formData.rentalPrices.map((p) => ({
            rentalUnit: p.rentalUnit,
            unitPrice: Number(p.unitPrice),
            currency: p.currency || "VND",
            note: p.note.trim() || ""
          }))
        };
      }

      await modifyBoat(id, payload);
      
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Thành công!" : "Success!",
        text: lang === "VN" ? "Cập nhật thông tin phương tiện thành công!" : "Boat details modified successfully!",
        confirmButtonColor: "#124757"
      });

      loadBoatAndSeatsData();
    } catch (error) {
      console.error("Lỗi cập nhật tàu:", error);
      let validationMsg = "";
      if (error.response?.data?.errors) {
        validationMsg = Object.values(error.response.data.errors).flat().join(" | ");
      }
      setErrorMsg(validationMsg || error.response?.data?.message || (lang === "VN" ? "Cập nhật thất bại. Vui lòng kiểm tra lại thông tin form." : "Update failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // XÓA SƠ ĐỒ GHẾ
  const handleDeleteLayout = async () => {
    const result = await Swal.fire({
      title: lang === "VN" ? "Xác nhận xóa?" : "Are you sure?",
      text: lang === "VN" ? "Bạn có chắc chắn muốn xóa toàn bộ sơ đồ ghế này không?" : "Delete this seating chart matrix?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#124757",
      confirmButtonText: lang === "VN" ? "Xóa sơ đồ" : "Yes, delete it",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel"
    });

    // Nếu người dùng chọn Hủy, thoát khỏi hàm
    if (!result.isConfirmed) return;

    try {
      setIsDeletingLayout(true);
      await deleteSeats(id);
      
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã xóa!" : "Cleared!",
        text: lang === "VN" ? "Xóa sơ đồ ghế thành công!" : "Matrix layout cleared!",
        confirmButtonColor: "#124757"
      });

      loadBoatAndSeatsData();
    } catch (error) {
      console.error("Lỗi khi xóa ghế:", error);
      
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Lỗi!" : "Error!",
        text: lang === "VN" ? "Thao tác xóa thất bại." : "Clear layout failed.",
        confirmButtonColor: "#124757"
      });
    } finally {
      setIsDeletingLayout(false);
    }
  };

  // ĐỌC VÀ HIỂN THỊ MA TRẬN GHẾ
  const renderDynamicSeatLayout = () => {
    const currentDeckData = seatMatrix?.decks?.find(d => d.deckNumber === activeDeck);
    
    // Kiểm tra nếu tàu chưa có sơ đồ thì trả về giao diện vùng trống kèm nút chuyển trang Editor
    if (!seatMatrix || !seatMatrix.seatsConfigured || !currentDeckData || !currentDeckData.cells || currentDeckData.cells.length === 0) {
      return (
        <div className="text-center py-14 bg-white dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 flex flex-col items-center justify-center space-y-4 w-full">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-inner">
            <span className="material-symbols-outlined text-3xl text-slate-400">grid_off</span>
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
              {lang === "VN" ? "Chưa có sơ đồ cấu hình ghế" : "No Seat Layout Blueprint"}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-normal">
              {lang === "VN" 
                ? "Phương tiện này hiện đang trống ma trận lưới vị trí ghế. Hãy di chuyển tới công cụ Editor để vẽ sơ đồ." 
                : "This boat doesn't have an active layout matrix blueprint configured yet."}
            </p>
          </div>
          
          {/* NÚT CHUYỂN ĐẾN TRANG SEAT LAYOUT EDITOR NHƯ YÊU CẦU */}
          <button
            type="button"
            onClick={() => navigate(`/admin/boats-management/seats/${id}`)}
            className="px-5 py-2.5 bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 text-xs font-black font-headline uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            {lang === "VN" ? "Thiết lập sơ đồ ngay" : "Go to Layout Editor"}
          </button>
        </div>
      );
    }

    // NẾU ĐÃ CÓ DATA -> RENDER RA MA TRẬN CSS GRID
    return (
      <div className="bg-slate-100 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden w-full">
        {/* Bộ chuyển tầng */}
        {seatMatrix?.decks?.length > 1 && (
          <div className="flex gap-2 mb-4 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border w-fit shadow-sm">
            {seatMatrix.decks.map((deck) => (
              <button
                key={deck.deckNumber} type="button"
                onClick={() => setActiveDeck(deck.deckNumber)}
                className={`px-4 py-2 rounded-xl text-[10px] font-headline font-black uppercase transition-all tracking-wider ${
                  activeDeck === deck.deckNumber
                    ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 shadow-md"
                    : "bg-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {lang === "VN" ? `Tầng ${deck.deckNumber}` : `Deck ${deck.deckNumber}`}
              </button>
            ))}
          </div>
        )}

        {/* Mũi tàu hướng lái */}
        <div className="w-full bg-white dark:bg-slate-800 text-slate-400 border py-2 rounded-xl text-[9px] font-headline font-black text-center uppercase tracking-widest mb-4 shadow-sm">
          {lang === "VN" ? "Buồng lái - Phía mũi tàu" : "Boat Command Bridge - Bow Direction"}
        </div>

        <div className="overflow-x-auto pb-2 custom-scrollbar flex justify-center bg-white dark:bg-slate-800/40 rounded-xl border border-dashed">
          <div
            className="gap-1.5 inline-grid select-none p-4"
            style={{
              gridTemplateColumns: `repeat(${currentDeckData.columnCount}, 3rem)`,
              gridTemplateRows: `repeat(${currentDeckData.rowCount}, 3rem)`
            }}
          >
            {currentDeckData.cells.map(cell => {
              if (cell.type === "Hidden") return null;

              let bg = "bg-slate-100 text-slate-400 border-slate-300";
              let lbl = "";
              let icon = "";
              let seatCode = "";

              if (cell.type === "Seat") {
                const typeCode = cell.seat?.seatType?.seatTypeCode || cell.seatType?.seatTypeCode || "STD";
                seatCode = cell.seat?.seatCode || `${cell.row}-${cell.column}`;
                
                if (typeCode === "STANDARD") { bg = "bg-blue-100 text-blue-700 border-blue-300"; lbl = "STD"; icon = "chair"; }
                else if (typeCode === "CABIN") { bg = "bg-purple-100 text-purple-700 border-purple-300"; lbl = "CAB"; icon = "chair_alt"; }
                else if (typeCode === "RIVER") { bg = "bg-teal-100 text-teal-700 border-teal-300"; lbl = "RIV"; icon = "deck"; }
                else if (typeCode === "SKY") { bg = "bg-sky-100 text-sky-700 border-sky-300"; lbl = "SKY"; icon = "airline_seat_recline_extra"; }
                else { bg = "bg-slate-200 text-slate-700 border-slate-400"; lbl = typeCode; icon = "chair"; }
                
              } else if (cell.type === "Aisle") {
                bg = "bg-slate-100 text-slate-400 border-slate-300 border-dashed opacity-50"; lbl = "Lối đi"; icon = "straight";
              } else if (cell.type === "Empty") {
                bg = "bg-white text-slate-300 border-slate-200 border-dashed opacity-40"; lbl = ""; icon = "";
              } else if (cell.type === "Toilet") {
                bg = "bg-amber-100 text-amber-700 border-amber-400 shadow-inner"; lbl = "WC"; icon = "wc";
              }

              return (
                <div
                  key={`${cell.row}-${cell.column}`}
                  className={`border rounded-lg flex flex-col items-center justify-center text-[9px] font-black tracking-tighter overflow-hidden shadow-sm ${bg}`}
                  style={{
                    gridRow: `${cell.row} / span ${cell.rowSpan || 1}`,
                    gridColumn: `${cell.column} / span ${cell.columnSpan || 1}`
                  }}
                >
                  {icon && <span className="material-symbols-outlined text-[16px] leading-none mb-0.5 opacity-90">{icon}</span>}
                  {cell.type === "Seat" ? (
                    <>
                      <span className="leading-none opacity-90">{seatCode}</span>
                      <span className="text-[7px] font-medium opacity-60 mt-0.5 leading-none tracking-normal">{lbl}</span>
                    </>
                  ) : (
                    cell.type !== "Empty" && <span className="leading-none opacity-90">{lbl}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Đuôi tàu */}
        <div className="w-full bg-white dark:bg-slate-800 text-slate-400 border py-2 rounded-xl text-[9px] font-headline font-black text-center uppercase tracking-widest mt-4 shadow-sm">
          {lang === "VN" ? "Phía đuôi tàu (Động cơ)" : "Stern Direction"}
        </div>
      </div>
    );
  };

  if (isLoading || !formData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-body max-w-7xl mx-auto pb-10 px-4">
      
      {/* HEADER BAR */}
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button" onClick={() => navigate("/admin/boats-management")}
            className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner"
          >
            <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
          </button>
          <div>
            <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
              {lang === "VN" ? `Chỉnh sửa tàu: ${formData.name}` : `Modify Boat: ${formData.name}`}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === "VN" ? "Thay đổi hồ sơ kỹ thuật, bảng giá và quản lý cấu trúc ma trận ghế." : "Update parameters, price options and evaluate seating chart."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* PANEL TRÁI: FORM ĐIỀN THÔNG TIN TÀU CẬP NHẬT */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
          <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b pb-2">
            {lang === "VN" ? "Thông tin kỹ thuật phương tiện" : "Boat Specifications"}
          </h3>

          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100 dark:border-red-500/20">
              <span className="material-symbols-outlined text-sm">error</span>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Mã hiệu phương tiện (*)" : "Boat Code"}</label>
              <input
                type="text" required value={formData.code}
                onChange={(e) => handleInputChange("code", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Tên phương tiện (*)" : "Boat Name"}</label>
              <input
                type="text" required value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Số Đăng kiểm (*)" : "Registration Number"}</label>
              <input
                type="text" required value={formData.registrationNumber}
                onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Kiểu cấu hình ghế" : "Seat Setup Type"}</label>
              <select
                value={formData.seatSetupType}
                onChange={(e) => handleInputChange("seatSetupType", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              >
                <option value="FullStandard">Full Standard</option>
                <option value="StandardAndVip">Standard & VIP</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Tổng số ghế" : "Seat Count"}</label>
                <input
                  type="number" required min={1} value={formData.seatCount}
                  onChange={(e) => handleInputChange("seatCount", Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Số tầng tàu" : "Decks Count"}</label>
                <input
                  type="number" required min={1} max={3} value={formData.numberOfDecks}
                  onChange={(e) => handleInputChange("numberOfDecks", Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Vận tốc (km/h)" : "Max Speed"}</label>
                <input
                  type="number" value={formData.maxSpeedKmh}
                  onChange={(e) => handleInputChange("maxSpeedKmh", Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Năm sản xuất" : "Year Built"}</label>
                <input
                  type="number" value={formData.yearBuilt}
                  onChange={(e) => handleInputChange("yearBuilt", Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Ghi chú/Mô tả" : "Description"}</label>
              <textarea
                rows={2} value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-2 text-xs font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner resize-none"
              />
            </div>

            {/* THƯ VIỆN HÌNH ẢNH */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                <span>{lang === "VN" ? "Thư viện ảnh tàu" : "Image Gallery"}</span>
                <span>{imagePreviews.length} / 10</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {imagePreviews.map((previewUrl, index) => (
                  <div key={index} className="aspect-video relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <button type="button" onClick={() => handleRemoveImage(index)} className="bg-rose-500 text-white p-1 rounded-full hover:scale-105 transition-all">
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    </div>
                  </div>
                ))}
                {imagePreviews.length < 10 && (
                  <label className="aspect-video rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center cursor-pointer transition-all">
                    <span className="material-symbols-outlined text-lg text-slate-400">add_a_photo</span>
                    <input type="file" multiple accept="image/jpeg, image/png, image/webp" onChange={handleImagesChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            {/* BẢNG GIÁ THUÊ TÀU */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Cài đặt giá thuê tàu" : "Rental Prices"}</label>
                <button
                  type="button" onClick={handleAddRentalPrice}
                  className="text-[9px] font-bold text-[#124757] dark:text-yellow-400 bg-[#124757]/10 dark:bg-yellow-400/10 px-2 py-1 rounded-md hover:bg-[#124757]/20 transition-all"
                >
                  + {lang === "VN" ? "Thêm giá" : "Add Price"}
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {formData.rentalPrices.map((price, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 relative space-y-2 pt-6">
                    <button
                      type="button" onClick={() => handleRemoveRentalPrice(idx)}
                      className="absolute top-1.5 right-1.5 w-5 h-5 bg-white dark:bg-slate-800 border rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Loại hình</span>
                        <select
                          value={price.rentalUnit} onChange={(e) => handleRentalPriceChange(idx, "rentalUnit", e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-yellow-400"
                        >
                          <option value="Hour">Theo Giờ (Hour)</option>
                          <option value="Day">Theo Ngày (Day)</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Đơn giá</span>
                        <input
                          type="number" min={0} value={price.unitPrice} onChange={(e) => handleRentalPriceChange(idx, "unitPrice", Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-800 border rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-yellow-400"
                        />
                      </div>
                    </div>
                    <div>
                      <input
                        type="text" placeholder="Ghi chú dòng giá này..." value={price.note || ""} onChange={(e) => handleRentalPriceChange(idx, "note", e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border rounded-lg px-2 py-1 text-[10px] font-medium text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-yellow-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit" disabled={isSubmitting}
              className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-3.5 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
              {lang === "VN" ? "Lưu thông tin cập nhật" : "Save Specifications"}
            </button>
          </form>
        </div>

        {/* PANEL PHẢI: HIỂN THỊ MA TRẬN SƠ ĐỒ GHẾ THẬT */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
            <div>
              <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                {lang === "VN" ? "Ma trận sơ đồ ghế hiện hành" : "Seating Configuration Matrix"}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                {lang === "VN" ? "Xem phân bố kết cấu vị trí các hạng ghế trên phương tiện." : "Evaluate seat layout arrangement blueprint across current decks."}
                {seatMatrix?.seatsConfigured && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">verified</span>
                    Đã cấu hình ({seatMatrix.configuredSeats}/{seatMatrix.totalSeats})
                  </span>
                )}
              </p>
            </div>

            {/* Chỉ hiện nút xóa sơ đồ ghế nếu tàu đã có ma trận hoàn chỉnh */}
            {seatMatrix?.seatsConfigured && seatMatrix?.decks?.length > 0 && (
              <button
                type="button" disabled={isDeletingLayout} onClick={handleDeleteLayout}
                className="px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-100 dark:border-red-500/20 hover:bg-red-100 transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0 self-start sm:self-center"
              >
                {isDeletingLayout ? (
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span className="material-symbols-outlined text-base">delete</span>
                )}
                {lang === "VN" ? "Xóa sơ đồ ghế" : "Reset Matrix Layout"}
              </button>
            )}
          </div>

          {/* Vùng Render linh động: Nếu có rồi thì show Grid, chưa có show Nút đi vẽ */}
          <div className="overflow-hidden flex justify-center w-full">
            {renderDynamicSeatLayout()}
          </div>
        </div>

      </div>
    </div>
  );
}