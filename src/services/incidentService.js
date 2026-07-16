import {
  getIncidents as apiGetIncidents,
  createIncident as apiCreateIncident,
  assignIncidentManager as apiAssignManager,
  assignReplacementBoat as apiAssignReplacementBoat,
  resolveIncident as apiResolveIncident,
} from "../api/incidentApi";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.incidents)) return data.incidents;
  return [];
};

export const INCIDENT_TYPES = [
  { value: "MechanicalFailure", labelVn: "Hỏng máy", labelEn: "Mechanical failure" },
  { value: "Collision", labelVn: "Va chạm", labelEn: "Collision" },
  { value: "MedicalEmergency", labelVn: "Y tế khẩn cấp", labelEn: "Medical emergency" },
  { value: "Weather", labelVn: "Thời tiết", labelEn: "Weather" },
  { value: "Other", labelVn: "Khác", labelEn: "Other" },
];

export const INCIDENT_SEVERITIES = [
  { value: "Low", labelVn: "Thấp", labelEn: "Low" },
  { value: "Medium", labelVn: "Trung bình", labelEn: "Medium" },
  { value: "High", labelVn: "Cao", labelEn: "High" },
  { value: "Critical", labelVn: "Nghiêm trọng", labelEn: "Critical" },
];

export const normalizeIncident = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const incidentId = String(pick(raw, ["incidentId", "id", "IncidentId"], "")).trim();
  if (!incidentId) return null;

  const boatId = String(pick(raw, ["boatId", "BoatId", "boat.boatId", "boat.id"], "")).trim();
  const boatCode = String(pick(raw, ["boatCode", "BoatCode", "boat.boatCode", "boat.code"], "")).trim();

  return {
    incidentId,
    boatId,
    boatCode,
    boatName: pick(raw, ["boatName", "boat.boatName", "boat.name"], ""),
    tripId: pick(raw, ["tripId", "TripId"], null) || null,
    tripCode: pick(raw, ["tripCode", "TripCode"], ""),
    incidentType: pick(raw, ["incidentType", "IncidentType", "type"], "Other"),
    severity: pick(raw, ["severity", "Severity"], "Medium"),
    description: pick(raw, ["description", "Description"], ""),
    resolutionStatus: pick(raw, ["resolutionStatus", "ResolutionStatus", "status"], "Open"),
    occurredAt: pick(raw, ["occurredAt", "OccurredAt", "createdAt"], null),
    resolvedAt: pick(raw, ["resolvedAt", "ResolvedAt"], null),
    resolutionNote: pick(raw, ["resolutionNote", "ResolutionNote"], ""),
    managerUserId: pick(raw, ["managerUserId", "assignedManagerId", "manager.id"], ""),
    managerName: pick(raw, ["managerName", "assignedManagerName", "manager.fullName"], ""),
    replacementBoatId: pick(raw, ["replacementBoatId", "rescueBoatId"], ""),
    replacementBoatCode: pick(raw, ["replacementBoatCode", "rescueBoatCode"], ""),
    raw,
  };
};

export const normalizeIncidentList = (payload) =>
  unwrapList(payload).map(normalizeIncident).filter(Boolean);

export const fetchIncidents = async (params = {}) => {
  const data = await apiGetIncidents(params);
  return normalizeIncidentList(data);
};

export const fetchOpenIncidents = async () =>
  fetchIncidents({ resolutionStatus: "Open" });

export const reportIncident = async (payload) => {
  const data = await apiCreateIncident(payload);
  return normalizeIncident(data) || data;
};

export const assignManagerToIncident = async (incidentId, managerUserId) =>
  apiAssignManager(incidentId, { managerUserId });

export const dispatchReplacementBoat = async (incidentId, payload) =>
  apiAssignReplacementBoat(incidentId, payload);

export const closeIncident = async (incidentId, payload) =>
  apiResolveIncident(incidentId, payload);

export const getIncidentTypeLabel = (type, lang = "VN") => {
  const row = INCIDENT_TYPES.find((item) => item.value === type);
  if (!row) return type || "—";
  return lang === "VN" ? row.labelVn : row.labelEn;
};

export const getSeverityLabel = (severity, lang = "VN") => {
  const row = INCIDENT_SEVERITIES.find((item) => item.value === severity);
  if (!row) return severity || "—";
  return lang === "VN" ? row.labelVn : row.labelEn;
};

export const isIncidentOpen = (incident) => {
  const status = String(incident?.resolutionStatus || "").toLowerCase();
  return !status || status === "open";
};

/** Lấy message lỗi rõ từ ProblemDetails / validation BE. */
export const getApiErrorMessage = (error) => {
  const data = error?.response?.data;
  if (!data) return error?.message || "";
  if (typeof data === "string") return data;

  if (data.detail) return String(data.detail);
  if (data.title && !data.errors) return String(data.title);
  if (data.message) return String(data.message);

  if (data.errors && typeof data.errors === "object") {
    const lines = Object.entries(data.errors).flatMap(([key, value]) => {
      if (Array.isArray(value)) return value.map((item) => `${key}: ${item}`);
      return [`${key}: ${value}`];
    });
    if (lines.length) return lines.join("\n");
  }

  try {
    return JSON.stringify(data);
  } catch {
    return error?.message || "";
  }
};

