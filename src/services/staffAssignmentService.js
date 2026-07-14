import {
    getStaffAssignments as apiGetStaffAssignments,
    getMyStaffAssignments as apiGetMyStaffAssignments,
    createStaffAssignment as apiCreateStaffAssignment,
    deleteStaffAssignment as apiDeleteStaffAssignment,
} from '../api/staffAssignmentApi';
import { getStaffMeAssignments as apiGetStaffMeAssignments } from '../api/staffMeApi';

export const ASSIGNMENT_TYPE = {
    BOAT: 'Boat',
    STATION: 'Station',
};

/** DB status — chỉ Scheduled | Cancelled (không set Active/Completed tay) */
export const ASSIGNMENT_STATUS = {
    SCHEDULED: 'Scheduled',
    CANCELLED: 'Cancelled',
};

/** BE tính theo startAt/endAt — không lưu DB / không PATCH */
export const SHIFT_STATE = {
    UPCOMING: 'Upcoming',
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
};

export const DUTY_ROLE = {
    ON_BOARD: 'OnBoard',
    GATE: 'Gate',
};

const pick = (source, keys, fallback = '') => {
    for (const key of keys) {
        const value = key.split('.').reduce((obj, part) => obj?.[part], source);
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
};

const extractRows = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
};

const normalizeNestedBoat = (item) => {
    const boat = item?.boat || {};
    const boatId = String(pick(item, ['boatId', 'boat.boatId', 'boat.id'], '') || pick(boat, ['boatId', 'id'], ''));
    if (!boatId && !boat.boatCode && !boat.boatName) return null;
    return {
        boatId,
        boatCode: pick(boat, ['boatCode', 'code'], '') || pick(item, ['boatCode'], ''),
        boatName: pick(boat, ['boatName', 'name'], '') || pick(item, ['boatName'], ''),
    };
};

const normalizeNestedStation = (item) => {
    const station = item?.station || {};
    const stationId = String(
        pick(item, ['stationId', 'station.stationId', 'station.id'], '') ||
            pick(station, ['stationId', 'id'], '')
    );
    if (!stationId && !station.stationCode && !station.stationName) return null;
    return {
        stationId,
        stationCode: pick(station, ['stationCode', 'code'], '') || pick(item, ['stationCode'], ''),
        stationName: pick(station, ['stationName', 'name'], '') || pick(item, ['stationName'], ''),
    };
};

/** Fallback khi BE chưa trả shiftState */
export const deriveShiftState = (startAt, endAt, status, now = new Date()) => {
    if (String(status) === ASSIGNMENT_STATUS.CANCELLED) return null;
    const start = startAt ? new Date(startAt) : null;
    const end = endAt ? new Date(endAt) : null;
    if (!start || Number.isNaN(start.getTime())) return SHIFT_STATE.UPCOMING;
    if (now < start) return SHIFT_STATE.UPCOMING;
    if (end && !Number.isNaN(end.getTime()) && now > end) return SHIFT_STATE.COMPLETED;
    return SHIFT_STATE.ACTIVE;
};

export const resolveShiftState = (row, now = new Date()) => {
    if (!row || row.status === ASSIGNMENT_STATUS.CANCELLED) return null;
    const fromApi = String(row.shiftState || '').trim();
    if (
        fromApi === SHIFT_STATE.ACTIVE ||
        fromApi === SHIFT_STATE.COMPLETED ||
        fromApi === SHIFT_STATE.UPCOMING
    ) {
        return fromApi;
    }
    // BE có thể trả Active/Completed với casing khác
    const lower = fromApi.toLowerCase();
    if (lower === 'active') return SHIFT_STATE.ACTIVE;
    if (lower === 'completed') return SHIFT_STATE.COMPLETED;
    if (lower === 'upcoming' || lower === 'scheduled') return SHIFT_STATE.UPCOMING;
    return deriveShiftState(row.startAt, row.endAt, row.status, now);
};

