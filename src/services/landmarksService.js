import {
    getLandmarksAdmin as apiGetLandmarksAdmin,
    createLandmark as apiCreateLandmark,
    updateLandmark as apiUpdateLandmark,
    deleteLandmark as apiDeleteLandmark,
    upsertLandmarkAudio as apiUpsertLandmarkAudio,
    deleteLandmarkAudio as apiDeleteLandmarkAudio,
} from '../api/landmarksApi';

const pick = (source, keys, fallback = "") => {
    for (const key of keys) {
        const value = key.split(".").reduce((obj, part) => obj?.[part], source);
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return fallback;
};

/** Chuẩn hóa 1 bản ghi audio đã bake của landmark (field name có thể lệch tùy BE). */
const normalizeLandmarkAudio = (item) => {
    if (item == null) return null;
    return {
        audioId: String(pick(item, ["audioId", "id"], "")),
        voiceId: String(pick(item, ["voiceId", "voice.id"], "")),
        voiceName: pick(item, ["voiceName", "voiceLabel", "voice.name", "voice.displayName"], ""),
        audioUrl: pick(item, ["audioUrl", "url"], ""),
        durationSeconds: Number(pick(item, ["durationSeconds", "duration"], 0)) || 0,
        createdAt: pick(item, ["createdAt", "updatedAt"], ""),
    };
};

/** Chuẩn hóa 1 landmark — dung hòa các tên field có thể khác nhau giữa các version BE. */
const normalizeLandmark = (item) => {
    if (item == null) return null;
    const audiosRaw = Array.isArray(item?.audios) ? item.audios : [];
    return {
        id: String(pick(item, ["id", "landmarkId"], "")),
        landmarkName: pick(item, ["landmarkName", "name"], ""),
        latitude: Number(pick(item, ["latitude", "lat"], 0)) || 0,
        longitude: Number(pick(item, ["longitude", "lng", "lon"], 0)) || 0,
        description: pick(item, ["description"], ""),
        displayOrder: Number(pick(item, ["displayOrder"], 0)) || 0,
        triggerRadiusMeters: Number(pick(item, ["triggerRadiusMeters"], 300)) || 300,
        isActive: item?.isActive !== false,
        audios: audiosRaw.map(normalizeLandmarkAudio).filter(Boolean),
        createdAt: pick(item, ["createdAt"], ""),
    };
};

/** Lấy toàn bộ danh sách landmark (admin) — kèm audio đã bake theo từng giọng. */
export const fetchAllLandmarks = async () => {
    try {
        const data = await apiGetLandmarksAdmin();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        return list.map(normalizeLandmark).filter(Boolean);
    } catch (error) {
        console.error("Lỗi khi lấy danh sách landmark:", error);
        throw error;
    }
};

/** Lấy chi tiết 1 landmark theo id (không có API riêng — lọc từ danh sách admin). */
export const fetchLandmarkDetail = async (landmarkId) => {
    const landmarks = await fetchAllLandmarks();
    const found = landmarks.find((item) => String(item.id) === String(landmarkId));
    if (!found) {
        const error = new Error("Landmark not found");
        error.response = { status: 404 };
        throw error;
    }
    return found;
};

/** Tạo landmark mới. */
export const addNewLandmark = async (landmarkPayload) => {
    try {
        return await apiCreateLandmark(landmarkPayload);
    } catch (error) {
        console.error("Lỗi khi tạo landmark mới:", error);
        throw error;
    }
};

/** Cập nhật landmark — full replace (không đụng tới audios). */
export const modifyLandmark = async (landmarkId, landmarkPayload) => {
    try {
        return await apiUpdateLandmark(landmarkId, landmarkPayload);
    } catch (error) {
        console.error(`Lỗi khi cập nhật landmark ${landmarkId}:`, error);
        throw error;
    }
};

/** Xóa landmark (cascade xóa audio). */
export const removeLandmark = async (landmarkId) => {
    try {
        return await apiDeleteLandmark(landmarkId);
    } catch (error) {
        console.error(`Lỗi khi xóa landmark ${landmarkId}:`, error);
        throw error;
    }
};

/** Upsert audio pre-bake cho landmark theo giọng (voiceId). */
export const saveLandmarkAudio = async (landmarkId, audioPayload) => {
    try {
        return await apiUpsertLandmarkAudio(landmarkId, audioPayload);
    } catch (error) {
        console.error(`Lỗi khi lưu audio cho landmark ${landmarkId}:`, error);
        throw error;
    }
};

/** Xóa 1 audio cụ thể của landmark. */
export const removeLandmarkAudio = async (audioId) => {
    try {
        return await apiDeleteLandmarkAudio(audioId);
    } catch (error) {
        console.error(`Lỗi khi xóa audio ${audioId}:`, error);
        throw error;
    }
};
