export const sanitizeStationCode = (value) => String(value || "")
  .toUpperCase()
  .replace(/[^A-Z0-9-]/g, "");

export const normalizeStationName = (value) => String(value || "")
  .trim()
  .replace(/\s+/g, " ");

export const sanitizeStationName = (value) => String(value || "")
  .replace(/[^\p{L}\p{N}\s]/gu, "");

export const isValidStationCode = (value) => /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(String(value || ""));

export const isValidStationName = (value) => /^[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+)*$/u.test(normalizeStationName(value));
