import { getBoatSeatCount, normalizeCharterScheduleDate, normalizeCharterScheduleTime, pick } from "./charterBookingAdmin";
import { getPassengerBirthYear, hasCharterPassengerName, hasCharterDepositOrFullPaid } from "./charterBookingTickets";

/** BE: mỗi charter booking chỉ được gửi yêu cầu thêm hành khách 1 lần. */
export const CHARTER_MAX_PASSENGER_ADD_ATTEMPTS = 1;

const TERMINAL_STATUSES = new Set(["Cancelled", "Completed", "Refunded", "Expired"]);

/** Ngày + giờ khởi hành local — đọc nhiều field / format (ISO, dd/MM/yyyy, TimeSpan). */
export const getCharterDepartureDateTime = (booking) => {
  if (!booking || typeof booking !== "object") return null;

  const raw = booking.raw && typeof booking.raw === "object" ? booking.raw : {};
  const dateCandidates = [
    booking.departureDate,
    booking.startDate,
    booking.departureAt,
    booking.scheduledDepartureAt,
    raw.departureDate,
    raw.DepartureDate,
    raw.startDate,
    raw.StartDate,
    raw.departureAt,
  ];
  const timeCandidates = [
    booking.startTime,
    booking.departureTime,
    raw.startTime,
    raw.StartTime,
    raw.departureTime,
    raw.DepartureTime,
  ];

  let dateKey = "";
  for (const candidate of dateCandidates) {
    dateKey = normalizeCharterScheduleDate(candidate);
    if (dateKey) break;
  }
  if (!dateKey) return null;

  let timeKey = "";
  for (const candidate of timeCandidates) {
    timeKey = normalizeCharterScheduleTime(candidate);
    if (timeKey) break;
  }

  // Thiếu startTime riêng → lấy giờ từ ISO departureDate nếu có.
  if (!timeKey) {
    for (const candidate of dateCandidates) {
      const text = String(candidate || "");
      const match = text.match(/T(\d{1,2}):(\d{2})/);
      if (match) {
        timeKey = `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
        break;
      }
      // .NET TimeSpan sometimes "09:30:00" stored only in date field wrongly — skip
    }
  }
  if (!timeKey) timeKey = "00:00";

  // Build local datetime parts to avoid Invalid Date from odd strings.
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = timeKey.split(":").map(Number);
  if (![year, month, day, hour, minute].every((n) => Number.isFinite(n))) return null;

  const departure = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(departure.getTime())) return null;
  return departure;
};

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
  const passengers = Array.isArray(booking?.passengers) ? booking.passengers : [];
  const tickets = Array.isArray(booking?.tickets) ? booking.tickets : [];
  if (passengers.some(hasCharterPassengerName)) return passengers;
  if (tickets.some(hasCharterPassengerName)) return tickets;
  if (passengers.length > 0) return passengers;
  if (tickets.length > 0) return tickets;
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

export const getPassengerAddAttemptCount = (passengers = [], booking = null) => {
  const fromBatches = getPassengerAddRequestBatches(passengers).length;
  if (fromBatches > 0) return fromBatches;

  // Sau duyệt BE có thể xóa requestBatchId — suy ra đã dùng lượt nếu số tên > số khách đăng ký ban đầu.
  const booked =
    Number(booking?.passengerCount || 0)
    || (Number(booking?.adultCount || 0) + Number(booking?.childCount || 0))
    || 0;
  if (booked <= 0) return 0;

  const namedCount = countApprovedOrDefaultPassengers(passengers);
  return namedCount > booked ? 1 : 0;
};

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

export const CHARTER_PASSENGER_ADD_WINDOW_HOURS = 48;
export const CHARTER_PASSENGER_ADD_PAYMENT_DEADLINE_HOURS = 12;

export const isWithinPassengerAddWindow = (booking, now = Date.now()) => {
  const departure = getCharterDepartureDateTime(booking);
  if (!departure) return false;
  const msLeft = departure.getTime() - now;
  // Được thêm khi còn hơn 48 giờ trước giờ đi — khóa trong 48h cuối / sau giờ đi (contract BE).
  return msLeft > CHARTER_PASSENGER_ADD_WINDOW_HOURS * 60 * 60 * 1000;
};

export const getCharterPassengerAddSummary = (booking) => {
  const passengers = listBookingPassengers(booking);
  const boatCapacity = getCharterBoatCapacity(booking);
  const approvedCount = countApprovedOrDefaultPassengers(passengers);
  const pendingCount = countPendingAddPassengers(passengers);
  const usedAttempts = Math.min(
    CHARTER_MAX_PASSENGER_ADD_ATTEMPTS,
    getPassengerAddAttemptCount(passengers, booking),
  );
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
  if (!hasCharterDepositOrFullPaid(booking)) {
    return lang === "VN"
      ? "Cần đặt cọc hoặc thanh toán trước khi thêm hành khách."
      : "A deposit or full payment is required before adding passengers.";
  }
  if (hasCharterAttendanceStarted(booking)) {
    return lang === "VN"
      ? "Chuyến đã bắt đầu check-in — không thể thêm hành khách."
      : "Check-in has started — passengers can’t be added.";
  }
  if (!isWithinPassengerAddWindow(booking)) {
    const departure = getCharterDepartureDateTime(booking);
    if (!departure) {
      return lang === "VN"
        ? "Không xác định được ngày giờ khởi hành — vui lòng tải lại booking."
        : "Departure time is missing — please reload the booking.";
    }
    const msLeft = departure.getTime() - Date.now();
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
      ? "Mỗi booking chỉ được gửi yêu cầu thêm hành khách 1 lần — bạn đã dùng lượt này."
      : "Each booking allows only one add-passenger request — you’ve already used it.";
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

/** Customer: hiện nút thêm HK theo contract BE. */
export const canCustomerRequestAddPassengers = (booking) => {
  if (!booking?.id) return false;
  // BE: chỉ mở khi booking Confirmed (Approved cũng là Confirmed hậu duyệt thêm HK).
  const status = String(booking.status || "");
  if (status !== "Confirmed" && status !== "Approved") return false;
  // Đã đặt cọc hoặc thanh toán đủ mới được thêm HK (rule nghiệp vụ).
  if (!hasCharterDepositOrFullPaid(booking)) return false;
  if (TERMINAL_STATUSES.has(status)) return false;
  if (hasCharterAttendanceStarted(booking)) return false;
  if (!isWithinPassengerAddWindow(booking)) return false;

  const summary = getCharterPassengerAddSummary(booking);
  if (summary.remainingAddAttempts <= 0) return false;
  if (summary.boatCapacity > 0 && summary.canAddMore <= 0) return false;
  return true;
};

/** Customer: còn yêu cầu thêm HK nào đang chờ duyệt không (per-passenger status). */
export const hasPendingAddPassengerRequests = (booking) => {
  const rows = listBookingPassengers(booking);
  return rows.some((row) => {
    if (!hasCharterPassengerName(row)) return false;
    if (!pick(row, ["requestBatchId", "passengerAddRequestId", "addRequestId", "batchId"], "")) return false;
    return normalizePassengerApprovalStatus(
      pick(row, ["approvalStatus", "passengerApprovalStatus", "addRequestStatus"], ""),
    ) === "Pending";
  });
};

export const canReviewPassengerAddRequests = (capabilities = {}) =>
  Boolean(capabilities.canViewAllCharters || capabilities.isAssignedManager || capabilities.canManageStatus);
