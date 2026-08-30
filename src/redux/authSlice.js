import { createSlice } from '@reduxjs/toolkit';

// Khởi tạo trạng thái ban đầu
const initialState = {
  accessToken: localStorage.getItem('accessToken') || null,
  // Giải nén nguyên cục user từ localStorage nếu có, nếu không thì để object mặc định có mảng roles rỗng
  user: localStorage.getItem('user') 
    ? JSON.parse(localStorage.getItem('user')) 
    : { fullName: '', avatarUrl: '', roles: [] },
  isAuthenticated: !!localStorage.getItem('accessToken'),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      // Lấy linh hoạt cả 'accessToken' hoặc 'token' để khớp với mọi hàm đăng nhập ở trang Login
      const { accessToken, token, user } = action.payload;
      const finalToken = accessToken || token;

      state.accessToken = finalToken;
      state.user = user;
      state.isAuthenticated = true;

      // Tính toán mốc thời gian hết hạn (Hiện tại + 5 tiếng = 5 * 60 phút * 60 giây * 1000ms)
      const expirationTime = new Date().getTime() + 5 * 60 * 60 * 1000;

      // Lưu trữ dữ liệu đồng bộ
      localStorage.setItem('accessToken', finalToken);
      localStorage.setItem('user', JSON.stringify(user)); // Ép thành chuỗi JSON để giữ lại mảng roles[...] của Backend
      localStorage.setItem('expirationTime', expirationTime.toString());
    },

    logout: (state) => {
      state.accessToken = null;
      state.user = { fullName: '', avatarUrl: '', roles: [] };
      state.isAuthenticated = false;

      // Dọn dẹp sạch sẽ các key tương ứng
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      localStorage.removeItem('expirationTime');

      // Dọn luôn dữ liệu trợ lý AI (session/hội thoại/bookingDraft) — các API chat neo theo
      // clientSessionId lưu trên trình duyệt (không neo theo JWT), nên nếu không xoá, người dùng
      // tiếp theo đăng nhập chung máy sẽ kế thừa hội thoại/bookingDraft của người vừa đăng xuất.
      localStorage.removeItem('waterbus.chat.conversationId');
      localStorage.removeItem('waterbus.chat.bookingDraft');
      localStorage.removeItem('waterbus.chat.clientSessionId');

      // Dọn luôn lịch sử "Điểm đến gần đây" ở trang tìm chuyến Waterbus — tránh lộ tuyến đã
      // tìm của người vừa đăng xuất cho người dùng tiếp theo trên cùng máy.
      localStorage.removeItem('waterbus_recent_search_routes');
    },

    updateUserProfile: (state, action) => {
      const nextUser = {
        ...state.user,
        ...action.payload,
        roles: action.payload?.roles || state.user?.roles || [],
      };

      state.user = nextUser;
      localStorage.setItem('user', JSON.stringify(nextUser));
    },
  },
});

export const { loginSuccess, logout, updateUserProfile } = authSlice.actions;
export default authSlice.reducer;
