/**
 * Charter Booking Debug Logger
 * Only logs when VITE_CHARTER_DEBUG=true
 * Never logs sensitive data (tokens, passwords, OTP, payment secrets)
 */

const SHOULD_LOG = import.meta.env.VITE_CHARTER_DEBUG === "true";

const SENSITIVE_KEYS = new Set([
  "authorization",
  "bearer",
  "token",
  "password",
  "otp",
  "secret",
  "cvv",
  "cardnumber",
  "card_number",
  "expire",
  "expiry",
  "pin",
  "api_key",
  "apikey",
  "private_key",
]);

/** Remove sensitive fields from objects before logging */
const sanitize = (data) => {
  if (!data || typeof data !== "object") return data;
  try {
    const sanitized = Array.isArray(data) ? [] : {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      } else if (value && typeof value === "object") {
        sanitized[key] = sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  } catch {
    return "[unserializable]";
  }
};

/**
 * Debug log for Charter Booking flow
 * @param {string} step - Description of the step
 * @param {Record<string, unknown>} data - Data to log (sensitive fields auto-redacted)
 */
export const charterLog = (step, data) => {
  if (!SHOULD_LOG) return;

  console.groupCollapsed(`[Charter] ${step}`);
  if (data && typeof data === "object") {
    console.table(sanitize(data));
  } else {
    console.log(data);
  }
  console.groupEnd();
};

/**
 * Log API error with sanitized details
 */
export const charterLogError = (context, error) => {
  if (!SHOULD_LOG) return;

  console.groupCollapsed(`[Charter] ERROR - ${context}`);
  console.error("Message:", error?.message || "Unknown error");
  if (error?.response) {
    console.table({
      status: error.response.status,
      statusText: error.response.statusText,
      endpoint: error.config?.url,
      method: error.config?.method,
      bookingId: error.config?.params?.bookingId || error.config?.params?.id,
    });
    if (error.response.data) {
      console.table(sanitize(error.response.data));
    }
  } else if (error?.request) {
    console.error("Network error - no response received");
  }
  console.groupEnd();
};

/**
 * Log SignalR event
 */
export const charterLogSignalR = (eventType, data) => {
  if (!SHOULD_LOG) return;

  console.groupCollapsed(`[Charter] SignalR - ${eventType}`);
  console.table({
    eventType,
    bookingStatus: data?.bookingStatus,
    paymentStatus: data?.paymentStatus,
    occurredAt: data?.occurredAt || data?.timestamp,
    bookingId: data?.bookingId || data?.id,
    hasTickets: Array.isArray(data?.tickets) ? data.tickets.length : undefined,
  });
  console.groupEnd();
};
