import api from './axios';

// API: Lấy danh sách tuyến đường sông (chỉ trả về các tuyến Active, sắp xếp theo RouteCode)
export const getRoutes = () =>
    api.get('/routes').then(response => response.data);

// API: Lấy chi tiết một tuyến đường kèm danh sách bến dừng (stops) đã sắp xếp theo stopOrder
export const getRouteById = (id) =>
    api.get(`/routes/${id}`).then(response => response.data);

// API: Tạo mới một tuyến đường sông kèm danh sách waypoints
export const createRoute = (data) =>
    api.post('/routes', data).then(response => response.data);

// API: Cập nhật thông tin tuyến đường (routeCode không đổi được sau khi tạo)
export const updateRoute = (id, data) =>
    api.put(`/routes/${id}`, data).then(response => response.data);

// API: Xóa tuyến đường (chỉ xóa được tuyến chưa có trip nào, ngược lại phải PUT status=Inactive)
export const deleteRoute = (id) =>
    api.delete(`/routes/${id}`).then(response => response.data);

// API: Thêm bến dừng vào tuyến
export const addRouteStop = (routeId, data) =>
    api.post(`/routes/${routeId}/stops`, data).then(response => response.data);

// API: Cập nhật bến dừng (không đổi được stationId hay stopOrder sau khi tạo)
export const updateRouteStop = (routeId, stopId, data) =>
    api.put(`/routes/${routeId}/stops/${stopId}`, data).then(response => response.data);

// API: Xóa bến dừng khỏi tuyến
export const deleteRouteStop = (routeId, stopId) =>
    api.delete(`/routes/${routeId}/stops/${stopId}`).then(response => response.data);

// API: Import mạng lưới sông rạch và bến từ file GeoJSON (multipart/form-data, field "file")
// filename: tùy chọn, dùng khi "file" là Blob dựng thủ công (vd từ công cụ vẽ tay) chứ không phải
// input[type=file], vì Blob không tự mang theo tên file.
export const importRoutesGeoJson = (file, filename) => {
    const formData = new FormData();
    if (filename) {
        formData.append('file', file, filename);
    } else {
        formData.append('file', file);
    }
    return api.post('/routes/geojson-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }).then(response => response.data);
};
