import {
  getAllUsers,
  getUserRoles,
  getUserDetail,
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
  getUserStations,
  updateUserStations,
  resetManagedUserPassword as apiResetManagedUserPassword,
} from "../api/userApi";
import { getRoleSystemName } from "../utils/roleHelpers";

export const USER_ROLE = {
  MANAGER: "MANAGER",
  STAFF: "STAFF",
};

const ROLE_ALIASES = {
  MANAGER: ["MANAGER", "QUAN LY", "QUẢN LÝ", "MANAGEMENT"],
  STAFF: ["STAFF", "NHAN VIEN", "NHÂN VIÊN", "EMPLOYEE"],
};

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const normalizeText = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .toUpperCase();

const collectRoleTokens = (entry) => {
  if (entry == null) return [];
  if (typeof entry === "string") return [entry];
  return [
    getRoleSystemName(entry),
    entry?.name,
    entry?.displayName,
    entry?.roleName,
    entry?.role,
  ].filter(Boolean);
};

const normalizeUserOption = (item) => ({
  id: String(pick(item, ["id", "userId", "accountId"], "")),
  fullName: pick(item, ["fullName", "name", "displayName"], "--"),
  phone: pick(item, ["phoneNumber", "phone"], ""),
  email: pick(item, ["email"], ""),
  roles: Array.isArray(item?.roles)
    ? item.roles
    : (item?.role ? [item.role] : []),
  raw: item,
});

const extractUserRows = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.content)) return data.data.content;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
};

const userMatchesRole = (item, role) => {
  const targetRole = String(role || "").toUpperCase();
  const aliases = ROLE_ALIASES[targetRole] || [targetRole];
  const roles = Array.isArray(item?.roles)
    ? item.roles
    : (item?.role ? [item.role] : []);

  const tokens = [
    ...roles.flatMap(collectRoleTokens),
    item?.roleSystemName,
    item?.roleCode,
    item?.roleName,
    item?.role,
  ].map(normalizeText).filter(Boolean);

  return tokens.some((token) => aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return token === normalizedAlias || token.includes(normalizedAlias);
  }));
};

let cachedUsers = null;
let cachedUsersPromise = null;

export const clearUsersCache = () => {
  cachedUsers = null;
  cachedUsersPromise = null;
};

export const fetchAllUsers = async ({ force = false, params } = {}) => {
  // Filtered queries skip the unfiltered cache (e.g. crew OnBoard dropdown).
  if (params && Object.keys(params).length > 0) {
    const data = await getAllUsers(params);
    return extractUserRows(data).map(normalizeUserOption).filter((item) => item.id);
  }

  if (!force && cachedUsers) return cachedUsers;
  if (!force && cachedUsersPromise) return cachedUsersPromise;

  cachedUsersPromise = getAllUsers()
    .then((data) => {
      cachedUsers = extractUserRows(data).map(normalizeUserOption).filter((item) => item.id);
      return cachedUsers;
    })
    .catch((error) => {
      cachedUsersPromise = null;
      throw error;
    });

  return cachedUsersPromise;
};

export const fetchUsersByRole = async (role, options = {}) => {
  const normalizedRole = String(role || "").toUpperCase();
  const users = await fetchAllUsers(options);
  return users.filter((item) => userMatchesRole(item, normalizedRole));
};

export const fetchManagerUsers = (options = {}) => fetchUsersByRole(USER_ROLE.MANAGER, options);

export const fetchStaffUsers = (options = {}) => fetchUsersByRole(USER_ROLE.STAFF, options);

const normalizeStaffTypeKey = (value) => {
  const raw = String(value || "").toLowerCase().replace(/[_\s-]/g, "");
  if (raw === "onboard" || raw === "2") return "OnBoard";
  if (raw === "ground" || raw === "1") return "Ground";
  return "";
};

const isActiveUserStatus = (value) => {
  const status = String(value || "").toLowerCase();
  return !status || status === "active";
};

/** Lọc staff từ list đầy đủ (cùng nguồn trang Quản lý NV) — tránh BE query staffType trả rỗng / thiếu field. */
const filterStaffUsersByType = (rows, staffType) => {
  const wanted = normalizeStaffTypeKey(staffType);
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      const type = normalizeStaffTypeKey(pick(row, ["staffType", "staff_type", "StaffType"], ""));
      if (wanted && type !== wanted) return false;
      if (!isActiveUserStatus(pick(row, ["status", "accountStatus", "Status"], "Active"))) return false;
      const roles = Array.isArray(row?.roles) ? row.roles : (row?.role ? [row.role] : []);
      // Có roles → phải là Staff; không có roles nhưng đúng staffType thì vẫn nhận.
      if (roles.length > 0) {
        const asOption = normalizeUserOption(row);
        if (!userMatchesRole(asOption, USER_ROLE.STAFF)) return false;
      }
      return Boolean(pick(row, ["id", "userId", "accountId"], ""));
    })
    .map(normalizeUserOption)
    .filter((item) => item.id);
};

