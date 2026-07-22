import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BankBinSelect } from "../../../components/BankBinSelect";
import { useApp } from "../../../context/AppContext";
import { cancelMyBooking, fetchMyBookingDetail } from "../../../services/bookingService";
import { refundBookingPayment } from "../../../services/paymentService";
import { getApiErrorMessage } from "../../../utils/apiError";

// Chỉ vé WaterSightseeing được yêu cầu hoàn tiền tự phục vụ, và chỉ khi còn hơn 24h trước giờ khởi hành.
const REFUND_ELIGIBLE_HOURS = 24;

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const getStatusKey = (status) => String(status || "").toLowerCase().replace(/[\s_-]/g, "");

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
};

const isPaidPayment = (payment) =>
  ["paid", "success", "succeeded", "completed"].includes(getStatusKey(payment?.paymentStatus));

const getPaymentId = (payment) => String(pick(payment, ["id", "paymentId"], "")).trim();

const getEarliestDepartureMs = (items) => {
  const times = (Array.isArray(items) ? items : [])
    .map((item) => new Date(pick(item, ["scheduledDeparture"], "")).getTime())
    .filter((time) => Number.isFinite(time));
  return times.length ? Math.min(...times) : 0;
};

const normalizeBooking = (data) => {
  const items = Array.isArray(data?.items) ? data.items : [];
  const payments = Array.isArray(data?.payments) ? data.payments : [];
  return {
    id: String(pick(data, ["bookingId", "id"], "")),
    bookingCode: pick(data, ["bookingCode"], "--"),
    status: pick(data, ["bookingStatus"], "--"),
    serviceType: pick(data, ["serviceType"], ""),
    totalAmount: Number(pick(data, ["totalAmount"], 0)),
    passengerName: pick(items[0] || {}, ["passengerName"], ""),
    earliestDepartureMs: getEarliestDepartureMs(items),
    items,
    payments,
  };
};

const getRefundValidationMessage = (payload, lang) => {
  if (!/^\d{6}$/.test(payload.bankBin)) {
    return lang === "VN" ? "Vui lòng chọn ngân hàng hợp lệ với bankBin gồm 6 chữ số." : "Please select a valid bank with a 6-digit bankBin.";
  }
  if (!/^\d{4,20}$/.test(payload.accountNumber)) {
    return lang === "VN" ? "Số tài khoản chỉ gồm 4-20 chữ số." : "Account number must contain 4-20 digits.";
  }
  if (payload.accountName.trim().length < 3) {
    return lang === "VN" ? "Tên chủ tài khoản cần có ít nhất 3 ký tự." : "Account name must contain at least 3 characters.";
  }
  if (payload.reason.trim().length > 200) {
    return lang === "VN" ? "Lý do hoàn tiền không được vượt quá 200 ký tự." : "Refund reason must not exceed 200 characters.";
  }
  return "";
};

