import {
    getStaffMeToday as apiGetStaffMeToday,
    getStaffMeCurrentShift as apiGetStaffMeCurrentShift,
    getStaffMeAssignments as apiGetStaffMeAssignments,
    getStaffMeTrips as apiGetStaffMeTrips,
} from '../api/staffMeApi';
import { normalizeStaffAssignment } from './staffAssignmentService';

const extractRows = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.trips)) return data.trips;
    if (Array.isArray(data?.assignments)) return data.assignments;
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

export const normalizeStaffTrip = (item) => {
    if (!item) return null;
    return {
        tripId: String(pick(item, ['tripId', 'id'], '')),
        tripCode: pick(item, ['tripCode', 'code'], ''),
        routeName: pick(item, ['routeName', 'route.name', 'route'], '—'),
        boatName: pick(item, ['boatName', 'boat.boatName', 'boat.name'], ''),
        boatCode: pick(item, ['boatCode', 'boat.boatCode'], ''),
        departureAt: pick(item, ['departureAt', 'startAt', 'departAt'], '') || null,
        arrivalAt: pick(item, ['arrivalAt', 'endAt', 'arriveAt'], '') || null,
        fromStationName: pick(item, ['fromStationName', 'fromStation.stationName', 'departureStationName'], ''),
        toStationName: pick(item, ['toStationName', 'toStation.stationName', 'arrivalStationName'], ''),
        status: pick(item, ['status', 'tripStatus'], ''),
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
