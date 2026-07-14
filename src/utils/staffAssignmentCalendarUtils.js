import { ASSIGNMENT_STATUS } from "../services/staffAssignmentService";

const pad2 = (n) => String(n).padStart(2, "0");

export const toDateKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const parseDateKey = (key) => {
  if (!key) return new Date();
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Monday as first day of week */
export const startOfWeek = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

export const endOfWeek = (date) => {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
};

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
export const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

export const addDays = (date, days) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
};

export const eachDay = (from, to) => {
  const days = [];
  let cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
};

const dayKeyFromValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return toDateKey(date);
};

export const assignmentCoversDay = (row, dayKey) => {
  if (!row || row.status === ASSIGNMENT_STATUS.CANCELLED) return false;
  const start = dayKeyFromValue(row.startAt);
  const end = dayKeyFromValue(row.endAt) || start;
  if (!start) return false;
  return dayKey >= start && dayKey <= end;
};

/** Đồng bộ fromDate/toDate theo anchor + mode day|week|month */
export const getRangeForScheduleMode = (mode, anchorDate) => {
  const anchor =
    anchorDate instanceof Date
      ? anchorDate
      : typeof anchorDate === "string" && anchorDate
        ? parseDateKey(anchorDate)
        : new Date();
  if (mode === "day") {
    const key = toDateKey(anchor);
    return { fromDate: key, toDate: key };
  }
  if (mode === "month") {
    const from = startOfMonth(anchor);
    const to = endOfMonth(anchor);
    return { fromDate: toDateKey(startOfWeek(from)), toDate: toDateKey(endOfWeek(to)) };
  }
  const from = startOfWeek(anchor);
  const to = endOfWeek(anchor);
  return { fromDate: toDateKey(from), toDate: toDateKey(to) };
};
