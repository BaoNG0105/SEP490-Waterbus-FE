import {
    getInsurancePackages as apiGetInsurancePackages,
    createInsurancePackage as apiCreateInsurancePackage,
    updateInsurancePackage as apiUpdateInsurancePackage,
    updateInsurancePackageStatus as apiUpdateInsurancePackageStatus,
    deleteInsurancePackage as apiDeleteInsurancePackage,
} from '../api/insuranceApi';

export const INSURANCE_BOOKING_TYPES = {
    CHARTER: 'CharterBooking',
    SEAT: 'SeatBooking',
};

const normalizeBookingType = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return INSURANCE_BOOKING_TYPES.CHARTER;
    if (['SeatBooking', 'TicketBooking', 'seat', 'ticket'].includes(raw)) {
        return INSURANCE_BOOKING_TYPES.SEAT;
    }
    if (['CharterBooking', 'charter'].includes(raw)) {
        return INSURANCE_BOOKING_TYPES.CHARTER;
    }
    return raw;
};

const normalizeStatus = (pkg) => {
    const rawStatus = pkg?.status ?? pkg?.Status;
    if (typeof rawStatus === 'string' && rawStatus.trim()) {
        const normalized = rawStatus.trim().toLowerCase();
        if (['active', 'enabled', 'on'].includes(normalized)) return 'Active';
        if (['inactive', 'disabled', 'off'].includes(normalized)) return 'Inactive';
        return rawStatus;
    }
    if (pkg?.isActive === false) return 'Inactive';
    return 'Active';
};

const normalizeInsurancePackage = (pkg) => {
    const id = pkg?.id ?? pkg?.insurancePackageId ?? pkg?.code ?? null;
    const status = normalizeStatus(pkg);
    return {
        ...pkg,
        id,
        bookingType: normalizeBookingType(pkg?.bookingType),
        status,
        isActive: status === 'Active',
        displayOrder: Number(pkg?.displayOrder ?? 0) || 0,
        unitPremiumAmount: Number(pkg?.unitPremiumAmount) || 0,
        coverageAmount: Number(pkg?.coverageAmount) || 0,
        isRequired: Boolean(pkg?.isRequired),
    };
};

export const getInsurancePackageId = (pkg) => {
    const id = pkg?.id ?? pkg?.insurancePackageId ?? pkg?.code;
    return id == null ? null : String(id);
};

export const isSameInsurancePackageId = (leftId, rightId) => {
    if (leftId == null || rightId == null) return false;
    return String(leftId) === String(rightId);
};

export const findInsurancePackageById = (packages = [], packageId) => (
    packages.find((pkg) => isSameInsurancePackageId(getInsurancePackageId(pkg), packageId)) || null
);

export const fetchInsurancePackages = async (params = {}) => {
    try {
        const query = { ...params };
        if (query.bookingType) {
            query.bookingType = normalizeBookingType(query.bookingType);
        }
        const data = await apiGetInsurancePackages(query);
        const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
        return list.map(normalizeInsurancePackage);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách gói bảo hiểm:', error);
        throw error;
    }
};

export const addInsurancePackage = async (payload) => {
    try {
        return await apiCreateInsurancePackage({
            ...payload,
            bookingType: normalizeBookingType(payload?.bookingType),
        });
    } catch (error) {
        console.error('Lỗi khi tạo gói bảo hiểm:', error);
        throw error;
    }
};

export const modifyInsurancePackage = async (id, payload) => {
    try {
        return await apiUpdateInsurancePackage(id, {
            ...payload,
            bookingType: normalizeBookingType(payload?.bookingType),
        });
    } catch (error) {
        console.error(`Lỗi khi cập nhật gói bảo hiểm ${id}:`, error);
        throw error;
    }
};

export const changeInsurancePackageStatus = async (id, status) => {
    try {
        return await apiUpdateInsurancePackageStatus(id, { status });
    } catch (error) {
        console.error(`Lỗi khi đổi trạng thái gói bảo hiểm ${id}:`, error);
        throw error;
    }
};

export const removeInsurancePackage = async (id) => {
    try {
        return await apiDeleteInsurancePackage(id);
    } catch (error) {
        console.error(`Lỗi khi xóa gói bảo hiểm ${id}:`, error);
        throw error;
    }
};

// Lấy tất cả gói bảo hiểm active theo bookingType
export const fetchActiveInsurancePackages = async (bookingType) => {
    const packages = await fetchInsurancePackages({
        bookingType: normalizeBookingType(bookingType),
        activeOnly: true,
    });
    return packages
        .filter((pkg) => pkg.isActive !== false)
        .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0));
};

export const fetchActiveInsurancePackage = async (bookingType) => {
    const activePackages = await fetchActiveInsurancePackages(bookingType);
    return activePackages[0] || null;
};
