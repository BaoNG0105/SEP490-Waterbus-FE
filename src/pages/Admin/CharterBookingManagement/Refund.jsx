import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAdminCharterBookingDetail } from "../../../services/charterBookingService";
import { fetchAllTrips } from "../../../services/tripService";
import { manualRefundBookingPayment, syncBookingPayment } from "../../../services/paymentService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { getCharterBookingStatusInfo } from "../../../utils/charterBookingStatus";
import {
  buildManualRefundPayload,
  canRecordManualRefund,
  formatDate,
  formatDateTime,
  getCurrentDatetimeLocalValue,
  getManualRefundValidationMessage,
  getPaymentAmount,
  getPaymentStatusInfo,
  getRefundAmount,
  getRefundMessage,
  getRefundMethod,
  getRefundPaymentId,
  getRefundReferenceId,
  getRefundRequestedAmount,
  getRefundStatusInfo,
  getRemainingRefundAmount,
  isRefundProcessing,
  normalizeBooking,
  applyCharterTripSchedule,
  findCharterTripForBooking,
  pick,
} from "../../../utils/charterBookingAdmin";

export function AdminCharterBookingRefund() {
  const { lang } = useApp();
  const { id, paymentId } = useParams();
  const navigate = useNavigate();
  const decodedPaymentId = paymentId ? decodeURIComponent(paymentId) : "";
  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [manualForm, setManualForm] = useState(() => ({
    reason: "Admin refunded by bank transfer after PayOS payout failed",
    referenceId: "",
    payoutId: "",
    refundedAt: getCurrentDatetimeLocalValue(),
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitResult, setSubmitResult] = useState(null);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }),
    []
  );

  const endpoint = `/api/payments/${encodeURIComponent(decodedPaymentId)}/refund`;

  const loadRefundDetail = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setLoadError("");
      const [detail, charterTrips] = await Promise.all([
        fetchAdminCharterBookingDetail(id),
        fetchAllTrips({ tripType: "Charter" }).catch(() => []),
      ]);
      const baseBooking = normalizeBooking(detail);
      const normalized = applyCharterTripSchedule(
        baseBooking,
        findCharterTripForBooking(charterTrips, baseBooking),
      );
      const targetPayment = normalized.payments.find((item) => getRefundPaymentId(item) === decodedPaymentId);

      setBooking(normalized);
      setPayment(targetPayment || null);

      if (!targetPayment) {
        setLoadError(lang === "VN"
          ? "Không tìm thấy payment cần refund trong booking này."
          : "Unable to find this payment in the selected booking.");
      }
    } catch (error) {
      console.error("Lỗi tải trang refund:", error);
      setLoadError(getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể tải dữ liệu refund." : "Unable to load refund data.",
      ));
    } finally {
      setIsLoading(false);
    }
  }, [decodedPaymentId, id, lang]);

  useEffect(() => {
    loadRefundDetail();
  }, [loadRefundDetail]);

  const handleManualFieldChange = (field) => (event) => {
    setManualForm((prev) => ({ ...prev, [field]: event.target.value }));
    setSubmitError("");
    setSubmitResult(null);
  };

  const handleSyncPayment = async () => {
    if (!decodedPaymentId) return;

    try {
      setIsSyncing(true);
      setSubmitError("");
      setSubmitResult(null);
      const response = await syncBookingPayment(decodedPaymentId);
      setSubmitResult(response || { ok: true });
      await loadRefundDetail();
    } catch (error) {
      console.error("Sync payment failed:", error);
      setSubmitError(getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể đồng bộ trạng thái payment. Vui lòng tải lại booking hoặc thử lại." : "Unable to sync payment status. Please reload the booking or try again.",
      ));
      setSubmitResult(error.response?.data || null);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmitManualRefund = async (event) => {
    event.preventDefault();

    if (!payment || !canRecordManualRefund(payment)) {
      setSubmitError(lang === "VN" ? "Payment chưa đủ điều kiện ghi nhận hoàn thủ công." : "This payment is not eligible for manual refund recording.");
      return;
    }

    const validationMessage = getManualRefundValidationMessage(manualForm, lang);
    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    const payload = buildManualRefundPayload(manualForm);

    try {
      setIsManualSubmitting(true);
      setSubmitError("");
      setSubmitResult(null);
      const response = await manualRefundBookingPayment(decodedPaymentId, payload);
      setSubmitResult(response || { ok: true });
      await loadRefundDetail();
    } catch (error) {
      console.error("Manual refund failed:", error);
      setSubmitError(getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể ghi nhận hoàn thủ công. Vui lòng kiểm tra mã giao dịch hoặc thử lại." : "Unable to record manual refund. Please check the transfer reference or try again.",
      ));
      setSubmitResult(error.response?.data || null);
    } finally {
      setIsManualSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-96 items-center justify-center rounded-4xl border border-slate-100 bg-white p-10 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-[#124757] dark:text-yellow-400">progress_activity</span>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-300">{lang === "VN" ? "Đang tải dữ liệu refund..." : "Loading refund data..."}</p>
        </div>
      </div>
    );
  }

  const refundInfo = payment ? getRefundStatusInfo(payment, lang) : getRefundStatusInfo({}, lang);
  const bookingStatusInfo = booking ? getCharterBookingStatusInfo(booking.status, booking.paymentStatus, lang) : null;
  const paidAmount = payment ? getPaymentAmount(payment) : 0;
  const refundedAmount = payment ? getRefundAmount(payment) : 0;
  const refundRequestedAmount = payment ? getRefundRequestedAmount(payment) : 0;
  const remainingRefundAmount = payment ? getRemainingRefundAmount(payment) : 0;
  const canSubmitManualRefund = Boolean(payment) && canRecordManualRefund(payment);
  const amountNeedAction = canSubmitManualRefund
    ? refundRequestedAmount
    : isRefundProcessing(payment || {})
      ? refundRequestedAmount
      : remainingRefundAmount;
  const manualRefundEndpoint = `/api/payments/${encodeURIComponent(decodedPaymentId)}/manual-refund`;
  const syncEndpoint = `/api/payments/${encodeURIComponent(decodedPaymentId)}/sync`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(id ? `/admin/charter-bookings-management/${id}` : "/admin/charter-bookings-management")}
            className="mb-3 inline-flex items-center gap-2 text-xs font-headline font-black uppercase tracking-wider text-slate-500 transition-colors hover:text-[#124757] dark:text-slate-400 dark:hover:text-yellow-400"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {lang === "VN" ? "Quay lại booking" : "Back to booking"}
          </button>
          <h2 className="font-headline text-3xl font-black uppercase tracking-tight text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Xử lý hoàn tiền" : "Process Refund"}
          </h2>
          <p className="mt-1 text-sm font-bold text-slate-400">
            {booking?.bookingCode || "--"} · {decodedPaymentId || "--"}
          </p>
        </div>
        {payment && (
          <span className={`w-max rounded-xl border px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider ${refundInfo.classes}`}>
            Refund: {refundInfo.label}
          </span>
        )}
      </div>

      {loadError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {loadError}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Thông tin booking" : "Booking Info"}</h3>
            <div className="mt-4 space-y-3 text-sm">
              {[
                { label: "Booking", value: booking?.bookingCode },
                { label: lang === "VN" ? "Khách hàng" : "Customer", value: booking?.customerName },
                { label: lang === "VN" ? "Liên hệ" : "Contact", value: booking ? `${booking.phone} / ${booking.email}` : "" },
                { label: lang === "VN" ? "Lộ trình" : "Route", value: booking?.route },
                { label: lang === "VN" ? "Ngày đi" : "Departure", value: booking ? `${formatDate(booking.departureDate)} ${String(booking.startTime).slice(0, 5)}` : "" },
                { label: lang === "VN" ? "Trạng thái" : "Status", value: bookingStatusInfo?.label },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className="mt-1 wrap-break-word font-bold text-slate-800 dark:text-white">{item.value || "--"}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Thông tin payment" : "Payment Info"}</h3>
            <div className="mt-4 space-y-3 text-sm">
              {[
                { label: "Payment ID", value: getRefundPaymentId(payment || {}) || decodedPaymentId },
                { label: "Payment status", value: payment ? getPaymentStatusInfo(pick(payment, ["paymentStatus"], "--"), lang).label : "--" },
                { label: lang === "VN" ? "Đã thu" : "Paid amount", value: paidAmount > 0 ? currencyFormatter.format(paidAmount) : "--" },
                { label: lang === "VN" ? "Đã hoàn" : "Refunded amount", value: refundedAmount > 0 ? currencyFormatter.format(refundedAmount) : "--" },
                { label: lang === "VN" ? "Đã yêu cầu hoàn" : "Requested refund", value: refundRequestedAmount > 0 ? currencyFormatter.format(refundRequestedAmount) : "--" },
                { label: lang === "VN" ? "Còn cần xử lý" : "Amount to handle", value: amountNeedAction > 0 ? currencyFormatter.format(amountNeedAction) : "--" },
                { label: "Refund method", value: getRefundMethod(payment || {}) || "--" },
                { label: "Refund reference", value: getRefundReferenceId(payment || {}) || "--" },
                { label: "Refund status", value: refundInfo.label },
                { label: "expiresAt", value: payment && pick(payment, ["expiresAt"], "") ? formatDateTime(pick(payment, ["expiresAt"], "")) : "--" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className="mt-1 wrap-break-word font-bold text-slate-800 dark:text-white">{item.value || "--"}</p>
                </div>
              ))}
              {payment && getRefundMessage(payment) && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {getRefundMessage(payment)}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6 xl:col-span-3">
          <section className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Ngữ cảnh hoàn tiền" : "Refund Context"}</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  {lang === "VN" ? "Số tiền hoàn được hệ thống tự tính theo thanh toán và chính sách — bạn không cần nhập tay." : "The refund amount is calculated automatically from the payment and policy — you do not enter it manually."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncPayment}
                disabled={!payment || isSyncing || isManualSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-headline font-black uppercase tracking-wider text-[#124757] transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400 dark:hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-base">{isSyncing ? "progress_activity" : "sync"}</span>
                {isSyncing ? (lang === "VN" ? "Đang đồng bộ" : "Syncing") : (lang === "VN" ? "Đồng bộ payment" : "Sync payment")}
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: lang === "VN" ? "Đã thu" : "Paid", value: paidAmount > 0 ? currencyFormatter.format(paidAmount) : "--" },
                { label: lang === "VN" ? "Đã hoàn" : "Refunded", value: refundedAmount > 0 ? currencyFormatter.format(refundedAmount) : "--" },
                { label: lang === "VN" ? "Đã yêu cầu" : "Requested", value: refundRequestedAmount > 0 ? currencyFormatter.format(refundRequestedAmount) : "--" },
                { label: lang === "VN" ? "Còn cần xử lý" : "To handle", value: amountNeedAction > 0 ? currencyFormatter.format(amountNeedAction) : "--", highlight: true },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 ${item.highlight ? "border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10" : "border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"}`}>
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className={`mt-1 text-lg font-headline font-black ${item.highlight ? "text-rose-600 dark:text-rose-300" : "text-[#124757] dark:text-yellow-400"}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 text-xs font-bold text-slate-500 dark:text-slate-300 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">Customer refund</p>
                <p className="mt-1 break-all font-mono text-[11px]">POST {endpoint}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">Sync</p>
                <p className="mt-1 break-all font-mono text-[11px]">POST {syncEndpoint}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">Manual refund</p>
                <p className="mt-1 break-all font-mono text-[11px]">POST {manualRefundEndpoint}</p>
              </div>
            </div>
          </section>

          {!canSubmitManualRefund ? (
            <section className="rounded-4xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
              <h3 className="font-headline font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">
                {lang === "VN" ? "Chờ khách nhập thông tin hoàn tiền" : "Waiting for customer refund info"}
              </h3>
              <p className="mt-2 text-sm font-bold leading-relaxed text-amber-800/90 dark:text-amber-200">
                {lang === "VN"
                  ? "Admin không nhập STK ở bước này. Khách gọi POST /payments/{paymentId}/refund kèm bankBin / accountNumber / accountName. Admin chỉ dùng manual-refund khi PayOS payout fail."
                  : "Admin does not enter bank details here. The customer calls POST /payments/{paymentId}/refund with bankBin / accountNumber / accountName. Use manual-refund only when PayOS payout fails."}
              </p>
            </section>
          ) : null}

          {canSubmitManualRefund && (
            <form onSubmit={handleSubmitManualRefund} className="rounded-4xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-headline font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">{lang === "VN" ? "Ghi nhận hoàn thủ công" : "Record Manual Refund"}</h3>
                  <p className="mt-1 text-xs font-bold text-amber-700/80 dark:text-amber-200">
                    {lang === "VN"
                      ? `PayOS đã lỗi. Admin xác nhận đã chuyển khoản ngân hàng số tiền ${currencyFormatter.format(refundRequestedAmount)}.`
                      : `PayOS failed. Admin confirms bank transfer of ${currencyFormatter.format(refundRequestedAmount)}.`}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isManualSubmitting || isSyncing}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-xs font-headline font-black uppercase tracking-wider text-white transition-all hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">{isManualSubmitting ? "progress_activity" : "task_alt"}</span>
                  {isManualSubmitting ? (lang === "VN" ? "Đang ghi nhận" : "Recording") : (lang === "VN" ? "Ghi nhận thủ công" : "Record manual")}
                </button>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-[10px] font-headline font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">{lang === "VN" ? "Lý do" : "Reason"}</span>
                  <input
                    value={manualForm.reason}
                    onChange={handleManualFieldChange("reason")}
                    className="mt-1 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-amber-600 dark:border-amber-500/30 dark:bg-slate-900 dark:text-white"
                  />
                </label>
                <label>
                  <span className="text-[10px] font-headline font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">{lang === "VN" ? "Mã giao dịch ngân hàng" : "Bank reference"}</span>
                  <input
                    value={manualForm.referenceId}
                    onChange={handleManualFieldChange("referenceId")}
                    className="mt-1 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-amber-600 dark:border-amber-500/30 dark:bg-slate-900 dark:text-white"
                    placeholder="BANK-TX-123456"
                  />
                </label>
                <label>
                  <span className="text-[10px] font-headline font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">payoutId</span>
                  <input
                    value={manualForm.payoutId}
                    onChange={handleManualFieldChange("payoutId")}
                    className="mt-1 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-amber-600 dark:border-amber-500/30 dark:bg-slate-900 dark:text-white"
                    placeholder={lang === "VN" ? "Có thể để trống" : "Optional"}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-[10px] font-headline font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">{lang === "VN" ? "Thời điểm đã hoàn" : "Refunded at"}</span>
                  <input
                    type="datetime-local"
                    value={manualForm.refundedAt}
                    onChange={handleManualFieldChange("refundedAt")}
                    className="mt-1 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-amber-600 dark:border-amber-500/30 dark:bg-slate-900 dark:text-white"
                  />
                </label>
              </div>
            </form>
          )}

          {(submitError || submitResult) && (
            <section className={`overflow-hidden rounded-4xl border shadow-sm ${submitError ? "border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10" : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"}`}>
              <div className="border-b border-current/10 px-5 py-3">
                <p className={`text-[10px] font-headline font-black uppercase tracking-widest ${submitError ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                  {submitError ? (lang === "VN" ? "Hoàn tiền lỗi" : "Refund failed") : (lang === "VN" ? "Kết quả xử lý" : "Processing result")}
                </p>
                {submitError && <p className="mt-1 text-sm font-bold text-rose-600 dark:text-rose-300">{submitError}</p>}
                {!submitError && submitResult && (
                  <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {lang === "VN" ? "Đã xử lý thành công." : "Processed successfully."}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
