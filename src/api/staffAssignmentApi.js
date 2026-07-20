import api from './axios';

// API: Danh sách phân công staff (Boat / Station — không dùng tripId)
export const getStaffAssignments = (params = {}) =>
    api.get('/staff-assignments', { params }).then((response) => response.data);

/** Ca của tôi — Staff/Manager nhận lịch (BE scope theo token) */
export const getMyStaffAssignments = (params = {}) =>
    api.get('/staff-assignments/mine', { params }).then((response) => response.data);

// API: Tạo 1 ca (tối đa 24h)
export const createStaffAssignment = (payload) =>
    api.post('/staff-assignments', payload).then((response) => response.data);

/** Tạo lịch nhiều ngày — BE tự tách ca theo ngày */
export const createStaffAssignmentsBulk = (payload) =>
    api.post('/staff-assignments/bulk', payload).then((response) => response.data);

/** Thay nhân viên trên ca — ca cũ → Replaced */
export const replaceStaffAssignment = (assignmentId, payload) =>
    api.post(`/staff-assignments/${assignmentId}/replace`, payload).then((response) => response.data);

// API: Hủy phân công (soft) → status = Cancelled
export const deleteStaffAssignment = (assignmentId) =>
    api.delete(`/staff-assignments/${assignmentId}`).then((response) => response.data);
