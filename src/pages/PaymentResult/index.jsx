import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { syncBookingPaymentByOrderCode } from "../../services/paymentService";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const getApiErrorMessage = (error, fallback) => {
  const data = error.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data.message === "string") return data.message;
  if (typeof data.title === "string") return data.title;
  if (data.errors && typeof data.errors === "object") {
    const firstError = Object.values(data.errors).flat().find(Boolean);
    if (firstError) return String(firstError);
  }
  return fallback;
};

export function PaymentResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const payosId = params.get("id") || params.get("paymentId") || "";
  const orderCode = params.get("orderCode") || "";
  const storedBookingId = sessionStorage.getItem("latestCharterPaymentBooking") || "";
  const paymentId = payosId || orderCode;
  const status = params.get("status") || "";
  const isCancelled = params.get("cancel") === "true";
  const isPaid = status.toLowerCase() === "paid" && !isCancelled;
  const [isSyncing, setIsSyncing] = useState(Boolean(orderCode));
  const [syncError, setSyncError] = useState("");
  const [syncedOrderCode, setSyncedOrderCode] = useState("");
  const [bookingId, setBookingId] = useState(storedBookingId);

  useEffect(() => {
    if (!orderCode) return;

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
        setSyncedOrderCode(orderCode);
        if (resolvedBookingId) {
          setBookingId(resolvedBookingId);
          sessionStorage.setItem("latestCharterPaymentBooking", resolvedBookingId);
          if (payosId) {
            sessionStorage.setItem(`paymentBooking:${payosId}`, resolvedBookingId);
            sessionStorage.setItem(`charterPayment:${resolvedBookingId}`, payosId);
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
  }, [orderCode, payosId]);

  const effectiveIsSyncing = orderCode ? isSyncing : false;
  const effectiveSyncError = orderCode ? syncError : "Khong tim thay orderCode trong URL PayOS.";
  const title = isCancelled
    ? "Thanh toan da huy"
    : isPaid
      ? "Thanh toan thanh cong"
      : "Dang kiem tra thanh toan";
  const icon = isCancelled ? "close" : isPaid ? "check" : "sync";
  const accentClasses = isCancelled
      ? "bg-rose-50 text-rose-600 border-rose-100"
    : isPaid
      ? "bg-emerald-50 text-emerald-600 border-emerald-100"
      : "bg-amber-50 text-amber-600 border-amber-100";

  return (
    <div className="min-h-[70vh] bg-slate-50 px-4 py-16 font-body dark:bg-slate-900">
      <main className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-slate-200 px-6 py-7 text-center dark:border-slate-700 md:px-10">
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border ${accentClasses}`}>
            <span className={`material-symbols-outlined text-4xl ${effectiveIsSyncing ? "animate-spin" : ""}`}>{icon}</span>
          </div>
          <h1 className="mt-5 text-3xl font-headline font-black text-[#0E4050] dark:text-yellow-400">{title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-300">
            {isPaid
              ? "PayOS da ghi nhan giao dich. He thong se dong bo booking va mo khoa thong tin ve khi backend xac nhan thanh cong."
              : isCancelled
                ? "Ban da huy qua trinh thanh toan PayOS. Booking van duoc giu o trang thai hien tai."
                : "He thong dang doc ket qua tu PayOS va dong bo trang thai thanh toan."}
          </p>
        </div>

        <div className="space-y-4 px-6 py-6 md:px-10">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-[#F8FBFC] p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">Payment ID</p>
              <p className="mt-1 break-all text-sm font-bold text-slate-800 dark:text-white">{payosId || paymentId || "--"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#F8FBFC] p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">PayOS Status</p>
              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">{status || "--"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#F8FBFC] p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">Dong bo</p>
              <p className="mt-1 text-sm font-bold text-slate-800 dark:text-white">{effectiveIsSyncing ? "Dang xu ly" : effectiveSyncError ? (isPaid ? "Cho backend xac nhan" : "Can thu lai") : "Da dong bo"}</p>
            </div>
          </div>

          {effectiveSyncError && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              {isPaid
                ? "PayOS da tra ve PAID, nhung backend chua dong bo kip. Ban co the bam Dong bo lai hoac quay ve chi tiet booking de he thong tiep tuc cap nhat."
                : effectiveSyncError}
            </div>
          )}

          {(orderCode || syncedOrderCode) && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {orderCode ? `OrderCode: ${orderCode}` : ""}{orderCode && syncedOrderCode ? " · " : ""}{syncedOrderCode ? `Synced by orderCode` : ""}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
            {bookingId && (
              <button
                type="button"
                onClick={() => navigate(`/profile/charter-bookings/${bookingId}`)}
                className="rounded-xl bg-[#124757] px-6 py-3 text-xs font-headline font-black uppercase tracking-wider text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
              >
                Xem chi tiet booking
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/profile/charter-bookings")}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs font-headline font-black uppercase tracking-wider text-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400"
            >
              Ve danh sach charter
            </button>
            {paymentId && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                disabled={effectiveIsSyncing}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-xs font-headline font-black uppercase tracking-wider text-slate-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                Dong bo lai
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
