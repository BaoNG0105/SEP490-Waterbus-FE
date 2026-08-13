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

// ===================== Admin: quản lý system prompt của trợ lý =====================
// Quyền: Admin. Response GET/PUT/restore/reset luôn cùng 1 shape — trạng thái prompt
// SAU thao tác — nên FE dùng chung 1 setter cho cả 4 API này.

/** GET /assistant/prompt — Đọc system prompt đang có hiệu lực + lịch sử version. */
export const getAssistantPromptAdmin = () =>
    api.get('/assistant/prompt').then(r => r.data);

/** PUT /assistant/prompt — Full replace nội dung prompt. Có hiệu lực ngay, không cần deploy. */
export const updateAssistantPromptAdmin = (content) =>
    api.put('/assistant/prompt', { content }).then(r => r.data);

/** POST /assistant/prompt/restore/{versionId} — Quay lại một bản đã lưu (versionId lấy từ versions[].id). */
export const restoreAssistantPromptAdmin = (versionId) =>
    api.post(`/assistant/prompt/restore/${encodeURIComponent(versionId)}`).then(r => r.data);

/** POST /assistant/prompt/reset — Về bản gốc trong code (source "builtin"). Idempotent. */
export const resetAssistantPromptAdmin = () =>
    api.post('/assistant/prompt/reset').then(r => r.data);

/**
 * POST /assistant/prompt/preview — Chạy thử 1 lượt LLM với prompt NHẬP VÀO (chưa lưu).
 * Không lưu hội thoại, không ghi file, không đổi prompt đang chạy.
 * Rate limit riêng 5 lượt/300s cho admin hiện tại — vượt thì BE trả 429.
 */
export const previewAssistantPromptAdmin = ({ content, question, language, withTools }) =>
    api.post('/assistant/prompt/preview', { content, question, language, withTools }).then(r => r.data);
