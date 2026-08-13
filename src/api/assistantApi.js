import api from './axios';

// Api chat với trợ lý ảo Waterbus. `messages` là toàn bộ lịch sử hội thoại, mỗi phần tử dạng
// { text }. BE chỉ lấy phần tử CUỐI CÙNG có chữ làm câu hỏi hiện tại; lịch sử trước đó BE tự đọc
// lại từ DB theo conversationId nên không cần gửi lại. Không còn `role`/`language` — trợ lý tự bám
// theo ngôn ngữ khách đang gõ.
//
// `bookingDraft`: BE KHÔNG lưu draft giữa các lượt — response trả về bookingDraft ĐẦY ĐỦ đã merge
// sẵn (server tự kiểm tra/áp thay đổi của lượt đó), và cách dùng được khuyến nghị là client CHỈ
// echo nguyên khối lại y nguyên ở lượt sau: không tự merge, không đổi tên field, không rút gọn —
// server đã kiểm soát toàn bộ nội dung và biết hạn mức 64KB của chính nó. Vì vậy hàm này CHỈ
// truyền thẳng, không xử lý gì thêm.
export const chatWithAssistant = (messages, conversationId, clientSessionId, bookingDraft = null) =>
    api.post('/assistant/chat', {
        messages,
        conversationId,
        clientSessionId,
        bookingDraft,
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
