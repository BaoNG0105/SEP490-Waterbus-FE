import { useEffect, useState } from "react";
import { fetchActiveInsurancePackages, findInsurancePackageById } from "../services/insuranceService";
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
  bookingType = "PassengerInsurance",
}) {
  const selected = resolveInsuranceSelected(booking);
  const insurance = normalizeInsuranceFromBooking(booking);
  const [fetchedLogo, setFetchedLogo] = useState({ packageId: "", url: "" });
  const resolvedLogoUrl = insurance?.providerLogoUrl
    || (fetchedLogo.packageId === insurance?.packageId ? fetchedLogo.url : "");
  const isVn = lang === "VN";
  const unitNoun = isVn ? "khách" : "passenger";

  let statusLabel = isVn ? "Chưa rõ" : "Unknown";
  let statusTone = "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20";
  if (selected === true) {
    statusLabel = isVn ? "Có bảo hiểm" : "Insured";
    statusTone = "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20";
  } else if (selected === false) {
    statusLabel = isVn ? "Không bảo hiểm" : "No insurance";
    statusTone = "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
  }

  useEffect(() => {
    if (insurance?.providerLogoUrl || !insurance?.packageId || selected !== true) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const packages = await fetchActiveInsurancePackages(bookingType);
        if (cancelled) return;
        const matched = findInsurancePackageById(packages, insurance.packageId);
        const logo = matched?.providerLogoUrl || "";
        if (logo) setFetchedLogo({ packageId: insurance.packageId, url: logo });
      } catch {
        // Keep empty logo if package catalog is unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bookingType, insurance?.packageId, insurance?.providerLogoUrl, selected]);

  const formatMoney = (value) => {
    if (!currencyFormatter) return String(value ?? 0);
    return currencyFormatter.format(Number(value) || 0);
  };

  const openTerms = () => {
    if (!insurance?.terms) return;
    const logoHtml = resolvedLogoUrl
      ? `<img src="${escapeHtml(resolvedLogoUrl)}" alt="" style="height:40px;width:auto;object-fit:contain;margin:0 auto 12px;" />`
      : "";
    notify({
      dialog: true,
      title: isVn ? "Điều kiện bảo hiểm" : "Insurance terms",
      html: `${logoHtml}<p style="margin:0;text-align:left;font-size:14px;line-height:1.65;color:#334155;white-space:pre-wrap;">${escapeHtml(insurance.terms)}</p>`,
      confirmButtonText: isVn ? "Đóng" : "Close",
      showCancelButton: false,
      width: 560,
    });
  };

  const packageTitle = insurance?.packageName
    || (selected === true
      ? (isVn ? "Đã chọn bảo hiểm" : "Insurance selected")
      : (isVn ? "Không chọn bảo hiểm" : "No insurance selected"));
  const providerLine = insurance?.providerName || "";
  const hasQuotedFee = selected === true && Number(insurance?.quantity) > 0 && (
    Number(insurance?.totalAmount) > 0 || Number(insurance?.unitPremiumAmount) > 0
  );
  const feeFormula = (() => {
    if (!hasQuotedFee) return "";
    const unit = insurance?.unitPremiumAmount > 0
      ? `${formatMoney(insurance.unitPremiumAmount)}/${unitNoun}`
      : "";
    const qtyNoun = insurance.quantity === 1
      ? unitNoun
      : (isVn ? "khách" : "passengers");
    const qty = `${insurance.quantity} ${qtyNoun}`;
    if (unit) return `${unit} × ${qty}`;
    return qty;
  })();
  const totalLabel = hasQuotedFee && insurance?.totalAmount > 0
    ? formatMoney(insurance.totalAmount)
    : "";
  const coverageLabel = selected === true && Number(insurance?.coverageAmount) > 0
    ? formatMoney(insurance.coverageAmount)
    : "";
  const hasTerms = selected === true && Boolean(insurance?.terms);

  return (
    <div className={`rounded-3xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <div className="flex items-center justify-between gap-3">
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
          {hasTerms ? (
            <button
              type="button"
              onClick={openTerms}
              title={isVn ? "Điều kiện bảo hiểm" : "Insurance terms"}
              aria-label={isVn ? "Điều kiện bảo hiểm" : "Insurance terms"}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-[#124757]/40 hover:text-[#124757] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-yellow-400/40 dark:hover:text-yellow-400"
            >
              <span className="material-symbols-outlined text-[14px]">info</span>
            </button>
          ) : null}
        </div>
      </div>

      {selected === true ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-start gap-3">
            {resolvedLogoUrl ? (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 ring-1 ring-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.08)] dark:ring-slate-200">
                <img
                  src={resolvedLogoUrl}
                  alt={providerLine || (isVn ? "Logo bảo hiểm" : "Insurance logo")}
                  className="h-full w-full object-contain"
                />
              </span>
            ) : null}

            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-sm font-headline font-black text-[#0E4050] dark:text-white">
                {packageTitle}
              </p>
              {providerLine ? (
                <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {providerLine}
                </p>
              ) : null}
            </div>
          </div>

          {hasQuotedFee ? (
            <div className="space-y-2">
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
                  {totalLabel || "—"}
                </p>
              </div>
              {coverageLabel ? (
                <p className="px-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isVn ? "Mức bảo hiểm" : "Coverage"}:{" "}
                  <span className="font-bold text-slate-700 dark:text-slate-200">{coverageLabel}</span>
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isVn
                ? "Đã chọn gói — phí = đơn giá × số hành khách."
                : "Package selected — fee = unit price × passenger count."}
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
