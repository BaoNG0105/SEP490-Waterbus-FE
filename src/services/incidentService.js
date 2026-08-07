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
    reportedByUserId: pick(raw, ["reportedByUserId", "ReportedByUserId"], ""),
    reportedByUserName: pick(raw, ["reportedByUserName", "ReportedByUserName"], ""),
    resolvedByUserId: pick(raw, ["resolvedByUserId", "ResolvedByUserId"], ""),
    resolvedByUserName: pick(raw, ["resolvedByUserName", "ResolvedByUserName"], ""),
    activeTicketCount: Number(pick(raw, ["activeTicketCount", "ActiveTicketCount"], 0)) || 0,
    onboardPassengerCount: (() => {
      const n = Number(pick(raw, [
        "onboardPassengerCount", "OnboardPassengerCount", "onBoardPassengerCount",
        "OnBoardPassengerCount", "passengersOnboard", "PassengersOnboard",
        "currentPassengerCount", "CurrentPassengerCount", "passengerCount", "PassengerCount",
      ], null));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    })(),
    futurePassengerCount: Number(pick(raw, [
      "futurePassengerCount", "FuturePassengerCount",
    ], 0)) || 0,
    replacementMissionType: String(pick(raw, [
      "replacementMissionType", "ReplacementMissionType",
    ], "")).trim() || "None",
    replacementTargetStationName: String(pick(raw, [
      "replacementTargetStationName", "ReplacementTargetStationName",
    ], "")).trim() || "",
    replacementTargetStationId: pick(raw, [
      "replacementTargetStationId", "ReplacementTargetStationId",
    ], null) || null,
    replacementDelayMinutes: (() => {
      const n = Number(pick(raw, ["replacementDelayMinutes", "ReplacementDelayMinutes"], null));
      return Number.isFinite(n) ? n : null;
    })(),
    replacementEstimatedResumeAt: pick(raw, [
      "replacementEstimatedResumeAt", "ReplacementEstimatedResumeAt",
    ], null) || null,
    rescueBoatId: pick(raw, ["rescueBoatId", "RescueBoatId", "rescueBoat.boatId", "rescueBoat.id", "RescueBoat.BoatId", "RescueBoat.Id"], ""),
    rescueBoatName: pick(raw, ["rescueBoatName", "RescueBoatName", "rescueBoat.boatName", "rescueBoat.name", "RescueBoat.BoatName", "RescueBoat.Name"], ""),
    rescueBoatCode: pick(raw, ["rescueBoatCode", "RescueBoatCode", "rescueBoat.boatCode", "rescueBoat.code", "RescueBoat.BoatCode", "RescueBoat.Code"], ""),
    rescueDispatchedAt: pick(raw, ["rescueDispatchedAt", "RescueDispatchedAt"], null) || null,
    replacementBoatId: pick(raw, ["replacementBoatId", "ReplacementBoatId", "replacementBoat.boatId", "replacementBoat.id", "ReplacementBoat.BoatId"], ""),
    replacementBoatName: pick(raw, ["replacementBoatName", "ReplacementBoatName", "replacementBoat.boatName", "replacementBoat.name", "ReplacementBoat.BoatName"], ""),
    replacementBoatCode: pick(raw, ["replacementBoatCode", "ReplacementBoatCode", "replacementBoat.boatCode", "replacementBoat.code", "ReplacementBoat.BoatCode"], ""),
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

/** Lịch sử sự cố / cứu hộ đã đóng (Resolved). */
export const fetchResolvedIncidents = async () => {
  const list = await fetchIncidents({ resolutionStatus: "Resolved" });
  return list.filter((item) => {
    const status = String(item?.resolutionStatus || "").toLowerCase();
    return status === "resolved" || status === "closed";
  });
};

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

/** Chuẩn hoá key mission thay thế khách. */
export const normalizeReplacementMissionType = (value) => {
  const key = String(value || "").trim().toLowerCase().replace(/[_\s-]/g, "");
  if (key === "transferatincidentlocation") return "TransferAtIncidentLocation";
  if (key === "continuefromstation") return "ContinueFromStation";
  if (key === "passengerrecoveryrequired") return "PassengerRecoveryRequired";
  if (key === "none" || !key) return "None";
  return String(value || "None").trim() || "None";
};

/** Số khách trên tàu để hiển thị / quyết định cứu hộ.
 * BE đôi khi gửi onboardPassengerCount=0 dù còn activeTicketCount (vé đã bán trên chuyến).
 * Khi onboard=0 và còn vé: suy ra max(0, active − future); nếu future cũng 0 → dùng active.
 */
export const resolveIncidentOnboardCount = (incident) => {
  const onboard = Number(incident?.onboardPassengerCount);
  const tickets = Number(incident?.activeTicketCount);
  const future = Number(incident?.futurePassengerCount);
  if (Number.isFinite(onboard) && onboard > 0) return Math.trunc(onboard);

  const ticketsN = Number.isFinite(tickets) && tickets > 0 ? Math.trunc(tickets) : 0;
  if (ticketsN > 0) {
    const futureN = Number.isFinite(future) && future > 0 ? Math.trunc(future) : 0;
    const inferred = Math.max(0, ticketsN - futureN);
    return inferred > 0 ? inferred : ticketsN;
  }

  if (Number.isFinite(onboard) && onboard >= 0) return Math.trunc(onboard);
  return 0;
};

