import {
    getInsurancePackages as apiGetInsurancePackages,
    createInsurancePackage as apiCreateInsurancePackage,
    updateInsurancePackage as apiUpdateInsurancePackage,
    updateInsurancePackageStatus as apiUpdateInsurancePackageStatus,
    deleteInsurancePackage as apiDeleteInsurancePackage,
} from '../api/insuranceApi';

/** BE mới: 1 loại gói dùng chung mọi luồng booking. */
export const INSURANCE_BOOKING_TYPES = {
    PASSENGER: 'PassengerInsurance',
    /** Legacy — BE tạm còn nhận để FE cũ không vỡ. */
    CHARTER: 'CharterBooking',
    SEAT: 'SeatBooking',
};

const LEGACY_BOOKING_TYPES = new Set([
    INSURANCE_BOOKING_TYPES.SEAT,
    INSURANCE_BOOKING_TYPES.CHARTER,
    'TicketBooking',
]);

export const normalizeBookingType = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return INSURANCE_BOOKING_TYPES.PASSENGER;
    if (
        raw === INSURANCE_BOOKING_TYPES.PASSENGER
        || raw === 'Passenger'
        || raw === 'passenger'
        || raw === 'passengerInsurance'
    ) {
        return INSURANCE_BOOKING_TYPES.PASSENGER;
    }
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

const sortActivePackages = (packages) => (
    packages
        .filter((pkg) => pkg.isActive !== false)
        .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0))
);

/** Ưu tiên PassengerInsurance; lúc migrate còn nhận Seat/Charter legacy. */
const pickPassengerScopedPackages = (packages) => {
    const list = Array.isArray(packages) ? packages : [];
    const passenger = list.filter((pkg) => pkg.bookingType === INSURANCE_BOOKING_TYPES.PASSENGER);
    if (passenger.length) return passenger;
    return list.filter((pkg) => LEGACY_BOOKING_TYPES.has(pkg.bookingType));
};

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
            bookingType: INSURANCE_BOOKING_TYPES.PASSENGER,
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
            bookingType: INSURANCE_BOOKING_TYPES.PASSENGER,
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

/**
 * Gói Active dùng chung mọi booking.
 * 1) GET ?bookingType=PassengerInsurance
 * 2) Fallback GET all + lọc PassengerInsurance / legacy Seat|Charter
 */
export const fetchActiveInsurancePackages = async (bookingType = INSURANCE_BOOKING_TYPES.PASSENGER) => {
    const preferred = normalizeBookingType(bookingType) || INSURANCE_BOOKING_TYPES.PASSENGER;

    try {
        const preferredList = await fetchInsurancePackages({
            bookingType: preferred,
            activeOnly: true,
        });
        const preferredActive = sortActivePackages(preferredList);
        if (preferredActive.length) return preferredActive;
    } catch (error) {
        // BE chưa nhận PassengerInsurance → fallback list chung.
        if (preferred !== INSURANCE_BOOKING_TYPES.PASSENGER) throw error;
    }

    const all = await fetchInsurancePackages({ activeOnly: true });
    return sortActivePackages(pickPassengerScopedPackages(all));
};

export const fetchActiveInsurancePackage = async (bookingType) => {
    const activePackages = await fetchActiveInsurancePackages(bookingType);
    return activePackages[0] || null;
};
