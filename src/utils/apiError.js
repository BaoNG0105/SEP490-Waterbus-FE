export const getApiErrorMessage = (error, fallback) => {
  const data = error?.response?.data;

  if (!data) return fallback;
  if (typeof data === "string") return data;

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
      });
    if (messages.length > 0) return messages.join("\n");
  }

  if (typeof data.message === "string" && data.message) return data.message;
  if (typeof data.detail === "string" && data.detail) return data.detail;
  if (typeof data.title === "string" && data.title) return data.title;

  return fallback;
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
