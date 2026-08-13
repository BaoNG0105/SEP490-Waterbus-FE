export const ADMIN_ROLES = ["ADMIN", "STAFF", "MANAGER"];

export const getRoleSystemName = (role) => role?.systemName || role?.code || "";

export const hasRole = (user, ...roles) => {
  const allowed = roles.flat().filter(Boolean);
  if (!user || allowed.length === 0) return false;
  return (user.roles || []).some((role) => allowed.includes(getRoleSystemName(role)));
};

export const isAdminUser = (user) => hasRole(user, "ADMIN");
export const isManagerUser = (user) => hasRole(user, "MANAGER");
export const isStaffUser = (user) => hasRole(user, "STAFF");
export const isOperationsUser = (user) => hasRole(user, "ADMIN", "MANAGER", "STAFF");

/** Staff "thuần" — có role STAFF nhưng không kiêm Admin/Manager. */
export const isStaffOnlyUser = (user) => isStaffUser(user) && !isAdminUser(user) && !isManagerUser(user);

export const getUserId = (user) => String(user?.id || user?.userId || user?.accountId || "");

// Kiểm tra xem người dùng hiện tại có được phép Sửa/Xóa 1 user (dựa vào role của user đó) hay không
// Quy tắc: Admin quản lý Staff + Manager. Manager chỉ quản lý Staff. Không ai được sửa Admin/Customer qua trang này.
export const canManageUserRow = (currentUser, rowRoles) => {
  const systemNames = (rowRoles || []).map(getRoleSystemName);
  if (systemNames.includes("ADMIN")) return false;
  if (isAdminUser(currentUser)) {
    return systemNames.includes("STAFF") || systemNames.includes("MANAGER");
  }
  if (isManagerUser(currentUser)) {
    return systemNames.includes("STAFF");
  }
  return false;
};

const normalizeStaffTypeKey = (value) => {
  const raw = String(value || "").toLowerCase().replace(/[_\s-]/g, "");
  if (raw === "onboard" || raw === "2") return "OnBoard";
  if (raw === "ground" || raw === "1") return "Ground";
  return "";
};

export const getStaffTypeKey = (user) =>
  normalizeStaffTypeKey(user?.staffType ?? user?.staff_type ?? user?.StaffType);

/** Nhân viên mặt đất (Ground) — được phép dùng quầy bán vé (POS). */
export const isGroundStaffUser = (user) => getStaffTypeKey(user) === "Ground";

/** Nhân viên trên tàu (OnBoard) — KHÔNG được phép dùng quầy bán vé (POS). */
export const isOnBoardStaffUser = (user) => getStaffTypeKey(user) === "OnBoard";

/** Admin: Manager + Staff. Manager: chỉ Staff mặt đất. Không reset chính mình. */
export const canResetManagedUserPassword = (currentUser, targetUser) => {
  if (!currentUser || !targetUser) return false;
  const targetId = getUserId(targetUser);
  if (!targetId || targetId === getUserId(currentUser)) return false;

  const roles = Array.isArray(targetUser.roles)
    ? targetUser.roles
    : (targetUser.role ? [targetUser.role] : []);
  const systemNames = roles.map(getRoleSystemName);
  if (systemNames.includes("ADMIN")) return false;

  if (isAdminUser(currentUser)) {
    return systemNames.includes("STAFF") || systemNames.includes("MANAGER");
  }

  if (isManagerUser(currentUser)) {
    if (!systemNames.includes("STAFF")) return false;
    return normalizeStaffTypeKey(targetUser.staffType) === "Ground";
  }

  return false;
};

export const getPrimaryRoleLabel = (user, lang = "VN") => {
  const role = (user?.roles || []).find((item) => ADMIN_ROLES.includes(getRoleSystemName(item)));
  if (role?.displayName || role?.name) return role.displayName || role.name;
  const systemName = getRoleSystemName(role);
  if (systemName === "ADMIN") return lang === "VN" ? "Quản trị viên" : "Admin";
  if (systemName === "MANAGER") return lang === "VN" ? "Quản lý" : "Manager";
  if (systemName === "STAFF") return lang === "VN" ? "Nhân viên" : "Staff";
  return lang === "VN" ? "Người dùng" : "User";
};
