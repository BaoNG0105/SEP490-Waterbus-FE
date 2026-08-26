import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchMyCharterBookingDetail, updateMyCharterBooking } from "../../../services/charterBookingService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { handleDuplicateCharterBookingError } from "../../../utils/charterDuplicateBooking";
import {
  assignPassengerTypesFromCounts,
  createEmptyBoatRequest,
  createEmptyPassenger,
  getMinDepartureDate,
  PASSENGER_TYPE_ADULT,
  PASSENGER_TYPE_CHILD,
} from "../../../utils/charterRequestForm";
import { listBookingPassengers } from "../../../utils/charterPassengerAdd";
import { getPassengerBirthYear } from "../../../utils/charterBookingTickets";
import { CharterRequestForm } from "../../../components/CharterRequestForm";
import { notify } from "../../../utils/swalToast";

const editableStatuses = ["PendingQuote", "Confirmed", "Quoted", "DepositPaid", "AwaitingPayment"];

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const viMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (viMatch) {
    return `${viMatch[3]}-${viMatch[2].padStart(2, "0")}-${viMatch[1].padStart(2, "0")}`;
  }

  return "";
};

const getRequestedBoatDeckCount = (boat, fallback = 1) => {
  const directDeckCount = Number(pick(boat, ["requiredNumberOfDecks", "numberOfDecks", "preferredNumberOfDecks", "deckCount"], 0));
  if (directDeckCount === 1 || directDeckCount === 2) return directDeckCount;

  const legacySeatSetupType = pick(boat, ["requiredSeatSetupType", "seatSetupType", "preferredSeatSetupType"], "");
  return legacySeatSetupType === "StandardAndVip" ? 2 : fallback;
};

const buildFormDataFromDetail = (detail, user) => {
  const adultCount = Number(pick(detail, ["adultCount"], 1));
  const childCount = Number(pick(detail, ["childCount"], 0));

  // Ưu tiên passengers[], fallback tickets[]
  const rawPassengers = Array.isArray(detail?.passengers) && detail.passengers.length > 0
    ? detail.passengers
    : Array.isArray(detail?.tickets) && detail.tickets.length > 0
      ? detail.tickets
      : [];

  const passengers = rawPassengers.length > 0
    ? rawPassengers.map((p, index) => {
      const fullName = pick(p, ["fullName", "passengerName", "name", "contactName"], "");
      const birthYear = getPassengerBirthYear(p);
      const passengerType = pick(p, ["passengerType", "type"], index < adultCount ? "Adult" : "Child");
      return {
        fullName,
        birthYear: birthYear || "",
        type: passengerType,
      };
    })
    : [];

  return {
    customerName: pick(detail, ["contactName"], user?.fullName || ""),
    contactPhone: pick(detail, ["contactPhone"], user?.phoneNumber || user?.phone || ""),
    contactEmail: pick(detail, ["contactEmail"], user?.email || ""),
    departureDate: toDateInputValue(pick(detail, ["departureDate"])) || getMinDepartureDate(),
    adultCount,
    childCount,
    startTime: pick(detail, ["startTime"], "08:00").slice(0, 5),
    fromStationId: pick(detail, ["fromStationId"], ""),
    toStationId: pick(detail, ["toStationId"], ""),
    requestedBoats: Array.isArray(detail?.requestedBoats) && detail.requestedBoats.length > 0
      ? detail.requestedBoats.map((boat) => ({ numberOfDecks: getRequestedBoatDeckCount(boat) }))
      : [createEmptyBoatRequest()],
    itineraryStops: Array.isArray(detail?.itineraryStops)
      ? detail.itineraryStops.map((stop, index) => ({
        stationId: pick(stop, ["stationId"], ""),
        stopOrder: Number(pick(stop, ["stopOrder"], index + 1)),
        stayDurationMinutes: Number(pick(stop, ["stayDurationMinutes"], 0)),
        note: pick(stop, ["note"], ""),
      }))
      : [],
    specialRequests: pick(detail, ["specialRequests"], ""),
    rentalUnit: pick(detail, ["rentalUnit"], "Hour") === "Day" ? "Day" : "Hour",
    passengers,
    insuranceSelected: typeof detail?.insuranceSelected === "boolean"
      ? detail.insuranceSelected
      : (typeof detail?.insurance?.selected === "boolean" ? detail.insurance.selected : undefined),
    includeDefaultInsurance: pick(detail, [
      "includeDefaultInsurance",
      "insurance.includeDefaultInsurance",
      "insurance.hasDefaultInsurance",
    ], typeof detail?.insuranceSelected === "boolean"
      ? detail.insuranceSelected
      : (typeof detail?.insurance?.selected === "boolean" ? detail.insurance.selected : false)),
    optionalInsurancePackageId: pick(detail, [
      "optionalInsurancePackageId",
      "insurance.optionalInsurancePackageId",
      "insurance.optional.packageId",
      "insurance.optional.insurancePackageId",
      "insurance.optionalInsuranceId",
    ], null) || null,
    insurancePackageId: pick(detail, [
      "insurancePackageId",
      "insurance.insurancePackageId",
      "insurance.packageId",
      "insurance.id",
    ], null) || null,
  };
};

