import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { AppDateInput } from "../../../components/AppDateInput";
import { FormSelect } from "../../../components/FormSelect";
import { fetchStaffMeScanHistory } from "../../../services/staffMeService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { getTodayDateString } from "../../../utils/dateOnly";

const formatDateTime = (value) => {
  if (!value) return "—";
  const ms = Date.parse(String(value));
  if (Number.isNaN(ms)) return String(value);
  return new Date(ms).toLocaleString("vi-VN");
};

const actionLabel = (action, lang) => {
  const key = String(action || "").toLowerCase();
  const map = {
    scan: { vn: "Tra cứu", en: "Scan" },
    checkin: { vn: "Check-in", en: "Check-in" },
    checkout: { vn: "Check-out", en: "Check-out" },
  };
  return map[key]?.[lang === "VN" ? "vn" : "en"] || action || "—";
};

/**
 * Lịch sử quét của staff — GET /api/staff/me/scan-history.
 */
export function StaffScanHistoryPage() {
  const { lang } = useApp();
  const today = getTodayDateString();
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [action, setAction] = useState("all");
  const [result, setResult] = useState("all");
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const actionOptions = useMemo(() => ([
    { value: "all", label: lang === "VN" ? "Tất cả thao tác" : "All actions" },
    { value: "Scan", label: lang === "VN" ? "Tra cứu (Scan)" : "Scan" },
    { value: "CheckIn", label: "Check-in" },
    { value: "CheckOut", label: "Check-out" },
  ]), [lang]);

  const resultOptions = useMemo(() => ([
    { value: "all", label: lang === "VN" ? "Tất cả kết quả" : "All results" },
    { value: "Success", label: lang === "VN" ? "Thành công" : "Success" },
    { value: "Failed", label: lang === "VN" ? "Thất bại" : "Failed" },
  ]), [lang]);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const list = await fetchStaffMeScanHistory({
        fromDate,
        toDate,
        action,
        result,
      });
      setRows(list);
    } catch (error) {
      setRows([]);
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Không tải được lịch sử quét." : "Unable to load scan history.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, action, result, lang]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10 font-body">
      <div className="rounded-4xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-6">
        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Vận hành" : "Operations"}
        </p>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Lịch sử quét vé" : "Scan history"}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">
              {lang === "VN"
                ? "Các lần scan / check-in / check-out bạn đã thực hiện."
                : "Your scan / check-in / check-out events."}
            </p>
            <Link
              to="/admin/staff/ticket-scan"
              className="mt-2 inline-flex text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] underline dark:text-yellow-400"
            >
              {lang === "VN" ? "Quét vé" : "Ticket scan"}
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {lang === "VN" ? "Từ ngày" : "From"}
            </span>
            <AppDateInput
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {lang === "VN" ? "Đến ngày" : "To"}
            </span>
            <AppDateInput
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Action</span>
            <FormSelect
              value={action}
              onChange={setAction}
              options={actionOptions}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Result</span>
            <FormSelect
              value={result}
              onChange={setResult}
              options={resultOptions}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setFromDate(today);
              setToDate(today);
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 dark:border-slate-600 dark:text-slate-300"
          >
            {lang === "VN" ? "Hôm nay" : "Today"}
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded-xl bg-[#124757] px-4 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900"
          >
            {lang === "VN" ? "Tải lại" : "Refresh"}
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {errorMsg}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-4xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600" aria-hidden>
              history
            </span>
            <p className="mt-3 text-sm font-bold text-slate-500 dark:text-slate-400">
              {lang === "VN" ? "Chưa có lần quét nào trong khoảng đã chọn." : "No scan events in this range."}
            </p>
            <p className="mt-1.5 text-xs text-slate-400">
              {lang === "VN"
                ? "Sau khi tra cứu / check-in / check-out, event sẽ hiện ở đây."
                : "Events appear here after you scan / check-in / check-out."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {rows.map((row) => {
              const ok = String(row.result || "").toLowerCase() === "success";
              return (
                <li key={row.eventId || `${row.serverTime}-${row.ticketCode}-${row.action}`} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-headline text-sm font-black text-[#124757] dark:text-yellow-400">
                          {actionLabel(row.action, lang)}
                        </span>
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-headline font-black uppercase tracking-wide ${
                            ok
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                          }`}
                        >
                          {row.result || "—"}
                        </span>
                        {row.source ? (
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                            {row.source}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                        {row.ticketCode || row.scannedCodeOrToken || "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                        {[row.bookingCode, row.tripCode, row.boatName || row.stationName]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      {row.failureReason ? (
                        <p className="mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-300">
                          {row.failureReason}
                        </p>
                      ) : null}
                      {(row.ticketStatusBefore || row.ticketStatusAfter) ? (
                        <p className="mt-1 text-[11px] text-slate-500">
                          {row.ticketStatusBefore || "—"} → {row.ticketStatusAfter || "—"}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right text-[11px] font-bold text-slate-500">
                      <p>{formatDateTime(row.serverTime)}</p>
                      {row.deviceTime ? (
                        <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                          device {formatDateTime(row.deviceTime)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
