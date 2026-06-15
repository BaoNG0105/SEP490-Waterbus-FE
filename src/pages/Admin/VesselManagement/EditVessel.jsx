import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchVesselDetail, modifyVessel } from "../../../services/vesselService";
import { fetchSeatLayout, deleteSeats } from "../../../services/seatService";

export function EditVessel() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();

  // STATE QUẢN LÝ DỮ LIỆU & UI
  const [formData, setFormData] = useState(null);
  const [seatMatrix, setSeatMatrix] = useState(null);
  const [activeDeck, setActiveDeck] = useState(1);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingLayout, setIsDeletingLayout] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ==========================================
  // EFFECT: GỌI ĐỒNG THỜI SONG SỐNG 2 API THẬT
  // ==========================================
  const loadVesselAndSeatsData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");

      const [vesselData, seatsData] = await Promise.all([
        fetchVesselDetail(id),
        fetchSeatLayout(id).catch(() => null)
      ]);

      setFormData(vesselData);
      setSeatMatrix(seatsData);

      if (seatsData?.decks && seatsData.decks.length > 0) {
        setActiveDeck(seatsData.decks[0].deckNumber);
      }

    } catch (error) {
      console.error("Lỗi khi tải dữ liệu trang chỉnh sửa tàu:", error);
      setErrorMsg(lang === "VN" ? "Không thể lấy thông tin phương tiện công nghệ này." : "Failed to retrieve vessel data model specifications.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadVesselAndSeatsData();
    }
  }, [id, lang]);

  // Thay đổi input của Form chỉnh sửa thông tin tàu
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // XỬ LÝ CHỌN VÀ VALIDATE MỚI KHI THAY ĐỔI ẢNH (<= 5MB, JPEG/PNG/WEBP)
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert(lang === "VN" ? "Chỉ hỗ trợ định dạng ảnh JPEG, PNG hoặc WebP." : "Only JPEG, PNG, or WebP images are supported.");
        e.target.value = null;
        return;
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(lang === "VN" ? "Dung lượng ảnh tối đa không được vượt quá 5MB." : "Maximum image size must not exceed 5MB.");
        e.target.value = null;
        return;
      }

      setSelectedImage(file);
      const fakeUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, imageUrl: fakeUrl }));
    }
  };

  // HÀM XỬ LÝ LỆNH XÓA TOÀN BỘ SƠ ĐỒ GHẾ TÀU
  const handleDeleteVesselLayout = async () => {
    const message = lang === "VN"
      ? "CẢNH BÁO: Bạn chắc chắn muốn XÓA SẠCH toàn bộ sơ đồ ghế và cấu hình ma trận của tàu này? Hành động này không thể hoàn tác!"
      : "WARNING: Are you completely sure you want to WIPE OUT the seating architecture configuration map? This cannot be undone!";

    if (!window.confirm(message)) return;

    try {
      setIsDeletingLayout(true);
      setErrorMsg("");

      await deleteSeats(id);
      setSeatMatrix(null);

      if (formData) {
        setFormData(prev => ({ ...prev, seatsConfigured: false }));
      }

      alert(lang === "VN" ? "Đã xóa sạch sơ đồ ghế phương tiện!" : "Vessel map architecture wiped successfully!");
    } catch (error) {
      console.error("Lỗi khi xóa sơ đồ tàu:", error);
      const backendMsg = error.response?.data?.message;
      setErrorMsg(backendMsg || (lang === "VN" ? "Không thể xóa sơ đồ ghế. Vui lòng kiểm tra lại trạng thái." : "Failed to wipe layout configuration model."));
    } finally {
      setIsDeletingLayout(false);
    }
  };

  // ==========================================
  // HÀM SUBMIT: PHÂN CHIA JSON / MULTIPART
  // ==========================================
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const normalizedCode = formData.code.trim().toUpperCase();
      let payload;

      if (selectedImage) {
        // TRƯỜNG HỢP CÓ ĐỔI ẢNH MỚI -> DÙNG MULTIPART/FORM-DATA VỚI FIELD 'image'
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
        payload.append("image", selectedImage); // Đổi tên trường khớp notes BE
      } else {
        // TRƯỜNG HỢP GIỮ NGUYÊN ẢNH CŨ -> GỬI ĐỐI TƯỢNG APPLICATION/JSON SẠCH
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
          description: formData.description.trim(),
          imageUrl: formData.imageUrl || "" // Gửi lại url hiện tại
        };
      }

      console.log("Cập nhật hạm đội với dữ liệu:", payload);
      await modifyVessel(id, payload);

      alert(lang === "VN" ? "Cập nhật thông số kỹ thuật tàu thành công!" : "Vessel registry parameters updated successfully!");
      navigate("/admin/vessels-management");
    } catch (error) {
      console.error("Lỗi khi cập nhật thông tin tàu:", error);
      const backendMsg = error.response?.data?.message;
      let validationMsg = "";
      if (error.response?.data?.errors) {
        const validationErrors = Object.values(error.response.data.errors).flat().join(" | ");
        validationMsg = `Lỗi hệ thống: ${validationErrors}`;
      }
      setErrorMsg(validationMsg || backendMsg || (lang === "VN" ? "Cập nhật thất bại. Vui lòng kiểm tra số đăng kiểm hoặc dữ liệu đầu vào." : "Update failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Thuật toán dựng lưới sơ đồ trực quan
  const renderDynamicSeatLayout = () => {
    const currentDeckInfo = seatMatrix?.decks?.find(d => d.deckNumber === activeDeck);

    if (!currentDeckInfo || !seatMatrix?.decks || seatMatrix.decks.length === 0) {
      return (
        <div className="text-center py-12 px-4 border border-dashed rounded-3xl border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10 space-y-4">
          <span className="material-symbols-outlined text-4xl text-slate-300 animate-pulse">grid_off</span>
          <p className="text-xs font-bold text-slate-400 max-w-xs mx-auto leading-relaxed">
            {lang === "VN" ? "Tàu hiện chưa được thiết lập cấu hình sơ đồ ghế hoặc sơ đồ vừa bị xóa sạch." : "Vessel has no seating core layout architecture configuration deployed."}
          </p>
          <button
            type="button"
            onClick={() => navigate(`/admin/vessels-management/seats/${id}`)}
            className="bg-yellow-400 text-[#124757] font-headline font-black uppercase text-[10px] tracking-wider px-4 py-2 rounded-xl shadow-sm hover:scale-[1.02] transition-transform"
          >
            ➕ {lang === "VN" ? "Đi tới Trang Tạo Sơ Đồ" : "Go Deployed Layout"}
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3 px-2 min-w-125">
        {currentDeckInfo.rows.map((rowObj) => {
          return (
            <div key={`row-${rowObj.row}`} className="flex items-center gap-3">
              <div className="w-6 h-10 rounded-lg bg-slate-100 dark:bg-slate-900/60 font-headline font-black text-slate-400 text-xs flex items-center justify-center select-none shadow-inner border border-slate-200/40">
                {rowObj.row}
              </div>
              <div
                className="grid gap-2 grow"
                style={{ gridTemplateColumns: `repeat(${currentDeckInfo.columnCount}, minmax(0, 1fr))` }}
              >
                {rowObj.seats.map((seat) => {
                  const isVip = seat.seatType?.seatTypeCode === "VIP";
                  return (
                    <div
                      key={seat.seatId}
                      className={`h-10 rounded-xl font-headline font-black text-[10px] tracking-tighter flex flex-col items-center justify-center border shadow-sm transition-all select-none relative ${isVip
                          ? "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-500/20 dark:border-amber-500/40"
                          : "bg-white border-slate-200 text-[#124757] dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        }`}
                    >
                      <span className="material-symbols-outlined text-[13px] opacity-75 mb-0.5">
                        {isVip ? "workspace_premium" : "chair"}
                      </span>
                      <span>{seat.seatCode.split("-")[1]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="py-32 text-center text-slate-400 font-medium">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-xs tracking-widest animate-pulse uppercase">{lang === "VN" ? "Đang kết nối kho dữ liệu hạm đội..." : "Streaming real-time fleet metadata blueprints..."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-body max-w-7xl mx-auto">

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
            {lang === "VN" ? "Chỉnh sửa thông số phương tiện" : "Modify Fleet Vessel Technical Specs"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN" ? "Cập nhật thông tin hành chính, đăng kiểm và xem kết cấu sơ đồ hạ tầng ghế hiện tại." : "Modify hardware attributes registry details and preview live active core seating blueprints layout."}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100 dark:border-red-500/20">
          <span className="material-symbols-outlined">error</span>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmitForm} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* PANEL TRÁI: FORM ĐIỀN THÔNG TIN TÀU CẬP NHẬT (7/12) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
          <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b pb-2 mb-2">
            {lang === "VN" ? "Thông tin hành chính phương tiện" : "Administrative Blueprint Metadata"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Mã hiệu (Code) (*)" : "Vessel Code Identifier"}</label>
              <input
                type="text" required value={formData?.code || ""}
                onChange={(e) => handleInputChange("code", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Tên phương tiện (*)" : "Vessel Label Name"}</label>
              <input
                type="text" required value={formData?.name || ""}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Số Đăng kiểm (*)" : "Registration Number"}</label>
              <input
                type="text" required value={formData?.registrationNumber || ""}
                onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Kiểu sơ đồ ghế" : "Seat Setup Type"}</label>
              <select
                value={formData?.seatSetupType || "FullStandard"}
                onChange={(e) => handleInputChange("seatSetupType", e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              >
                <option value="FullStandard">{lang === "VN" ? "Toàn bộ ghế Thường (FullStandard)" : "Full Standard Seating"}</option>
                <option value="StandardAndVip">{lang === "VN" ? "Có kết hợp ghế VIP (StandardAndVip)" : "Standard & VIP Seating"}</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Sức chứa (Tổng số ghế) (*)" : "Total Seat Capacity"}</label>
              <input
                type="number" required min={1} max={500} value={formData?.seatCount || 0}
                onChange={(e) => handleInputChange("seatCount", Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Tối đa hành khách (*)" : "Passenger Capacity"}</label>
              <input
                type="number" required min={1} max={500} value={formData?.passengerCapacity || 0}
                onChange={(e) => handleInputChange("passengerCapacity", Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Số tầng" : "Number of Decks"}</label>
              <input
                type="number" required min={1} max={3} value={formData?.numberOfDecks || 0}
                onChange={(e) => handleInputChange("numberOfDecks", Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Tốc độ tối đa (km/h)" : "Cruising Max Speed"}</label>
              <input
                type="number" value={formData?.maxSpeedKmh || 0}
                onChange={(e) => handleInputChange("maxSpeedKmh", Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Năm đóng tàu" : "Year Built"}</label>
              <input
                type="number" value={formData?.yearBuilt || 0}
                onChange={(e) => handleInputChange("yearBuilt", Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Mô tả chi tiết kỹ thuật" : "Technical Fleet Summary Description"}</label>
            <textarea
              rows={3} value={formData?.description || ""}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 text-xs font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 shadow-inner resize-none"
            />
          </div>

          {/* KHU VỰC UPLOAD VÀ PREVIEW HÌNH ẢNH */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">{lang === "VN" ? "Hình ảnh phương tiện" : "Vessel Digital Photography Profile"}</label>
            <div className="flex flex-wrap items-center gap-6">
              <div className="w-32 h-20 rounded-2xl border bg-slate-50 dark:bg-slate-900 overflow-hidden flex items-center justify-center relative group shadow-inner">
                {formData?.imageUrl ? (
                  <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-slate-300 text-3xl">directions_boat</span>
                )}
              </div>
              <label className="bg-slate-100 hover:bg-[#124757] hover:text-white dark:bg-slate-900 border px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm">
                <span>{lang === "VN" ? "Thay đổi hình ảnh" : "Upload New Frame Image"}</span>
                <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleImageChange} className="hidden" />
              </label>
              <p className="text-[10px] text-slate-400 font-medium">* JPEG, PNG, WebP (Max 5MB).</p>
            </div>
          </div>

          {/* BTN SUBMIT */}
          <div className="pt-2">
            <button
              type="submit" disabled={isSubmitting}
              className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-md hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  {lang === "VN" ? "Cập nhật và Lưu thông số" : "Save Specifications Registry"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* PANEL PHẢI: XEM LIVE SƠ ĐỒ GHẾ ĐÃ CONFIGURE (5/12) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col justify-between overflow-hidden min-h-[500px]">
          <div>
            <div className="flex items-center justify-between border-b pb-2 mb-4">
              <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                {lang === "VN" ? "Sơ đồ kiến trúc ghế ngồi" : "Live Cabin Layout Blueprint"}
              </h3>

              {seatMatrix?.decks && seatMatrix.decks.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteVesselLayout}
                  disabled={isDeletingLayout}
                  className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-200/40 transition-colors disabled:opacity-40"
                  title={lang === "VN" ? "Xóa toàn bộ sơ đồ ghế tàu" : "Wipe vessel seat architecture"}
                >
                  {isDeletingLayout ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">delete_sweep</span>
                      {lang === "VN" ? "Xóa sơ đồ" : "Wipe Layout"}
                    </>
                  )}
                </button>
              )}
            </div>

            {seatMatrix?.decks && seatMatrix.decks.length > 1 && (
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                {seatMatrix.decks.map(deck => (
                  <button
                    key={deck.deckNumber} type="button"
                    onClick={() => setActiveDeck(deck.deckNumber)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-headline font-black uppercase transition-all tracking-wider ${activeDeck === deck.deckNumber
                        ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                        : "bg-slate-50 text-slate-400 border hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-700"
                      }`}
                  >
                    {lang === "VN" ? `Tầng ${deck.deckNumber}` : `Deck ${deck.deckNumber}`}
                  </button>
                ))}
              </div>
            )}

            <div className="w-full bg-slate-50 dark:bg-slate-900/60 text-slate-400 border py-2 rounded-xl text-[9px] font-headline font-black text-center uppercase tracking-widest mb-4 shadow-inner">
              {lang === "VN" ? "Buồng lái - Phía mũi tàu" : "Vessel Command Bridge - Bow Direction"}
            </div>

            <div className="overflow-x-auto pb-2 custom-scrollbar">
              {renderDynamicSeatLayout()}
            </div>
          </div>

          <div className="w-full bg-slate-50 dark:bg-slate-900/60 text-slate-400 border py-2 rounded-xl text-[9px] font-headline font-black text-center uppercase tracking-widest mt-4 shadow-inner">
            {lang === "VN" ? "Đuôi tàu phương tiện" : "Stern Exit Direction"}
          </div>
        </div>

      </form>
    </div>
  );
}