export function EditCharter() {
  const { lang } = useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [initialFormData, setInitialFormData] = useState(null);

  const loadBookingDetail = useCallback(async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    try {
      setIsLoading(true);
      setLoadError("");
      const detail = await fetchMyCharterBookingDetail(id);
      const status = pick(detail, ["bookingStatus", "status"], "PendingQuote");

      if (!editableStatuses.includes(status)) {
        setLoadError(lang === "VN"
          ? "Yêu cầu này đã hoàn tất hoặc không thể chỉnh sửa."
          : "This request has been completed or can no longer be edited.");
        return;
      }

      setBookingCode(pick(detail, ["bookingCode", "code"], "--"));
      const baseFormData = buildFormDataFromDetail(detail, user);
      setInitialFormData({
        ...baseFormData,
        isPendingQuote: status === "PendingQuote",
      });
    } catch (error) {
      setLoadError(getApiErrorMessage(error, lang === "VN"
        ? "Không thể tải chi tiết yêu cầu để chỉnh sửa."
        : "Unable to load the request details for editing."));
    } finally {
      setIsLoading(false);
    }
  }, [id, isAuthenticated, lang, navigate, user]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadBookingDetail();
  }, [loadBookingDetail]);

  const handleSubmit = async (payload) => {
    try {
      await updateMyCharterBooking(id, payload);

      await notify({
        icon: "success",
        title: lang === "VN" ? "Đã cập nhật yêu cầu" : "Booking request updated",
        text: bookingCode !== "--"
          ? (lang === "VN" ? `Mã yêu cầu: ${bookingCode}` : `Request code: ${bookingCode}`)
          : "",
        confirmButtonColor: "#124757",
      });

      navigate(`/profile/my-charter-booking/${id}`);
    } catch (error) {
      console.error("Lỗi cập nhật charter booking:", error);
      const fallback = lang === "VN"
        ? "Vui lòng kiểm tra ngày đi, số khách và thông tin lộ trình."
        : "Please check departure date, passenger count, and route information.";
      const handledDuplicate = await handleDuplicateCharterBookingError(error, {
        lang,
        navigate,
        fallbackMessage: fallback,
      });
      if (handledDuplicate) return;

      const isConflict = error.response?.status === 409;
      const result = await notify({
        icon: "error",
        title: lang === "VN" ? "Không thể cập nhật" : "Unable to update request",
        text: isConflict
          ? (lang === "VN"
            ? "Dữ liệu yêu cầu vừa thay đổi hoặc đã có một lần lưu đang xử lý. Vui lòng tải lại rồi thử lại."
            : "This request was just changed or another save is still being processed. Please reload and try again.")
          : getApiErrorMessage(error, fallback),
        confirmButtonColor: "#124757",
        confirmButtonText: isConflict ? (lang === "VN" ? "Tải lại dữ liệu" : "Reload") : "OK",
        showCancelButton: isConflict,
        cancelButtonText: lang === "VN" ? "Đóng" : "Close",
      });
      if (isConflict && result.isConfirmed) loadBookingDetail();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center pt-32 pb-20">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (loadError || !initialFormData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-32 pb-20 px-4 sm:px-6 lg:px-8 font-body">
        <main className="max-w-3xl mx-auto">
          <section className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-100 dark:border-slate-700/50 text-center shadow-sm">
            <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
            <h1 className="mt-3 text-xl font-headline font-black text-[#124757] dark:text-white">
              {lang === "VN" ? "Không thể chỉnh sửa yêu cầu" : "Unable to edit this request"}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {loadError || (lang === "VN" ? "Vui lòng thử lại sau." : "Please try again later.")}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <button onClick={() => navigate(`/profile/my-charter-booking/${id}`)} className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 font-bold text-sm">
                {lang === "VN" ? "Quay lại chi tiết" : "Back to request"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-body transition-colors duration-300 pt-32 pb-20 px-4 md:px-8">
      <main className="relative max-w-5xl mx-auto">
        <button onClick={() => navigate(`/profile/my-charter-booking/${id}`)} className="mb-6 flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          {lang === "VN" ? "Quay lại chi tiết" : "Back to Request"}
        </button>

        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-72 h-72 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <CharterRequestForm
          mode="edit"
          idPrefix="edit-charter"
          lang={lang}
          bookingCode={bookingCode}
          initialFormData={initialFormData}
          onSubmit={handleSubmit}
        />
      </main>
    </div>
  );
}
