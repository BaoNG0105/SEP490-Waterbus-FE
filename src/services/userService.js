import { getAllUsers } from "../api/userApi";
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
