const stripApiSuffix = (url) => String(url || "").replace(/\/api\/?$/, "");

const getHubOrigin = () => {
  if (import.meta.env.DEV) return window.location.origin;
  return stripApiSuffix(import.meta.env.VITE_API_BASE_URL) || window.location.origin;
};

export const getCharterBookingHubUrl = () => `${getHubOrigin()}/hubs/charter-bookings`;

export const getTrackingHubUrl = () => `${getHubOrigin()}/hubs/tracking`;

export const getIncidentsHubUrl = () => `${getHubOrigin()}/hubs/incidents`;
