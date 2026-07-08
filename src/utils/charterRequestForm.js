export const deckOptions = [1, 2];

export const getMinDepartureDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const createEmptyStop = () => ({
  stationId: "",
  stopOrder: 1,
  stayDurationMinutes: 0,
  note: "",
});

export const createEmptyBoatRequest = () => ({
  numberOfDecks: 1,
});

export const normalizeDeckCount = (value, fallback = 1) => {
  const numberOfDecks = Number(value);
  return deckOptions.includes(numberOfDecks) ? numberOfDecks : fallback;
};
