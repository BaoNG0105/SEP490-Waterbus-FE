export const getApiErrorMessage = (error, fallback) => {
  const data = error?.response?.data;

  if (!data) return fallback;
  if (typeof data === "string") return rewriteCharterValidationMessage(data) || data;

  // Prefer field-level ValidationProblemDetails over generic ASP.NET title.
  if (data.errors && typeof data.errors === "object") {
    const messages = Object.entries(data.errors)
      .flatMap(([field, value]) => {
        const list = Array.isArray(value) ? value : [value];
        return list
          .filter((item) => typeof item === "string" && item.trim())
          .map((item) => {
            const text = item.trim();
            if (!field || field === "" || field === "$") return text;
            // Avoid duplicating field name when message already includes it.
            return text;
          });
      })
      .map((text) => rewriteCharterValidationMessage(text) || text);
    if (messages.length > 0) return messages.join("\n");
  }

  if (typeof data.message === "string" && data.message) {
    return rewriteCharterValidationMessage(data.message) || data.message;
  }
  if (typeof data.detail === "string" && data.detail) {
    return rewriteCharterValidationMessage(data.detail) || data.detail;
  }
  if (typeof data.title === "string" && data.title) {
    return rewriteCharterValidationMessage(data.title) || data.title;
  }

  return fallback;
};

/** Rewrite outdated BE validation wording to match FE labels and round-trip rules. */
export const rewriteCharterValidationMessage = (message) => {
  if (typeof message !== "string" || !message.trim()) return "";
  const text = message.trim();

  if (/bến đi và bến đến phải khác nhau/i.test(text)) {
    return "Bến đón khách và bến trả khách đang trùng nhau. Máy chủ hiện chưa cho phép lộ trình khứ hồi dù đã có điểm dừng — tạm chọn bến trả khác, hoặc nhờ backend mở rule khi có itineraryStops.";
  }

  if (/from\s*(station)?\s*and\s*to\s*(station)?\s*must\s*be\s*different/i.test(text)) {
    return "Pickup and drop-off are the same. Round-trips with intermediate stops are not accepted by the server yet — choose a different drop-off, or ask backend to allow this when itineraryStops exist.";
  }

  // Soft rename leftover "bến đi/đến" → UI labels when they appear alone in short validation texts.
  if (/\bbến đi\b/i.test(text) || /\bbến đến\b/i.test(text)) {
    return text
      .replace(/\bbến đi\b/gi, "bến đón khách")
      .replace(/\bbến đến\b/gi, "bến trả khách");
  }

  return text;
};

const CHARTER_BOOKING_CODE_PATTERN = /\bCB-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/i;

/** Parse ASP.NET ValidationProblemDetails `errors.duplicateBooking` from create/update charter APIs. */
export const getDuplicateCharterBookingError = (error) => {
  const errors = error?.response?.data?.errors;
  if (!errors || typeof errors !== "object") return null;

  const messages = []
    .concat(errors.duplicateBooking, errors.DuplicateBooking)
    .flat()
    .filter((item) => typeof item === "string" && item.trim());

  if (messages.length === 0) return null;

  const message = messages.join("\n");
  const codeMatch = message.match(CHARTER_BOOKING_CODE_PATTERN);

  return {
    message,
    bookingCode: codeMatch?.[0] || "",
  };
};
