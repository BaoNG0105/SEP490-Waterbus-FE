import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BankBinSelect } from "../../../components/BankBinSelect";
import { useApp } from "../../../context/AppContext";
import { fetchAdminCharterBookingDetail } from "../../../services/charterBookingService";
import { manualRefundBookingPayment, refundBookingPayment, syncBookingPayment } from "../../../services/paymentService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { getCharterBookingStatusInfo } from "../../../utils/charterBookingStatus";
import {
  buildManualRefundPayload,
  buildRefundFormDefaults,
  buildRefundRequestBody,
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
  getRefundValidationMessage,
  getRemainingRefundAmount,
  isRefundDone,
  isRefundProcessing,
  normalizeBooking,
  pick,
} from "../../../utils/charterBookingAdmin";

export function AdminCharterBookingRefund() {
  const { lang } = useApp();
  const { id, paymentId } = useParams();
  const navigate = useNavigate();
  const decodedPaymentId = paymentId ? decodeURIComponent(paymentId) : "";
  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [form, setForm] = useState(() => buildRefundFormDefaults({}, {}));
  const [manualForm, setManualForm] = useState(() => ({
    reason: "Admin refunded by bank transfer after PayOS payout failed",
    referenceId: "",
    payoutId: "",
    refundedAt: getCurrentDatetimeLocalValue(),
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      const detail = await fetchAdminCharterBookingDetail(id);
      const normalized = normalizeBooking(detail);
      const targetPayment = normalized.payments.find((item) => getRefundPaymentId(item) === decodedPaymentId);

      setBooking(normalized);
      setPayment(targetPayment || null);
      setForm(buildRefundFormDefaults(targetPayment || {}, normalized));

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

  const handleFieldChange = (field) => (event) => {
    const value = field === "accountNumber"
      ? event.target.value.replace(/\D/g, "").slice(0, 20)
      : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setSubmitError("");
    setSubmitResult(null);
  };

  const handleBankBinChange = (bankBin) => {
    setForm((prev) => ({ ...prev, bankBin }));
    setSubmitError("");
    setSubmitResult(null);
  };

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

  const handleSubmitRefund = async (event) => {
    event.preventDefault();
    const payload = buildRefundRequestBody(form);
    const validationMessage = getRefundValidationMessage(payload, lang);

    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    if (!payment || getRemainingRefundAmount(payment) <= 0 || isRefundDone(payment) || isRefundProcessing(payment)) {
      setSubmitError(lang === "VN" ? "Payment này hiện không còn số tiền có thể gửi yêu cầu hoàn tự động." : "This payment has no amount available for a new automatic refund request.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      setSubmitResult(null);
      const response = await refundBookingPayment(decodedPaymentId, payload);
      setSubmitResult(response || { ok: true });
      await loadRefundDetail();
    } catch (error) {
      console.error("Refund failed:", error);
      setSubmitError(getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể gửi yêu cầu hoàn tiền. Vui lòng kiểm tra trạng thái giao dịch hoặc thử lại." : "Unable to request refund. Please check the transaction status or try again.",
      ));
      setSubmitResult(error.response?.data || null);
    } finally {
      setIsSubmitting(false);
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
  const canSubmitPayOsRefund = Boolean(payment) && remainingRefundAmount > 0 && !isRefundDone(payment) && !isRefundProcessing(payment);
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
                  {lang === "VN" ? "FE không gửi amount. Backend tự tính số tiền hoàn theo payment và chính sách." : "The frontend does not send amount. Backend calculates the refund from payment data and policy."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncPayment}
                disabled={!payment || isSyncing || isSubmitting || isManualSubmitting}
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
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">PayOS refund</p>
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

          <form onSubmit={handleSubmitRefund} className="space-y-6">
            <section className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Hoàn tiền PayOS" : "PayOS Refund"}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    {canSubmitPayOsRefund
                      ? (lang === "VN" ? "Nhập tài khoản nhận hoàn, hệ thống sẽ gọi refund PayOS trước." : "Enter the receiving account; the system will attempt PayOS refund first.")
                      : (lang === "VN" ? "Payment này chưa đủ điều kiện tạo yêu cầu hoàn PayOS mới." : "This payment is not eligible for a new PayOS refund request.")}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={!canSubmitPayOsRefund || isSubmitting || isSyncing || isManualSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-headline font-black uppercase tracking-wider text-white transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">{isSubmitting ? "progress_activity" : "payments"}</span>
                  {isSubmitting ? (lang === "VN" ? "Đang gửi" : "Submitting") : (lang === "VN" ? "Gửi hoàn PayOS" : "Submit PayOS refund")}
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Lý do" : "Reason"}</span>
                  <input
                    value={form.reason}
                    onChange={handleFieldChange("reason")}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-yellow-400"
                    placeholder={lang === "VN" ? "Khách hàng yêu cầu hoàn tiền" : "Customer refund"}
                  />
                </label>
                <div className="sm:col-span-2">
                  <BankBinSelect
                    value={form.bankBin}
                    onChange={handleBankBinChange}
                    lang={lang}
                    disabled={!canSubmitPayOsRefund || isSubmitting || isSyncing || isManualSubmitting}
                    label={lang === "VN" ? "Ngân hàng nhận hoàn" : "Refund bank"}
                    searchInputClassName="mt-1 w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-yellow-400"
                    fallbackInputClassName="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-yellow-400"
                  />
                </div>
                <label>
                  <span className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Số tài khoản" : "Account number"}</span>
                  <input
                    value={form.accountNumber}
                    onChange={handleFieldChange("accountNumber")}
                    inputMode="numeric"
                    maxLength={20}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-yellow-400"
                    placeholder="123456789"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Tên tài khoản" : "Account name"}</span>
                  <input
                    value={form.accountName}
                    onChange={handleFieldChange("accountName")}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-yellow-400"
                    placeholder="NGUYEN VAN A"
                  />
                </label>
              </div>
            </section>
          </form>

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
                  disabled={isManualSubmitting || isSubmitting || isSyncing}
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
              </div>
              {submitResult && (
                <pre className="max-h-80 overflow-auto p-5 text-sm leading-6 text-slate-800 dark:text-slate-100">{JSON.stringify(submitResult, null, 2)}</pre>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
