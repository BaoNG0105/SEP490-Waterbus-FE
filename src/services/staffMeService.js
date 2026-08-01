import {
    getStaffMeToday as apiGetStaffMeToday,
    getStaffMeCurrentShift as apiGetStaffMeCurrentShift,
    getStaffMeAssignments as apiGetStaffMeAssignments,
    getStaffMeTrips as apiGetStaffMeTrips,
    getStaffMeScanHistory as apiGetStaffMeScanHistory,
} from '../api/staffMeApi';
import { normalizeStaffAssignment } from './staffAssignmentService';

const extractRows = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.trips)) return data.trips;
    if (Array.isArray(data?.assignments)) return data.assignments;
    if (Array.isArray(data?.events)) return data.events;
    return [];
};

const pick = (source, keys, fallback = '') => {
    for (const key of keys) {
        const value = key.split('.').reduce((obj, part) => obj?.[part], source);
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
};

export const fetchStaffMeToday = async () => {
    try {
        return await apiGetStaffMeToday();
    } catch (error) {
        console.error('Lỗi tải staff/me/today:', error);
        throw error;
    }
};

export const fetchStaffMeCurrentShift = async () => {
    try {
        return await apiGetStaffMeCurrentShift();
    } catch (error) {
        console.error('Lỗi tải staff/me/current-shift:', error);
        throw error;
    }
};

export const fetchStaffMeAssignments = async ({ fromDate, toDate, status } = {}) => {
    try {
        const params = {};
        if (fromDate) params.fromDate = fromDate;
        if (toDate) params.toDate = toDate;
        if (status && status !== 'All') params.status = status;
        const data = await apiGetStaffMeAssignments(params);
        return extractRows(data).map(normalizeStaffAssignment).filter(Boolean);
    } catch (error) {
        console.error('Lỗi tải staff/me/assignments:', error);
        throw error;
    }
};

/** Tên bến từ string hoặc object BE. */
const coerceStationLabel = (value) => {
    if (value == null || value === '') return '';
    if (typeof value === 'string' || typeof value === 'number') {
        const text = String(value).trim();
        return text === '[object Object]' || text === '—' ? '' : text;
    }
    if (typeof value === 'object') {
        return String(
            value.stationName
            || value.name
            || value.stationCode
            || value.code
            || '',
        ).trim();
    }
    return '';
};

const stopStationLabel = (stop) => coerceStationLabel(
    stop?.stationName
    || stop?.StationName
    || stop?.station
    || stop?.Station
    || stop?.stationCode
    || stop?.name
    || stop,
);

/** Tách "WATERBUS - BACH DANG- LINH DONG" / "A → B" thành [from, to]. */
const parseRouteEndpoints = (routeName) => {
    const raw = String(routeName || '').trim();
    if (!raw || raw === '—') return { from: '', to: '' };

    const arrow = raw.split(/\s*(?:→|->|—)\s*/).map((part) => part.trim()).filter(Boolean);
    if (arrow.length >= 2) {
        return { from: arrow[0], to: arrow[arrow.length - 1] };
    }

    // "WATERBUS - BACH DANG- LINH DONG" / "WB-BD-LB" / "WATERBUS-BACH DANG-LINH DONG"
    const cleaned = raw
        .replace(/^waterbus\s*[-–]?\s*/i, '')
        .replace(/^wb\s*[-–]\s*/i, '')
        .trim();
    const parts = cleaned.split(/\s*[-–]\s*/).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
        return { from: parts[0], to: parts[parts.length - 1] };
    }
    return { from: '', to: '' };
};

const resolveRouteName = (item) => {
    const direct = pick(item, ['routeName', 'RouteName', 'route.name'], '');
    if (typeof direct === 'string' && direct.trim() && direct.trim() !== '—') {
        return direct.trim();
    }
    if (direct && typeof direct === 'object') {
        return coerceStationLabel(direct.name || direct.routeName || direct) || '';
    }
    const route = item?.route ?? item?.Route;
    if (typeof route === 'string' && route.trim() && route.trim() !== '—') return route.trim();
    if (route && typeof route === 'object') {
        return coerceStationLabel(route.name || route.routeName || route) || '';
    }
    return '';
};

