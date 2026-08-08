import api from './axios';

// Api chat với trợ lý ảo Saigon Waterbus. `messages` là toàn bộ lịch sử hội thoại,
// mỗi phần tử dạng { role: 'user' | 'assistant', text }. `language` (optional): 'VN' | 'ENG'.
export const chatWithAssistant = (messages, language, conversationId, clientSessionId, bookingDraft) =>
    api.post('/assistant/chat', {
        messages,
        language,
        conversationId,
        clientSessionId,
        ...(bookingDraft === undefined ? {} : { bookingDraft }),
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
