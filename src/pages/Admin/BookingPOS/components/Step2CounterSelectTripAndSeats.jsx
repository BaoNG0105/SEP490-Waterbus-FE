import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../../context/AppContext";
//component
import { FormSelect } from "../../../../components/FormSelect";
import { SeatMapIcon, seatToneFromCode } from "../../../../components/SeatMapIcon";
import { BoatBowLabel } from "../../../../components/ShipWheelIcon";
//api
import { fetchTripDetail, fetchTripSeatMap, holdSeats, releaseSeats } from "../../../../services/tripService";
//toast
import { notify, showToast } from "../../../../utils/swalToast";
//utils
import {
  bookingHasSeatSelection,
  clearSeatSelectionFields,
  confirmLeaveSeatSelection,
} from "../../../../utils/bookingWizardGuard";
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
} from "../../../../utils/bookingFareMessages";
import {
  pickStopDisplayArrival,
  pickStopDisplayDeparture,
  pickStopScheduledArrival,
  pickStopScheduledDeparture,
} from "../../../../utils/tripStopTimes";

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

const getSegmentDeparture = (trip) => trip?.fromStopScheduledDeparture || trip?.departureTime;
const getSegmentArrival = (trip) => trip?.toStopScheduledArrival || trip?.arrivalTime;

const SEGMENT_BOOKING_CLOSE_LEAD_MS = 10 * 60 * 1000;
const isSegmentBookingClosed = (trip) => {
  const raw = trip?.fromStopScheduledDeparture;
  if (!raw) return false;
  const ms = new Date(raw).getTime();
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now() + SEGMENT_BOOKING_CLOSE_LEAD_MS;
};

const isTripBookable = (trip) => {
  if (!trip) return false;
  if (Number(trip.availableSeats) <= 0) return false;
  if (isMissingKmBookingBlock(trip)) return false;
  if (typeof trip.isBookable === "boolean") return trip.isBookable;
  return !isSegmentBookingClosed(trip);
};

const canInspectTrip = (trip) => {
  if (!trip) return false;
  if (Number(trip.availableSeats) <= 0) return false;
  if (trip.isBookingClosed === true) return false;
  if (isMissingKmBookingBlock(trip)) return true;
  if (typeof trip.isBookable === "boolean") return trip.isBookable;
  return !isSegmentBookingClosed(trip);
};

const getTripUnavailableLabel = (trip, lang) => formatBookingClosedMessage(trip, lang);
const getTripUnavailableShortLabel = (trip, lang) => formatTripUnavailableShortLabel(trip, lang);

const rowLetterToIndex = (row) => {
  const letter = String(row || "A").toUpperCase();
  const code = letter.charCodeAt(letter.length - 1) - 64;
  return code > 0 ? code : 1;
};

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

const findStop = (stops, stationId) => {
  if (!Array.isArray(stops) || !stationId) return null;
  return stops.find((s) => String(s.stationId) === String(stationId)) || null;
};

const pickStopOrder = (stop) => Number(stop?.stopOrder ?? stop?.order ?? 0);

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
    return { boarding: findStop(stops, fromStationId), alighting: findStop(stops, toStationId) };
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
  const open = candidates.find((pair) => !isSegmentBookingClosed({
    fromStopScheduledDeparture: pickStopScheduledDeparture(pair.boarding) || pair.boarding?.plannedDepartureTime,
  }));
  return open || candidates[0];
};

const resolveSeatMapBookingClosed = (seatMapResponse, trip) => {
  if (typeof seatMapResponse?.isBookingClosed === "boolean") return seatMapResponse.isBookingClosed;
  if (typeof trip?.isBookable === "boolean") return !trip.isBookable;
  return isSegmentBookingClosed(trip);
};

