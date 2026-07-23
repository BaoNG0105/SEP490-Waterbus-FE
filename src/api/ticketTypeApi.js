import api from './axios';

// API: Danh sách loại vé (ADULT/INFANT/SENIOR/DISABLED...) kèm hệ số giá priceModifier
// và allowedSeatTypeCodes. FE preview giá cuối: finalPrice = seat.basePrice * priceModifier.
export const getTicketTypes = () =>
    api.get('/ticket-types').then(response => response.data);
