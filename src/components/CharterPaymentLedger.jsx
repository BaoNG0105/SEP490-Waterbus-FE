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
      return { label: lang === "VN" ? "Đã thanh toán" : "Paid", classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20", icon: "check_circle" };
    case "depositpaid":
      return { label: lang === "VN" ? "Đã đặt cọc" : "Deposit paid", classes: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20", icon: "savings" };
    case "pending":
      return { label: lang === "VN" ? "Đang chờ" : "Pending", classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20", icon: "schedule" };
    case "refunded":
      return { label: lang === "VN" ? "Đã hoàn" : "Refunded", classes: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20", icon: "currency_exchange" };
    case "failed":
    case "cancelled":
      return { label: lang === "VN" ? "Thất bại" : "Failed", classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20", icon: "error" };
    default:
      return { label: status || "--", classes: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700", icon: "receipt" };
  }
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return `${date.toLocaleDateString("vi-VN")} ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
};

export function CharterPaymentLedger({ payments = [], lang = "VN", currencyFormatter }) {
  if (!Array.isArray(payments) || payments.length === 0) return null;

  return (
    <div className="mt-5 rounded-3xl border border-[#D8E7EA] bg-[#F7FAFB] p-4 dark:border-slate-700 dark:bg-slate-900/50 md:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-lg text-[#124757] dark:text-yellow-400">receipt_long</span>
        <h3 className="text-[11px] font-headline font-black uppercase tracking-widest text-[#124757] dark:text-yellow-400">
          {lang === "VN" ? "Lịch sử giao dịch" : "Payment history"}
        </h3>
      </div>

      <div className="space-y-3">
        {payments.map((payment, index) => {
          const amount = Number(pick(payment, ["amount", "paymentAmount", "paidAmount", "totalAmount"], 0)) || 0;
          const status = pick(payment, ["paymentStatus", "status"], "--");
          const meta = getPaymentStatusMeta(status, lang);
          const createdAt = pick(payment, ["createdAt", "paidAt", "updatedAt"], "");
          const orderCode = pick(payment, ["orderCode", "paymentOrderCode", "payosOrderCode"], "");
          const refundAmount = Number(pick(payment, ["refundAmount", "refundedAmount"], 0)) || 0;

          return (
            <div
              key={pick(payment, ["paymentId", "id"], index)}
              className="flex flex-col gap-3 rounded-2xl border border-white bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.classes}`}>
                  <span className="material-symbols-outlined text-lg">{meta.icon}</span>
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-headline font-black uppercase tracking-wider ${meta.classes}`}>
                      {meta.label}
                    </span>
                    {orderCode && (
                      <span className="text-[10px] font-bold text-slate-400">
                        #{String(orderCode).slice(-8)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-400">{formatDateTime(createdAt)}</p>
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
