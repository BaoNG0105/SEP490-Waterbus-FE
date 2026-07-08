const stripApiSuffix = (url) => String(url || "").replace(/\/api\/?$/, "");

export const getCharterBookingHubUrl = () => {
  if (import.meta.env.DEV) {
    return `${window.location.origin}/hubs/charter-bookings`;
  }

  const base = stripApiSuffix(import.meta.env.VITE_API_BASE_URL) || window.location.origin;
  return `${base}/hubs/charter-bookings`;
};
