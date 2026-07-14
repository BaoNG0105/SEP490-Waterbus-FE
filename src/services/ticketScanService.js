import {
    scanTicketByCode as apiScanTicket,
    checkInTicket as apiCheckInTicket,
    checkOutTicket as apiCheckOutTicket,
} from '../api/ticketScanApi';

const pick = (source, keys, fallback = '') => {
    for (const key of keys) {
        const value = key.split('.').reduce((obj, part) => obj?.[part], source);
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
};

export const normalizeScannedTicket = (item) => {
    if (!item) return null;
    const ticket = item.ticket || item;
    return {
        codeOrToken: String(pick(item, ['codeOrToken', 'qrToken', 'token'], '') || pick(ticket, ['qrToken', 'code', 'ticketCode'], '')),
        ticketCode: pick(ticket, ['ticketCode', 'code'], '') || pick(item, ['ticketCode', 'code'], ''),
        passengerName: pick(ticket, ['passengerName', 'fullName', 'name'], '') || pick(item, ['passengerName', 'fullName'], '—'),
        status: pick(ticket, ['status', 'ticketStatus', 'attendanceStatus'], '') || pick(item, ['status'], ''),
        tripCode: pick(item, ['tripCode', 'trip.code'], '') || pick(ticket, ['tripCode'], ''),
        routeName: pick(item, ['routeName', 'route.name'], '') || pick(ticket, ['routeName'], ''),
        boatName: pick(item, ['boatName', 'boat.boatName'], '') || pick(ticket, ['boatName'], ''),
        fromStation: pick(item, ['fromStationName', 'fromStation'], '') || pick(ticket, ['fromStationName'], ''),
        toStation: pick(item, ['toStationName', 'toStation'], '') || pick(ticket, ['toStationName'], ''),
        seatLabel: pick(ticket, ['seatLabel', 'seatCode', 'seat'], '') || pick(item, ['seatLabel'], ''),
        raw: item,
    };
};

/** Tra cứu vé — chưa kiểm tra ca hợp lệ bến/tàu (BE rule sau). */
export const scanTicket = async (codeOrToken) => {
    const trimmed = String(codeOrToken || '').trim();
    if (!trimmed) throw new Error('EMPTY_CODE');
    try {
        const data = await apiScanTicket(trimmed);
        return normalizeScannedTicket(data);
    } catch (error) {
        console.error('Lỗi scan vé:', error);
        throw error;
    }
};

export const checkInTicket = async (codeOrToken) => {
    const trimmed = String(codeOrToken || '').trim();
    if (!trimmed) throw new Error('EMPTY_CODE');
    try {
        return await apiCheckInTicket(trimmed);
    } catch (error) {
        console.error('Lỗi check-in vé:', error);
        throw error;
    }
};

export const checkOutTicket = async (codeOrToken) => {
    const trimmed = String(codeOrToken || '').trim();
    if (!trimmed) throw new Error('EMPTY_CODE');
    try {
        return await apiCheckOutTicket(trimmed);
    } catch (error) {
        console.error('Lỗi check-out vé:', error);
        throw error;
    }
};
