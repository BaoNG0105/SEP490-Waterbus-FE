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