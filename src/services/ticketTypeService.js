import { getTicketTypes as apiGetTicketTypes } from '../api/ticketTypeApi';

// Fallback khi API lỗi/chưa có — theo contract BE hiện tại: ADULT x1, còn lại x0 (miễn phí).
export const DEFAULT_TICKET_TYPES = [
    { code: 'ADULT', name: 'Người lớn', priceModifier: 1, allowedSeatTypeCodes: null },
    { code: 'SENIOR', name: 'Người cao tuổi', priceModifier: 0, allowedSeatTypeCodes: null },
    { code: 'DISABLED', name: 'Người khuyết tật', priceModifier: 0, allowedSeatTypeCodes: null },
];

// BE trả field ticketTypeCode/ticketTypeName (swagger cũ ghi code/name) — nhận cả hai cho chắc.
const normalizeTicketType = (item) => ({
    code: String(item?.ticketTypeCode || item?.code || '').toUpperCase(),
    name: item?.ticketTypeName || item?.name || item?.ticketTypeCode || item?.code || '--',
    description: item?.description || '',
    priceModifier: Number(item?.priceModifier ?? 1),
    // null = ngồi được mọi loại ghế; ["STANDARD"] = chỉ được ghế Standard (SENIOR/DISABLED/INFANT)
    allowedSeatTypeCodes: Array.isArray(item?.allowedSeatTypeCodes)
        ? item.allowedSeatTypeCodes.map((c) => String(c).toUpperCase())
        : null,
});

// Service: Lấy danh sách loại vé từ BE (GET /api/ticket-types) để build dropdown và hệ số giá.
export const fetchTicketTypes = async () => {
    try {
        const data = await apiGetTicketTypes();
        let list = [];
        if (Array.isArray(data)) list = data;
        else if (Array.isArray(data?.items)) list = data.items;
        const normalized = list.map(normalizeTicketType).filter((t) => t.code);
        return normalized.length > 0 ? normalized : DEFAULT_TICKET_TYPES;
    } catch (error) {
        console.error('Lỗi khi lấy danh sách loại vé:', error);
        return DEFAULT_TICKET_TYPES;
    }
};
