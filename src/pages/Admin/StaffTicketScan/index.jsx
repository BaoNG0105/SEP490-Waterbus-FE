import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import {
  checkInAllBookingManifest,
  checkInTicket,
  checkOutTicket,
  fetchBookingManifestByQr,
  lookupTicketOrManifest,
} from "../../../services/ticketScanService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { notify } from "../../../utils/swalToast";

const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("vi-VN")}đ`;
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const ms = Date.parse(String(value));
  if (Number.isNaN(ms)) return String(value);
  return new Date(ms).toLocaleString("vi-VN");
};

const ticketTypeLabel = (code, lang) => {
  const key = String(code || "").toUpperCase();
  const map = {
    ADULT: { vn: "Người lớn", en: "Adult" },
    CHILD: { vn: "Trẻ em", en: "Child" },
    INFANT: { vn: "Em bé (<2)", en: "Infant" },
    SENIOR: { vn: "Người cao tuổi", en: "Senior" },
    DISABLED: { vn: "Người khuyết tật", en: "Disabled" },
  };
  return map[key]?.[lang === "VN" ? "vn" : "en"] || code || "—";
};

const TicketFields = ({ ticket, lang }) => (
  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {lang === "VN" ? "Mã booking" : "Booking code"}
      </dt>
      <dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{ticket.bookingCode || "—"}</dd>
    </div>
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {lang === "VN" ? "Mã chuyến" : "Trip code"}
      </dt>
      <dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{ticket.tripCode || "—"}</dd>
    </div>
    {ticket.legLabel ? (
      <div>
        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {lang === "VN" ? "Chiều" : "Leg"}
        </dt>
        <dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{ticket.legLabel}</dd>
      </div>
    ) : null}
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {lang === "VN" ? "Loại vé" : "Ticket type"}
      </dt>
      <dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">
        {ticket.ticketTypeName || ticketTypeLabel(ticket.ticketTypeCode, lang)}
      </dd>
    </div>
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {lang === "VN" ? "Ghế" : "Seat"}
      </dt>
      <dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{ticket.seatLabel || "—"}</dd>
    </div>
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {lang === "VN" ? "Ga lên / xuống" : "Boarding / alighting"}
      </dt>
      <dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">
        {[ticket.fromStation, ticket.toStation].filter(Boolean).join(" → ") || "—"}
        {(ticket.fromStationCode || ticket.toStationCode) ? (
          <span className="mt-0.5 block text-[10px] font-medium text-slate-400">
            {[ticket.fromStationCode, ticket.toStationCode].filter(Boolean).join(" → ")}
          </span>
        ) : null}
      </dd>
    </div>
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {lang === "VN" ? "Giờ lên / xuống dự kiến" : "Scheduled board / alight"}
      </dt>
      <dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">
        {formatDateTime(ticket.scheduledBoardingAt)} → {formatDateTime(ticket.scheduledAlightingAt)}
      </dd>
    </div>
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {lang === "VN" ? "Giá vé" : "Fare"}
      </dt>
      <dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{formatMoney(ticket.price)}</dd>
    </div>
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {lang === "VN" ? "Mã vé" : "Ticket code"}
      </dt>
      <dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">
        {ticket.ticketCode || ticket.codeOrToken || "—"}
      </dd>
    </div>
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">checkedInAt</dt>
      <dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">
        {formatDateTime(ticket.checkedInAt)}
        {ticket.checkedInByName ? (
          <span className="mt-0.5 block text-[10px] font-medium text-slate-400">{ticket.checkedInByName}</span>
        ) : null}
      </dd>
    </div>
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">checkedOutAt</dt>
      <dd className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">
        {formatDateTime(ticket.checkedOutAt)}
        {ticket.checkedOutByName ? (
          <span className="mt-0.5 block text-[10px] font-medium text-slate-400">{ticket.checkedOutByName}</span>
        ) : null}
      </dd>
    </div>
  </dl>
);

/**
 * Quét vé Staff OnBoard — contract BE:
 * POST /tickets/scan { ticketCode | bookingQrToken | codeOrToken }
 * · POST check-in|out/{code}?source&… · check-in-all?tripCode=
 */
export function StaffTicketScanPage() {
  const { lang } = useApp();
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [selectedTripCode, setSelectedTripCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [lastError, setLastError] = useState("");

  const isManifest = result?.kind === "manifest";
  const ticket = result?.kind === "ticket" ? result : null;
  const manifest = isManifest ? result : null;

  const tripOptions = useMemo(() => {
    if (!manifest) return [];
    return (manifest.tripCodes || []).map((tripCode) => ({
      value: tripCode,
      label: tripCode,
    }));
  }, [manifest]);

  const refreshManifest = async (token = manifest?.bookingQrToken || code) => {
    const data = await fetchBookingManifestByQr(token);
    setResult(data);
    setSelectedTripCode((prev) => (
      prev && data.tripCodes.includes(prev) ? prev : (data.selectedTripCode || data.tripCodes[0] || "")
    ));
    return data;
  };

  const handleLookup = async (event) => {
    event?.preventDefault?.();
    const trimmed = String(code || "").trim();
    if (!trimmed) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Nhập mã vé / QR booking" : "Enter ticket or booking QR",
        confirmButtonColor: "#124757",
      });
      return;
    }
    try {
      setIsScanning(true);
      setResult(null);
      setLastError("");
      const data = await lookupTicketOrManifest(trimmed);
      setResult(data);
      if (data.kind === "manifest") {
        setSelectedTripCode(data.selectedTripCode || data.tripCodes[0] || "");
      }
    } catch (error) {
      setResult(null);
      const message = getApiErrorMessage(
        error,
        lang === "VN" ? "Mã không hợp lệ hoặc không có quyền soát vé." : "Invalid code or no scan permission.",
      );
      setLastError(message);
      notify({
        icon: "error",
        title: lang === "VN" ? "Không tra được vé" : "Lookup failed",
        text: message,
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleCheckInOne = async (row) => {
    const trimmed = String(row?.codeOrToken || row?.ticketCode || code || "").trim();
    if (!trimmed) return;
    try {
      setIsActing(true);
      setLastError("");
      await checkInTicket(trimmed);
      if (isManifest) await refreshManifest();
      else {
        const data = await lookupTicketOrManifest(trimmed);
        setResult(data);
      }
      notify({
        icon: "success",
        title: lang === "VN" ? "Check-in thành công" : "Checked in",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      const message = getApiErrorMessage(error);
      setLastError(message);
      notify({
        icon: "error",
        title: lang === "VN" ? "Check-in thất bại" : "Check-in failed",
        text: message,
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleCheckOutOne = async (row) => {
    const trimmed = String(row?.codeOrToken || row?.ticketCode || code || "").trim();
    if (!trimmed) return;
    try {
      setIsActing(true);
      setLastError("");
      await checkOutTicket(trimmed);
      if (isManifest) await refreshManifest();
      else {
        const data = await lookupTicketOrManifest(trimmed);
        setResult(data);
      }
      notify({
        icon: "success",
        title: lang === "VN" ? "Check-out thành công" : "Checked out",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      const message = getApiErrorMessage(error);
      setLastError(message);
      notify({
        icon: "error",
        title: lang === "VN" ? "Check-out thất bại" : "Check-out failed",
        text: message,
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleCheckInAll = async () => {
    const token = String(manifest?.bookingQrToken || code || "").trim();
    if (!token) return;
    if (manifest?.isRoundTrip && !selectedTripCode) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Chọn mã chuyến" : "Select trip code",
        text: lang === "VN"
          ? "Booking khứ hồi cần tripCode chiều đang boarding để tránh check-in nhầm cả hai chiều."
          : "Round-trip bookings require the boarding leg tripCode to avoid checking in both legs.",
        confirmButtonColor: "#124757",
      });
      return;
    }
    try {
      setIsActing(true);
      setLastError("");
      await checkInAllBookingManifest(token, selectedTripCode);
      await refreshManifest(token);
      notify({
        icon: "success",
        title: lang === "VN" ? "Check-in cả nhóm thành công" : "Group check-in done",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      const message = getApiErrorMessage(error);
      setLastError(message);
      notify({
        icon: "error",
        title: lang === "VN" ? "Check-in nhóm thất bại" : "Group check-in failed",
        text: message,
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10 font-body">
      <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Vận hành" : "Operations"}
        </p>
        <h2 className="mt-1 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
          {lang === "VN" ? "Quét vé (OnBoard)" : "Ticket scan (OnBoard)"}
        </h2>
        <Link
          to="/admin/staff/scan-history"
          className="mt-3 inline-flex text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] underline dark:text-yellow-400"
        >
          {lang === "VN" ? "Lịch sử quét" : "Scan history"}
        </Link>

        <form onSubmit={handleLookup} className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block space-y-1.5">
            <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
              {lang === "VN" ? "Mã vé / QR booking" : "Ticket code / booking QR"}
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={lang === "VN" ? "Nhập hoặc dán mã…" : "Type or paste code…"}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            disabled={isScanning}
            className="h-[46px] rounded-2xl bg-[#124757] px-6 text-xs font-headline font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
          >
            {isScanning
              ? (lang === "VN" ? "Đang tra…" : "Looking up…")
              : (lang === "VN" ? "Tra cứu" : "Lookup")}
          </button>
        </form>

        {lastError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {lastError}
          </div>
        ) : null}
      </div>

      {ticket ? (
        <div className="space-y-4 rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                {ticket.passengerName}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {ticket.ticketCode || ticket.codeOrToken || "—"}
              </p>
            </div>
            {ticket.status ? (
              <span className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-headline font-black uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                {ticket.status}
              </span>
            ) : null}
          </div>

          <TicketFields ticket={ticket} lang={lang} />

          {(ticket.canCheckIn || ticket.canCheckOut) ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {ticket.canCheckIn ? (
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => handleCheckInOne(ticket)}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-50"
                >
                  Check-in
                </button>
              ) : null}
              {ticket.canCheckOut ? (
                <button
                  type="button"
                  disabled={isActing}
                  onClick={() => handleCheckOutOne(ticket)}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
                >
                  Check-out
                </button>
              ) : null}
            </div>
          ) : (
            <p className="pt-2 text-[11px] font-bold text-slate-400">
              {lang === "VN"
                ? "Vé đã check-out — chỉ xem trạng thái."
                : "Ticket already checked out — view only."}
            </p>
          )}
        </div>
      ) : null}

      {manifest ? (
        <div className="space-y-4 rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                {lang === "VN" ? "QR tổng booking" : "Booking group QR"}
              </p>
              <p className="mt-1 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                {manifest.bookingCode}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {manifest.tickets.length} {lang === "VN" ? "vé" : "ticket(s)"}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {tripOptions.length > 0 ? (
                <label className="block space-y-1">
                  <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                    tripCode {manifest.isRoundTrip ? (lang === "VN" ? "(bắt buộc khứ hồi)" : "(required for RT)") : ""}
                  </span>
                  <select
                    value={selectedTripCode}
                    onChange={(e) => setSelectedTripCode(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#124757] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  >
                    {tripOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                disabled={isActing || !manifest.tickets.some((row) => row.canCheckIn)}
                onClick={handleCheckInAll}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-50"
              >
                {lang === "VN" ? "Check-in cả nhóm" : "Check-in all"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {manifest.tickets.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">
                {lang === "VN" ? "Manifest chưa có vé." : "No tickets in manifest."}
              </p>
            ) : (
              manifest.tickets.map((row) => (
                <div
                  key={`${row.ticketCode || row.codeOrToken}-${row.tripCode}`}
                  className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-headline font-black text-[#124757] dark:text-yellow-400">
                        {row.passengerName}
                      </p>
                      <p className="text-[11px] font-bold text-slate-500">
                        {ticketTypeLabel(row.ticketTypeCode, lang)} · {row.seatLabel || "—"}
                      </p>
                    </div>
                    {row.status ? (
                      <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {row.status}
                      </span>
                    ) : null}
                  </div>
                  <TicketFields ticket={row} lang={lang} />
                  {(row.canCheckIn || row.canCheckOut) ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.canCheckIn ? (
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleCheckInOne(row)}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-50"
                        >
                          Check-in
                        </button>
                      ) : null}
                      {row.canCheckOut ? (
                        <button
                          type="button"
                          disabled={isActing}
                          onClick={() => handleCheckOutOne(row)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
                        >
                          Check-out
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 text-[10px] font-bold text-slate-400">
                      {lang === "VN" ? "Chỉ xem trạng thái" : "View status only"}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
