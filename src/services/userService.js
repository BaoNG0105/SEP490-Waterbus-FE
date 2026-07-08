import {
  getAllUsers,
  getUserRoles,
  getUserDetail,
  createManagedUser,
  updateManagedUser,
  deleteManagedUser,
} from "../api/userApi";
import { getRoleSystemName } from "../utils/roleHelpers";

export const USER_ROLE = {
  MANAGER: "MANAGER",
  STAFF: "STAFF",
};

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const normalizeUserOption = (item) => ({
  id: String(pick(item, ["id", "userId", "accountId"], "")),
  fullName: pick(item, ["fullName", "name", "displayName"], "--"),
  phone: pick(item, ["phoneNumber", "phone"], ""),
  email: pick(item, ["email"], ""),
  roles: Array.isArray(item?.roles) ? item.roles : [],
});

const extractUserRows = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const userMatchesRole = (item, role) => {
  const targetRole = String(role || "").toUpperCase();
  const roles = Array.isArray(item?.roles) ? item.roles : [];
  return roles.some((entry) => getRoleSystemName(entry).toUpperCase() === targetRole);
};

let cachedUsers = null;

export const fetchAllUsers = async ({ force = false } = {}) => {
  if (!force && cachedUsers) return cachedUsers;
  const data = await getAllUsers();
  cachedUsers = extractUserRows(data).map(normalizeUserOption).filter((item) => item.id);
  return cachedUsers;
};

export const fetchUsersByRole = async (role) => {
  const normalizedRole = String(role || "").toUpperCase();
  const users = await fetchAllUsers();
  return users.filter((item) => userMatchesRole(item, normalizedRole));
};

export const fetchManagerUsers = () => fetchUsersByRole(USER_ROLE.MANAGER);

export const fetchStaffUsers = () => fetchUsersByRole(USER_ROLE.STAFF);

// Danh sách người dùng "thô" (đầy đủ trường) phục vụ trang quản lý User
export const fetchUserList = async ({ force = false } = {}) => {
  if (!force && cachedUserRows) return cachedUserRows;
  const data = await getAllUsers();
  cachedUserRows = extractUserRows(data);
  return cachedUserRows;
};

let cachedUserRows = null;
let cachedRoles = null;

export const fetchUserRoles = async ({ force = false } = {}) => {
  if (!force && cachedRoles) return cachedRoles;
  const data = await getUserRoles();
  cachedRoles = Array.isArray(data) ? data : [];
  return cachedRoles;
};

export const fetchUserDetail = (userId) => getUserDetail(userId);

const invalidateUserCaches = () => {
  cachedUsers = null;
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