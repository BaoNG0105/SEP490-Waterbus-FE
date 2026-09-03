import { useState } from "react";
import {
  canCustomerRequestAddPassengers,
  formatPassengerApprovalStatus,
  getCharterPassengerAddSummary,
  getPassengerAddBlockedReason,
  getPassengerAddRequestBatches,
  getPassengerApprovalTone,
  listBookingPassengers,
  normalizePassengerApprovalStatus,
} from "../../../utils/charterPassengerAdd";
import { pick } from "../../../utils/charterBookingAdmin";
import { sanitizeFullName } from "../../../utils/formValidation";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_BIRTH_YEAR = 1900;

// BE trả sẵn ảnh QR (không encode client-side) — click để phóng to giống BookingDetailPage.
function QrImageBlock({ src, value, label, lang }) {
  const [isEnlarged, setIsEnlarged] = useState(false);

  if (!src) {
    return (
      <div className="w-36 h-36 shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
        <div className="text-center text-slate-400 px-3">
          <p className="text-[9px] font-bold">{lang === "VN" ? "QR có sau khi booking hợp lệ" : "QR available when eligible"}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsEnlarged(true)}
        title={label}
        className="w-36 h-36 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
      >
        <img src={src} alt={label} className="h-full w-full object-contain" />
      </button>

      {isEnlarged && (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsEnlarged(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setIsEnlarged(false); }}
          role="presentation"
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-800"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label={label}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-headline font-black text-[#124757] dark:text-yellow-400">{label}</span>
              <button type="button" onClick={() => setIsEnlarged(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex justify-center">
              <img src={src} alt={label} className="h-60 w-60 object-contain" />
            </div>
            {value ? <p className="mt-4 break-all text-center font-mono text-[11px] text-slate-500">{value}</p> : null}
          </div>
        </div>
      )}
    </>
  );
}

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
  handleTicketFileAction,
  handlePassengerChange,
  handleSavePassengers,
  handleAddPassengers,
  readOnlyMode = false,
}) {
  const [addRows, setAddRows] = useState([{ fullName: "", birthYear: "" }]);
  // List mặc định luôn mở. > 5 khách sẽ có nút "Xem thêm / Thu gọn" ở cuối list.
  const [isExpanded, setIsExpanded] = useState(false);
  const COLLAPSED_LIMIT = 5;
  const summary = getCharterPassengerAddSummary(booking);
  const canAdd = canCustomerRequestAddPassengers(booking);
  const requestBatches = getPassengerAddRequestBatches(listBookingPassengers(booking));

  // Merge BE passengers + placeholder slots so customer always sees the full count
  // — replaces the old CustomerPassengerManifest duplicate card.
  const approvedNamedRows = passengerRows.filter((row) => {
    const status = normalizePassengerApprovalStatus(row.approvalStatus);
    return status === "Approved";
  });
  const seatCount = Math.max(
    0,
    Number(pick(booking, ["passengerCount", "totalPassengers", "seats"], 0)) || 0,
  );
  const placeholderRows = (readOnlyMode && approvedNamedRows.length === 0 && seatCount > 0)
    ? Array.from({ length: seatCount }, (_, idx) => ({
        __placeholder: true,
        id: `placeholder-${idx}`,
        fullName: "",
        birthYear: "",
        approvalStatus: "Pending",
        passengerType: "Adult",
      }))
    : [];

  // Tổng số slot sẽ hiển thị: placeholder + rows BE — dùng cho header counter & collapse.
  const currentPassengerRows = passengerRows
    .map((row, sourceIndex) => ({ ...row, __sourceIndex: sourceIndex }))
    .filter((row) => normalizePassengerApprovalStatus(row.approvalStatus) === "Approved");
  const displayRows = [...placeholderRows, ...currentPassengerRows];
  const canCollapseList = displayRows.length > COLLAPSED_LIMIT;
  const visibleRows = canCollapseList && !isExpanded
    ? displayRows.slice(0, COLLAPSED_LIMIT)
    : displayRows;
  const remainingCount = displayRows.length - COLLAPSED_LIMIT;

  const isPassengerRowLocked = (row) => {
    if (readOnlyMode) return true;
    // Chỉ khóa khi hành khách đã có ticket thật (BE đã phát hành) HOẶC đã được duyệt.
    // Trước đó (PendingQuote / Quoted / chưa cọc) user vẫn phải được sửa tên + năm sinh
    // để admin tính giá chính xác theo danh sách khách.
    const rawApproval = String(row.approvalStatus || "").trim();
    const approval = normalizePassengerApprovalStatus(row.approvalStatus);
    const isDraftSlot = !row.id && !row.requestBatchId && !rawApproval;
    // Có id (BE đã phát hành) → khóa.
    if (row.id && !String(row.id).startsWith("placeholder-")) return true;
    // Chờ duyệt thêm → khóa.
    if (row.requestBatchId) return true;
    // Đã được duyệt (đã có tên + năm sinh hợp lệ) → khóa.
    if (!isDraftSlot && approval === "Approved" && !row.__placeholder) return true;
    return false;
  };

  const canEditManifest = passengerRows.some((row) => !isPassengerRowLocked(row));

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
                ? (lang === "VN" ? `Đã chọn ${selectedTicketIds.length} vé để tải PDF.` : `${selectedTicketIds.length} tickets selected for PDF.`)
                : (lang === "VN" ? "Không chọn vé để tải PDF toàn bộ danh sách." : "Leave tickets unselected to download the full PDF list.")}
            </p>

            {/* Nút tải vé chỉ hiện sau khi danh sách hành khách đã được cập nhật (lưu xong, không còn dòng nào cần chỉnh). */}
            {!canEditManifest ? (
              <div className="mt-5">
                <button type="button" onClick={() => handleTicketFileAction("pdf")} disabled={isSubmitting || !isPaid} className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 font-headline font-black uppercase text-[10px] tracking-wider disabled:opacity-50">
                  <span className="material-symbols-outlined text-base">download</span>
                  {lang === "VN" ? " Tải vé PDF" : " Download PDF Tickets"}
                </button>
              </div>
            ) : (
              <p className="mt-5 text-[11px] text-slate-400">
                {lang === "VN"
                  ? "Vui lòng cập nhật và lưu danh sách hành khách trước khi tải vé."
                  : "Please update and save the passenger list before downloading tickets."}
              </p>
            )}
          </div>

          <QrImageBlock
            src={qrImageUrl}
            value={booking.qrToken}
            label={lang === "VN" ? "QR booking" : "Booking QR"}
            lang={lang}
          />
        </div>

        <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-700/50">
          <h2 className="text-xl font-headline font-black text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Danh sách hành khách" : "Passenger Manifest"} ({displayRows.length})
          </h2>

          {/* Section hiển thị khi: đã paid (xem vé), có dòng hành khách có thể sửa, hoặc đang ở readOnlyMode (chưa paid nhưng booking có số chỗ). */}
        {(isPaid || canEditManifest || readOnlyMode) && (
        <>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
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
          {displayRows.length === 0 ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
              <span className="material-symbols-outlined mt-0.5 shrink-0 text-amber-500">info</span>
              <div className="text-xs leading-relaxed">
                <p className="font-bold text-slate-700 dark:text-slate-200">
                  {lang === "VN" ? "Chưa có hành khách nào" : "No passengers yet"}
                </p>
                <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                  {lang === "VN"
                    ? "Booking chưa ghi nhận hành khách. Danh sách sẽ được thêm sau."
                    : "This booking has no passengers on record yet. The manifest will be added later."}
                </p>
              </div>
            </div>
          ) : null}

          {visibleRows.map((row, index) => {
              const approval = row.__placeholder
                ? "Pending"
                : normalizePassengerApprovalStatus(row.approvalStatus);
              const isLocked = isPassengerRowLocked(row);
              const isPlaceholder = Boolean(row.__placeholder);
              const placeholderLabel = lang === "VN" ? `Khách #${index + 1} (chưa nhập)` : `Passenger #${index + 1} (pending)`;
              const displayName = row.fullName ? String(row.fullName).trim() : (isPlaceholder ? placeholderLabel : "");
              const nameLocked = isLocked;
              return (
                <div key={row.id || `passenger-${index}`} className="space-y-2">
                  <div className="grid grid-cols-[42px_minmax(0,1fr)_84px_88px] items-center gap-2 sm:grid-cols-[42px_minmax(0,1fr)_110px_108px] md:grid-cols-[42px_minmax(0,1fr)_140px_116px]">
                    <label className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-black text-slate-400" title={row.ticketCode || undefined}>
                      {row.id && !isPlaceholder ? (
                        <input
                          type="checkbox"
                          checked={selectedTicketIds.includes(row.id)}
                          onChange={(event) => setSelectedTicketIds((prev) => event.target.checked ? [...prev, row.id] : prev.filter((ticketId) => ticketId !== row.id))}
                          className="accent-[#124757]"
                        />
                      ) : index + 1}
                    </label>
                    <div className="relative">
                      {isPlaceholder ? (
                        <div className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 text-xs italic font-bold text-slate-400 dark:text-slate-500">
                          {displayName}
                        </div>
                      ) : (
                        <input
                          value={displayName}
                          onChange={(e) => handlePassengerChange(row.__sourceIndex ?? index, "fullName", sanitizeFullName(e.target.value))}
                          readOnly={nameLocked}
                          placeholder={lang === "VN" ? "Họ tên" : "Full name"}
                          className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] read-only:cursor-default read-only:opacity-90"
                        />
                      )}
                    </div>
                    {isPlaceholder ? (
                      <div className="px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 text-xs italic font-bold text-slate-400 dark:text-slate-500 text-center">
                        —
                      </div>
                    ) : (
                      <input
                        type="number"
                        min={MIN_BIRTH_YEAR}
                        max={CURRENT_YEAR}
                        value={row.birthYear}
                        onChange={(e) => handlePassengerChange(row.__sourceIndex ?? index, "birthYear", e.target.value)}
                        readOnly={isLocked}
                        placeholder={lang === "VN" ? "Năm sinh" : "Birth year"}
                        className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] read-only:cursor-default read-only:opacity-90"
                      />
                    )}
                    {isPlaceholder ? (
                      <div className="flex min-h-10 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                        —
                      </div>
                    ) : (
                      <div className={`flex min-h-10 items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-headline font-black uppercase whitespace-nowrap ${row.seatCode
                        ? "border-[#124757]/20 bg-[#124757]/5 text-[#124757] dark:border-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-400"
                        : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
                      }`}>
                        <span className="material-symbols-outlined text-[13px]">event_seat</span>
                        {lang === "VN" ? "Ghế" : "Seat"} {row.seatCode || "—"}
                      </div>
                    )}
                  </div>
                  {/* Chỉ hiện khi chờ duyệt / từ chối. Đã duyệt = đã gộp vào danh sách, không cần badge. */}
                  {!isPlaceholder && row.requestBatchId && approval !== "Approved" ? (
                    <p className={`ml-12 inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${getPassengerApprovalTone(approval)}`}>
                      {formatPassengerApprovalStatus(approval, lang, row.reviewNote)}
                    </p>
                  ) : null}
                  {isPlaceholder ? (
                    <p className="ml-12 inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      {lang === "VN" ? "Danh sách sẽ được nhập sau khi thanh toán" : "Manifest will be entered after payment"}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {canCollapseList ? (
              <div className="flex justify-center mt-4">
                <button
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  aria-expanded={isExpanded}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#124757]/20 bg-[#124757]/5 px-4 py-2 text-[11px] font-headline font-black uppercase tracking-widest text-[#124757] transition hover:bg-[#124757]/10 active:scale-95 dark:border-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-400 dark:hover:bg-yellow-400/20"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {isExpanded ? "expand_less" : "expand_more"}
                  </span>
                  {isExpanded
                    ? (lang === "VN" ? "Thu gọn" : "Collapse")
                    : (lang === "VN"
                      ? `Xem thêm ${remainingCount} khách`
                      : `Show ${remainingCount} more`)}
                </button>
              </div>
            ) : null}
        </div>

        {canEditManifest ? (
          <div className="flex justify-end mt-6">
            <button onClick={handleSavePassengers} disabled={isSubmitting} className="w-full sm:w-auto min-w-56 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 py-3 px-6 font-headline font-black uppercase text-xs tracking-widest disabled:opacity-60">
              {isSubmitting
                ? (lang === "VN" ? "Đang lưu..." : "Saving...")
                : (lang === "VN" ? "Lưu hành khách" : "Save Passengers")}
            </button>
          </div>
        ) : null}
        </>
        )}
        </div>
      </section>

      {requestBatches.length > 0 ? (
        <section className="overflow-hidden rounded-4xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-700/70 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/70 md:px-8">
            <h2 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
              {lang === "VN" ? "Lịch sử yêu cầu thêm hành khách" : "Passenger add request history"}
            </h2>
          </div>
          <div className="space-y-3 px-6 py-6 md:px-8">
            {requestBatches.map((batch) => (
              <div
                key={batch.requestBatchId}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-xs font-medium text-slate-400">
                    {batch.requestedAt
                      ? new Date(batch.requestedAt).toLocaleDateString("vi-VN")
                      : (lang === "VN" ? "Không rõ thời gian" : "Date unavailable")}
                  </p>
                  <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${getPassengerApprovalTone(batch.status)}`}>
                    {formatPassengerApprovalStatus(batch.status, lang, batch.reviewNote)}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {batch.passengers.map((passenger, index) => (
                    <li key={`${batch.requestBatchId}-${index}`} className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {passenger.fullName || "--"}
                      {passenger.birthYear ? ` · ${passenger.birthYear}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isPaid && booking?.status === "Confirmed" ? (
        <section className="bg-white dark:bg-slate-800 rounded-4xl p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-700/50">
          <h2 className="text-xl font-headline font-black text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Thêm hành khách" : "Add passengers"}
          </h2>
          <p className="mt-1 text-xs font-bold text-slate-400">
            {lang === "VN"
              ? "Thêm ngoài số khách đã đăng ký - gửi để đội vận hành duyệt. Mỗi booking chỉ 1 lần gửi; chỉ gửi khi còn hơn 24 giờ trước giờ khởi hành."
              : "Add beyond the booked passenger count - needs operations review. One request per booking; only when more than 24 hours remain before departure."}
          </p>

          {!canAdd ? (
            <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {getPassengerAddBlockedReason(booking, lang)}
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {addRows.map((row, index) => (
                <div key={`add-${index}`} className="grid gap-2 items-center grid-cols-[1fr_110px_auto] md:grid-cols-[1fr_140px_auto]">
                  <input
                    value={row.fullName}
                    onChange={(e) => updateAddRow(index, "fullName", sanitizeFullName(e.target.value))}
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
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
