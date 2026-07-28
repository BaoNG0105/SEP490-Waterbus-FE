import api from './axios';

// Api chat với trợ lý ảo Saigon Waterbus. `messages` là toàn bộ lịch sử hội thoại,
// mỗi phần tử dạng { role: 'user' | 'assistant', text }.
export const chatWithAssistant = (messages) =>
    api.post('/assistant/chat', { messages }, { skipAuth: true }).then(r => r.data);
