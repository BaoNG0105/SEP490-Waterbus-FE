import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAllRoutes, fetchRouteDetail } from "../../../services/routeService";
import { fetchAllBoats } from "../../../services/boatService";
import {
  addNewTrip,
  buildTripPayload,
  getTripCreateLeadTimeError,
} from "../../../services/tripService";
import {
  ASSIGNMENT_STATUS,
  ASSIGNMENT_TYPE,
  fetchStaffAssignments,
  isAssignmentInactive,
} from "../../../services/staffAssignmentService";
import { FormSelect } from "../../../components/FormSelect";
import { AppDateInput } from "../../../components/AppDateInput";
import { getApiErrorMessage } from "../../../utils/apiError";
import { assignmentCoversDay } from "../../../utils/staffAssignmentCalendarUtils";
import { notify } from "../../../utils/swalToast";

const MIN_ONBOARD_STAFF = 2;

const unwrapBoats = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const countOnBoardStaffForBoatDay = (assignments, boatId, boatCode, dayKey) => {
  const id = String(boatId || "").trim();
  const code = String(boatCode || "").trim().toUpperCase();
  const staffIds = new Set();
  (assignments || []).forEach((row) => {
    if (!row || isAssignmentInactive(row.status)) return;
    if (row.assignmentType !== ASSIGNMENT_TYPE.BOAT) return;
    if (String(row.status || "") === ASSIGNMENT_STATUS.CANCELLED) return;
    if (!assignmentCoversDay(row, dayKey)) return;
    const rowBoatId = String(row.boat?.boatId || row.boatId || "").trim();
    const rowBoatCode = String(row.boat?.boatCode || row.boatCode || "").trim().toUpperCase();
    const matchBoat = (id && rowBoatId && id === rowBoatId)
      || (code && rowBoatCode && code === rowBoatCode);
    if (!matchBoat) return;
    const sid = String(row.staffUserId || "").trim();
    if (sid) staffIds.add(sid);
  });
  return staffIds.size;
};

const pickStopOrder = (stop) => Number(stop?.stopOrder ?? stop?.order ?? stop?.StopOrder ?? 0);
const pickStationLabel = (stop) =>
  stop?.stationName
  || stop?.station?.stationName
  || stop?.stationCode
  || stop?.station?.stationCode
  || stop?.name
  || "--";

/** Bến giữa tuyến (bỏ đầu + cuối) — cần gửi full stops[] kể cả stayDurationMinutes = 0. */
const toIntermediateStops = (routeDetail) => {
  const raw = Array.isArray(routeDetail?.stops)
    ? routeDetail.stops
    : (Array.isArray(routeDetail?.routeStops) ? routeDetail.routeStops : []);
  const sorted = [...raw].sort((a, b) => pickStopOrder(a) - pickStopOrder(b));
  if (sorted.length <= 2) return [];
  return sorted.slice(1, -1).map((stop) => ({
    stopOrder: pickStopOrder(stop),
    stationLabel: pickStationLabel(stop),
    stayDurationMinutes: Number(stop?.stayDurationMinutes ?? stop?.standardStayMin ?? 0) || 0,
  }));
};

