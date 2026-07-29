import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { AdminCharterAssignmentPanel } from "../../../components/AdminCharterAssignmentPanel";
import {
  AdminBookingActionsTab,
  AdminBookingOverviewTab,
  AdminBookingTicketsTab,
} from "../../../components/AdminCharterDetailWorkspace";
import { CharterWorkflowStepper } from "../../../components/CharterWorkflowStepper";
import { PageLoading } from "../../../components/PageLoading";
import { useApp } from "../../../context/AppContext";
import { fetchAllBoats, fetchActiveBoatsByServiceType } from "../../../services/boatService";
import {
  fetchAdminCharterBookingDetail,
  fetchAssignedCharterBookingDetail,
  fetchAdminCharterBookingRouteCandidates,
  fetchAdminRentalPricePolicies,
  modifyAdminCharterBookingStatus,
  previewAdminCharterBookingQuote,
  submitAdminCharterBookingQuote,
  createAdminCharterBookingTrip,
  fetchOccupiedBoatIdsForCharterDate,
  requestCharterRouteDraw,
  fetchRouteDrawRequests,
  fetchRouteDrawRequestDetail,
} from "../../../services/charterBookingService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { buildConfirmBodyHtml, showConfirmDialog, showToast, showValidationMessage } from "../../../utils/swalToast";
import { canShowCharterTickets } from "../../../utils/charterBookingTickets";
import {
  bookingNeedsAdminRefundAttention,
  bookingNeedsRefundAttention,
  bookingWaitsCustomerRefundInfo,
  getCharterQuotePaymentDeadline,
  isBookingPaymentClosed,
  shouldShowBookingHoldCountdown,
} from "../../../utils/charterBookingActions";
import { getCharterBookingStatusInfo } from "../../../utils/charterBookingStatus";
import { getCharterCapabilities, shouldUseAssignedCharterApi, getDefaultCharterTab } from "../../../utils/charterBookingAccess";
import { useCharterBookingDetailHub } from "../../../hooks/useCharterBookingDetailHub";
import {
  extractRouteDrawRequestList,
  isActiveRouteDrawStatus,
  normalizeRouteDrawRequest,
  bookingNeedsGpsRouteDraw,
  ROUTE_DRAW_STATUS,
} from "../../../utils/routeDrawRequest";
import {
  buildCharterRoutePlan,
  buildInitialRoutePlanSelections,
  buildQuoteFormFromBooking,
  canAdminHandleRefund,
  enrichAssignedBoat,
  formatCountdown,
  formatDate,
  formatDateTime,
  formatDeckCount,
  formatDuration,
  formatPassengerSummary,
  getBoatDeckCount,
  getBoatId,
  getBoatPrice,
  getBoatSeatCount,
  getBoatSeatSetupType,
  getCharterRoutePricingWarning,
  hasEmptyRouteCandidateLegs,
  hasSelectedRouteCodesForAllLegs,
  isCharterBoatScheduleConflictError,
  isCharterRoutePlanComplete,
  isCharterRoutePricingBlocked,
  isUsableRouteCandidateForBooking,
  getPaymentAmount,
  getPaymentStatusInfo,
  getRefundAmount,
  getRefundMessage,
  getRefundPaymentId,
  getRefundStatusInfo,
  getRemainingMs,
  getRequestedDeckCount,
  getRouteCandidateLegKey,
  hasRefundablePayment,
  isActiveBoat,
  isPaidPayment,
  isRefundDone,
  isRefundFailed,
  isRescueBoat,
  manualStatusOptions,
  normalizeBooking,
  normalizeRequestedBoats,
  normalizeRouteCandidateLegs,
  enrichCandidateLegsWithManualGpsRoutes,
  evaluateCharterTripCreateGate,
  extractTripIdsFromCharterTripCreateResponse,
  getCharterBookingLinkedTripIds,
  paymentWaitsCustomerRefundInfo,
  pick,
  resolveQuoteDepositAmount,
  resolveQuoteDurationValue,
  readAcknowledgedTabBadges,
  acknowledgeTabBadge,
  shouldShowTabBadge,
} from "../../../utils/charterBookingAdmin";
import { fetchCharterSourceRoutes, fetchRouteDetail } from "../../../services/routeService";

