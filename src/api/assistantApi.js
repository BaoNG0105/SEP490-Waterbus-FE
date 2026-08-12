import api from './axios';

// BE chỉ đọc đúng 12 trường này trong bookingDraft (mọi trường khác — departureTrips, passengers,
// contact, preview... — bị bỏ qua hoàn toàn nhưng vẫn tính vào hạn mức 64KB của request). Vì
// ChatBookingFlow giữ một object draft đầy đủ hơn nhiều để tự vẽ UI (danh sách chuyến, hành khách,
// preview giá...), nên phải cắt gọn trước khi gửi lên `/assistant/chat` để tránh vượt hạn mức khi
// khứ hồi có nhiều kết quả tìm chuyến. selectedDepartureTrip/selectedSeatsDeparture chỉ cần thể
// hiện sự tồn tại/số lượng vì BE không đọc nội dung của chúng.
const sanitizeBookingDraftForChat = (bookingDraft) => {
    if (!bookingDraft || typeof bookingDraft !== 'object') return bookingDraft ?? null;
    return {
        stage: bookingDraft.stage,
        serviceType: bookingDraft.serviceType,
        fromStationName: bookingDraft.fromStationName,
        toStationName: bookingDraft.toStationName,
        departureDate: bookingDraft.departureDate,
        isRoundTrip: bookingDraft.isRoundTrip,
        returnDate: bookingDraft.returnDate,
        adultCount: bookingDraft.adultCount,
        childCount: bookingDraft.childCount,
        infantCount: bookingDraft.infantCount,
        selectedDepartureTrip: bookingDraft.selectedDepartureTrip ? {} : null,
        selectedSeatsDeparture: Array.from({
            length: Array.isArray(bookingDraft.selectedSeatsDeparture) ? bookingDraft.selectedSeatsDeparture.length : 0,
        }),
    };
};

// Api chat với trợ lý ảo Saigon Waterbus. `messages` là toàn bộ lịch sử hội thoại,
// mỗi phần tử dạng { role: 'user' | 'assistant', text }. `language` (optional): 'VN' | 'ENG'.
export const chatWithAssistant = (messages, language, conversationId, clientSessionId, bookingDraft) =>
    api.post('/assistant/chat', {
        messages,
        language,
        conversationId,
        clientSessionId,
        ...(bookingDraft === undefined ? {} : { bookingDraft: sanitizeBookingDraftForChat(bookingDraft) }),
    }, { skipAuth: true }).then(r => r.data);

export const updateAssistantBookingDraft = (conversationId, bookingDraft, clientSessionId) =>
    api.put(`/assistant/conversations/${conversationId}/booking-draft`, {
        bookingDraft,
        clientSessionId,
    }, { skipAuth: true }).then(r => r.data);

export const getAssistantConversation = (conversationId, clientSessionId) =>
    api.get(`/assistant/conversations/${conversationId}`, {
        params: { clientSessionId },
        skipAuth: true,
    }).then(r => r.data);

export const closeAssistantConversation = (conversationId, clientSessionId) =>
    api.post(`/assistant/conversations/${conversationId}/close`, null, {
        params: { clientSessionId },
        skipAuth: true,
    }).then(r => r.data);