export function CreateTrip() {
  const { lang } = useApp();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    routeCode: "",
    boatCode: "",
    operatingDate: "",
    departureTime: "",
    stops: [],
  });

  const [routes, setRoutes] = useState([]);
  const [boats, setBoats] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isLoadingStops, setIsLoadingStops] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setIsLoadingOptions(true);
        const [routeData, boatData] = await Promise.all([fetchAllRoutes(), fetchAllBoats()]);
        setRoutes((routeData || []).filter((r) => r.routeType === "Regular" || r.routeType === "SightseeingLoop"));
        setBoats(unwrapBoats(boatData).filter((b) => b.status?.toLowerCase() === "active" && b.seatsConfigured));
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

  const handleRouteChange = async (routeCode) => {
    setFormData((prev) => ({ ...prev, routeCode, stops: [] }));
    const selected = routes.find((r) => String(r.routeCode) === String(routeCode));
    const routeId = selected?.routeId || selected?.id;
    if (!routeId) return;

    try {
      setIsLoadingStops(true);
      const detail = await fetchRouteDetail(routeId);
      const intermediates = toIntermediateStops(detail);
      setFormData((prev) => ({ ...prev, stops: intermediates }));
    } catch (error) {
      console.error("Lỗi tải route stops:", error);
      setErrorMsg(
        lang === "VN"
          ? "Không tải được danh sách bến dừng của tuyến."
          : "Unable to load route stops.",
      );
    } finally {
      setIsLoadingStops(false);
    }
  };

  const handleStopMinutesChange = (stopOrder, value) => {
    const minutes = Math.max(0, Number(value) || 0);
    setFormData((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) => (
        Number(stop.stopOrder) === Number(stopOrder)
          ? { ...stop, stayDurationMinutes: minutes }
          : stop
      )),
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const leadError = getTripCreateLeadTimeError(formData.operatingDate, formData.departureTime, lang);
      if (leadError) {
        setErrorMsg(leadError);
        return;
      }

      const selectedBoat = boats.find((b) => String(b.code || b.boatCode) === String(formData.boatCode));
      const boatId = selectedBoat?.id || selectedBoat?.boatId || selectedBoat?.BoatId;
      try {
        const assignments = await fetchStaffAssignments({
          assignmentType: ASSIGNMENT_TYPE.BOAT,
          boatId: boatId || undefined,
          fromDate: formData.operatingDate,
          toDate: formData.operatingDate,
          status: ASSIGNMENT_STATUS.SCHEDULED,
        });
        const onboardCount = countOnBoardStaffForBoatDay(
          assignments,
          boatId,
          formData.boatCode,
          formData.operatingDate,
        );
        if (onboardCount < MIN_ONBOARD_STAFF) {
          setErrorMsg(
            lang === "VN"
              ? `Tàu cần ít nhất ${MIN_ONBOARD_STAFF} nhân viên OnBoard được phân công đủ ngày chuyến (hiện có ${onboardCount}). Gán ca tại Phân công nhân sự trước khi tạo trip.`
              : `Boat needs at least ${MIN_ONBOARD_STAFF} OnBoard staff covering the trip day (currently ${onboardCount}). Assign duty in Staff assignments before creating the trip.`,
          );
          return;
        }
      } catch (crewError) {
        console.warn("Không kiểm tra được OnBoard crew trước khi tạo trip:", crewError);
        // Không chặn cứng nếu API list assignments lỗi — BE vẫn validate khi create.
      }

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
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Tạo chuyến tàu thất bại." : "Failed to create trip.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
  const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
  const selectStyle = `${inputStyle} cursor-pointer`;

  const routeOptions = useMemo(
    () => routes.map((r) => ({ value: r.routeCode, label: `${r.routeCode} — ${r.routeName}` })),
    [routes],
  );
  const boatOptions = useMemo(
    () => boats.map((b) => ({ value: b.code, label: `${b.code} — ${b.name}` })),
    [boats],
  );

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-4xl mx-auto animate-fade-in">
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
            {lang === "VN"
              ? `Chuyến phải tạo trước giờ khởi hành ≥ 20 phút. Tàu cần ≥ ${MIN_ONBOARD_STAFF} nhân viên OnBoard đủ ngày chuyến. Bến giữa tuyến cần nhập phút dừng (có thể 0).`
              : `Trip must be created ≥ 20 minutes before departure. Boat needs ≥ ${MIN_ONBOARD_STAFF} OnBoard staff covering the trip day. Intermediate stops need dwell minutes (0 allowed).`}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5 overflow-visible">
          <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
            {lang === "VN" ? "Thông tin chuyến" : "Trip Information"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 overflow-visible">
            <div className="relative z-30">
              <label className={labelStyle}>{lang === "VN" ? "Tuyến đường (*)" : "Route (*)"}</label>
              <FormSelect
                value={formData.routeCode}
                onChange={handleRouteChange}
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
              <p className="mt-1.5 text-[10px] text-slate-400">
                {lang === "VN"
                  ? `Cần ≥ ${MIN_ONBOARD_STAFF} ca OnBoard (Boat) trong ngày vận hành.`
                  : `Requires ≥ ${MIN_ONBOARD_STAFF} OnBoard (Boat) shifts on the operating day.`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Ngày vận hành (*)" : "Operating Date (*)"}</label>
              <AppDateInput
                required
                value={formData.operatingDate}
                onChange={(e) => handleInputChange("operatingDate", e.target.value)}
                className={inputStyle}
              />
            </div>
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Giờ khởi hành (*)" : "Departure Time (*)"}</label>
              <input
                type="time"
                required
                value={formData.departureTime}
                onChange={(e) => handleInputChange("departureTime", e.target.value)}
                className={inputStyle}
              />
              <p className="mt-1 text-[10px] text-slate-400">
                {lang === "VN"
                  ? "Giờ theo ngày vận hành (VN +07). Phải cách hiện tại ≥ 20 phút."
                  : "Time on the operating date (VN +07). Must be ≥ 20 minutes from now."}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
            <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
              {lang === "VN" ? "Phút dừng bến giữa tuyến" : "Intermediate stop dwell"}
            </h3>
          </div>

          {isLoadingStops ? (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-[#124757] rounded-full animate-spin" />
              {lang === "VN" ? "Đang tải bến dừng…" : "Loading stops…"}
            </div>
          ) : !formData.routeCode ? (
            <p className="text-xs text-slate-400 font-medium">
              {lang === "VN" ? "Chọn tuyến để hiện các bến giữa." : "Select a route to load intermediate stops."}
            </p>
          ) : formData.stops.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium">
              {lang === "VN" ? "Tuyến này không có bến giữa — không cần gửi stops[]." : "This route has no intermediate stops — stops[] not required."}
            </p>
          ) : (
            <div className="space-y-3">
              {formData.stops.map((stop) => (
                <div
                  key={stop.stopOrder}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3 items-end rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50"
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "VN" ? `Bến #${stop.stopOrder}` : `Stop #${stop.stopOrder}`}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">{stop.stationLabel}</p>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">
                      {lang === "VN" ? "Phút dừng" : "Stay (min)"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={stop.stayDurationMinutes}
                      onChange={(e) => handleStopMinutesChange(stop.stopOrder, e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-[#124757]"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
          <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
            {lang === "VN" ? "Giá vé" : "Pricing"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === "VN"
              ? "Giá được tính tự động từ Chính sách giá (giá gốc loại ghế / giá theo km + phụ thu cuối tuần / ngày lễ). Không nhập giá riêng khi tạo chuyến."
              : "Prices are computed from Fare Policy (seat-type base / distance fare + weekend/holiday surcharges). No per-trip seat prices on create."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/admin/seat-types")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#124757] transition hover:border-[#124757]/30 dark:border-slate-600 dark:bg-slate-900 dark:text-yellow-400"
          >
            <span className="material-symbols-outlined text-[16px]">sell</span>
            {lang === "VN" ? "Mở chính sách giá" : "Open fare policy"}
          </button>
        </div>

        <div>
          <button
            type="submit"
            disabled={isSubmitting || isLoadingOptions || isLoadingStops}
            className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting && (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {lang === "VN" ? "Khởi tạo chuyến" : "Create Trip"}
          </button>
        </div>
      </form>
    </div>
  );
}
