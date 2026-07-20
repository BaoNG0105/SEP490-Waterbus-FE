import api from './axios';

// Api lấy danh sách thông báo của user hiện tại (mới nhất trước, kèm totalCount/unreadCount)
export const getNotifications = (params = {}) =>
    api.get('/notifications', { params }).then(r => r.data);

// Api lấy số thông báo chưa đọc (dùng để vẽ badge chuông)
export const getUnreadNotificationCount = () =>
    api.get('/notifications/unread-count').then(r => r.data);

// Api đánh dấu đã đọc một thông báo
export const markNotificationAsRead = (id) =>
    api.post(`/notifications/${id}/read`).then(r => r.data);

// Api đánh dấu đã đọc tất cả thông báo, trả về markedCount
export const markAllNotificationsAsRead = () =>
    api.post('/notifications/read-all').then(r => r.data);