export function SightseeingRefundRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lang } = useApp();

  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [cancelAlreadySubmitted, setCancelAlreadySubmitted] = useState(false);
  const [form, setForm] = useState({
    reason: "Yêu cầu hoàn tiền tour WaterSightseeing",
    bankBin: "",
    accountNumber: "",
    accountName: "",
  });

  useEffect(() => {
    let isMounted = true;

    const loadBooking = async () => {
      try {
        setIsLoading(true);
        setLoadError("");
        const data = await fetchMyBookingDetail(id);
        if (!isMounted) return;
        const normalized = normalizeBooking(data);
        setBooking(normalized);
        setForm((current) => ({
          ...current,
          accountName: current.accountName || normalized.passengerName || "",
        }));
      } catch (error) {
        if (!isMounted) return;
        setLoadError(getApiErrorMessage(error, lang === "VN" ? "Không thể tải thông tin hoàn tiền." : "Unable to load refund information."));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadBooking();
    return () => {
      isMounted = false;
    };
  }, [id, lang]);

  const currencyFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

  const refundablePayment = booking?.payments.find((payment) => isPaidPayment(payment) && getPaymentId(payment));
  const paymentId = getPaymentId(refundablePayment || {});
  const statusKey = getStatusKey(booking?.status);
  const isSightseeing = String(booking?.serviceType || "").toLowerCase() === "sightseeing";
  const isClosedStatus = ["cancelled", "completed", "expired"].includes(statusKey);
  const hoursUntilDeparture = booking?.earliestDepartureMs
    ? (booking.earliestDepartureMs - Date.now()) / (60 * 60 * 1000)
    : null;
  const isPastEligibilityWindow = hoursUntilDeparture !== null && hoursUntilDeparture <= REFUND_ELIGIBLE_HOURS;
  // BE: ẩn/disable self-refund cho booking thường + sightseeing (charter dùng luồng riêng).
  const isEligible = false;

  const handleFieldChange = (field) => (event) => {
    const value = field === "accountNumber"
      ? event.target.value.replace(/\D/g, "").slice(0, 20)
      : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitError("");
  };

  const handleBankBinChange = (bankBin) => {
    setForm((current) => ({ ...current, bankBin }));
    setSubmitError("");
  };

  const handleSubmitRefund = async (event) => {
    event.preventDefault();
    if (!booking?.id || !paymentId) {
      setSubmitError(lang === "VN" ? "Không tìm thấy booking hoặc payment cần hoàn tiền." : "Unable to find the booking or payment to refund.");
      return;
    }

    const payload = {
      reason: form.reason.trim() || "Customer refund",
      bankBin: form.bankBin.trim(),
      accountNumber: form.accountNumber.trim(),
      accountName: form.accountName.trim(),
    };
    const validationMessage = getRefundValidationMessage(payload, lang);
    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    const shouldCancelBooking = !cancelAlreadySubmitted && !["cancelled"].includes(statusKey);
    let didCancelBooking = false;

    try {
      setIsSubmitting(true);
      setSubmitError("");
      if (shouldCancelBooking) {
        await cancelMyBooking(booking.id);
        didCancelBooking = true;
        setCancelAlreadySubmitted(true);
      }
      await refundBookingPayment(paymentId, payload);
      setSuccessMessage(
        lang === "VN"
          ? "Booking đã được hủy và yêu cầu hoàn tiền đã gửi. Chúng tôi sẽ xử lý theo chính sách hoàn tiền của Waterbus."
          : "Your booking was cancelled and the refund request was submitted. We will process it under our refund policy."
      );
    } catch (error) {
      if (didCancelBooking) setCancelAlreadySubmitted(true);
      setSubmitError(
        getApiErrorMessage(
          error,
          didCancelBooking
            ? (lang === "VN" ? "Booking đã hủy nhưng hoàn tiền chưa gửi được. Vui lòng thử lại." : "Your booking was cancelled, but the refund could not be submitted. Please try again.")
            : (lang === "VN" ? "Không thể hủy booking hoặc gửi hoàn tiền. Vui lòng thử lại." : "Unable to cancel the booking or submit the refund. Please try again.")
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-30 font-body dark:bg-slate-900">
        <main className="mx-auto max-w-4xl">
          <div className="flex min-h-80 items-center justify-center rounded-3xl border border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757] dark:border-slate-700 dark:border-t-yellow-400"></div>
          </div>
        </main>
      </div>
    );
  }

  if (loadError || !booking) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-30 font-body dark:bg-slate-900">
        <main className="mx-auto max-w-4xl">
          <button onClick={() => navigate("/profile/my-sightseeing-booking")} className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#124757] dark:text-slate-400 dark:hover:text-yellow-400">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            {lang === "VN" ? "Quay lại danh sách" : "Back to list"}
          </button>
          <section className="rounded-3xl border border-rose-100 bg-white p-8 text-center dark:border-rose-500/20 dark:bg-slate-800">
            <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
            <h1 className="mt-3 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Không thể mở trang hoàn tiền" : "Unable to open refund page"}
            </h1>
            <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-300">{loadError}</p>
          </section>
        </main>
      </div>
    );
  }

  if (successMessage) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-30 font-body dark:bg-slate-900">
        <main className="mx-auto max-w-4xl">
          <section className="rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-xl dark:border-emerald-500/20 dark:bg-slate-800">
            <span className="material-symbols-outlined text-5xl text-emerald-500">check_circle</span>
            <h1 className="mt-4 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Đã gửi yêu cầu hoàn tiền" : "Refund request submitted"}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm font-bold text-slate-500 dark:text-slate-300">{successMessage}</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button onClick={() => navigate(`/profile/my-sightseeing-booking/${booking.id}`)} className="rounded-xl bg-[#124757] px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-white dark:bg-yellow-400 dark:text-slate-900">
                {lang === "VN" ? "Xem chi tiết" : "View booking"}
              </button>
              <button onClick={() => navigate("/profile/my-sightseeing-booking")} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400">
                {lang === "VN" ? "Danh sách booking" : "Booking list"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!isEligible) {
    const reason = lang === "VN"
      ? "Vé thường và vé tham quan không hỗ trợ tự yêu cầu hoàn tiền trên app. Liên hệ hỗ trợ nếu cần xử lý thủ công."
      : "Regular and sightseeing tickets do not support self-service refunds in the app. Contact support for manual handling.";

    return (
      <div className="min-h-screen bg-slate-50 px-4 py-30 font-body dark:bg-slate-900">
        <main className="mx-auto max-w-4xl">
          <button onClick={() => navigate(`/profile/my-sightseeing-booking/${booking.id}`)} className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#124757] dark:text-slate-400 dark:hover:text-yellow-400">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            {lang === "VN" ? "Quay lại chi tiết" : "Back to booking"}
          </button>
          <section className="rounded-3xl border border-slate-100 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
            {/* <span className="material-symbols-outlined text-4xl text-slate-400">event_busy</span> */}
            <h1 className="mt-3 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Không thể yêu cầu hoàn tiền" : "Refund request unavailable"}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm font-bold text-slate-500 dark:text-slate-300">{reason}</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-30 font-body dark:bg-slate-900">
      <main className="mx-auto max-w-5xl space-y-6">
        <button onClick={() => navigate(`/profile/my-sightseeing-booking/${booking.id}`)} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#124757] dark:text-slate-400 dark:hover:text-yellow-400">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          {lang === "VN" ? "Quay lại chi tiết" : "Back to booking"}
        </button>

        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl dark:border-slate-700/50 dark:bg-slate-800">
          <div className="border-b border-slate-100 p-6 dark:border-slate-700 md:p-8">
            <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
              {lang === "VN" ? "Hoàn tiền WaterSightseeing" : "WaterSightseeing refund"}
            </p>
            <h1 className="mt-2 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400 md:text-3xl">
              {lang === "VN" ? "Tài khoản nhận hoàn tiền" : "Refund receiving account"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-bold text-slate-500 dark:text-slate-300">
              {lang === "VN"
                ? "Vui lòng nhập chính xác ngân hàng, số tài khoản và tên chủ tài khoản. Sau khi gửi, hệ thống sẽ hủy booking và tạo yêu cầu hoàn tiền."
                : "Please enter your bank, account number, and account name carefully. After submitting, we will cancel the booking and start the refund."}
            </p>
          </div>

          <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[0.9fr_1.1fr]">
            <aside className="space-y-4">
              <div className="rounded-2xl border border-[#D8E7EA] bg-[#F7FAFB] p-5 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">Booking</p>
                <h2 className="mt-1 font-headline text-xl font-black text-[#124757] dark:text-yellow-400">{booking.bookingCode}</h2>
                <div className="mt-4 space-y-3 text-sm">
                  {[
                    { label: lang === "VN" ? "Khởi hành sớm nhất" : "Earliest departure", value: formatDateTime(booking.earliestDepartureMs) },
                    { label: lang === "VN" ? "Tổng tiền" : "Total amount", value: currencyFormatter.format(booking.totalAmount) },
                    { label: lang === "VN" ? "Số tiền đã thanh toán" : "Paid amount", value: currencyFormatter.format(Number(refundablePayment?.amount) || 0) },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-3 border-b border-slate-200/70 pb-2 last:border-0 last:pb-0 dark:border-slate-700">
                      <span className="text-xs font-bold text-slate-400">{item.label}</span>
                      <span className="max-w-56 wrap-break-word text-right text-xs font-black text-slate-700 dark:text-slate-100">{item.value || "--"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <form onSubmit={handleSubmitRefund} className="space-y-5">
              <BankBinSelect
                value={form.bankBin}
                onChange={handleBankBinChange}
                lang={lang}
                disabled={isSubmitting}
                label={lang === "VN" ? "Ngân hàng nhận hoàn" : "Refund bank"}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                    {lang === "VN" ? "Số tài khoản" : "Account number"}
                  </label>
                  <input
                    value={form.accountNumber}
                    onChange={handleFieldChange("accountNumber")}
                    inputMode="numeric"
                    maxLength={20}
                    placeholder="123456789"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                    {lang === "VN" ? "Tên chủ tài khoản" : "Account name"}
                  </label>
                  <input
                    value={form.accountName}
                    onChange={handleFieldChange("accountName")}
                    placeholder="NGUYEN VAN A"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                  {lang === "VN" ? "Lý do hoàn tiền" : "Refund reason"}
                </label>
                <textarea
                  value={form.reason}
                  onChange={handleFieldChange("reason")}
                  maxLength={200}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>

              {submitError && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {submitError}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => navigate(`/profile/my-sightseeing-booking/${booking.id}`)} disabled={isSubmitting} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {lang === "VN" ? "Hủy thao tác" : "Cancel"}
                </button>
                <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-white disabled:opacity-60">
                  {isSubmitting
                    ? (lang === "VN" ? "Đang gửi" : "Submitting")
                    : (lang === "VN" ? "Hủy và gửi hoàn tiền" : "Cancel and submit refund")}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
