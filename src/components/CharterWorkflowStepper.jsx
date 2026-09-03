import { WORKFLOW_STEPS, getWorkflowStepIndex, isTerminalBookingStatus } from "../utils/charterBookingActions";

/**
 * Compact horizontal stepper cho tiến trình booking.
 * - 5 booking step theo BE: PendingQuote → Quoted → PendingPayment → Confirmed → Completed.
 * - Paid chỉ là trạng thái thanh toán, hiển thị như 1 dải phụ dưới stepper.
 */

const PAYMENT_LABELS = {
  VN: { paid: "Đã thanh toán đủ", depositpaid: "Đã đặt cọc", paidwithpoints: "Đã thanh toán bằng điểm", unpaid: "Chưa thanh toán", refunded: "Đã hoàn tiền" },
  EN: { paid: "Fully paid", depositpaid: "Deposit paid", paidwithpoints: "Paid with points", unpaid: "Unpaid", refunded: "Refunded" },
};

const formatVndShort = (value) => {
  const amount = Math.max(0, Number(value) || 0);
  return `${amount.toLocaleString("vi-VN")} VND`;
};

export function CharterWorkflowStepper({ status, paymentStatus, lang = "VN", compact = false, booking }) {
  const terminal = isTerminalBookingStatus(status);
  const currentIndex = getWorkflowStepIndex(status);
  const normalizedPayment = String(paymentStatus || "").toLowerCase();
  // Chưa có báo giá (PendingQuote) thì KHÔNG hiển thị payment indicator kiểu "đã thanh toán"
  // — lấy đâu ra "đủ" khi estimatedPrice còn = 0. Tránh ảo giác "đã thanh toán đủ".
  const hasQuote = Boolean(
    booking
    && (Number(booking.estimatedPrice ?? booking.totalAmount ?? 0) > 0
      || String(status || "").toLowerCase() !== "pendingquote")
  );
  // Chỉ BE xác định số dư. Không suy ra từ việc booking đã từng trả cọc.
  const hasRemainingBalance = Boolean(
    booking
    && (
      booking.requiresAdditionalPayment === true
      || Number(booking.balanceDue ?? booking.remainingAmount ?? 0) > 0
    )
  );
  // BE có thể trả "PaidWithPoints" (PascalCase) — chuẩn hoá về lowercase.
  // Trường hợp user dùng điểm 100% (estimatedPayable=0) và booking đã đủ → chuyển sang "paidwithpoints".
  const pointsRedeemed = Number(booking?.pointsRedeemed ?? booking?.usedPoints ?? 0) > 0;
  const effectivePayment = (() => {
    if (normalizedPayment === "paidwithpoints") return "paidwithpoints";
    if (normalizedPayment === "paid" && hasRemainingBalance) return "depositpaid";
    if (normalizedPayment === "paid" && pointsRedeemed) return "paidwithpoints";
    return normalizedPayment;
  })();
  const isFullyPaid = !hasRemainingBalance
    && (effectivePayment === "paid" || effectivePayment === "paidwithpoints");

  const remainingAmount = (() => {
    if (!booking) return 0;
    if (!hasQuote) return 0; // chưa báo giá thì remaining = 0 (không có nghĩa "đã đủ")
    const rawRemaining = booking.remainingAmount ?? booking.balanceDue;
    if (rawRemaining !== null && rawRemaining !== undefined && rawRemaining !== "") {
      const remaining = Number(rawRemaining);
      if (Number.isFinite(remaining)) return Math.max(remaining, 0);
    }
    if (hasRemainingBalance) return null;
    const total = Math.max(0, Number(booking.totalAmount ?? booking.estimatedPrice ?? 0) || 0);
    const paid = Math.max(0, Number(booking.paidAmount ?? 0) || 0);
    const depositFallback = booking.hasDepositPaid
      ? Math.max(0, Number(booking.paidDepositAmount ?? booking.depositAmount ?? 0) || 0)
      : 0;
    return Math.max(total - Math.max(paid, depositFallback), 0);
  })();

  if (terminal) {
    return (
      <div className={`flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900/60 ${compact ? "py-2" : "py-3"}`}>
        <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
          {lang === "VN" ? "Yêu cầu đã đóng" : "Request closed"}
        </span>
      </div>
    );
  }

  const stepCount = WORKFLOW_STEPS.length;
  const progressRatio = stepCount > 1 ? Math.max(0, Math.min(currentIndex, stepCount - 1)) / (stepCount - 1) : 0;
  const paymentLabel = PAYMENT_LABELS[lang]?.[effectivePayment] || paymentStatus || "--";

  return (
    <div className="space-y-3">
      {/* 5 booking steps */}
      <div className="relative">
        <div className="pointer-events-none absolute left-[10%] right-[10%] top-3.5 z-0 h-0.5 -translate-y-1/2 bg-slate-200 dark:bg-slate-700" />
        <div
          className="pointer-events-none absolute left-[10%] top-3.5 z-0 h-0.5 -translate-y-1/2 bg-[#FFD100] transition-all duration-300"
          style={{ width: `calc(80% * ${progressRatio})` }}
        />
        <div className={`relative z-10 grid grid-cols-5 ${compact ? "gap-1" : "gap-2"}`}>
          {WORKFLOW_STEPS.map((step, index) => {
            // PendingQuote: step đầu luôn active, không "done" — chưa được báo giá thì chưa hoàn thành.
            const isQuoteStep = String(status || "").toLowerCase() === "pendingquote"
              && index === currentIndex;
            // Đã xác nhận là một mốc nghiệp vụ hoàn tất, không phụ thuộc vào việc
            // suy luận trạng thái thanh toán từ dữ liệu booking.
            const isConfirmedStep = step.id === "Confirmed" && String(status || "") === "Confirmed";
            const isCompletedStep = step.id === "Completed" && String(status || "") === "Completed";
            const done = !isQuoteStep && (
              index < currentIndex
              || (index === currentIndex && (isFullyPaid || isConfirmedStep || isCompletedStep))
            );
            const active = index === currentIndex && !done;
            const upcoming = index > currentIndex;
            return (
              <div key={step.id} className="min-w-0 text-center">
                <div className="flex items-center justify-center">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all ${active
                        ? "border-[#124757] bg-[#124757] text-white shadow-md shadow-[#124757]/20 dark:border-yellow-400 dark:bg-yellow-400 dark:text-slate-900"
                        : done
                          ? "border-[#FFD100] bg-[#FFD100] text-[#124757]"
                          : "border-slate-200 bg-white text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                      }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {done ? "check" : step.icon}
                    </span>
                  </span>
                </div>
                {!compact && (
                  <p
                    className={`mt-1.5 truncate text-[9px] font-headline font-black uppercase tracking-wide ${active
                        ? "text-[#124757] dark:text-yellow-400"
                        : upcoming
                          ? "text-slate-300 dark:text-slate-600"
                          : "text-slate-400"
                      }`}
                  >
                    {lang === "VN" ? step.labelVn : step.labelEn}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment indicator — chỉ hiển thị khi đã có báo giá. Chưa có giá thì hiển thị
          "Chờ báo giá" thay vì ảo giác "Đã thanh toán đủ" (vì remainingAmount = 0). */}
      <div className={`flex items-center justify-center gap-2 rounded-xl px-3 ${compact ? "py-1 text-[9px]" : "py-1.5 text-[10px]"} font-headline font-black uppercase tracking-wider ${!hasQuote
          ? "bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-300"
          : isFullyPaid
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : effectivePayment === "depositpaid"
            ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
            : effectivePayment === "refunded"
              ? "bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-300"
              : "bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-300"
        }`}>
          <span className={`material-symbols-outlined ${compact ? "text-[12px]" : "text-[14px]"}`}>
            {!hasQuote
              ? "hourglass_top"
              : isFullyPaid
                ? "verified"
                : effectivePayment === "depositpaid"
                  ? "savings"
                  : effectivePayment === "refunded"
                    ? "undo"
                    : "account_balance_wallet"}
          </span>
          <span>
            {!hasQuote ? (
              <strong className="font-black">
                {lang === "VN" ? "Chờ báo giá" : "Awaiting quote"}
              </strong>
            ) : isFullyPaid ? (
              <>
                {lang === "VN" ? "Thanh toán: " : "Payment: "}
                <strong className="font-black">{isFullyPaid || effectivePayment === "paid" || effectivePayment === "paidwithpoints" || effectivePayment === "refunded" ? paymentLabel : "Đã thanh toán đủ"}</strong>
              </>
            ) : effectivePayment === "depositpaid" && Number.isFinite(remainingAmount) && remainingAmount > 0 ? (
              <>
                {lang === "VN" ? "Còn lại: " : "Remaining: "}
                <strong className="font-black">
                  {formatVndShort(remainingAmount)}
                </strong>
              </>
            ) : (
              <>
                {lang === "VN" ? "Thanh toán: " : "Payment: "}
                <strong className="font-black">{paymentLabel}</strong>
              </>
            )}
          </span>
        </div>
    </div>
  );
}
