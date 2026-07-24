import {
    getPromotions as apiGetPromotions,
    getPublicPromotions as apiGetPublicPromotions,
    createPromotion as apiCreatePromotion,
    updatePromotion as apiUpdatePromotion,
    uploadPromotionImage as apiUploadPromotionImage,
    deletePromotion as apiDeletePromotion,
    validatePromotion as apiValidatePromotion,
} from '../api/promotionApi';

export const PROMOTION_TYPE = {
    PERCENT: 'Percent',
    FIXED: 'Fixed',
};

export const PROMOTION_STATUS = {
    DRAFT: 'Draft',
    ACTIVE: 'Active',
    PAUSED: 'Paused',
    ARCHIVED: 'Archived',
};

export const PROMOTION_VISIBILITY = {
    PUBLIC: 'Public',
    PRIVATE: 'Private',
};

export const PROMOTION_BOOKING_TYPES = {
    SEAT: 'SeatBooking',
    CHARTER: 'CharterBooking',
};

export const PROMOTION_DAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

const extractRows = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
};

const toNullablePositive = (value, enabled = true) => {
    if (!enabled) return null;
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
};

const toNullableNonNegative = (value, enabled = true) => {
    if (!enabled) return null;
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return num;
};

const normalizeScope = (scope) => {
    if (!scope) {
        return {
            bookingTypes: [],
            routeIds: [],
            daysOfWeek: [],
            departureFrom: '',
            departureTo: '',
        };
    }
    return {
        bookingTypes: Array.isArray(scope.bookingTypes) ? scope.bookingTypes.filter(Boolean) : [],
        routeIds: Array.isArray(scope.routeIds) ? scope.routeIds.map(String) : [],
        daysOfWeek: Array.isArray(scope.daysOfWeek) ? scope.daysOfWeek.filter(Boolean) : [],
        departureFrom: scope.departureFrom ? String(scope.departureFrom).slice(0, 5) : '',
        departureTo: scope.departureTo ? String(scope.departureTo).slice(0, 5) : '',
    };
};

export const normalizePromotion = (item) => {
    if (!item) return null;
    return {
        ...item,
        id: String(item.id ?? item.promotionId ?? ''),
        promotionCode: item.promotionCode || '',
        promotionName: item.promotionName || '',
        promotionType: item.promotionType || PROMOTION_TYPE.PERCENT,
        discountValue: Number(item.discountValue) || 0,
        maxDiscountAmount:
            item.maxDiscountAmount === null || item.maxDiscountAmount === undefined
                ? null
                : Number(item.maxDiscountAmount),
        minOrderValue:
            item.minOrderValue === null || item.minOrderValue === undefined
                ? null
                : Number(item.minOrderValue),
        validFrom: item.validFrom || null,
        validTo: item.validTo || null,
        usageLimit:
            item.usageLimit === null || item.usageLimit === undefined
                ? null
                : Number(item.usageLimit),
        usageCount: Number(item.usageCount ?? item.usedCount ?? 0) || 0,
        maxUsesPerAccount:
            item.maxUsesPerAccount === null || item.maxUsesPerAccount === undefined
                ? null
                : Number(item.maxUsesPerAccount),
        budgetCap:
            item.budgetCap === null || item.budgetCap === undefined
                ? null
                : Number(item.budgetCap),
        firstBookingOnly: !!item.firstBookingOnly,
        scope: normalizeScope(item.scope),
        visibility: item.visibility || PROMOTION_VISIBILITY.PUBLIC,
        status: item.status || PROMOTION_STATUS.DRAFT,
        description: item.description || '',
        imageUrl: item.imageUrl || '',
    };
};

export const toIsoWithOffset = (datetimeLocalValue) => {
    if (!datetimeLocalValue) return null;
    return `${datetimeLocalValue}:00+07:00`;
};

export const toDatetimeLocal = (isoValue) => {
    if (!isoValue) return '';
    return String(isoValue).slice(0, 16);
};

export const fromTimeSpan = (value) => {
    if (!value) return '';
    return String(value).slice(0, 5);
};

