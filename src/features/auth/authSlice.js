import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  accessToken: localStorage.getItem('accessToken') || null,
  user: {
    fullName: localStorage.getItem('userName') || '',
    avatarUrl: localStorage.getItem('avatarUrl') || '',
    roleName: localStorage.getItem('roleName') || '',
  },
  isAuthenticated: !!localStorage.getItem('accessToken'),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      const { accessToken, user } = action.payload;
      
      state.accessToken = accessToken;
      state.user = user;
      state.isAuthenticated = true;

      // Tính toán mốc thời gian hết hạn (Hiện tại + 30 phút)
      const expirationTime = new Date().getTime() + 30 * 60 * 1000;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('userName', user.fullName);
      localStorage.setItem('avatarUrl', user.avatarUrl);
      localStorage.setItem('roleName', user.roleName);
      // LƯU MỐC HẾT HẠN XUỐNG LOCALSTORAGE
      localStorage.setItem('expirationTime', expirationTime.toString()); 
    },
    
    logout: (state) => {
      state.accessToken = null;
      state.user = { fullName: '', avatarUrl: '', roleName: '' };
      state.isAuthenticated = false;

      localStorage.removeItem('accessToken');
      localStorage.removeItem('userName');
      localStorage.removeItem('avatarUrl');
      localStorage.removeItem('roleName');
      // XÓA MỐC HẾT HẠN KHI ĐĂNG XUẤT
      localStorage.removeItem('expirationTime'); 
    },
  },
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;