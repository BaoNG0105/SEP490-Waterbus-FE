import api from "./axios";

/** GET /api/tracking/boats/latest — vị trí mới nhất của mọi tàu */
export const getLatestBoatLocations = () =>
  api.get("/tracking/boats/latest").then((response) => response.data);

/** GET /api/tracking/boats/{boatCode}/latest */
export const getLatestBoatLocation = (boatCode) =>
  api.get(`/tracking/boats/${encodeURIComponent(boatCode)}/latest`).then((response) => response.data);

/** GET /api/tracking/trips/{tripId}/latest — GPS gắn với 1 chuyến (boat + latestLocation + hasLiveLocationForTrip) */
export const getLatestTripLocation = (tripId) =>
  api.get(`/tracking/trips/${encodeURIComponent(tripId)}/latest`).then((response) => response.data);