/** HH:mm — đúng spec BE (không gửi :ss) */
export const toHhMm = (value) => {
    if (!value) return null;
    const v = String(value).trim();
    if (!v) return null;
    return v.length >= 5 ? v.slice(0, 5) : v;
};

/** Chỉ Regular / SightseeingLoop được chọn trong promotion scope */
export const isRouteSelectableForPromotion = (route) => {
    const type = String(route?.routeType || '');
    return type === 'Regular' || type === 'SightseeingLoop';
};

export const getPromotionRouteKindLabel = (routeType, lang = 'VN') => {
    switch (routeType) {
        case 'Regular':
            return lang === 'VN' ? 'Tuyến booking' : 'Booking route';
        case 'SightseeingLoop':
            return lang === 'VN' ? 'Tour tham quan' : 'Sightseeing tour';
        case 'CharterReference':
            return lang === 'VN'
                ? 'Route nguồn GPS (không chọn)'
                : 'GPS source (not selectable)';
        case 'Charter':
            return lang === 'VN'
                ? 'Tuyến thuê riêng (không chọn)'
                : 'Charter route (not selectable)';
        default:
            return routeType || '—';
    }
};

const emptyToNullList = (list) => {
    if (!Array.isArray(list) || list.length === 0) return null;
    return list;
};

export const buildPromotionScope = (form) => {
    const bookingTypes = emptyToNullList(form.bookingTypes);
    const routeIds = emptyToNullList(form.routeIds);
    const daysOfWeek = emptyToNullList(form.daysOfWeek);
    const departureFrom = toHhMm(form.departureFrom);
    const departureTo = toHhMm(form.departureTo);

    const hasAny =
        bookingTypes ||
        routeIds ||
        daysOfWeek ||
        departureFrom ||
        departureTo;

    if (!hasAny) return null;

    return {
        bookingTypes,
        routeIds,
        daysOfWeek,
        departureFrom,
        departureTo,
    };
};

export const buildPromotionPayload = (form, { includeCode = true } = {}) => {
    const isPercent = form.promotionType === PROMOTION_TYPE.PERCENT;

    const payload = {
        promotionName: String(form.promotionName || '').trim(),
        promotionType: form.promotionType || PROMOTION_TYPE.PERCENT,
        discountValue: Number(form.discountValue) || 0,
        maxDiscountAmount: isPercent
            ? toNullablePositive(form.maxDiscountAmount, !!form.hasMaxDiscountAmount)
            : null,
        minOrderValue: toNullableNonNegative(form.minOrderValue, !!form.hasMinOrderValue),
        validFrom: toIsoWithOffset(form.validFrom),
        validTo: toIsoWithOffset(form.validTo),
        usageLimit: toNullablePositive(form.usageLimit, !!form.hasUsageLimit),
        maxUsesPerAccount: toNullablePositive(form.maxUsesPerAccount, !!form.hasMaxUsesPerAccount),
        budgetCap: toNullablePositive(form.budgetCap, !!form.hasBudgetCap),
        firstBookingOnly: !!form.firstBookingOnly,
        scope: buildPromotionScope(form),
        visibility: form.visibility || PROMOTION_VISIBILITY.PUBLIC,
        status: form.status || PROMOTION_STATUS.DRAFT,
        description: String(form.description || '').trim() || null,
    };

    if (includeCode) {
        payload.promotionCode = String(form.promotionCode || '').trim().toUpperCase();
    }

    return payload;
};

