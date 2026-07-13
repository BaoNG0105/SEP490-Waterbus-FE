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

// Api xác thực khi đổi email
export const verifyEmailChangeOtp = (data) =>
    api.post('/auth/verify-email-change-otp', data).then(r => r.data);

// Api xác thực khi thêm/đổi số điện thoại (cho Google User)
export const verifyPhoneChangeOtp = (data) =>
    api.post('/auth/verify-phone-change-otp', data).then(r => r.data);

// Api đổi mật khẩu
export const changePasswordApi = (data) =>
    api.post('/auth/change-password', data).then(r => r.data);

// Api yêu cầu OTP quên mật khẩu
export const forgotPasswordApi = (emailOrPhone) =>
    api.post('/auth/forgot-password', { emailOrPhone }).then(r => r.data);

// Api đặt lại mật khẩu bằng OTP
export const resetPasswordApi = (data) =>
    api.post('/auth/reset-password', data).then(r => r.data);