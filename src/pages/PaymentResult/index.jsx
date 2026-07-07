import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { syncBookingPaymentByOrderCode } from "../../services/paymentService";
import { getApiErrorMessage } from "../../utils/apiError";
import { PaymentLottieIcon } from "../../components/PaymentLottieIcon";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

export function PaymentResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const payosId = params.get("id") || params.get("paymentId") || "";
  const orderCode = params.get("orderCode") || "";
  const resultCode = params.get("code") || "";
  const storedBookingId = sessionStorage.getItem("latestCharterPaymentBooking") || "";
  const status = params.get("status") || "";
  const isCancelled = params.get("cancel") === "true";
  const isPaid = resultCode === "00" && status.toLowerCase() === "paid" && !isCancelled;
  const shouldSyncPayment = Boolean(orderCode && isPaid);
  const [isSyncing, setIsSyncing] = useState(shouldSyncPayment);
  const [syncError, setSyncError] = useState("");
  const [bookingId, setBookingId] = useState(storedBookingId);

  useEffect(() => {
    if (!shouldSyncPayment) {
      setIsSyncing(false);
      return;
    }

    let active = true;
    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setIsSyncing(true);
        return syncBookingPaymentByOrderCode(orderCode);
      })
      .then((response) => {
        if (!active || !response) return;
        const responseBookingId = pick(response, [
          "bookingId",
          "charterBookingId",
          "data.bookingId",
          "data.charterBookingId",
          "payment.bookingId",
          "data.payment.bookingId",
          "booking.id",
          "data.booking.id",
        ]);
        const resolvedBookingId = responseBookingId || sessionStorage.getItem("latestCharterPaymentBooking") || "";
        if (resolvedBookingId) {
          setBookingId(resolvedBookingId);
          sessionStorage.setItem("latestCharterPaymentBooking", resolvedBookingId);
          sessionStorage.setItem(`charterPaymentOrderCode:${resolvedBookingId}`, orderCode);
          sessionStorage.removeItem(`charterPayment:${resolvedBookingId}`);
          if (payosId) {
            sessionStorage.setItem(`paymentBooking:${payosId}`, resolvedBookingId);
          }
        }
        setSyncError("");
      })
      .catch((error) => {
        if (!active) return;
        setSyncError(getApiErrorMessage(error, "Chua dong bo duoc trang thai thanh toan. Vui long thu lai sau."));
      })
      .finally(() => {
        if (active) setIsSyncing(false);
      });

    return () => {
      active = false;
    };
  }, [orderCode, payosId, shouldSyncPayment]);

  const effectiveIsSyncing = shouldSyncPayment ? isSyncing : false;
  const effectiveSyncError = !orderCode && isPaid
    ? "Khong tim thay orderCode trong URL PayOS."
    : shouldSyncPayment
      ? syncError
      : "";
  const title = isCancelled
    ? "Thanh toán đã hủy"
    : isPaid
      ? "Thanh toán thành công"
      : "Đang kiểm tra thanh toán";
  const description = isPaid
    ? "Cảm ơn bạn. Hệ thống đang cập nhật booking và mở khóa thông tin vé."
    : isCancelled
      ? "Giao dịch PayOS đã được hủy. Booking của bạn vẫn đang chờ thanh toán."
      : "Hệ thống đang đọc kết quả thanh toán từ PayOS.";
  const icon = isCancelled ? "close" : isPaid ? "check" : "sync";
  const accentClasses = isCancelled
      ? "bg-rose-50 text-rose-600 ring-rose-100"
    : isPaid
      ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
      : "bg-amber-50 text-amber-600 ring-amber-100";
  const syncLabel = effectiveIsSyncing
    ? "Đang đồng bộ booking..."
    : effectiveSyncError
      ? "Chưa đồng bộ xong"
      : shouldSyncPayment
        ? "Đã đồng bộ"
        : "Không cần đồng bộ";

  return (
    <div className="min-h-[72vh] bg-[#F5F8FA] px-4 py-12 font-body dark:bg-slate-950">
      <main className="mx-auto max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-900">
        <div className="px-6 py-10 text-center md:px-10">
          <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-[1.75rem] ring-1 ${accentClasses}`}>
            {effectiveIsSyncing ? (
              <PaymentLottieIcon className="h-20 w-20" />
            ) : (
              <span className="material-symbols-outlined text-5xl">{icon}</span>
            )}
          </div>
          <h1 className="mt-6 text-3xl font-headline font-black text-[#0E4050] dark:text-yellow-400">{title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-slate-500 dark:text-slate-300">{description}</p>

          <div className="mx-auto mt-6 max-w-md rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-headline font-black uppercase tracking-widest text-slate-400">OrderCode</span>
              <span className="break-all text-right text-sm font-bold text-slate-700 dark:text-slate-200">{orderCode || "--"}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-200 pt-3 dark:border-slate-800">
              <span className="text-xs font-headline font-black uppercase tracking-widest text-slate-400">Trạng thái</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-headline font-black ${
                effectiveSyncError
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              }`}>
                <span className="material-symbols-outlined text-sm">{effectiveSyncError ? "hourglass_top" : "verified"}</span>
                {syncLabel}
              </span>
            </div>
          </div>

          {effectiveSyncError && (
            <p className="mx-auto mt-4 max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              {isPaid ? "PayOS đã ghi nhận thanh toán. Nếu booking chưa cập nhật, bạn có thể đồng bộ lại." : effectiveSyncError}
            </p>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {bookingId && (
              <button
                type="button"
                onClick={() => navigate(`/profile/my-charter-booking/${bookingId}`)}
                className="rounded-xl bg-[#124757] px-6 py-3 text-xs font-headline font-black uppercase tracking-wider text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
              >
                Xem booking
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/profile/my-charter-booking")}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs font-headline font-black uppercase tracking-wider text-[#124757] dark:border-slate-700 dark:bg-slate-950 dark:text-yellow-400"
            >
              Danh sách charter
            </button>
            {orderCode && isPaid && effectiveSyncError && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                disabled={effectiveIsSyncing}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs font-headline font-black uppercase tracking-wider text-slate-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
              >
                Đồng bộ lại
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