export const validatePromotionForm = (form, lang = 'VN', { isCreate = true } = {}) => {
    const code = String(form.promotionCode || '').trim();
    if (isCreate) {
        if (!code) return lang === 'VN' ? 'Mã khuyến mãi bắt buộc.' : 'Promotion code is required.';
        if (code.length > 50) return lang === 'VN' ? 'Mã tối đa 50 ký tự.' : 'Code max 50 characters.';
    }

    const name = String(form.promotionName || '').trim();
    if (!name) return lang === 'VN' ? 'Tên khuyến mãi bắt buộc.' : 'Promotion name is required.';
    if (name.length > 150) return lang === 'VN' ? 'Tên tối đa 150 ký tự.' : 'Name max 150 characters.';

    const desc = String(form.description || '');
    if (desc.length > 1000) {
        return lang === 'VN' ? 'Mô tả tối đa 1000 ký tự.' : 'Description max 1000 characters.';
    }

    const discount = Number(form.discountValue);
    if (!Number.isFinite(discount) || discount <= 0) {
        return lang === 'VN' ? 'Giá trị giảm phải > 0.' : 'Discount value must be > 0.';
    }
    if (form.promotionType === PROMOTION_TYPE.PERCENT && discount > 100) {
        return lang === 'VN' ? 'Phần trăm giảm không được > 100.' : 'Percent discount cannot exceed 100.';
    }

    if (!form.validFrom || !form.validTo) {
        return lang === 'VN' ? 'Hiệu lực từ/đến bắt buộc.' : 'Valid from/to are required.';
    }
    if (form.validTo <= form.validFrom) {
        return lang === 'VN' ? 'Ngày kết thúc phải sau ngày bắt đầu.' : 'validTo must be after validFrom.';
    }

    if (isCreate && form.status === PROMOTION_STATUS.ARCHIVED) {
        return lang === 'VN'
            ? 'Không tạo mới với trạng thái Archived.'
            : 'Cannot create with Archived status.';
    }

    const from = toHhMm(form.departureFrom);
    const to = toHhMm(form.departureTo);
    if (from && to && from > to) {
        return lang === 'VN'
            ? 'Giờ khởi hành từ phải ≤ giờ đến.'
            : 'departureFrom must be ≤ departureTo.';
    }

    if (form.imageFile) {
        const type = String(form.imageFile.type || '').toLowerCase();
        const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(type);
        if (!ok) {
            return lang === 'VN'
                ? 'Ảnh chỉ chấp nhận JPEG, PNG, WebP.'
                : 'Image must be JPEG, PNG, or WebP.';
        }
    }

    return null;
};

export const emptyPromotionForm = () => ({
    promotionCode: '',
    promotionName: '',
    promotionType: PROMOTION_TYPE.PERCENT,
    discountValue: '',
    hasMaxDiscountAmount: false,
    maxDiscountAmount: '',
    hasMinOrderValue: false,
    minOrderValue: '',
    validFrom: '',
    validTo: '',
    hasUsageLimit: false,
    usageLimit: '',
    hasMaxUsesPerAccount: false,
    maxUsesPerAccount: '',
    hasBudgetCap: false,
    budgetCap: '',
    firstBookingOnly: false,
    bookingTypes: [],
    routeIds: [],
    daysOfWeek: [],
    departureFrom: '',
    departureTo: '',
    visibility: PROMOTION_VISIBILITY.PUBLIC,
    status: PROMOTION_STATUS.DRAFT,
    description: '',
    imageFile: null,
    imagePreviewUrl: '',
});

export const formFromPromotion = (promo) => {
    const scope = promo?.scope || {};
    return {
        promotionCode: promo?.promotionCode || '',
        promotionName: promo?.promotionName || '',
        promotionType: promo?.promotionType || PROMOTION_TYPE.PERCENT,
        discountValue: promo?.discountValue ?? '',
        hasMaxDiscountAmount: promo?.maxDiscountAmount != null,
        maxDiscountAmount: promo?.maxDiscountAmount ?? '',
        hasMinOrderValue: promo?.minOrderValue != null,
        minOrderValue: promo?.minOrderValue ?? '',
        validFrom: toDatetimeLocal(promo?.validFrom),
        validTo: toDatetimeLocal(promo?.validTo),
        hasUsageLimit: promo?.usageLimit != null,
        usageLimit: promo?.usageLimit ?? '',
        hasMaxUsesPerAccount: promo?.maxUsesPerAccount != null,
        maxUsesPerAccount: promo?.maxUsesPerAccount ?? '',
        hasBudgetCap: promo?.budgetCap != null,
        budgetCap: promo?.budgetCap ?? '',
        firstBookingOnly: !!promo?.firstBookingOnly,
        bookingTypes: [...(scope.bookingTypes || [])],
        routeIds: [...(scope.routeIds || [])],
        daysOfWeek: [...(scope.daysOfWeek || [])],
        departureFrom: fromTimeSpan(scope.departureFrom),
        departureTo: fromTimeSpan(scope.departureTo),
        visibility: promo?.visibility || PROMOTION_VISIBILITY.PUBLIC,
        status: promo?.status || PROMOTION_STATUS.DRAFT,
        description: promo?.description || '',
        imageFile: null,
        imagePreviewUrl: promo?.imageUrl || '',
    };
};

