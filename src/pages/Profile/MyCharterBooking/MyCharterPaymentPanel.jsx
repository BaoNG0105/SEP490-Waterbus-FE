import { PayOSLogo, payosButtonClassName, payosButtonLgClassName } from "../../../components/PayOSLogo";
import { SelectablePublicVouchers } from "../../../components/SelectablePublicVouchers";

import { PROMOTION_BOOKING_TYPES } from "../../../services/promotionService";

import { shouldShowPaymentDeadlineCountdown } from "../../../utils/charterBookingActions";

const formatCountdown = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, "0");

  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const getPaymentStatusMeta = (status, lang) => {
  switch (String(status || "").toLowerCase()) {
    case "paid":
    case "success":
    case "succeeded":
    case "completed":
      return { label: lang === "VN" ? "Đã thanh toán" : "Paid", classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20" };
    case "depositpaid":
      return { label: lang === "VN" ? "Đã đặt cọc" : "Deposit paid", classes: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20" };
    case "pending":
      return { label: lang === "VN" ? "Đang chờ" : "Pending", classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20" };
    case "expired":
      return { label: lang === "VN" ? "Hết hạn" : "Expired", classes: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700" };
    case "refunded":
      return { label: lang === "VN" ? "Đã hoàn" : "Refunded", classes: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20" };
    case "failed":
    case "cancelled":
      return { label: lang === "VN" ? "Thất bại" : "Failed", classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20" };
    default:
      return { label: status || "--", classes: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700" };
  }
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return `${date.toLocaleDateString("vi-VN")} ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
};

const getPaymentTimeLabel = (payment, lang, status) => {
  const paidAt = pick(payment, ["paidAt", "completedAt"], "");
  const createdAt = pick(payment, ["createdAt", "createdDate"], "");
  const updatedAt = pick(payment, ["updatedAt"], "");
  const expiresAt = pick(payment, ["expiresAt", "expiredAt", "paymentExpiresAt"], "");
  const isExpired = String(status || "").toLowerCase() === "expired";

  if (paidAt) {
    const formatted = formatDateTime(paidAt);
    return formatted
      ? { text: formatted, hint: lang === "VN" ? "Thời điểm thanh toán" : "Paid at" }
      : null;
  }
  if (isExpired && expiresAt) {
    const formatted = formatDateTime(expiresAt);
    return formatted
      ? { text: formatted, hint: lang === "VN" ? "Hết hạn lúc" : "Expired at" }
      : null;
  }
  if (createdAt) {
    const formatted = formatDateTime(createdAt);
    return formatted
      ? { text: formatted, hint: lang === "VN" ? "Tạo lúc" : "Created at" }
      : null;
  }
  if (expiresAt) {
    const formatted = formatDateTime(expiresAt);
    return formatted
      ? { text: formatted, hint: lang === "VN" ? "Hạn thanh toán" : "Expires at" }
      : null;
  }
  if (updatedAt) {
    const formatted = formatDateTime(updatedAt);
    return formatted
      ? { text: formatted, hint: lang === "VN" ? "Cập nhật lúc" : "Updated at" }
      : null;
  }
  return null;
};

function CharterPaymentLedger({ payments = [], lang = "VN", currencyFormatter }) {
  if (!Array.isArray(payments) || payments.length === 0) return null;

  return (
    <div className="mt-5 rounded-3xl border border-[#D8E7EA] bg-[#F7FAFB] p-4 dark:border-slate-700 dark:bg-slate-900/50 md:p-5">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-[11px] font-headline font-black uppercase tracking-widest text-[#124757] dark:text-yellow-400">
          {lang === "VN" ? "Lịch sử giao dịch" : "Payment history"}
        </h3>
      </div>

      <div className="space-y-3">
        {payments.map((payment, index) => {
          const amount = Number(pick(payment, ["amount", "paymentAmount", "paidAmount", "totalAmount"], 0)) || 0;
          const status = pick(payment, ["paymentStatus", "status"], "--");
          const meta = getPaymentStatusMeta(status, lang);
          const timeMeta = getPaymentTimeLabel(payment, lang, status);
          const orderCode = pick(payment, ["orderCode", "paymentOrderCode", "payosOrderCode"], "");
          const refundAmount = Number(pick(payment, ["refundAmount", "refundedAmount"], 0)) || 0;

          return (
            <div
              key={pick(payment, ["paymentId", "id"], index)}
              className="flex flex-col gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-headline font-black uppercase tracking-wider ${meta.classes
                        .split(" ")
                        .filter((cls) => cls.includes("text-"))
                        .join(" ")
                      }`}>
                      {meta.label}
                    </span>
                    {orderCode && (
                      <span className="text-[10px] font-bold text-slate-400">
                        #{String(orderCode).slice(-8)}
                      </span>
                    )}
                  </div>
                  {timeMeta ? (
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      <span className="font-medium text-slate-400/80">{timeMeta.hint}: </span>
                      {timeMeta.text}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {lang === "VN" ? "Chưa có thời gian giao dịch" : "No payment timestamp"}
                    </p>
                  )}
                  {refundAmount > 0 && (
                    <p className="mt-1 text-[10px] font-bold text-teal-600 dark:text-teal-300">
                      {lang === "VN" ? "Đã hoàn" : "Refunded"}: {currencyFormatter.format(refundAmount)}
                    </p>
                  )}
                </div>
              </div>
              <p className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400 sm:text-right">
                {amount > 0 ? currencyFormatter.format(amount) : "--"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Quote response + PayOS payment UI for customer charter detail.
 * State and handlers stay in the parent — this component only renders.
 */
export function MyCharterPaymentPanel({
  lang,
  booking,
  currencyFormatter,
  paymentSectionRef,
  isPaid,
  isTerminalBooking,
  canShowPayOsSection,
  isSubmitting,
  isQuoteHoldExpired,
  isQuotePaymentExpired,
  showQuotePaymentCountdown,
  quotePaymentRemainingMs,
  expiredPendingPayment,
  expiredPaymentCheckoutUrl,
  paymentCheckoutUrl,
  isPaymentLinkExpired,
  hasPendingPayOs,
  canCreatePayment,
  selectablePaymentChoices,
  paymentSelectValue,
  setPaymentOption,
  usesDefaultDeposit,
  canPayDeposit,
  selectedPaymentAmount,
  effectivePaidAmount,
  remainingAmount,
  paymentPromotionCode,
  setPaymentPromotionCode,
  promoPreview,
  promoChecking,
  onApplyPromotionCode,
  onClearPromotionCode,
  effectiveCheckoutUrl,
  pendingPaymentOrderCode,
  pendingPaymentId,
  effectivePendingPaymentAmount,
  effectivePaymentDeadline,
  paymentWatcherRemainingMs,
  handleRespondToQuote,
  handleCreatePayment,
  openPaymentPage,
  handleSyncPayment,
  handleSyncPaymentByOrderCode,
  loadDetail,
}) {
  return (
    <>
      <div ref={paymentSectionRef} className="mt-5 scroll-mt-28">
        <CharterPaymentLedger
          payments={booking.payments}
          lang={lang}
          currencyFormatter={currencyFormatter}
        />

        {booking.status === "Quoted" && !isPaid ? (
          <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-[#D8E7EA] bg-linear-to-br from-[#F7FAFB] via-white to-[#F2F8F9] shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="border-b border-[#D8E7EA]/80 bg-white/80 px-5 py-5 dark:border-slate-700 dark:bg-slate-800/80 md:px-6">
              <h4 className="font-headline text-base font-black uppercase tracking-wide text-[#0E4050] dark:text-yellow-400">
                {lang === "VN" ? "Phản hồi báo giá" : "Respond to quote"}
              </h4>
              <p className="mt-1 max-w-xl text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                {lang === "VN"
                  ? "Chấp nhận để thanh toán, hoặc từ chối báo giá này."
                  : "Accept to proceed to payment, or reject this quote."}
              </p>
            </div>
            <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:flex-wrap md:px-6">
              <button
                type="button"
                onClick={() => handleRespondToQuote("Accept")}
                disabled={isSubmitting || isQuoteHoldExpired}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#124757] px-5 py-3.5 text-xs font-headline font-black uppercase tracking-wider text-white transition-colors hover:bg-[#0d3541] disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300"
              >
                {lang === "VN" ? "Chấp nhận" : "Accept"}
              </button>
              <button
                type="button"
                onClick={() => handleRespondToQuote("Reject")}
                disabled={isSubmitting || isQuoteHoldExpired}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-xs font-headline font-black uppercase tracking-wider text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
              >
                {lang === "VN" ? "Từ chối" : "Reject"}
              </button>
            </div>
            {isQuoteHoldExpired ? (
              <div className="border-t border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 md:px-6">
                {lang === "VN"
                  ? "Báo giá đã hết hạn phản hồi. Vui lòng tải lại booking."
                  : "This quote response window has expired. Please refresh the booking."}
              </div>
            ) : null}
          </div>
        ) : null}

        {isTerminalBooking ? (
          <div className="mt-5 rounded-[1.75rem] border border-slate-200 bg-slate-50 px-5 py-5 dark:border-slate-700 dark:bg-slate-900 md:px-6">
            <h4 className="font-headline text-sm font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
              {booking.status === "Cancelled"
                ? (lang === "VN" ? "Yêu cầu đã hủy" : "Request cancelled")
                : booking.status === "Expired"
                  ? (lang === "VN" ? "Yêu cầu đã hết hạn" : "Request expired")
                  : (lang === "VN" ? "Đã hoàn tiền" : "Refunded")}
            </h4>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {booking.status === "Cancelled" && ["depositpaid", "paid"].includes(String(booking.paymentStatus || "").toLowerCase())
                ? (lang === "VN"
                  ? "Booking đã hủy. Nếu chưa hoàn xong, hãy nhập thông tin ngân hàng để nhận hoàn tiền."
                  : "Booking cancelled. If refund is not finished, enter bank details to receive the refund.")
                : (lang === "VN"
                  ? "Không còn thao tác thanh toán cho yêu cầu này."
                  : "Payment actions are no longer available for this request.")}
            </p>
          </div>
        ) : null}

        {canShowPayOsSection ? (
          <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-[#D8E7EA] bg-linear-to-br from-[#F7FAFB] via-white to-[#F2F8F9] shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="border-b border-[#D8E7EA]/80 bg-white/80 px-5 py-5 dark:border-slate-700 dark:bg-slate-800/80 md:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="font-headline text-base font-black uppercase tracking-wide text-[#0E4050] dark:text-yellow-400">
                    {lang === "VN" ? "Thanh toán qua PayOS" : "Pay via PayOS"}
                  </h4>
                  <p className="mt-1 max-w-xl text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                    {lang === "VN"
                      ? "Chọn hình thức thanh toán rồi mở cổng PayOS để hoàn tất giao dịch."
                      : "Choose a payment option, then open PayOS to complete your transaction."}
                  </p>
                </div>
                {showQuotePaymentCountdown && (
                  <div className={`min-w-38 rounded-2xl border px-4 py-3 text-center ${
                    isQuotePaymentExpired
                      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                  }`}
                  >
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest opacity-80">
                      {lang === "VN" ? "Hạn 12h sau chốt giá" : "12h after quote"}
                    </p>
                    <p className="mt-1 font-headline text-2xl font-black tabular-nums">
                      {isQuotePaymentExpired ? (lang === "VN" ? "Hết hạn" : "Expired") : formatCountdown(quotePaymentRemainingMs)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-5 md:px-6">
              {isQuoteHoldExpired ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  <p className="text-sm font-bold">
                    {lang === "VN" ? "Đã quá 12h kể từ khi admin chốt giá. Vui lòng tải lại booking để cập nhật trạng thái." : "The 12-hour payment window after quoting has passed. Refresh the booking for the latest status."}
                  </p>
                  <button type="button" onClick={loadDetail} className="w-max rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider dark:bg-slate-900">
                    {lang === "VN" ? "Tải lại booking" : "Refresh booking"}
                  </button>
                </div>
              ) : (expiredPendingPayment || (Boolean(expiredPaymentCheckoutUrl || paymentCheckoutUrl) && isPaymentLinkExpired)) ? (
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    {lang === "VN" ? "Link thanh toán cũ đã hết hạn. Vui lòng tạo giao dịch thanh toán mới." : "The previous payment link has expired. Create a new payment transaction."}
                  </p>
                  <button type="button" onClick={handleCreatePayment} disabled={isSubmitting} className={`w-max ${payosButtonClassName}`}>
                    {!isSubmitting && <PayOSLogo variant="white" className="h-5 w-auto" />}
                    {isSubmitting ? (lang === "VN" ? "Đang tạo..." : "Creating...") : (lang === "VN" ? "Tạo lại thanh toán" : "Create new payment")}
                  </button>
                </div>
              ) : hasPendingPayOs ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-5 py-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#00a85e] px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider text-white">
                        {lang === "VN" ? "Chờ thanh toán" : "Awaiting payment"}
                      </span>
                      {effectivePaymentDeadline && shouldShowPaymentDeadlineCountdown({ paymentStatus: "pending" }, booking) ? (
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                          {lang === "VN" ? "Hạn" : "Due"}: {formatCountdown(paymentWatcherRemainingMs)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm font-bold text-emerald-950 dark:text-emerald-100">
                      {lang === "VN"
                        ? "Giao dịch đã sẵn sàng. Bạn sẽ được chuyển sang trang thanh toán PayOS để hoàn tất."
                        : "Your payment is ready. Continue on the PayOS checkout page to finish."}
                    </p>
                    <p className="mt-2 text-lg font-headline font-black text-[#00a85e]">
                      {effectivePendingPaymentAmount > 0 ? currencyFormatter.format(effectivePendingPaymentAmount) : "--"}
                    </p>
                  </div>

                  {effectiveCheckoutUrl ? (
                    <button
                      type="button"
                      onClick={() => openPaymentPage(effectiveCheckoutUrl, {
                        orderCode: pendingPaymentOrderCode,
                        amount: effectivePendingPaymentAmount,
                        expiresAt: effectivePaymentDeadline,
                      })}
                      className={payosButtonLgClassName}
                    >
                      <PayOSLogo variant="white" className="h-6 w-auto" />
                      <span>{lang === "VN" ? "Tiếp tục thanh toán trên PayOS" : "Continue to PayOS checkout"}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => pendingPaymentOrderCode ? handleSyncPaymentByOrderCode(pendingPaymentOrderCode) : handleSyncPayment(pendingPaymentId)}
                      disabled={isSubmitting || (!pendingPaymentOrderCode && !pendingPaymentId)}
                      className={payosButtonLgClassName}
                    >
                      <span>{lang === "VN" ? "Đồng bộ trạng thái thanh toán" : "Sync payment status"}</span>
                    </button>
                  )}

                  <p className="text-center text-[11px] font-medium text-slate-400">
                    {lang === "VN"
                      ? "Thanh toán trực tiếp trên cổng PayOS — không hiển thị mã QR trên trang này."
                      : "Pay directly on PayOS — no QR is shown on this page."}
                  </p>
                </div>
              ) : canCreatePayment ? (
                <div className="space-y-5">
                  {selectablePaymentChoices.length > 1 ? (
                    <div>
                      <p className="mb-3 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                        {lang === "VN" ? "Hình thức thanh toán" : "Payment option"}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {selectablePaymentChoices.map((choice) => {
                          const active = paymentSelectValue === choice.id;
                          return (
                            <button
                              key={choice.id}
                              type="button"
                              disabled={choice.disabled || booking.hasDepositPaid}
                              onClick={() => setPaymentOption(choice.id)}
                              className={`rounded-2xl border px-4 py-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                                active
                                  ? "border-[#124757] bg-[#124757]/5 shadow-[0_10px_30px_rgba(18,71,87,0.12)] ring-2 ring-[#124757]/10 dark:border-yellow-400 dark:bg-yellow-400/10 dark:ring-yellow-400/20"
                                  : "border-slate-200 bg-white hover:border-[#124757]/30 dark:border-slate-700 dark:bg-slate-900"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-headline text-sm font-black text-[#0E4050] dark:text-white">{choice.label}</p>
                                  <p className="mt-1 text-lg font-headline font-black text-[#124757] dark:text-yellow-400">
                                    {currencyFormatter.format(choice.amount)}
                                  </p>
                                  {Number(choice.originalAmount) > Number(choice.amount) ? (
                                    <p className="text-[11px] font-bold text-slate-400 line-through">
                                      {currencyFormatter.format(choice.originalAmount)}
                                    </p>
                                  ) : null}
                                  {choice.id === "Deposit" && usesDefaultDeposit && canPayDeposit && (
                                    <p className="mt-1 text-[10px] font-bold text-slate-400">
                                      {promoPreview?.ok
                                        ? (lang === "VN" ? "50% sau khuyến mãi" : "50% after promo")
                                        : (lang === "VN" ? "Mặc định 50% tổng giá" : "Default 50% of total")}
                                    </p>
                                  )}
                                </div>
                                <span className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${active ? "border-[#124757] bg-[#124757] dark:border-yellow-400 dark:bg-yellow-400" : "border-slate-300"}`} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#124757]/15 bg-[#124757]/5 px-4 py-4 dark:border-yellow-400/20 dark:bg-yellow-400/10">
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                        {lang === "VN" ? "Số tiền thanh toán" : "Payment amount"}
                      </p>
                      <p className="mt-1 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
                        {currencyFormatter.format(selectedPaymentAmount)}
                      </p>
                      {effectivePaidAmount > 0 && (
                        <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                          {lang === "VN"
                            ? `Đã chuyển ${currencyFormatter.format(effectivePaidAmount)} · Còn lại ${currencyFormatter.format(remainingAmount)}`
                            : `Paid ${currencyFormatter.format(effectivePaidAmount)} · Remaining ${currencyFormatter.format(remainingAmount)}`}
                        </p>
                      )}
                    </div>
                  )}

                  {booking.hasDepositPaid && (
                    <p className="text-xs font-bold leading-5 text-emerald-700 dark:text-emerald-300">
                      {lang === "VN"
                        ? `Đã thanh toán ${currencyFormatter.format(effectivePaidAmount)}. Lần này chỉ thu phần còn lại ${currencyFormatter.format(remainingAmount)}.`
                        : `Paid ${currencyFormatter.format(effectivePaidAmount)}. This payment only charges the remaining ${currencyFormatter.format(remainingAmount)}.`}
                    </p>
                  )}

                  {(booking.requiresAdditionalPayment || Number(booking.additionalInsuranceAmount) > 0) && (
                    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                      {lang === "VN"
                        ? `Phí bảo hiểm phát sinh${Number(booking.additionalInsuranceAmount) > 0 ? ` ${currencyFormatter.format(Number(booking.additionalInsuranceAmount))}` : ""} do thêm hành khách. Thanh toán phần còn lại để nhận boarding pass.`
                        : `Additional insurance${Number(booking.additionalInsuranceAmount) > 0 ? ` ${currencyFormatter.format(Number(booking.additionalInsuranceAmount))}` : ""} after passenger changes. Pay the remaining balance to unlock boarding passes.`}
                    </p>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                    <SelectablePublicVouchers
                      lang={lang}
                      bookingType={PROMOTION_BOOKING_TYPES.CHARTER}
                      selectedCode={paymentPromotionCode}
                      disabled={isSubmitting || promoChecking}
                      onChangeCode={(code) => setPaymentPromotionCode?.(code)}
                      onSelect={(code) => {
                        setPaymentPromotionCode?.(code);
                        onApplyPromotionCode?.(code);
                      }}
                      onClear={() => onClearPromotionCode?.()}
                      hint={lang === "VN"
                        ? "Chọn voucher hoặc nhập mã rồi Enter để áp dụng."
                        : "Pick a voucher or type a code and press Enter to apply."}
                    />
                    {promoChecking ? (
                      <p className="mt-2 text-xs font-bold text-slate-400">
                        {lang === "VN" ? "Đang kiểm tra mã…" : "Validating code…"}
                      </p>
                    ) : null}
                    {promoPreview?.ok ? (
                      <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {lang === "VN"
                          ? `Đã giảm ${currencyFormatter.format(promoPreview.discountAmount || 0)}`
                          : `Saved ${currencyFormatter.format(promoPreview.discountAmount || 0)}`}
                        {promoPreview.message ? ` · ${promoPreview.message}` : ""}
                      </p>
                    ) : null}
                    {promoPreview?.error ? (
                      <p className="mt-2 text-xs font-bold text-rose-600 dark:text-rose-300">{promoPreview.error}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleCreatePayment}
                      disabled={isSubmitting || !canCreatePayment}
                      className={`mt-4 ${payosButtonLgClassName}`}
                    >
                      {!isSubmitting && <PayOSLogo variant="white" className="h-6 w-auto" />}
                      <span>
                        {isSubmitting
                          ? (lang === "VN" ? "Đang tạo giao dịch..." : "Creating payment...")
                          : `${lang === "VN" ? "Thanh toán" : "Pay"} ${selectedPaymentAmount > 0 ? currencyFormatter.format(selectedPaymentAmount) : ""}`}
                      </span>
                    </button>
                    <p className="mt-3 text-center text-[11px] font-medium text-slate-400">
                      {lang === "VN" ? "Bạn sẽ được chuyển sang cổng thanh toán PayOS an toàn." : "You will be redirected to the secure PayOS payment gateway."}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-bold text-slate-400 dark:border-slate-700">
                  {lang === "VN" ? "Booking hiện chưa ở trạng thái cho phép thanh toán." : "Booking isn't eligible for payment right now."}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function MyCharterPaymentStickyBar({
  lang,
  isPaid,
  isSubmitting,
  canCreatePayment,
  hasPendingPayOs,
  selectedPaymentAmount,
  effectivePendingPaymentAmount,
  effectiveCheckoutUrl,
  pendingPaymentOrderCode,
  effectivePaymentDeadline,
  currencyFormatter,
  openPaymentPage,
  handleCreatePayment,
}) {
  if ((!canCreatePayment && !hasPendingPayOs) || isPaid) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-lg shadow-[0_-8px_30px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-900/95 md:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
            {hasPendingPayOs
              ? (lang === "VN" ? "Đang chờ thanh toán PayOS" : "PayOS payment pending")
              : (lang === "VN" ? "Cần thanh toán" : "Payment due")}
          </p>
          <p className="font-headline text-sm font-black text-[#124757] dark:text-yellow-400">
            {selectedPaymentAmount > 0 ? currencyFormatter.format(hasPendingPayOs ? effectivePendingPaymentAmount : selectedPaymentAmount) : "--"}
          </p>
        </div>
        {hasPendingPayOs && effectiveCheckoutUrl ? (
          <button
            type="button"
            onClick={() => openPaymentPage(effectiveCheckoutUrl, {
              orderCode: pendingPaymentOrderCode,
              amount: effectivePendingPaymentAmount,
              expiresAt: effectivePaymentDeadline,
            })}
            className={`shrink-0 px-4 py-3 ${payosButtonClassName}`}
          >
            <PayOSLogo variant="white" className="h-4 w-auto" />
            PayOS
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCreatePayment}
            disabled={isSubmitting || !canCreatePayment}
            className={`shrink-0 px-4 py-3 ${payosButtonClassName}`}
          >
            <PayOSLogo variant="white" className="h-4 w-auto" />
            {lang === "VN" ? "Thanh toán" : "Pay"}
          </button>
        )}
      </div>
    </div>
  );
}
