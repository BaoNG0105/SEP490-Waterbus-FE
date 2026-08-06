import {
    lookupCounterCustomer as apiLookupCounterCustomer,
    createCounterBooking as apiCreateCounterBooking,
} from '../api/bookingApi';

const unwrapList = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
};

/** Service: Tra cứu khách hàng tại quầy theo SĐT/email — chỉ trả về customer Active. */
export const lookupCounterCustomers = async (keyword) => {
    const value = String(keyword || '').trim();
    if (!value) return [];
    try {
        const data = await apiLookupCounterCustomer(value);
        return unwrapList(data);
    } catch (error) {
        console.error('Lỗi tra cứu khách hàng tại quầy:', error);
        throw error;
    }
};

/** Service: Bán vé tại quầy — tạo booking cho khách (có/không tài khoản), thanh toán Cash/BankTransfer/PayOS. */
export const submitCounterBooking = async (payload) => {
    try {
        return await apiCreateCounterBooking(payload);
    } catch (error) {
        console.error('Lỗi tạo booking tại quầy:', error);
        throw error;
    }
};
