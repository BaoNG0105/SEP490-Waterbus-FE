import api from "./axios";

/** GET /api/incidents */
export const getIncidents = (params = {}) =>
  api.get("/incidents", { params }).then((response) => response.data);

/** POST /api/incidents */
export const createIncident = (payload) =>
  api.post("/incidents", payload).then((response) => response.data);

/** PATCH /api/incidents/{id}/assign-manager */
export const assignIncidentManager = (incidentId, payload) =>
  api.patch(`/incidents/${incidentId}/assign-manager`, payload).then((response) => response.data);

/** PATCH /api/incidents/{id}/assign-replacement-boat */
export const assignReplacementBoat = (incidentId, payload) =>
  api.patch(`/incidents/${incidentId}/assign-replacement-boat`, payload).then((response) => response.data);

/** PATCH /api/incidents/{id}/resolve */
export const resolveIncident = (incidentId, payload) =>
  api.patch(`/incidents/${incidentId}/resolve`, payload).then((response) => response.data);
