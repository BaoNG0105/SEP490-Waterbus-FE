import {
    loginWithPhoneEmail as apiLoginWithPhoneEmail,
    loginWithGoogle as apiLoginWithGoogle,
    registerCustomer as apiRegisterCustomer,
    verifyRegisterOtp as apiVerifyRegisterOtp,
    resendRegisterOtp as apiResendRegisterOtp,
    getCurrentUserProfile as apiGetCurrentUserProfile,
    updateCurrentUserProfile as apiUpdateCurrentUserProfile,
    changePasswordApi as apiChangePassword,
    verifyEmailChangeOtp as apiVerifyEmailChangeOtp,
    verifyPhoneChangeOtp as apiVerifyPhoneChangeOtp,
    forgotPasswordApi as apiForgotPassword,
    resetPasswordApi as apiResetPassword,
} from '../api/authApi';

// Service login thường
export const loginWithPhoneEmail = async (credentials) => {
    try {
        return await apiLoginWithPhoneEmail(credentials);
    } catch (error) {
        console.error('Error during login:', error);
        throw error;
    }
};

// Service login google
export const loginWithGoogle = async (token) => {
    try {
        return await apiLoginWithGoogle(token);
    } catch (error) {
        console.error('Error during Google login:', error);
        throw error;
    }
};

// Service register
export const registerCustomer = async (data) => {
    try {
        return await apiRegisterCustomer(data);
    } catch (error) {
        console.error('Error during registration:', error);
        throw error;
    }
};

// Service nhập otp
export const verifyRegisterOtp = async (data) => {
    try {
        return await apiVerifyRegisterOtp(data);
    } catch (error) {
        console.error('Error verifying registration OTP:', error);
        throw error;
    }
};

// Service resend otp
export const resendRegisterOtp = async (challengeId) => {
    try {
        return await apiResendRegisterOtp(challengeId);
    } catch (error) {
        console.error('Error resending registration OTP:', error);
        throw error;
    }
};

// Service lấy thông tin user
export const fetchCurrentUserProfile = async () => {
    try {
        return await apiGetCurrentUserProfile();
    } catch (error) {
        console.error('Error fetching current user profile:', error);
        throw error;
    }
};

// Service cập nhật thông tin user
export const updateProfile = async (data) => {
    try {
        return await apiUpdateCurrentUserProfile(data);
    } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
};

// Service xác thực đổi email
export const verifyEmailChangeOtp = async (data) => {
    try {
        return await apiVerifyEmailChangeOtp(data);
    } catch (error) {
        console.error('Error verifying email change OTP:', error);
        throw error;
    }
};

// Service xác thực đổi số điện thoại
export const verifyPhoneChangeOtp = async (data) => {
    try {
        return await apiVerifyPhoneChangeOtp(data);
    } catch (error) {
        console.error('Error verifying phone change OTP:', error);
        throw error;
    }
};

// Service đổi mật khẩu
export const changePasswordService = async (passwordPayload) => {
    try {
        return await apiChangePassword(passwordPayload);
    } catch (error) {
        console.error('Lỗi trong service changePassword:', error);
        throw error;
    }
};

// Service yêu cầu OTP quên mật khẩu
export const forgotPassword = async (emailOrPhone) => {
    try {
        return await apiForgotPassword(emailOrPhone);
    } catch (error) {
        console.error('Error requesting forgot-password OTP:', error);
        throw error;
    }
};

// Service đặt lại mật khẩu bằng OTP
export const resetPassword = async (data) => {
    try {
        return await apiResetPassword(data);
    } catch (error) {
        console.error('Error resetting password:', error);
        throw error;
    }
};