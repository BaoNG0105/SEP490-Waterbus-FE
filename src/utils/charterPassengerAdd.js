import { getBoatSeatCount, pick } from "./charterBookingAdmin";
import { getPassengerBirthYear, hasCharterPassengerName, isCharterFullyPaid } from "./charterBookingTickets";

/** Spec nghiệp vụ: tối đa 2 lần gửi yêu cầu thêm (FE heuristic khi BE chưa trả remainingAddAttempts). */
export const CHARTER_MAX_PASSENGER_ADD_ATTEMPTS = 2;

const TERMINAL_STATUSES = new Set(["Cancelled", "Completed", "Refunded", "Expired"]);

export const normalizePassengerApprovalStatus = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "approved" || raw === "approve" || raw === "accepted") return "Approved";
  if (raw === "pending" || raw === "waiting" || raw === "submitted") return "Pending";
  if (raw === "rejected" || raw === "reject" || raw === "denied") return "Rejected";
  return String(value || "Approved");
};

export const formatPassengerApprovalStatus = (status, lang = "VN", reviewNote = "") => {
  const normalized = normalizePassengerApprovalStatus(status);
  if (normalized === "Pending") {
    return lang === "VN" ? "Chờ duyệt" : "Pending approval";
  }
  if (normalized === "Rejected") {
    const note = String(reviewNote || "").trim();
    if (lang === "VN") return note ? `Từ chối: ${note}` : "Từ chối";
    return note ? `Rejected: ${note}` : "Rejected";
  }
  return lang === "VN" ? "Đã duyệt" : "Approved";
};

