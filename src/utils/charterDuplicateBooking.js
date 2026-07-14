import { getApiErrorMessage, getDuplicateCharterBookingError } from "./apiError";
import { showConfirmDialog } from "./swalToast";

/**
 * Shows BE duplicate-booking validation (HTTP 400) and offers navigation to the existing request.
 * Returns true when the error was handled as a duplicate; caller should keep form data either way.
 */
export const handleDuplicateCharterBookingError = async (error, { lang, navigate, fallbackMessage }) => {
  const duplicate = getDuplicateCharterBookingError(error);
  if (!duplicate) return false;

  const message = duplicate.message || getApiErrorMessage(error, fallbackMessage);
  const hasCode = Boolean(duplicate.bookingCode);

  const result = await showConfirmDialog({
    tone: "warning",
    icon: "warning",
    title: lang === "VN" ? "Yêu cầu trùng" : "Duplicate request",
    text: message,
    confirmButtonText: hasCode
      ? (lang === "VN" ? "Xem yêu cầu hiện có" : "View existing request")
      : (lang === "VN" ? "Đến danh sách yêu cầu" : "Go to my charter requests"),
    showCancelButton: true,
    cancelButtonText: lang === "VN" ? "Đóng" : "Close",
  });

  if (result.isConfirmed) {
    navigate("/profile/my-charter-booking", {
      state: hasCode ? { searchCode: duplicate.bookingCode } : undefined,
    });
  }

  return true;
};