/** Cần tàu thay thế (chở khách) theo mission BE — không chỉ nhìn activeTicketCount. */
export const incidentNeedsReplacementBoat = (incident) => {
  const mission = normalizeReplacementMissionType(incident?.replacementMissionType);
  if (mission === "TransferAtIncidentLocation" || mission === "ContinueFromStation") return true;
  if (mission === "PassengerRecoveryRequired") return false; // Manager tự quyết sau khi kiểm tra
  const onboard = resolveIncidentOnboardCount(incident);
  const tickets = Number(incident?.activeTicketCount) || 0;
  // None + còn vé/khách: vẫn cần thay thế (tránh BE gửi onboard=0 / mission=None nhầm).
  return onboard > 0 || tickets > 0;
};

/** Hiện ô chọn tàu thay thế (bắt buộc hoặc tuỳ chọn). */
export const incidentShowsReplacementBoatField = (incident) => {
  const mission = normalizeReplacementMissionType(incident?.replacementMissionType);
  if (mission === "TransferAtIncidentLocation" || mission === "ContinueFromStation") return true;
  if (mission === "PassengerRecoveryRequired") return true;
  return incidentNeedsReplacementBoat(incident);
};

/** Copy hiển thị theo replacementMissionType (spec FE). */
export const getReplacementMissionCopy = (incident, lang = "VN") => {
  const mission = normalizeReplacementMissionType(incident?.replacementMissionType);
  const station = String(incident?.replacementTargetStationName || "").trim();
  const isVn = lang === "VN";
  const onboard = resolveIncidentOnboardCount(incident);
  const tickets = Number(incident?.activeTicketCount) || 0;

  switch (mission) {
    case "TransferAtIncidentLocation":
      return isVn
        ? "Có khách đang trên tàu. Tàu thay thế sẽ tới vị trí sự cố để chuyển khách."
        : "Passengers are onboard. Replacement boat goes to the incident location to transfer them.";
    case "ContinueFromStation":
      return isVn
        ? (station
          ? `Chưa có khách trên tàu. Tàu thay thế sẽ tới ${station} để đón khách.`
          : "Chưa có khách trên tàu. Tàu thay thế sẽ tới bến chỉ định để đón khách.")
        : (station
          ? `No passengers onboard. Replacement boat will go to ${station} to pick up passengers.`
          : "No passengers onboard. Replacement boat will go to the target station to pick up passengers.");
    case "PassengerRecoveryRequired":
      return isVn
        ? "Không đủ dữ liệu vị trí/chặng khách. Manager cần kiểm tra thủ công."
        : "Insufficient passenger location/segment data. Manager must verify manually.";
    case "None":
    default:
      if (onboard > 0 || tickets > 0) {
        return isVn
          ? `Còn ${onboard > 0 ? onboard : tickets} khách/vé trên chuyến — cần tàu thay thế (không chỉ cứu hộ).`
          : `${onboard > 0 ? onboard : tickets} passenger(s)/ticket(s) on the trip — replacement boat is needed.`;
      }
      return isVn
        ? "Không có khách bị ảnh hưởng. Chỉ cần tàu cứu hộ."
        : "No passengers affected. Rescue boat only.";
  }
};

/** delayMinutes >= 15 → ảnh hưởng thêm các chuyến sau cùng tàu/tuyến trong ngày. */
export const DELAY_AFFECTS_FOLLOWING_TRIPS_MINUTES = 15;

export const delayAffectsFollowingTrips = (delayMinutes) => {
  const n = Number(delayMinutes);
  return Number.isFinite(n) && n >= DELAY_AFFECTS_FOLLOWING_TRIPS_MINUTES;
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

/** Lỗi validation điều tàu — map replacementBoatId theo copy BE. */
export const getDispatchReplacementErrorMessage = (error, lang = "VN") => {
  const data = error?.response?.data;
  const errors = data?.errors && typeof data.errors === "object" ? data.errors : null;
  const replacementKeys = errors
    ? Object.keys(errors).filter((key) => /replacementboatid/i.test(String(key).replace(/[_\s.-]/g, "")))
    : [];
  const blob = [
    data?.detail,
    data?.title,
    data?.message,
    getApiErrorMessage(error),
    error?.message,
  ].filter(Boolean).join(" ").toLowerCase();

  const isReplacementRequired = replacementKeys.length > 0
    || /replacementboatid/.test(blob)
    || (/replacement/.test(blob) && /required|bắt buộc|bat buoc|must/.test(blob));

  if (isReplacementRequired) {
    return lang === "VN"
      ? "Chuyến đang chạy nên phải chọn tàu thay thế"
      : "Trip is running — a replacement boat must be selected";
  }

  return getApiErrorMessage(error) || error?.message || "";
};

