import {
  getLatestBoatLocations as apiGetLatestBoatLocations,
  getLatestBoatLocation as apiGetLatestBoatLocation,
} from "../api/trackingApi";
import { normalizeBoatLocation, normalizeBoatLocationList } from "../utils/boatTracking";

export const fetchLatestBoatLocations = async () => {
  const data = await apiGetLatestBoatLocations();
  return normalizeBoatLocationList(data);
};

export const fetchLatestBoatLocation = async (boatCode) => {
  const data = await apiGetLatestBoatLocation(boatCode);
  return normalizeBoatLocation(data);
};
