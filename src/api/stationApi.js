import api from './axios';

// API: Lấy toàn bộ danh sách nhà ga/trạm
export const getStations = () =>
    api.get('/stations').then(response => response.data);

// API lấy chi tiết một nhà ga bến tàu theo ID
export const getStationById = (id) =>
    api.get(`/stations/${id}`).then(response => response.data);

// API cập nhật thông tin nhà ga bến tàu
export const updateStation = (id, data) =>
    api.put(`/stations/${id}`, data).then(response => response.data);