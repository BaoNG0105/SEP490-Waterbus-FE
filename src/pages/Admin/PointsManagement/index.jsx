import { useState } from "react";
import { useApp } from "../../../context/AppContext";
import { backfillCompletedBookingPoints } from "../../../services/pointService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { notify, showToast } from "../../../utils/swalToast";

/**
 * Admin: chạy một lần sau deploy để bù điểm cho booking đã Completed
 * trước khi hệ thống điểm go-live. POST /api/points/admin/backfill-completed-bookings
 */
export default function PointsManagement() {
  const { lang } = useApp();
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleBackfill = async () => {
    const confirm = await notify({
      dialog: true,
      icon: "warning",
      title: lang === "VN" ? "Bù điểm booking đã hoàn tất?" : "Backfill points for completed bookings?",
      text: lang === "VN"
        ? "Chỉ chạy một lần sau khi deploy. Booking đã có điểm sẽ bị bỏ qua."
        : "Run once after deploy. Bookings that already have points will be skipped.",
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Chạy backfill" : "Run backfill",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    });
    if (!confirm?.isConfirmed) return;

    setBusy(true);
    try {
      const result = await backfillCompletedBookingPoints();
      setLastResult(result || null);
      showToast({
        icon: "success",
        title: lang === "VN" ? "Backfill xong" : "Backfill done",
        text: lang === "VN"
          ? `Đã cộng ${Number(result?.totalPointsAwarded || 0).toLocaleString()} điểm cho ${Number(result?.awardedBookingCount || 0)} booking.`
          : `Awarded ${Number(result?.totalPointsAwarded || 0).toLocaleString()} points to ${Number(result?.awardedBookingCount || 0)} bookings.`,
      });
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Backfill thất bại" : "Backfill failed",
        text: getApiErrorMessage(error, lang === "VN" ? "Không thể bù điểm." : "Unable to backfill points."),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
          {lang === "VN" ? "Điểm tích lũy" : "Loyalty Points"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {lang === "VN"
            ? "1 điểm = 1 VND. Khách được cộng 1% số tiền đã thanh toán (trừ hoàn) khi chuyến Completed."
            : "1 point = 1 VND. Customers earn 1% of net paid amount when the trip is Completed."}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 space-y-4">
        <h2 className="font-headline text-lg font-bold text-[#124757] dark:text-white">
          {lang === "VN" ? "Bù điểm booking cũ (một lần)" : "Backfill completed bookings (one-time)"}
        </h2>
        <p className="text-sm text-slate-500">
          {lang === "VN"
            ? "Gọi POST /api/points/admin/backfill-completed-bookings để cộng điểm cho các booking đã Completed trước khi hệ thống điểm lên production."
            : "Calls POST /api/points/admin/backfill-completed-bookings to award points for bookings completed before the points system went live."}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={handleBackfill}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#124757] px-5 py-3 text-xs font-headline font-black uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-50 dark:bg-yellow-400 dark:text-[#124757]"
        >
          <span className={`material-symbols-outlined text-[18px] ${busy ? "animate-spin" : ""}`}>
            {busy ? "progress_activity" : "loyalty"}
          </span>
          {busy
            ? (lang === "VN" ? "Đang chạy…" : "Running…")
            : (lang === "VN" ? "Chạy backfill" : "Run backfill")}
        </button>

        {lastResult ? (
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-900/60 sm:grid-cols-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Candidates</p>
              <p className="font-headline font-black text-[#124757] dark:text-yellow-400">{Number(lastResult.candidateBookingCount || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Awarded</p>
              <p className="font-headline font-black text-emerald-600">{Number(lastResult.awardedBookingCount || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Skipped</p>
              <p className="font-headline font-black text-amber-600">{Number(lastResult.skippedBookingCount || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Tổng điểm" : "Total points"}
              </p>
              <p className="font-headline font-black text-[#124757] dark:text-yellow-400">
                {Number(lastResult.totalPointsAwarded || 0).toLocaleString()}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
