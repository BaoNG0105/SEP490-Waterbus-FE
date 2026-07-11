import Swal from "sweetalert2";
import { normalizeInsuranceFromBooking, resolveInsuranceSelected } from "../utils/insurancePreview";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

export function CharterInsuranceInfo({
  booking,
  lang = "VN",
  currencyFormatter,
  className = "",
}) {
  const selected = resolveInsuranceSelected(booking);
  const insurance = normalizeInsuranceFromBooking(booking);
  const isVn = lang === "VN";
  const statusLabel = selected === true
    ? (isVn ? "Có bảo hiểm" : "Insured")
    : selected === false
      ? (isVn ? "Không bảo hiểm" : "No insurance")
      : (isVn ? "Chưa rõ" : "Unknown");
  const statusTone = selected === true
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
    : selected === false
      ? "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
      : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20";

  const formatMoney = (value) => {
    if (!currencyFormatter) return String(value ?? 0);
    return currencyFormatter.format(Number(value) || 0);
  };

  const openTerms = () => {
    if (!insurance?.terms) return;
    Swal.fire({
      title: isVn ? "Điều kiện bảo hiểm" : "Insurance terms",
      html: `<p style="margin:0;text-align:left;font-size:14px;line-height:1.65;color:#334155;white-space:pre-wrap;">${escapeHtml(insurance.terms)}</p>`,
      confirmButtonText: isVn ? "Đóng" : "Close",
      confirmButtonColor: "#124757",
      width: 560,
    });
  };

  const packageTitle = insurance?.packageName
    || (selected === true
      ? (isVn ? "Đã chọn bảo hiểm" : "Insurance selected")
      : (isVn ? "Không chọn bảo hiểm" : "No insurance selected"));
  const providerLine = insurance?.providerName || "";
  const hasFeeDetail = selected === true && (
    insurance?.unitPremiumAmount > 0
    || insurance?.quantity > 0
    || insurance?.totalAmount > 0
  );
  const feeFormula = (() => {
    if (!hasFeeDetail) return "";
    const unit = insurance?.unitPremiumAmount > 0
      ? `${formatMoney(insurance.unitPremiumAmount)}${isVn ? "/ghế" : "/seat"}`
      : "";
    const qty = insurance?.quantity > 0
      ? `${insurance.quantity} ${isVn ? "ghế" : (insurance.quantity === 1 ? "seat" : "seats")}`
      : "";
    if (unit && qty) return `${unit} × ${qty}`;
    return unit || qty;
  })();
  const totalLabel = selected === true
    ? (insurance?.totalAmount > 0
      ? formatMoney(insurance.totalAmount)
      : (isVn ? "Có trong báo giá" : "In quote"))
    : "";

  return (
    <div className={`rounded-3xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-slate-400">
          <span className="material-symbols-outlined text-lg">health_and_safety</span>
          <p className="text-[10px] font-headline font-black uppercase tracking-widest">
            {isVn ? "Bảo hiểm hành khách" : "Passenger insurance"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider ring-1 ${statusTone}`}>
            {statusLabel}
          </span>
          {selected === true && insurance?.terms ? (
            <button
              type="button"
              onClick={openTerms}
              title={isVn ? "Xem điều kiện" : "View terms"}
              aria-label={isVn ? "Xem điều kiện bảo hiểm" : "View insurance terms"}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:border-[#124757]/40 hover:text-[#124757] dark:border-slate-600 dark:bg-slate-800 dark:hover:border-yellow-400/40 dark:hover:text-yellow-400"
            >
              <span className="material-symbols-outlined text-[16px]">info</span>
            </button>
          ) : null}
        </div>
      </div>

      {selected === true ? (
        <div className="mt-3 space-y-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-headline font-black text-slate-800 dark:text-white">
              {packageTitle}
            </p>
            {providerLine ? (
              <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                {providerLine}
              </p>
            ) : null}
          </div>

          {hasFeeDetail || totalLabel ? (
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/80">
              <div className="min-w-0">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                  {isVn ? "Phí bảo hiểm" : "Insurance fee"}
                </p>
                {feeFormula ? (
                  <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{feeFormula}</p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-headline font-black tabular-nums text-[#124757] dark:text-yellow-400">
                {totalLabel}
              </p>
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isVn
                ? "Chi tiết phí sẽ có khi có báo giá."
                : "Fee details appear once quoted."}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
          {selected === false
            ? (isVn ? "Yêu cầu này không kèm bảo hiểm." : "This request does not include insurance.")
            : (isVn ? "Chưa có thông tin bảo hiểm từ hệ thống." : "Insurance status is not available yet.")}
        </p>
      )}
    </div>
  );
}
