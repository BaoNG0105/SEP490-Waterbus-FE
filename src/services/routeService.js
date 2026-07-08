import {
    getRoutes as apiGetRoutes,
    getRouteById as apiGetRouteById,
    createRoute as apiCreateRoute,
    updateRoute as apiUpdateRoute,
    deleteRoute as apiDeleteRoute,
    addRouteStop as apiAddRouteStop,
    updateRouteStop as apiUpdateRouteStop,
    deleteRouteStop as apiDeleteRouteStop,
    importRoutesGeoJson as apiImportRoutesGeoJson
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

// Service: Tạo mới tuyến đường sông
export const createNewRoute = async (routePayload) => {
    try {
        return await apiCreateRoute(routePayload);
    } catch (error) {
        console.error('Lỗi khi tạo tuyến đường mới:', error);
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

// Service: Thêm bến dừng vào tuyến
export const addStopToRoute = async (routeId, stopPayload) => {
    try {
        return await apiAddRouteStop(routeId, stopPayload);
    } catch (error) {
        console.error(`Lỗi khi thêm bến dừng vào tuyến ${routeId}:`, error);
        throw error;
    }
};

// Service: Cập nhật bến dừng
export const modifyRouteStop = async (routeId, stopId, stopPayload) => {
    try {
        return await apiUpdateRouteStop(routeId, stopId, stopPayload);
    } catch (error) {
        console.error(`Lỗi khi cập nhật bến dừng ${stopId}:`, error);
        throw error;
    }
};

// Service: Xóa bến dừng khỏi tuyến
export const removeRouteStop = async (routeId, stopId) => {
    try {
        return await apiDeleteRouteStop(routeId, stopId);
    } catch (error) {
        console.error(`Lỗi khi xóa bến dừng ${stopId}:`, error);
        throw error;
    }
};

// Service: Import mạng lưới sông rạch và bến từ file GeoJSON
export const importGeoJsonNetwork = async (file) => {
    try {
        return await apiImportRoutesGeoJson(file);
    } catch (error) {
        console.error('Lỗi khi import mạng lưới sông rạch từ GeoJSON:', error);
        throw error;
    }
};
