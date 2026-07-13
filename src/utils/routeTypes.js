export const ROUTE_TYPE_META = {
  Regular: {
    isBookable: true,
    labelVn: "Thường",
    labelEn: "Regular",
  },
  SightseeingLoop: {
    isBookable: true,
    labelVn: "Vòng tham quan",
    labelEn: "Sightseeing loop",
  },
  CharterReference: {
    isBookable: false,
    labelVn: "Tham chiếu thuê tàu",
    labelEn: "Charter reference",
  },
};

export const ROUTE_TYPE_VALUES = Object.keys(ROUTE_TYPE_META);

export const resolveRouteIsBookable = (routeType) =>
  ROUTE_TYPE_META[routeType]?.isBookable ?? true;

export const getRouteTypeLabel = (routeType, lang = "VN") => {
  const meta = ROUTE_TYPE_META[routeType];
  if (!meta) return routeType || "—";
  return lang === "VN" ? meta.labelVn : meta.labelEn;
};

export const getRouteTypeOptions = (lang = "VN") =>
  ROUTE_TYPE_VALUES.map((value) => ({
    value,
    label: getRouteTypeLabel(value, lang),
  }));

export const isSightseeingLoopRoute = (routeType) => routeType === "SightseeingLoop";
