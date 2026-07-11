import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import Swal from "sweetalert2";
import { AdminCharterAssignmentPanel } from "../../../components/AdminCharterAssignmentPanel";
import {
  AdminBookingActionsTab,
  AdminBookingOverviewTab,
  AdminBookingTicketsTab,
} from "../../../components/AdminCharterDetailWorkspace";
import { CharterWorkflowStepper } from "../../../components/CharterWorkflowStepper";
import { useApp } from "../../../context/AppContext";
import { fetchAllBoats } from "../../../services/boatService";
import {
  fetchAdminCharterBookingDetail,
  fetchAssignedCharterBookingDetail,
  modifyAdminCharterBookingStatus,
  previewAdminCharterBookingQuote,
  submitAdminCharterBookingQuote,
} from "../../../services/charterBookingService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { canShowCharterTickets } from "../../../utils/charterBookingTickets";
import {
  bookingNeedsRefundAttention,
  getCharterQuotePaymentDeadline,
  isBookingPaymentClosed,
  shouldShowBookingHoldCountdown,
} from "../../../utils/charterBookingActions";
import { getCharterBookingStatusInfo } from "../../../utils/charterBookingStatus";
import { getCharterCapabilities, shouldUseAssignedCharterApi, getDefaultCharterTab } from "../../../utils/charterBookingAccess";
import { useCharterBookingDetailHub } from "../../../hooks/useCharterBookingDetailHub";
import {
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
  getPaymentAmount,
  getPaymentStatusInfo,
  getRefundAmount,
  getRefundMessage,
  getRefundPaymentId,
  getRefundStatusInfo,
  getRemainingMs,
  getRequestedDeckCount,
  hasRefundablePayment,
  isActiveBoat,
  isPaidPayment,
  manualStatusOptions,
  normalizeBooking,
  normalizeRequestedBoats,
  pick,
  readAcknowledgedTabBadges,
  acknowledgeTabBadge,
  shouldShowTabBadge,
} from "../../../utils/charterBookingAdmin";

