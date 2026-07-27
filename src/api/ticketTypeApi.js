import api from './axios';

// API: Danh sách loại vé (ADULT/INFANT/SENIOR/DISABLED...) kèm hệ số giá priceModifier
// / sightseeingPriceModifier và allowedSeatTypeCodes.
// Preview: finalPrice = seat.basePrice * modifier (theo routeType).
export const getTicketTypes = () =>
    api.get('/ticket-types').then(response => response.data);

/** GET /api/ticket-types/fare-rules — bảng hệ số giá theo loại vé × loại tuyến. */
export const getTicketFareRules = () =>
    api.get('/ticket-types/fare-rules').then((response) => response.data);

/** PUT /api/ticket-types/fare-rules — upsert 1 rule (ticketTypeCode + routeType). */
export const putTicketFareRule = (payload) =>
    api.put('/ticket-types/fare-rules', payload).then((response) => response.data);

/** GET /api/ticket-types/sightseeing-concession — % giảm nhóm ưu đãi tuyến tham quan. */
export const getSightseeingConcession = () =>
    api.get('/ticket-types/sightseeing-concession').then((response) => response.data);

/** PUT /api/ticket-types/sightseeing-concession — body { discountPercent }. */
export const putSightseeingConcession = (discountPercent) =>
    api
        .put('/ticket-types/sightseeing-concession', { discountPercent })
        .then((response) => response.data);