export const getPassengerApprovalTone = (status) => {
  const normalized = normalizePassengerApprovalStatus(status);
  if (normalized === "Pending") {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200";
  }
  if (normalized === "Rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";
};

export const getCharterBoatCapacity = (booking) => {
  const boats = Array.isArray(booking?.selectedBoats) ? booking.selectedBoats : [];
  const fromBoats = boats.reduce((sum, boat) => sum + (getBoatSeatCount(boat) || 0), 0);
  if (fromBoats > 0) return fromBoats;

  const direct = Number(
    pick(booking, ["boatCapacity", "capacity", "totalCapacity", "maxPassengers"], 0),
  ) || 0;
  if (direct > 0) return direct;

  // Không fallback passengerCount — tránh hiểu nhầm "sức chứa = số khách đã đăng ký".
  return 0;
};

export const listBookingPassengers = (booking) => {
  if (Array.isArray(booking?.passengers) && booking.passengers.length > 0) return booking.passengers;
  if (Array.isArray(booking?.tickets) && booking.tickets.length > 0) return booking.tickets;
  return [];
};

export const countApprovedOrDefaultPassengers = (passengers = []) =>
  passengers.filter((row) => {
    if (!hasCharterPassengerName(row)) return false;
    const status = normalizePassengerApprovalStatus(
      pick(row, ["approvalStatus", "passengerApprovalStatus", "addRequestStatus"], "Approved"),
    );
    return status !== "Rejected";
  }).length;

export const countPendingAddPassengers = (passengers = []) =>
  passengers.filter((row) => {
    if (!hasCharterPassengerName(row)) return false;
    return normalizePassengerApprovalStatus(
      pick(row, ["approvalStatus", "passengerApprovalStatus", "addRequestStatus"], ""),
    ) === "Pending";
  }).length;

export const getPassengerAddRequestBatches = (passengers = []) => {
  const map = new Map();

  passengers.forEach((row, index) => {
    const batchId = String(
      pick(row, ["requestBatchId", "passengerAddRequestId", "addRequestId", "batchId"], ""),
    ).trim();
    if (!batchId) return;

    const status = normalizePassengerApprovalStatus(
      pick(row, ["approvalStatus", "passengerApprovalStatus", "addRequestStatus"], "Pending"),
    );
    const existing = map.get(batchId) || {
      requestBatchId: batchId,
      status,
      requestedAt: pick(row, ["requestedAt", "createdAt", "submittedAt"], ""),
      reviewedAt: pick(row, ["reviewedAt", "approvedAt", "rejectedAt"], ""),
      reviewNote: pick(row, ["reviewNote", "rejectNote", "note"], ""),
      senderName: pick(row, ["requestedByName", "senderName", "createdByName", "customerName"], ""),
      passengers: [],
    };

    existing.passengers.push({
      ...row,
      fullName: pick(row, ["fullName", "passengerName", "name"], ""),
      birthYear: getPassengerBirthYear(row),
      index,
    });
    if (!existing.requestedAt) {
      existing.requestedAt = pick(row, ["requestedAt", "createdAt"], "");
    }
    if (status === "Pending") existing.status = "Pending";
    else if (existing.status !== "Pending") existing.status = status;
    if (pick(row, ["reviewNote", "rejectNote", "note"], "")) {
      existing.reviewNote = pick(row, ["reviewNote", "rejectNote", "note"], "");
    }
    map.set(batchId, existing);
  });

  return [...map.values()].sort((a, b) => {
    const ta = new Date(a.requestedAt || 0).getTime();
    const tb = new Date(b.requestedAt || 0).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
};

export const getPassengerAddAttemptCount = (passengers = []) =>
  getPassengerAddRequestBatches(passengers).length;

export const hasCharterAttendanceStarted = (booking) => {
  const rows = listBookingPassengers(booking);
  return rows.some((row) => {
    const status = String(
      pick(row, ["attendanceStatus", "checkInStatus", "ticketStatus", "status"], ""),
    ).toLowerCase();
    return (
      status.includes("checkin")
      || status.includes("check-in")
      || status.includes("checkedin")
      || status.includes("checkout")
      || status.includes("check-out")
      || status.includes("checkedout")
      || status === "boarded"
      || status === "onboard"
    );
  });
};

export const isWithinPassengerAddWindow = (booking, now = Date.now()) => {
  const date = pick(booking, ["departureDate", "startDate"], "");
  const time = String(pick(booking, ["startTime"], "00:00") || "00:00").slice(0, 5);
  if (!date) return false;
  const dateKey = String(date).slice(0, 10);
  const departure = new Date(`${dateKey}T${time}:00`);
  if (Number.isNaN(departure.getTime())) return false;
  const msLeft = departure.getTime() - now;
  // Được thêm khi còn hơn 24 giờ trước giờ đi — khóa trong 24h cuối / sau giờ đi.
  return msLeft > 24 * 60 * 60 * 1000;
};

export const getCharterPassengerAddSummary = (booking) => {
  const passengers = listBookingPassengers(booking);
  const boatCapacity = getCharterBoatCapacity(booking);
  const approvedCount = countApprovedOrDefaultPassengers(passengers);
  const pendingCount = countPendingAddPassengers(passengers);
  const usedAttempts = getPassengerAddAttemptCount(passengers);
  const remainingAddAttempts = Math.max(0, CHARTER_MAX_PASSENGER_ADD_ATTEMPTS - usedAttempts);
  const occupied = approvedCount; // pending giữ chỗ tạm
  const pendingHeld = pendingCount;
  const canAddMore = boatCapacity > 0
    ? Math.max(0, boatCapacity - occupied - pendingHeld)
    : Math.max(0, 99 - occupied - pendingHeld);

  return {
    boatCapacity,
    approvedCount,
    pendingCount,
    canAddMore,
    remainingAddAttempts,
    usedAttempts,
    maxAttempts: CHARTER_MAX_PASSENGER_ADD_ATTEMPTS,
  };
};

/** Lý do không thêm được — hiện thị cho khách (một câu cụ thể). */
export const getPassengerAddBlockedReason = (booking, lang = "VN") => {
  if (!booking?.id) {
    return lang === "VN" ? "Chưa tải được thông tin booking." : "Booking details are not available.";
  }
  if (TERMINAL_STATUSES.has(String(booking.status || ""))) {
    return lang === "VN" ? "Booking đã kết thúc — không thể thêm hành khách." : "This booking is closed — passengers can’t be added.";
  }
  if (String(booking.status || "") !== "Confirmed") {
    return lang === "VN"
      ? "Chỉ thêm hành khách khi chuyến đã được xác nhận."
      : "Passengers can only be added after the trip is confirmed.";
  }
  if (!isCharterFullyPaid(booking)) {
    return lang === "VN"
      ? "Cần thanh toán đủ trước khi thêm hành khách."
      : "The booking must be fully paid before adding passengers.";
  }
  if (hasCharterAttendanceStarted(booking)) {
    return lang === "VN"
      ? "Chuyến đã bắt đầu check-in — không thể thêm hành khách."
      : "Check-in has started — passengers can’t be added.";
  }
  if (!isWithinPassengerAddWindow(booking)) {
    const date = pick(booking, ["departureDate", "startDate"], "");
    const time = String(pick(booking, ["startTime"], "00:00") || "00:00").slice(0, 5);
    const dateKey = String(date).slice(0, 10);
    const departure = new Date(`${dateKey}T${time}:00`);
    const msLeft = Number.isNaN(departure.getTime()) ? 0 : departure.getTime() - Date.now();
    if (msLeft <= 0) {
      return lang === "VN"
        ? "Đã qua giờ khởi hành — không thể thêm hành khách."
        : "Departure time has passed — passengers can’t be added.";
    }
    return lang === "VN"
      ? "Trong vòng 24 giờ trước giờ khởi hành không thể thêm hành khách."
      : "Passengers can’t be added within 24 hours of departure.";
  }

  const summary = getCharterPassengerAddSummary(booking);
  if (summary.remainingAddAttempts <= 0) {
    return lang === "VN"
      ? "Bạn đã dùng hết số lượt thêm hành khách."
      : "You’ve used all passenger-add attempts.";
  }
  if (summary.boatCapacity > 0 && summary.canAddMore <= 0) {
    return lang === "VN"
      ? "Tàu đã đủ chỗ — không còn chỗ để thêm hành khách."
      : "The boat is full — no seats left to add passengers.";
  }
  return lang === "VN"
    ? "Hiện chưa thể thêm hành khách."
    : "Passengers can’t be added right now.";
};

/** Customer: hiện nút thêm HK theo contract BE (Paid) + rule nghiệp vụ. */
export const canCustomerRequestAddPassengers = (booking) => {
  if (!booking?.id) return false;
  if (String(booking.status || "") !== "Confirmed") return false;
  if (!isCharterFullyPaid(booking)) return false;
  if (TERMINAL_STATUSES.has(String(booking.status || ""))) return false;
  if (hasCharterAttendanceStarted(booking)) return false;
  if (!isWithinPassengerAddWindow(booking)) return false;

  const summary = getCharterPassengerAddSummary(booking);
  if (summary.remainingAddAttempts <= 0) return false;
  if (summary.boatCapacity > 0 && summary.canAddMore <= 0) return false;
  return true;
};

export const canReviewPassengerAddRequests = (capabilities = {}) =>
  Boolean(capabilities.canViewAllCharters || capabilities.isAssignedManager || capabilities.canManageStatus);
