import { notify } from "./swalToast";
import { releaseSeats } from "../services/tripService";

const findStationCode = (stops, stationId) => {
  if (!Array.isArray(stops) || !stationId) return "";
  const stop = stops.find((s) => String(s.stationId) === String(stationId));
  return stop?.stationCode || "";
};

export const bookingHasSeatSelection = (bookingData = {}) => Boolean(
  bookingData.selectedDepartureTrip
  || bookingData.selectedReturnTrip
  || (bookingData.selectedSeatsDeparture?.length > 0)
  || (bookingData.selectedSeatsReturn?.length > 0)
);

/**
 * Xác nhận rời bước chọn ghế.
 * @param {"search"|"home"} leaveTarget - search = về bước tìm chuyến; home = thoát về trang chủ.
 */
export const confirmLeaveSeatSelection = async (lang = "VN", { leaveTarget = "search" } = {}) => {
  const exitHome = leaveTarget === "home";
  const result = await notify({
    dialog: true,
    icon: "warning",
    tone: "warning",
    title: exitHome
      ? (lang === "VN" ? "Thoát đặt vé?" : "Leave booking?")
      : (lang === "VN" ? "Quay lại bước tìm chuyến?" : "Go back to search?"),
    text: exitHome
      ? (lang === "VN"
        ? "Bạn sẽ thoát khỏi quy trình đặt vé. Lựa chọn chuyến/ghế hiện tại sẽ bị xóa."
        : "You will leave the booking flow. Your current trip/seat selection will be cleared.")
      : (lang === "VN"
        ? "Bạn đã chọn chuyến/ghế. Nếu quay lại, lựa chọn hiện tại sẽ bị xóa."
        : "You already selected a trip/seats. Going back will clear your current selection."),
    confirmButtonText: exitHome
      ? (lang === "VN" ? "Thoát" : "Leave")
      : (lang === "VN" ? "Quay lại" : "Go back"),
    cancelButtonText: lang === "VN" ? "Ở lại" : "Stay",
    showCancelButton: true,
  });
  return Boolean(result?.isConfirmed);
};

/** Xác nhận rời bước thanh toán (nhả ghế đang giữ). */
export const confirmLeaveCheckout = async (lang = "VN") => {
  const result = await notify({
    dialog: true,
    icon: "warning",
    tone: "warning",
    title: lang === "VN" ? "Quay lại chọn ghế?" : "Back to seat selection?",
    text: lang === "VN"
      ? "Ghế đang giữ có thể bị hủy. Bạn có chắc muốn quay lại?"
      : "Held seats may be released. Are you sure you want to go back?",
    confirmButtonText: lang === "VN" ? "Quay lại" : "Go back",
    cancelButtonText: lang === "VN" ? "Ở lại" : "Stay",
    showCancelButton: true,
  });
  return Boolean(result?.isConfirmed);
};

export const clearSeatSelectionFields = () => ({
  selectedDepartureTrip: null,
  selectedReturnTrip: null,
  selectedSeatsDeparture: [],
  selectedSeatsReturn: [],
  seatHoldExpiresAt: null,
});

/** Nhả ghế đã hold ở bước thanh toán (best-effort). */
export const releaseHeldBookingSeats = (bookingData = {}) => {
  const {
    isRoundTrip,
    fromWharf,
    toWharf,
    selectedDepartureTrip,
    selectedReturnTrip,
    selectedSeatsDeparture = [],
    selectedSeatsReturn = [],
  } = bookingData;

  if (selectedDepartureTrip?.tripId && selectedSeatsDeparture.length) {
    const fromCode = findStationCode(selectedDepartureTrip.stops, fromWharf);
    const toCode = findStationCode(selectedDepartureTrip.stops, toWharf);
    releaseSeats(
      selectedDepartureTrip.tripId,
      selectedSeatsDeparture.map((s) => s.seatNumber),
      fromCode,
      toCode,
    ).catch(() => {});
  }

  if (isRoundTrip && selectedReturnTrip?.tripId && selectedSeatsReturn.length) {
    const fromCode = findStationCode(selectedReturnTrip.stops, toWharf);
    const toCode = findStationCode(selectedReturnTrip.stops, fromWharf);
    releaseSeats(
      selectedReturnTrip.tripId,
      selectedSeatsReturn.map((s) => s.seatNumber),
      fromCode,
      toCode,
    ).catch(() => {});
  }
};