export default function Step2CounterSelectTripAndSeats({
  bookingData,
  updateData,
  onNext,
  onBack,
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

  const isLoopRoute = routeType === "SightseeingLoop";

  const getLegStationCodes = (leg) => {
    if (isLoopRoute) return { fromStationCode: undefined, toStationCode: undefined };
    if (leg === "departure") {
      return { fromStationCode: fromWharfCode || "", toStationCode: toWharfCode || "" };
    }
    return { fromStationCode: toWharfCode || "", toStationCode: fromWharfCode || "" };
  };

  const [activeLeg, setActiveLeg] = useState("departure");
  const [filterTime, setFilterTime] = useState("all");
  const [sortOrder, setSortOrder] = useState("earliest");

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
  // POS: thẻ chuyến vừa bấm — hiện spinner ngay trên thẻ đó trong lúc tải sơ đồ ghế,
  // trước khi currentTrip (theo activeLeg) thực sự trỏ sang chuyến này.
  const [pendingTripId, setPendingTripId] = useState("");
  // POS: chuyến nào đang dropdown sơ đồ ghế — tách khỏi currentTrip (chuyến đã chọn để đặt)
  // để bấm lại thẻ đang chọn có thể đóng dropdown mà KHÔNG bỏ chọn chuyến/ghế đã lưu.
  const [expandedTripId, setExpandedTripId] = useState("");
  const autoSelectKeyRef = useRef("");

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
            updateData({ selectedDepartureTrip: { ...trip, segmentDistanceKm: meta.segmentDistanceKm, fareAdjustment: meta.fareAdjustment } });
          } else {
            updateData({ selectedReturnTrip: { ...trip, segmentDistanceKm: meta.segmentDistanceKm, fareAdjustment: meta.fareAdjustment } });
          }
        }));
      } catch (error) {
        if (!cancelled) {
          console.error("Lỗi khi tải lại sơ đồ ghế:", error);
          setSeatMapError(lang === "VN" ? "Không thể tải lại sơ đồ ghế. Vui lòng chọn lại chuyến." : "Unable to reload the seat map. Please reselect the trip.");
        }
      } finally {
        if (!cancelled) setIsLoadingSeats(false);
      }
    };

    hydrate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromWharf, toWharf, fromWharfCode, toWharfCode]);

  const tripOptions = activeLeg === "departure" ? departureTripOptions : returnTripOptions;
  const currentTrip = activeLeg === "departure" ? selectedDepartureTrip : selectedReturnTrip;
  const currentSeats = activeLeg === "departure" ? selectedSeatsDeparture : selectedSeatsReturn;
  const currentSeatMap = seatMapByLeg[activeLeg];
  const isCurrentBookingClosed = Boolean(bookingClosedByLeg[activeLeg]);

  const resolveLegSegmentKm = (leg, trip) => (seatMapMetaByLeg[leg]?.segmentDistanceKm ?? pickSegmentDistanceKm(trip));
  const legHasSegmentKm = (leg, trip) => (isLoopRoute || resolveLegSegmentKm(leg, trip) != null);
  const currentSeatMapMeta = seatMapMetaByLeg[activeLeg] || {};
  const currentSegmentKm = resolveLegSegmentKm(activeLeg, currentTrip);
  const currentFareAdjLabel = formatFareAdjustmentLabel(currentSeatMapMeta.fareAdjustment ?? currentTrip?.fareAdjustment, lang);
  const isCurrentMissingKm = Boolean(currentTrip) && !isLoopRoute && (currentSegmentKm == null || isMissingKmBookingBlock(currentTrip));

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

      const boardingStationId = activeLeg === "departure" ? fromWharf : toWharf;
      const alightingStationId = activeLeg === "departure" ? toWharf : fromWharf;
      const preferredDep = trip.fromStopScheduledDeparture || trip.departureTime;
      const { boarding: boardingStop, alighting: alightingStop } = findSegmentStops(stops, boardingStationId, alightingStationId, preferredDep);

      const mergedTrip = {
        ...trip,
        stops,
        fromStopScheduledDeparture: pickStopDisplayDeparture(boardingStop) || pickStopScheduledDeparture(boardingStop) || trip.fromStopScheduledDeparture || trip.departureTime,
        toStopScheduledArrival: pickStopDisplayArrival(alightingStop) || pickStopScheduledArrival(alightingStop) || trip.toStopScheduledArrival || trip.arrivalTime,
      };
      const { fromStationCode, toStationCode } = getLegStationCodes(activeLeg);

      if (!isLoopRoute && (!fromStationCode || !toStationCode)) {
        setSeatMapError(lang === "VN" ? "Không xác định được mã bến đón/trả trên chuyến này. Vui lòng chọn chuyến khác." : "Unable to resolve the pickup/drop-off station codes for this trip. Please pick another trip.");
        return;
      }

      const seatMapResponse = await fetchTripSeatMap(trip.tripId, { fromStationCode, toStationCode });
      const segmentDistanceKm = pickSegmentDistanceKm(seatMapResponse);
      const fareAdjustment = seatMapResponse?.fareAdjustment ?? seatMapResponse?.FareAdjustment ?? trip?.fareAdjustment ?? null;
      const tripWithFare = {
        ...mergedTrip,
        segmentDistanceKm,
        fareAdjustment,
        minPrice: seatMapResponse?.minPrice ?? mergedTrip.minPrice,
        isBookable: seatMapResponse?.isBookable ?? mergedTrip.isBookable,
        bookingClosedReason: seatMapResponse?.bookingClosedReason || mergedTrip?.bookingClosedReason,
        isBookingClosed: seatMapResponse?.isBookingClosed ?? mergedTrip?.isBookingClosed,
      };
      const missingKm = !isLoopRoute && (segmentDistanceKm == null || isMissingKmBookingBlock(tripWithFare));
      const closedBySchedule = resolveSeatMapBookingClosed(seatMapResponse, tripWithFare) && !missingKm;
      setSeatMapByLeg((prev) => ({ ...prev, [activeLeg]: seatMapResponse?.seats || [] }));
      setSeatMapMetaByLeg((prev) => ({ ...prev, [activeLeg]: { segmentDistanceKm, fareAdjustment } }));
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
            ? (pickBookingClosedReason(reasonPayload) || formatMissingKmTripBadge(lang))
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
      const detail = typeof apiMsg === "string" ? apiMsg : (apiMsg?.bookingClosedReason || apiMsg?.detail || apiMsg?.message || apiMsg?.title || "");
      const reasonPayload = { bookingClosedReason: detail, isBookingClosed: false, isBookable: false, minPrice: apiMsg?.minPrice ?? null, validationMessage: detail };
      if (isMissingKmBookingBlock(reasonPayload) || looksLikeMissingKm(detail)) {
        if (activeLeg === "departure") {
          updateData({ selectedDepartureTrip: { ...trip, minPrice: null, isBookable: false, bookingClosedReason: detail || formatMissingKmTripBadge(lang) }, selectedSeatsDeparture: [] });
        } else {
          updateData({ selectedReturnTrip: { ...trip, minPrice: null, isBookable: false, bookingClosedReason: detail || formatMissingKmTripBadge(lang) }, selectedSeatsReturn: [] });
        }
        setBookingClosedByLeg((prev) => ({ ...prev, [activeLeg]: false }));
        setSeatMapByLeg((prev) => ({ ...prev, [activeLeg]: [] }));
        setSeatMapError(detail || formatMissingKmTripBadge(lang));
      } else {
        setSeatMapError(lang === "VN" ? "Không thể tải sơ đồ ghế cho chuyến này. Vui lòng thử lại." : "Unable to load the seat map for this trip. Please try again.");
      }
    } finally {
      setIsLoadingSeats(false);
    }
  };

  const handleCardClick = async (trip) => {
    if (currentTrip?.tripId === trip.tripId) {
      setExpandedTripId((prev) => (prev === trip.tripId ? "" : trip.tripId));
      return;
    }
    setExpandedTripId(trip.tripId);
    setPendingTripId(trip.tripId);
    try {
      await handleSelectTrip(trip);
    } finally {
      setPendingTripId("");
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    if (currentTrip?.tripId) return;

    const firstAvailable = filteredTripOptions.find((trip) => isTripBookable(trip));
    if (!firstAvailable?.tripId) return;

    const key = `${activeLeg}:${firstAvailable.tripId}:${filterTime}:${sortOrder}`;
    if (autoSelectKeyRef.current === key) return;
    autoSelectKeyRef.current = key;
    setExpandedTripId(firstAvailable.tripId);
    handleSelectTrip(firstAvailable, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeg, filterTime, sortOrder, isAuthenticated, filteredTripOptions.length, currentTrip?.tripId]);

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
          ? (lang === "VN" ? "Chưa có segmentDistanceKm từ seat-map — không thể đặt vé." : "segmentDistanceKm is missing from seat-map — booking is blocked.")
          : (lang === "VN" ? "Không thể chọn ghế vì chặng đã đóng đặt vé." : "Seats cannot be selected because this segment is closed."),
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
    selectedDepartureTrip, selectedReturnTrip, selectedSeatsDeparture, selectedSeatsReturn,
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

      const expiries = [departureHold?.holdExpiresAt, returnExpiresAt].filter(Boolean).map((d) => new Date(d).getTime());
      const seatHoldExpiresAt = expiries.length ? new Date(Math.min(...expiries)).toISOString() : null;

      updateData({ seatHoldExpiresAt });
      onNext();
    } catch (error) {
      console.error("Lỗi khi giữ ghế:", error);
      setSeatMapError(lang === "VN" ? "Không thể giữ ghế đã chọn. Vui lòng thử lại." : "Unable to hold the selected seats. Please try again.");
    } finally {
      setIsConfirmingSeats(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* --- SUB-TABS CHIỀU ĐI/VỀ (POS: nút to, rõ, chỉ hiện khi khứ hồi) --- */}
      {isRoundTrip && (
        <div className="mx-auto flex max-w-md gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveLeg("departure")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-headline font-black uppercase tracking-wide transition-all ${activeLeg === "departure"
              ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
              : "text-slate-500 dark:text-slate-400"
              }`}
          >
            {lang === "VN" ? "Chiều đi" : "Departure"}
          </button>
          <button
            type="button"
            onClick={() => setActiveLeg("return")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-headline font-black uppercase tracking-wide transition-all ${activeLeg === "return"
              ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
              : "text-slate-500 dark:text-slate-400"
              }`}
          >
            {lang === "VN" ? "Chiều về" : "Return"}
          </button>
        </div>
      )}

      {!isAuthenticated && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
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

      {/* DANH SÁCH CHUYẾN — bấm 1 thẻ để dropdown sơ đồ ghế (giữ nguyên) ngay dưới thẻ đó.
          Khung "Tóm tắt đơn" bên phải giờ dùng chung ở cấp Flow (OrderSummaryPanel) cho cả 3 bước. */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <h3 className="shrink-0 font-headline text-base font-bold text-[#124757] dark:text-white">
            {isLoopRoute
              ? (lang === "VN" ? "Chuyến tham quan" : "Sightseeing Trip")
              : activeLeg === "departure"
                ? (lang === "VN" ? "Chuyến đi" : "Departure")
                : (lang === "VN" ? "Chuyến về" : "Return")}
          </h3>
          <div className="flex items-center gap-2">
            <FormSelect value={filterTime} onChange={setFilterTime} options={lang === "VN" ? TIME_FILTER_OPTIONS_VN : TIME_FILTER_OPTIONS_EN} className={timeFilterClassName} fullWidth={false} />
            <FormSelect value={sortOrder} onChange={setSortOrder} options={lang === "VN" ? SORT_ORDER_OPTIONS_VN : SORT_ORDER_OPTIONS_EN} className={timeFilterClassName} fullWidth={false} />
          </div>
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

        <div className="space-y-2.5">
          {filteredTripOptions.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-white py-10 text-center text-sm font-medium text-slate-400 dark:bg-slate-800">
              {lang === "VN" ? "Không có chuyến nào trong khung giờ này." : "No trips available for this time range."}
            </div>
          )}
          {filteredTripOptions.map((trip) => {
            const bookable = isTripBookable(trip);
            const inspectable = canInspectTrip(trip);
            const missingKm = isMissingKmBookingBlock(trip);
            const fareAdjLabel = formatFareAdjustmentLabel(trip.fareAdjustment, lang);
            const isSelected = currentTrip?.tripId === trip.tripId;
            const isExpanded = expandedTripId === trip.tripId;
            const isPending = pendingTripId === trip.tripId && isLoadingSeats;
            return (
              <div
                key={trip.tripId}
                className={`overflow-hidden rounded-2xl border transition-all ${isSelected ? "border-[#124757] shadow-sm dark:border-yellow-400" : "border-slate-100 dark:border-slate-700"}`}
              >
                <button
                  type="button"
                  onClick={() => handleCardClick(trip)}
                  disabled={!inspectable}
                  className={`w-full p-4 text-left transition-colors ${isSelected
                    ? "bg-[#124757]/5 dark:bg-yellow-400/10"
                    : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/40"
                    } ${inspectable ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-headline text-lg font-black tabular-nums text-[#124757] dark:text-white">
                          {formatTripTime(getSegmentDeparture(trip))}
                        </span>
                        <span className="material-symbols-outlined text-sm text-[#FFD100]">arrow_forward</span>
                        <span className="font-headline text-lg font-black tabular-nums text-[#124757] dark:text-white">
                          {formatTripTime(getSegmentArrival(trip))}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{formatTripDuration(getSegmentDeparture(trip), getSegmentArrival(trip), lang)}</span>
                      </div>

                      {fareAdjLabel ? <p className="mt-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">{fareAdjLabel}</p> : null}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className={`font-headline text-sm font-black ${trip.minPrice == null || missingKm ? "text-rose-600 dark:text-rose-300" : "text-[#124757] dark:text-[#FFD100]"}`}>
                        {trip.minPrice != null && Number.isFinite(Number(trip.minPrice)) && !missingKm
                          ? formatMinPriceLabel(trip.minPrice, lang)
                          : formatMinPriceLabel(null, lang)}
                      </p>
                      <p className={`mt-0.5 text-[10px] font-bold ${bookable ? "text-slate-400" : "text-rose-500"}`}>
                        {bookable
                          ? (lang === "VN" ? `${trip.availableSeats}/${trip.totalSeats} chỗ` : `${trip.availableSeats}/${trip.totalSeats} left`)
                          : getTripUnavailableShortLabel(trip, lang)}
                      </p>
                    </div>

                    {isPending ? (
                      <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-[#124757] dark:border-t-yellow-400" />
                    ) : (
                      <span className={`material-symbols-outlined shrink-0 text-xl text-slate-300 transition-transform dark:text-slate-600 ${isExpanded ? "rotate-180 text-[#124757] dark:text-yellow-400" : ""}`}>
                        expand_more
                      </span>
                    )}
                  </div>
                </button>

                {/* --- DROPDOWN SƠ ĐỒ GHẾ — GIỮ NGUYÊN nội dung/logic như bản khách hàng, chỉ chuyển vị trí --- */}
                {isExpanded && (
                  <div className="space-y-5 border-t border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 md:p-5">
                    {currentTrip && !isLoopRoute ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold">
                        <span className={isCurrentMissingKm ? "text-rose-600 dark:text-rose-300" : "text-slate-600 dark:text-slate-300"}>
                          {formatSegmentDistanceLabel(currentSegmentKm, lang)}
                        </span>
                        {currentFareAdjLabel ? <span className="text-amber-700 dark:text-amber-300">{currentFareAdjLabel}</span> : null}
                      </div>
                    ) : null}

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
                                {Number(seat.basePrice || 0).toLocaleString()}₫
                              </span>
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between border-t border-[#FFD100]/30 pt-2.5 dark:border-yellow-400/20">
                          <span className="text-xs font-bold uppercase text-slate-500">
                            {lang === "VN" ? "Tạm tính" : "Subtotal"}
                          </span>
                          <span className="text-lg font-headline font-black text-[#124757] dark:text-yellow-400">
                            {currentSeats.reduce((sum, s) => sum + Number(s.basePrice || 0), 0).toLocaleString()} VND
                          </span>
                        </div>
                      </div>
                    )}

                    {isLoadingSeats ? (
                      <div className="flex h-64 items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400"></div>
                      </div>
                    ) : (
                      <div className="space-y-5 animate-fade-in">
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
                                    const isSeatSelected = currentSeats.some((s) => s.seatNumber === seat.seatNumber);
                                    const isLockedByOthers = LOCKED_STATUSES.includes(seat.status) && !isSeatSelected;
                                    const seatBlocked = isLockedByOthers || isCurrentBookingClosed || isCurrentMissingKm;
                                    const seatStatusLabel = isLockedByOthers
                                      ? (lang === "VN" ? "Đã có khách" : "Occupied")
                                      : isCurrentMissingKm
                                        ? (lang === "VN" ? "Thiếu km chặng" : "Missing segment km")
                                        : isCurrentBookingClosed
                                          ? (lang === "VN" ? "Chặng đã khóa" : "Segment closed")
                                          : isSeatSelected
                                            ? (lang === "VN" ? "Đang chọn" : "Selected")
                                            : (lang === "VN" ? "Chỗ trống" : "Available");
                                    return (
                                      <button
                                        key={seat.seatNumber}
                                        type="button"
                                        disabled={seatBlocked}
                                        onClick={() => handleSeatClick(seat)}
                                        className={`group relative z-1 flex items-center justify-center rounded-lg transition-all ${seatBlocked ? "cursor-not-allowed opacity-70" :
                                          isSeatSelected ? "scale-95 ring-2 ring-[#124757]/25 dark:ring-yellow-400/40 rounded-xl" :
                                            "hover:scale-105"
                                          }`}
                                        style={{ gridRow: rowLetterToIndex(seat.row), gridColumn: seat.column }}
                                      >
                                        <div className="pointer-events-none absolute -top-1.5 left-1/2 z-30 -translate-x-1/2 -translate-y-full opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150">
                                          <div className="whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-center shadow-lg dark:border-slate-600 dark:bg-slate-800">
                                            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                                              {seatStatusLabel}
                                            </div>
                                            <div className="text-sm font-headline font-black text-[#124757] dark:text-yellow-400">
                                              {lang === "VN" ? "Giá" : "Price"}: {Number(seat.basePrice || 0).toLocaleString()} {lang === "VN" ? "VNĐ" : "VND"}
                                            </div>
                                          </div>
                                          <div className="mx-auto -mt-1 h-2 w-2 rotate-45 border-b border-r border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800" />
                                        </div>

                                        <SeatMapIcon
                                          label={seat.seatNumber}
                                          tone={seatToneFromCode(seat.seatTypeCode)}
                                          disabled={seatBlocked}
                                          selected={isSeatSelected}
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
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- NÚT ĐIỀU HƯỚNG CHUYỂN BƯỚC DƯỚI CÙNG --- */}
      <div className="pt-6 border-t flex justify-between">
        <button type="button" onClick={handleBack} className="border px-6 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800">
          {lang === "VN" ? "Quay lại" : "Back"}
        </button>

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

    </div>
  );
}
