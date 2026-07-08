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
  // Chưa báo giá xong → ưu tiên tab Thao tác (không nhảy sang gán quản lý).
  if (capabilities.canQuote && booking.status === "PendingQuote") return "actions";
  // Báo giá / chờ thanh toán → tổng quan theo dõi tiến trình.
  if (["Quoted", "PendingPayment"].includes(booking.status)) return "overview";
  // Đã xác nhận mà chưa gán quản lý / NV → mới ưu tiên tab phân công.
  if (
    capabilities.canAssignManager
    && !booking.assignedManagerId
    && booking.status === "Confirmed"
  ) {
    return "assignment";
  }
  if (
    capabilities.canAssignStaff
    && booking.status === "Confirmed"
  ) {
    return "assignment";
  }
  return "overview";
};
