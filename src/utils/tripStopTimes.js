/** Alias field giờ bến — BE mới (*At) + FE cũ. */

export const pickStopScheduledArrival = (stop) => (
  stop?.scheduledArrivalAt
  ?? stop?.ScheduledArrivalAt
  ?? stop?.scheduledArrival
  ?? stop?.ScheduledArrival
  ?? null
);

export const pickStopScheduledDeparture = (stop) => (
  stop?.scheduledDepartureAt
  ?? stop?.ScheduledDepartureAt
  ?? stop?.scheduledDeparture
  ?? stop?.ScheduledDeparture
  ?? stop?.plannedDepartureTime
  ?? null
);

export const pickStopAdjustedArrival = (stop) => (
  stop?.adjustedArrivalAt
  ?? stop?.AdjustedArrivalAt
  ?? stop?.adjustedArrival
  ?? stop?.adjustedArrivalTime
  ?? null
);

export const pickStopAdjustedDeparture = (stop) => (
  stop?.adjustedDepartureAt
  ?? stop?.AdjustedDepartureAt
  ?? stop?.adjustedDeparture
  ?? stop?.adjustedDepartureTime
  ?? null
);

export const pickStopActualArrival = (stop) => (
  stop?.actualArrivalAt
  ?? stop?.ActualArrivalAt
  ?? stop?.actualArrival
  ?? stop?.ActualArrival
  ?? null
);

export const pickStopActualDeparture = (stop) => (
  stop?.actualDepartureAt
  ?? stop?.ActualDepartureAt
  ?? stop?.actualDeparture
  ?? stop?.ActualDeparture
  ?? null
);

/**
 * Rule FE theo BE:
 * arrival = actualArrivalAt ?? adjustedArrivalAt ?? scheduledArrivalAt
 * departure = actualDepartureAt ?? adjustedDepartureAt ?? scheduledDepartureAt
 */
export const pickStopDisplayArrival = (stop) => (
  pickStopActualArrival(stop)
  ?? pickStopAdjustedArrival(stop)
  ?? pickStopScheduledArrival(stop)
);

export const pickStopDisplayDeparture = (stop) => (
  pickStopActualDeparture(stop)
  ?? pickStopAdjustedDeparture(stop)
  ?? pickStopScheduledDeparture(stop)
);

/** Chuẩn hóa 1 stop về field FE quen thuộc + giữ *At gốc. */
export const normalizeTripStop = (stop) => {
  if (!stop || typeof stop !== "object") return stop;
  const scheduledArrival = pickStopScheduledArrival(stop);
  const scheduledDeparture = pickStopScheduledDeparture(stop);
  const adjustedArrival = pickStopAdjustedArrival(stop);
  const adjustedDeparture = pickStopAdjustedDeparture(stop);
  const actualArrival = pickStopActualArrival(stop);
  const actualDeparture = pickStopActualDeparture(stop);
  const stay = stop.stayDurationMinutes ?? stop.StayDurationMinutes;
  const stayN = stay === null || stay === undefined || stay === "" ? null : Number(stay);

  return {
    ...stop,
    stopOrder: stop.stopOrder ?? stop.StopOrder ?? null,
    stationId: stop.stationId ?? stop.StationId ?? stop.station?.stationId ?? null,
    stationCode: stop.stationCode
      ?? stop.StationCode
      ?? stop.station?.stationCode
      ?? stop.station?.code
      ?? null,
    stationName: stop.stationName
      ?? stop.StationName
      ?? stop.station?.stationName
      ?? stop.station?.name
      ?? null,
    scheduledArrival,
    scheduledDeparture,
    adjustedArrival,
    adjustedDeparture,
    actualArrival,
    actualDeparture,
    scheduledArrivalAt: scheduledArrival,
    scheduledDepartureAt: scheduledDeparture,
    adjustedArrivalAt: adjustedArrival,
    adjustedDepartureAt: adjustedDeparture,
    actualArrivalAt: actualArrival,
    actualDepartureAt: actualDeparture,
    stayDurationMinutes: Number.isFinite(stayN) ? stayN : (stop.stayDurationMinutes ?? null),
    stopStatus: stop.stopStatus ?? stop.StopStatus ?? null,
  };
};

export const normalizeTripStops = (stops) => (
  Array.isArray(stops) ? stops.map(normalizeTripStop).filter(Boolean) : []
);
