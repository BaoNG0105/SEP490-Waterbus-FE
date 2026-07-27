import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import {
  fetchCharterBookingManifestByQrToken,
  updateCharterAttendance,
} from "../../../services/charterBookingService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { normalizeBooking, pick } from "../../../utils/charterBookingAdmin";
import { notify } from "../../../utils/swalToast";

const getPassengerRows = (booking) => {
  const passengers = Array.isArray(booking?.passengers) && booking.passengers.length > 0
    ? booking.passengers
    : (Array.isArray(booking?.tickets) ? booking.tickets : []);

  return passengers.map((passenger, index) => ({
    id: pick(passenger, ["ticketId", "id"], `passenger-${index}`),
    fullName: pick(passenger, ["fullName", "passengerName", "name"], "--"),
    ticketCode: pick(passenger, ["ticketCode", "code"], ""),
    qrToken: pick(passenger, ["qrToken", "ticketQrToken"], ""),
    status: pick(passenger, ["attendanceStatus", "ticketStatus", "status"], "Active"),
  }));
};

export function CharterVerificationPage() {
  const { lang } = useApp();
  const [qrToken, setQrToken] = useState("");
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingTicketId, setCheckingTicketId] = useState("");

  const passengerRows = booking ? getPassengerRows(booking) : [];

  const loadManifest = async (token = qrToken) => {
    const trimmed = String(token || "").trim();
    if (!trimmed) return;
    try {
      setIsLoading(true);
      const detail = await fetchCharterBookingManifestByQrToken(trimmed);
      setBooking(normalizeBooking(detail));
    } catch (error) {
      setBooking(null);
      notify({
        icon: "error",
        title: lang === "VN" ? "Không đọc được QR" : "Unable to read QR",
        text: getApiErrorMessage(
          error,
          lang === "VN" ? "Mã QR không hợp lệ hoặc bạn chưa được phân công chuyến này." : "Invalid QR or you are not assigned to this booking.",
        ),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async (row) => {
    const token = row.qrToken || qrToken;
    if (!token) return;
    try {
      setCheckingTicketId(row.id);
      await updateCharterAttendance(token, { attendanceStatus: "CheckedIn" });
      await loadManifest(token);
      notify({
        icon: "success",
        title: lang === "VN" ? "Check-in thành công" : "Check-in successful",
        timer: 1200,
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
      setCheckingTicketId("");
    }
  };

  return (
    <div className="space-y-6 pb-10 font-body">
      <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
              {lang === "VN" ? "Vận hành thuê tàu" : "Request booking operations"}
            </p>
            <h2 className="mt-1 text-2xl font-headline font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Soát vé / Check-in QR" : "Ticket scan / QR check-in"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-300">
              {lang === "VN"
                ? "Nhập hoặc dán mã QR tổng booking / vé hành khách. Hệ thống chỉ cho phép Manager/Staff được phân công truy cập manifest."
                : "Enter or paste the booking group QR or passenger ticket QR. Only assigned managers/staff can access the manifest."}
            </p>
          </div>
          <Link
            to="/admin/charter-bookings-management"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-headline font-black uppercase tracking-wider text-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400"
          >
            <span className="material-symbols-outlined text-base">directions_boat</span>
            {lang === "VN" ? "Danh sách thuê tàu" : "Booking request list"}
          </Link>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block space-y-2">
            <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
              {lang === "VN" ? "Mã QR" : "QR token"}
            </span>
            <input
              value={qrToken}
              onChange={(event) => setQrToken(event.target.value)}
              placeholder={lang === "VN" ? "Dán mã QR tại đây..." : "Paste QR token here..."}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => loadManifest()}
            disabled={!qrToken.trim() || isLoading}
            className="rounded-2xl bg-[#124757] px-6 py-3 text-xs font-headline font-black uppercase tracking-wider text-white disabled:opacity-60 dark:bg-yellow-400 dark:text-slate-900"
          >
            {isLoading ? (lang === "VN" ? "Đang tải..." : "Loading...") : (lang === "VN" ? "Tra cứu" : "Lookup")}
          </button>
        </div>
      </div>

      {booking ? (
        <div className="space-y-6">
          <section className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">{booking.bookingCode}</h3>
                <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">
                  {booking.customerName} · {booking.route}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  {booking.departureDate} {String(booking.startTime || "").slice(0, 5)}
                  {booking.assignedManagerName ? ` · ${booking.assignedManagerName}` : ""}
                </p>
              </div>
              <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {booking.status}
              </span>
            </div>
          </section>

          <section className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <h3 className="font-headline text-sm font-black uppercase tracking-wide text-slate-800 dark:text-white">
              {lang === "VN" ? "Danh sách hành khách" : "Passenger manifest"}
            </h3>
            <div className="mt-4 space-y-3">
              {passengerRows.length > 0 ? passengerRows.map((row) => (
                <div key={row.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{row.fullName}</p>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      {row.ticketCode || row.id}
                      {" · "}
                      {row.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCheckIn(row)}
                    disabled={checkingTicketId === row.id || String(row.status).toLowerCase().includes("check")}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-60"
                  >
                    {lang === "VN" ? "Check-in" : "Check in"}
                  </button>
                </div>
              )) : (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-bold text-slate-400 dark:border-slate-700">
                  {lang === "VN" ? "Chưa có hành khách trong manifest." : "No passengers in manifest."}
                </p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
