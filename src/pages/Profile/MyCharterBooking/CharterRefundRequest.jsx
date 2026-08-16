import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BankBinSelect } from "../../../components/BankBinSelect";
import { useApp } from "../../../context/AppContext";
import { cancelMyCharterBooking, fetchMyCharterBookingDetail } from "../../../services/charterBookingService";
import {
  fetchRefundOtpOptions,
  refundBookingPayment,
  requestRefundBookingOtp,
} from "../../../services/paymentService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { getRefundPaymentId, isPaymentUuid, resolveCharterBookingStatus, resolveCharterPaymentStatus } from "../../../utils/charterBookingAdmin";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("vi-VN");
};

const getPaymentAmount = (payment) =>
  Number(pick(payment, ["amount", "paymentAmount", "paidAmount", "totalAmount"], 0)) || 0;

const getPaymentId = (payment) => getRefundPaymentId(payment);

const isPaidPayment = (payment) =>
  ["paid", "depositpaid"].includes(String(payment?.paymentStatus || "").toLowerCase());

const getRefundablePayment = (booking) => {
  const payments = Array.isArray(booking?.payments) ? booking.payments : [];
  const paidPayment = payments.find((payment) => isPaidPayment(payment) && getPaymentId(payment));
  if (paidPayment) return paidPayment;

  const bookingPaymentId = pick(booking, ["paidPaymentId", "latestPaymentId", "paymentId", "payment.id"], "");
  if (isPaymentUuid(bookingPaymentId)) {
    return { paymentId: bookingPaymentId, paymentStatus: booking.paymentStatus, amount: booking.paidAmount };
  }

  const storedPaymentId = booking?.id ? sessionStorage.getItem(`charterPayment:${booking.id}`) : "";
  if (isPaymentUuid(storedPaymentId)) {
    return { paymentId: storedPaymentId, paymentStatus: booking.paymentStatus, amount: booking.paidAmount };
  }

  return null;
};

const normalizeBooking = (item) => {
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  const paidPayments = payments.filter(isPaidPayment);
  const paidAmountFromPayments = paidPayments.reduce((total, payment) => total + getPaymentAmount(payment), 0);

  return {
    id: pick(item, ["id", "charterBookingId", "bookingId"]),
    bookingCode: pick(item, ["bookingCode", "code"], "--"),
    boatName: pick(item, ["boatName", "boat.name"], "--"),
    route: pick(item, ["routeName", "route", "itineraryName"], "--"),
    departureDate: pick(item, ["departureDate", "startDate"], ""),
    startTime: pick(item, ["startTime"], "--"),
    contactName: pick(item, ["contactName"], ""),
    status: resolveCharterBookingStatus(item),
    paymentStatus: resolveCharterPaymentStatus(item),
    paidAmount: paidAmountFromPayments || Number(pick(item, ["paidAmount", "paidPaymentAmount", "depositAmount"], 0)) || 0,
    payments,
    raw: item,
  };
};

/** BE bỏ auto-lookup — FE bắt buộc nhập accountName thủ công. */
const getRefundValidationMessage = (payload, lang) => {
  if (!/^\d{6}$/.test(payload.bankBin)) {
    return lang === "VN" ? "Vui lòng chọn ngân hàng nhận hoàn từ danh sách." : "Please select a refund bank from the list.";
  }
  if (!/^\d{4,20}$/.test(payload.accountNumber)) {
    return lang === "VN" ? "Số tài khoản chỉ gồm 4-20 chữ số." : "Account number must contain 4-20 digits.";
  }
  if (String(payload.accountName || "").trim().length < 3) {
    return lang === "VN" ? "Vui lòng nhập tên chủ tài khoản (ít nhất 3 ký tự)." : "Please enter the account holder name (at least 3 characters).";
  }
  if (String(payload.reason || "").trim().length > 200) {
    return lang === "VN" ? "Lý do hoàn tiền không được vượt quá 200 ký tự." : "Refund reason must not exceed 200 characters.";
  }
  return "";
};

const unwrapOtpChallenge = (response) => ({
  challengeId: String(
    pick(response, ["challengeId", "id", "otpChallengeId", "data.challengeId", "data.otpChallengeId"], "") || "",
  ).trim(),
  maskedDestination: pick(response, ["maskedDestination", "destination", "data.maskedDestination"], "") || "",
  expiresAt: pick(response, ["expiresAt", "data.expiresAt"], "") || null,
  resendAvailableAt: pick(response, ["resendAvailableAt", "data.resendAvailableAt"], "") || null,
});

