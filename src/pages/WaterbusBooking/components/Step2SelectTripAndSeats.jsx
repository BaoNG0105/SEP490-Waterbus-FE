import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
//component
import { FormSelect } from "../../../components/FormSelect";
import { SeatMapIcon, seatToneFromCode } from "../../../components/SeatMapIcon";
import { BoatBowLabel } from "../../../components/ShipWheelIcon";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import { TripDetailModal } from "../../../components/TripDetailModal";
//api
import { fetchTripDetail, fetchTripSeatMap, holdSeats, releaseSeats } from "../../../services/tripService";
import { fetchBoatDetail } from "../../../services/boatService";
//toast
import { notify, showToast } from "../../../utils/swalToast";
//utils
import {
  bookingHasSeatSelection,
  clearSeatSelectionFields,
  confirmLeaveSeatSelection,
} from "../../../utils/bookingWizardGuard";
import {
  formatBookingClosedMessage,
  formatTripUnavailableShortLabel,
  formatFareAdjustmentLabel,
  formatMinPriceLabel,
  formatSegmentDistanceLabel,
  isMissingKmBookingBlock,
  formatMissingKmTripBadge,
  pickBookingClosedReason,
  looksLikeMissingKm,
  pickSegmentDistanceKm,
} from "../../../utils/bookingFareMessages";
import {
  pickStopDisplayArrival,
  pickStopDisplayDeparture,
  pickStopScheduledArrival,
  pickStopScheduledDeparture,
} from "../../../utils/tripStopTimes";

const MAX_SEATS_PER_LEG = 10;
const LOCKED_STATUSES = ["Held", "Booked", "Blocked"];

const TIME_FILTER_OPTIONS_VN = [
  { value: "all", label: "Tất cả khung giờ" },
  { value: "morning", label: "Buổi sáng" },
  { value: "afternoon", label: "Buổi chiều" },
];

const TIME_FILTER_OPTIONS_EN = [
  { value: "all", label: "All times" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
];

const SORT_ORDER_OPTIONS_VN = [
  { value: "earliest", label: "Sớm nhất" },
  { value: "latest", label: "Muộn nhất" },
];

const SORT_ORDER_OPTIONS_EN = [
  { value: "earliest", label: "Earliest first" },
  { value: "latest", label: "Latest first" },
];

const timeFilterClassName =
  "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg px-2 py-2 outline-none dark:text-white whitespace-nowrap";

const formatTripTime = (isoString) => {
  if (!isoString) return "--";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

const formatTripDuration = (departureIso, arrivalIso, lang = "VN") => {
  if (!departureIso || !arrivalIso) return "--";
  const start = new Date(departureIso);
  const end = new Date(arrivalIso);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return "--";
  return lang === "VN" ? `${minutes} phút` : `${minutes} min`;
};

const getTripHourBucket = (isoString) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "all";
  return date.getHours() < 12 ? "morning" : "afternoon";
};

// Trip search trả về giờ theo cả tuyến (departureTime/arrivalTime) lẫn theo đúng chặng khách chọn
// (fromStopScheduledDeparture/toStopScheduledArrival) — luôn ưu tiên giờ theo chặng để hiển thị đúng
// khi khách lên/xuống ở các bến trung gian khác nhau (VD: A→C và B→C không cùng giờ khởi hành).
const getSegmentDeparture = (trip) => trip?.fromStopScheduledDeparture || trip?.departureTime;
const getSegmentArrival = (trip) => trip?.toStopScheduledArrival || trip?.arrivalTime;

/** BE: khóa chặng khi fromStopScheduledDeparture <= now + 10 phút (không dùng trip.departureTime). */
const SEGMENT_BOOKING_CLOSE_LEAD_MS = 10 * 60 * 1000;
const isSegmentBookingClosed = (trip) => {
  const raw = trip?.fromStopScheduledDeparture;
  if (!raw) return false;
  const ms = new Date(raw).getTime();
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now() + SEGMENT_BOOKING_CLOSE_LEAD_MS;
};

/**
 * BE: dùng isBookable + availableSeats — KHÔNG disable vì tripStatus = Boarding.
 * Fallback khi BE chưa gửi isBookable: còn ghế và chặng chưa khóa 10 phút.
 * Thiếu km (isBookable=false) → không book được, nhưng vẫn cho click xem thông tin.
 */
const isTripBookable = (trip) => {
  if (!trip) return false;
  if (Number(trip.availableSeats) <= 0) return false;
  if (isMissingKmBookingBlock(trip)) return false;
  if (typeof trip.isBookable === "boolean") return trip.isBookable;
  return !isSegmentBookingClosed(trip);
};

/** Cho phép click thẻ chuyến để xem thông tin / seat-map (kể cả thiếu km). */
const canInspectTrip = (trip) => {
  if (!trip) return false;
  if (Number(trip.availableSeats) <= 0) return false;
  if (trip.isBookingClosed === true) return false;
  if (isMissingKmBookingBlock(trip)) return true;
  if (typeof trip.isBookable === "boolean") return trip.isBookable;
  return !isSegmentBookingClosed(trip);
};

// Trip search/list KHÔNG kèm ảnh tàu — chỉ có boatId. Ảnh thật phải lấy riêng qua GET /boats/{boatId}.
const pickTripBoatId = (trip) => String(
  trip?.boatId
  || trip?.boat?.boatId
  || trip?.boat?.vesselId
  || trip?.BoatId
  || "",
).trim();

// Ảnh thẻ chuyến: ưu tiên field "imageUrl" nếu trip đã kèm sẵn (một số response BE có),
// fallback sang ảnh tàu đã tải riêng qua fetchBoatDetail (boatImageById, khoá theo boatId).
// Không còn ảnh mặc định fix cứng theo loại tuyến — thiếu ảnh thì ImageWithFallback tự hiển thị NullImageIcon.
const resolveTripCardImage = (trip, boatImageById = {}) => {
  const boat = trip?.boat || trip?.Boat || {};
  const candidates = [
    trip?.boatImageUrl,
    trip?.BoatImageUrl,
    boat.imageUrl,
    boat.ImageUrl,
    Array.isArray(boat.imageUrls) ? boat.imageUrls[0] : "",
    Array.isArray(trip?.boatImageUrls) ? trip.boatImageUrls[0] : "",
    boatImageById[pickTripBoatId(trip)],
  ];
  return candidates.find((url) => String(url || "").trim()) || "";
};

const getTripUnavailableLabel = (trip, lang) => formatBookingClosedMessage(trip, lang);
const getTripUnavailableShortLabel = (trip, lang) => formatTripUnavailableShortLabel(trip, lang);

// Chuyển ký tự hàng ghế (A, B, C...) thành số thứ tự hàng cho CSS grid
const rowLetterToIndex = (row) => {
  const letter = String(row || "A").toUpperCase();
  const code = letter.charCodeAt(letter.length - 1) - 64;
  return code > 0 ? code : 1;
};

// Gom danh sách ghế phẳng từ API thành từng tầng (deck) để vẽ lưới giống trang Seat Layout Editor
const buildDeckLayout = (seats) => {
  const deckMap = new Map();
  seats.forEach((seat) => {
    const deckNumber = Number(seat.deck) || 1;
    if (!deckMap.has(deckNumber)) deckMap.set(deckNumber, []);
    deckMap.get(deckNumber).push(seat);
  });

  return [...deckMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([deckNumber, deckSeats]) => ({
      deckNumber,
      seats: deckSeats,
      rowCount: deckSeats.reduce((max, s) => Math.max(max, rowLetterToIndex(s.row)), 0),
      columnCount: deckSeats.reduce((max, s) => Math.max(max, Number(s.column) || 0), 0),
    }));
};

// Tìm bến dừng khớp theo stationId đã chọn ở Bước 1 trong danh sách stops (trả về từ trip detail)
const findStop = (stops, stationId) => {
  if (!Array.isArray(stops) || !stationId) return null;
  return stops.find((s) => String(s.stationId) === String(stationId)) || null;
};

const pickStopOrder = (stop) => Number(stop?.stopOrder ?? stop?.order ?? 0);

/**
 * Tuyến vòng có thể qua cùng station nhiều lần — KHÔNG lấy find() đầu tiên.
 * Chọn cặp boarding→alighting (stopOrder tăng) khớp giờ search fromStopScheduledDeparture nếu có.
 */
const findSegmentStops = (stops, fromStationId, toStationId, preferredDepartureIso) => {
  if (!Array.isArray(stops) || !fromStationId || !toStationId) {
    return { boarding: null, alighting: null };
  }
  const sorted = [...stops].sort((a, b) => pickStopOrder(a) - pickStopOrder(b));
  const candidates = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (String(sorted[i].stationId) !== String(fromStationId)) continue;
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (String(sorted[j].stationId) === String(toStationId)) {
        candidates.push({ boarding: sorted[i], alighting: sorted[j] });
        break;
      }
    }
  }
  if (candidates.length === 0) {
    return {
      boarding: findStop(stops, fromStationId),
      alighting: findStop(stops, toStationId),
    };
  }
  if (preferredDepartureIso) {
    const prefMs = Date.parse(preferredDepartureIso);
    if (!Number.isNaN(prefMs)) {
      const matched = candidates.find((pair) => {
        const dep = pickStopScheduledDeparture(pair.boarding) || pair.boarding?.plannedDepartureTime;
        const ms = Date.parse(dep || "");
        return !Number.isNaN(ms) && Math.abs(ms - prefMs) <= 60_000;
      });
      if (matched) return matched;
    }
  }
  // Ưu tiên cặp còn mở đặt (> 10 phút); không thì cặp đầu còn lại.
  const open = candidates.find((pair) => !isSegmentBookingClosed({
    fromStopScheduledDeparture: pickStopScheduledDeparture(pair.boarding) || pair.boarding?.plannedDepartureTime,
  }));
  return open || candidates[0];
};

