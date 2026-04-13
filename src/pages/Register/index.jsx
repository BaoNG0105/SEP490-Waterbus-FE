import { useState } from "react";
import { Link } from "react-router-dom";

export const Register = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleRegister = (e) => {
    e.preventDefault();
    console.log("Registration data:", formData);
  };

  return (
    <div className="bg-background font-body text-on-surface selection:bg-primary-container selection:text-on-primary-container overflow-hidden min-h-screen relative">
      {/* Decorative Top Anchor */}
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

      <main className="min-h-screen flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Image */}
        <section className="hidden md:flex md:w-1/2 lg:w-3/5 relative overflow-hidden bg-slate-900 items-center justify-center">
          <div className="absolute inset-0 z-0 opacity-40">
            <img
              alt="River Transit"
              className="w-full h-full object-cover mix-blend-overlay"
              src="https://res.cloudinary.com/dygipvoal/image/upload/v1776092653/ywbwjyftzirzdqf2igte.jpg"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-transparent to-transparent"></div>
          </div>
          {/* Branding Overlay */}
          <div className="relative z-10 p-12 flex flex-col justify-center h-full w-full gap-16">
            <div className="max-w-lg">
              <h1 className="font-headline text-5xl lg:text-7xl font-bold text-white leading-none tracking-tight mb-6">
                Chart Your New Course.
              </h1>
              <p className="text-white/80 text-lg lg:text-xl font-light leading-relaxed">
                Experience the Saigon River like never before. From daily
                commutes to weekend escapes, your premium nautical journey
                begins here.
              </p>
            </div>
          </div>
        </section>

        {/* Right Side: Registration Form */}
        <section className="w-full md:w-1/2 lg:w-2/5 bg-surface dark:bg-slate-900 flex flex-col justify-center px-6 py-25 lg:px-20 relative transition-colors">
          <div className="w-full max-w-md mx-auto">
            {/* Form Header */}
            <header className="mb-10">
              <h2 className="font-headline text-3xl font-bold text-on-surface dark:text-white mb-2">
                Create an account
              </h2>
              <p className="text-on-surface-variant dark:text-white/70 font-body">
                Join the elite network of river travelers today.
              </p>
            </header>

            {/* Regis Form */}
            <form className="space-y-5" onSubmit={handleRegister}>
              {/* Full Name */}
              <div className="space-y-1.5">
                <label
                  className="block text-sm font-label font-semibold text-on-surface-variant dark:text-white ml-1"
                  htmlFor="full_name"
                >
                  Full Name
                </label>
                <div className="relative group">
                  <input
                    id="full_name"
                    name="fullName"
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="John Doe"
                    className="w-full px-5 py-4 bg-surface-container-high dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/20 dark:focus:ring-yellow-400/20 focus:bg-surface-container-lowest dark:focus:bg-slate-700 transition-all duration-300 font-body outline-none placeholder:text-on-surface-variant/40 dark:placeholder:text-white/30 text-on-surface dark:text-white"
                  />
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 dark:text-white/40 group-focus-within:text-primary dark:group-focus-within:text-yellow-400 transition-colors">
                    person
                  </span>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  className="block text-sm font-label font-semibold text-on-surface-variant dark:text-white ml-1"
                  htmlFor="email"
                >
                  Email Address
                </label>
                <div className="relative group">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@company.com"
                    className="w-full px-5 py-4 bg-surface-container-high dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/20 dark:focus:ring-yellow-400/20 focus:bg-surface-container-lowest dark:focus:bg-slate-700 transition-all duration-300 font-body outline-none placeholder:text-on-surface-variant/40 dark:placeholder:text-white/30 text-on-surface dark:text-white"
                  />
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 dark:text-white/40 group-focus-within:text-primary dark:group-focus-within:text-yellow-400 transition-colors">
                    mail
                  </span>
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label
                  className="block text-sm font-label font-semibold text-on-surface-variant dark:text-white ml-1"
                  htmlFor="phone"
                >
                  Phone Number
                </label>
                <div className="relative group">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+84 000 000 000"
                    className="w-full px-5 py-4 bg-surface-container-high dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/20 dark:focus:ring-yellow-400/20 focus:bg-surface-container-lowest dark:focus:bg-slate-700 transition-all duration-300 font-body outline-none placeholder:text-on-surface-variant/40 dark:placeholder:text-white/30 text-on-surface dark:text-white"
                  />
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 dark:text-white/40 group-focus-within:text-primary dark:group-focus-within:text-yellow-400 transition-colors">
                    call
                  </span>
                </div>
              </div>

              {/* Password Fields */}
              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-1.5">
                  <label
                    className="block text-sm font-label font-semibold text-on-surface-variant dark:text-white ml-1"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <div className="relative group">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full px-5 py-4 bg-surface-container-high dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/20 dark:focus:ring-yellow-400/20 focus:bg-surface-container-lowest dark:focus:bg-slate-700 transition-all duration-300 font-body outline-none placeholder:text-on-surface-variant/40 dark:placeholder:text-white/30 text-on-surface dark:text-white"
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 dark:text-white/40 hover:text-primary dark:hover:text-yellow-400 transition-colors cursor-pointer"
                    >
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    className="block text-sm font-label font-semibold text-on-surface-variant dark:text-white ml-1"
                    htmlFor="confirm_password"
                  >
                    Confirm Password
                  </label>
                  <div className="relative group">
                    <input
                      id="confirm_password"
                      name="confirmPassword"
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full px-5 py-4 bg-surface-container-high dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/20 dark:focus:ring-yellow-400/20 focus:bg-surface-container-lowest dark:focus:bg-slate-700 transition-all duration-300 font-body outline-none placeholder:text-on-surface-variant/40 dark:placeholder:text-white/30 text-on-surface dark:text-white"
                    />
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 dark:text-white/40 group-focus-within:text-primary dark:group-focus-within:text-yellow-400 transition-colors">
                      lock_reset
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 pt-2">
                <div className="flex h-6 items-center">
                  <input
                    id="terms"
                    name="termsAccepted"
                    type="checkbox"
                    required
                    checked={formData.termsAccepted}
                    onChange={handleChange}
                    className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary/30 transition-all cursor-pointer"
                  />
                </div>
                <label
                  className="text-sm font-body text-on-surface-variant dark:text-white/70 leading-tight"
                  htmlFor="terms"
                >
                  I agree to the{" "}
                  <a
                    className="text-secondary dark:text-blue-400 font-medium hover:underline"
                    href="#"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    className="text-secondary dark:text-blue-400 font-medium hover:underline"
                    href="#"
                  >
                    Privacy Policy
                  </a>
                  .
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full liquid-gradient text-on-primary-fixed font-headline font-bold py-5 rounded-full shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-300 flex justify-center items-center gap-2"
              >
                Register Account
              </button>

              {/* Link to Login */}
              <div className="text-center pt-6">
                <p className="text-on-surface-variant dark:text-white/70 font-body">
                  Already have an account?
                  <Link
                    to="/login"
                    className="font-bold text-on-background dark:text-primary-container hover:text-primary dark:hover:text-#ffd100 transition-colors"
                  >
                    Sign In
                  </Link>
                </p>
              </div>
            </form>

            {/* Footer: Help Anchor */}
            <footer className="mt-16 text-center border-t border-surface-container-high dark:border-slate-800 pt-8">
              <button className="flex items-center gap-2 mx-auto text-sm font-label font-medium text-on-surface-variant/60 dark:text-white/50 hover:text-on-surface dark:hover:text-white transition-colors">
                <span className="material-symbols-outlined text-lg">
                  help_outline
                </span>
                Need help with registration?
              </button>
            </footer>

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
          </div>
        </section>
      </main>
    </div>
  );
};
