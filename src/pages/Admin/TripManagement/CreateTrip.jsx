import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAllRoutes } from "../../../services/routeService";
import { fetchAllBoats } from "../../../services/boatService";
import { addNewTrip, buildTripPayload, SEAT_TYPE_OPTIONS } from "../../../services/tripService";
import { FormSelect } from "../../../components/FormSelect";
import { notify } from "../../../utils/swalToast";

export function CreateTrip() {
  const { lang } = useApp();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    routeCode: "",
    boatCode: "",
    operatingDate: "",
    departureTime: "",
    seatTypePrices: [],
  });

  const [routes, setRoutes] = useState([]);
  const [boats, setBoats] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setIsLoadingOptions(true);
        const [routeData, boatData] = await Promise.all([fetchAllRoutes(), fetchAllBoats()]);
        setRoutes((routeData || []).filter((r) => r.routeType === "Regular" || r.routeType === "SightseeingLoop"));
        setBoats((boatData || []).filter((b) => b.status?.toLowerCase() === "active" && b.seatsConfigured));
      } catch (error) {
        console.error("Lỗi tải dữ liệu tuyến/tàu cho form tạo chuyến:", error);
      } finally {
        setIsLoadingOptions(false);
      }
    };
    loadOptions();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddSeatPrice = () => {
    setFormData((prev) => ({
      ...prev,
      seatTypePrices: [...prev.seatTypePrices, { seatTypeCode: SEAT_TYPE_OPTIONS[0], price: "" }],
    }));
  };

  const handleSeatPriceChange = (index, field, value) => {
    const updated = [...formData.seatTypePrices];
    updated[index] = { ...updated[index], [field]: field === "price" ? value : value };
    setFormData((prev) => ({ ...prev, seatTypePrices: updated }));
  };

  const handleRemoveSeatPrice = (index) => {
    setFormData((prev) => ({
      ...prev,
      seatTypePrices: prev.seatTypePrices.filter((_, i) => i !== index),
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const payload = buildTripPayload(formData);
      await addNewTrip(payload);

      notify({
        icon: "success",
        title: lang === "VN" ? "Tạo chuyến tàu thành công!" : "Trip created successfully!",
        text: lang === "VN" ? "Chuyến tàu mới đã được thêm vào lịch chạy." : "The new trip has been added to the schedule.",
        confirmButtonColor: "#124757",
      }).then(() => navigate("/admin/trips-management"));
    } catch (error) {
      console.error("Lỗi tạo chuyến tàu mới:", error);
      let validationError = "";
      if (error.response?.data?.errors) {
        validationError = Object.values(error.response.data.errors).flat().join(" | ");
      }
      setErrorMsg(validationError || error.response?.data?.message || (lang === "VN" ? "Tạo chuyến tàu thất bại." : "Failed to create trip."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
  const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
  const selectStyle = `${inputStyle} cursor-pointer`;

  const routeOptions = routes.map((r) => ({ value: r.routeCode, label: `${r.routeCode} — ${r.routeName}` }));
  const boatOptions = boats.map((b) => ({ value: b.code, label: `${b.code} — ${b.name}` }));
  const seatTypeSelectOptions = SEAT_TYPE_OPTIONS.map((code) => ({ value: code, label: code }));

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-4xl mx-auto animate-fade-in">

      {/* KHỐI TIÊU ĐỀ HEADER */}
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/trips-management")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white transition-all flex items-center justify-center shadow-inner shrink-0"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Tạo chuyến tàu mới" : "Create New Trip"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN" ? "Gán tàu và giờ chạy cho một tuyến đường trong lịch vận hành." : "Assign a boat and departure time to a route in the schedule."}
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

        {/* KHỐI 1: TUYẾN - TÀU - THỜI GIAN */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5 overflow-visible">
          <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
            {lang === "VN" ? "Thông tin chuyến" : "Trip Information"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 overflow-visible">
            <div className="relative z-30">
              <label className={labelStyle}>{lang === "VN" ? "Tuyến đường (*)" : "Route (*)"}</label>
              <FormSelect
                value={formData.routeCode}
                onChange={(v) => handleInputChange("routeCode", v)}
                options={routeOptions}
                disabled={isLoadingOptions}
                searchable
                required
                placeholder={lang === "VN" ? "Chọn tuyến đường" : "Select a route"}
                emptyLabel={lang === "VN" ? "Không có tuyến phù hợp" : "No matching routes"}
                className={selectStyle}
              />
            </div>
            <div className="relative z-20">
              <label className={labelStyle}>{lang === "VN" ? "Tàu vận hành (*)" : "Boat (*)"}</label>
              <FormSelect
                value={formData.boatCode}
                onChange={(v) => handleInputChange("boatCode", v)}
                options={boatOptions}
                disabled={isLoadingOptions}
                searchable
                required
                placeholder={lang === "VN" ? "Chọn tàu" : "Select a boat"}
                emptyLabel={lang === "VN" ? "Không có tàu phù hợp" : "No matching boats"}
                className={selectStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Ngày vận hành (*)" : "Operating Date (*)"}</label>
              <input
                type="date"
                required
                value={formData.operatingDate}
                onChange={(e) => handleInputChange("operatingDate", e.target.value)}
                className={inputStyle}
              />
            </div>
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Giờ khởi hành (*)" : "Departure Time (*)"}</label>
              <input
                type="datetime-local"
                required
                value={formData.departureTime}
                onChange={(e) => handleInputChange("departureTime", e.target.value)}
                className={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* KHỐI 2: GIÁ VÉ THEO LOẠI GHẾ (TÙY CHỌN) */}
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
            <div>
              <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                {lang === "VN" ? "Giá vé theo loại ghế" : "Seat Type Pricing"}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                {lang === "VN" ? "Tùy chọn — bỏ trống loại ghế nào thì lấy giá gốc từ cấu hình loại ghế." : "Optional — omitted seat types fall back to the base seat-type price."}
              </p>
            </div>
            <button type="button" onClick={handleAddSeatPrice} className="px-3 py-1.5 bg-[#124757]/10 text-[#124757] dark:bg-yellow-400/10 dark:text-yellow-400 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-colors flex items-center gap-1 shrink-0">
              <span className="material-symbols-outlined text-sm">add</span> {lang === "VN" ? "Thêm giá" : "Add"}
            </button>
          </div>

          <div className="space-y-3">
            {formData.seatTypePrices.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-400 font-medium">{lang === "VN" ? "Chưa chốt giá riêng — chuyến sẽ dùng giá gốc theo loại ghế." : "No custom pricing set — trip will use base seat-type prices."}</p>
              </div>
            ) : (
              formData.seatTypePrices.map((item, index) => (
                <div key={index} className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 relative group">
                  <button type="button" onClick={() => handleRemoveSeatPrice(index)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 transition-colors">
                    <span className="material-symbols-outlined text-lg">cancel</span>
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-6">
                    <div>
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Loại ghế" : "Seat type"}</label>
                      <FormSelect
                        value={item.seatTypeCode}
                        onChange={(v) => handleSeatPriceChange(index, "seatTypeCode", v)}
                        options={seatTypeSelectOptions}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-[#124757] dark:text-yellow-400 outline-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Giá vé (VND)" : "Price (VND)"}</label>
                      <input
                        type="number"
                        min={0}
                        value={item.price}
                        onChange={(e) => handleSeatPriceChange(index, "price", e.target.value)}
                        placeholder="0"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-[#124757]"
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
            type="submit"
            disabled={isSubmitting || isLoadingOptions}
            className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            )}
            {lang === "VN" ? "Khởi tạo chuyến" : "Create Trip"}
          </button>
        </div>
      </form>

    </div>
  );
}
