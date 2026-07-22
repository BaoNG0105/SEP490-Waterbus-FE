import {
    getBoats as apiGetBoats,
    createBoat as apiCreateBoat,
    getBoatById as apiGetBoatById,
    updateBoat as apiUpdateBoat,
    updateBoatStatus as apiUpdateBoatStatus,
    deleteBoat as apiDeleteBoat,
    getBoatDocuments as apiGetBoatDocuments,
    uploadBoatDocument as apiUploadBoatDocument,
    deleteBoatDocument as apiDeleteBoatDocument,
    getBoatCrewAssignments as apiGetBoatCrewAssignments,
    createBoatCrewAssignment as apiCreateBoatCrewAssignment,
    deleteBoatCrewAssignment as apiDeleteBoatCrewAssignment,
    getBoatCrewReplacements as apiGetBoatCrewReplacements,
    createBoatCrewReplacement as apiCreateBoatCrewReplacement,
    deleteBoatCrewReplacement as apiDeleteBoatCrewReplacement,
    getBoatCrewCalendar as apiGetBoatCrewCalendar,
} from '../api/boatApi';

const unwrapList = (data) => (Array.isArray(data) ? data : (data?.items || data?.data || []));

// Hàm Service lấy danh sách tàu
export const fetchAllBoats = async (params) => {
    try {
        const data = await apiGetBoats(params);
        return data;
    } catch (error) {
        console.error('Error fetching boats list:', error);
        throw error;
    }
};

// Cache tàu Active theo serviceType: tàu ít đổi, tránh gọi lại mỗi lần mở màn (giảm transfer/query Neon).
const ACTIVE_BOATS_TTL_MS = 5 * 60 * 1000;
const activeBoatsCache = new Map(); // serviceType -> { at, data }
const activeBoatsInflight = new Map(); // serviceType -> Promise

/** Xóa cache tàu (gọi sau khi tạo/sửa/xóa/đổi trạng thái tàu). */
export const invalidateActiveBoatsCache = () => {
    activeBoatsCache.clear();
    activeBoatsInflight.clear();
};

/** Active boats by serviceType: Passenger | Rescue */
export const fetchActiveBoatsByServiceType = async (serviceType, { force = false } = {}) => {
    const key = String(serviceType || "");
    const cached = activeBoatsCache.get(key);
    if (!force && cached && Date.now() - cached.at < ACTIVE_BOATS_TTL_MS) {
        return cached.data;
    }
    if (!force && activeBoatsInflight.has(key)) {
        return activeBoatsInflight.get(key);
    }
    const promise = (async () => {
        const data = await fetchAllBoats({ status: "Active", serviceType });
        const list = unwrapList(data);
        activeBoatsCache.set(key, { at: Date.now(), data: list });
        return list;
    })();
    activeBoatsInflight.set(key, promise);
    try {
        return await promise;
    } finally {
        activeBoatsInflight.delete(key);
    }
};

// Hàm Service tạo tàu mới
export const addNewBoat = async (boatPayload) => {
    try {
        const response = await apiCreateBoat(boatPayload);
        invalidateActiveBoatsCache();
        return response;
    } catch (error) {
        console.error('Error in addNewBoat Service:', error);
        throw error;
    }
};

// Hàm Service lấy chi tiết tàu theo ID
export const fetchBoatDetail = async (boatId) => {
    try {
        return await apiGetBoatById(boatId);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết tàu ${boatId}:`, error);
        throw error;
    }
};

// Hàm Service cập nhật tàu
export const modifyBoat = async (boatId, boatPayload) => {
    try {
        const response = await apiUpdateBoat(boatId, boatPayload);
        invalidateActiveBoatsCache();
        return response;
    } catch (error) {
        console.error(`Lỗi trong service modifyBoat tại ID ${boatId}:`, error);
        throw error;
    }
};

// Hàm Service cập nhật trạng thái tàu
export const modifyBoatStatus = async (boatId, statusPayload) => {
    try {
        const response = await apiUpdateBoatStatus(boatId, statusPayload);
        invalidateActiveBoatsCache();
        return response;
    } catch (error) {
        console.error(`Lỗi khi cập nhật trạng thái tàu ${boatId}:`, error);
        throw error;
    }
};

// Hàm service xóa tàu
export const deleteBoat = async (boatId) => {
    try {
        const response = await apiDeleteBoat(boatId);
        invalidateActiveBoatsCache();
        return response;
    } catch (error) {
        console.error(`Lỗi khi xóa tàu ${boatId}:`, error);
        throw error;
    }
};

export const fetchBoatDocuments = async (boatId) => {
    try {
        return await apiGetBoatDocuments(boatId);
    } catch (error) {
        console.error(`Lỗi khi lấy hồ sơ tàu ${boatId}:`, error);
        throw error;
    }
};

export const uploadBoatDocument = async (boatId, documentType, payload) => {
    try {
        return await apiUploadBoatDocument(boatId, documentType, payload);
    } catch (error) {
        console.error(`Lỗi khi upload hồ sơ ${documentType} cho tàu ${boatId}:`, error);
        throw error;
    }
};

export const removeBoatDocument = async (boatId, documentType) => {
    try {
        return await apiDeleteBoatDocument(boatId, documentType);
    } catch (error) {
        console.error(`Lỗi khi xóa hồ sơ ${documentType} của tàu ${boatId}:`, error);
        throw error;
    }
};

export const fetchBoatCrewAssignments = async (boatId, params = { activeOnly: true }) => {
    try {
        return unwrapList(await apiGetBoatCrewAssignments(boatId, params));
    } catch (error) {
        console.error(`Lỗi khi lấy crew của tàu ${boatId}:`, error);
        throw error;
    }
};

export const assignBoatCrew = async (boatId, payload) => {
    try {
        return await apiCreateBoatCrewAssignment(boatId, payload);
    } catch (error) {
        console.error(`Lỗi khi gán crew cho tàu ${boatId}:`, error);
        throw error;
    }
};

export const removeBoatCrewAssignment = async (boatId, assignmentId) => {
    try {
        return await apiDeleteBoatCrewAssignment(boatId, assignmentId);
    } catch (error) {
        console.error(`Lỗi khi gỡ crew ${assignmentId} của tàu ${boatId}:`, error);
        throw error;
    }
};

export const fetchBoatCrewReplacements = async (boatId, params = { activeOnly: true }) => {
    try {
        return unwrapList(await apiGetBoatCrewReplacements(boatId, params));
    } catch (error) {
        console.error(`Lỗi khi lấy crew thay thế của tàu ${boatId}:`, error);
        throw error;
    }
};

export const createBoatCrewReplacement = async (boatId, payload) => {
    try {
        return await apiCreateBoatCrewReplacement(boatId, payload);
    } catch (error) {
        console.error(`Lỗi khi tạo crew thay thế cho tàu ${boatId}:`, error);
        throw error;
    }
};

export const removeBoatCrewReplacement = async (boatId, replacementId) => {
    try {
        return await apiDeleteBoatCrewReplacement(boatId, replacementId);
    } catch (error) {
        console.error(`Lỗi khi hủy crew thay thế ${replacementId} của tàu ${boatId}:`, error);
        throw error;
    }
};

export const fetchBoatCrewCalendar = async (boatId, fromDate, toDate) => {
    try {
        return unwrapList(await apiGetBoatCrewCalendar(boatId, { fromDate, toDate }));
    } catch (error) {
        console.error(`Lỗi khi lấy lịch crew của tàu ${boatId}:`, error);
        throw error;
    }
};
