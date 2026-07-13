import {
    getRoutes as apiGetRoutes,
    getRouteById as apiGetRouteById,
    updateRoute as apiUpdateRoute,
    deleteRoute as apiDeleteRoute,
    mergeRoutes as apiMergeRoutes,
} from '../api/routeApi';

// Service: Tải danh sách tuyến đường sông
export const fetchAllRoutes = async () => {
    try {
        return await apiGetRoutes();
    } catch (error) {
        console.error('Lỗi khi lấy danh sách tuyến đường từ Service:', error);
        throw error;
    }
};

// Service: Lấy thông tin chi tiết tuyến đường (kèm stops)
export const fetchRouteDetail = async (routeId) => {
    try {
        return await apiGetRouteById(routeId);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết tuyến đường ${routeId}:`, error);
        throw error;
    }
};

// Service: Cập nhật thông tin tuyến đường
export const modifyRoute = async (routeId, routePayload) => {
    try {
        return await apiUpdateRoute(routeId, routePayload);
    } catch (error) {
        console.error(`Lỗi khi cập nhật tuyến đường ${routeId}:`, error);
        throw error;
    }
};

// Service: Xóa tuyến đường
export const removeRoute = async (routeId) => {
    try {
        return await apiDeleteRoute(routeId);
    } catch (error) {
        console.error(`Lỗi khi xóa tuyến đường ${routeId}:`, error);
        throw error;
    }
};

// Service: Ghép nhiều tuyến GPS
export const mergeGpsRoutes = async (payload) => {
    try {
        return await apiMergeRoutes(payload);
    } catch (error) {
        console.error('Lỗi khi ghép tuyến GPS:', error);
        throw error;
    }
};