export const normalizeStaffAssignment = (item) => {
    if (!item) return null;
    const assignmentType = String(pick(item, ['assignmentType'], ASSIGNMENT_TYPE.BOAT));
    const status = pick(item, ['status'], ASSIGNMENT_STATUS.SCHEDULED);
    const startAt = pick(item, ['startAt'], '') || null;
    const endAt = pick(item, ['endAt'], '') || null;
    const shiftStateRaw = pick(item, ['shiftState'], '') || null;
    const row = {
        assignmentId: String(pick(item, ['assignmentId', 'id'], '')),
        staffUserId: String(pick(item, ['staffUserId', 'staff.id', 'staffId'], '')),
        staffName: pick(item, ['staffName', 'staff.fullName', 'staff.name', 'fullName'], '—'),
        staffType: pick(item, ['staffType', 'staff.staffType'], ''),
        assignmentType,
        workingDate: pick(item, ['workingDate'], '') || null,
        startAt,
        endAt,
        status,
        shiftState: shiftStateRaw,
        dutyRole: pick(item, ['dutyRole'], '') || null,
        note: pick(item, ['note'], '') || '',
        boat: assignmentType === ASSIGNMENT_TYPE.BOAT ? normalizeNestedBoat(item) : null,
        station: assignmentType === ASSIGNMENT_TYPE.STATION ? normalizeNestedStation(item) : null,
        assignedByUserId: String(pick(item, ['assignedByUserId'], '') || ''),
        assignedByName: pick(item, ['assignedByName'], '') || '',
        assignedAt: pick(item, ['assignedAt'], '') || null,
        raw: item,
    };
    row.resolvedShiftState = resolveShiftState(row);
    return row;
};

/** datetime-local → ISO +07:00 */
export const toIsoWithOffset = (datetimeLocalValue) => {
    if (!datetimeLocalValue) return null;
    return `${datetimeLocalValue}:00+07:00`;
};

export const buildCreateAssignmentPayload = (form) => {
    const assignmentType = form.assignmentType || ASSIGNMENT_TYPE.BOAT;
    const isBoat = assignmentType === ASSIGNMENT_TYPE.BOAT;

    const payload = {
        staffUserId: String(form.staffUserId || '').trim(),
        assignmentType,
        startAt: toIsoWithOffset(form.startAt),
        endAt: toIsoWithOffset(form.endAt),
        dutyRole: isBoat ? DUTY_ROLE.ON_BOARD : DUTY_ROLE.GATE,
        note: String(form.note || '').trim() || null,
    };

    if (isBoat) {
        payload.boatId = String(form.boatId || '').trim();
    } else {
        payload.stationId = String(form.stationId || '').trim();
    }

    return payload;
};

export const validateCreateAssignmentForm = (form, lang = 'VN') => {
    if (!form.staffUserId) {
        return lang === 'VN' ? 'Chọn nhân viên.' : 'Select a staff member.';
    }
    if (!form.startAt || !form.endAt) {
        return lang === 'VN' ? 'startAt và endAt bắt buộc.' : 'startAt and endAt are required.';
    }
    if (form.endAt <= form.startAt) {
        return lang === 'VN' ? 'endAt phải sau startAt.' : 'endAt must be after startAt.';
    }

    if (form.assignmentType === ASSIGNMENT_TYPE.BOAT) {
        if (!form.boatId) return lang === 'VN' ? 'Chọn tàu (boatId bắt buộc).' : 'Select a boat (boatId required).';
    } else if (form.assignmentType === ASSIGNMENT_TYPE.STATION) {
        if (!form.stationId) {
            return lang === 'VN' ? 'Chọn bến (stationId bắt buộc).' : 'Select a station (stationId required).';
        }
    } else {
        return lang === 'VN' ? 'Loại phân công không hợp lệ.' : 'Invalid assignment type.';
    }

    return null;
};

