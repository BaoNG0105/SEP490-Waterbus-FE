import {
    getNotifications as apiGetNotifications,
    getUnreadNotificationCount as apiGetUnreadNotificationCount,
    markNotificationAsRead as apiMarkNotificationAsRead,
    markAllNotificationsAsRead as apiMarkAllNotificationsAsRead,
} from '../api/notificationApi';

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
        return await apiMarkNotificationAsRead(id);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
};

// Service đánh dấu đã đọc tất cả thông báo
export const markAllNotificationsRead = async () => {
    try {
        return await apiMarkAllNotificationsAsRead();
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
};
