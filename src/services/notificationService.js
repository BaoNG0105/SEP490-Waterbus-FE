import {
    getNotifications as apiGetNotifications,
    getUnreadNotificationCount as apiGetUnreadNotificationCount,
    markNotificationAsRead as apiMarkNotificationAsRead,
    markAllNotificationsAsRead as apiMarkAllNotificationsAsRead,
} from '../api/notificationApi';

// Sự kiện phát ra mỗi khi có thông báo được đánh dấu đã đọc (một cái hoặc tất cả),
// để các nơi khác đang hiển thị thông báo (VD: NoticeBar) tự đồng bộ mà không cần đợi tới lượt poll kế tiếp.
export const NOTIFICATION_READ_EVENT = 'waterbus:notification-read';

const dispatchNotificationRead = (detail) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(NOTIFICATION_READ_EVENT, { detail }));
    }
};

// Service lấy danh sách thông báo của user hiện tại
export const fetchNotifications = async (params = {}) => {
    try {
        return await apiGetNotifications(params);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        throw error;
    }
};

// Service lấy số thông báo chưa đọc
export const fetchUnreadNotificationCount = async () => {
    try {
        return await apiGetUnreadNotificationCount();
    } catch (error) {
        console.error('Error fetching unread notification count:', error);
        throw error;
    }
};

// Service đánh dấu đã đọc một thông báo
export const markNotificationRead = async (id) => {
    try {
        const result = await apiMarkNotificationAsRead(id);
        dispatchNotificationRead({ id });
        return result;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
};

// Service đánh dấu đã đọc tất cả thông báo
export const markAllNotificationsRead = async () => {
    try {
        const result = await apiMarkAllNotificationsAsRead();
        dispatchNotificationRead({ all: true });
        return result;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
};