export const fetchStaffAssignments = async (params = {}) => {
    try {
        const cleaned = {};
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value === '' || value === null || value === undefined || value === 'All') return;
            cleaned[key] = value;
        });
        const data = await apiGetStaffAssignments(cleaned);
        return extractRows(data).map(normalizeStaffAssignment).filter(Boolean);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách phân công staff:', error);
        throw error;
    }
};

/**
 * Staff/Manager nhận lịch của chính mình.
 * Ưu tiên GET /staff/me/assignments (spec Staff), rồi /staff-assignments/mine, rồi list.
 */
export const fetchMyStaffAssignments = async ({ fromDate, toDate, status, staffUserId } = {}) => {
    const rangeParams = {};
    if (fromDate) rangeParams.fromDate = fromDate;
    if (toDate) rangeParams.toDate = toDate;
    if (status && status !== 'All') rangeParams.status = status;

    const normalize = (data) => extractRows(data).map(normalizeStaffAssignment).filter(Boolean);
    const onlyMine = (rows) => {
        if (!staffUserId) return rows;
        return rows.filter((row) => String(row.staffUserId) === String(staffUserId));
    };

    try {
        const data = await apiGetStaffMeAssignments(rangeParams);
        return onlyMine(normalize(data));
    } catch {
        // fallback bên dưới
    }

    try {
        const data = await apiGetMyStaffAssignments(rangeParams);
        return onlyMine(normalize(data));
    } catch (mineError) {
        try {
            const data = await apiGetStaffAssignments(rangeParams);
            return onlyMine(normalize(data));
        } catch (listError) {
            if (staffUserId) {
                try {
                    const data = await apiGetStaffAssignments({ ...rangeParams, staffUserId });
                    return onlyMine(normalize(data));
                } catch (withIdError) {
                    console.error('Lỗi khi lấy ca của tôi:', withIdError);
                    throw withIdError;
                }
            }
            console.error('Lỗi khi lấy ca của tôi:', listError);
            throw listError;
        }
    }
};

export const addStaffAssignment = async (payload) => {
    try {
        return await apiCreateStaffAssignment(payload);
    } catch (error) {
        console.error('Lỗi khi tạo phân công staff:', error);
        throw error;
    }
};

export const cancelStaffAssignment = async (assignmentId) => {
    try {
        return await apiDeleteStaffAssignment(assignmentId);
    } catch (error) {
        console.error(`Lỗi khi hủy phân công ${assignmentId}:`, error);
        throw error;
    }
};

/** Nhãn hiển thị theo ngôn ngữ UI (giá trị API giữ nguyên) */
export const labelAssignmentStatus = (status, lang = 'EN') => {
    const isVn = lang === 'VN';
    switch (status) {
        case ASSIGNMENT_STATUS.SCHEDULED:
            return isVn ? 'Đã xếp lịch' : 'Scheduled';
        case ASSIGNMENT_STATUS.CANCELLED:
            return isVn ? 'Đã hủy' : 'Cancelled';
        default:
            return status || '—';
    }
};

export const labelShiftState = (state, lang = 'EN') => {
    if (!state) return '—';
    const isVn = lang === 'VN';
    switch (state) {
        case SHIFT_STATE.UPCOMING:
            return isVn ? 'Sắp tới' : 'Upcoming';
        case SHIFT_STATE.ACTIVE:
            return isVn ? 'Đang diễn ra' : 'Active';
        case SHIFT_STATE.COMPLETED:
            return isVn ? 'Đã kết thúc' : 'Completed';
        default:
            return state;
    }
};

export const labelAssignmentType = (type, lang = 'EN') => {
    const isVn = lang === 'VN';
    if (type === ASSIGNMENT_TYPE.BOAT) return isVn ? 'Tàu' : 'Boat';
    if (type === ASSIGNMENT_TYPE.STATION) return isVn ? 'Bến' : 'Station';
    return type || '—';
};
