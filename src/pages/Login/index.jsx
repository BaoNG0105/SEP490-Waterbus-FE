import { useState } from "react";
import { Link } from "react-router-dom";

export const Login = () => {
  // Khởi tạo state để quản lý form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    console.log("Login attempt:", { email, password });
    // Thêm logic gọi API đăng nhập ở đây sau này
  };

  return (
    <div className="bg-background font-body text-on-surface overflow-hidden min-h-screen relative">
      {/* Decorative Top Anchor*/}
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

      {/* Auth Layout Wrapper: Split View */}
      <main className="flex min-h-screen">
        {/* Left Side: Image */}
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

        {/* Right Side: Login Form */}
        <section className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-24 bg-surface dark:bg-slate-900 transition-colors">
          <div className="w-full max-w-md">
            {/* Form Header */}
            <div className="mb-10">
              <h2 className="font-headline text-4xl font-bold text-on-surface dark:text-white mb-2 tracking-tight">
                Welcome back
              </h2>
              <p className="text-on-surface-variant dark:text-white/70 font-label">
                Enter your credentials to access your routes.
              </p>
            </div>

            {/* Login Form */}
            <form className="space-y-6" onSubmit={handleLogin}>
              {/* Input Field: Email */}
              <div className="space-y-2">
                <label
                  className="block font-label text-sm font-semibold text-on-surface-variant dark:text-white ml-1"
                  htmlFor="email"
                >
                  Email or Phone
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@waterbus.com"
                  className="w-full px-6 py-4 rounded-xl bg-surface-container-high dark:bg-slate-800 border-none text-on-surface dark:text-white focus:ring-2 focus:ring-primary dark:focus:ring-yellow-400 focus:bg-surface-container-lowest dark:focus:bg-slate-700 transition-all duration-300 placeholder:text-outline/60"
                  required
                />
              </div>

              {/* Input Field: Password */}
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

              {/* Primary Action */}
              <button
                type="submit"
                className="w-full liquid-gradient text-on-primary-fixed font-headline font-bold py-5 rounded-full shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-300 flex justify-center items-center gap-2"
              >
                Sign In
              </button>
            </form>

            {/* Divider */}
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

            {/* Social Logins */}
            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-surface-container-highest dark:bg-slate-800 font-label font-bold text-on-surface dark:text-white hover:bg-surface-container dark:hover:bg-slate-700 transition-colors duration-300 group">
                <svg
                  className="w-5 h-5 group-hover:scale-110 transition-transform"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  ></path>
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  ></path>
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  ></path>
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                    fill="#EA4335"
                  ></path>
                </svg>
                Google
              </button>
              <button className="flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-surface-container-highest dark:bg-slate-800 font-label font-bold text-on-surface dark:text-white hover:bg-surface-container dark:hover:bg-slate-700 transition-colors duration-300 group">
                <svg
                  className="w-5 h-5 text-[#1877F2] group-hover:scale-110 transition-transform"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"></path>
                </svg>
                Facebook
              </button>
            </div>

            {/* Footer Text */}
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

          {/* Footer: Legal Anchor */}
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
