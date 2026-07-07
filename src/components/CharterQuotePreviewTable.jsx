import {
  buildQuotePreviewModel,
  formatQuoteRentalUnit,
  getQuoteDiscountLabel,
} from "../utils/charterQuotePreview";

const moneyClass = "font-headline font-black tabular-nums text-[#124757] dark:text-yellow-400";

function InvoiceDivider() {
  return <div className="border-t border-dashed border-slate-200 dark:border-slate-700" />;
}

function InvoiceRow({ label, detail, amount, amountClass = "", indent = false, bold = false }) {
  const labelClass = bold
    ? "text-xs font-headline font-black uppercase tracking-wide text-slate-800 dark:text-white"
    : "text-xs font-medium text-slate-600 dark:text-slate-300";
  const rowClass = indent ? "pl-4" : "";

  return (
    <div className={`flex items-start justify-between gap-4 py-1.5 ${rowClass}`}>
      <div className="min-w-0 flex-1">
        <p className={labelClass}>{label}</p>
        {detail ? <p className="mt-0.5 text-[10px] font-medium text-slate-400">{detail}</p> : null}
      </div>
      {amount ? (
        <p className={`shrink-0 text-right text-xs ${amountClass || "font-bold text-slate-700 dark:text-slate-200"}`}>
          {amount}
        </p>
      ) : null}
    </div>
  );
}

export function CharterQuotePreviewTable({
  preview,
  quoteForm = {},
  lang = "VN",
  currencyFormatter,
}) {
  const model = buildQuotePreviewModel(preview, {
    defaultRentalUnit: quoteForm?.rentalUnit ?? "Day",
    currencyFormatter,
    lang,
  });

  if (!model.boatRows.length) return null;

  const fmt = (value) => currencyFormatter.format(Number(value) || 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60">
        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Báo giá" : "Quote"}
        </p>
        <p className="mt-0.5 text-sm font-headline font-black text-[#124757] dark:text-yellow-400">
          {model.rentalUnitLabel}
        </p>
      </div>

      <div className="space-y-1 px-4 py-3">
        {model.routeLines.length > 0 ? (
          <>
            {model.routeLines.map((line) => (
              <InvoiceRow
                key={line.key}
                label={line.label}
                detail={line.amount ? line.detail : undefined}
                amount={line.amount ? fmt(line.amount) : (line.detail || null)}
              />
            ))}
            <InvoiceDivider />
          </>
        ) : null}

        {model.boatRows.map((row) => (
          <div key={`boat-${row.boatOrder}`} className="space-y-0.5">
            <InvoiceRow
              bold
              label={row.boatName
                ? (lang === "VN" ? `Tàu ${row.boatOrder} · ${row.boatName}` : `Boat ${row.boatOrder} · ${row.boatName}`)
                : (lang === "VN" ? `Tàu ${row.boatOrder}` : `Boat ${row.boatOrder}`)}
              detail={formatQuoteRentalUnit(row.rentalUnit, lang)}
            />
            <InvoiceRow
              indent
              label={lang === "VN" ? "Đơn giá thuê" : "Unit price"}
              amount={row.unitPriceLabel}
            />
            <InvoiceRow
              indent
              label={lang === "VN" ? "Tính tiền" : "Chargeable"}
              detail={row.durationLabel}
              amount={fmt(row.lineTotal)}
              amountClass={`text-sm ${moneyClass}`}
            />
            <InvoiceDivider />
          </div>
        ))}

        <InvoiceRow
          label={lang === "VN" ? "Cộng tự động" : "Auto subtotal"}
          amount={fmt(model.autoSubtotal)}
        />

        {model.discountAmount > 0 ? (
          <InvoiceRow
            label={getQuoteDiscountLabel(model, lang)}
            amount={`-${fmt(model.discountAmount)}`}
            amountClass="text-sm font-headline font-black text-emerald-600 dark:text-emerald-400"
          />
        ) : null}

        <InvoiceDivider />

        <InvoiceRow
          bold
          label={lang === "VN" ? "Tổng cộng" : "Grand total"}
          amount={fmt(model.totalAmount)}
          amountClass={`text-base ${moneyClass}`}
        />
        <InvoiceRow
          label={lang === "VN" ? "Đặt cọc 50%" : "Deposit 50%"}
          amount={fmt(model.deposit)}
          amountClass="text-sm font-headline font-black text-emerald-700 dark:text-emerald-300"
        />
      </div>
    </div>
  );
}

export function CharterQuotePreviewPanel({
  lang,
  currencyFormatter,
  isPreviewLoading,
  quotePreviewError,
  quotePreview,
  quoteForm,
  isQuoteBoatSelectionComplete,
  compact = false,
}) {
  const wrapperClass = compact
    ? "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50"
    : "rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800";

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
          {lang === "VN" ? "Preview giá" : "Quote preview"}
        </h3>
        {isPreviewLoading ? (
          <span className="text-[10px] font-bold text-slate-400">{lang === "VN" ? "Đang tính..." : "Calculating..."}</span>
        ) : null}
      </div>

      {quotePreviewError ? (
        <p className="mt-4 text-xs font-bold text-red-500">{quotePreviewError}</p>
      ) : quotePreview ? (
        <div className="mt-4">
          <CharterQuotePreviewTable
            preview={quotePreview}
            quoteForm={quoteForm}
            lang={lang}
            currencyFormatter={currencyFormatter}
          />
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-xs font-bold text-slate-400 dark:border-slate-700">
          {isQuoteBoatSelectionComplete
            ? (lang === "VN" ? "Chọn tàu xong — preview sẽ tự hiện." : "Select boats to see the preview.")
            : (lang === "VN" ? "Chọn đủ tàu để xem giá." : "Select all boats to preview pricing.")}
        </p>
      )}
    </div>
  );
}