const channelLabel = (channel, lang) => {
  const key = String(channel || "").toLowerCase();
  if (key === "phone" || key === "sms") return lang === "VN" ? "Số điện thoại" : "Phone";
  if (key === "email") return lang === "VN" ? "Email" : "Email";
  return channel || "—";
};

export function CharterRefund() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useApp();

  const [booking, setBooking] = useState(() => location.state?.booking ? normalizeBooking(location.state.booking) : null);
  const [payment, setPayment] = useState(location.state?.payment || null);
  const [paymentId, setPaymentId] = useState(location.state?.paymentId || "");
  const [isLoading, setIsLoading] = useState(!location.state?.booking);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [cancelAlreadySubmitted, setCancelAlreadySubmitted] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpMeta, setOtpMeta] = useState(null);
  const [otpOptions, setOtpOptions] = useState(null);
  const [otpChannel, setOtpChannel] = useState("phone");
  const [pendingRefundPayload, setPendingRefundPayload] = useState(null);
  const [form, setForm] = useState({
    reason: "Hoàn tiền booking bị hủy",
    bankBin: "",
    accountNumber: "",
    accountName: location.state?.booking?.contactName && location.state.booking.contactName !== "--"
      ? String(location.state.booking.contactName).toUpperCase()
      : "",
  });

  useEffect(() => {
    let isMounted = true;

    const loadBooking = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        setLoadError("");
        const detail = await fetchMyCharterBookingDetail(id);
        if (!isMounted) return;
        const normalized = normalizeBooking(detail);
        const targetPayment = getRefundablePayment(normalized);
        setBooking(normalized);
        setPayment(targetPayment);
        setPaymentId(getPaymentId(targetPayment || {}));
        setForm((current) => ({
          ...current,
          accountName: current.accountName
            || (normalized.contactName && normalized.contactName !== "--"
              ? String(normalized.contactName).toUpperCase()
              : ""),
        }));
      } catch (error) {
        if (!isMounted) return;
        setLoadError(getApiErrorMessage(error, lang === "VN" ? "Không thể tải thông tin hoàn tiền." : "Unable to load refund information."));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (!booking) loadBooking();
    return () => {
      isMounted = false;
    };
  }, [booking, id, lang]);

  useEffect(() => {
    let alive = true;
    const loadOptions = async () => {
      if (!paymentId) return;
      try {
        const options = await fetchRefundOtpOptions(paymentId);
        if (!alive) return;
        setOtpOptions(options);
        const preferred = options.channels.find((item) => item.isDefault)?.channel
          || options.defaultChannel
          || options.channels[0]?.channel
          || "phone";
        setOtpChannel(preferred === "email" ? "email" : "phone");
      } catch {
        if (!alive) return;
        setOtpOptions(null);
      }
    };
    loadOptions();
    return () => {
      alive = false;
    };
  }, [paymentId]);

  const hasPaidPayment = booking
    && (["paid", "depositpaid"].includes(String(booking.paymentStatus).toLowerCase()) || Number(booking.paidAmount || 0) > 0 || isPaidPayment(payment));
  const currencyFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
  const refundAmountDisplay = Number(otpOptions?.refundAmount || booking?.paidAmount || getPaymentAmount(payment) || 0);
  /** Policy 0% (hủy ≥ 7 ngày) — BE skip bank/OTP, chỉ cần customer xác nhận. */
  const isZeroRefundPolicy = refundAmountDisplay <= 0;

  const handleFieldChange = (field) => (event) => {
    let value = event.target.value;
    if (field === "accountNumber") value = value.replace(/\D/g, "").slice(0, 20);
    if (field === "accountName") value = value.toUpperCase();
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitError("");
  };

  const handleBankBinChange = (bankBin) => {
    setForm((current) => ({ ...current, bankBin }));
    setSubmitError("");
  };

  const sendRefundOtp = async (channel = otpChannel) => {
    if (!paymentId) throw new Error("MISSING_PAYMENT");
    const normalizedChannel = String(channel || "phone").toLowerCase() === "email" ? "email" : "phone";
    const response = await requestRefundBookingOtp(paymentId, { otpChannel: normalizedChannel });
    const meta = unwrapOtpChallenge(response);
    if (!meta.challengeId) {
      throw new Error("MISSING_CHALLENGE");
    }
    setOtpMeta({
      ...meta,
      channel: String(pick(response, ["channel", "data.channel"], normalizedChannel) || normalizedChannel),
    });
    setOtpCode("");
    setOtpStep(true);
    return meta;
  };

  const handleConfirmZeroRefund = async () => {
    if (!booking?.id || !paymentId) {
      setSubmitError(lang === "VN" ? "Không tìm thấy booking hoặc payment cần hoàn tiền." : "Unable to find the booking or payment to refund.");
      return;
    }

    const bookingStatus = String(booking.status || "").toLowerCase();
    const shouldCancelBooking = !cancelAlreadySubmitted && !["cancelled", "refunded"].includes(bookingStatus);
    let didCancelBooking = false;

    try {
      setIsSubmitting(true);
      setSubmitError("");
      if (shouldCancelBooking) {
        await cancelMyCharterBooking(booking.id, {});
        didCancelBooking = true;
        setCancelAlreadySubmitted(true);
      }

      await refundBookingPayment(paymentId, {
        reason: form.reason.trim() || "Hoàn tiền booking bị hủy theo chính sách 0%",
        confirmZeroRefund: true,
      });
      setSuccessMessage(
        lang === "VN"
          ? "Đã xác nhận. Booking đã đóng sổ theo chính sách hoàn 0% — không cần chuyển khoản."
          : "Confirmed. Booking closed under the 0% refund policy — no bank transfer needed.",
      );
    } catch (error) {
      if (didCancelBooking) setCancelAlreadySubmitted(true);
      setSubmitError(getApiErrorMessage(
        error,
        lang === "VN"
          ? "Không thể xác nhận đóng sổ. Vui lòng thử lại."
          : "Unable to confirm closure. Please try again.",
      ));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRefund = async (event) => {
    event.preventDefault();
    if (!booking?.id || !paymentId) {
      setSubmitError(lang === "VN" ? "Không tìm thấy booking hoặc payment cần hoàn tiền." : "Unable to find the booking or payment to refund.");
      return;
    }

    const payload = {
      reason: form.reason.trim() || "Hoàn tiền booking bị hủy",
      bankBin: form.bankBin.trim(),
      accountNumber: form.accountNumber.trim(),
      accountName: form.accountName.trim(),
    };
    const validationMessage = getRefundValidationMessage(payload, lang);
    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    const bookingStatus = String(booking.status || "").toLowerCase();
    const shouldCancelBooking = !cancelAlreadySubmitted && !["cancelled", "refunded"].includes(bookingStatus);
    let didCancelBooking = false;

    try {
      setIsSubmitting(true);
      setSubmitError("");
      if (shouldCancelBooking) {
        await cancelMyCharterBooking(booking.id, {});
        didCancelBooking = true;
        setCancelAlreadySubmitted(true);
      }

      setPendingRefundPayload(payload);
      setIsSendingOtp(true);
      await sendRefundOtp(otpChannel);
    } catch (error) {
      if (didCancelBooking) setCancelAlreadySubmitted(true);
      if (error?.message === "MISSING_CHALLENGE") {
        setSubmitError(lang === "VN"
          ? "Không nhận được challengeId OTP từ máy chủ. Vui lòng thử lại."
          : "Server did not return an OTP challengeId. Please try again.");
      } else {
        const detail = String(error?.response?.data?.detail || "");
        const isPaymentMissing = error?.response?.status === 404 || /payment not found/i.test(detail);
        setSubmitError(
          isPaymentMissing
            ? (lang === "VN"
              ? "Không tìm thấy giao dịch thanh toán. Vui lòng quay lại chi tiết yêu cầu, kiểm tra mục Thanh toán rồi thử lại."
              : "We could not find the payment. Please go back to your booking, check Payments, then try again.")
            : getApiErrorMessage(
              error,
              didCancelBooking || !shouldCancelBooking
                ? (lang === "VN" ? "Yêu cầu đã hủy nhưng chưa gửi được OTP hoàn tiền. Vui lòng thử lại." : "Your request was cancelled, but refund OTP could not be sent. Please try again.")
                : (lang === "VN" ? "Không thể hủy yêu cầu hoặc gửi OTP hoàn tiền. Vui lòng thử lại." : "Unable to cancel the request or send refund OTP. Please try again."),
            ),
        );
      }
    } finally {
      setIsSendingOtp(false);
      setIsSubmitting(false);
    }
  };

  const handleConfirmOtpRefund = async (event) => {
    event.preventDefault();
    const code = String(otpCode || "").replace(/\D/g, "").slice(0, 6);
    if (code.length < 6) {
      setSubmitError(lang === "VN" ? "Vui lòng nhập đủ 6 số OTP." : "Please enter the full 6-digit OTP.");
      return;
    }
    if (!paymentId || !pendingRefundPayload || !otpMeta?.challengeId) {
      setSubmitError(lang === "VN" ? "Thiếu thông tin OTP. Vui lòng gửi lại mã." : "Missing OTP info. Please resend the code.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      await refundBookingPayment(paymentId, {
        ...pendingRefundPayload,
        otpChallengeId: otpMeta.challengeId,
        otpCode: code,
      });
      setSuccessMessage(
        cancelAlreadySubmitted
          ? (lang === "VN"
            ? "Yêu cầu thuê tàu đã được hủy và yêu cầu hoàn tiền đã gửi. Chúng tôi sẽ xử lý theo chính sách hoàn tiền."
            : "Your booking request was cancelled and the refund request was submitted. We will process it under our refund policy.")
          : (lang === "VN"
            ? "Đã gửi yêu cầu hoàn tiền. Chúng tôi sẽ xử lý theo chính sách hoàn tiền của Waterbus."
            : "Refund request submitted. We will process it according to Waterbus refund policy."),
      );
    } catch (error) {
      setSubmitError(getApiErrorMessage(
        error,
        lang === "VN" ? "OTP không hợp lệ hoặc hoàn tiền thất bại. Vui lòng thử lại." : "Invalid OTP or refund failed. Please try again.",
      ));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!paymentId) return;
    try {
      setIsSendingOtp(true);
      setSubmitError("");
      await sendRefundOtp(otpChannel);
    } catch (error) {
      setSubmitError(getApiErrorMessage(
        error,
        lang === "VN" ? "Không gửi lại được OTP." : "Unable to resend OTP.",
      ));
    } finally {
      setIsSendingOtp(false);
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
          <button onClick={() => navigate("/profile/my-charter-booking")} className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#124757] dark:text-slate-400 dark:hover:text-yellow-400">
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

  if (!hasPaidPayment) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-30 font-body dark:bg-slate-900">
        <main className="mx-auto max-w-4xl">
          <button onClick={() => navigate(`/profile/my-charter-booking/${booking.id}`)} className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#124757] dark:text-slate-400 dark:hover:text-yellow-400">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            {lang === "VN" ? "Quay lại chi tiết" : "Back to request"}
          </button>
          <section className="rounded-3xl border border-amber-100 bg-white p-8 text-center dark:border-amber-500/20 dark:bg-slate-800">
            <span className="material-symbols-outlined text-4xl text-amber-500">info</span>
            <h1 className="mt-3 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Chưa có khoản thanh toán cần hoàn" : "No refundable payment found"}
            </h1>
            <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-300">
              {lang === "VN" ? "Chỉ các yêu cầu đã thanh toán mới cần nhập tài khoản nhận hoàn tiền." : "Only paid requests need a refund receiving account."}
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (successMessage) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-30 font-body dark:bg-slate-900">
        <main className="mx-auto max-w-4xl">
          <section className="rounded-3xl border border-emerald-100 bg-white p-8 text-center dark:border-emerald-500/20 dark:bg-slate-800">
            <span className="material-symbols-outlined text-4xl text-emerald-500">check_circle</span>
            <h1 className="mt-3 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Đã gửi yêu cầu hoàn tiền" : "Refund request submitted"}
            </h1>
            <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-300">{successMessage}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={() => navigate(`/profile/my-charter-booking/${booking.id}`)} className="rounded-xl bg-[#124757] px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-white dark:bg-yellow-400 dark:text-slate-900">
                {lang === "VN" ? "Xem chi tiết" : "View request"}
              </button>
              <button onClick={() => navigate("/profile/my-charter-booking")} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {lang === "VN" ? "Danh sách booking" : "Booking list"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const otpChannels = otpOptions?.channels?.length
    ? otpOptions.channels
    : [{ channel: "phone", maskedDestination: "", label: "phone" }];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-30 font-body dark:bg-slate-900">
      <main className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl dark:border-slate-700/50 dark:bg-slate-800">
          <div className="border-b border-slate-100 p-6 dark:border-slate-700 md:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                  {lang === "VN" ? "Hoàn tiền thuê tàu" : "Booking request refund"}
                </p>
                <h1 className="mt-2 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400 md:text-3xl">
                  {isZeroRefundPolicy
                    ? (lang === "VN" ? "Xác nhận đã hoàn tiền" : "Confirm refund closed")
                    : otpStep
                      ? (lang === "VN" ? "Xác nhận OTP hoàn tiền" : "Confirm refund OTP")
                      : (lang === "VN" ? "Tài khoản nhận hoàn tiền" : "Refund receiving account")}
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-bold text-slate-500 dark:text-slate-300">
                  {isZeroRefundPolicy
                    ? (lang === "VN"
                      ? "Theo chính sách hủy, khoản hoàn của bạn là 0 ₫. Bạn không cần nhập tài khoản — chỉ cần xác nhận để đóng sổ booking."
                      : "Per our cancellation policy, your refund is 0 VND. No bank account is needed — just confirm to close this booking.")
                    : otpStep
                      ? (lang === "VN"
                        ? `Đã gửi mã OTP${otpMeta?.maskedDestination ? ` tới ${otpMeta.maskedDestination}` : ""}. Nhập mã 6 số để xác nhận hoàn tiền.`
                        : `An OTP was sent${otpMeta?.maskedDestination ? ` to ${otpMeta.maskedDestination}` : ""}. Enter the 6-digit code to confirm the refund.`)
                      : (lang === "VN"
                        ? "Vui lòng nhập ngân hàng, số tài khoản và tên chủ tài khoản. Chọn kênh OTP rồi gửi xác nhận."
                        : "Please enter bank, account number, and account holder name. Choose an OTP channel, then confirm.")}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[0.9fr_1.1fr]">
            <aside className="space-y-4">
              <div className="rounded-2xl border border-[#D8E7EA] bg-[#F7FAFB] p-5 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">Booking</p>
                <h2 className="mt-1 font-headline text-xl font-black text-[#124757] dark:text-yellow-400">{booking.bookingCode}</h2>
                <div className="mt-4 space-y-3 text-sm">
                  {[
                    { label: lang === "VN" ? "Tàu" : "Boat", value: booking.boatName },
                    { label: lang === "VN" ? "Lộ trình" : "Route", value: booking.route },
                    { label: lang === "VN" ? "Khởi hành" : "Departure", value: `${formatDate(booking.departureDate)} ${String(booking.startTime).slice(0, 5)}` },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-3 border-b border-slate-200/70 pb-2 last:border-0 last:pb-0 dark:border-slate-700">
                      <span className="text-xs font-bold text-slate-400">{item.label}</span>
                      <span className="max-w-56 wrap-break-word text-right text-xs font-black text-slate-700 dark:text-slate-100">{item.value || "--"}</span>
                    </div>
                  ))}

                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-bold text-slate-400">{lang === "VN" ? "Số tiền hoàn" : "Refund amount"}</span>
                    <span className="max-w-56 wrap-break-word text-right text-xl font-headline font-black text-[#124757] dark:text-yellow-400">
                      {refundAmountDisplay > 0 ? currencyFormatter.format(refundAmountDisplay) : "--"}
                    </span>
                  </div>
                </div>
              </div>
            </aside>

            {isZeroRefundPolicy ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5 dark:border-teal-500/20 dark:bg-teal-500/10">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined mt-0.5 text-2xl text-teal-600 dark:text-teal-300">verified</span>
                    <div className="min-w-0">
                      <p className="font-headline text-sm font-black uppercase tracking-wide text-teal-700 dark:text-teal-300">
                        {lang === "VN" ? "Không cần chuyển khoản" : "No transfer needed"}
                      </p>
                      <p className="mt-1 text-xs font-medium leading-5 text-teal-800/90 dark:text-teal-200/90">
                        {lang === "VN"
                          ? "Bạn không phải nhập ngân hàng / số tài khoản / OTP. Chỉ cần xác nhận một lần để hệ thống đóng sổ theo chính sách 0%."
                          : "No bank, account number, or OTP is required. Just confirm once to close this booking under the 0% refund policy."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                    {lang === "VN" ? "Số tiền hoàn" : "Refund amount"}
                  </p>
                  <p className="mt-1 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
                    0 ₫
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {lang === "VN"
                      ? "Theo chính sách hủy — không hoàn tiền trong trường hợp này."
                      : "Per cancellation policy — no refund applies in this case."}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                    {lang === "VN" ? "Lý do hủy (tùy chọn)" : "Cancel reason (optional)"}
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
                  <button
                    type="button"
                    onClick={() => navigate(`/profile/my-charter-booking/${booking.id}`)}
                    disabled={isSubmitting}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {lang === "VN" ? "Để sau" : "Later"}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmZeroRefund}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-white hover:bg-teal-700 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-base">{isSubmitting ? "progress_activity" : "check_circle"}</span>
                    {isSubmitting
                      ? (lang === "VN" ? "Đang xác nhận…" : "Confirming…")
                      : (lang === "VN" ? "Xác nhận đã hoàn tiền" : "Confirm refund closed")}
                  </button>
                </div>
              </div>
            ) : !otpStep ? (
              <form onSubmit={handleSubmitRefund} className="space-y-5">
                <BankBinSelect
                  value={form.bankBin}
                  onChange={handleBankBinChange}
                  lang={lang}
                  disabled={isSubmitting}
                  hideBin
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
                    <p className="mt-1.5 text-[11px] font-medium text-slate-400">
                      {lang === "VN"
                        ? "Nhập đúng họ tên trên tài khoản ngân hàng."
                        : "Enter the exact bank account holder name."}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                    {lang === "VN" ? "Kênh nhận OTP" : "OTP channel"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {otpChannels.map((item) => {
                      const active = otpChannel === item.channel;
                      return (
                        <button
                          key={item.channel}
                          type="button"
                          onClick={() => setOtpChannel(item.channel)}
                          className={`rounded-xl border px-4 py-2.5 text-left text-xs font-bold transition ${
                            active
                              ? "border-[#124757] bg-[#124757] text-white dark:border-yellow-400 dark:bg-yellow-400 dark:text-slate-900"
                              : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          }`}
                        >
                          <span className="block font-headline font-black uppercase tracking-wider">
                            {channelLabel(item.channel, lang)}
                          </span>
                          {item.maskedDestination ? (
                            <span className={`mt-0.5 block text-[10px] ${active ? "opacity-80" : "text-slate-400"}`}>
                              {item.maskedDestination}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
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
                  <button type="button" onClick={() => navigate(`/profile/my-charter-booking/${booking.id}`)} disabled={isSubmitting} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {lang === "VN" ? "Hủy thao tác" : "Cancel"}
                  </button>
                  <button type="submit" disabled={isSubmitting || isSendingOtp} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-white disabled:opacity-60">
                    {isSubmitting || isSendingOtp
                      ? (lang === "VN" ? "Đang gửi OTP…" : "Sending OTP…")
                      : (["cancelled", "refunded"].includes(String(booking.status || "").toLowerCase())
                        ? (lang === "VN" ? "Gửi OTP hoàn tiền" : "Send refund OTP")
                        : (lang === "VN" ? "Xác nhận hủy và gửi OTP" : "Confirm cancel & send OTP"))}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmOtpRefund} className="space-y-5">
                <div>
                  <label className="mb-2 block text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                    OTP
                  </label>
                  <input
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setSubmitError("");
                    }}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    placeholder="123456"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xl font-black tracking-[0.35em] outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                {submitError && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                    {submitError}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isSubmitting || isSendingOtp}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {isSendingOtp
                      ? (lang === "VN" ? "Đang gửi…" : "Sending…")
                      : (lang === "VN" ? "Gửi lại OTP" : "Resend OTP")}
                  </button>
                  <button type="submit" disabled={isSubmitting || otpCode.length < 6} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-xs font-headline font-black uppercase tracking-wider text-white disabled:opacity-60">
                    {isSubmitting
                      ? (lang === "VN" ? "Đang hoàn tiền…" : "Submitting…")
                      : (lang === "VN" ? "Xác nhận hoàn tiền" : "Confirm refund")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
