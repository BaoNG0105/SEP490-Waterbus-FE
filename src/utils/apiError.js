export const getApiErrorMessage = (error, fallback) => {
  const status = error?.response?.status;
  const data = error?.response?.data;

  if (error?.code === "ECONNABORTED" || /timeout/i.test(String(error?.message || ""))) {
    return "Máy chủ phản hồi chậm (timeout). Thử quét lại — nếu vẫn chậm, kiểm tra BE / mạng.";
  }

  if (status === 502 || status === 503 || status === 504) {
    // Gateway/proxy — thường BE crash, restart, hoặc timeout; không phải lỗi payload FE.
    const htmlOrText = typeof data === "string" ? data : "";
    if (!htmlOrText || /<!DOCTYPE|<html|Bad Gateway|invalid response/i.test(htmlOrText)) {
      return "Máy chủ / gateway tạm không phản hồi. Kiểm tra BE có đang chạy không (502/503).";
    }
  }

  if (status === 403) {
    const detail =
      (typeof data === "string" && data) ||
      data?.detail ||
      data?.message ||
      data?.title;
    if (detail && !/^forbidden$/i.test(String(detail).trim())) {
      return rewriteCharterValidationMessage(String(detail)) || String(detail);
    }
    return "Bạn không có quyền thực hiện thao tác này.";
  }

  if (!data) {
    if (status === 502 || status === 503 || status === 504) {
      return "Máy chủ / gateway tạm không phản hồi. Kiểm tra BE có đang chạy không (502/503).";
    }
    return fallback;
  }
  if (typeof data === "string") {
    if (/^forbidden$/i.test(data.trim())) {
      return "Bạn không có quyền thực hiện thao tác này.";
    }
    // IIS/Azure gateway HTML (502 Bad Gateway, …)
    if (
      /<!DOCTYPE html/i.test(data)
      || /<html[\s>]/i.test(data)
      || /502\s*-\s*Web server received an invalid response/i.test(data)
      || /Bad Gateway/i.test(data)
    ) {
      return status === 502 || status === 503 || status === 504
        ? "Máy chủ / gateway tạm không phản hồi. Kiểm tra BE có đang chạy không (502/503)."
        : "Máy chủ trả về trang lỗi HTML. Kiểm tra log BE / proxy.";
    }
    // ASP.NET generic HTML/text 500
    if (/an error occurred while processing your request/i.test(data)) {
      return "Máy chủ gặp lỗi khi xử lý (500). Kiểm tra log BE.";
    }
    return rewriteCharterValidationMessage(data) || data;
  }

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
    if (/^forbidden$/i.test(data.title.trim())) {
      return "Bạn không có quyền thực hiện thao tác này.";
    }
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

  if (/chỉ\s*(được\s*)?(gửi\s*)?yêu\s*cầu\s*thêm\s*hành\s*khách\s*1\s*lần|chỉ\s*được\s*thêm\s*hành\s*khách\s*1\s*lần|only\s*(one|1)\s*(passenger\s*)?add|already\s*(submitted|used).*(add|passenger)/i.test(text)) {
    return "Mỗi booking chỉ được gửi yêu cầu thêm hành khách 1 lần. Bạn đã gửi rồi nên không gửi thêm được.";
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