export function AdminCharterBookingDetail() {
  const { lang } = useApp();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const useAssignedApi = shouldUseAssignedCharterApi(user);
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [booking, setBooking] = useState(null);
  const [boats, setBoats] = useState([]);
  const [rentalPolicies, setRentalPolicies] = useState([]);
  const [activeTab, setActiveTab] = useState(() => location.state?.tab || "overview");
  const [quoteForm, setQuoteForm] = useState({
    rentalUnit: "Hour",
    boats: [],
  });
  const [routeCandidateLegs, setRouteCandidateLegs] = useState([]);
  const [routePlanSelections, setRoutePlanSelections] = useState({});
  const [routeCandidatesLoaded, setRouteCandidatesLoaded] = useState(false);
  const [gpsCatalogRoutes, setGpsCatalogRoutes] = useState([]);
  const [isRouteCandidatesLoading, setIsRouteCandidatesLoading] = useState(false);
  const [routeCandidatesError, setRouteCandidatesError] = useState("");
  const [quotePreview, setQuotePreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [quotePreviewError, setQuotePreviewError] = useState("");
  const [occupiedBoatIds, setOccupiedBoatIds] = useState([]);
  const [localCreatedTripIds, setLocalCreatedTripIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [acknowledgedBadges, setAcknowledgedBadges] = useState(() => readAcknowledgedTabBadges(id));
  const [routeDrawRequest, setRouteDrawRequest] = useState(null);
  const [isRouteDrawSubmitting, setIsRouteDrawSubmitting] = useState(false);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }),
    []
  );

  const resolveBoatPrice = useCallback(
    (boat, unit) => getBoatPrice(boat, unit, rentalPolicies),
    [rentalPolicies],
  );

  const getStatusInfo = (status, paymentStatus) => getCharterBookingStatusInfo(status, paymentStatus, lang);

  const goToTab = useCallback((tabId, badgeValue) => {
    setActiveTab(tabId);
    if (!badgeValue) return;
    acknowledgeTabBadge(id, tabId, badgeValue);
    setAcknowledgedBadges((prev) => ({ ...prev, [tabId]: String(badgeValue) }));
  }, [id]);

  const loadDetail = useCallback(async ({ silent = false } = {}) => {
    if (!id) return;
    try {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      setLoadError("");
      const fetchDetail = useAssignedApi ? fetchAssignedCharterBookingDetail : fetchAdminCharterBookingDetail;
      const [detail, boatData, rentalPolicyResult] = await Promise.all([
        fetchDetail(id),
        fetchActiveBoatsByServiceType("Passenger").catch(() =>
          fetchAllBoats({ status: "Active" }).catch(() => []),
        ),
        fetchAdminRentalPricePolicies().catch(() => ({ policies: [] })),
      ]);
      const normalized = normalizeBooking(detail);
      setBooking(normalized);
      const embeddedDraw = normalizeRouteDrawRequest(
        normalized.routeDrawRequest || detail?.routeDrawRequest || detail?.latestRouteDrawRequest,
      );
      if (embeddedDraw?.requestId) setRouteDrawRequest(embeddedDraw);
      const boatList = Array.isArray(boatData) ? boatData : (boatData?.items || boatData?.data || []);
      setBoats(boatList.filter((boat) => !isRescueBoat(boat)));
      setRentalPolicies(Array.isArray(rentalPolicyResult?.policies) ? rentalPolicyResult.policies : []);
      setQuoteForm(buildQuoteFormFromBooking(normalized));
      setQuotePreview(null);
      setQuotePreviewError("");
      if (!location.state?.tab && !silent) {
        const caps = getCharterCapabilities(user, normalized);
        let defaultTab = getDefaultCharterTab(normalized, caps);
        if (defaultTab === "actions" && !caps.canQuote) defaultTab = "overview";
        setActiveTab(defaultTab);
      }
    } catch (error) {
      console.error("Lỗi tải chi tiết charter booking:", error);
      if (!silent) {
        setLoadError(getApiErrorMessage(
          error,
          lang === "VN" ? "Không thể tải chi tiết thuê tàu." : "Unable to load booking request detail.",
        ));
      }
    } finally {
      if (silent) setIsRefreshing(false);
      else setIsLoading(false);
    }
  }, [id, lang, location.state?.tab, useAssignedApi, user]);

  const refreshDetailSilently = useCallback(() => {
    loadDetail({ silent: true });
  }, [loadDetail]);

  const loadCandidatesFromHubRef = useRef(() => {});

  const refreshFromHub = useCallback(() => {
    refreshDetailSilently();
    loadCandidatesFromHubRef.current?.();
  }, [refreshDetailSilently]);

  useCharterBookingDetailHub({
    enabled: isAuthenticated && Boolean(id),
    bookingId: id,
    onRefresh: refreshFromHub,
  });

  const resolveRouteDrawForBooking = useCallback(async (bookingId) => {
    if (!bookingId) return null;
    const statuses = [
      ROUTE_DRAW_STATUS.PENDING,
      ROUTE_DRAW_STATUS.IN_PROGRESS,
      ROUTE_DRAW_STATUS.DONE,
      ROUTE_DRAW_STATUS.CANCELLED,
    ];
    for (const status of statuses) {
      try {
        const payload = await fetchRouteDrawRequests({ status });
        const match = extractRouteDrawRequestList(payload)
          .map((item) => normalizeRouteDrawRequest(item))
          .find((item) => item && String(item.bookingId) === String(bookingId));
        if (match) return match;
      } catch {
        // status filter có thể không hỗ trợ — bỏ qua
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (!id || useAssignedApi) return undefined;
    let cancelled = false;
    (async () => {
      if (routeDrawRequest?.requestId) return;
      const found = await resolveRouteDrawForBooking(id);
      if (!cancelled && found) setRouteDrawRequest(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, resolveRouteDrawForBooking, routeDrawRequest?.requestId, useAssignedApi]);

  // Poll request / booking khi GPS đang xử lý.
  useEffect(() => {
    if (!id) return undefined;
    const requestId = routeDrawRequest?.requestId;
    const status = routeDrawRequest?.status;
    if (!isActiveRouteDrawStatus(status)) return undefined;

    let cancelled = false;
    const tick = async () => {
      try {
        let next = null;
        if (requestId) {
          const raw = await fetchRouteDrawRequestDetail(requestId);
          next = normalizeRouteDrawRequest(raw);
          if (!cancelled && next) setRouteDrawRequest(next);
        } else if (!useAssignedApi) {
          next = await resolveRouteDrawForBooking(id);
          if (!cancelled && next) setRouteDrawRequest(next);
        }

        if (!cancelled && next?.status === ROUTE_DRAW_STATUS.DONE) {
          await loadDetail({ silent: true });
        }
      } catch (error) {
        console.error("Poll route-draw request failed:", error);
      }
    };

    const timer = setInterval(tick, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    id,
    loadDetail,
    resolveRouteDrawForBooking,
    routeDrawRequest?.requestId,
    routeDrawRequest?.status,
    useAssignedApi,
  ]);

  const handleRequestRouteDraw = useCallback(async () => {
    if (!id || !bookingNeedsGpsRouteDraw(booking)) return;
    try {
      setIsRouteDrawSubmitting(true);
      const raw = await requestCharterRouteDraw(id, {
        notes: lang === "VN"
          ? "Cần GPS vẽ tuyến cho booking này"
          : "Need GPS to draw a route for this booking",
      });
      const normalized = normalizeRouteDrawRequest(raw) || {
        requestId: String(raw?.requestId || raw?.id || ""),
        bookingId: String(id),
        status: ROUTE_DRAW_STATUS.PENDING,
        notes: "Cần GPS vẽ tuyến cho booking này",
        stops: [],
      };
      setRouteDrawRequest(normalized);
      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã gửi yêu cầu GPS vẽ tuyến." : "GPS route-draw request sent.",
      });
      await loadDetail({ silent: true });
    } catch (error) {
      showToast({
        icon: "error",
        title: getApiErrorMessage(
          error,
          lang === "VN" ? "Gửi yêu cầu GPS thất bại." : "Failed to request GPS route draw.",
        ),
      });
    } finally {
      setIsRouteDrawSubmitting(false);
    }
  }, [booking, id, lang, loadDetail]);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state?.tab]);

  useEffect(() => {
    if (
      activeTab === "assignment"
      && ["Cancelled", "Expired", "Refunded"].includes(String(booking?.status || ""))
    ) {
      setActiveTab("overview");
    }
  }, [activeTab, booking?.status]);

  useEffect(() => {
    setAcknowledgedBadges(readAcknowledgedTabBadges(id));
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const routePlan = useMemo(
    () => buildCharterRoutePlan(routeCandidateLegs, routePlanSelections),
    [routeCandidateLegs, routePlanSelections],
  );
  const isRoutePlanComplete = isCharterRoutePlanComplete(routePlan, routeCandidateLegs);
  // Thiếu ứng viên → cần GPS vẽ. Đủ mã tuyến (hoặc đã chọn route cho mọi chặng) → không cần panel.
  const hasMissingRouteLegs = routeCandidatesLoaded && hasEmptyRouteCandidateLegs(routeCandidateLegs);
  const hasEnoughRouteCodes = routeCandidatesLoaded
    && (isRoutePlanComplete
      || hasSelectedRouteCodesForAllLegs(routeCandidateLegs, routePlanSelections));
  const routeQuoteOptions = useMemo(() => ({
    routeCandidateLegs: routeCandidatesLoaded ? routeCandidateLegs : undefined,
    routePlanComplete: routeCandidatesLoaded && isRoutePlanComplete,
    routeCandidatesLoaded,
  }), [routeCandidateLegs, routeCandidatesLoaded, isRoutePlanComplete]);

  const buildDetailQuotePayload = useCallback(() => {
    const rentalUnit = booking?.rentalUnit === "Day" || booking?.rentalUnit === "Hour"
      ? booking.rentalUnit
      : (quoteForm.rentalUnit === "Day" ? "Day" : "Hour");
    return {
      rentalUnit,
      durationValue: resolveQuoteDurationValue(booking, rentalUnit, {
        routeCandidateLegs,
        routePlanSelections,
      }),
      boats: quoteForm.boats.map((boat) => ({
        boatOrder: Number(boat.boatOrder),
        boatId: String(boat.boatId || "").trim(),
      })),
      routePlan,
    };
  }, [booking, quoteForm, routeCandidateLegs, routePlan, routePlanSelections]);

  const requiredQuoteBoatCount = booking ? normalizeRequestedBoats(booking, booking.selectedBoats).length : 0;
  const isQuoteBoatSelectionComplete = requiredQuoteBoatCount > 0
    && quoteForm.boats.length === requiredQuoteBoatCount
    && quoteForm.boats.every((boat) => boat.boatId);
  const hasBlockingPayment = Array.isArray(booking?.payments)
    && booking.payments.some((payment) => ["pending", "paid"].includes(String(payment.paymentStatus).toLowerCase()));
  const capabilities = useMemo(() => getCharterCapabilities(user, booking), [user, booking]);
  const canManageQuote = Boolean(booking)
    && capabilities.canQuote
    && booking.status === "PendingQuote"
    && !hasBlockingPayment;

  useEffect(() => {
    // Đổi booking / hết quyền quote → reset candidates (auto-load effect sẽ tải lại).
    setRouteCandidateLegs([]);
    setRoutePlanSelections({});
    setRouteCandidatesLoaded(false);
    setGpsCatalogRoutes([]);
    setRouteCandidatesError("");
    setIsRouteCandidatesLoading(Boolean(canManageQuote));
    setQuotePreview(null);
    setQuotePreviewError("");
    setIsPreviewLoading(false);
  }, [booking?.id, canManageQuote]);

  // Soft-filter dropdown: chỉ khi đang chốt giá. Cache 2 phút, chỉ hydrate booking cùng ngày.
  // Trùng lịch cứng vẫn do BE quyết; occupiedBoatIds chỉ để ẩn tàu đã giữ khỏi dropdown.
  useEffect(() => {
    if (!booking?.id || !canManageQuote) {
      setOccupiedBoatIds([]);
      return undefined;
    }

    let isActive = true;
    const loadOccupiedBoats = async () => {
      try {
        const occupied = await fetchOccupiedBoatIdsForCharterDate({
          currentBookingId: booking.id,
          departureDate: booking.departureDate,
          useAssignedApi,
        });
        if (!isActive) return;
        setOccupiedBoatIds(occupied);
        if (occupied.length > 0) {
          const occupiedSet = new Set(occupied);
          setQuoteForm((prev) => ({
            ...prev,
            boats: prev.boats.map((boat) => (
              occupiedSet.has(String(boat.boatId || "").trim())
                ? { ...boat, boatId: "" }
                : boat
            )),
          }));
        }
      } catch (error) {
        console.error("Không tải được lịch tàu để ẩn khỏi dropdown:", error);
        if (isActive) setOccupiedBoatIds([]);
      }
    };

    loadOccupiedBoats();
    return () => {
      isActive = false;
    };
  }, [
    booking?.id,
    booking?.departureDate,
    canManageQuote,
    useAssignedApi,
  ]);

  const bookingPaidAmount = useMemo(() => {
    if (!Array.isArray(booking?.payments)) return 0;
    return booking.payments
      .filter((payment) => isPaidPayment(payment))
      .reduce((sum, payment) => sum + getPaymentAmount(payment), 0);
  }, [booking?.payments]);

  const selectedBoats = useMemo(() => (
    Array.isArray(booking?.selectedBoats)
      ? booking.selectedBoats.map((assigned) => enrichAssignedBoat(assigned, boats))
      : []
  ), [booking?.selectedBoats, boats]);

  const adminActionsPhase = useMemo(() => {
    if (!booking) return "closed";
    const status = booking.status;
    if (["Cancelled", "Expired", "Refunded", "Completed"].includes(status)) return "closed";
    // Confirmed (kể cả đã Paid/DepositPaid) → màn vận hành + nút Tạo chuyến.
    if (status === "Confirmed") return "operate";
    if (isBookingPaymentClosed(booking) && status !== "PendingQuote") return "closed";
    if (status === "PendingQuote") return "quote";
    if (["Quoted", "PendingPayment"].includes(status)) return "payment";
    return "closed";
  }, [booking]);

  const canManageTripCreate = Boolean(booking)
    && capabilities.canManageStatus
    && booking.status === "Confirmed";

  const linkedTripIds = useMemo(() => {
    const fromBooking = booking ? getCharterBookingLinkedTripIds(booking) : [];
    return [...new Set([...fromBooking, ...localCreatedTripIds])];
  }, [booking, localCreatedTripIds]);

  useEffect(() => {
    setLocalCreatedTripIds([]);
  }, [booking?.id]);

  // Detail sau tạo trip có thể đã có tripId từ BE → đồng bộ local.
  useEffect(() => {
    if (!booking) return;
    const fromBooking = getCharterBookingLinkedTripIds(booking);
    if (fromBooking.length === 0) return;
    setLocalCreatedTripIds((prev) => [...new Set([...prev, ...fromBooking])]);
  }, [booking]);

  const charterTripGate = useMemo(() => {
    if (!booking || !canManageTripCreate) {
      return { canCreate: false, reasons: [], boatIds: [], tripIds: [], conflicts: [] };
    }
    return evaluateCharterTripCreateGate(booking, { otherBookings: [], lang });
  }, [booking, canManageTripCreate, lang]);

  // Bỏ pre-check trùng giờ trip ở FE (không kéo full list). BE validate khi tạo trip
  // và trả message trùng lịch (isCharterBoatScheduleConflictError) → xử lý ở handleCreateCharterTrip.

  const handleCreateCharterTrip = async () => {
    if (!booking?.id || !canManageTripCreate) return;

    const gate = evaluateCharterTripCreateGate(booking, { otherBookings: [], lang });
    if (!gate.canCreate) {
      showToast({
        icon: "warning",
        title: lang === "VN" ? "Chưa đủ điều kiện tạo chuyến" : "Cannot create trip yet",
        text: gate.reasons[0] || "",
        timer: 4000,
      });
      return;
    }

    const boatCount = gate.boatIds.length;
    const result = await showConfirmDialog({
      tone: "brand",
      icon: "question",
      title: lang === "VN" ? "Tạo chuyến thuê tàu?" : "Create charter trip?",
      html: buildConfirmBodyHtml({
        code: String(booking.bookingCode || "--"),
        text: lang === "VN"
          ? (boatCount > 1
            ? `Xác nhận tạo ${boatCount} chuyến theo số tàu đã chốt và lịch trình của yêu cầu này?`
            : "Xác nhận tạo chuyến theo tàu đã chốt và lịch trình của yêu cầu này?")
          : (boatCount > 1
            ? `Create ${boatCount} trips for the locked boats and this booking’s schedule?`
            : "Create a trip for the locked boat and this booking’s schedule?"),
      }),
      confirmButtonText: lang === "VN" ? "Tạo chuyến" : "Create trip",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    });
    if (!result.isConfirmed) return;

    try {
      setIsSubmitting(true);
      const created = await createAdminCharterBookingTrip(booking.id);
      const createdIds = extractTripIdsFromCharterTripCreateResponse(created);
      const fallbackIds = createdIds.length > 0
        ? createdIds
        : gate.boatIds.map((_, index) => `created-${booking.id}-${index + 1}`);
      setLocalCreatedTripIds((prev) => [...new Set([...prev, ...fallbackIds])]);
      setBooking((prev) => (prev ? {
        ...prev,
        tripIds: [...new Set([...(prev.tripIds || []), ...fallbackIds])],
        trips: [
          ...(Array.isArray(prev.trips) ? prev.trips : []),
          ...fallbackIds
            .filter((id) => !(prev.trips || []).some((trip) => String(trip?.tripId || trip?.id) === String(id)))
            .map((id) => ({ tripId: id })),
        ],
      } : prev));
      await loadDetail({ silent: true });
      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã tạo chuyến" : "Trip created",
        timer: 2500,
      });
    } catch (error) {
      console.error("Tạo trip charter thất bại:", error);
      showToast({
        icon: "error",
        title: lang === "VN" ? "Không tạo được chuyến" : "Unable to create trip",
        text: getApiErrorMessage(
          error,
          lang === "VN"
            ? "Kiểm tra Confirmed, tàu đã chốt, chưa có trip, và không trùng giờ."
            : "Check Confirmed status, locked boats, no existing trip, and schedule conflicts.",
        ),
        timer: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadRouteCandidates = useCallback(async () => {
    if (!booking?.id || !canManageQuote) return;
    try {
      setIsRouteCandidatesLoading(true);
      setRouteCandidatesError("");

      let bePayload = null;
      let beErrorMessage = "";
      try {
        bePayload = await fetchAdminCharterBookingRouteCandidates(booking.id);
      } catch (error) {
        console.error("BE route-candidates lỗi — fallback catalog GPS:", error);
        beErrorMessage = getApiErrorMessage(
          error,
          lang === "VN" ? "Chưa có gợi ý tuyến — đang lấy tuyến GPS theo 2 bến." : "No route suggestions yet — loading GPS routes by 2 stations.",
        );
      }

      let legs = normalizeRouteCandidateLegs(bePayload, booking);

      // Luôn tải catalog GPS + detail stops để lọc đúng 2 bến (kể cả khi BE đã trả candidates).
      try {
        const catalog = await fetchCharterSourceRoutes();
        const list = Array.isArray(catalog) ? catalog : [];
        const gpsLike = list.filter((route) => isUsableRouteCandidateForBooking(route));
        const needDetail = gpsLike.filter((route) => {
          const stops = Array.isArray(route?.stops) ? route.stops : Array.isArray(route?.routeStops) ? route.routeStops : [];
          return stops.length === 0;
        });
        // BE candidates thường không kèm stops — tải detail theo routeId để verify bến.
        const beIdsNeedingDetail = [];
        legs.forEach((leg) => {
          (Array.isArray(leg.candidates) ? leg.candidates : []).forEach((candidate) => {
            const id = String(candidate?.routeId || "").trim();
            if (!id) return;
            const inCatalog = gpsLike.some((route) => String(route.routeId || route.id || "") === id);
            const alreadyQueued = needDetail.some((route) => String(route.routeId || route.id || "") === id)
              || beIdsNeedingDetail.includes(id);
            if (!inCatalog && !alreadyQueued) beIdsNeedingDetail.push(id);
          });
        });

        const details = await Promise.all(
          [
            ...needDetail.map(async (route) => {
              const id = String(route.routeId || route.id || "");
              if (!id) return null;
              try {
                return await fetchRouteDetail(id);
              } catch (error) {
                console.error(`Không tải detail route ${id}:`, error);
                return null;
              }
            }),
            ...beIdsNeedingDetail.map(async (id) => {
              try {
                return await fetchRouteDetail(id);
              } catch (error) {
                console.error(`Không tải detail route ${id}:`, error);
                return null;
              }
            }),
          ],
        );
        const detailById = new Map(
          details.filter(Boolean).map((detail) => [String(detail.routeId || detail.id || ""), detail]),
        );
        const catalogWithStops = gpsLike.map((route) => {
          const id = String(route.routeId || route.id || "");
          const detail = detailById.get(id);
          return detail ? { ...route, ...detail } : route;
        });
        // Thêm các BE candidate detail không nằm trong catalog list.
        detailById.forEach((detail, id) => {
          if (catalogWithStops.some((route) => String(route.routeId || route.id || "") === id)) return;
          catalogWithStops.push(detail);
        });
        setGpsCatalogRoutes(catalogWithStops);
        legs = enrichCandidateLegsWithManualGpsRoutes(legs, catalogWithStops);
      } catch (error) {
        console.error("Không tải được catalog charter-source:", error);
        if (!beErrorMessage) {
          beErrorMessage = getApiErrorMessage(
            error,
            lang === "VN" ? "Không tải được danh sách Route nguồn GPS / Sightseeing." : "Unable to load GPS / Sightseeing source routes.",
          );
        }
        // Không có catalog → vẫn cố lọc bằng stops sẵn có trên candidate (nếu có).
        legs = enrichCandidateLegsWithManualGpsRoutes(legs, []);
      }

      setRouteCandidateLegs(legs);
      setRouteCandidatesLoaded(true);
      setRoutePlanSelections((prev) => {
        const defaults = buildInitialRoutePlanSelections(legs, booking);
        const merged = { ...defaults };
        Object.entries(prev).forEach(([key, routeId]) => {
          if (!routeId) return;
          const leg = legs.find((item) => getRouteCandidateLegKey(item) === key);
          if (leg?.candidates?.some((candidate) => candidate.routeId === routeId)) {
            merged[key] = routeId;
          }
        });
        return merged;
      });
      setQuotePreview(null);
      setQuotePreviewError("");
      setRouteCandidatesError(
        hasEmptyRouteCandidateLegs(legs)
          ? (beErrorMessage || (lang === "VN"
            ? "Không có Route GPS nào chứa đủ 2 stationId đúng chiều cho mọi chặng. Kiểm tra stops của HN/HCM…"
            : "No GPS route contains both stationIds (correct order) for every leg. Check route stops."))
          : ""
      );
    } catch (error) {
      console.error("Không tải được route để chọn:", error);
      const fallbackLegs = normalizeRouteCandidateLegs(null, booking);
      setRouteCandidateLegs(fallbackLegs);
      setRouteCandidatesLoaded(true);
      setRoutePlanSelections((prev) => {
        const defaults = buildInitialRoutePlanSelections(fallbackLegs, booking);
        return { ...defaults, ...prev };
      });
      setRouteCandidatesError(getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể tải danh sách route để chọn." : "Unable to load routes for selection.",
      ));
    } finally {
      setIsRouteCandidatesLoading(false);
    }
  }, [booking, canManageQuote, lang]);

  useEffect(() => {
    loadCandidatesFromHubRef.current = () => {
      if (canManageQuote) handleLoadRouteCandidates();
    };
  }, [canManageQuote, handleLoadRouteCandidates]);

  useEffect(() => {
    if (!booking?.id || !canManageQuote) return undefined;
    handleLoadRouteCandidates();
    return undefined;
    // Chỉ auto-load khi vào form chốt giá / đổi booking — không phụ thuộc mọi refresh booking object.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [booking?.id, canManageQuote]);

  const handlePreviewQuote = useCallback(async () => {
    if (
      !booking?.id
      || !isQuoteBoatSelectionComplete
      || !canManageQuote
      || !routeCandidatesLoaded
      || !isRoutePlanComplete
      || isCharterRoutePricingBlocked(booking, routeQuoteOptions)
    ) {
      setQuotePreview(null);
      setQuotePreviewError(getCharterRoutePricingWarning(booking, lang, routeQuoteOptions) || (
        lang === "VN" ? "Chọn đủ route và tàu trước khi xem trước giá." : "Select all routes and boats before previewing."
      ));
      return;
    }

    const payload = buildDetailQuotePayload();
    try {
      setIsPreviewLoading(true);
      setQuotePreviewError("");
      const preview = await previewAdminCharterBookingQuote(booking.id, payload);
      setQuotePreview(preview);
    } catch (error) {
      setQuotePreview(null);
      setQuotePreviewError(getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể preview giá." : "Unable to preview quote.",
      ));
    } finally {
      setIsPreviewLoading(false);
    }
  }, [
    booking,
    buildDetailQuotePayload,
    canManageQuote,
    isQuoteBoatSelectionComplete,
    isRoutePlanComplete,
    lang,
    routeCandidatesLoaded,
    routeQuoteOptions,
  ]);

  const handleDetailQuoteBoatChange = (boatOrder, boatId) => {
    const nextBoatId = String(boatId || "").trim();
    // Tàu trùng lịch đã bị ẩn khỏi dropdown — không cho gán lại.
    if (nextBoatId && occupiedBoatIds.includes(nextBoatId)) return;

    setQuoteForm((prev) => ({
      ...prev,
      boats: prev.boats.map((boat) => (
        boat.boatOrder === boatOrder ? { ...boat, boatId: nextBoatId } : boat
      )),
    }));
  };

  const handleDetailRoutePlanChange = (legKey, routeId) => {
    setRoutePlanSelections((prev) => ({
      ...prev,
      [legKey]: String(routeId || "").trim(),
    }));
    setQuotePreview(null);
    setQuotePreviewError("");
  };

  const handleDetailQuoteRentalUnitChange = (rentalUnit) => {
    setQuoteForm((prev) => ({
      ...prev,
      rentalUnit: rentalUnit === "Day" ? "Day" : "Hour",
    }));
    setQuotePreview(null);
    setQuotePreviewError("");
  };

  const handleDetailSubmitQuote = async (event) => {
    event.preventDefault();
    if (!booking?.id || !isQuoteBoatSelectionComplete || !canManageQuote) return;

    if (!routeCandidatesLoaded) {
      showToast({
        icon: "info",
        title: lang === "VN" ? "Đang tải tuyến" : "Loading routes",
        text: lang === "VN"
          ? "Đợi hệ thống tải tuyến theo chặng xong rồi chốt giá."
          : "Wait for routes to finish loading before submitting the quote.",
      });
      return;
    }

    if (hasEmptyRouteCandidateLegs(routeCandidateLegs)) {
      showToast({
        icon: "warning",
        title: lang === "VN" ? "Thiếu Route nguồn GPS" : "GPS source route missing",
        text: lang === "VN"
          ? "Có chặng chưa có Route GPS chứa đủ 2 stationId đúng chiều. Kiểm tra stops trên route hoặc tạo Route nguồn GPS."
          : "Some legs have no GPS route with both stationIds in the correct order. Check route stops or create a GPS source route.",
        timer: 4500,
      });
      return;
    }

    if (!isRoutePlanComplete) {
      showToast({
        icon: "warning",
        title: lang === "VN" ? "Chưa chọn đủ route" : "Route selection incomplete",
        text: lang === "VN"
          ? "Chọn một route cho mỗi chặng trước khi chốt giá."
          : "Select one route for every leg before finalizing the quote.",
      });
      return;
    }

    if (!quotePreview) {
      showToast({
        icon: "info",
        title: lang === "VN" ? "Chưa xem trước giá" : "Preview required",
        text: lang === "VN"
          ? "Nhấn «Xem trước giá» thành công trước khi chốt giá."
          : "Run a successful price preview before finalizing the quote.",
      });
      return;
    }

    const routeWarning = getCharterRoutePricingWarning(booking, lang, routeQuoteOptions);
    if (isCharterRoutePricingBlocked(booking, routeQuoteOptions)) {
      showToast({
        icon: "warning",
        title: lang === "VN" ? "Lộ trình chưa đủ để chốt giá" : "Route incomplete for quoting",
        text: routeWarning,
        timer: 4500,
      });
      return;
    }

    const selectedBoatIds = quoteForm.boats.map((boat) => String(boat.boatId || "").trim()).filter(Boolean);

    try {
      setIsSubmitting(true);

      // Chặn sớm bằng danh sách tàu đã ẩn (cùng ngày), không để chọn rồi mới lỗi BE.
      const occupiedSet = new Set(
        (Array.isArray(occupiedBoatIds) ? occupiedBoatIds : []).map((id) => String(id || "").trim()),
      );
      const alreadyHeld = selectedBoatIds.filter((id) => occupiedSet.has(id));
      if (alreadyHeld.length > 0) {
        setQuoteForm((prev) => ({
          ...prev,
          boats: prev.boats.map((boat) => (
            occupiedSet.has(String(boat.boatId || "").trim())
              ? { ...boat, boatId: "" }
              : boat
          )),
        }));
        showToast({
          icon: "warning",
          title: lang === "VN" ? "Tàu đã được giữ" : "Boat already held",
          text: lang === "VN"
            ? "Tàu đã được giữ nên không còn trong danh sách. Hãy chọn tàu khác."
            : "That boat is already held and was removed from the list. Pick another boat.",
          timer: 4000,
        });
        return;
      }

      // Không chặn cứng bằng check cùng ngày FE — BE quyết định trùng lịch (booking/trip overlap).
      // Soft-filter occupiedBoatIds chỉ để UX chọn tàu.

      const depositAmount = resolveQuoteDepositAmount(quotePreview);
      const payload = {
        ...buildDetailQuotePayload(),
        ...(depositAmount != null && depositAmount > 0 ? { depositAmount } : {}),
      };

      console.info("Chốt giá payload:", payload);
      await submitAdminCharterBookingQuote(booking.id, payload);
      await loadDetail();
      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã chốt giá thuê tàu" : "Quote submitted",
        timer: 2200,
      });
    } catch (error) {
      console.error("Lỗi chốt giá charter booking:", error?.response?.data || error);
      const fallback = lang === "VN"
        ? "Vui lòng kiểm tra tàu, số khách, thời lượng và giá chốt."
        : "Please check boat, passenger count, duration, and subtotal.";
      const rawMessage = getApiErrorMessage(error, fallback);

      // Trùng tàu/lịch từ BE: hiện đúng message BE, bỏ chọn tàu, không chốt quote.
      if (isCharterBoatScheduleConflictError(error) || isCharterBoatScheduleConflictError(rawMessage)) {
        const selectedIds = quoteForm.boats
          .map((boat) => String(boat.boatId || "").trim())
          .filter(Boolean);
        setOccupiedBoatIds((prev) => [...new Set([...prev, ...selectedIds])]);
        setQuoteForm((prev) => ({
          ...prev,
          boats: prev.boats.map((boat) => ({ ...boat, boatId: "" })),
        }));
        showToast({
          icon: "warning",
          title: lang === "VN" ? "Tàu trùng lịch" : "Boat schedule conflict",
          text: rawMessage,
          timer: 5000,
        });
        return;
      }

      showToast({
        icon: "error",
        title: lang === "VN" ? "Không thể chốt giá" : "Unable to submit quote",
        text: rawMessage,
        timer: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetailStatusChange = async (nextStatus) => {
    if (!booking?.id || !manualStatusOptions.includes(nextStatus)) return;

    let cancelNote = "";
    if (nextStatus === "Cancelled") {
      const hasPaid = hasRefundablePayment(booking) || ["depositpaid", "paid", "partiallyrefunded"].includes(
        String(booking.paymentStatus || "").toLowerCase(),
      );
      const bookingCode = String(booking.bookingCode || "--");
      const result = await showConfirmDialog({
        tone: "danger",
        icon: "warning",
        title: lang === "VN" ? "Hủy booking này?" : "Cancel this booking?",
        html: buildConfirmBodyHtml({
          code: bookingCode,
          text: hasPaid
            ? (lang === "VN"
              ? "Booking đã có thanh toán và sẽ chuyển sang trạng thái Đã hủy."
              : "This booking has payments and will be marked as Cancelled.")
            : (lang === "VN"
              ? "Booking sẽ chuyển sang trạng thái Đã hủy."
              : "This booking will be marked as Cancelled."),
        }),
        input: "textarea",
        inputLabel: lang === "VN" ? "Lý do hủy" : "Cancellation reason",
        inputPlaceholder: lang === "VN" ? "Nhập lý do hủy (bắt buộc)…" : "Enter cancellation reason (required)…",
        inputAttributes: {
          "aria-label": lang === "VN" ? "Lý do hủy" : "Cancellation reason",
          rows: 3,
        },
        showCancelButton: true,
        confirmButtonText: lang === "VN" ? "Hủy booking" : "Cancel booking",
        cancelButtonText: lang === "VN" ? "Giữ lại" : "Keep booking",
        preConfirm: (value) => {
          const note = String(value || "").trim();
          if (note.length < 3) {
            showValidationMessage(
              lang === "VN" ? "Nhập lý do hủy (ít nhất 3 ký tự)." : "Enter a reason (at least 3 characters).",
            );
            return false;
          }
          return note;
        },
      });
      if (!result.isConfirmed) return;
      cancelNote = String(result.value || "").trim();
    }

    try {
      setIsSubmitting(true);
      if (nextStatus === "Cancelled") {
        await modifyAdminCharterBookingStatus(booking.id, {
          bookingStatus: "Cancelled",
          note: cancelNote,
        });
      } else {
        await modifyAdminCharterBookingStatus(booking.id, nextStatus);
      }
      await loadDetail();
      const waitsCustomer = nextStatus === "Cancelled" && (
        hasRefundablePayment(booking)
        || ["depositpaid", "paid", "partiallyrefunded"].includes(String(booking.paymentStatus || "").toLowerCase())
      );
      showToast({
        icon: "success",
        title: waitsCustomer
          ? (lang === "VN" ? "Đã hủy booking" : "Booking cancelled")
          : (lang === "VN" ? "Đã cập nhật trạng thái" : "Status updated"),
        timer: 2200,
      });
    } catch (error) {
      showToast({
        icon: "error",
        title: lang === "VN" ? "Cập nhật thất bại" : "Update failed",
        text: error.response?.data?.message || (lang === "VN" ? "Trạng thái này có thể chưa hợp lệ theo điều kiện thanh toán." : "This status may not be valid for the current payment state."),
        timer: 4500,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetailRefundPayment = async (payment) => {
    const paymentId = getRefundPaymentId(payment);
    if (!paymentId || !booking?.id) return;
    navigate(`/admin/charter-bookings-management/${booking.id}/payments/${encodeURIComponent(paymentId)}/refund`);
  };

  const workspaceTabs = useMemo(() => {
    const tabs = [];
    const closedBooking = ["Cancelled", "Expired", "Refunded"].includes(String(booking?.status || ""));
    if (capabilities.canQuote) {
      tabs.push({ id: "actions", icon: "edit_square", label: lang === "VN" ? "Thao tác" : "Actions" });
    }
    tabs.push({ id: "overview", icon: "dashboard", label: lang === "VN" ? "Tổng quan" : "Overview" });
    if (capabilities.canAssignManager && !closedBooking) {
      tabs.push({
        id: "assignment",
        icon: "group",
        label: lang === "VN" ? "Gán quản lý" : "Assign manager",
      });
    }
    const paymentList = Array.isArray(booking?.payments) ? booking.payments : [];
    const ticketList = canShowCharterTickets(booking)
      ? (Array.isArray(booking?.tickets) ? booking.tickets : [])
      : [];
    if (capabilities.canViewPayments) {
      tabs.push({
        id: "payments",
        icon: "payments",
        label: lang === "VN" ? "Thanh toán" : "Payments",
        badge: paymentList.length || (booking && bookingNeedsRefundAttention(booking) ? "!" : ""),
      });
    }
    if (capabilities.canViewTickets) {
      tabs.push({ id: "tickets", icon: "confirmation_number", label: lang === "VN" ? "Vé/khách" : "Tickets", badge: ticketList.length || "" });
    }
    return tabs;
  }, [booking, capabilities, lang]);

  if (isLoading) {
    return <PageLoading lang={lang} fullscreen />;
  }

  if (!booking) {
    return (
      <div className="space-y-4 font-body">
        <button type="button" onClick={() => navigate("/admin/charter-bookings-management")} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-headline font-black uppercase tracking-wider text-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-400">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {lang === "VN" ? "Quay lại danh sách" : "Back to list"}
        </button>
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <p className="font-bold">{loadError || (lang === "VN" ? "Không có dữ liệu booking." : "No booking data.")}</p>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(booking.status, booking.paymentStatus);
  const showBookingHoldCountdown = shouldShowBookingHoldCountdown(booking);
  const quotePaymentDeadline = getCharterQuotePaymentDeadline(booking);
  const bookingHoldRemainingMs = showBookingHoldCountdown
    ? getRemainingMs(quotePaymentDeadline, nowTick)
    : 0;
  const quoteTotal = Number(booking?.estimatedPrice || 0);
  const remainingAmount = booking?.remainingAmount !== undefined && booking?.remainingAmount !== null
    ? Math.max(0, Number(booking.remainingAmount) || 0)
    : Math.max(quoteTotal - bookingPaidAmount, 0);
  const requestedBoats = Array.isArray(booking.requestedBoats) ? booking.requestedBoats : [];
  const payments = Array.isArray(booking.payments) ? booking.payments : [];
  const tickets = canShowCharterTickets(booking)
    ? (Array.isArray(booking.tickets) ? booking.tickets : [])
    : [];

  return (
    <div className="relative space-y-6 pb-10 font-body">
      {(isRefreshing || isSubmitting) ? (
        <PageLoading
          lang={lang}
          overlay
          fixed
          message={
            isSubmitting
              ? (lang === "VN" ? "Đang xử lý..." : "Processing...")
              : (lang === "VN" ? "Đang cập nhật..." : "Refreshing...")
          }
        />
      ) : null}
      <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <div className="min-w-0">
          <button type="button" onClick={() => navigate("/admin/charter-bookings-management")} className="mb-4 inline-flex items-center gap-2 text-xs font-headline font-black uppercase tracking-wider text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {lang === "VN" ? "Danh sách thuê tàu" : "Booking request list"}
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 md:text-3xl">{booking.bookingCode}</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wide ${statusInfo.classes}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`}></span>
              {statusInfo.label}
            </span>
          </div>
          <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-300">
            {[
              booking.customerName,
              booking.fromStationName && booking.toStationName
                ? `${booking.fromStationName} → ${booking.toStationName}`
                : null,
            ].filter(Boolean).join(" · ") || "--"}
          </p>
        </div>
      </div>

      <div className="sticky top-4 z-20 rounded-3xl border border-slate-100 bg-white/95 p-2 shadow-lg backdrop-blur dark:border-slate-700/60 dark:bg-slate-800/95">
        <div className={`grid grid-cols-2 gap-2 ${
          workspaceTabs.length >= 5
            ? "md:grid-cols-5"
            : workspaceTabs.length >= 4
              ? "md:grid-cols-4"
              : "md:grid-cols-3"
        }`}>
          {workspaceTabs.map((tab) => {
            const active = activeTab === tab.id;
            const showBadge = tab.badge
              && activeTab !== tab.id
              && shouldShowTabBadge(id, tab.id, tab.badge, acknowledgedBadges);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => goToTab(tab.id, tab.badge)}
                className={`relative flex h-12 items-center justify-center gap-2 rounded-2xl px-3 text-[10px] font-headline font-black uppercase tracking-wider transition-all ${
                  active
                    ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                }`}
              >
                <span className="material-symbols-outlined text-base">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
                {showBadge ? (
                  <span className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-black ${
                    tab.badge === "!" ? "bg-rose-500 text-white" : "bg-[#FFD100] text-slate-900"
                  }`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <p className="mb-3 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Tiến trình booking" : "Booking progress"}
        </p>
        <CharterWorkflowStepper status={booking.status} lang={lang} />
      </div>

      {bookingNeedsAdminRefundAttention(booking) && capabilities.canViewPayments && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-2xl text-rose-600 dark:text-rose-300">currency_exchange</span>
              <div>
                <p className="font-headline text-sm font-black uppercase tracking-wide text-rose-700 dark:text-rose-300">
                  {lang === "VN" ? "PayOS hoàn lỗi — cần ghi nhận thủ công" : "PayOS refund failed — manual record needed"}
                </p>
                <p className="mt-1 text-xs font-bold text-rose-600/80 dark:text-rose-200">
                  {lang === "VN"
                    ? "Chỉ dùng manual-refund khi PayOS payout fail. Không nhập STK thay khách ở bước hủy."
                    : "Use manual-refund only when PayOS payout failed. Do not enter bank details during cancel."}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => goToTab("payments", payments.length || "!")} className="rounded-xl bg-rose-600 px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-white">
              {lang === "VN" ? "Đến thanh toán" : "Go to payments"}
            </button>
          </div>
        </div>
      )}

      {bookingWaitsCustomerRefundInfo(booking) && capabilities.canViewPayments && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-2xl text-amber-700 dark:text-amber-300">hourglass_top</span>
              <div>
                <p className="font-headline text-sm font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  {lang === "VN" ? "Chờ khách nhập thông tin hoàn tiền" : "Waiting for customer refund info"}
                </p>
                <p className="mt-1 text-xs font-bold text-amber-700/80 dark:text-amber-200">
                  {lang === "VN"
                    ? "Booking đã hủy và đã thu tiền. Khách nhập ngân hàng / STK / tên chủ TK trên app của họ."
                    : "Booking is cancelled with collected payment. Customer enters bank / account / holder name in their app."}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => goToTab("payments", payments.length || "!")} className="rounded-xl bg-amber-600 px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-white">
              {lang === "VN" ? "Xem thanh toán" : "View payments"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "actions" && (
        <AdminBookingActionsTab
          lang={lang}
          phase={adminActionsPhase}
          booking={booking}
          statusInfo={statusInfo}
          boats={boats}
          occupiedBoatIds={occupiedBoatIds}
          quoteForm={quoteForm}
          setQuoteForm={setQuoteForm}
          canManageQuote={canManageQuote}
          hasBlockingPayment={hasBlockingPayment}
          isSubmitting={isSubmitting}
          isQuoteBoatSelectionComplete={isQuoteBoatSelectionComplete}
          isRoutePlanComplete={isRoutePlanComplete}
          routeCandidateLegs={routeCandidateLegs}
          routePlanSelections={routePlanSelections}
          routeCandidatesLoaded={routeCandidatesLoaded}
          isRouteCandidatesLoading={isRouteCandidatesLoading}
          routeCandidatesError={routeCandidatesError}
          isPreviewLoading={isPreviewLoading}
          quotePreviewError={quotePreviewError}
          quotePreview={quotePreview}
          currencyFormatter={currencyFormatter}
          formatDate={formatDate}
          formatDuration={formatDuration}
          formatPassengerSummary={formatPassengerSummary}
          formatDeckCount={formatDeckCount}
          getRequestedDeckCount={getRequestedDeckCount}
          getBoatDeckCount={getBoatDeckCount}
          getBoatSeatSetupType={getBoatSeatSetupType}
          getBoatId={getBoatId}
          getBoatSeatCount={getBoatSeatCount}
          getBoatPrice={resolveBoatPrice}
          isActiveBoat={isActiveBoat}
          showBookingHoldCountdown={showBookingHoldCountdown}
          bookingHoldRemainingMs={bookingHoldRemainingMs}
          quotePaymentDeadline={quotePaymentDeadline}
          formatDateTime={formatDateTime}
          formatCountdown={formatCountdown}
          quoteTotal={quoteTotal}
          bookingPaidAmount={bookingPaidAmount}
          selectedBoats={selectedBoats}
          payments={payments}
          manualStatusOptions={manualStatusOptions}
          getStatusInfo={getStatusInfo}
          onSubmitQuote={handleDetailSubmitQuote}
          onQuoteBoatChange={handleDetailQuoteBoatChange}
          onRoutePlanChange={handleDetailRoutePlanChange}
          onLoadRouteCandidates={handleLoadRouteCandidates}
          onPreviewQuote={handlePreviewQuote}
          onQuoteRentalUnitChange={handleDetailQuoteRentalUnitChange}
          onStatusChange={handleDetailStatusChange}
          onCreateTrip={handleCreateCharterTrip}
          canCreateTrip={charterTripGate.canCreate}
          createTripBlockers={charterTripGate.reasons}
          linkedTripIds={linkedTripIds}
          canManageTripCreate={canManageTripCreate}
          routeDrawRequest={routeDrawRequest}
          isRouteDrawSubmitting={isRouteDrawSubmitting}
          canRequestRouteDraw={Boolean(capabilities.canQuote || capabilities.canViewAllCharters)}
          hasMissingRouteLegs={hasMissingRouteLegs}
          hasEnoughRouteCodes={hasEnoughRouteCodes}
          onRequestRouteDraw={handleRequestRouteDraw}
          onNavigateTab={(tabId) => {
            const tab = workspaceTabs.find((item) => item.id === tabId);
            goToTab(tabId, tab?.badge);
          }}
        />
      )}

      {activeTab === "overview" && (
        <AdminBookingOverviewTab
          lang={lang}
          booking={booking}
          showBookingHoldCountdown={showBookingHoldCountdown}
          bookingHoldRemainingMs={bookingHoldRemainingMs}
          quotePaymentDeadline={quotePaymentDeadline}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          formatCountdown={formatCountdown}
          formatDuration={formatDuration}
          formatPassengerSummary={formatPassengerSummary}
          formatDeckCount={formatDeckCount}
          getRequestedDeckCount={getRequestedDeckCount}
          getBoatDeckCount={getBoatDeckCount}
          getBoatSeatSetupType={getBoatSeatSetupType}
          getBoatId={getBoatId}
          getBoatSeatCount={getBoatSeatCount}
          getPaymentStatusInfo={getPaymentStatusInfo}
          currencyFormatter={currencyFormatter}
          quoteTotal={quoteTotal}
          bookingPaidAmount={bookingPaidAmount}
          remainingAmount={remainingAmount}
          requestedBoats={requestedBoats}
          selectedBoats={selectedBoats}
          capabilities={capabilities}
          onNavigateTab={(tabId) => goToTab(tabId)}
          routeDrawRequest={routeDrawRequest}
          isRouteDrawSubmitting={isRouteDrawSubmitting}
          canRequestRouteDraw={Boolean(capabilities.canQuote || capabilities.canViewAllCharters)}
          hasMissingRouteLegs={hasMissingRouteLegs}
          hasEnoughRouteCodes={hasEnoughRouteCodes}
          onRequestRouteDraw={handleRequestRouteDraw}
        />
      )}

      {activeTab === "assignment"
        && capabilities.canAssignManager
        && !["Cancelled", "Expired", "Refunded"].includes(String(booking?.status || "")) && (
        <AdminCharterAssignmentPanel
          lang={lang}
          booking={booking}
          capabilities={capabilities}
          isSubmitting={isSubmitting}
          onReload={loadDetail}
        />
      )}

      {activeTab === "payments" && capabilities.canViewPayments && (
      <section className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Theo dõi thanh toán" : "Payment Monitoring"}</h3>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {lang === "VN"
                ? "Hiển thị các giao dịch thanh toán của booking: trạng thái, hạn thanh toán và đường dẫn PayOS để quản trị kiểm tra."
                : "Shows booking payment transactions: status, payment deadline, and PayOS link for admin review."}
            </p>
          </div>
          <span className="w-max rounded-xl bg-slate-50 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
            {payments.length} {lang === "VN" ? "giao dịch" : "payments"}
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[920px] table-fixed text-xs">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[22%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="py-3 pr-3 text-left">ID</th>
                <th className="py-3 pr-3 text-right">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                <th className="py-3 pr-3 text-right">{lang === "VN" ? "Số tiền" : "Amount"}</th>
                <th className="py-3 pr-3 text-right">Refund</th>
                <th className="py-3 pr-3 text-right">{lang === "VN" ? "Hết hạn" : "Expires"}</th>
                <th className="py-3 pr-3 text-left">PayOS</th>
                <th className="py-3 pl-2 text-right">{lang === "VN" ? "Xử lý" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {payments.length > 0 ? payments.map((payment, index) => {
                const expiresAt = pick(payment, ["expiresAt"], "");
                const remainingMs = getRemainingMs(expiresAt, nowTick);
                const refundInfo = getRefundStatusInfo(payment, lang);
                const refundAmount = getRefundAmount(payment);
                const rawRefundMessage = String(getRefundMessage(payment) || "").trim();
                // Chỉ hiện message lỗi — ẩn "success"/token trạng thái thô dưới badge hoàn tiền.
                const refundMessage = isRefundFailed(payment) && rawRefundMessage
                  && !["success", "succeeded", "completed", "ok"].includes(rawRefundMessage.toLowerCase())
                  ? rawRefundMessage
                  : "";
                const canHandleRefund = canAdminHandleRefund(payment, booking.status);
                const waitsCustomerRefund = paymentWaitsCustomerRefundInfo(payment, booking.status);
                const paymentId = String(pick(payment, ["paymentId", "id"], "--") || "--");
                const checkoutUrl = String(pick(payment, ["checkoutUrl", "paymentUrl"], "") || "");
                const rawPaymentStatus = pick(payment, ["paymentStatus"], "--");
                // Đã hoàn tiền → không còn “Đã thanh toán”; hiện Đã hủy.
                const paymentStatusForDisplay = isRefundDone(payment) ? "Cancelled" : rawPaymentStatus;
                const paymentStatusInfo = getPaymentStatusInfo(paymentStatusForDisplay, lang);
                const paymentStatusLower = String(rawPaymentStatus || "").toLowerCase();
                const showPaymentLinkDeadline = ["pending", "pendingpayment", "unpaid"].includes(paymentStatusLower)
                  && !isRefundDone(payment)
                  && !isPaidPayment(payment);
                return (
                  <tr key={`${paymentId}-${index}`} className="align-middle">
                    <td className="py-3 pr-3 align-middle text-left">
                      <p title={paymentId} className="truncate font-mono text-[11px] font-bold text-slate-800 dark:text-white">
                        {paymentId}
                      </p>
                    </td>
                    <td className="py-3 pr-3 align-middle text-right">
                      <span
                        title={paymentStatusInfo.label}
                        className={`inline-flex max-w-full whitespace-nowrap rounded-lg border px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wide ${paymentStatusInfo.classes}`}
                      >
                        {paymentStatusInfo.label}
                      </span>
                    </td>
                    <td className="py-3 pr-3 align-middle text-right whitespace-nowrap font-bold text-slate-600 dark:text-slate-300">
                      {getPaymentAmount(payment) > 0 ? currencyFormatter.format(getPaymentAmount(payment)) : "--"}
                    </td>
                    <td className="py-3 pr-3 align-middle text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          title={refundInfo.label}
                          className={`inline-flex max-w-full whitespace-nowrap rounded-lg border px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wide ${refundInfo.classes}`}
                        >
                          {refundInfo.label}
                        </span>
                        {refundAmount > 0 ? (
                          <p className="truncate text-[10px] font-bold text-slate-400">
                            {currencyFormatter.format(refundAmount)}
                          </p>
                        ) : null}
                        {refundMessage ? (
                          <p title={refundMessage} className="max-w-full truncate text-[10px] font-bold text-rose-500">
                            {refundMessage}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 pr-3 align-middle text-right">
                      {expiresAt && showPaymentLinkDeadline ? (
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-600 dark:text-slate-300">
                            {formatDateTime(expiresAt)}
                          </p>
                          <p className={`mt-0.5 text-[10px] font-bold ${remainingMs > 0 ? "text-slate-400" : "text-rose-500"}`}>
                            {remainingMs > 0 ? formatCountdown(remainingMs) : (lang === "VN" ? "Hết hạn" : "Expired")}
                          </p>
                        </div>
                      ) : (
                        <span className="font-bold text-slate-400">--</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 align-middle text-left">
                      {checkoutUrl ? (
                        <a
                          href={checkoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={checkoutUrl}
                          className="block truncate text-slate-400 underline-offset-2 hover:text-[#124757] hover:underline dark:hover:text-yellow-400"
                        >
                          {checkoutUrl}
                        </a>
                      ) : (
                        <span className="text-slate-400">--</span>
                      )}
                    </td>
                    <td className="py-3 pl-2 align-middle text-right">
                      <div className="inline-flex justify-end">
                        {canHandleRefund ? (
                          <button
                            type="button"
                            onClick={() => handleDetailRefundPayment(payment)}
                            disabled={isSubmitting}
                            className="inline-flex whitespace-nowrap rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-50"
                          >
                            {lang === "VN" ? "Thủ công" : "Manual"}
                          </button>
                        ) : waitsCustomerRefund ? (
                          <span className="inline-flex whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wider text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                            {lang === "VN" ? "Chờ khách" : "Awaiting"}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">--</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center font-bold text-slate-400">{lang === "VN" ? "Chưa có payment link." : "No payment links yet."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === "tickets" && (
        <AdminBookingTicketsTab
          lang={lang}
          booking={booking}
          tickets={tickets}
          formatDate={formatDate}
          canReviewPassengerAdds={Boolean(capabilities.canViewAllCharters || capabilities.isAssignedManager)}
          useAssignedApi={useAssignedApi}
          onRefresh={loadDetail}
        />
      )}
    </div>
  );
}
