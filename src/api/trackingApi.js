import api from "./axios";

/** GET /api/tracking/boats/latest — vị trí mới nhất của mọi tàu */
export const getLatestBoatLocations = () =>
  api.get("/tracking/boats/latest").then((response) => response.data);

/** GET /api/tracking/boats/{boatCode}/latest */
export const getLatestBoatLocation = (boatCode) =>
  api.get(`/tracking/boats/${encodeURIComponent(boatCode)}/latest`).then((response) => response.data);
