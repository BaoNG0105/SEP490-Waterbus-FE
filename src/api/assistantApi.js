import api from './axios';

// Api chat với trợ lý ảo Saigon Waterbus. `messages` là toàn bộ lịch sử hội thoại,
// mỗi phần tử dạng { role: 'user' | 'assistant', text }. `language` (optional): 'VN' | 'ENG'.
export const chatWithAssistant = (messages, language) =>
    api.post('/assistant/chat', { messages, language }, { skipAuth: true }).then(r => r.data);
