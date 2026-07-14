import api from './axios';

// API: Danh sách chuyến tàu (query params: operatingDate dd/MM/yyyy, routeCode, status, tripType, routeType — tất cả optional)
export const getTrips = (params) =>
    api.get('/trips', { params }).then(response => response.data);

// API: Tạo chuyến tàu mới (routeCode, boatCode, operatingDate, departureTime bắt buộc; seatTypePrices optional)
export const createTrip = (data) =>
    api.post('/trips', data).then(response => response.data);