/** Nhân viên trên tàu đang Active — dropdown phân công tàu */
export const fetchOnBoardStaffUsers = async ({ force = false } = {}) => {
  // Ưu tiên list đầy đủ như Staff Management (có staffType trên từng row).
  try {
    const rows = await fetchUserList({ force });
    const fromList = filterStaffUsersByType(rows, "OnBoard");
    if (fromList.length > 0) return fromList;
  } catch (error) {
    console.warn("fetchOnBoardStaffUsers: fetchUserList failed, try filtered /users", error);
  }

  const users = await fetchAllUsers({
    force,
    params: { staffType: "OnBoard", status: "Active" },
  });
  return users.filter((item) => {
    const type = normalizeStaffTypeKey(pick(item?.raw || item, ["staffType", "staff_type", "StaffType"], ""));
    if (type && type !== "OnBoard") return false;
    if (!isActiveUserStatus(pick(item?.raw || item, ["status", "accountStatus", "Status"], "Active"))) {
      return false;
    }
    const roles = Array.isArray(item?.roles) ? item.roles : [];
    if (roles.length > 0 && !userMatchesRole(item, USER_ROLE.STAFF)) return false;
    // Query đã lọc OnBoard — nhận cả row thiếu staffType (BE param ok nhưng field omit).
    return true;
  });
};

/** Nhân viên mặt đất đang Active — dropdown phân công bến */
export const fetchGroundStaffUsers = async ({ force = false } = {}) => {
  try {
    const rows = await fetchUserList({ force });
    const fromList = filterStaffUsersByType(rows, "Ground");
    if (fromList.length > 0) return fromList;
  } catch (error) {
    console.warn("fetchGroundStaffUsers: fetchUserList failed, try filtered /users", error);
  }

  const users = await fetchAllUsers({
    force,
    params: { staffType: "Ground", status: "Active" },
  });
  return users.filter((item) => {
    const type = normalizeStaffTypeKey(pick(item?.raw || item, ["staffType", "staff_type", "StaffType"], ""));
    if (type && type !== "Ground") return false;
    if (!isActiveUserStatus(pick(item?.raw || item, ["status", "accountStatus", "Status"], "Active"))) {
      return false;
    }
    const roles = Array.isArray(item?.roles) ? item.roles : [];
    if (roles.length > 0 && !userMatchesRole(item, USER_ROLE.STAFF)) return false;
    return true;
  });
};

let cachedUserRows = null;
let cachedRoles = null;

// Danh sách người dùng "thô" (đầy đủ trường) phục vụ trang quản lý User
export const fetchUserList = async ({ force = false } = {}) => {
  if (!force && cachedUserRows) return cachedUserRows;
  const data = await getAllUsers();
  cachedUserRows = extractUserRows(data);
  return cachedUserRows;
};

export const fetchUserRoles = async ({ force = false } = {}) => {
  if (!force && cachedRoles) return cachedRoles;
  const data = await getUserRoles();
  cachedRoles = Array.isArray(data) ? data : [];
  return cachedRoles;
};

export const fetchUserDetail = (userId) => getUserDetail(userId);

const invalidateUserCaches = () => {
  cachedUsers = null;
  cachedUsersPromise = null;
  cachedUserRows = null;
};

export const createUser = async (payload) => {
  const data = await createManagedUser(payload);
  invalidateUserCaches();
  return data;
};

export const updateUser = async (userId, payload) => {
  const data = await updateManagedUser(userId, payload);
  invalidateUserCaches();
  return data;
};

export const deleteUser = async (userId) => {
  const data = await deleteManagedUser(userId);
  invalidateUserCaches();
  return data;
};

export const resetManagedUserPassword = async (userId) => {
  const data = await apiResetManagedUserPassword(userId);
  return data;
};

const extractStationIdList = (data) => {
  if (Array.isArray(data)) {
    return data
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "string" || typeof item === "number") return String(item);
        return String(pick(item, ["stationId", "id", "station.id"], ""));
      })
      .filter(Boolean);
  }
  if (Array.isArray(data?.stationIds)) return data.stationIds.map(String).filter(Boolean);
  if (Array.isArray(data?.stations)) return extractStationIdList(data.stations);
  if (Array.isArray(data?.data)) return extractStationIdList(data.data);
  return [];
};

export const fetchUserStations = async (userId) => {
  const data = await getUserStations(userId);
  return extractStationIdList(data);
};

export const assignUserStations = async (userId, stationIds) => {
  const ids = (Array.isArray(stationIds) ? stationIds : []).map(String).filter(Boolean);
  return updateUserStations(userId, { stationIds: ids });
};
