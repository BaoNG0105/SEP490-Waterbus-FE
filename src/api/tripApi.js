import api from './axios';

// API: Danh sách chuyến tàu (query params: operatingDate dd/MM/yyyy, routeCode, status, tripType, routeType — tất cả optional)
export const getTrips = (params) =>
    api.get('/trips', { params }).then(response => response.data);

// API: Tạo chuyến tàu mới (routeCode, boatCode, operatingDate, departureTime bắt buộc; seatTypePrices optional)
export const createTrip = (data) =>
    api.post('/trips', data).then(response => response.data);

// API: Tìm chuyến tàu bán vé lẻ theo bến đi/bến đến/ngày (params: fromStationId, toStationId, operatingDate dd/MM/yyyy, routeType optional)
export const searchTrips = (params) =>
    api.get('/trips/search', { params }).then(response => response.data);

// API: Chi tiết 1 chuyến tàu kèm danh sách bến dừng (trip_stops)
export const getTripById = (id) =>
    api.get(`/trips/${id}`).then(response => response.data);

// API: Sơ đồ ghế của 1 chuyến tàu (kèm trạng thái theo chuyến)
export const getTripSeats = (id) =>
    api.get(`/trips/${id}/seats`).then(response => response.data);