export function AdminCharterBookingDetail() {
  const { lang } = useApp();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const useAssignedApi = shouldUseAssignedCharterApi(user);
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [booking, setBooking] = useState(null);
  const [boats, setBoats] = useState([]);
  const [activeTab, setActiveTab] = useState(() => location.state?.tab || "overview");
  const [quoteForm, setQuoteForm] = useState({
    boats: [],
  });
  const [quotePreview, setQuotePreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [quotePreviewError, setQuotePreviewError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [acknowledgedBadges, setAcknowledgedBadges] = useState(() => readAcknowledgedTabBadges(id));

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }),
    []
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
      if (!silent) setIsLoading(true);
      setLoadError("");
      const fetchDetail = useAssignedApi ? fetchAssignedCharterBookingDetail : fetchAdminCharterBookingDetail;
      const [detail, boatData] = await Promise.all([
        fetchDetail(id),
        fetchAllBoats({ status: "Active" }).catch(() => []),
      ]);
      const normalized = normalizeBooking(detail);
      setBooking(normalized);
      setBoats(Array.isArray(boatData) ? boatData : []);
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
          lang === "VN" ? "Không thể tải chi tiết thuê tàu." : "Unable to load charter booking detail.",
        ));
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [id, lang, location.state?.tab, useAssignedApi, user]);

  const refreshDetailSilently = useCallback(() => {
    loadDetail({ silent: true });
  }, [loadDetail]);

  useCharterBookingDetailHub({
    enabled: isAuthenticated && Boolean(id),
    bookingId: id,
    onRefresh: refreshDetailSilently,
  });

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state?.tab]);

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

  const buildDetailQuotePayload = useCallback(() => ({
    boats: quoteForm.boats.map((boat) => ({
      boatOrder: Number(boat.boatOrder),
      boatId: boat.boatId,
    })),
  }), [quoteForm]);

  const requiredQuoteBoatCount = booking ? normalizeRequestedBoats(booking, booking.selectedBoats).length : 0;
  const isQuoteBoatSelectionComplete = requiredQuoteBoatCount > 0
    && quoteForm.boats.length === requiredQuoteBoatCount
    && quoteForm.boats.every((boat) => boat.boatId);
  const hasBlockingPayment = Array.isArray(booking?.payments)
    && booking.payments.some((payment) => ["pending", "paid"].includes(String(payment.paymentStatus).toLowerCase()));
  const capabilities = useMemo(() => getCharterCapabilities(user, booking), [user, booking]);
  const canManageQuote = Boolean(booking)
    && capabilities.canQuote
    && ["PendingQuote", "Quoted"].includes(booking.status)
    && !hasBlockingPayment;

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
    if (isBookingPaymentClosed(booking) && status !== "PendingQuote") return "closed";
    if (status === "PendingQuote" || (status === "Quoted" && canManageQuote)) return "quote";
    if (["Quoted", "PendingPayment"].includes(status)) return "payment";
    if (status === "Confirmed") return "operate";
    return "closed";
  }, [booking, canManageQuote]);

  useEffect(() => {
    if (!booking?.id || !isQuoteBoatSelectionComplete || !canManageQuote) {
      setQuotePreview(null);
      setQuotePreviewError("");
      return;
    }

    let isActive = true;
    const timer = setTimeout(async () => {
      const payload = buildDetailQuotePayload();
      try {
        setIsPreviewLoading(true);
        setQuotePreviewError("");
        const preview = await previewAdminCharterBookingQuote(booking.id, payload);
        if (isActive) setQuotePreview(preview);
      } catch (error) {
        if (!isActive) return;
        setQuotePreview(null);
        setQuotePreviewError(getApiErrorMessage(
          error,
          lang === "VN" ? "Không thể preview giá." : "Unable to preview quote.",
        ));
      } finally {
        if (isActive) setIsPreviewLoading(false);
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [booking?.id, buildDetailQuotePayload, canManageQuote, isQuoteBoatSelectionComplete, lang]);

  const handleDetailQuoteBoatChange = (boatOrder, boatId) => {
    setQuoteForm((prev) => ({
      ...prev,
      boats: prev.boats.map((boat) => (
        boat.boatOrder === boatOrder ? { ...boat, boatId } : boat
      )),
    }));
  };

  const handleDetailSubmitQuote = async (event) => {
    event.preventDefault();
    if (!booking?.id || !isQuoteBoatSelectionComplete || !canManageQuote) return;

    const payload = buildDetailQuotePayload();

    try {
      setIsSubmitting(true);
      await submitAdminCharterBookingQuote(booking.id, payload);
      await loadDetail();
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã chốt giá thuê tàu" : "Quote submitted",
        confirmButtonColor: "#124757",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể chốt giá" : "Unable to submit quote",
        text: getApiErrorMessage(
          error,
          lang === "VN" ? "Vui lòng kiểm tra tàu, số khách, thời lượng và giá chốt." : "Please check boat, passenger count, duration, and subtotal.",
        ),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetailStatusChange = async (nextStatus) => {
    if (!booking?.id || !manualStatusOptions.includes(nextStatus)) return;

    if (nextStatus === "Cancelled") {
      const hasPaid = hasRefundablePayment(booking);
      const result = await Swal.fire({
        icon: hasPaid ? "warning" : "question",
        title: lang === "VN" ? "Hủy booking này?" : "Cancel this booking?",
        text: hasPaid
          ? (lang === "VN"
            ? "Booking đã có thanh toán. Sau khi hủy, mở tab Thanh toán để gửi yêu cầu hoàn tiền với tài khoản nhận hoàn."
            : "This booking has paid payments. After cancellation, use the Payments tab to submit the refund with the recipient bank account.")
          : (lang === "VN" ? "Booking sẽ chuyển sang trạng thái Đã hủy." : "The booking will be marked as cancelled."),
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#124757",
        confirmButtonText: lang === "VN" ? "Xác nhận hủy" : "Cancel booking",
        cancelButtonText: lang === "VN" ? "Đóng" : "Close",
      });
      if (!result.isConfirmed) return;
    }

    try {
      setIsSubmitting(true);
      await modifyAdminCharterBookingStatus(booking.id, nextStatus);
      await loadDetail();
      Swal.fire({
        icon: "success",
        title: nextStatus === "Cancelled" && hasRefundablePayment(booking)
          ? (lang === "VN" ? "Đã hủy, đang theo dõi refund" : "Cancelled, refund is being tracked")
          : (lang === "VN" ? "Đã cập nhật trạng thái" : "Status updated"),
        text: nextStatus === "Cancelled" && hasRefundablePayment(booking)
          ? (lang === "VN" ? "Booking có giao dịch đã thu tiền. Vào tab Thanh toán để gửi yêu cầu hoàn tiền." : "This booking has collected payments. Open the Payments tab to submit the refund request.")
          : undefined,
        confirmButtonColor: "#124757",
        timer: nextStatus === "Cancelled" && hasRefundablePayment(booking) ? undefined : 1400,
        showConfirmButton: nextStatus === "Cancelled" && hasRefundablePayment(booking),
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Cập nhật thất bại" : "Update failed",
        text: error.response?.data?.message || (lang === "VN" ? "Trạng thái này có thể chưa hợp lệ theo điều kiện thanh toán." : "This status may not be valid for the current payment state."),
        confirmButtonColor: "#124757",
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
    if (capabilities.canQuote) {
      tabs.push({ id: "actions", icon: "edit_square", label: lang === "VN" ? "Thao tác" : "Actions" });
    }
    tabs.push({ id: "overview", icon: "dashboard", label: lang === "VN" ? "Tổng quan" : "Overview" });
    if (capabilities.canAssignManager) {
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
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 animate-spin"></div>
      </div>
    );
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
  const remainingAmount = Math.max(quoteTotal - bookingPaidAmount, 0);
  const requestedBoats = Array.isArray(booking.requestedBoats) ? booking.requestedBoats : [];
  const payments = Array.isArray(booking.payments) ? booking.payments : [];
  const tickets = canShowCharterTickets(booking)
    ? (Array.isArray(booking.tickets) ? booking.tickets : [])
    : [];

  return (
    <div className="space-y-6 pb-10 font-body">
      <div className="flex flex-col gap-4 rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button type="button" onClick={() => navigate("/admin/charter-bookings-management")} className="mb-4 inline-flex items-center gap-2 text-xs font-headline font-black uppercase tracking-wider text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {lang === "VN" ? "Danh sách thuê tàu" : "Charter booking list"}
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 md:text-3xl">{booking.bookingCode}</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wide ${statusInfo.classes}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`}></span>
              {statusInfo.label}
            </span>
          </div>
          <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-300">{booking.customerName} · {booking.route}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadDetail} className="inline-flex w-max items-center gap-2 rounded-2xl bg-[#FFD100] px-5 py-3 text-xs font-headline font-black uppercase tracking-wider text-[#124757] shadow-sm">
            <span className="material-symbols-outlined text-base">refresh</span>
            {lang === "VN" ? "Tải lại" : "Refresh"}
          </button>
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

      {bookingNeedsRefundAttention(booking) && capabilities.canViewPayments && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-2xl text-rose-600 dark:text-rose-300">currency_exchange</span>
              <div>
                <p className="font-headline text-sm font-black uppercase tracking-wide text-rose-700 dark:text-rose-300">
                  {lang === "VN" ? "Cần xử lý hoàn tiền" : "Refund attention required"}
                </p>
                <p className="mt-1 text-xs font-bold text-rose-600/80 dark:text-rose-200">
                  {lang === "VN" ? "Booking đã hủy hoặc hoàn lỗi — mở tab Thanh toán để xử lý." : "Booking cancelled or refund failed — open the Payments tab to process."}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => goToTab("payments", payments.length || (bookingNeedsRefundAttention(booking) ? "!" : ""))} className="rounded-xl bg-rose-600 px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-white">
              {lang === "VN" ? "Đến thanh toán" : "Go to payments"}
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
          quoteForm={quoteForm}
          setQuoteForm={setQuoteForm}
          canManageQuote={canManageQuote}
          hasBlockingPayment={hasBlockingPayment}
          isSubmitting={isSubmitting}
          isQuoteBoatSelectionComplete={isQuoteBoatSelectionComplete}
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
          getBoatPrice={getBoatPrice}
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
          onStatusChange={handleDetailStatusChange}
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
        />
      )}

      {activeTab === "assignment" && capabilities.canAssignManager && (
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
          <table className="w-full min-w-250 text-left text-xs">
            <thead className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="py-3 pr-4">ID</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">{lang === "VN" ? "Số tiền" : "Amount"}</th>
                <th className="py-3 pr-4">Refund</th>
                <th className="py-3 pr-4">expiresAt</th>
                <th className="py-3 pr-4">checkoutUrl</th>
                <th className="py-3 pr-4 text-right">{lang === "VN" ? "Xử lý" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {payments.length > 0 ? payments.map((payment, index) => {
                const expiresAt = pick(payment, ["expiresAt"], "");
                const remainingMs = getRemainingMs(expiresAt, nowTick);
                const refundInfo = getRefundStatusInfo(payment, lang);
                const refundAmount = getRefundAmount(payment);
                const refundMessage = getRefundMessage(payment);
                const canHandleRefund = canAdminHandleRefund(payment, booking.status);
                return (
                  <tr key={`${pick(payment, ["id", "paymentId"], index)}-${index}`}>
                    <td className="py-3 pr-4 font-bold text-slate-800 dark:text-white">{pick(payment, ["paymentId", "id"], "--")}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${getPaymentStatusInfo(pick(payment, ["paymentStatus"], "--"), lang).classes}`}>
                        {getPaymentStatusInfo(pick(payment, ["paymentStatus"], "--"), lang).label}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-bold text-slate-600 dark:text-slate-300">
                      {getPaymentAmount(payment) > 0 ? currencyFormatter.format(getPaymentAmount(payment)) : "--"}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${refundInfo.classes}`}>
                        {refundInfo.label}
                      </span>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">
                        {refundAmount > 0 ? currencyFormatter.format(refundAmount) : "--"}
                      </p>
                      {refundMessage && <p className="mt-1 max-w-60 wrap-break-word text-[10px] font-bold text-rose-500">{refundMessage}</p>}
                    </td>
                    <td className="py-3 pr-4 font-bold text-slate-600 dark:text-slate-300">
                      {expiresAt ? `${formatDateTime(expiresAt)} · ${remainingMs > 0 ? formatCountdown(remainingMs) : (lang === "VN" ? "Hết hạn" : "Expired")}` : "--"}
                    </td>
                    <td className="max-w-100 truncate py-3 pr-4 text-slate-400">{pick(payment, ["checkoutUrl", "paymentUrl"], "--")}</td>
                    <td className="py-3 pr-4 text-right">
                      {canHandleRefund ? (
                        <button
                          type="button"
                          onClick={() => handleDetailRefundPayment(payment)}
                          disabled={isSubmitting}
                          className="rounded-lg bg-rose-600 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-50"
                        >
                          {lang === "VN" ? "Xử lý hoàn tiền" : "Process refund"}
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">--</span>
                      )}
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
        />
      )}
    </div>
  );
}