// Stop trên trip không còn stationCode — mã bến lấy từ catalog Step1 (fromWharfCode/toWharfCode).

/** Khóa sơ đồ ghế: ưu tiên đúng field BE isBookingClosed; chỉ fallback local khi BE không gửi. */
const resolveSeatMapBookingClosed = (seatMapResponse, trip) => {
  if (typeof seatMapResponse?.isBookingClosed === "boolean") {
    return seatMapResponse.isBookingClosed;
  }
  if (typeof trip?.isBookable === "boolean") {
    return !trip.isBookable;
  }
  return isSegmentBookingClosed(trip);
};
export default function Step2SelectTripAndSeats({
  bookingData,
  updateData,
  onNext,
  onBack,
  /** "search" = về bước 1; "home" = thoát về trang chủ (Sightseeing). */
  leaveTarget = "search",
}) {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const {
    isRoundTrip,
    fromWharf, toWharf,
    fromWharfName, toWharfName,
    fromWharfCode, toWharfCode,
    routeType,
    departureDate, returnDate,
    departureTripOptions, returnTripOptions,
    selectedDepartureTrip, selectedReturnTrip,
    selectedSeatsDeparture, selectedSeatsReturn
  } = bookingData;

  // Tuyến tham quan vòng (SightseeingLoop) không bán ghế theo chặng — bến đi/đến trùng nhau nên
  // không cần (và thường không tra được) stationCode theo cặp chặng như tuyến Regular; BE trả
  // nguyên sơ đồ ghế cả chuyến khi gọi API không kèm fromStationCode/toStationCode.
  const isLoopRoute = routeType === "SightseeingLoop";

  // Mã bến đi/đến của từng chặng — lấy từ catalog Step1 (fromWharfCode/toWharfCode).
  // Chặng về đi ngược chiều (toWharf -> fromWharf).
  const getLegStationCodes = (leg) => {
    if (isLoopRoute) return { fromStationCode: undefined, toStationCode: undefined };
    if (leg === "departure") {
      return { fromStationCode: fromWharfCode || "", toStationCode: toWharfCode || "" };
    }
    return { fromStationCode: toWharfCode || "", toStationCode: fromWharfCode || "" };
  };

  // Quản lý tab nội bộ của bước 2 nếu là khứ hồi: 'departure' (chiều đi) hoặc 'return' (chiều về)
  const [activeLeg, setActiveLeg] = useState("departure");
  const [filterTime, setFilterTime] = useState("all");
  const [sortOrder, setSortOrder] = useState("earliest");

  // Tên bến hiển thị trên thẻ chuyến — chặng về đi ngược chiều nên phải đảo lại thứ tự tên bến
  const legFromWharfName = activeLeg === "departure" ? fromWharfName : toWharfName;
  const legToWharfName = activeLeg === "departure" ? toWharfName : fromWharfName;

  // Sơ đồ ghế thực tế lấy từ API, lưu riêng theo từng chiều (departure/return) — chỉ để hiển thị,
  // việc chọn/bỏ chọn ghế ở bước này thuần local, KHÔNG gọi API giữ ghế.
  const [seatMapByLeg, setSeatMapByLeg] = useState({ departure: [], return: [] });
  const [seatMapMetaByLeg, setSeatMapMetaByLeg] = useState({
    departure: { segmentDistanceKm: null, fareAdjustment: null },
    return: { segmentDistanceKm: null, fareAdjustment: null },
  });
  const [bookingClosedByLeg, setBookingClosedByLeg] = useState({ departure: false, return: false });
  const [activeDeckByLeg, setActiveDeckByLeg] = useState({ departure: 1, return: 1 });
  const [isLoadingSeats, setIsLoadingSeats] = useState(false);
  const [seatMapError, setSeatMapError] = useState("");
  const [isConfirmingSeats, setIsConfirmingSeats] = useState(false);
  const autoSelectKeyRef = useRef("");

  // Trip đang được xem chi tiết trong modal (click nút icon "i" trên thẻ chuyến) — null = đóng modal.
  const [detailTrip, setDetailTrip] = useState(null);

  // Ảnh + tên tàu theo boatId — trip search/list CHỈ trả về boatId, không kèm ảnh lẫn tên thật,
  // nên phải gọi riêng GET /boats/{boatId} để lấy cả hai.
  const [boatImageById, setBoatImageById] = useState({});
  const [boatNameById, setBoatNameById] = useState({});
  const fetchedBoatIdsRef = useRef(new Set());

  // Với mỗi chuyến hiển thị (cả 2 chiều) mà chưa từng tải chi tiết tàu, gọi 1 lần để lấy cả
  // ảnh lẫn tên thật; chỉ gọi 1 lần cho mỗi boatId (fetchedBoatIdsRef) để tránh gọi lại khi re-render.
  // GET /boats/{boatId} yêu cầu đã đăng nhập — khách chưa login vẫn xem được danh sách chuyến ở bước
  // này, nên PHẢI chặn gọi API khi !isAuthenticated, nếu không BE trả 401 và interceptor sẽ tự đăng
  // xuất + đá về /login dù user chỉ đang xem, chưa hề chọn ghế.
  useEffect(() => {
    if (!isAuthenticated) return;
    const allTrips = [...(departureTripOptions || []), ...(returnTripOptions || [])];
    const missingIds = [...new Set(
      allTrips
        .map((trip) => pickTripBoatId(trip))
        .filter((boatId) => boatId && !fetchedBoatIdsRef.current.has(boatId))
    )];

    if (missingIds.length === 0) return;

    let isActive = true;
    (async () => {
      const entries = await Promise.all(missingIds.map(async (boatId) => {
        try {
          const detail = await fetchBoatDetail(boatId);
          const imageUrl = detail?.imageUrl
            || detail?.ImageUrl
            || (Array.isArray(detail?.imageUrls) ? detail.imageUrls[0] : "")
            || "";
          const name = detail?.name || detail?.Name || detail?.boatName || detail?.BoatName || "";
          return [boatId, imageUrl, name];
        } catch {
          return [boatId, "", ""];
        }
      }));
      if (!isActive) return;
      // Chỉ đánh dấu "đã tải" SAU KHI fetch thật sự hoàn tất và effect này còn hiệu lực.
      // Đánh dấu sớm (trước khi await xong) sẽ dính bug React StrictMode double-effect ở dev:
      // lần chạy effect đầu bị cleanup hủy kết quả (isActive=false), nhưng đã lỡ đánh dấu
      // fetchedBoatIdsRef khiến lần chạy effect thứ hai (lần "thật") bỏ qua luôn boatId đó
      // — ảnh tàu không bao giờ hiện cho tới khi reload trang (mount mới, ref rỗng lại).
      missingIds.forEach((boatId) => fetchedBoatIdsRef.current.add(boatId));
      setBoatImageById((prev) => {
        const next = { ...prev };
        entries.forEach(([boatId, imageUrl]) => {
          if (imageUrl) next[boatId] = imageUrl;
        });
        return next;
      });
      setBoatNameById((prev) => {
        const next = { ...prev };
        entries.forEach(([boatId, , name]) => {
          if (name) next[boatId] = name;
        });
        return next;
      });
    })();

    return () => {
      isActive = false;
    };
  }, [departureTripOptions, returnTripOptions, isAuthenticated]);

  // Nếu quay lại Bước 2 từ Bước 3 (chuyến đã chọn sẵn trong bookingData), Step2 mount lại từ đầu nên
  // seatMapByLeg rỗng — tải lại sơ đồ ghế thật cho (các) chặng đã chọn để hiển thị đúng, không bị trống.
  useEffect(() => {
    const legsToHydrate = [
      selectedDepartureTrip?.tripId ? ["departure", selectedDepartureTrip] : null,
      selectedReturnTrip?.tripId ? ["return", selectedReturnTrip] : null,
    ].filter(Boolean);

    if (legsToHydrate.length === 0) return;

    let cancelled = false;
    const hydrate = async () => {
      setIsLoadingSeats(true);
      try {
        await Promise.all(legsToHydrate.map(async ([leg, trip]) => {
          const { fromStationCode, toStationCode } = getLegStationCodes(leg);
          if (!isLoopRoute && (!fromStationCode || !toStationCode)) return;
          const seatMapResponse = await fetchTripSeatMap(trip.tripId, { fromStationCode, toStationCode });
          if (cancelled) return;
          const meta = {
            segmentDistanceKm: pickSegmentDistanceKm(seatMapResponse),
            fareAdjustment: seatMapResponse?.fareAdjustment
              ?? seatMapResponse?.FareAdjustment
              ?? trip?.fareAdjustment
              ?? null,
          };
          setSeatMapByLeg((prev) => ({ ...prev, [leg]: seatMapResponse?.seats || [] }));
          setSeatMapMetaByLeg((prev) => ({ ...prev, [leg]: meta }));
          setBookingClosedByLeg((prev) => ({
            ...prev,
            [leg]: resolveSeatMapBookingClosed(seatMapResponse, trip),
          }));
          if (leg === "departure") {
            updateData({
              selectedDepartureTrip: {
                ...trip,
                segmentDistanceKm: meta.segmentDistanceKm,
                fareAdjustment: meta.fareAdjustment,
              },
            });
          } else {
            updateData({
              selectedReturnTrip: {
                ...trip,
                segmentDistanceKm: meta.segmentDistanceKm,
                fareAdjustment: meta.fareAdjustment,
              },
            });
          }
        }));
      } catch (error) {
        if (!cancelled) {
          console.error("Lỗi khi tải lại sơ đồ ghế:", error);
          setSeatMapError(
            lang === "VN"
              ? "Không thể tải lại sơ đồ ghế. Vui lòng chọn lại chuyến."
              : "Unable to reload the seat map. Please reselect the trip."
          );
        }
      } finally {
        if (!cancelled) setIsLoadingSeats(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromWharf, toWharf, fromWharfCode, toWharfCode]);

  const tripOptions = activeLeg === "departure" ? departureTripOptions : returnTripOptions;
  const currentTrip = activeLeg === "departure" ? selectedDepartureTrip : selectedReturnTrip;
  const currentSeats = activeLeg === "departure" ? selectedSeatsDeparture : selectedSeatsReturn;
  const currentSeatMap = seatMapByLeg[activeLeg];
  const isCurrentBookingClosed = Boolean(bookingClosedByLeg[activeLeg]);

  const resolveLegSegmentKm = (leg, trip) => (
    seatMapMetaByLeg[leg]?.segmentDistanceKm
    ?? pickSegmentDistanceKm(trip)
  );
  const legHasSegmentKm = (leg, trip) => (
    isLoopRoute || resolveLegSegmentKm(leg, trip) != null
  );
  const currentSeatMapMeta = seatMapMetaByLeg[activeLeg] || {};
  const currentSegmentKm = resolveLegSegmentKm(activeLeg, currentTrip);
  const currentFareAdjLabel = formatFareAdjustmentLabel(
    currentSeatMapMeta.fareAdjustment ?? currentTrip?.fareAdjustment,
    lang,
  );
  const isCurrentMissingKm = Boolean(currentTrip) && !isLoopRoute && (
    currentSegmentKm == null || isMissingKmBookingBlock(currentTrip)
  );

  const filteredTripOptions = (tripOptions || [])
    .filter((trip) => {
      if (filterTime === "all") return true;
      return getTripHourBucket(getSegmentDeparture(trip)) === filterTime;
    })
    .sort((a, b) => {
      const aMs = new Date(getSegmentDeparture(a)).getTime();
      const bMs = new Date(getSegmentDeparture(b)).getTime();
      const safeA = Number.isFinite(aMs) ? aMs : Infinity;
      const safeB = Number.isFinite(bMs) ? bMs : Infinity;
      return sortOrder === "latest" ? safeB - safeA : safeA - safeB;
    });

  const deckLayout = useMemo(() => buildDeckLayout(currentSeatMap), [currentSeatMap]);
  const activeDeckNumber = activeDeckByLeg[activeLeg] || deckLayout[0]?.deckNumber || 1;
  const activeDeckData = deckLayout.find((d) => d.deckNumber === activeDeckNumber) || deckLayout[0];

  const seatTypesInMap = useMemo(() => {
    const map = new Map();
    currentSeatMap.forEach((seat) => {
      const code = String(seat.seatTypeCode || "STANDARD").toUpperCase();
      if (!map.has(code)) map.set(code, seat.seatTypeName || code);
    });
    return [...map.entries()];
  }, [currentSeatMap]);

  const promptSignIn = () => {
    notify({
      dialog: true,
      icon: "info",
      title: lang === "VN" ? "Bạn cần đăng nhập" : "Sign in required",
      text: lang === "VN" ? "Vui lòng đăng nhập để chọn ghế và đặt vé." : "Please sign in to select seats and book tickets.",
      confirmButtonText: "OK",
      allowOutsideClick: false,
      showCancelButton: false,
    }).then(() => {
      const next = `${window.location.pathname}${window.location.search || ""}`;
      navigate(`/login?redirect=${encodeURIComponent(next)}`);
    });
  };

  // Khi người dùng chọn 1 chuyến: tải chi tiết chuyến (bến dừng) + sơ đồ ghế thực tế của chặng đang xem.
  // Thiếu km: vẫn cho click xem thông tin; ghế/thanh toán bị khóa sau khi load seat-map.
  const handleSelectTrip = async (trip, { silent = false } = {}) => {
    if (!canInspectTrip(trip)) {
      if (!silent) {
        showToast({
          icon: "warning",
          title: lang === "VN" ? "Không thể chọn chuyến này" : "Trip unavailable",
          text: getTripUnavailableLabel(trip, lang),
        });
      }
      return;
    }
    if (currentTrip?.tripId === trip.tripId) return;

    if (!isAuthenticated) {
      if (!silent) promptSignIn();
      return;
    }

    setSeatMapError("");
    setIsLoadingSeats(true);
    try {
      const tripDetail = await fetchTripDetail(trip.tripId);
      const stops = tripDetail?.stops || [];

      // Giờ khởi hành/đến đúng theo chặng — trên tuyến vòng phải chọn đúng lần qua bến
      // (không lấy findStop đầu tiên, dễ khóa nhầm theo giờ bến đầu tuyến).
      const boardingStationId = activeLeg === "departure" ? fromWharf : toWharf;
      const alightingStationId = activeLeg === "departure" ? toWharf : fromWharf;
      const preferredDep = trip.fromStopScheduledDeparture || trip.departureTime;
      const { boarding: boardingStop, alighting: alightingStop } = findSegmentStops(
        stops,
        boardingStationId,
        alightingStationId,
        preferredDep,
      );

      const mergedTrip = {
        ...trip,
        stops,
        fromStopScheduledDeparture: pickStopDisplayDeparture(boardingStop)
          || pickStopScheduledDeparture(boardingStop)
          || trip.fromStopScheduledDeparture
          || trip.departureTime,
        toStopScheduledArrival: pickStopDisplayArrival(alightingStop)
          || pickStopScheduledArrival(alightingStop)
          || trip.toStopScheduledArrival
          || trip.arrivalTime,
      };
      const { fromStationCode, toStationCode } = getLegStationCodes(activeLeg);

      if (!isLoopRoute && (!fromStationCode || !toStationCode)) {
        setSeatMapError(
          lang === "VN"
            ? "Không xác định được mã bến đón/trả trên chuyến này. Vui lòng chọn chuyến khác."
            : "Unable to resolve the pickup/drop-off station codes for this trip. Please pick another trip."
        );
        return;
      }

      const seatMapResponse = await fetchTripSeatMap(trip.tripId, { fromStationCode, toStationCode });
      const segmentDistanceKm = pickSegmentDistanceKm(seatMapResponse);
      const fareAdjustment = seatMapResponse?.fareAdjustment
        ?? seatMapResponse?.FareAdjustment
        ?? trip?.fareAdjustment
        ?? null;
      const tripWithFare = {
        ...mergedTrip,
        segmentDistanceKm,
        fareAdjustment,
        minPrice: seatMapResponse?.minPrice ?? mergedTrip.minPrice,
        isBookable: seatMapResponse?.isBookable ?? mergedTrip.isBookable,
        bookingClosedReason: seatMapResponse?.bookingClosedReason || mergedTrip?.bookingClosedReason,
        isBookingClosed: seatMapResponse?.isBookingClosed ?? mergedTrip?.isBookingClosed,
      };
      const missingKm = !isLoopRoute && (
        segmentDistanceKm == null || isMissingKmBookingBlock(tripWithFare)
      );
      // Đóng theo giờ ≠ thiếu km. Thiếu km vẫn cho xem seat-map nhưng khóa chọn ghế.
      const closedBySchedule = resolveSeatMapBookingClosed(seatMapResponse, tripWithFare)
        && !missingKm;
      setSeatMapByLeg((prev) => ({ ...prev, [activeLeg]: seatMapResponse?.seats || [] }));
      setSeatMapMetaByLeg((prev) => ({
        ...prev,
        [activeLeg]: { segmentDistanceKm, fareAdjustment },
      }));
      setBookingClosedByLeg((prev) => ({ ...prev, [activeLeg]: closedBySchedule }));
      setActiveDeckByLeg((prev) => ({ ...prev, [activeLeg]: 1 }));

      if (closedBySchedule || missingKm) {
        const reasonPayload = {
          ...tripWithFare,
          ...seatMapResponse,
          bookingClosedReason: seatMapResponse?.bookingClosedReason || mergedTrip?.bookingClosedReason,
          isBookingClosed: closedBySchedule,
          isBookable: false,
          minPrice: seatMapResponse?.minPrice ?? mergedTrip?.minPrice,
          segmentDistanceKm,
        };
        setSeatMapError(
          missingKm
            ? (pickBookingClosedReason(reasonPayload)
              || formatMissingKmTripBadge(lang))
            : (lang === "VN"
              ? `Chặng này đã khóa đặt ghế${seatMapResponse?.bookingClosedReason || getTripUnavailableLabel(mergedTrip, lang) ? `: ${seatMapResponse?.bookingClosedReason || getTripUnavailableLabel(mergedTrip, lang)}` : "."}`
              : `This segment is closed for booking${seatMapResponse?.bookingClosedReason || getTripUnavailableLabel(mergedTrip, lang) ? `: ${seatMapResponse?.bookingClosedReason || getTripUnavailableLabel(mergedTrip, lang)}` : "."}`),
        );
      } else {
        setSeatMapError("");
      }

      if (activeLeg === "departure") {
        updateData({ selectedDepartureTrip: tripWithFare, selectedSeatsDeparture: [] });
      } else {
        updateData({ selectedReturnTrip: tripWithFare, selectedSeatsReturn: [] });
      }
    } catch (error) {
      console.error("Lỗi khi tải chi tiết chuyến/sơ đồ ghế:", error);
      const apiMsg = error?.response?.data;
      const detail = typeof apiMsg === "string"
        ? apiMsg
        : (apiMsg?.bookingClosedReason || apiMsg?.detail || apiMsg?.message || apiMsg?.title || "");
      const reasonPayload = {
        bookingClosedReason: detail,
        isBookingClosed: false,
        isBookable: false,
        minPrice: apiMsg?.minPrice ?? null,
        validationMessage: detail,
      };
      if (isMissingKmBookingBlock(reasonPayload) || looksLikeMissingKm(detail)) {
        // Vẫn gắn trip đã chọn để user thấy lý do — không crash flow khi minPrice=null.
        if (activeLeg === "departure") {
          updateData({
            selectedDepartureTrip: {
              ...trip,
              minPrice: null,
              isBookable: false,
              bookingClosedReason: detail || formatMissingKmTripBadge(lang),
            },
            selectedSeatsDeparture: [],
          });
        } else {
          updateData({
            selectedReturnTrip: {
              ...trip,
              minPrice: null,
              isBookable: false,
              bookingClosedReason: detail || formatMissingKmTripBadge(lang),
            },
            selectedSeatsReturn: [],
          });
        }
        setBookingClosedByLeg((prev) => ({ ...prev, [activeLeg]: false }));
        setSeatMapByLeg((prev) => ({ ...prev, [activeLeg]: [] }));
        setSeatMapError(detail || formatMissingKmTripBadge(lang));
      } else {
        setSeatMapError(
          lang === "VN"
            ? "Không thể tải sơ đồ ghế cho chuyến này. Vui lòng thử lại."
            : "Unable to load the seat map for this trip. Please try again."
        );
      }
    } finally {
      setIsLoadingSeats(false);
    }
  };

  // Mở sẵn sơ đồ ghế: tự chọn chuyến còn chỗ đầu tiên khi vào bước / đổi chiều / chưa chọn chuyến.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (currentTrip?.tripId) return;

    const firstAvailable = filteredTripOptions.find((trip) => isTripBookable(trip));
    if (!firstAvailable?.tripId) return;

    const key = `${activeLeg}:${firstAvailable.tripId}:${filterTime}:${sortOrder}`;
    if (autoSelectKeyRef.current === key) return;
    autoSelectKeyRef.current = key;
    handleSelectTrip(firstAvailable, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeg, filterTime, sortOrder, isAuthenticated, filteredTripOptions.length, currentTrip?.tripId]);

  // Chọn/bỏ chọn ghế: chỉ cập nhật state cục bộ, KHÔNG gọi API giữ/nhả ghế ở bước này
  const handleSeatClick = (seat) => {
    if (!isAuthenticated) {
      promptSignIn();
      return;
    }
    if (!currentTrip?.tripId) return;
    if (isCurrentBookingClosed || isCurrentMissingKm) {
      showToast({
        icon: "warning",
        title: isCurrentMissingKm
          ? (lang === "VN" ? "Thiếu quãng đường" : "Missing segment distance")
          : (lang === "VN" ? "Chặng đã khóa đặt ghế" : "Seat booking closed"),
        text: isCurrentMissingKm
          ? (lang === "VN"
            ? "Chưa có segmentDistanceKm từ seat-map — không thể đặt vé."
            : "segmentDistanceKm is missing from seat-map — booking is blocked.")
          : (lang === "VN"
            ? "Không thể chọn ghế vì chặng đã đóng đặt vé."
            : "Seats cannot be selected because this segment is closed."),
      });
      return;
    }

    const isSelected = currentSeats.some((s) => s.seatNumber === seat.seatNumber);
    const isLockedByOthers = LOCKED_STATUSES.includes(seat.status) && !isSelected;
    if (isLockedByOthers) return;

    const setLegSeats = (seats) => {
      if (activeLeg === "departure") updateData({ selectedSeatsDeparture: seats });
      else updateData({ selectedSeatsReturn: seats });
    };

    if (isSelected) {
      setLegSeats(currentSeats.filter((s) => s.seatNumber !== seat.seatNumber));
      return;
    }

    if (currentSeats.length >= MAX_SEATS_PER_LEG) {
      showToast({
        icon: "warning",
        title: lang === "VN" ? "Đã đạt số ghế tối đa" : "Maximum seats reached",
        text: lang === "VN" ? `Chỉ được chọn tối đa ${MAX_SEATS_PER_LEG} ghế trong 1 lần đặt.` : `You can select up to ${MAX_SEATS_PER_LEG} seats per booking.`,
      });
      return;
    }

    setLegSeats([...currentSeats, seat]);
  };

  // Vé khứ hồi: số ghế chiều về phải bằng số ghế chiều đi (hành khách đi và về là cùng một nhóm người)
  const roundTripSeatCountMismatch = isRoundTrip
    && selectedSeatsDeparture.length > 0
    && selectedSeatsReturn.length > 0
    && selectedSeatsDeparture.length !== selectedSeatsReturn.length;

  // Kiểm tra xem đã hoàn thành điều kiện để ấn nút "Tiếp tục" sang bước thanh toán chưa
  const isStepComplete = selectedDepartureTrip && selectedSeatsDeparture.length > 0
    && isTripBookable(selectedDepartureTrip)
    && !bookingClosedByLeg.departure
    && legHasSegmentKm("departure", selectedDepartureTrip)
    && (!isRoundTrip || (
      selectedReturnTrip
      && selectedSeatsReturn.length > 0
      && selectedSeatsReturn.length === selectedSeatsDeparture.length
      && isTripBookable(selectedReturnTrip)
      && !bookingClosedByLeg.return
      && legHasSegmentKm("return", selectedReturnTrip)
    ));

  const hasSelectionProgress = bookingHasSeatSelection({
    selectedDepartureTrip,
    selectedReturnTrip,
    selectedSeatsDeparture,
    selectedSeatsReturn,
  });

  const handleBack = async () => {
    if (!hasSelectionProgress) {
      onBack();
      return;
    }

    const ok = await confirmLeaveSeatSelection(lang, { leaveTarget });
    if (!ok) return;

    updateData(clearSeatSelectionFields());
    onBack();
  };

  // Chỉ THỰC SỰ giữ ghế (gọi API hold) khi bấm "Tiếp tục thanh toán" — đây là lúc rời Bước 2 sang Bước 3.
  const handleContinueToCheckout = async () => {
    if (!isStepComplete || isConfirmingSeats) return;

    setSeatMapError("");
    setIsConfirmingSeats(true);
    try {
      const departureCodes = getLegStationCodes("departure");
      const departureHold = await holdSeats(
        selectedDepartureTrip.tripId,
        selectedSeatsDeparture.map((s) => s.seatNumber),
        departureCodes.fromStationCode,
        departureCodes.toStationCode
      );
      const departureFailed = departureHold?.failedSeatNumbers || [];

      if (departureFailed.length) {
        setActiveLeg("departure");
        updateData({ selectedSeatsDeparture: selectedSeatsDeparture.filter((s) => !departureFailed.includes(s.seatNumber)) });
        const refreshed = await fetchTripSeatMap(selectedDepartureTrip.tripId, departureCodes);
        setSeatMapByLeg((prev) => ({ ...prev, departure: refreshed?.seats || [] }));
        setSeatMapError(
          lang === "VN"
            ? `Ghế ${departureFailed.join(", ")} (chiều đi) vừa được đặt bởi người khác. Vui lòng chọn lại.`
            : `Seat(s) ${departureFailed.join(", ")} (departure) were held by someone else. Please reselect.`
        );
        return;
      }

      let returnExpiresAt = null;
      if (isRoundTrip) {
        const returnCodes = getLegStationCodes("return");
        const returnHold = await holdSeats(
          selectedReturnTrip.tripId,
          selectedSeatsReturn.map((s) => s.seatNumber),
          returnCodes.fromStationCode,
          returnCodes.toStationCode
        );
        const returnFailed = returnHold?.failedSeatNumbers || [];

        if (returnFailed.length) {
          // Không thể hoàn tất khứ hồi — nhả lại ghế chiều đi vừa giữ để không giữ ghế lãng phí
          releaseSeats(
            selectedDepartureTrip.tripId,
            selectedSeatsDeparture.map((s) => s.seatNumber),
            departureCodes.fromStationCode,
            departureCodes.toStationCode
          ).catch(() => { });

          setActiveLeg("return");
          updateData({ selectedSeatsReturn: selectedSeatsReturn.filter((s) => !returnFailed.includes(s.seatNumber)) });
          const refreshed = await fetchTripSeatMap(selectedReturnTrip.tripId, returnCodes);
          setSeatMapByLeg((prev) => ({ ...prev, return: refreshed?.seats || [] }));
          setSeatMapError(
            lang === "VN"
              ? `Ghế ${returnFailed.join(", ")} (chiều về) vừa được đặt bởi người khác. Vui lòng chọn lại.`
              : `Seat(s) ${returnFailed.join(", ")} (return) were held by someone else. Please reselect.`
          );
          return;
        }
        returnExpiresAt = returnHold?.holdExpiresAt || null;
      }

      const expiries = [departureHold?.holdExpiresAt, returnExpiresAt]
        .filter(Boolean)
        .map((d) => new Date(d).getTime());
      const seatHoldExpiresAt = expiries.length ? new Date(Math.min(...expiries)).toISOString() : null;

      updateData({ seatHoldExpiresAt });
      onNext();
    } catch (error) {
      console.error("Lỗi khi giữ ghế:", error);
      setSeatMapError(
        lang === "VN" ? "Không thể giữ ghế đã chọn. Vui lòng thử lại." : "Unable to hold the selected seats. Please try again."
      );
    } finally {
      setIsConfirmingSeats(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* --- SUB-TABS CHUYỂN ĐỔI CHIỀU ĐI / CHIỀU VỀ (CHỈ HIỆN KHI ĐẶT KHỨ HỒI) --- */}
      {isRoundTrip && (
        <div className="flex justify-center border-b border-slate-200 dark:border-slate-700 max-w-md mx-auto gap-4 pb-0">
          <button
            type="button"
            onClick={() => setActiveLeg("departure")}
            className={`pb-3 text-sm font-headline font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 ${activeLeg === "departure" ? "border-[#124757] text-[#124757] dark:border-[#FFD100] dark:text-[#FFD100]" : "border-transparent text-slate-400"
              }`}
          >
            {lang === "VN" ? "1. Lựa chọn Chiều Đi" : "1. Departure Leg"}
            {selectedDepartureTrip && <span className="text-xs text-green-500">✓</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveLeg("return")}
            className={`pb-3 text-sm font-headline font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 ${activeLeg === "return" ? "border-[#124757] text-[#124757] dark:border-[#FFD100] dark:text-[#FFD100]" : "border-transparent text-slate-400"
              }`}
          >
            {lang === "VN" ? "2. Lựa chọn Chiều Về" : "2. Return Leg"}
            {selectedReturnTrip && <span className="text-xs text-green-500">✓</span>}
          </button>
        </div>
      )}

      {!isAuthenticated && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-3">
          <span className="material-symbols-outlined text-xl">lock</span>
          {lang === "VN" ? "Bạn cần đăng nhập trước khi chọn ghế và đặt vé." : "You need to sign in before selecting seats."}
        </div>
      )}

      {(fromWharfName || toWharfName) && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm font-bold text-slate-500 dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-300">
          {isLoopRoute ? (
            <>
              {lang === "VN" ? "Tour tham quan tại" : "Sightseeing tour at"}
              <span className="uppercase text-[#124757] dark:text-yellow-400">{fromWharfName || toWharfName || "--"}</span>
            </>
          ) : (
            <>
              {lang === "VN" ? "Tìm kiếm từ bến" : "Searching from"}
              <span className="uppercase text-yellow-400">{fromWharfName || "--"}</span>
              {lang === "VN" ? "đến bến" : "to"}
              <span className="uppercase text-yellow-400">{toWharfName || "--"}</span>
            </>
          )}
          {(activeLeg === "departure" ? departureDate : returnDate) && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="uppercase text-yellow-400">
                {(() => {
                  const raw = activeLeg === "departure" ? departureDate : returnDate;
                  const m = String(raw || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
                  if (!m) return raw;
                  return lang === "VN" ? `${m[3]}/${m[2]}/${m[1]}` : `${m[2]}/${m[3]}/${m[1]}`;
                })()}
              </span>
            </>
          )}
        </div>
      )}

      {filteredTripOptions.length > 0
        && filteredTripOptions.every((trip) => !isTripBookable(trip))
        && filteredTripOptions.some((trip) => isMissingKmBookingBlock(trip)) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {(() => {
              const sample = filteredTripOptions.find((trip) => isMissingKmBookingBlock(trip));
              const reason = pickBookingClosedReason(sample);
              if (reason) return reason;
              return lang === "VN"
                ? "Tuyến chưa nhập đủ số km cho chặng này. Bạn vẫn xem được chuyến, nhưng chưa đặt/thanh toán được cho đến khi admin cập nhật km."
                : "This route is missing segment km. You can view trips, but booking/checkout stays blocked until admin updates distances.";
            })()}
          </div>
        )}

      {/* --- BỐ CỤC CHÍNH ĐƯỢC CHIA ĐÔI: TRÁI CHỌN TUYẾN - PHẢI CHỌN GHẾ --- */}
      {roundTripSeatCountMismatch && (
        <p className="text-xs font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-3">
          {lang === "VN"
            ? `Số ghế chiều đi (${selectedSeatsDeparture.length}) và chiều về (${selectedSeatsReturn.length}) phải bằng nhau.`
            : `Departure seat count (${selectedSeatsDeparture.length}) and return seat count (${selectedSeatsReturn.length}) must match.`}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* CỘT TRÁI (Tỷ lệ 5/12): DANH SÁCH CHUYẾN TÀU CHẠY TRONG NGÀY (dữ liệu thật từ API tìm chuyến) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm flex flex-wrap justify-between items-center gap-3">
            <h3 className="shrink-0 text-lg font-headline font-bold text-[#124757] dark:text-white">
              {isLoopRoute
                ? (lang === "VN" ? "Chuyến tham quan" : "Sightseeing Trip")
                : activeLeg === "departure"
                  ? (lang === "VN" ? "Chuyến đi" : "Departure")
                  : (lang === "VN" ? "Chuyến về" : "Return")}
            </h3>
            <div className="flex items-center gap-2">
              <FormSelect
                value={filterTime}
                onChange={setFilterTime}
                options={lang === "VN" ? TIME_FILTER_OPTIONS_VN : TIME_FILTER_OPTIONS_EN}
                className={timeFilterClassName}
                fullWidth={false}
              />
              <FormSelect
                value={sortOrder}
                onChange={setSortOrder}
                options={lang === "VN" ? SORT_ORDER_OPTIONS_VN : SORT_ORDER_OPTIONS_EN}
                className={timeFilterClassName}
                fullWidth={false}
              />
            </div>
          </div>

          <div className="space-y-3.5">
            {filteredTripOptions.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm font-medium bg-white dark:bg-slate-800 rounded-2xl border border-dashed">
                {lang === "VN" ? "Không có chuyến nào trong khung giờ này." : "No trips available for this time range."}
              </div>
            )}
            {filteredTripOptions.map((trip) => {
              const bookable = isTripBookable(trip);
              const inspectable = canInspectTrip(trip);
              const missingKm = isMissingKmBookingBlock(trip);
              const fareAdjLabel = formatFareAdjustmentLabel(trip.fareAdjustment, lang);
              return (
                <div
                  key={trip.tripId}
                  onClick={() => handleSelectTrip(trip)}
                  className={`relative bg-white dark:bg-slate-800 p-5 rounded-2xl border shadow-sm transition-all space-y-3 ${currentTrip?.tripId === trip.tripId
                      ? "border-[#124757] ring-2 ring-[#124757]/10 bg-teal-50/5"
                      : "border-slate-100 dark:border-slate-700 hover:border-slate-300"
                    } ${inspectable ? "cursor-pointer" : "opacity-50 cursor-not-allowed"} ${missingKm && inspectable ? "opacity-95" : ""}`}
                >
                  {/* Nút xem chi tiết chuyến — mở modal, không kích hoạt chọn chuyến của card */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailTrip(trip);
                    }}
                    title={lang === "VN" ? "Xem chi tiết chuyến" : "View trip details"}
                    aria-label={lang === "VN" ? "Xem chi tiết chuyến" : "View trip details"}
                    className="absolute top-1/2 -translate-y-1/2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">info</span>
                  </button>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-4">
                      <ImageWithFallback
                        src={resolveTripCardImage(trip, boatImageById)}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-xl overflow-hidden"
                        iconClassName="w-1/2 h-1/2"
                      />
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 pb-3">
                          <span className="text-2xl font-headline font-black text-[#124757] dark:text-white">{formatTripTime(getSegmentDeparture(trip))}</span>
                          <span className="relative inline-flex shrink-0 items-center justify-center">
                            <span className="material-symbols-outlined text-base text-[#FFD100]">arrow_forward</span>
                            <span className="absolute top-full left-1/2 mt-0.5 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-slate-400">{formatTripDuration(getSegmentDeparture(trip), getSegmentArrival(trip), lang)}</span>
                          </span>
                          <span className="text-2xl font-headline font-black text-[#124757] dark:text-white">{formatTripTime(getSegmentArrival(trip))}</span>
                        </div>
                        {fareAdjLabel ? (
                          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                            {fareAdjLabel}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto pr-8">
                      <div className="text-right">
                        {/* BE: card chuyến show minPrice dạng "từ 9.000đ" — null khi thiếu km (không ẩn trip). */}
                        <div className={`text-base font-headline font-black ${(trip.effectivePrice ?? trip.minPrice) == null || missingKm
                            ? "text-rose-600 dark:text-rose-300"
                            : "text-[#124757] dark:text-[#FFD100]"
                          }`}>
                          {(trip.effectivePrice ?? trip.minPrice) != null && Number.isFinite(Number(trip.effectivePrice ?? trip.minPrice)) && !missingKm ? (
                            <>
                              <span className="text-xs font-bold text-slate-400 mr-1">{lang === "VN" ? "từ" : "from"}</span>
                              {formatMinPriceLabel(trip.effectivePrice ?? trip.minPrice, lang)}
                            </>
                          ) : (
                            formatMinPriceLabel(null, lang)
                          )}
                        </div>
                        <div className={`text-xs max-w-44 sm:max-w-52 ${bookable ? "text-slate-500 whitespace-nowrap" : "text-rose-600 dark:text-rose-300 font-semibold leading-snug"
                          }`}>
                          {bookable
                            ? (lang === "VN" ? `Còn trống ${trip.availableSeats}/${trip.totalSeats} chỗ` : `${trip.availableSeats}/${trip.totalSeats} left`)
                            : getTripUnavailableShortLabel(trip, lang)}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${currentTrip?.tripId === trip.tripId ? "border-[#124757] dark:border-[#FFD100]" : "border-slate-300"
                        }`}>
                        {currentTrip?.tripId === trip.tripId && <div className="w-2.5 h-2.5 rounded-full bg-[#124757] dark:bg-[#FFD100]"></div>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CỘT PHẢI (Tỷ lệ 7/12): SƠ ĐỒ GHẾ NGỒI DẠNG THÂN TÀU — cùng phong cách với trang Seat Layout Editor */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-4xl shadow-sm border border-slate-100 dark:border-slate-700/50 space-y-5">
          <div className="border-b pb-4">
            <h4 className="font-headline font-bold text-base text-[#124757] dark:text-white">
              {lang === "VN" ? "Sơ đồ ghế ngồi" : "Seat Map"}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              {currentTrip
                ? (lang === "VN" ? `Đã chọn: ${currentSeats.length} ghế (tối đa ${MAX_SEATS_PER_LEG})` : `Selected: ${currentSeats.length} seats (max ${MAX_SEATS_PER_LEG})`)
                : (lang === "VN" ? "Vui lòng chọn một chuyến tàu ở bên trái trước" : "Please choose a voyage list first")}
            </p>
            {currentTrip && !isLoopRoute ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold">
                <span className={isCurrentMissingKm ? "text-rose-600 dark:text-rose-300" : "text-slate-600 dark:text-slate-300"}>
                  {formatSegmentDistanceLabel(currentSegmentKm, lang)}
                </span>
                {currentFareAdjLabel ? (
                  <span className="text-amber-700 dark:text-amber-300">{currentFareAdjLabel}</span>
                ) : null}
              </div>
            ) : null}
            {currentTrip && !isLoopRoute ? (
              <p className="mt-2 text-[11px] font-bold italic text-rose-600 dark:text-rose-400">
                {lang === "VN"
                  ? "Giá vé sẽ thay đổi tùy thuộc vào bến khởi hành, điểm đến và thời điểm đặt vé. Vé đặc biệt (trẻ em / người lớn tuổi / người khuyết tật): MIỄN PHÍ. Em bé dưới 2 tuổi: MIỄN PHÍ, không chiếm ghế riêng, đi kèm 1 hành khách người lớn."
                  : "Ticket price varies depending on the departure station, destination (distance) and time of booking. Special tickets (children / seniors / disabled): FREE. Infants under 2 years old: FREE, no separate seat, must accompany an adult passenger."}
              </p>
            ) : null}
          </div>

          {seatMapError && (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-3">
              {seatMapError}
            </p>
          )}

          {isCurrentMissingKm && currentTrip && (
            <p className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl px-4 py-3">
              {lang === "VN"
                ? "Thiếu quãng đường chặng (segmentDistanceKm). Không thể đặt vé cho chặng này."
                : "Missing segment distance (segmentDistanceKm). Booking is blocked for this segment."}
            </p>
          )}

          {isCurrentBookingClosed && currentTrip && !isCurrentMissingKm && (
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3">
              {lang === "VN"
                ? "Chặng này đã khóa đặt ghế. Không thể chọn ghế — hãy chọn chuyến khác hoặc đổi bến lên."
                : "This segment is closed for seat booking. Pick another trip or change boarding station."}
            </p>
          )}

          {/* Công cụ tính giá — cập nhật ngay khi chọn/bỏ chọn ghế */}
          {currentSeats.length > 0 && (
            <div className="rounded-2xl border border-[#FFD100]/40 bg-[#FFD100]/10 dark:bg-yellow-400/10 dark:border-yellow-400/20 p-4 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-headline font-bold uppercase tracking-wide text-[#124757] dark:text-yellow-300">
                  {lang === "VN" ? "Ghế đã chọn" : "Selected seats"}
                </h5>
                <span className="text-xs font-bold text-slate-500">{currentSeats.length}/{MAX_SEATS_PER_LEG}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentSeats.map((seat) => (
                  <span
                    key={seat.seatNumber}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {seat.seatNumber}
                    <span className="text-[#124757] dark:text-yellow-400">
                      {Number(seat.effectivePrice || seat.basePrice || 0).toLocaleString()}₫
                    </span>
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-[#FFD100]/30 pt-2.5 dark:border-yellow-400/20">
                <span className="text-xs font-bold uppercase text-slate-500">
                  {lang === "VN" ? "Tạm tính" : "Subtotal"}
                </span>
                <span className="text-lg font-headline font-black text-[#124757] dark:text-yellow-400">
                  {currentSeats.reduce((sum, s) => sum + Number(s.effectivePrice || s.basePrice || 0), 0).toLocaleString()} VND
                </span>
              </div>
            </div>
          )}

          {isLoadingSeats ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
          ) : currentTrip ? (
            <div className="space-y-5 animate-fade-in">
              {/* Chú thích trạng thái ghế */}
              <div className="flex flex-wrap justify-center gap-4 text-[11px] font-bold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-6 w-5"><SeatMapIcon tone="standard" showLabel={false} /></span>
                  {lang === "VN" ? "Trống" : "Free"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-6 w-5"><SeatMapIcon tone="standard" selected showLabel={false} /></span>
                  {lang === "VN" ? "Đang chọn" : "Selected"}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-6 w-5"><SeatMapIcon disabled showLabel={false} /></span>
                  {lang === "VN" ? "Đã có khách" : "Occupied"}
                </div>
                {seatTypesInMap.map(([code]) => (
                  <div key={code} className="flex items-center gap-1.5">
                    <span className="inline-block h-6 w-5"><SeatMapIcon tone={seatToneFromCode(code)} showLabel={false} /></span>
                    {code}
                  </div>
                ))}
              </div>

              {deckLayout.length > 1 && (
                <div className="flex justify-center gap-2">
                  {deckLayout.map((deck) => (
                    <button
                      key={deck.deckNumber}
                      type="button"
                      onClick={() => setActiveDeckByLeg((prev) => ({ ...prev, [activeLeg]: deck.deckNumber }))}
                      className={`rounded-xl px-4 py-1.5 text-[10px] font-headline font-black uppercase tracking-widest transition ${activeDeckNumber === deck.deckNumber
                          ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                          : "border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        }`}
                    >
                      {lang === "VN" ? `Tầng ${deck.deckNumber}` : `Deck ${deck.deckNumber}`}
                    </button>
                  ))}
                </div>
              )}

              {/* Mô phỏng thân tàu — cùng kiểu dáng với trang quản lý sơ đồ ghế (Seat Layout Editor) */}
              <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900 md:p-6">
                {activeDeckData && activeDeckData.seats.length > 0 ? (
                  <div className="flex flex-col items-center min-w-max mx-auto">
                    <div className={`relative flex min-w-max flex-col items-center overflow-visible rounded-t-[12rem] rounded-b-[3rem] border-8 border-slate-300 bg-slate-100 px-8 pb-10 shadow-xl dark:border-slate-600 dark:bg-slate-900/80 md:px-14 ${activeDeckData.deckNumber === 1 ? "pt-14" : "pt-8"}`}>
                      {activeDeckData.deckNumber === 1 ? (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2">
                          <BoatBowLabel lang={lang} />
                        </div>
                      ) : null}

                      <div
                        className="relative z-10 mx-auto grid gap-2 overflow-visible p-2 md:gap-2.5"
                        style={{
                          gridTemplateColumns: `repeat(${activeDeckData.columnCount}, minmax(40px, 48px))`,
                          gridTemplateRows: `repeat(${activeDeckData.rowCount}, minmax(44px, 52px))`,
                        }}
                      >
                        {activeDeckData.seats.map((seat) => {
                          const isSelected = currentSeats.some((s) => s.seatNumber === seat.seatNumber);
                          const isLockedByOthers = LOCKED_STATUSES.includes(seat.status) && !isSelected;
                          const seatBlocked = isLockedByOthers || isCurrentBookingClosed || isCurrentMissingKm;
                          const seatStatusLabel = isLockedByOthers
                            ? (lang === "VN" ? "Đã có khách" : "Occupied")
                            : isCurrentMissingKm
                              ? (lang === "VN" ? "Thiếu km chặng" : "Missing segment km")
                              : isCurrentBookingClosed
                                ? (lang === "VN" ? "Chặng đã khóa" : "Segment closed")
                                : isSelected
                                  ? (lang === "VN" ? "Đang chọn" : "Selected")
                                  : (lang === "VN" ? "Chỗ trống" : "Available");
                          return (
                            <button
                              key={seat.seatNumber}
                              type="button"
                              disabled={seatBlocked}
                              onClick={() => handleSeatClick(seat)}
                              className={`group relative z-1 flex items-center justify-center rounded-lg transition-all ${seatBlocked ? "cursor-not-allowed opacity-70" :
                                  isSelected ? "scale-95 ring-2 ring-[#124757]/25 dark:ring-yellow-400/40 rounded-xl" :
                                    "hover:scale-105"
                                }`}
                              style={{ gridRow: rowLetterToIndex(seat.row), gridColumn: seat.column }}
                            >
                              {/* Tooltip giá ghế — hiện khi di chuột vào, không cản thao tác click */}
                              <div className="pointer-events-none absolute -top-1.5 left-1/2 z-30 -translate-x-1/2 -translate-y-full opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150">
                                <div className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-center shadow-lg dark:border-slate-600 dark:bg-slate-800">
                                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                                    {seatStatusLabel}
                                  </div>
                                  <div className="text-sm font-headline font-black text-[#124757] dark:text-yellow-400">
                                    {lang === "VN" ? "Giá" : "Price"}: {Number(seat.effectivePrice || seat.basePrice || 0).toLocaleString()} {lang === "VN" ? "VNĐ" : "VND"}
                                  </div>
                                </div>
                                <div className="mx-auto -mt-1 h-2 w-2 rotate-45 border-b border-r border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800" />
                              </div>

                              <SeatMapIcon
                                label={seat.seatNumber}
                                tone={seatToneFromCode(seat.seatTypeCode)}
                                disabled={seatBlocked}
                                selected={isSelected}
                                className="w-[92%] h-[92%]"
                              />
                            </button>
                          );
                        })}
                      </div>

                      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center opacity-60">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                          {lang === "VN" ? "Đuôi tàu" : "Stern"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-400 py-10">
                    {lang === "VN" ? "Chuyến này chưa có sơ đồ ghế." : "No seat map available for this trip."}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-4 border border-dashed rounded-2xl bg-slate-50/50 text-slate-400 text-xs gap-2">
              <p>{lang === "VN" ? "Vui lòng click chọn chuyến tàu mong muốn để hiển thị sơ đồ khoang ghế ngồi tương ứng." : "Please click on a voyage to unlock cabin layouts grid."}</p>
            </div>
          )}
        </div>

      </div>

      {/* --- NÚT ĐIỀU HƯỚNG CHUYỂN BƯỚC DƯỚI CÙNG ---
          Dán cố định (sticky) ở đáy khung nhìn khi cuộn — danh sách chuyến bên trái có thể dài,
          tránh việc phải kéo hết xuống cuối trang mới thấy nút chuyển bước. */}
      <div className="sticky bottom-0 z-30 -mx-4 px-4 pt-4 pb-4 md:-mx-8 md:px-8 md:pt-6 rounded-t-3xl border border-b-0 border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-[0_-8px_20px_-12px_rgba(15,23,42,0.15)] dark:shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.4)] flex justify-between">
        <button type="button" onClick={handleBack} className="border px-6 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800">
          {leaveTarget === "home"
            ? (lang === "VN" ? "Thoát" : "Leave")
            : (lang === "VN" ? "Quay lại" : "Back")}
        </button>

        {/* Nút hỗ trợ chuyển tab phụ thông minh cho vé khứ hồi trước khi cho bấm sang bước checkout */}
        {isRoundTrip && activeLeg === "departure" && selectedDepartureTrip && selectedSeatsDeparture.length > 0
          && isTripBookable(selectedDepartureTrip)
          && !bookingClosedByLeg.departure
          && legHasSegmentKm("departure", selectedDepartureTrip) ? (
          <button
            type="button"
            onClick={() => setActiveLeg("return")}
            className="bg-[#124757] text-white font-headline font-bold px-8 py-3 rounded-xl text-sm shadow-md hover:opacity-90 transition-all flex items-center gap-2"
          >
            {lang === "VN" ? "Chọn tiếp Chuyến Về" : "Proceed to Return Leg"}
            <span className="material-symbols-outlined text-base">arrow_right_alt</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={!isStepComplete || isConfirmingSeats}
            onClick={handleContinueToCheckout}
            className="bg-[#124757] text-white font-headline font-bold px-8 py-3 rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isConfirmingSeats && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>}
            {isConfirmingSeats
              ? (lang === "VN" ? "Đang giữ ghế..." : "Holding seats...")
              : (lang === "VN" ? "Tiếp tục thanh toán" : "Continue to Checkout")}
          </button>
        )}
      </div>

      <TripDetailModal
        trip={detailTrip}
        onClose={() => setDetailTrip(null)}
        lang={lang}
        isLoopRoute={isLoopRoute}
        legFromWharfName={legFromWharfName}
        legToWharfName={legToWharfName}
        boatImageById={boatImageById}
        boatNameById={boatNameById}
        canFetchBoatDetail={isAuthenticated}
      />

    </div>
  );
}
