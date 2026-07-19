import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../context/AppContext";
import { syncBookingPaymentByOrderCode } from "../../services/paymentService";

const pickOrderCode = (params) =>
  String(
    params.get("orderCode")
    || params.get("OrderCode")
    || params.get("order_code")
    || "",
  ).trim();

const isNumericOrderCode = (value) => /^\d+$/.test(String(value || "").trim());

/**
 * PayOS return pages: /payment/success | /payment/cancel | /payment/result
 * 1) Đọc orderCode từ query
 * 2) POST /api/payments/order-code/{orderCode}/sync  (bắt buộc — local webhook thường không tới BE)
 * 3) Điều hướng về Waterbus / Charter booking
 */
export function PaymentResult() {
  const { lang } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const syncedRef = useRef("");

  const outcome = useMemo(() => {
    if (location.pathname.includes("/cancel")) return "cancel";
    if (location.pathname.includes("/success")) return "success";
    return "result";
  }, [location.pathname]);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const orderCode = useMemo(() => pickOrderCode(params), [params]);
  const payosId = useMemo(
    () => String(params.get("id") || params.get("paymentId") || "").trim(),
    [params],
  );

  const [phase, setPhase] = useState("syncing"); // syncing | done | error | need_login
  const [errorMsg, setErrorMsg] = useState("");
  const [targetPath, setTargetPath] = useState("");
  const [retryTick, setRetryTick] = useState(0);

  const loginRedirect = useMemo(() => {
    const next = `${location.pathname}${location.search || ""}`;
    return `/login?redirect=${encodeURIComponent(next)}`;
  }, [location.pathname, location.search]);

  useEffect(() => {
    let cancelled = false;

    const resolveTarget = () => {
      const waterbusBookingId = (
        (payosId ? sessionStorage.getItem(`waterbusPaymentBooking:${payosId}`) : "")
        || (orderCode ? sessionStorage.getItem(`waterbusPaymentBookingOrder:${orderCode}`) : "")
        || sessionStorage.getItem("latestWaterbusPaymentBooking")
        || ""
      );

      if (waterbusBookingId) {
        return {
          kind: "waterbus",
          bookingId: waterbusBookingId,
          path: `/profile/my-waterbus-booking`,
        };
      }

      const charterBookingId = (
        (payosId ? sessionStorage.getItem(`paymentBooking:${payosId}`) : "")
        || (orderCode ? sessionStorage.getItem(`charterPaymentOrderCodeLookup:${orderCode}`) : "")
        || sessionStorage.getItem("latestCharterPaymentBooking")
        || ""
      );

      return {
        kind: "charter",
        bookingId: charterBookingId,
        path: charterBookingId
          ? `/profile/my-charter-booking/${charterBookingId}`
          : "/profile/my-charter-booking",
      };
    };

    const run = async () => {
      const target = resolveTarget();
      if (!cancelled) setTargetPath(target.path);

      // Chưa đăng nhập: giữ nguyên /payment/success?... — không đá login mất orderCode.
      if (!isAuthenticated || !localStorage.getItem("accessToken")) {
        if (!cancelled) setPhase("need_login");
        return;
      }

      // Sync orderCode trước khi rời trang — tránh booking mãi Pending khi webhook PayOS không tới local.
      if (orderCode && isNumericOrderCode(orderCode) && syncedRef.current !== orderCode) {
        syncedRef.current = orderCode;
        try {
          await syncBookingPaymentByOrderCode(orderCode);
        } catch (error) {
          console.error("PayOS orderCode sync failed:", error);
          const status = error?.response?.status;
          if (!cancelled) {
            if (status === 401) {
              setPhase("need_login");
              return;
            }
            setErrorMsg(
              error?.response?.data?.message
              || error?.message
              || (lang === "VN"
                ? "Không đồng bộ được thanh toán từ PayOS. Booking có thể còn Pending."
                : "Could not sync payment from PayOS. Booking may stay Pending."),
            );
            setPhase("error");
            return;
          }
        }
      }

      if (cancelled) return;

      const query = new URLSearchParams(location.search);
      query.set("fromPayOs", "1");
      query.set("paymentOutcome", outcome);
      if (orderCode) query.set("orderCode", orderCode);

      const nextSearch = `?${query.toString()}`;

      if (target.kind === "waterbus") {
        navigate(`${target.path}${nextSearch}`, {
          replace: true,
          state: {
            highlightBookingId: target.bookingId,
            paymentOutcome: outcome,
            orderCode,
          },
        });
        return;
      }

      navigate(`${target.path}${nextSearch}`, {
        replace: true,
        state: {
          paymentOutcome: outcome,
          orderCode,
        },
      });
    };

    setPhase("syncing");
    run();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, lang, location.search, navigate, orderCode, outcome, payosId, retryTick]);

  const title = outcome === "cancel"
    ? (lang === "VN" ? "Thanh toán đã hủy" : "Payment cancelled")
    : phase === "need_login"
      ? (lang === "VN" ? "Cần đăng nhập để xác nhận" : "Sign in to confirm payment")
      : (lang === "VN" ? "Đang xác nhận thanh toán" : "Confirming payment");

  const subtitle = phase === "syncing"
    ? (lang === "VN"
      ? "Đang đồng bộ trạng thái PayOS với hệ thống…"
      : "Syncing PayOS status with the system…")
    : phase === "need_login"
      ? (lang === "VN"
        ? "Phiên đăng nhập đã hết hoặc chưa có. Đăng nhập lại — hệ thống sẽ quay về trang này để đồng bộ PayOS."
        : "Your session expired or is missing. Sign in again — you will return here to sync PayOS.")
    : phase === "error"
      ? errorMsg
      : (lang === "VN" ? "Sắp chuyển về trang booking…" : "Redirecting to your booking…");

  return (
    <div className="flex min-h-[72vh] items-center justify-center bg-[#F5F8FA] px-4 py-12 font-body dark:bg-slate-950">
      <div className="w-full max-w-md rounded-4xl border border-slate-100 bg-white p-8 text-center shadow-xl dark:border-slate-700/50 dark:bg-slate-800">
        {phase === "syncing" ? (
          <span className="material-symbols-outlined animate-spin text-4xl text-[#124757] dark:text-yellow-400">
            progress_activity
          </span>
        ) : phase === "error" || phase === "need_login" ? (
          <span className="material-symbols-outlined text-4xl text-rose-500">
            {phase === "need_login" ? "login" : "error"}
          </span>
        ) : (
          <span className="material-symbols-outlined text-4xl text-emerald-500">check_circle</span>
        )}

        <h1 className="mt-4 font-headline text-xl font-black text-[#124757] dark:text-yellow-400">
          {title}
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>

        {orderCode ? (
          <p className="mt-3 font-mono text-[11px] text-slate-400">
            orderCode: {orderCode}
          </p>
        ) : (
          <p className="mt-3 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
            {lang === "VN"
              ? "Không thấy mã đơn trên đường dẫn — kiểm tra cấu hình trang thanh toán thành công."
              : "No order code in the URL — check the payment success page configuration."}
          </p>
        )}

        {phase === "need_login" ? (
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to={loginRedirect}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#124757] px-4 text-xs font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900"
            >
              {lang === "VN" ? "Đăng nhập để đồng bộ" : "Sign in to sync"}
            </Link>
            {targetPath ? (
              <Link
                to={targetPath}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-100 px-4 text-xs font-headline font-black uppercase tracking-wider text-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                {lang === "VN" ? "Về trang booking" : "Go to bookings"}
              </Link>
            ) : null}
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                syncedRef.current = "";
                setErrorMsg("");
                setPhase("syncing");
                setRetryTick((n) => n + 1);
              }}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#124757] px-4 text-xs font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900"
            >
              {lang === "VN" ? "Thử đồng bộ lại" : "Retry sync"}
            </button>
            {targetPath ? (
              <Link
                to={targetPath}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-100 px-4 text-xs font-headline font-black uppercase tracking-wider text-slate-600 dark:bg-slate-700 dark:text-slate-200"
              >
                {lang === "VN" ? "Về trang booking" : "Go to bookings"}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
