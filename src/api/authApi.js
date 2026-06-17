import api from './axios';

// Api login thường
export const loginWithPhoneEmail = (credentials) =>
    api.post('/auth/login', credentials).then(r => r.data);

// Api login google
export const loginWithGoogle = (token) =>
    api.post('/auth/google/login', { idToken: token }).then(r => r.data);

// Api register
export const registerCustomer = (data) =>
    api.post('/auth/register', data).then(r => r.data);

// Api nhập otp
export const verifyRegisterOtp = (data) =>
    api.post('/auth/verify-register-otp', data).then(r => r.data);

// Api resend otp
export const resendRegisterOtp = (challengeId) =>
    api.post('/auth/resend-otp', { challengeId }).then(r => r.data);

// Api lấy thông tin user
export const getCurrentUserProfile = () =>
    api.get('/auth/me').then(r => r.data);

// Api cập nhật thông tin user
export const updateCurrentUserProfile = (data) =>
    api.put('/auth/me', data).then(r => r.data);

// Api đổi mật khẩu
export const changePasswordApi = (data) =>
    api.post('/auth/change-password', data).then(r => r.data);