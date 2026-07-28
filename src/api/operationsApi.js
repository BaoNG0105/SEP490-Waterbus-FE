import api from "./axios";

/**
 * GET /api/operations/schedule
 * params: fromDate, toDate, serviceType?=booking|bus|sightseeing|charter|all, includeCancelled?, stationId?
 * @param {object} params
 * @param {{ skipAuth?: boolean }} [options] — customer Departure Schedule: skipAuth=true (không gắn Authorization).
 */
export const getOperationsSchedule = (params = {}, options = {}) =>
  api
    .get("/operations/schedule", {
      params,
      skipAuth: Boolean(options.skipAuth),
    })
    .then((response) => response.data);
