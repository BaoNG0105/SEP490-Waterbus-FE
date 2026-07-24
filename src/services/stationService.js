import { 
    getStations as apiGetStations,
    getStationById as apiGetStationById,
    createStation as apiCreateStation,
    updateStation as apiUpdateStation    
} from '../api/stationApi';

const pick = (source, keys, fallback = "") => {
    for (const key of keys) {
        const value = key.split(".").reduce((obj, part) => obj?.[part], source);
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return fallback;
};

const normalizeStationManager = (item) => {
    if (item == null) return null;
    if (typeof item === "string") {
        return {
            id: "",
            fullName: item,
            phone: "",
            email: "",
            isPrimary: false,
            roles: [],
        };
    }

    const id = String(pick(item, ["userId", "id", "managerUserId", "accountId"], ""));
    const fullName = pick(item, ["fullName", "name", "displayName"], "--");
    if (!id && fullName === "--") return null;

    return {
        id,
        fullName,
        phone: pick(item, ["phoneNumber", "phone"], ""),
        email: pick(item, ["email"], ""),
        isPrimary: Boolean(item?.isPrimary),
        roles: Array.isArray(item?.roles) ? item.roles : [],
    };
};

// Service: Tải danh sách nhà ga và xử lý bẫy lỗi hệ thống
export const fetchAllStations = async () => {
    try {
        const data = await apiGetStations();
        return data;
    } catch (error) {
        console.error('Lỗi khi lấy danh sách nhà ga từ Service:', error);
        throw error;
    }
};

// Service lấy thông tin chi tiết nhà ga bến tàu
export const fetchStationDetail = async (stationId) => {
    try {
        return await apiGetStationById(stationId);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết nhà ga ${stationId}:`, error);
        throw error;
    }
};

/** Lấy danh sách manager thuộc bến (ưu tiên isPrimary trước). */
export const fetchStationManagers = async (stationId) => {
    if (!stationId) {
        return { managers: [], stationName: "", stationId: "" };
    }
    const station = await fetchStationDetail(stationId);
    const rows = Array.isArray(station?.managers) ? station.managers : [];
    const managers = rows
        .map(normalizeStationManager)
        .filter((item) => item?.id)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

    return {
        managers,
        stationName: station?.stationName || station?.name || "",
        stationId: String(station?.stationId || station?.id || stationId),
    };
};

/** Tạo nhà ga mới (JSON hoặc FormData kèm ảnh `images`). */
export const addNewStation = async (stationPayload) => {
    try {
        return await apiCreateStation(stationPayload);
    } catch (error) {
        console.error("Lỗi khi tạo nhà ga mới:", error);
        throw error;
    }
};

// Service cập nhật dữ liệu nhà ga bến tàu
export const modifyStation = async (stationId, stationPayload) => {
    try {
        return await apiUpdateStation(stationId, stationPayload);
    } catch (error) {
        console.error(`Lỗi khi thực hiện modifyStation cho ID ${stationId}:`, error);
        throw error;
    }
};
