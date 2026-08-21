import api from './axios';

// API: Lấy toàn bộ danh sách nhà ga/trạm
export const getStations = () =>
    api.get('/stations').then(response => response.data);

// API lấy chi tiết một nhà ga bến tàu theo ID
export const getStationById = (id) =>
    api.get(`/stations/${id}`).then(response => response.data);

/** POST /stations — JSON hoặc multipart/form-data (field `images` khi upload file). */
export const createStation = (data) => {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    return api
        .post("/stations", data, isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined)
        .then((response) => response.data);
};

// API cập nhật thông tin nhà ga bến tàu
export const updateStation = (id, data) => {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    return api
        .put(`/stations/${id}`, data, isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : undefined)
        .then((response) => response.data);
};

/** PATCH /stations/{id}/status — chỉ bật/tắt Active|Inactive, không cần gửi lại toàn bộ hồ sơ. */
export const updateStationStatus = (id, status) =>
    api.patch(`/stations/${id}/status`, { status }).then((response) => response.data);