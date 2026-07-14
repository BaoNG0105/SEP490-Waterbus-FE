import { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { loginWithGoogle, loginWithPhoneEmail } from "../../services/authService";
import { useDispatch, useSelector } from "react-redux";
import { loginSuccess } from "../../redux/authSlice";

export const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { lang } = useApp();

  // 1. QUẢN LÝ FIELD ĐĂNG NHẬP
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // 2. QUẢN LÝ THÔNG BÁO LỖI CHUNG VÀ TỪNG FIELD
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  //3. QUẢN LÝ AUTH VÀ ĐIỀU HƯỚNG: KIỂM TRA NẾU ĐÃ ĐĂNG NHẬP THÌ VỀ TRANG CHỦ
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  // HÀM HELPER ĐIỀU HƯỚNG THÔNG MINH DỰA TRÊN ROLE
  const handleRoleRedirect = useCallback((userData) => {
    const allowedRoles = ["ADMIN", "STAFF", "MANAGER"];
    const isManagerOrAdmin = userData?.roles?.some(
      (role) => allowedRoles.includes(role.code) || allowedRoles.includes(role.systemName)
    );
    if (isManagerOrAdmin) {
      navigate("/admin", { replace: true }); // Quyền cao -> Vào thẳng Admin
    } else {
      navigate("/", { replace: true }); // Khách hàng -> Về trang chủ công cộng
    }
  }, [navigate]);

  // KIỂM TRA NẾU ĐÃ ĐĂNG NHẬP THÌ TỰ ĐỘNG ĐIỀU HƯỚNG THEO ROLE
  useEffect(() => {
    if (isAuthenticated && user) {
      handleRoleRedirect(user);
    }
  }, [isAuthenticated, user, handleRoleRedirect]);

  // 4. HÀM XỬ LÝ ĐĂNG NHẬP BẰNG TÀI KHOẢN/MẬT KHẨU
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    setFieldErrors({});

    const errors = {};
    if (!emailOrPhone.trim()) {
      errors.emailOrPhone = lang === "VN" ? "Vui lòng nhập Email hoặc Số điện thoại" : "Email or Phone is required";
    }
    if (!password) {
      errors.password = lang === "VN" ? "Vui lòng nhập mật khẩu" : "Password is required";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setIsLoading(false);
      return;
    }

    try {
      const payload = {
        emailOrPhone: emailOrPhone.trim(),
        password: password,
      };
      const response = await loginWithPhoneEmail(payload);
      if (response.tokens && response.tokens.accessToken) {
        // Gom dữ liệu user lại cho khớp với cấu trúc authSlice đang chờ
        const userInfo = {
          id: String(response.user?.id || response.user?.userId || ""),
          fullName: response.user?.fullName || '',
          avatarUrl: response.user?.avatarUrl || '',
          roles: response.user?.roles || [],
        };
        // Dispatch với đúng key "accessToken" và "user"
        dispatch(loginSuccess({
          accessToken: response.tokens.accessToken,
          user: userInfo
        }));
        handleRoleRedirect(userInfo);
      } else {
        setErrorMsg(lang === "VN" ? "Dữ liệu trả về không hợp lệ." : "Invalid response data.");
      }
    } catch (error) {
      console.error("Login Error:", error);
      const errorData = error.response?.data;
      setErrorMsg(
        errorData?.message ||
        (lang === "VN" ? "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin." : "Login failed. Please check your credentials.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 5. HÀM XỬ LÝ GOOGLE LOGIN
  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    setErrorMsg("");

    try {
      // Gọi API gửi idToken của Google lên Backend
      const response = await loginWithGoogle(credentialResponse.credential);
      // bóc tách dữ liệu theo đúng chuẩn object trả về từ Swagger của bạn
      const jwtToken = response?.tokens?.accessToken;
      const userData = response?.user;
      // Kiểm tra Backend đã trả về đủ cả Token lẫn thông tin User chưa
      if (jwtToken && userData) {
        // ĐỒNG BỘ HÓA: Truyền chính xác cặp { token, user } giống y chang hàm 4
        dispatch(loginSuccess({ 
          token: jwtToken, 
          user: userData 
        }));
        // Đăng nhập thành công chuyển thẳng về trang chủ công cộng
        handleRoleRedirect(userData); 
      } else {
        setErrorMsg(
          lang === "VN" 
            ? "Hệ thống không trả về đầy đủ mã truy cập hoặc thông tin người dùng." 
            : "Incomplete token or user payload received from server."
        );
      }
    } catch (error) {
      console.error("Google Login Error:", error);
      const errorData = error.response?.data;
      setErrorMsg(
        errorData?.message || 
        (lang === "VN" 
          ? "Đăng nhập Google thất bại. Vui lòng thử lại sau." 
          : "Google login failed. Please try again later.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 6. HÀM XỬ LÝ LỖI KẾT NỐI GOOGLE
  const handleGoogleError = () => {
    setErrorMsg(lang === "VN" ? "Kết nối Google thất bại." : "Google connection failed.");
  };

  return (
    <div className="min-h-screen w-full flex font-body bg-white dark:bg-slate-900 transition-colors duration-300 overflow-x-hidden">

      {/* CỘT TRÁI: BANNER HÌNH ẢNH  */}
      <div className="w-1/2 h-screen top-0 hidden md:block relative overflow-hidden shrink-0 select-none">
        <img
          src="https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png"
          alt="Waterbus Fullscreen Banner"
          className="w-full h-full object-cover transform scale-100 hover:scale-[1.01] transition-transform duration-700 ease-out"
        />
        {/* Lớp phủ chuyển màu Gradient xanh đặc trưng giúp hiển thị chữ rõ nét */}
        <div className="absolute inset-0 bg-linear-to-t from-[#124757] via-[#124757]/40 to-transparent opacity-90"></div>

        {/* Khung nội dung text nổi dưới chân ảnh */}
        <div className="absolute bottom-12 left-12 right-12 text-white space-y-2 z-10">
          <h2 className="font-headline font-black text-4xl uppercase tracking-wider text-[#FFD100] drop-shadow-md">
            WaterBus
          </h2>
          <p className="text-base font-medium text-white/80 max-w-sm leading-relaxed">
            {lang === "VN"
              ? "Khám phá vẻ đẹp sông Sài Gòn theo cách của bạn."
              : "Discover the beauty of Saigon River your way."}
          </p>
        </div>
      </div>

      {/* CỘT PHẢI: KHÔNG GIAN FORM ĐĂNG NHẬP FULL CHIỀU CAO MÀN HÌNH */}
      <div className="flex-1 min-h-screen flex flex-col justify-center bg-white dark:bg-slate-900 px-6 py-12 sm:px-12 md:px-16 lg:px-24 relative">

        {/* NÚT QUAY LẠI TRANG CHỦ GÓC TRÊN */}
        <Link
          to="/"
          className="absolute top-8 right-8 text-slate-400 hover:text-[#124757] dark:hover:text-[#FFD100] transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider z-20"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
          {lang === "VN" ? "Đóng" : "Close"}
        </Link>

        {/* Khung Container Form khống chế kích thước tối đa để chống vỡ bố cục trên Desktop lớn */}
        <div className="w-full max-w-md mx-auto space-y-8 animate-fade-in">

          {/* Tiêu đề đầu Form */}
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-headline font-black text-[#124757] dark:text-yellow-400 tracking-tight">
              {lang === "VN" ? "Đăng Nhập" : "Welcome Back"}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              {lang === "VN" ? "Vui lòng nhập thông tin để tiếp tục" : "Please enter your details to continue"}
            </p>
          </div>

          {/* Hộp cảnh báo lỗi nếu gọi API fail */}
          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100 dark:border-red-500/20 shadow-inner">
              <span className="material-symbols-outlined text-[20px]">error</span>
              {errorMsg}
            </div>
          )}

          {/* Biểu mẫu Form submit nhập liệu */}
          <form onSubmit={handleLogin} className="space-y-5">

            {/* Trường nhập Email / Số điện thoại */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {lang === "VN" ? "Email / Số điện thoại" : "Email / Phone"}
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  account_circle
                </span>
                <input
                  type="text"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder={lang === "VN" ? "Nhập email hoặc số điện thoại..." : "Enter your email or phone..."}
                  className={`w-full bg-slate-50 dark:bg-slate-900 border ${fieldErrors.emailOrPhone ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'} rounded-xl pl-11 pr-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] focus:border-transparent transition-all`}
                />
              </div>
              {fieldErrors.emailOrPhone && <p className="text-xs text-red-500 font-bold">{fieldErrors.emailOrPhone}</p>}
            </div>

            {/* Trường nhập Mật khẩu */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lang === "VN" ? "Mật khẩu" : "Password"}
                </label>
                <Link to="/forgot-password" className="text-xs font-bold text-[#124757] dark:text-[#FFD100] hover:underline">
                  {lang === "VN" ? "Quên mật khẩu?" : "Forgot password?"}
                </Link>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  lock
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`w-full bg-slate-50 dark:bg-slate-900 border ${fieldErrors.password ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'} rounded-xl pl-11 pr-12 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] focus:border-transparent transition-all`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {fieldErrors.password && <p className="text-xs text-red-500 font-bold">{fieldErrors.password}</p>}
            </div>

            {/* Phím bấm kích hoạt Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#124757] dark:bg-[#FFD100] text-white dark:text-slate-900 font-headline font-black uppercase tracking-wider py-4 rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-70 transition-all flex justify-center items-center gap-2 mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              ) : (
                lang === "VN" ? "Đăng Nhập" : "Sign In"
              )}
            </button>
          </form>

          {/* Vạch kẻ phân cách cổng bên thứ 3 */}
          <div className="relative flex items-center py-2">
            <div className="grow border-t border-slate-200 dark:border-slate-700"></div>
            <span className="shrink-0 mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
              {lang === "VN" ? "Hoặc" : "Or"}
            </span>
            <div className="grow border-t border-slate-200 dark:border-slate-700"></div>
          </div>

          {/* Cổng đăng nhập mở rộng Google OAuth */}
          <div className="flex justify-center w-full overflow-hidden">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              shape="rectangular"
              size="large"
              theme="outline"
              text="signin_with"
              width="100%"
            />
          </div>

          {/* Chuyển hướng sang trang đăng ký tài khoản tự do */}
          <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">
            {lang === "VN" ? "Chưa có tài khoản?" : "Don't have an account?"}{" "}
            <Link to="/register" className="font-bold text-[#124757] dark:text-[#FFD100] hover:underline">
              {lang === "VN" ? "Đăng ký ngay" : "Sign up now"}
            </Link>
          </p>

        </div>
      </div>

    </div>
  );
};