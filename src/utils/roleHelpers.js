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

export const getPrimaryRoleLabel = (user, lang = "VN") => {
  const role = (user?.roles || []).find((item) => ADMIN_ROLES.includes(getRoleSystemName(item)));
  if (role?.displayName || role?.name) return role.displayName || role.name;
  const systemName = getRoleSystemName(role);
  if (systemName === "ADMIN") return lang === "VN" ? "Quản trị viên" : "Admin";
  if (systemName === "MANAGER") return lang === "VN" ? "Quản lý" : "Manager";
  if (systemName === "STAFF") return lang === "VN" ? "Nhân viên" : "Staff";
  return lang === "VN" ? "Người dùng" : "User";
};
