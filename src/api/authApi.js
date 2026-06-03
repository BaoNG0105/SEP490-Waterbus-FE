import api from './axios';

export const loginWithPhone = (credentials) =>
    api.post('/auth/login', credentials).then(r => r.data);

export const loginWithGoogle = (token) =>
    api.post('/auth/google-login', { idToken: token }).then(r => r.data);

export const registerCustomer = (data) =>
    api.post('/auth/register', data).then(r => r.data);

export const verifyRegisterOtp = (data) =>
    api.post('/auth/verify-register-otp', data).then(r => r.data);

export const resendRegisterOtp = (challengeId) =>
    api.post('/auth/resend-otp', { challengeId }).then(r => r.data);
