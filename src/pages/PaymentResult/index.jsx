import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function PaymentResult() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const payosId = params.get("id") || params.get("paymentId") || "";
    const bookingId = (
      (payosId ? sessionStorage.getItem(`paymentBooking:${payosId}`) : "")
      || sessionStorage.getItem("latestCharterPaymentBooking")
      || ""
    );
    const query = location.search
      ? `${location.search}&fromPayOs=1`
      : "?fromPayOs=1";

    navigate(
      bookingId
        ? `/profile/my-charter-booking/${bookingId}${query}`
        : `/profile/my-charter-booking${query}`,
      { replace: true },
    );
  }, [location.search, navigate]);

  return (
    <div className="flex min-h-[72vh] items-center justify-center bg-[#F5F8FA] px-4 py-12 font-body dark:bg-slate-950">
      <div className="text-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#124757] dark:text-yellow-400">progress_activity</span>
        <p className="mt-3 text-xs font-headline font-black uppercase tracking-widest text-slate-400">
          Đang quay lại booking...
        </p>
      </div>
    </div>
  );
}
