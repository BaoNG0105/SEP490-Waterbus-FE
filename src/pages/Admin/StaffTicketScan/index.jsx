import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { checkInTicket, checkOutTicket, scanTicket } from "../../../services/ticketScanService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { notify } from "../../../utils/swalToast";

/**
 * Quét vé Staff — manual code (camera sau).
 * Không kiểm tra ca hợp lệ bến/tàu lúc này (BE rule chưa bắt buộc).
 */
export function StaffTicketScanPage() {
  const { lang } = useApp();
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isActing, setIsActing] = useState(false);

  const handleScan = async (event) => {
    event?.preventDefault?.();
    const trimmed = String(code || "").trim();
    if (!trimmed) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Nhập mã vé" : "Enter ticket code",
        confirmButtonColor: "#124757",
      });
      return;
    }
    try {
      setIsScanning(true);
      setTicket(null);
      const data = await scanTicket(trimmed);
      setTicket(data);
    } catch (error) {
      setTicket(null);
      notify({
        icon: "error",
        title: lang === "VN" ? "Không tìm thấy vé" : "Ticket not found",
        text: getApiErrorMessage(
          error,
          lang === "VN" ? "Mã không hợp lệ hoặc vé không tồn tại." : "Invalid code or ticket does not exist."
        ),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const refreshAfterAction = async (trimmed) => {
    try {
      const data = await scanTicket(trimmed);
      setTicket(data);
    } catch {
      /* giữ ticket cũ */
    }
  };

  const handleCheckIn = async () => {
    const trimmed = String(code || ticket?.codeOrToken || ticket?.ticketCode || "").trim();
    if (!trimmed) return;
    try {
      setIsActing(true);
      await checkInTicket(trimmed);
      await refreshAfterAction(trimmed);
      notify({
        icon: "success",
        title: lang === "VN" ? "Check-in thành công" : "Checked in",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Check-in thất bại" : "Check-in failed",
        text: getApiErrorMessage(error),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsActing(false);
    }
  };

  const handleCheckOut = async () => {
    const trimmed = String(code || ticket?.codeOrToken || ticket?.ticketCode || "").trim();
    if (!trimmed) return;
    try {
      setIsActing(true);
      await checkOutTicket(trimmed);
      await refreshAfterAction(trimmed);
      notify({
        icon: "success",
        title: lang === "VN" ? "Check-out thành công" : "Checked out",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Check-out thất bại" : "Check-out failed",
        text: getApiErrorMessage(error),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="space-y-6 pb-10 font-body max-w-3xl mx-auto">
      <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Vận hành" : "Operations"}
        </p>
        <h2 className="mt-1 text-2xl font-headline font-black text-[#124757] dark:text-yellow-400">
          {lang === "VN" ? "Quét vé" : "Ticket scan"}
        </h2>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
          {lang === "VN"
            ? "Nhập mã vé hoặc dán token QR. Quét bằng camera sẽ bổ sung sau."
            : "Enter ticket code or paste QR token. Camera scan comes later."}
        </p>
        <Link
          to="/admin/staff/scan-history"
          className="inline-flex mt-3 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 underline"
        >
          {lang === "VN" ? "Lịch sử quét" : "Scan history"}
        </Link>

        <form onSubmit={handleScan} className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block space-y-1.5">
            <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
              {lang === "VN" ? "Mã vé / QR" : "Ticket code / QR"}
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
              ? lang === "VN"
                ? "Đang tra…"
                : "Looking up…"
              : lang === "VN"
                ? "Tra cứu"
                : "Lookup"}
          </button>
        </form>
      </div>

      {ticket && (
        <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-headline font-black text-[#124757] dark:text-yellow-400">
                {ticket.passengerName}
              </p>
              <p className="text-xs font-bold text-slate-500 mt-1">
                {ticket.ticketCode || ticket.codeOrToken || "—"}
              </p>
            </div>
            {ticket.status && (
              <span className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-headline font-black uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                {ticket.status}
              </span>
            )}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                {lang === "VN" ? "Tuyến" : "Route"}
              </dt>
              <dd className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">{ticket.routeName || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                {lang === "VN" ? "Chuyến / Tàu" : "Trip / Boat"}
              </dt>
              <dd className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                {[ticket.tripCode, ticket.boatName].filter(Boolean).join(" · ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                {lang === "VN" ? "Bến" : "Stations"}
              </dt>
              <dd className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                {[ticket.fromStation, ticket.toStation].filter(Boolean).join(" → ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                {lang === "VN" ? "Ghế" : "Seat"}
              </dt>
              <dd className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">{ticket.seatLabel || "—"}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={isActing}
              onClick={handleCheckIn}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-[11px] font-headline font-black uppercase tracking-wider disabled:opacity-50"
            >
              Check-in
            </button>
            <button
              type="button"
              disabled={isActing}
              onClick={handleCheckOut}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-headline font-black uppercase tracking-wider hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
            >
              Check-out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
