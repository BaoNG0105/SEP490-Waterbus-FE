import {
    getPromotions as apiGetPromotions,
    createPromotion as apiCreatePromotion,
    updatePromotion as apiUpdatePromotion,
    deletePromotion as apiDeletePromotion,
    validatePromotion as apiValidatePromotion,
} from '../api/promotionApi';

export const PROMOTION_TYPE = {
    PERCENT: 'Percent',
    FIXED: 'Fixed',
};

export const PROMOTION_USAGE_POLICY = {
    MULTIPLE: 'MultiplePerAccount',
    ONCE: 'OncePerAccount',
};

export const PROMOTION_STATUS = {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
};

const extractRows = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
};

const normalizePromotion = (item) => {
    if (!item) return null;
    return {
        ...item,
        id: String(item.id ?? item.promotionId ?? ''),
        promotionCode: item.promotionCode || '',
        promotionName: item.promotionName || '',
        promotionType: item.promotionType || PROMOTION_TYPE.PERCENT,
        discountValue: Number(item.discountValue) || 0,
        minOrderValue: item.minOrderValue === null || item.minOrderValue === undefined ? null : Number(item.minOrderValue),
        validFrom: item.validFrom || null,
        validTo: item.validTo || null,
        usageLimit: item.usageLimit === null || item.usageLimit === undefined ? null : Number(item.usageLimit),
        usageCount: Number(item.usageCount ?? item.usedCount ?? 0) || 0,
        accountUsagePolicy: item.accountUsagePolicy || PROMOTION_USAGE_POLICY.MULTIPLE,
        status: item.status || PROMOTION_STATUS.ACTIVE,
    };
};

// Service: Tải danh sách khuyến mãi
export const fetchPromotions = async (params = {}) => {
    try {
        const data = await apiGetPromotions(params);
        return extractRows(data).map(normalizePromotion).filter(Boolean);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách khuyến mãi từ Service:', error);
        throw error;
    }
};

// Service: Tạo khuyến mãi mới
export const addPromotion = async (payload) => {
    try {
        return await apiCreatePromotion(payload);
    } catch (error) {
        console.error('Lỗi khi tạo khuyến mãi:', error);
        throw error;
    }
};

// Service: Cập nhật khuyến mãi
export const modifyPromotion = async (id, payload) => {
    try {
        return await apiUpdatePromotion(id, payload);
    } catch (error) {
        console.error(`Lỗi khi cập nhật khuyến mãi ${id}:`, error);
        throw error;
    }
};

// Service: Vô hiệu hóa khuyến mãi (soft delete)
export const removePromotion = async (id) => {
    try {
        return await apiDeletePromotion(id);
    } catch (error) {
        console.error(`Lỗi khi vô hiệu hóa khuyến mãi ${id}:`, error);
        throw error;
    }
};

// Service: Kiểm tra mã khuyến mãi
export const checkPromotionCode = async (code, subtotalAmount) => {
    try {
        return await apiValidatePromotion(code, subtotalAmount);
    } catch (error) {
        console.error(`Lỗi khi kiểm tra mã khuyến mãi ${code}:`, error);
        throw error;
    }
};
