import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAllRoutes, fetchRouteDetail } from "../../../services/routeService";
import { fetchAllBoats } from "../../../services/boatService";
import {
  buildRoundTripPreviewPayload,
  buildScheduleTripsPayload,
  filterRoundTripPreviewByTimeWindow,
  formatSkippedScheduleItemsText,
  getTripCreateLeadTimeError,
  isSingleTripCreateCase,
  previewRoundTripScheduleBatch,
  scheduleRoundTripSelection,
  scheduleTripsBatch,
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

const DAYS_OF_WEEK = [
  { value: 0, vn: "CN", en: "Sun" },
  { value: 1, vn: "T2", en: "Mon" },
  { value: 2, vn: "T3", en: "Tue" },
  { value: 3, vn: "T4", en: "Wed" },
  { value: 4, vn: "T5", en: "Thu" },
  { value: 5, vn: "T6", en: "Fri" },
  { value: 6, vn: "T7", en: "Sat" },
];

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

/** Số ngày inclusive trong khoảng YYYY-MM-DD (sai khoảng → 0). */
const countInclusiveDays = (fromDate, toDate) => {
  const from = String(fromDate || "").trim();
  const to = String(toDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return 0;
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((b - a) / 86400000) + 1;
};

const getAvailableWeekdaysInRange = (fromDate, toDate) => {
  const totalDays = countInclusiveDays(fromDate, toDate);
  if (totalDays <= 0) return [];

  const [y1, m1, d1] = String(fromDate).split("-").map(Number);
  const start = new Date(Date.UTC(y1, m1 - 1, d1));
  const seen = new Set();
  const ordered = [];

  for (let i = 0; i < totalDays; i += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + i);
    const weekday = current.getUTCDay(); // 0=CN ... 6=T7
    if (!seen.has(weekday)) {
      seen.add(weekday);
      ordered.push(weekday);
    }
    if (seen.size === 7) break;
  }

  return ordered;
};

const toPositiveMinutes = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const pickRouteTravelMinutes = (route) => (
  toPositiveMinutes(route?.estimatedDurationMin)
  || toPositiveMinutes(route?.estimatedDurationMinutes)
  || toPositiveMinutes(route?.durationMinutes)
  || toPositiveMinutes(route?.travelMinutes)
  || 0
);

const formatMinutesLabel = (totalMinutes, lang) => {
  const raw = Number(totalMinutes) || 0;
  const mins = Math.max(0, Math.round(raw)); // làm tròn phút nguyên
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (lang === "VN") {
    if (hours <= 0) return `${rest} phút`;
    if (rest === 0) return `${hours} giờ`;
    return `${hours} giờ ${rest} phút`;
  }
  if (hours <= 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
};

/** Bến giữa tuyến (bỏ đầu + cuối) — chỉ gửi khi tạo 1 chuyến. */
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

  const [form, setForm] = useState({
    createKind: "oneWay", // oneWay | roundTrip
    routeCode: "",
    outboundRouteCode: "",
    inboundRouteCode: "",
    boatCode: "",
    fromDate: "",
    toDate: "",
    daysOfWeek: [],
    mode: "fixed", // fixed | interval (oneWay)
    startTime: "06:00",
    endTime: "18:00",
    intervalMinutes: 30,
    departureTimes: ["08:00"],
    draftTime: "10:00",
    stops: [],
    outboundStops: [],
    inboundStops: [],
  });
  const [roundTripPreview, setRoundTripPreview] = useState(null);
  const [selectedPreviewKeys, setSelectedPreviewKeys] = useState(() => new Set());
  const [isPreviewing, setIsPreviewing] = useState(false);

  const [routes, setRoutes] = useState([]);
  const [boats, setBoats] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isLoadingStops, setIsLoadingStops] = useState(false);
  const [isLoadingInboundStops, setIsLoadingInboundStops] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isRoundTrip = form.createKind === "roundTrip";
  const isSingleCase = useMemo(
    () => !isRoundTrip && isSingleTripCreateCase(form),
    [form, isRoundTrip],
  );
  const daySpan = useMemo(
    () => countInclusiveDays(form.fromDate, form.toDate),
    [form.fromDate, form.toDate],
  );
  const showDaysOfWeek = daySpan >= 3;
  const availableWeekdays = useMemo(
    () => getAvailableWeekdaysInRange(form.fromDate, form.toDate),
    [form.fromDate, form.toDate],
  );
  const availableDayOptions = useMemo(
    () => availableWeekdays
      .map((value) => DAYS_OF_WEEK.find((day) => day.value === value))
      .filter(Boolean),
    [availableWeekdays],
  );

  useEffect(() => {
    if (!showDaysOfWeek) {
      setForm((prev) => (prev.daysOfWeek.length > 0 ? { ...prev, daysOfWeek: [] } : prev));
    }
  }, [showDaysOfWeek]);

  useEffect(() => {
    if (!showDaysOfWeek) return;
    setForm((prev) => {
      const nextDays = prev.daysOfWeek.filter((day) => availableWeekdays.includes(day));
      if (nextDays.length === prev.daysOfWeek.length) return prev;
      return { ...prev, daysOfWeek: nextDays };
    });
  }, [availableWeekdays, showDaysOfWeek]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setIsLoadingOptions(true);
        const [routeData, boatData] = await Promise.all([fetchAllRoutes(), fetchAllBoats()]);
        setRoutes((routeData || []).filter((r) => {
          const status = String(r?.status || "Active").toLowerCase();
          if (status !== "active") return false;
          return r.routeType === "Regular" || r.routeType === "SightseeingLoop";
        }));
        setBoats(unwrapBoats(boatData).filter((b) => b.status?.toLowerCase() === "active" && b.seatsConfigured));
      } catch (error) {
        console.error("Lỗi tải dữ liệu tuyến/tàu cho form tạo chuyến:", error);
      } finally {
        setIsLoadingOptions(false);
      }
    };
    loadOptions();
  }, []);

  const updateForm = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const clearPreview = () => {
    setRoundTripPreview(null);
    setSelectedPreviewKeys(new Set());
  };

  const handleRouteChange = async (routeCode) => {
    updateForm({ routeCode, stops: [] });
    clearPreview();
    const selected = routes.find((r) => String(r.routeCode) === String(routeCode));
    const routeId = selected?.routeId || selected?.id;
    if (!routeId) return;

    try {
      setIsLoadingStops(true);
      const detail = await fetchRouteDetail(routeId);
      updateForm({ routeCode, stops: toIntermediateStops(detail) });
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

  const handleOutboundRouteChange = async (outboundRouteCode) => {
    updateForm({ outboundRouteCode, outboundStops: [] });
    clearPreview();
    const selected = routes.find((r) => String(r.routeCode) === String(outboundRouteCode));
    const routeId = selected?.routeId || selected?.id;
    if (!routeId) return;
    try {
      setIsLoadingStops(true);
      const detail = await fetchRouteDetail(routeId);
      updateForm({ outboundRouteCode, outboundStops: toIntermediateStops(detail) });
    } catch (error) {
      console.error("Lỗi tải outbound stops:", error);
      setErrorMsg(
        lang === "VN"
          ? "Không tải được bến dừng tuyến đi."
          : "Unable to load outbound route stops.",
      );
    } finally {
      setIsLoadingStops(false);
    }
  };

  const handleInboundRouteChange = async (inboundRouteCode) => {
    updateForm({ inboundRouteCode, inboundStops: [] });
    clearPreview();
    const selected = routes.find((r) => String(r.routeCode) === String(inboundRouteCode));
    const routeId = selected?.routeId || selected?.id;
    if (!routeId) return;
    try {
      setIsLoadingInboundStops(true);
      const detail = await fetchRouteDetail(routeId);
      updateForm({ inboundRouteCode, inboundStops: toIntermediateStops(detail) });
    } catch (error) {
      console.error("Lỗi tải inbound stops:", error);
      setErrorMsg(
        lang === "VN"
          ? "Không tải được bến dừng tuyến về."
          : "Unable to load inbound route stops.",
      );
    } finally {
      setIsLoadingInboundStops(false);
    }
  };

  const handleStopMinutesChange = (stopOrder, value, stopsKey = "stops") => {
    const minutes = Math.max(0, Number(value) || 0);
    setForm((prev) => ({
      ...prev,
      [stopsKey]: (prev[stopsKey] || []).map((stop) => (
        Number(stop.stopOrder) === Number(stopOrder)
          ? { ...stop, stayDurationMinutes: minutes }
          : stop
      )),
    }));
    if (isRoundTrip) clearPreview();
  };

  const toggleDayOfWeek = (day) => {
    setForm((prev) => {
      const set = new Set(prev.daysOfWeek);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return { ...prev, daysOfWeek: [...set].sort((a, b) => a - b) };
    });
  };

  const addFixedTime = () => {
    const time = String(form.draftTime || "").trim();
    if (!/^\d{2}:\d{2}$/.test(time)) return;
    setForm((prev) => ({
      ...prev,
      departureTimes: prev.departureTimes.includes(time)
        ? prev.departureTimes
        : [...prev.departureTimes, time].sort(),
    }));
  };

  const removeFixedTime = (time) => {
    setForm((prev) => ({
      ...prev,
      departureTimes: prev.departureTimes.filter((item) => item !== time),
    }));
  };

  const ensureOnBoardCrew = async (boatCode, dayKey) => {
    const selectedBoat = boats.find((b) => String(b.code || b.boatCode) === String(boatCode));
    const boatId = selectedBoat?.id || selectedBoat?.boatId || selectedBoat?.BoatId;
    try {
      const assignments = await fetchStaffAssignments({
        assignmentType: ASSIGNMENT_TYPE.BOAT,
        boatId: boatId || undefined,
        fromDate: dayKey,
        toDate: dayKey,
        status: ASSIGNMENT_STATUS.SCHEDULED,
      });
      const onboardCount = countOnBoardStaffForBoatDay(assignments, boatId, boatCode, dayKey);
      if (onboardCount < MIN_ONBOARD_STAFF) {
        return lang === "VN"
          ? `Tàu cần ít nhất ${MIN_ONBOARD_STAFF} nhân viên OnBoard được phân công đủ ngày chuyến (hiện có ${onboardCount}). Gán ca tại Phân công nhân sự trước khi tạo trip.`
          : `Boat needs at least ${MIN_ONBOARD_STAFF} OnBoard staff covering the trip day (currently ${onboardCount}). Assign duty in Staff assignments before creating the trip.`;
      }
    } catch (crewError) {
      console.warn("Không kiểm tra được OnBoard crew trước khi tạo trip:", crewError);
    }
    return "";
  };

  const handlePreviewRoundTrip = async () => {
    try {
      setIsPreviewing(true);
      setErrorMsg("");

      if (!form.boatCode || !form.outboundRouteCode || !form.inboundRouteCode || !form.fromDate || !form.toDate) {
        setErrorMsg(
          lang === "VN"
            ? "Chọn đủ tàu, tuyến đi, tuyến về và khoảng ngày."
            : "Choose boat, outbound/inbound routes and date range.",
        );
        return;
      }
      if (form.outboundRouteCode === form.inboundRouteCode) {
        setErrorMsg(
          lang === "VN"
            ? "Tuyến đi và tuyến về phải khác nhau."
            : "Outbound and inbound routes must be different.",
        );
        return;
      }
      if (form.fromDate > form.toDate) {
        setErrorMsg(lang === "VN" ? "Từ ngày phải ≤ đến ngày." : "From date must be ≤ to date.");
        return;
      }
      if (!form.startTime || !form.endTime) {
        setErrorMsg(lang === "VN" ? "Nhập giờ bắt đầu và kết thúc khung chạy." : "Enter start and end time of the window.");
        return;
      }
      if (form.startTime >= form.endTime) {
        setErrorMsg(lang === "VN" ? "Giờ bắt đầu phải trước giờ kết thúc." : "Start time must be before end time.");
        return;
      }

      const preview = filterRoundTripPreviewByTimeWindow(
        await previewRoundTripScheduleBatch(buildRoundTripPreviewPayload(form)),
        form.startTime,
        form.endTime,
      );
      setRoundTripPreview(preview);
      setSelectedPreviewKeys(new Set(
        preview.items.filter((item) => item.canCreate).map((item) => item.key),
      ));
    } catch (error) {
      console.error("Lỗi preview khứ hồi:", error);
      clearPreview();
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Không xem trước được lịch khứ hồi." : "Unable to preview round-trip schedule.",
        ),
      );
    } finally {
      setIsPreviewing(false);
    }
  };

  const togglePreviewItem = (key, canCreate) => {
    if (!canCreate) return;
    setSelectedPreviewKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllCreatablePreview = () => {
    if (!roundTripPreview) return;
    setSelectedPreviewKeys(new Set(
      roundTripPreview.items.filter((item) => item.canCreate).map((item) => item.key),
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRoundTrip) {
      try {
        setIsSubmitting(true);
        setErrorMsg("");

        if (!roundTripPreview?.items?.length) {
          setErrorMsg(
            lang === "VN"
              ? "Bấm “Xem gợi ý” trước khi tạo chuyến khứ hồi."
              : "Preview suggestions before creating round-trip trips.",
          );
          return;
        }
        const selectedItems = roundTripPreview.items.filter(
          (item) => item.canCreate && selectedPreviewKeys.has(item.key),
        );
        if (!selectedItems.length) {
          setErrorMsg(
            lang === "VN"
              ? "Chọn ít nhất một khung giờ có thể tạo."
              : "Select at least one creatable slot.",
          );
          return;
        }

        const result = await scheduleRoundTripSelection({
          boatCode: form.boatCode,
          outboundRouteCode: form.outboundRouteCode,
          inboundRouteCode: form.inboundRouteCode,
          outboundStops: form.outboundStops,
          inboundStops: form.inboundStops,
          selectedItems,
        });

        if (result.created >= 1) {
          const requested = Number(result.requested) || selectedItems.length;
          const partial = result.created < requested || (result.skippedItems || []).length > 0;
          const skipText = formatSkippedScheduleItemsText(result.skippedItems, lang);
          notify({
            icon: partial ? "warning" : "success",
            title: partial
              ? (lang === "VN"
                ? `Đã tạo ${result.created}/${requested} chuyến`
                : `Created ${result.created}/${requested} trips`)
              : (lang === "VN" ? "Tạo chuyến thành công!" : "Trip created successfully!"),
            text: partial
              ? (skipText
                || (lang === "VN"
                  ? "Một số khung bị bỏ. Xem reason / sớm nhất / chuyến đụng từ BE."
                  : "Some slots were skipped. See BE reason / earliest / conflict."))
              : undefined,
            confirmButtonColor: "#124757",
          }).then(() => navigate(`/admin/trips-management?date=${encodeURIComponent(form.fromDate)}`));
          return;
        }

        const skipText = formatSkippedScheduleItemsText(result.skippedItems, lang);
        notify({
          icon: "warning",
          title: lang === "VN" ? "Không tạo được chuyến nào" : "No trips created",
          text: skipText
            || (lang === "VN"
              ? "Các khung giờ đã chọn không tạo được. Đổi lựa chọn rồi thử lại."
              : "Selected slots could not be created. Change selection and retry."),
          confirmButtonColor: "#124757",
        });
      } catch (error) {
        console.error("Lỗi tạo chuyến khứ hồi:", error);
        setErrorMsg(
          getApiErrorMessage(
            error,
            lang === "VN" ? "Tạo chuyến khứ hồi thất bại." : "Failed to create round-trip trips.",
          ),
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      if (!form.routeCode || !form.boatCode || !form.fromDate || !form.toDate) {
        setErrorMsg(lang === "VN" ? "Vui lòng chọn tuyến, tàu và khoảng ngày." : "Please choose route, boat and date range.");
        return;
      }
      if (form.fromDate > form.toDate) {
        setErrorMsg(lang === "VN" ? "Từ ngày phải ≤ đến ngày." : "From date must be ≤ to date.");
        return;
      }

      if (form.mode === "interval") {
        if (!form.startTime || !form.endTime || !form.intervalMinutes) {
          setErrorMsg(lang === "VN" ? "Nhập đủ giờ bắt đầu, kết thúc và khoảng phút." : "Enter start time, end time and interval.");
          return;
        }
      } else if (!form.departureTimes.length) {
        setErrorMsg(lang === "VN" ? "Thêm ít nhất một giờ khởi hành cố định." : "Add at least one fixed departure time.");
        return;
      }

      // 1 chuyến (cùng ngày + 1 giờ): kiểm tra lead time + crew trước khi gọi schedule
      if (isSingleTripCreateCase(form)) {
        const departureTime = form.departureTimes[0];
        const leadError = getTripCreateLeadTimeError(form.fromDate, departureTime, lang);
        if (leadError) {
          setErrorMsg(leadError);
          return;
        }
        const crewError = await ensureOnBoardCrew(form.boatCode, form.fromDate);
        if (crewError) {
          setErrorMsg(crewError);
          return;
        }
      }

      const result = await scheduleTripsBatch(buildScheduleTripsPayload(form));

      if (result.created >= 1) {
        const skipText = formatSkippedScheduleItemsText(result.skippedItems, lang);
        const partial = (result.skippedItems || []).length > 0 || result.skipped > 0;
        notify({
          icon: partial ? "warning" : "success",
          title: partial
            ? (lang === "VN"
              ? `Đã tạo ${result.created} · bỏ qua ${result.skipped || result.skippedItems.length}`
              : `Created ${result.created} · skipped ${result.skipped || result.skippedItems.length}`)
            : (lang === "VN" ? "Tạo chuyến thành công!" : "Trip created successfully!"),
          text: partial ? (skipText || undefined) : undefined,
          confirmButtonColor: "#124757",
        }).then(() => navigate(`/admin/trips-management?date=${encodeURIComponent(form.fromDate)}`));
        return;
      }

      // created = 0 (không có chuyến nào được tạo)
      const skipText = formatSkippedScheduleItemsText(result.skippedItems, lang);
      const firstSkip = result.skippedItems?.[0];
      notify({
        icon: "warning",
        title: lang === "VN" ? "Không tạo được chuyến nào" : "No trips created",
        text: skipText
          || firstSkip?.reason
          || (lang === "VN"
          ? `Bỏ qua ${result.skipped} (tàu bận ${result.skippedBoatBusy} · bến bận ${result.skippedStationBusy} · quá giờ ${result.skippedPast} · thiếu crew ${result.skippedMissingOnBoardStaff}). Đổi tàu / giờ / ngày rồi thử lại.`
          : `Skipped ${result.skipped} (boat busy ${result.skippedBoatBusy} · station busy ${result.skippedStationBusy} · past ${result.skippedPast} · missing crew ${result.skippedMissingOnBoardStaff}). Change boat/time/dates and retry.`),
        confirmButtonColor: "#124757",
      });
    } catch (error) {
      console.error("Lỗi tạo chuyến:", error);
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Tạo chuyến thất bại." : "Failed to create trip(s).",
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
  const inboundRouteOptions = useMemo(
    () => routeOptions.filter((r) => String(r.value) !== String(form.outboundRouteCode)),
    [routeOptions, form.outboundRouteCode],
  );
  const selectedRoute = useMemo(
    () => routes.find((r) => String(r.routeCode) === String(form.routeCode)) || null,
    [routes, form.routeCode],
  );
  const routeTravelMinutes = useMemo(
    () => pickRouteTravelMinutes(selectedRoute),
    [selectedRoute],
  );
  const stopStayMinutes = useMemo(
    () => (Array.isArray(form.stops) ? form.stops.reduce((sum, stop) => sum + Math.max(0, Number(stop?.stayDurationMinutes) || 0), 0) : 0),
    [form.stops],
  );
  const totalPreviewMinutes = routeTravelMinutes > 0 ? routeTravelMinutes + stopStayMinutes : 0;
  const boatOptions = useMemo(
    () => boats.map((b) => ({ value: b.code || b.boatCode, label: `${b.code || b.boatCode} — ${b.name}` })),
    [boats],
  );
  const creatablePreviewCount = useMemo(
    () => (roundTripPreview?.items || []).filter((item) => item.canCreate).length,
    [roundTripPreview],
  );
  const selectedCreatableCount = useMemo(
    () => (roundTripPreview?.items || []).filter(
      (item) => item.canCreate && selectedPreviewKeys.has(item.key),
    ).length,
    [roundTripPreview, selectedPreviewKeys],
  );

  const formatClock = (hms) => {
    const raw = String(hms || "").trim();
    if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
    return "—";
  };

  const directionLabel = (direction) => {
    const key = String(direction || "").toLowerCase();
    if (key === "outbound" || key === "đi" || key === "out") {
      return lang === "VN" ? "Lượt đi" : "Outbound";
    }
    if (key === "inbound" || key === "về" || key === "in" || key === "return") {
      return lang === "VN" ? "Lượt về" : "Inbound";
    }
    return direction || "—";
  };

  return (
    <div className={`space-y-6 font-body pb-10 px-2 sm:px-4 mx-auto animate-fade-in ${isRoundTrip ? "max-w-5xl" : "max-w-4xl"}`}>
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/trips-management")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white transition-all flex items-center justify-center shadow-inner shrink-0"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Tạo chuyến tàu" : "Create trips"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {isRoundTrip
              ? (lang === "VN"
                ? "Gợi ý lịch khứ hồi 1 tàu, chọn khung rồi tạo. Giá theo chính sách hiện hành."
                : "Preview one-boat round-trip slots, select, then create. Prices follow fare policy.")
              : (lang === "VN"
                ? "Tạo một hoặc nhiều chuyến trên cùng một form. Giá vé áp dụng theo chính sách hiện hành."
                : "Create one or many trips in the same form. Ticket prices follow the current fare policy.")}
          </p>
        </div>
      </div>

      <div className="flex gap-1 rounded-2xl bg-slate-100/80 p-1 dark:bg-slate-900/80">
        {[
          { id: "oneWay", vn: "Một chiều", en: "One way" },
          { id: "roundTrip", vn: "Khứ hồi", en: "Round trip" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              updateForm({ createKind: item.id });
              clearPreview();
              setErrorMsg("");
            }}
            className={`flex-1 rounded-xl px-2.5 py-2.5 text-center font-headline text-[11px] font-black uppercase tracking-wider transition ${form.createKind === item.id
              ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-[#124757]"
              : "text-slate-500 dark:text-slate-400"
              }`}
          >
            {lang === "VN" ? item.vn : item.en}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5 overflow-visible">
          <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
            {isRoundTrip
              ? (lang === "VN" ? "Tuyến đi · Tuyến về · Tàu · Ngày" : "Outbound · Inbound · Boat · Dates")
              : (lang === "VN" ? "Tuyến · Tàu · Ngày" : "Route · Boat · Dates")}
          </h3>

          {isRoundTrip ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 overflow-visible">
              <div className="relative z-40">
                <label className={labelStyle}>{lang === "VN" ? "Tuyến đi (*)" : "Outbound route (*)"}</label>
                <FormSelect
                  value={form.outboundRouteCode}
                  onChange={handleOutboundRouteChange}
                  options={routeOptions}
                  disabled={isLoadingOptions}
                  searchable
                  required
                  placeholder={lang === "VN" ? "Chọn tuyến đi" : "Select outbound route"}
                  emptyLabel={lang === "VN" ? "Không có tuyến phù hợp" : "No matching routes"}
                  className={selectStyle}
                />
              </div>
              <div className="relative z-30">
                <label className={labelStyle}>{lang === "VN" ? "Tuyến về (*)" : "Inbound route (*)"}</label>
                <FormSelect
                  value={form.inboundRouteCode}
                  onChange={handleInboundRouteChange}
                  options={inboundRouteOptions}
                  disabled={isLoadingOptions}
                  searchable
                  required
                  placeholder={lang === "VN" ? "Chọn tuyến về" : "Select inbound route"}
                  emptyLabel={lang === "VN" ? "Không có tuyến phù hợp" : "No matching routes"}
                  className={selectStyle}
                />
              </div>
              <div className="relative z-20 sm:col-span-2">
                <label className={labelStyle}>{lang === "VN" ? "Tàu (*)" : "Boat (*)"}</label>
                <FormSelect
                  value={form.boatCode}
                  onChange={(v) => { updateForm({ boatCode: v }); clearPreview(); }}
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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 overflow-visible">
              <div className="relative z-30">
                <label className={labelStyle}>{lang === "VN" ? "Tuyến đường (*)" : "Route (*)"}</label>
                <FormSelect
                  value={form.routeCode}
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
                <label className={labelStyle}>{lang === "VN" ? "Tàu (*)" : "Boat (*)"}</label>
                <FormSelect
                  value={form.boatCode}
                  onChange={(v) => updateForm({ boatCode: v })}
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
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Từ ngày (*)" : "From date (*)"}</label>
              <AppDateInput
                required
                value={form.fromDate}
                onChange={(e) => {
                  const fromDate = e.target.value;
                  updateForm({
                    fromDate,
                    toDate: !form.toDate || form.toDate < fromDate ? fromDate : form.toDate,
                  });
                  if (isRoundTrip) clearPreview();
                }}
                className={inputStyle}
              />
            </div>
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Đến ngày (*)" : "To date (*)"}</label>
              <AppDateInput
                required
                value={form.toDate}
                onChange={(e) => {
                  updateForm({ toDate: e.target.value });
                  if (isRoundTrip) clearPreview();
                }}
                className={inputStyle}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            {isRoundTrip
              ? (lang === "VN"
                ? "Tuyến về phải bắt đầu ở bến cuối tuyến đi và kết thúc ở bến đầu tuyến đi."
                : "Inbound must start at outbound’s end station and end at outbound’s start station.")
              : (lang === "VN"
                ? "Muốn tạo 1 chuyến: đặt Từ ngày = Đến ngày và chỉ 1 giờ cố định."
                : "For 1 trip: set From = To and keep exactly one fixed departure time.")}
          </p>

          {showDaysOfWeek && (
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Ngày trong tuần" : "Days of week"}</label>
              <p className="mb-2 text-[11px] text-slate-400">
                {lang === "VN"
                  ? "Không chọn = mọi ngày trong khoảng."
                  : "Leave empty = every day in the range."}
              </p>
              <div className="flex flex-wrap gap-2">
                {availableDayOptions.map((day) => {
                  const active = form.daysOfWeek.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        toggleDayOfWeek(day.value);
                        if (isRoundTrip) clearPreview();
                      }}
                      className={`rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${active
                        ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-[#124757]"
                        : "border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-900"
                        }`}
                    >
                      {lang === "VN" ? day.vn : day.en}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
          <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3">
            {isRoundTrip
              ? (lang === "VN" ? "Khung giờ trong ngày" : "Daily time window")
              : (lang === "VN" ? "Giờ khởi hành" : "Departure times")}
          </h3>

          {isRoundTrip ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Giờ bắt đầu" : "Start time"}</label>
                <input
                  type="time"
                  required
                  value={form.startTime}
                  onChange={(e) => { updateForm({ startTime: e.target.value }); clearPreview(); }}
                  className={inputStyle}
                />
              </div>
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Giờ kết thúc" : "End time"}</label>
                <input
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) => { updateForm({ endTime: e.target.value }); clearPreview(); }}
                  className={inputStyle}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: "fixed",
                    vn: "Giờ cố định",
                    en: "Fixed times",
                    descVn: "Thêm từng giờ khởi hành cụ thể.",
                    descEn: "Add specific departure times.",
                    icon: "schedule",
                  },
                  {
                    id: "interval",
                    vn: "Khoảng phút",
                    en: "Interval",
                    descVn: "Tự tạo giờ theo chu kỳ trong khung.",
                    descEn: "Generate times by interval in a window.",
                    icon: "timelapse",
                  },
                ].map((item) => {
                  const active = form.mode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateForm({ mode: item.id })}
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${active
                        ? "border-[#124757] bg-[#124757]/5 dark:border-yellow-400 dark:bg-yellow-400/10"
                        : "border-slate-200 bg-slate-50/70 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/40"
                        }`}
                    >
                      <span className={`material-symbols-outlined mt-0.5 text-[22px] ${active
                        ? "text-[#124757] dark:text-yellow-400"
                        : "text-slate-400"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-xs font-black uppercase tracking-wider ${active
                          ? "text-[#124757] dark:text-yellow-400"
                          : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {lang === "VN" ? item.vn : item.en}
                        </span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">
                          {lang === "VN" ? item.descVn : item.descEn}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {form.mode === "interval" ? (
                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelStyle}>{lang === "VN" ? "Từ giờ" : "From"}</label>
                      <input
                        type="time"
                        required
                        value={form.startTime}
                        onChange={(e) => updateForm({ startTime: e.target.value })}
                        className={inputStyle}
                      />
                    </div>
                    <div>
                      <label className={labelStyle}>{lang === "VN" ? "Đến giờ" : "To"}</label>
                      <input
                        type="time"
                        required
                        value={form.endTime}
                        onChange={(e) => updateForm({ endTime: e.target.value })}
                        className={inputStyle}
                      />
                    </div>
                    <div>
                      <label className={labelStyle}>{lang === "VN" ? "Mỗi (phút)" : "Every (min)"}</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={form.intervalMinutes}
                        onChange={(e) => updateForm({ intervalMinutes: e.target.value })}
                        className={inputStyle}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "VN" ? "Nhanh" : "Quick"}
                    </span>
                    {[15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => updateForm({ intervalMinutes: mins })}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${Number(form.intervalMinutes) === mins
                          ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-[#124757]"
                          : "border border-slate-200 bg-white text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                      >
                        {mins}’
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[150px] flex-1 sm:flex-none sm:w-[160px]">
                      <label className={labelStyle}>{lang === "VN" ? "Giờ mới" : "New time"}</label>
                      <input
                        type="time"
                        value={form.draftTime}
                        onChange={(e) => updateForm({ draftTime: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addFixedTime();
                          }
                        }}
                        className={inputStyle}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addFixedTime}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#124757] px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white transition hover:opacity-90 dark:bg-yellow-400 dark:text-[#124757]"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      {lang === "VN" ? "Thêm" : "Add"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === "VN"
                        ? `Đã chọn (${form.departureTimes.length})`
                        : `Selected (${form.departureTimes.length})`}
                    </p>
                    {form.departureTimes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => updateForm({ departureTimes: [] })}
                        className="text-[11px] font-bold text-slate-400 hover:text-red-500"
                      >
                        {lang === "VN" ? "Xóa hết" : "Clear all"}
                      </button>
                    )}
                  </div>

                  {form.departureTimes.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs font-bold text-slate-400 dark:border-slate-600">
                      {lang === "VN" ? "Chưa có giờ khởi hành." : "No departure times yet."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                      {form.departureTimes.map((time) => (
                        <li
                          key={time}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                        >
                          <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                            <span className="material-symbols-outlined text-[18px] text-[#124757] dark:text-yellow-400">
                              departure_board
                            </span>
                            {time}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFixedTime(time)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                            title={lang === "VN" ? "Xóa" : "Remove"}
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {isRoundTrip ? (
          <>
            {(isLoadingStops || form.outboundStops.length > 0 || form.outboundRouteCode) && (
              <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                    {lang === "VN" ? "Phút dừng — tuyến đi" : "Dwell — outbound"}
                  </h3>
                </div>
                {isLoadingStops ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-[#124757] rounded-full animate-spin" />
                    {lang === "VN" ? "Đang tải bến dừng…" : "Loading stops…"}
                  </div>
                ) : form.outboundStops.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400">
                    {form.outboundRouteCode
                      ? (lang === "VN" ? "Tuyến đi không có bến giữa." : "Outbound has no intermediate stops.")
                      : (lang === "VN" ? "Chọn tuyến đi để tải bến giữa." : "Select outbound route to load stops.")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {form.outboundStops.map((stop) => (
                      <div
                        key={`out-${stop.stopOrder}`}
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
                            onChange={(e) => handleStopMinutesChange(stop.stopOrder, e.target.value, "outboundStops")}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-[#124757]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(isLoadingInboundStops || form.inboundStops.length > 0 || form.inboundRouteCode) && (
              <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                    {lang === "VN" ? "Phút dừng — tuyến về" : "Dwell — inbound"}
                  </h3>
                </div>
                {isLoadingInboundStops ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-[#124757] rounded-full animate-spin" />
                    {lang === "VN" ? "Đang tải bến dừng…" : "Loading stops…"}
                  </div>
                ) : form.inboundStops.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400">
                    {form.inboundRouteCode
                      ? (lang === "VN" ? "Tuyến về không có bến giữa." : "Inbound has no intermediate stops.")
                      : (lang === "VN" ? "Chọn tuyến về để tải bến giữa." : "Select inbound route to load stops.")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {form.inboundStops.map((stop) => (
                      <div
                        key={`in-${stop.stopOrder}`}
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
                            onChange={(e) => handleStopMinutesChange(stop.stopOrder, e.target.value, "inboundStops")}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-[#124757]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handlePreviewRoundTrip}
                disabled={isPreviewing || isSubmitting || isLoadingOptions || isLoadingStops || isLoadingInboundStops}
                className="flex-1 bg-white text-[#124757] border border-[#124757]/30 dark:bg-slate-900 dark:text-yellow-400 dark:border-yellow-400/40 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-sm hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isPreviewing && (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
                {lang === "VN" ? "Xem gợi ý lịch" : "Preview schedule"}
              </button>
            </div>

            {roundTripPreview && (
              <div className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                      {lang === "VN" ? "Gợi ý khứ hồi" : "Round-trip preview"}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {lang === "VN"
                        ? `${roundTripPreview.suggested} khung · chọn được ${creatablePreviewCount} · đang chọn ${selectedCreatableCount}`
                        : `${roundTripPreview.suggested} slots · creatable ${creatablePreviewCount} · selected ${selectedCreatableCount}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={selectAllCreatablePreview}
                    className="text-[11px] font-bold text-[#124757] hover:underline dark:text-yellow-400"
                  >
                    {lang === "VN" ? "Chọn tất cả hợp lệ" : "Select all creatable"}
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-700">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 dark:bg-slate-900">
                      <tr>
                        <th className="px-3 py-2 font-bold"> </th>
                        <th className="px-3 py-2 font-bold">{lang === "VN" ? "Ngày" : "Date"}</th>
                        <th className="px-3 py-2 font-bold">{lang === "VN" ? "Chiều" : "Dir"}</th>
                        <th className="px-3 py-2 font-bold">{lang === "VN" ? "Tuyến" : "Route"}</th>
                        <th className="px-3 py-2 font-bold">{lang === "VN" ? "Giờ" : "Time"}</th>
                        <th className="px-3 py-2 font-bold">{lang === "VN" ? "Bến" : "Stations"}</th>
                        <th className="px-3 py-2 font-bold">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundTripPreview.items.map((item) => {
                        const checked = selectedPreviewKeys.has(item.key);
                        return (
                          <tr
                            key={item.key}
                            className={`border-t border-slate-100 dark:border-slate-700 ${item.canCreate ? "" : "bg-slate-50/80 opacity-80 dark:bg-slate-900/40"}`}
                          >
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!item.canCreate}
                                onChange={() => togglePreviewItem(item.key, item.canCreate)}
                                className="h-4 w-4 accent-[#124757]"
                              />
                            </td>
                            <td className="px-3 py-2.5 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                              {item.operatingDate || "—"}
                            </td>
                            <td className="px-3 py-2.5 font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {directionLabel(item.direction)}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">
                              {item.routeCode || "—"}
                            </td>
                            <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-white whitespace-nowrap">
                              {formatClock(item.departureHms)} → {formatClock(item.arrivalHms)}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                              {item.fromStationName} → {item.toStationName}
                            </td>
                            <td className="px-3 py-2.5">
                              {item.canCreate ? (
                                <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                  {lang === "VN" ? "Tạo được" : "OK"}
                                </span>
                              ) : (
                                <div className="max-w-[260px] space-y-1">
                                  <span className="block text-[11px] font-bold text-amber-700 dark:text-amber-300" title={item.reason || ""}>
                                    {item.reason || (lang === "VN" ? "Không tạo được" : "Cannot create")}
                                  </span>
                                  {item.suggestedNextDepartureLabel && (
                                    <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                      {lang === "VN" ? "Sớm nhất" : "Earliest"}: {item.suggestedNextDepartureLabel}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {(isLoadingStops || form.stops.length > 0 || (form.routeCode && !isLoadingStops)) && (
              <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
                  <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                    {lang === "VN" ? "Phút dừng bến giữa tuyến" : "Intermediate stop dwell"}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {lang === "VN"
                      ? "Chỉ nhập các bến giữa tuyến (không gồm bến đầu/cuối). Phút dừng có thể là 0."
                      : "Only intermediate stops (not start/end). Stay minutes may be 0."}
                  </p>
                </div>

                {isLoadingStops ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-[#124757] rounded-full animate-spin" />
                    {lang === "VN" ? "Đang tải bến dừng…" : "Loading stops…"}
                  </div>
                ) : form.stops.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400">
                    {form.routeCode
                      ? (lang === "VN" ? "Tuyến này không có bến giữa." : "This route has no intermediate stops.")
                      : (lang === "VN" ? "Chọn tuyến để tải bến giữa." : "Select a route to load intermediate stops.")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {form.stops.map((stop) => (
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
            )}

            {form.routeCode && (
              <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
                <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                  {lang === "VN" ? "Tổng thời gian dự kiến" : "Estimated total duration"}
                </h3>
                {routeTravelMinutes > 0 ? (
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {formatMinutesLabel(totalPreviewMinutes, lang)}
                  </p>
                ) : (
                  <p className="text-xs font-bold text-slate-400">
                    {lang === "VN"
                      ? "Chưa có dữ liệu thời gian chạy tuyến để tính trước."
                      : "Route travel duration is unavailable for preview."}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
          <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
            {lang === "VN" ? "Giá vé" : "Ticket price"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {lang === "VN"
              ? "Bạn không cần nhập giá khi tạo chuyến. Hệ thống sẽ tự áp dụng giá ghế, loại vé và phụ thu theo chính sách giá đã cấu hình."
              : "You don’t need to enter a price when creating trips. Seat fares, ticket types, and surcharges are applied automatically from your configured fare policy."}
          </p>
          <button
            type="button"
            onClick={() => navigate("/admin/seat-types")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#124757] transition hover:border-[#124757]/30 dark:border-slate-600 dark:bg-slate-900 dark:text-yellow-400"
          >
            <span className="material-symbols-outlined text-[16px]">sell</span>
            {lang === "VN" ? "Xem chính sách giá" : "View fare policy"}
          </button>
        </div>

        <button
          type="submit"
          disabled={
            isSubmitting
            || isLoadingOptions
            || isLoadingStops
            || isLoadingInboundStops
            || (isRoundTrip && (!roundTripPreview || selectedCreatableCount < 1))
          }
          className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {isSubmitting && (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
          {isRoundTrip
            ? (lang === "VN"
              ? `Tạo ${selectedCreatableCount || 0} chuyến đã chọn`
              : `Create ${selectedCreatableCount || 0} selected trip(s)`)
            : isSingleCase
              ? (lang === "VN" ? "Tạo 1 chuyến" : "Create 1 trip")
              : (lang === "VN" ? "Lên lịch chuyến" : "Schedule trips")}
        </button>
      </form>
    </div>
  );
}
