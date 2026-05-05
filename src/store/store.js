import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
// Sau này có thêm bookingReducer, ticketReducer thì import vào đây

export const store = configureStore({
    reducer: {
        auth: authReducer, // Kết nối Auth Slice vào kho
        // booking: bookingReducer,
    },
});