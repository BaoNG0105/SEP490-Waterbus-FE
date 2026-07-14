import api from './axios';

/** Dashboard / ca hôm nay */
export const getStaffMeToday = () =>
    api.get('/staff/me/today').then((response) => response.data);

export const getStaffMeCurrentShift = () =>
    api.get('/staff/me/current-shift').then((response) => response.data);

/** Lịch của tôi */
export const getStaffMeAssignments = (params = {}) =>
    api.get('/staff/me/assignments', { params }).then((response) => response.data);

/** Chuyến của tôi */
export const getStaffMeTrips = (params = {}) =>
    api.get('/staff/me/trips', { params }).then((response) => response.data);
