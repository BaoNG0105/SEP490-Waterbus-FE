import { getUserId, isAdminUser, isManagerUser, isStaffUser } from "./roleHelpers";
import { pick } from "./charterBookingAdmin";
import { bookingNeedsRefundAttention } from "./charterBookingActions";

export const shouldUseAssignedCharterApi = (user) => isManagerUser(user) || isStaffUser(user);

export const getAssignedManagerId = (booking) => String(
  booking?.assignedManagerId
  || booking?.managerUserId
  || pick(booking?.raw, ["assignedManagerId", "managerUserId", "assignedManager.id", "assignedManager.userId"], "")
  || "",
);

export const isAssignedManager = (user, booking) => {
  const managerId = getAssignedManagerId(booking);
  const userId = getUserId(user);
  return Boolean(managerId && userId && managerId === userId);
};

export const getCharterCapabilities = (user, booking = null) => {
  const admin = isAdminUser(user);
  const manager = isManagerUser(user);
  const staff = isStaffUser(user);
  const assignedManager = booking ? isAssignedManager(user, booking) : false;

  return {
    useAssignedApi: manager || staff,
    canViewAllCharters: admin,
    canQuote: admin,
    canAssignManager: admin,
    canAssignStaff: manager && assignedManager && !admin,
    canManageStatus: admin,
    canViewPayments: admin,
    canViewTickets: admin || manager || staff,
    canCheckIn: manager || staff,
    canViewAssignmentTab: admin || (manager && assignedManager),
    isAssignedManager: assignedManager,
    isReadOnlyOperator: staff && !admin && !manager,
  };
};

export const getDefaultCharterTab = (booking, capabilities = {}) => {
  if (!booking) return "overview";
  if (bookingNeedsRefundAttention(booking) && capabilities.canViewPayments) return "payments";
  if (capabilities.canQuote && booking.status === "PendingQuote") return "actions";
  if (
    capabilities.canAssignManager
    && !booking.assignedManagerId
    && ["Confirmed", "Quoted", "PendingPayment"].includes(booking.status)
  ) {
    return "assignment";
  }
  if (
    capabilities.canAssignStaff
    && ["Confirmed", "PendingPayment"].includes(booking.status)
  ) {
    return "assignment";
  }
  return "overview";
};
