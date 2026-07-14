import {
    getTrips as apiGetTrips,
    createTrip as apiCreateTrip,
} from '../api/tripApi';

export const TRIP_STATUS_OPTIONS = ['Scheduled', 'Boarding', 'Departed', 'Arrived', 'Cancelled'];
export const TRIP_TYPE_OPTIONS = ['Regular', 'Charter'];
export const ROUTE_TYPE_OPTIONS = ['Regular', 'SightseeingLoop', 'CharterReference'];
export const SEAT_TYPE_OPTIONS = ['STANDARD', 'CABIN', 'SKY', 'RIVER'];

// input[type=date] "YYYY-MM-DD" -> "dd/MM/yyyy" (định dạng operatingDate BE yêu cầu)
export const toDdMmYyyy = (yyyyMmDd) => {
    if (!yyyyMmDd) return null;
    const [y, m, d] = String(yyyyMmDd).split('-');
    if (!y || !m || !d) return null;
    return `${d}/${m}/${y}`;
};

// input[type=datetime-local] "YYYY-MM-DDTHH:mm" -> ISO kèm offset +07:00 (định dạng departureTime BE yêu cầu)
export const toIsoWithOffset = (datetimeLocalValue) => {
    if (!datetimeLocalValue) return null;
    return `${datetimeLocalValue}:00+07:00`;
};

// Service: Tải danh sách chuyến tàu theo bộ lọc (operatingDate/routeCode/status/tripType/routeType — optional)
export const fetchAllTrips = async (params = {}) => {
    try {
        const data = await apiGetTrips(params);
        return data || [];
    } catch (error) {
        console.error('Lỗi khi lấy danh sách chuyến tàu từ Service:', error);
        throw error;
    }
};

// Chuẩn hoá form tạo chuyến tàu thành payload gửi BE
export const buildTripPayload = (form) => ({
    routeCode: String(form.routeCode || '').trim(),
    boatCode: String(form.boatCode || '').trim(),
    operatingDate: toDdMmYyyy(form.operatingDate),
    departureTime: toIsoWithOffset(form.departureTime),
    seatTypePrices: (form.seatTypePrices || [])
        .filter((p) => p.seatTypeCode && p.price !== '' && p.price !== null && p.price !== undefined)
        .map((p) => ({ seatTypeCode: p.seatTypeCode, price: Number(p.price) })),
});

// Service: Tạo chuyến tàu mới
export const addNewTrip = async (payload) => {
    try {
        return await apiCreateTrip(payload);
    } catch (error) {
        console.error('Lỗi khi tạo chuyến tàu mới:', error);
        throw error;
    }
};
