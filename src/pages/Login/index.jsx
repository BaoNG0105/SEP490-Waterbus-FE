import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { loginWithGoogle, loginWithPhone } from "../../services/authService";

// 1. IMPORT TỪ REDUX
import { useDispatch } from "react-redux";
import { loginSuccess } from "../../features/auth/authSlice";

export const Login = () => {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const navigate = useNavigate();
  // 2. KHỞI TẠO HOOK DISPATCH
  const dispatch = useDispatch();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      const data = await loginWithPhone({ phone, password });
      console.log("Đăng nhập thường thành công:", data);

      // 3. ĐƯA DỮ LIỆU VÀO REDUX STORE
      if (data?.tokens?.accessToken) {
        dispatch(
          loginSuccess({
            accessToken: data.tokens.accessToken,
            user: {
              fullName: data.user?.fullName || "Thành viên",
              avatarUrl: data.user?.avatarUrl || "",
              roleName: data.user?.roles?.[0]?.displayName || "Customer",
            },
          }),
        );

        navigate("/");
      } else {
        setErrorMsg("Đăng nhập không thành công, vui lòng thử lại.");
      }
    } catch (error) {
      setErrorMsg("Số điện thoại hoặc mật khẩu không chính xác.");
      console.error("Lỗi đăng nhập:", error);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const idToken = credentialResponse.credential;
      // console.log("Lấy token Google thành công:", idToken);

      const data = await loginWithGoogle(idToken);
      console.log("Backend phản hồi OK:", data);

      // 4. ĐƯA DỮ LIỆU VÀO REDUX STORE
      if (data?.tokens?.accessToken) {
        dispatch(
          loginSuccess({
            accessToken: data.tokens.accessToken,
            user: {
              fullName: data.user?.fullName || "Thành viên",
              avatarUrl: data.user?.avatarUrl || "",
              roleName: data.user?.roles?.[0]?.displayName || "Customer",
            },
          }),
        );

        navigate("/");
      }
    } catch (error) {
      console.error("Backend từ chối token Google:", error);
    }
  };

  const handleGoogleError = () => {
    console.error("Đăng nhập Google thất bại!");
  };

  return (
    <div className="bg-background font-body text-on-surface overflow-hidden min-h-screen relative">
      <header className="fixed top-0 left-0 w-full p-8 lg:p-12 pointer-events-none flex justify-between items-center z-50">
        <div className="bg-surface-container-lowest/10 backdrop-blur-md px-6 py-2 rounded-full lg:bg-transparent lg:backdrop-blur-none pointer-events-auto">
          <span className="material-symbols-outlined text-primary text-xl">
            waves
          </span>
          <span className="font-headline text-2xl font-black tracking-tighter text-on-surface lg:text-white">
            WaterBus
          </span>
        </div>
        <div className="pointer-events-auto">
          {/* Nút quay lại trang chủ */}
          <Link
            to="/"
            className="font-label text-xs uppercase tracking-widest text-on-surface/70 dark:text-white/70 hover:text-primary dark:hover:text-white flex items-center gap-2 group"
          >
            <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">
              arrow_back
            </span>
            Back to Site
          </Link>
        </div>
      </header>

      <main className="flex min-h-screen">
        <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900 items-center justify-center">
          <div className="absolute inset-0 opacity-40">
            <img
              alt="River at Sunrise"
              className="w-full h-full object-cover mix-blend-overlay"
              src="https://res.cloudinary.com/dygipvoal/image/upload/v1776092653/ywbwjyftzirzdqf2igte.jpg"
            />
          </div>
          {/* Branding Overlay */}
          <div className="relative z-10 px-16 text-white max-w-2xl">
            <h1 className="font-headline text-7xl font-bold tracking-tighter leading-none mb-6">
              Navigate <br />
              the flow.
            </h1>
            <p className="font-body text-xl text-surface-container-low font-light leading-relaxed max-w-md">
              Seamless river transit across Saigon. Your journey through the
              heart of the city begins with a single click.
            </p>
          </div>
          {/* Floating 3D Accent */}
          <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-primary/20 blur-3xl"></div>
        </section>

        <section className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-24 bg-surface dark:bg-slate-900 transition-colors">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <h2 className="font-headline text-4xl font-bold text-on-surface dark:text-white mb-2 tracking-tight">
                Welcome back
              </h2>
              <p className="text-on-surface-variant dark:text-white/70 font-label">
                Enter your credentials to access your routes.
              </p>
            </div>

            {/* Hiển thị thông báo lỗi nếu có */}
            {errorMsg && (
              <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl">
                {errorMsg}
              </div>
            )}

            <form className="space-y-6" onSubmit={handleLogin}>
              <div className="space-y-2">
                <label
                  className="block font-label text-sm font-semibold text-on-surface-variant dark:text-white ml-1"
                  htmlFor="phone"
                >
                  Số điện thoại
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Nhập số điện thoại"
                  className="w-full px-6 py-4 rounded-xl bg-surface-container-high dark:bg-slate-800 border-none text-on-surface dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-yellow-400 focus:bg-surface-container-lowest dark:focus:bg-slate-700 transition-all duration-300 placeholder:text-outline/60"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label
                    className="block font-label text-sm font-semibold text-on-surface-variant dark:text-white"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <a
                    className="text-xs font-label font-bold text-primary dark:text-yellow-400 hover:brightness-110 transition-colors"
                    href="#"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-6 py-4 rounded-xl bg-surface-container-high dark:bg-slate-800 border-none text-on-surface dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-yellow-400 focus:bg-surface-container-lowest dark:focus:bg-slate-700 transition-all duration-300 placeholder:text-outline/60"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary dark:hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full liquid-gradient text-on-primary-fixed font-headline font-bold py-5 rounded-full shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-300 flex justify-center items-center gap-2"
              >
                Sign In
              </button>
            </form>

            <div className="relative my-12">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant/30 dark:border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-surface dark:bg-slate-900 px-4 text-outline dark:text-white/60 font-label uppercase tracking-widest transition-colors">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="flex justify-center w-full">
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
              <p className="font-label text-sm text-on-surface-variant dark:text-white/70">
                Don't have an account?{" "}
                <Link
                  to="/register"
                  className="font-bold text-on-background dark:text-primary-container hover:text-primary dark:hover:text-yellow-400 transition-colors"
                >
                  Register for free
                </Link>
              </p>
            </div>
          </div>

          <div className="absolute bottom-8 w-full max-w-md px-4 flex justify-between items-center">
            <span className="font-label text-[10px] uppercase tracking-widest text-outline dark:text-white/50">
              © 2026 WaterBus
            </span>
            <div className="flex gap-4">
              <a
                className="font-label text-[10px] uppercase tracking-widest text-outline dark:text-white/50 hover:text-on-surface dark:hover:text-white transition-colors"
                href="#"
              >
                Privacy
              </a>
              <a
                className="font-label text-[10px] uppercase tracking-widest text-outline dark:text-white/50 hover:text-on-surface dark:hover:text-white transition-colors"
                href="#"
              >
                Terms
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
