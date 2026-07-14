import api from './axios';

/** Tra cứu vé theo mã / QR token — chưa enforce rule ca bến/tàu */
export const scanTicketByCode = (codeOrToken) =>
    api
        .get(`/tickets/scan/${encodeURIComponent(String(codeOrToken || '').trim())}`)
        .then((response) => response.data);

export const checkInTicket = (codeOrToken) =>
    api
        .post(`/tickets/check-in/${encodeURIComponent(String(codeOrToken || '').trim())}`)
        .then((response) => response.data);

export const checkOutTicket = (codeOrToken) =>
    api
        .post(`/tickets/check-out/${encodeURIComponent(String(codeOrToken || '').trim())}`)
        .then((response) => response.data);
