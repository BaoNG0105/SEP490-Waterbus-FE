import { useState } from "react";
import {
  canCustomerRequestAddPassengers,
  formatPassengerApprovalStatus,
  getCharterPassengerAddSummary,
  getPassengerAddBlockedReason,
  getPassengerApprovalTone,
  normalizePassengerApprovalStatus,
} from "../../../utils/charterPassengerAdd";

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
  handleAddPassengers,
}) {
  const [addRows, setAddRows] = useState([{ fullName: "", birthYear: "" }]);
  const summary = getCharterPassengerAddSummary(booking);
  const canAdd = canCustomerRequestAddPassengers(booking);

  const updateAddRow = (index, field, value) => {
    setAddRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addEmptyRow = () => {
    if (summary.boatCapacity > 0 && addRows.length >= summary.canAddMore) return;
    setAddRows((prev) => [...prev, { fullName: "", birthYear: "" }]);
  };

  const removeAddRow = (index) => {
    setAddRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const submitAdd = async () => {
    const ok = await handleAddPassengers?.(addRows);
    if (ok) setAddRows([{ fullName: "", birthYear: "" }]);
  };

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
                ? (lang === "VN"
                  ? "Chuyến 1 khách: họ tên lấy từ người đặt. Chỉ cần nhập năm sinh rồi bấm Lưu."
                  : "Single passenger: name is taken from the booker. Just enter the birth year and save.")
                : (lang === "VN" ? "Nhập file hoặc chỉnh trực tiếp từng hành khách." : "Import a file or edit passengers directly.")}
            </p>
          </div>
          <button type="button" onClick={() => importInputRef.current?.click()} disabled={isSubmitting || !isPaid} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400 sm:w-auto">
            {lang === "VN" ? "Nhập file khách" : "Import Passengers"}
          </button>
          <input ref={importInputRef} type="file" accept=".xlsx,.csv,.tsv,.txt" onChange={handleImportPassengers} className="hidden" />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: lang === "VN" ? "Sức chứa tàu" : "Boat capacity", value: summary.boatCapacity || "—" },
            { label: lang === "VN" ? "Đã duyệt / có tên" : "Approved", value: summary.approvedCount },
            { label: lang === "VN" ? "Chờ duyệt" : "Pending", value: summary.pendingCount },
            {
              label: lang === "VN" ? "Lượt thêm còn" : "Add attempts left",
              value: `${summary.remainingAddAttempts}/${summary.maxAttempts}`,
            },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className="mt-1 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 mt-6">
          {canUseContactAsSinglePassenger ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                {lang === "VN" ? "Người đặt / hành khách" : "Booker / passenger"}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">
                {passengerRows[0]?.fullName || "--"}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300">
                {[booking.contactPhone, booking.contactEmail].filter(isUsableText).join(" · ") || "--"}
              </p>
            </div>
          ) : null}

          {passengerRows.map((row, index) => {
            const rawApproval = String(row.approvalStatus || "").trim();
            const approval = normalizePassengerApprovalStatus(row.approvalStatus);
            // Ô trống chưa lưu (chưa có id/batch) phải nhập được — không coi "Approved" mặc định khi thiếu status.
            const isDraftSlot = !row.id && !row.requestBatchId && !rawApproval;
            const isLocked = !isPaid
              || Boolean(row.requestBatchId)
              || (!isDraftSlot && approval === "Approved");
            const isBookerOnly = canUseContactAsSinglePassenger && index === 0;
            return (
              <div key={row.id || `passenger-${index}`} className="space-y-2">
                <div className={`grid gap-2 items-center ${
                  isBookerOnly
                    ? "grid-cols-1 md:grid-cols-[1fr]"
                    : "grid-cols-[42px_1fr] md:grid-cols-[42px_1fr_170px]"
                }`}>
                  {!isBookerOnly ? (
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
                  ) : null}
                  {!isBookerOnly ? (
                    <div className="relative">
                      <input
                        value={row.fullName}
                        onChange={(e) => handlePassengerChange(index, "fullName", e.target.value)}
                        disabled={isLocked}
                        placeholder={lang === "VN" ? "Họ tên" : "Full name"}
                        className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] disabled:opacity-60"
                      />
                    </div>
                  ) : null}
                  <input
                    type="number"
                    min={MIN_BIRTH_YEAR}
                    max={CURRENT_YEAR}
                    value={row.birthYear}
                    onChange={(e) => handlePassengerChange(index, "birthYear", e.target.value)}
                    disabled={isLocked}
                    placeholder={lang === "VN" ? "Năm sinh" : "Birth year"}
                    className="px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] disabled:opacity-60"
                  />
                </div>
                {row.approvalStatus || row.requestBatchId ? (
                  <p className={`ml-12 inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${getPassengerApprovalTone(approval)}`}>
                    {formatPassengerApprovalStatus(approval, lang, row.reviewNote)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-6">
          <button onClick={handleSavePassengers} disabled={isSubmitting || !isPaid} className="w-full sm:w-auto min-w-56 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 py-3 px-6 font-headline font-black uppercase text-xs tracking-widest disabled:opacity-60">
            {isSubmitting
              ? (lang === "VN" ? "Đang lưu..." : "Saving...")
              : (lang === "VN" ? "Lưu hành khách" : "Save Passengers")}
          </button>
        </div>
      </section>

      {isPaid && booking?.status === "Confirmed" ? (
        <section className="bg-white dark:bg-slate-800 rounded-4xl p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-700/50">
          <h2 className="text-xl font-headline font-black text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Thêm hành khách" : "Add passengers"}
          </h2>
          <p className="mt-1 text-xs font-bold text-slate-400">
            {lang === "VN"
              ? "Gửi thêm tên hành khách để đội vận hành duyệt. Có thể thêm khi còn hơn 24 giờ trước giờ khởi hành."
              : "Submit additional passenger names for review. Available when more than 24 hours remain before departure."}
          </p>

          {!canAdd ? (
            <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {getPassengerAddBlockedReason(booking, lang)}
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {addRows.map((row, index) => (
                <div key={`add-${index}`} className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
                  <input
                    value={row.fullName}
                    onChange={(e) => updateAddRow(index, "fullName", e.target.value)}
                    placeholder={lang === "VN" ? "Họ tên" : "Full name"}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  <input
                    type="number"
                    min={MIN_BIRTH_YEAR}
                    max={CURRENT_YEAR}
                    value={row.birthYear}
                    onChange={(e) => updateAddRow(index, "birthYear", e.target.value)}
                    placeholder={lang === "VN" ? "Năm sinh" : "Birth year"}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeAddRow(index)}
                    disabled={addRows.length <= 1}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase text-slate-500 disabled:opacity-40 dark:border-slate-700"
                  >
                    {lang === "VN" ? "Xóa" : "Remove"}
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addEmptyRow}
                  disabled={summary.boatCapacity > 0 && addRows.length >= summary.canAddMore}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400"
                >
                  {lang === "VN" ? "Thêm dòng" : "Add row"}
                </button>
                <button
                  type="button"
                  onClick={submitAdd}
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#124757] px-5 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-60 dark:bg-yellow-400 dark:text-slate-900"
                >
                  {isSubmitting
                    ? (lang === "VN" ? "Đang gửi..." : "Submitting...")
                    : (lang === "VN" ? "Gửi yêu cầu thêm" : "Submit add request")}
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
