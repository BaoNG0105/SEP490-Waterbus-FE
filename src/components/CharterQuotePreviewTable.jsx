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
  booking = null,
  quoteForm = {},
  boatsCatalog = [],
  getBoatId,
  getBoatPrice,
  lang = "VN",
  currencyFormatter,
}) {
  const forcedRentalUnit = quoteForm?.rentalUnit === "Day" || quoteForm?.rentalUnit === "Hour"
    ? quoteForm.rentalUnit
    : "";
  const model = buildQuotePreviewModel(preview, {
    defaultRentalUnit: forcedRentalUnit || "Day",
    forcedRentalUnit,
    boatsCatalog,
    quoteBoats: Array.isArray(quoteForm?.boats) ? quoteForm.boats : [],
    getBoatId,
    getBoatPrice,
    currencyFormatter,
    lang,
    booking,
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

        {model.insurance && model.insurance.selected !== false ? (
          <InvoiceRow
            label={lang === "VN" ? "Bảo hiểm hành khách" : "Passenger insurance"}
            detail={model.insurance.quantity > 0
              ? `${fmt(model.insurance.unitPremiumAmount || 0)}/${lang === "VN" ? "ghế" : "seat"} × ${model.insurance.quantity} ${lang === "VN" ? "ghế" : "seats"}`
              : (model.insurance.packageName || (lang === "VN" ? "Đã chọn" : "Selected"))}
            amount={fmt(model.insurance.totalAmount || 0)}
            amountClass={`text-sm ${moneyClass}`}
          />
        ) : null}

        <InvoiceDivider />

        <InvoiceRow
          bold
          label={lang === "VN" ? "Tạm tính" : "Subtotal"}
          amount={fmt(model.grossTotal)}
          amountClass="text-sm font-headline font-black text-slate-800 dark:text-white"
        />

        {model.discountAmount > 0 ? (
          <InvoiceRow
            label={getQuoteDiscountLabel(model, lang)}
            amount={`-${fmt(model.discountAmount)}`}
            amountClass="text-sm font-headline font-black text-emerald-600 dark:text-emerald-400"
          />
        ) : null}

        {model.pointsUsed > 0 ? (
          <InvoiceRow
            label={lang === "VN" ? "Điểm đã sử dụng" : "Points used"}
            detail={lang === "VN"
              ? `${Number(model.pointsUsed).toLocaleString("vi-VN")} điểm · 1 điểm = 1 VND`
              : `${Number(model.pointsUsed).toLocaleString("en-US")} points · 1 point = 1 VND`}
            amount={`-${fmt(model.pointsUsed)}`}
            amountClass="text-sm font-headline font-black text-sky-700 dark:text-sky-300"
          />
        ) : null}

        {model.unclassifiedDeduction > 0 ? (
          <InvoiceRow
            label={lang === "VN" ? "Khuyến mãi / điểm" : "Promotion / points"}
            amount={`-${fmt(model.unclassifiedDeduction)}`}
            amountClass="text-sm font-headline font-black text-sky-700 dark:text-sky-300"
          />
        ) : null}

        <InvoiceDivider />

        <InvoiceRow
          bold
          label={lang === "VN" ? "Cần thanh toán" : "Amount payable"}
          amount={fmt(model.payableAmount)}
          amountClass={`text-base ${moneyClass}`}
        />
        {model.showDeposit ? (
          <InvoiceRow
            label={lang === "VN" ? "Đặt cọc 50%" : "Deposit 50%"}
            amount={fmt(model.deposit)}
            amountClass="text-sm font-headline font-black text-emerald-700 dark:text-emerald-300"
          />
        ) : null}
        {model.paidByPoints ? (
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="material-symbols-outlined text-base">verified</span>
            <span>{lang === "VN" ? "Đã thanh toán bằng điểm" : "Paid with points"}</span>
          </div>
        ) : null}
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
  booking = null,
  quoteForm,
  boatsCatalog = [],
  getBoatId,
  getBoatPrice,
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
            booking={booking}
            quoteForm={quoteForm}
            boatsCatalog={boatsCatalog}
            getBoatId={getBoatId}
            getBoatPrice={getBoatPrice}
            lang={lang}
            currencyFormatter={currencyFormatter}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-xs font-bold text-slate-400 dark:border-slate-700">
            {lang === "VN"
              ? "Hãy chọn đủ tuyến & tàu rồi nhấn xem trước giá"
              : "Please select route & boats, then click preview quote"}
          </p>
          {isPreviewLoading ? (
            <p className="text-center text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
              {lang === "VN" ? "Đang tính..." : "Calculating..."}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
