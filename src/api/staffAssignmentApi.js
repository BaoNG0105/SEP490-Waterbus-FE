import api from './axios';

// API: Danh sách phân công staff (Boat / Station — không dùng tripId)
export const getStaffAssignments = (params = {}) =>
    api.get('/staff-assignments', { params }).then((response) => response.data);

/** Ca của tôi — Staff/Manager nhận lịch (BE scope theo token) */
export const getMyStaffAssignments = (params = {}) =>
    api.get('/staff-assignments/mine', { params }).then((response) => response.data);

// API: Tạo phân công (Boat cần boatId + staff OnBoard; Station cần stationId + staff Ground)
export const createStaffAssignment = (payload) =>
    api.post('/staff-assignments', payload).then((response) => response.data);

// API: Hủy phân công (soft) → status = Cancelled. Không còn PATCH /status.
export const deleteStaffAssignment = (assignmentId) =>
    api.delete(`/staff-assignments/${assignmentId}`).then((response) => response.data);