export const normalizeStaffTrip = (item) => {
    if (!item) return null;
    const departureAt = pick(item, [
        'departureTime', 'DepartureTime',
        'departureAt', 'startAt', 'departAt',
        'scheduledDeparture', 'displayStartAt',
    ], '') || null;
    const arrivalAt = pick(item, [
        'arrivalTime', 'ArrivalTime',
        'arrivalAt', 'endAt', 'arriveAt',
        'scheduledArrival', 'displayEndAt',
    ], '') || null;

    const stops = Array.isArray(item.stops)
        ? item.stops
        : (Array.isArray(item.Stops) ? item.Stops : []);
    const sortedStops = [...stops].sort(
        (a, b) => Number(a?.stopOrder ?? a?.StopOrder ?? 0) - Number(b?.stopOrder ?? b?.StopOrder ?? 0),
    );
    const firstStop = sortedStops[0];
    const lastStop = sortedStops.length ? sortedStops[sortedStops.length - 1] : null;

    const tripCode = pick(item, ['tripCode', 'TripCode', 'code'], '');
    const routeName = resolveRouteName(item) || '—';
    const routeEnds = parseRouteEndpoints(routeName);

    const fromStationName = coerceStationLabel(pick(item, [
        'fromStationName', 'FromStationName',
        'fromStation.stationName', 'fromStation.name',
        'departureStationName', 'fromLocation', 'FromLocation',
        'startStationName', 'originName',
        'fromStation',
    ], ''))
        || stopStationLabel(firstStop)
        || routeEnds.from
        || '';

    const toStationName = coerceStationLabel(pick(item, [
        'toStationName', 'ToStationName',
        'toStation.stationName', 'toStation.name',
        'arrivalStationName', 'destinationStationName', 'DestinationStationName',
        'toLocation', 'ToLocation',
        'endStationName', 'destinationName',
        'toStation',
    ], ''))
        || stopStationLabel(lastStop)
        || routeEnds.to
        || '';

    return {
        tripId: String(pick(item, ['tripId', 'TripId', 'id'], '')),
        tripCode,
        routeName,
        routeCode: pick(item, ['routeCode', 'RouteCode'], ''),
        boatId: String(pick(item, ['boatId', 'BoatId', 'boat.boatId', 'boat.vesselId'], '') || ''),
        boatName: pick(item, ['boatName', 'BoatName', 'boat.boatName', 'boat.name'], ''),
        boatCode: pick(item, ['boatCode', 'BoatCode', 'boat.boatCode'], ''),
        departureAt,
        arrivalAt,
        fromStationName,
        toStationName,
        status: pick(item, ['tripStatus', 'TripStatus', 'status'], ''),
        tripType: pick(item, ['tripType', 'TripType'], ''),
        assignmentType: pick(item, ['assignmentType', 'AssignmentType'], ''),
        stationName: coerceStationLabel(pick(item, ['stationName', 'StationName'], '')) || fromStationName,
        stops: sortedStops,
        delayInfo: item.delayInfo || item.DelayInfo || null,
        raw: item,
    };
};

export const fetchStaffMeTrips = async ({ date } = {}) => {
    try {
        const params = {};
        if (date) params.date = date;
        const data = await apiGetStaffMeTrips(params);
        return extractRows(data).map(normalizeStaffTrip).filter(Boolean);
    } catch (error) {
        console.error('Lỗi tải staff/me/trips:', error);
        throw error;
    }
};

/** TicketScanEventDto → row UI. */
export const normalizeStaffScanEvent = (item) => {
    if (!item) return null;
    return {
        eventId: String(pick(item, ['eventId', 'EventId', 'id'], '')),
        ticketId: String(pick(item, ['ticketId', 'TicketId'], '') || ''),
        ticketCode: pick(item, ['ticketCode', 'TicketCode'], '') || '',
        bookingCode: pick(item, ['bookingCode', 'BookingCode'], '') || '',
        tripId: String(pick(item, ['tripId', 'TripId'], '') || ''),
        tripCode: pick(item, ['tripCode', 'TripCode'], '') || '',
        action: pick(item, ['action', 'Action'], '') || '',
        result: pick(item, ['result', 'Result'], '') || '',
        source: pick(item, ['source', 'Source'], '') || '',
        failureReason: pick(item, ['failureReason', 'FailureReason'], '') || '',
        note: pick(item, ['note', 'Note'], '') || '',
        scannedCodeOrToken: pick(item, ['scannedCodeOrToken', 'ScannedCodeOrToken'], '') || '',
        ticketStatusBefore: pick(item, ['ticketStatusBefore', 'TicketStatusBefore'], '') || '',
        ticketStatusAfter: pick(item, ['ticketStatusAfter', 'TicketStatusAfter'], '') || '',
        boatName: pick(item, ['boatName', 'BoatName', 'boatCode', 'BoatCode'], '') || '',
        stationName: pick(item, ['stationName', 'StationName', 'stationCode', 'StationCode'], '') || '',
        assignmentType: pick(item, ['assignmentType', 'AssignmentType'], '') || '',
        deviceTime: pick(item, ['deviceTime', 'DeviceTime'], '') || null,
        serverTime: pick(item, ['serverTime', 'ServerTime'], '') || null,
        raw: item,
    };
};

/**
 * GET /staff/me/scan-history
 * @param {{ fromDate?: string, toDate?: string, tripId?: string, action?: string, result?: string, source?: string }} filters
 */
export const fetchStaffMeScanHistory = async ({
    fromDate,
    toDate,
    tripId,
    action,
    result,
    source,
} = {}) => {
    try {
        const params = {};
        if (fromDate) params.fromDate = fromDate;
        if (toDate) params.toDate = toDate;
        if (tripId) params.tripId = tripId;
        if (action && action !== 'all') params.action = action;
        if (result && result !== 'all') params.result = result;
        if (source && source !== 'all') params.source = source;
        const data = await apiGetStaffMeScanHistory(params);
        return extractRows(data).map(normalizeStaffScanEvent).filter(Boolean);
    } catch (error) {
        console.error('Lỗi tải staff/me/scan-history:', error);
        throw error;
    }
};
