import api from './axios';

// API: Lấy danh sách tuyến đường sông (chỉ trả về các tuyến Active, sắp xếp theo RouteCode)
export const getRoutes = () =>
    api.get('/routes').then(response => response.data);

// API: Lấy chi tiết một tuyến đường kèm danh sách bến dừng (stops) đã sắp xếp theo stopOrder
export const getRouteById = (id) =>
    api.get(`/routes/${id}`).then(response => response.data);

// API: Cập nhật thông tin tuyến đường (routeCode không đổi được sau khi tạo)
export const updateRoute = (id, data) =>
    api.put(`/routes/${id}`, data).then(response => response.data);

// API: Xóa tuyến đường (chỉ xóa được tuyến chưa có trip nào, ngược lại phải PUT status=Inactive)
export const deleteRoute = (id) =>
    api.delete(`/routes/${id}`).then(response => response.data);

// API: Ghép nhiều tuyến GPS thành 1 tuyến dài (sourceRouteIds nối đuôi nhau)
export const mergeRoutes = (data) =>
    api.post('/routes/from-routes', data).then(response => response.data);
