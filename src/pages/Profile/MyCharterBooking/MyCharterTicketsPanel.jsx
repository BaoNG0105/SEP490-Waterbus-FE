const CURRENT_YEAR = new Date().getFullYear();
const MIN_BIRTH_YEAR = 1900;

/**
 * Group QR + passenger manifest UI for paid charter bookings.
 * State and handlers stay in the parent — this component only renders.
 */
export function MyCharterTicketsPanel({
  lang,
  booking,
  isPaid,
  isSubmitting,
  qrImageUrl,
  selectedTicketIds,
  setSelectedTicketIds,
  passengerRows,
  canUseContactAsSinglePassenger,
  importInputRef,
  isUsableText,
  handleTicketFileAction,
  handleImportPassengers,
  handlePassengerChange,
  handleSavePassengers,
}) {
  return (
    <>
      <section className="bg-white dark:bg-slate-800 rounded-4xl p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-700/50">
        <div className="flex flex-col lg:flex-row gap-6 lg:items-center">
          <div className="flex-1">
            <h2 className="text-xl font-headline font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "QR tổng & vé hành khách" : "Group QR & Passenger Tickets"}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {selectedTicketIds.length > 0
                ? (lang === "VN" ? `Đã chọn ${selectedTicketIds.length} vé để xuất.` : `${selectedTicketIds.length} tickets selected.`)
                : (lang === "VN" ? "Không chọn vé để xuất toàn bộ danh sách." : "Leave tickets unselected to export all.")}
            </p>

            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              <button type="button" onClick={() => handleTicketFileAction("print")} disabled={isSubmitting || !isPaid} className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#124757] dark:text-yellow-400 font-headline font-black uppercase text-[10px] tracking-wider disabled:opacity-50">
                {lang === "VN" ? "In vé" : "Print Tickets"}
              </button>
              <button type="button" onClick={() => handleTicketFileAction("pdf")} disabled={isSubmitting || !isPaid} className="px-4 py-3 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 font-headline font-black uppercase text-[10px] tracking-wider disabled:opacity-50">
                {lang === "VN" ? "Tải PDF" : "Download PDF"}
              </button>
            </div>
          </div>

          <div className="w-36 h-36 shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
            {qrImageUrl ? (
              <img src={qrImageUrl} alt={lang === "VN" ? "QR tổng booking" : "Booking group QR"} className="w-full h-full object-contain p-2" />
            ) : (
              <div className="text-center text-slate-400 px-3">
                <span className="material-symbols-outlined text-3xl">qr_code_2</span>
                <p className="text-[9px] font-bold mt-1">{lang === "VN" ? "QR có sau khi booking hợp lệ" : "QR available when eligible"}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-4xl p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-700/50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-headline font-black text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Danh sách hành khách" : "Passenger Manifest"}</h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {canUseContactAsSinglePassenger
                ? (lang === "VN" ? "Booking 1 khách sẽ dùng thông tin liên hệ làm hành khách." : "Single-passenger bookings use the contact information.")
                : (lang === "VN" ? "Nhập file hoặc chỉnh trực tiếp từng hành khách. File mẫu: fullName,birthYear" : "Import a file or edit passengers directly. Template: fullName,birthYear")}
            </p>
            {!canUseContactAsSinglePassenger ? (
              <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-mono text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                fullName,birthYear<br />
                Nguyen Van A,2003<br />
                Tran Thi B,2016
              </p>
            ) : null}
          </div>
          <button type="button" onClick={() => importInputRef.current?.click()} disabled={isSubmitting || !isPaid} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400 sm:w-auto">
            {lang === "VN" ? "Nhập file khách" : "Import Passengers"}
          </button>
          <input ref={importInputRef} type="file" accept=".xlsx,.csv,.tsv,.txt" onChange={handleImportPassengers} className="hidden" />
        </div>

        <div className="space-y-3 mt-6">
          {canUseContactAsSinglePassenger ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                {lang === "VN" ? "Tự dùng thông tin liên hệ" : "Using contact info"}
              </p>
              <p className="mt-2 font-headline text-lg font-black text-[#0E4050] dark:text-yellow-400">{booking.contactName}</p>
              <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300">
                {[booking.contactPhone, booking.contactEmail].filter(isUsableText).join(" · ") || "--"}
              </p>
            </div>
          ) : passengerRows.map((row, index) => (
            <div key={row.id || `passenger-${index}`} className="grid grid-cols-[42px_1fr] md:grid-cols-[42px_1fr_170px] gap-2 items-center">
              <label className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-black text-slate-400" title={row.ticketCode || undefined}>
                {row.id ? (
                  <input
                    type="checkbox"
                    checked={selectedTicketIds.includes(row.id)}
                    onChange={(event) => setSelectedTicketIds((prev) => event.target.checked ? [...prev, row.id] : prev.filter((ticketId) => ticketId !== row.id))}
                    className="accent-[#124757]"
                  />
                ) : index + 1}
              </label>
              <div className="relative">
                <input value={row.fullName} onChange={(e) => handlePassengerChange(index, "fullName", e.target.value)} disabled={!isPaid} placeholder={lang === "VN" ? "Họ tên" : "Full name"} className="w-full px-3 py-3 pr-20 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] disabled:opacity-60" />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-white px-2 py-1 text-[9px] font-headline font-black uppercase tracking-wider text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                  {row.passengerType === "Child" ? (lang === "VN" ? "Trẻ em" : "Child") : (lang === "VN" ? "Người lớn" : "Adult")}
                </span>
              </div>
              <input
                type="number"
                min={MIN_BIRTH_YEAR}
                max={CURRENT_YEAR}
                value={row.birthYear}
                onChange={(e) => handlePassengerChange(index, "birthYear", e.target.value)}
                disabled={!isPaid}
                placeholder={lang === "VN" ? "Năm sinh" : "Birth year"}
                className="px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] col-start-2 md:col-start-auto disabled:opacity-60"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <button onClick={handleSavePassengers} disabled={isSubmitting || !isPaid} className="w-full sm:w-auto min-w-56 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 py-3 px-6 font-headline font-black uppercase text-xs tracking-widest disabled:opacity-60">
            {isSubmitting
              ? (lang === "VN" ? "Đang lưu..." : "Saving...")
              : canUseContactAsSinglePassenger
                ? (lang === "VN" ? "Lưu thông tin liên hệ" : "Save Contact Info")
                : (lang === "VN" ? "Lưu hành khách" : "Save Passengers")}
          </button>
        </div>
      </section>
    </>
  );
}
