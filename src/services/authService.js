import {
    loginWithPhone as apiLoginWithPhone,
    loginWithGoogle as apiLoginWithGoogle,
    registerCustomer as apiRegisterCustomer,
    verifyRegisterOtp as apiVerifyRegisterOtp,
    resendRegisterOtp as apiResendRegisterOtp,
} from '../api/authApi';

export const loginWithPhone = async (credentials) => {
    try {
        return await apiLoginWithPhone(credentials);
    } catch (error) {
        console.error('Error during login:', error);
        throw error;
    }
};

export const loginWithGoogle = async (token) => {
    try {
        return await apiLoginWithGoogle(token);
    } catch (error) {
        console.error('Error during Google login:', error);
        throw error;
    }
};

export const registerCustomer = async (data) => {
    try {
        return await apiRegisterCustomer(data);
    } catch (error) {
        console.error('Error during registration:', error);
        throw error;
    }
};

export const verifyRegisterOtp = async (data) => {
    try {
        return await apiVerifyRegisterOtp(data);
    } catch (error) {
        console.error('Error verifying registration OTP:', error);
        throw error;
    }
};

export const resendRegisterOtp = async (challengeId) => {
    try {
        return await apiResendRegisterOtp(challengeId);
    } catch (error) {
        console.error('Error resending registration OTP:', error);
        throw error;
    }
};