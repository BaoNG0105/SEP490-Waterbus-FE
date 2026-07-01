import api from './axios';

// API: Lấy toàn bộ danh sách nhà ga/trạm
export const getStations = () =>
    api.get('/stations').then(response => response.data);