export const extractPromotionId = (created) =>
    String(created?.id ?? created?.promotionId ?? created?.data?.id ?? created?.data?.promotionId ?? '');

export const fetchPromotions = async (params = {}) => {
    try {
        const data = await apiGetPromotions(params);
        return extractRows(data).map(normalizePromotion).filter(Boolean);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách khuyến mãi từ Service:', error);
        throw error;
    }
};

export const fetchPublicPromotions = async () => {
    try {
        const data = await apiGetPublicPromotions();
        return extractRows(data).map(normalizePromotion).filter(Boolean);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách khuyến mãi public:', error);
        throw error;
    }
};

export const addPromotion = async (payload) => {
    try {
        return await apiCreatePromotion(payload);
    } catch (error) {
        console.error('Lỗi khi tạo khuyến mãi:', error);
        throw error;
    }
};

export const modifyPromotion = async (id, payload) => {
    try {
        return await apiUpdatePromotion(id, payload);
    } catch (error) {
        console.error(`Lỗi khi cập nhật khuyến mãi ${id}:`, error);
        throw error;
    }
};

export const uploadPromotionImageFile = async (id, imageFile) => {
    try {
        return await apiUploadPromotionImage(id, imageFile);
    } catch (error) {
        console.error(`Lỗi khi upload ảnh khuyến mãi ${id}:`, error);
        throw error;
    }
};

export const removePromotion = async (id) => {
    try {
        return await apiDeletePromotion(id);
    } catch (error) {
        console.error(`Lỗi khi xóa khuyến mãi ${id}:`, error);
        throw error;
    }
};

export const checkPromotionCode = async (code, subtotalAmount) => {
    try {
        return await apiValidatePromotion(code, subtotalAmount);
    } catch (error) {
        console.error(`Lỗi khi kiểm tra mã khuyến mãi ${code}:`, error);
        throw error;
    }
};

/** Chuẩn hoá GET /promotions/validate để FE preview giảm giá trước PayOS. */
export const normalizePromotionValidateResult = (payload, subtotalAmount = 0) => {
    const raw = payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data)
        ? payload.data
        : payload;
    const subtotal = Math.max(0, Number(subtotalAmount) || 0);
    const explicitInvalid =
        raw?.isValid === false ||
        raw?.valid === false ||
        raw?.success === false ||
        payload?.success === false;
    const discountAmount = Math.max(
        0,
        Number(raw?.discountAmount ?? raw?.discount ?? raw?.amountOff ?? raw?.promotionDiscount ?? 0) || 0,
    );
    let finalAmount = Number(
        raw?.finalAmount ?? raw?.totalAfterDiscount ?? raw?.amountAfterDiscount ?? raw?.payableAmount,
    );
    if (!Number.isFinite(finalAmount)) {
        finalAmount = Math.max(0, subtotal - discountAmount);
    } else {
        finalAmount = Math.max(0, finalAmount);
    }
    const resolvedDiscount =
        discountAmount > 0 ? discountAmount : Math.max(0, Math.round(subtotal - finalAmount));
    const explicitValid =
        raw?.isValid === true ||
        raw?.valid === true ||
        raw?.success === true ||
        payload?.success === true;
    const ok = !explicitInvalid && (explicitValid || resolvedDiscount > 0 || finalAmount < subtotal);

    return {
        ok,
        discountAmount: resolvedDiscount,
        finalAmount: ok ? finalAmount : subtotal,
        baseAmount: subtotal,
        message:
            String(raw?.message || raw?.error || payload?.message || "").trim() ||
            (ok ? "Áp dụng mã thành công" : "Mã khuyến mãi không hợp lệ"),
        code: String(raw?.code || raw?.promotionCode || "").trim(),
    };
};
