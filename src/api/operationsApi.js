import api from "./axios";

/**
 * GET /api/operations/schedule
 * params: fromDate, toDate, serviceType?=booking|bus|sightseeing|charter|all, includeCancelled?, stationId?
 */
export const getOperationsSchedule = (params = {}) =>
  api.get("/operations/schedule", { params }).then((response) => response.data);
