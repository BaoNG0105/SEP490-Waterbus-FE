import { normalizeInsuranceFromBooking, resolveInsuranceSelected } from "../utils/insurancePreview";
import { notify } from "../utils/swalToast";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export function CharterInsuranceInfo({
  booking,
  lang = "VN",
  currencyFormatter,
  className = "",
}) {
  const selected = resolveInsuranceSelected(booking);
  const insurance = normalizeInsuranceFromBooking(booking);
  const isVn = lang === "VN";
  const unitNoun = isVn ? "khách" : "passenger";

  const insuranceMode = insurance?.mode
    || (insurance?.optional ? "default+optional" : (selected === true ? "default" : "none"));
  const defaultLeg = insurance?.default || null;
  const optionalLeg = insurance?.optional || null;
  const defaultAmount = Number(insurance?.defaultInsuranceAmount) || 0;
  const optionalAmount = Number(insurance?.optionalInsuranceAmount) || 0;
  const totalAmount = Number(insurance?.totalInsuranceAmount ?? insurance?.totalAmount) || 0;

  let statusLabel = isVn ? "Chưa rõ" : "Unknown";
  let statusTone = "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20";
  if (selected === true) {
    if (insuranceMode === "default+optional") {
      statusLabel = isVn ? "Mặc định + bên thứ 3" : "Default + third-party";
    } else if (insuranceMode === "default") {
      statusLabel = isVn ? "Bảo hiểm mặc định" : "Default insurance";
    } else {
      statusLabel = isVn ? "Có bảo hiểm" : "Insured";
    }
    statusTone = "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20";
  } else if (selected === false) {
    statusLabel = isVn ? "Không bảo hiểm" : "No insurance";
    statusTone = "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
  }

  const formatMoney = (value) => {
    if (!currencyFormatter) return String(value ?? 0);
    return currencyFormatter.format(Number(value) || 0);
  };

  const openTerms = (target) => {
    if (!target?.terms) return;
    const logoHtml = target.providerLogoUrl
      ? `<img src="${escapeHtml(target.providerLogoUrl)}" alt="" style="height:40px;width:auto;object-fit:contain;margin:0 auto 12px;" />`
      : "";
    notify({
      dialog: true,
      title: isVn ? "Điều kiện bảo hiểm" : "Insurance terms",
      html: `${logoHtml}<p style="margin:0;text-align:left;font-size:14px;line-height:1.65;color:#334155;white-space:pre-wrap;">${escapeHtml(target.terms)}</p>`,
      confirmButtonText: isVn ? "Đóng" : "Close",
      showCancelButton: false,
      width: 560,
    });
  };

  const renderLegRow = (leg, label, amount) => {
    if (!leg && amount <= 0) return null;
    const packageTitle = leg?.packageName
      || (isVn ? "Bảo hiểm mặc định" : "Default insurance");
    const providerLine = leg?.providerName || "";
    const unitPremiumLabel = leg?.unitPremiumAmount
      ? `${formatMoney(leg.unitPremiumAmount)}/${unitNoun}`
      : "";
    const qty = leg?.quantity
      ? `${leg.quantity} ${leg.quantity === 1 ? unitNoun : (isVn ? "khách" : "passengers")}`
      : "";
    const formula = [unitPremiumLabel, qty].filter(Boolean).join(" × ");
    const hasTerms = Boolean(leg?.terms);
    return (
      <div className="rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/80 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
              {label}
            </p>
            <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
              {packageTitle}
            </p>
            {providerLine ? (
              <p className="text-[10px] font-bold text-slate-400 truncate">{providerLine}</p>
            ) : null}
            {formula ? (
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">{formula}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasTerms ? (
              <button
                type="button"
                onClick={() => openTerms(leg)}
                title={isVn ? "Điều kiện bảo hiểm" : "Insurance terms"}
                aria-label={isVn ? "Điều kiện bảo hiểm" : "Insurance terms"}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-[#124757]/40 hover:text-[#124757] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-yellow-400/40 dark:hover:text-yellow-400"
              >
                <span className="material-symbols-outlined text-[14px]">info</span>
              </button>
            ) : null}
            <p className="text-sm font-headline font-black tabular-nums text-[#124757] dark:text-yellow-400">
              {amount > 0 ? formatMoney(amount) : "—"}
            </p>
          </div>
        </div>
        {leg?.coverageAmount > 0 ? (
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {isVn ? "Mức bảo hiểm" : "Coverage"}:{" "}
            <span className="font-bold text-slate-700 dark:text-slate-200">{formatMoney(leg.coverageAmount)}</span>
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`rounded-3xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 ${className}`}>      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {isVn ? "Bảo hiểm hành khách" : "Passenger insurance"}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${statusTone
              .split(" ")
              .filter((cls) => cls.includes("text-"))
              .join(" ")
            }`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {selected === true ? (
        <div className="mt-3 space-y-2.5">
          {(defaultLeg || defaultAmount > 0)
            ? renderLegRow(defaultLeg, isVn ? "Phí bảo hiểm mặc định" : "Default insurance fee", defaultAmount)
            : null}
          {(optionalLeg || optionalAmount > 0)
            ? renderLegRow(optionalLeg, isVn ? "Phí bảo hiểm bên thứ 3" : "Third-party insurance fee", optionalAmount)
            : null}
          {insuranceMode === "default+optional" && totalAmount > 0 ? (
            <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-[#124757]/30 bg-[#124757]/5 px-3 py-2.5 dark:border-yellow-400/30 dark:bg-yellow-400/10">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-[#124757] dark:text-yellow-400">
                {isVn ? "Tổng phí bảo hiểm" : "Total insurance fee"}
              </p>
              <p className="text-sm font-headline font-black tabular-nums text-[#124757] dark:text-yellow-400">
                {formatMoney(totalAmount)}
              </p>
            </div>
          ) : null}
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
