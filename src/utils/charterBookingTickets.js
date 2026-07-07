const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const hasText = (value) => String(value || "").trim().length > 0;

export const hasCharterPassengerName = (entry) =>
  hasText(pick(entry, ["fullName", "passengerName", "name", "contactName"], ""));

export const isCharterFullyPaid = (booking) =>
  String(booking?.paymentStatus || "").toLowerCase() === "paid";

export const hasCharterPassengerManifest = (source) => {
  const passengers = Array.isArray(source?.passengers) ? source.passengers : [];
  const tickets = Array.isArray(source?.tickets) ? source.tickets : [];
  return passengers.some(hasCharterPassengerName) || tickets.some(hasCharterPassengerName);
};

export const canShowCharterTickets = (booking) =>
  isCharterFullyPaid(booking) && hasCharterPassengerManifest(booking);

export const getCharterTicketId = (ticket) =>
  pick(ticket, ["ticketId", "id", "charterTicketId", "ticket.id"], "");

export const formatCharterTicketDate = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString("vi-VN");
  }

  const vnMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (vnMatch) return text;

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toLocaleDateString("vi-VN");
  return text;
};

export const formatCharterPassengerType = (value, lang = "VN") => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "child") return lang === "VN" ? "Trẻ em" : "Child";
  if (normalized === "adult") return lang === "VN" ? "Người lớn" : "Adult";
  return value || "";
};

const normalizeTicketRow = (passenger, ticket, index, adultCount) => {
  const merged = { ...passenger, ...ticket };
  const fullName = pick(merged, ["fullName", "passengerName", "name", "contactName"], "");
  const passengerType = pick(merged, ["passengerType", "type"], index < adultCount ? "Adult" : "Child");
  const ticketId = getCharterTicketId(merged) || getCharterTicketId(ticket) || getCharterTicketId(passenger);

  return {
    ...merged,
    id: ticketId,
    ticketId,
    ticketCode: pick(merged, ["ticketCode", "code", "ticketNumber"], ""),
    fullName,
    passengerName: fullName,
    passengerType,
    dateOfBirth: pick(merged, ["dateOfBirth", "dob", "birthDate"], ""),
    status: pick(merged, ["attendanceStatus", "ticketStatus", "status"], "Active"),
    qrToken: pick(merged, ["qrToken", "ticketQrToken", "charterTicketQrToken"], ""),
  };
};

export const normalizeCharterTicketRows = (source, options = {}) => {
  const tickets = Array.isArray(source?.tickets) ? source.tickets : [];
  const passengers = Array.isArray(source?.passengers) ? source.passengers : [];
  const adultCount = Number(options.adultCount || 0);
  const passengerCount = Number(options.passengerCount || 0);
  const contactName = String(options.contactName || "").trim();

  const maxRows = Math.max(tickets.length, passengers.length);
  const rows = [];

  if (maxRows > 0) {
    for (let index = 0; index < maxRows; index += 1) {
      rows.push(normalizeTicketRow(passengers[index] || {}, tickets[index] || {}, index, adultCount));
    }
  } else if (tickets.length > 0) {
    tickets.forEach((ticket, index) => {
      rows.push(normalizeTicketRow({}, ticket, index, adultCount));
    });
  } else if (passengers.length > 0) {
    passengers.forEach((passenger, index) => {
      rows.push(normalizeTicketRow(passenger, {}, index, adultCount));
    });
  }

  const meaningfulRows = rows.filter((row) =>
    hasText(row.ticketCode)
    || hasText(row.fullName)
    || hasText(row.ticketId)
    || hasText(row.status));

  if (meaningfulRows.length > 0) return meaningfulRows;

  return [];
};
