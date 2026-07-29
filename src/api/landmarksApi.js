import api from './axios';

// API: Lấy toàn bộ danh sách landmark (bao gồm inactive + audio đã bake theo từng giọng)
export const getLandmarksAdmin = () =>
    api.get('/landmarks/admin').then(response => response.data);

// API: Tạo landmark mới (không gắn tuyến — định danh bằng lat/lng)
export const createLandmark = (data) =>
    api.post('/landmarks', data).then(response => response.data);

// API: Cập nhật landmark — full replace, field bỏ trống sẽ bị ghi đè
export const updateLandmark = (id, data) =>
    api.put(`/landmarks/${id}`, data).then(response => response.data);

// API: Xóa landmark (cascade xóa mọi audio của nó)
export const deleteLandmark = (id) =>
    api.delete(`/landmarks/${id}`).then(response => response.data);

// API: Upsert audio pre-bake cho landmark theo giọng (voiceId) — có rồi thì cập nhật URL, chưa có thì tạo
export const upsertLandmarkAudio = (id, data) =>
    api.put(`/landmarks/${id}/audios`, data).then(response => response.data);

// API: Xóa 1 audio cụ thể của landmark
export const deleteLandmarkAudio = (audioId) =>
    api.delete(`/landmarks/audios/${audioId}`).then(response => response.data);
