import api from '../config/axios';

// Login bình thường
export const loginWithPhone = async (credentials) => {
    try {
        const response = await api.post('/auth/login', credentials);
        return response.data;
    } catch (error) {
        console.error('Error during login:', error);
        throw error;
    }
};

// Login Google
export const loginWithGoogle = async (token) => {
    try {
        const response = await api.post('/auth/google-login', {
            idToken: token
        });
        return response.data;
    } catch (error) {
        console.error('Error during Google login:', error);
        throw error;
    }
};

// Send phone OTP Google Login
export const sendGooglePhoneOtp = async (data) => {
    try {
        const response = await api.post('/auth/google/send-phone-otp', data);
        return response.data;
    } catch (error) {
        console.error('Error sending Google phone OTP:', error);
        throw error;
    }
};

// OTP Google Login
export const verifyGooglePhoneOtp = async (data) => {
    try {
        const response = await api.post('/auth/google/verify-phone', data);
        return response.data;
    } catch (error) {
        console.error('Error verifying Google phone OTP:', error);
        throw error;
    }
};

// Register
export const registerCustomer = async (data) => {
    try {
        const response = await api.post('/auth/register', data);
        return response.data;
    } catch (error) {
        console.error('Error during registration:', error);
        throw error;
    }
};

// OTP Register
export const verifyRegisterOtp = async (data) => {
    try {
        const response = await api.post('/auth/verify-register-otp', data);
        return response.data;
    } catch (error) {
        console.error('Error verifying registration OTP:', error);
        throw error;
    }
};

// Resend OTP register
export const resendRegisterOtp = async (challengeId) => {
    try {
        const response = await api.post('/auth/resend-otp', { challengeId });
        return response.data;
    } catch (error) {
        console.error('Error resending registration OTP:', error);
        throw error;
    }
};