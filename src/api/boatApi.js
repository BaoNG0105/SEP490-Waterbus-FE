import api from './axios';

// API Danh sách tàu
export const getBoats = (params) =>
    api.get('/boats', { params }).then(response => response.data);

// API Chi tiết tàu theo ID
export const getBoatById = (id) => 
    api.get(`/boats/${id}`).then(r => r.data);

// API Tạo tàu mới
export const createBoat = (data) => 
    api.post('/boats', data).then(r => r.data);

// API Cập nhật tàu
export const updateBoat = (id, data) => 
    api.put(`/boats/${id}`, data).then(r => r.data);

// API Cập nhật trạng thái tàu
export const updateBoatStatus = (id, data) =>
    api.patch(`/boats/${id}/status`, data).then(r => r.data);

// API Xóa tàu
export const deleteBoat = (id) => api.delete(`/boats/${id}`).then(r => r.data);

// API Hồ sơ pháp lý tàu
export const getBoatDocuments = (boatId) =>
    api.get(`/boats/${boatId}/documents`).then((response) => response.data);

export const uploadBoatDocument = (boatId, documentType, formData) =>
    api.put(`/boats/${boatId}/documents/${documentType}`, formData).then((response) => response.data);

export const deleteBoatDocument = (boatId, documentType) =>
    api.delete(`/boats/${boatId}/documents/${documentType}`).then((response) => response.data);

// API Crew mặc định của tàu (OnBoard, dài hạn theo fromDate/toDate)
export const getBoatCrewAssignments = (boatId, params) =>
    api.get(`/boats/${boatId}/crew-assignments`, { params }).then((response) => response.data);

export const createBoatCrewAssignment = (boatId, data) =>
    api.post(`/boats/${boatId}/crew-assignments`, data).then((response) => response.data);

export const deleteBoatCrewAssignment = (boatId, assignmentId) =>
    api.delete(`/boats/${boatId}/crew-assignments/${assignmentId}`).then((response) => response.data);

// API Crew thay thế (khi có người nghỉ/thay tạm thời)
export const getBoatCrewReplacements = (boatId, params) =>
    api.get(`/boats/${boatId}/crew-replacements`, { params }).then((response) => response.data);

export const createBoatCrewReplacement = (boatId, data) =>
    api.post(`/boats/${boatId}/crew-replacements`, data).then((response) => response.data);

export const deleteBoatCrewReplacement = (boatId, replacementId) =>
    api.delete(`/boats/${boatId}/crew-replacements/${replacementId}`).then((response) => response.data);

// API Lịch crew theo khoảng ngày (xem theo tháng)
export const getBoatCrewCalendar = (boatId, params) =>
    api.get(`/boats/${boatId}/crew-calendar`, { params }).then((response) => response.data);
