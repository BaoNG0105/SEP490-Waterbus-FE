import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { loginWithGoogle, loginWithPhone } from "../../services/authService";
import { useDispatch, useSelector } from "react-redux";
import { loginSuccess } from "../../features/auth/authSlice";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

export const Login = () => {
  const [isLoading, setIsLoading] = useState(false);

  // QUẢN LÝ FIELD ĐĂNG NHẬP
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // QUẢN LÝ THÔNG BÁO LỖI CHUNG VÀ TỪNG FIELD
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth);

  // KIỂM TRA NẾU ĐÃ ĐĂNG NHẬP THÌ ĐÁ VỀ TRANG CHỦ
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // HÀM KIỂM TRA LỖI TỪNG FIELD ĐỘC LẬP
  const getFieldError = (name, value) => {
    switch (name) {
      case "phone":
        if (!value) return "Vui lòng nhập số điện thoại.";
        if (!/^\+[1-9]\d{7,14}$/.test(value)) return "Số điện thoại không hợp lệ.";
        return "";
      case "password":
        if (!value) return "Vui lòng nhập mật khẩu.";
        return "";
      default:
        return "";
    }
  };

  // XỬ LÝ ON-BLUR (KHI NGƯỜI DÙNG RỜI KHỎI Ô NHẬP)
  const handleBlur = (e) => {
    // Với PhoneInput, event có thể truyền thẳng object mô phỏng
    const { name, value } = e.target;
    const error = getFieldError(name, value);
    setFieldErrors(prev => ({ ...prev, [name]: error }));
  };

  // XỬ LÝ KHI SUBMIT FORM
  const validateForm = () => {
    const newErrors = {
      phone: getFieldError("phone", phone),
      password: getFieldError("password", password),
    };
    setFieldErrors(newErrors);
    
    return Object.values(newErrors).some(err => err !== "");
  };

  // XỬ LÝ ĐĂNG NHẬP THƯỜNG
  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Validate trước khi gọi API
    if (validateForm()) {
      return; 
    }

    setErrorMsg("");
    setIsLoading(true);
    try {
      const data = await loginWithPhone({ phone, password });

      if (data?.tokens?.accessToken) {
        dispatch(
          loginSuccess({
            accessToken: data.tokens.accessToken,
            user: {
              fullName: data.user?.fullName || "Thành viên",
              avatarUrl: data.user?.avatarUrl || "",
              roleName: data.user?.roles?.[0]?.displayName || "Customer",
            },
          })
        );
        navigate("/");
      } else {
        setErrorMsg("Đăng nhập không thành công, vui lòng thử lại.");
      }
    } catch (error) {
      console.log(error);
      setErrorMsg("Số điện thoại hoặc mật khẩu không chính xác.");
    } finally {
      setIsLoading(false);
    }
  };

  // XỬ LÝ GOOGLE LOGIN
  const handleGoogleSuccess = async (credentialResponse) => {
    setErrorMsg("");
    try {
      const idToken = credentialResponse.credential;
      console.log(idToken);

      const data = await loginWithGoogle(idToken);

      if (data?.tokens?.accessToken) {
        dispatch(
          loginSuccess({
            accessToken: data.tokens.accessToken,
            user: {
              fullName: data.user?.fullName || "Thành viên",
              avatarUrl: data.user?.avatarUrl || "",
              roleName: data.user?.roles?.[0]?.displayName || "Customer",
            },
          })
        );
        navigate("/");
      } else {
        setErrorMsg("Không thể xác thực tài khoản Google.");
      }
    } catch (error) {
      console.log(error);
      setErrorMsg("Đăng nhập Google thất bại. Vui lòng thử lại.");
    }
  };

  const handleGoogleError = () => {
    setErrorMsg("Đã hủy đăng nhập Google.");
  };

  // CLASSES CHUNG: CÓ HIỆU ỨNG ĐỎ KHI CÓ LỖI
  const getInputClasses = (fieldName) => `w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-white/30 text-slate-900 dark:text-white ${
    fieldErrors[fieldName] 
    ? 'border-red-500 focus:ring-2 focus:ring-red-500/40' 
    : 'border-slate-200 dark:border-transparent focus:ring-2 focus:ring-primary/40 dark:focus:ring-yellow-400/20 focus:border-primary dark:focus:border-transparent'
  }`;

  const phoneInputClasses = `w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border rounded-xl transition-all [&>input]:bg-transparent [&>input]:outline-none [&>input]:w-full text-slate-900 dark:text-white ${
    fieldErrors.phone 
    ? 'border-red-500 focus-within:ring-2 focus-within:ring-red-500/40' 
    : 'border-slate-200 dark:border-transparent focus-within:ring-2 focus-within:ring-primary/40 dark:focus-within:ring-yellow-400/20 focus-within:border-primary dark:focus-within:border-transparent'
  }`;

  return (
    <div className="bg-white dark:bg-slate-900 font-body text-slate-900 dark:text-white selection:bg-primary-container selection:text-on-primary-container overflow-hidden min-h-screen relative">

      <header className="fixed top-0 left-0 w-full p-6 lg:p-12 pointer-events-none flex justify-between items-center z-50">
        <div className="pointer-events-auto bg-white/80 dark:bg-slate-900/50 backdrop-blur-md px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
          <Link to="/" className="font-label text-xs uppercase tracking-widest text-slate-600 dark:text-white/70 hover:text-primary dark:hover:text-white flex items-center gap-2 group">
            <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
            Back to Site
          </Link>
        </div>
      </header>

      <main className="min-h-screen flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Image */}
        <section className="hidden md:flex md:w-1/2 lg:w-3/5 relative overflow-hidden bg-slate-900 items-center justify-center">
          <div className="absolute inset-0 z-0 opacity-50 dark:opacity-40">
            <img alt="River Transit" className="w-full h-full object-cover mix-blend-overlay" src="https://res.cloudinary.com/dygipvoal/image/upload/v1776092653/ywbwjyftzirzdqf2igte.jpg" />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-transparent"></div>
          </div>
          <div className="relative z-10 p-12 flex flex-col justify-center h-full w-full gap-16">
            <div className="max-w-lg">
              <h1 className="font-headline text-5xl lg:text-7xl font-bold text-white leading-none tracking-tight mb-6">Navigate <br /> the flow.</h1>
              <p className="text-white/90 text-lg lg:text-xl font-light leading-relaxed">Seamless river transit across Saigon. Your journey through the heart of the city begins with a single click.</p>
            </div>
          </div>
        </section>

        {/* Right Side: Form Area */}
        <section className="w-full md:w-1/2 lg:w-2/5 bg-white dark:bg-slate-900 flex flex-col justify-start px-6 lg:px-20 relative transition-colors h-screen overflow-y-auto">
          {/* Chỉnh lại pt-32 thành pt-20 để kéo form lên trên cân đối hơn */}
          <div className="w-full max-w-md mx-auto pt-20 lg:pt-24 pb-12">

            {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
                <span className="material-symbols-outlined inline-block align-text-bottom mr-1 text-[18px]">error</span>
                {errorMsg}
              </div>
            )}

            <div className="animate-fade-in-up">
              <header className="mb-10">
                <h2 className="font-headline text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Welcome back</h2>
                <p className="text-slate-500 dark:text-white/70 font-body">Enter your credentials to access your routes.</p>
              </header>

              <form className="space-y-6" onSubmit={handleLogin}>
                {/* THAY BẰNG THƯ VIỆN PhoneInput */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Phone Number</label>
                  <PhoneInput
                    international
                    defaultCountry="VN"
                    value={phone}
                    onChange={(value) => {
                      setPhone(value);
                      setErrorMsg("");
                      if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: "" }));
                    }}
                    onBlur={() => handleBlur({ target: { name: "phone", value: phone } })}
                    className={phoneInputClasses}
                  />
                  {fieldErrors.phone && <p className="text-red-500 text-xs ml-1 mt-1">{fieldErrors.phone}</p>}
                </div>

                {/* Password */}
                <div className="space-y-1.5 relative">
                  <div className="flex justify-between items-center px-1 mb-1">
                    <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90">Password</label>
                    <a className="text-xs font-label font-bold text-primary dark:text-yellow-400 hover:underline transition-colors" href="#">Forgot password?</a>
                  </div>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMsg("");
                        if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: "" }));
                      }}
                      onBlur={handleBlur}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className={getInputClasses("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-primary dark:hover:text-yellow-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  {fieldErrors.password && <p className="text-red-500 text-xs ml-1 mt-1">{fieldErrors.password}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full liquid-gradient disabled:opacity-70 text-on-primary-fixed font-headline font-bold py-4 mt-2 rounded-full shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-300 flex justify-center items-center gap-2"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </button>
              </form>

              <div className="relative my-10">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white dark:bg-slate-900 px-4 text-slate-400 dark:text-white/60 font-label uppercase tracking-widest">
                    Or continue with
                  </span>
                </div>
              </div>

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

              <div className="mt-12 text-center z-10 relative">
                <p className="text-sm text-slate-600 dark:text-white/70 font-body">
                  Don't have an account?{" "}
                  <Link to="/register" className="font-bold text-primary dark:text-yellow-400 hover:underline ml-1">
                    Register for free
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};