import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Swal from "sweetalert2";
import { useApp } from "../../context/AppContext";
import { registerCustomer, verifyRegisterOtp, resendRegisterOtp } from "../../services/authService";

// DANH SÁCH MÃ VÙNG QUỐC GIA
const COUNTRIES = [
  { code: "+84", flag: "🇻🇳", name: "Vietnam" },
  { code: "+1", flag: "🇺🇸", name: "USA / Canada" },
  { code: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "+82", flag: "🇰🇷", name: "South Korea" },
  { code: "+86", flag: "🇨🇳", name: "China" },
  { code: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "+66", flag: "🇹🇭", name: "Thailand" },
];

export const Register = () => {
  const { lang, isDarkMode } = useApp();
  const navigate = useNavigate();

  // QUẢN LÝ LUỒNG GIAO DIỆN
  const [step, setStep] = useState(1);
  const [challengeId, setChallengeId] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);

  // QUẢN LÝ BỘ ĐẾM THỜI GIAN OTP
  const [timeLeft, setTimeLeft] = useState(300); // 300 giây = 5 phút
  const [canResend, setCanResend] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    phoneCode: "+84",
    phoneNumber: "",
    email: "",
    password: "",
    confirmPassword: "",
    otpChannel: "phone",
    termsAccepted: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { isAuthenticated } = useSelector((state) => state.auth);

  // KIỂM TRA NẾU ĐÃ ĐĂNG NHẬP THÌ ĐÁ VỀ TRANG CHỦ
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true }); 
    }
  }, [isAuthenticated, navigate]);

  // CHẠY ĐỒNG HỒ ĐẾM NGƯỢC Ở BƯỚC 2 (Màn hình nhập OTP)
  useEffect(() => {
    let interval;
    if (step === 2 && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setCanResend(true); // Hết giờ thì cho phép gửi lại
    }
    return () => clearInterval(interval);
  }, [step, timeLeft]);

  // Hàm chuyển đổi giây thành định dạng MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrorMsg("");
  };

  //XỬ LÍ VALIDATE FORM REGISTER
  const validateForm = () => {
    if (!formData.fullName.trim() || formData.fullName.length > 150) {
      return lang === "VN" ? "Họ tên không được trống và tối đa 150 ký tự." : "Invalid Full Name.";
    }
    if (!formData.dateOfBirth) {
      return lang === "VN" ? "Vui lòng chọn ngày sinh." : "Date of birth is required.";
    }

    const dob = new Date(formData.dateOfBirth);
    const today = new Date();
    if (dob > today) {
      return lang === "VN" ? "Ngày sinh không được lớn hơn ngày hiện tại." : "Date of birth cannot be in the future.";
    }

    const normalizedPhone = formData.phoneNumber.replace(/^0+/, '');
    const fullPhone = `${formData.phoneCode}${normalizedPhone}`;

    const phoneRegex = /^\+[1-9]\d{7,14}$/;
    if (!phoneRegex.test(fullPhone)) {
      return lang === "VN"
        ? "Số điện thoại không hợp lệ. Vui lòng kiểm tra lại."
        : "Invalid phone format. Please check again.";
    }

    if (formData.password.length < 6) {
      return lang === "VN" ? "Mật khẩu quá yếu (tối thiểu 6 ký tự)." : "Password is too weak.";
    }
    if (formData.password !== formData.confirmPassword) {
      return lang === "VN" ? "Mật khẩu xác nhận không khớp." : "Passwords do not match.";
    }
    if (!formData.termsAccepted) {
      return lang === "VN" ? "Vui lòng đồng ý với điều khoản." : "You must accept the terms.";
    }

    return null;
  };

  // XỬ LÍ ĐĂNG KÍ & GỬI OTP
  const handleRegister = async (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      setErrorMsg(error);
      return;
    }

    setIsLoading(true);
    try {
      const normalizedPhone = formData.phoneNumber.replace(/^0+/, '');
      const fullPhone = `${formData.phoneCode}${normalizedPhone}`;

      const payload = {
        fullName: formData.fullName,
        dateOfBirth: formData.dateOfBirth,
        phone: fullPhone,
        password: formData.password,
        email: formData.email.trim() !== "" ? formData.email : undefined,
        otpChannel: formData.email.trim() !== "" ? formData.otpChannel : "phone"
      };

      const response = await registerCustomer(payload);

      if (response && response.challengeId) {
        setChallengeId(response.challengeId);
        // RESET ĐỒNG HỒ TRƯỚC KHI CHUYỂN BƯỚC
        setTimeLeft(60);
        setCanResend(false);
        setStep(2);

        Swal.fire({
          icon: 'success',
          title: lang === "VN" ? 'Đăng ký thành công!' : 'Registration successful!',
          text: lang === "VN" ? 'Vui lòng kiểm tra mã OTP.' : 'Please check your OTP code.',
          background: isDarkMode ? '#1e293b' : '#ffffff',
          color: isDarkMode ? '#ffffff' : '#0f172a',
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (err) {
      setErrorMsg(err?.response?.data?.message || (lang === "VN" ? "Đăng ký thất bại. Số điện thoại có thể đã tồn tại." : "Registration failed."));
    } finally {
      setIsLoading(false);
    }
  };

  // XỬ LÍ XÁC THỰC OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpCode.length < 4 || otpCode.length > 10) {
      setErrorMsg(lang === "VN" ? "Mã OTP phải từ 4 đến 10 ký tự." : "OTP must be 4-10 characters.");
      return;
    }

    setIsLoading(true);
    try {
      await verifyRegisterOtp({
        challengeId: challengeId,
        code: otpCode
      });

      Swal.fire({
        icon: 'success',
        title: lang === "VN" ? 'Xác thực thành công!' : 'Verification successful!',
        text: lang === "VN" ? 'Tài khoản đã được kích hoạt. Hãy đăng nhập.' : 'Account activated. Please log in.',
        background: isDarkMode ? '#1e293b' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#0f172a',
      }).then(() => {
        navigate("/login");
      });

    } catch (err) {
      setErrorMsg(err?.response?.data?.message || "Mã OTP không hợp lệ hoặc đã hết hạn.");
    } finally {
      setIsLoading(false);
    }
  };

  //XỬ LÍ GỬI LẠI OTP
  const handleResendOtp = async () => {
    try {
      await resendRegisterOtp(challengeId);
      // KHỞI ĐỘNG LẠI ĐỒNG HỒ
      setTimeLeft(300);
      setCanResend(false);
      Swal.fire({
        icon: 'success',
        title: lang === "VN" ? 'Đã gửi lại OTP' : 'OTP Resent',
        toast: true,
        position: 'top-end',
        timer: 3000,
        showConfirmButton: false,
        background: isDarkMode ? '#1e293b' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#0f172a',
      });
      setErrorMsg("");
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: err?.response?.data?.message || 'Không thể gửi lại OTP lúc này.',
        background: isDarkMode ? '#1e293b' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#0f172a',
      });
    }
  };

  // Các class chung dùng cho input để dễ quản lý
  const inputClasses = "w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-transparent rounded-xl focus:ring-2 focus:ring-primary/40 dark:focus:ring-yellow-400/20 focus:border-primary dark:focus:border-transparent text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-white/30";

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
              <h1 className="font-headline text-5xl lg:text-7xl font-bold text-white leading-none tracking-tight mb-6">Chart Your New Course.</h1>
              <p className="text-white/90 text-lg lg:text-xl font-light leading-relaxed">Experience the Saigon River like never before. From daily commutes to weekend escapes, your premium nautical journey begins here.</p>
            </div>
          </div>
        </section>

        {/* Right Side: Registration / OTP Form */}
        <section className="w-full md:w-1/2 lg:w-2/5 bg-white dark:bg-slate-900 flex flex-col justify-start px-6 py-10 lg:px-20 relative transition-colors h-screen overflow-y-auto">
          <div className="w-full max-w-md mx-auto pt-32 pb-12">

            {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
                <span className="material-symbols-outlined inline-block align-text-bottom mr-1 text-[18px]">error</span>
                {errorMsg}
              </div>
            )}

            {/* BƯỚC 1: FORM ĐĂNG KÝ */}
            {step === 1 && (
              <>
                <header className="mb-8">
                  <h2 className="font-headline text-3xl font-bold text-slate-900 dark:text-white mb-2">Create an account</h2>
                  <p className="text-slate-500 dark:text-white/70 font-body">Join the elite network of river travelers today.</p>
                </header>

                <form className="space-y-5" onSubmit={handleRegister}>
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Full Name *</label>
                    <input name="fullName" type="text" required value={formData.fullName} onChange={handleChange} placeholder="Nguyễn Văn A" className={inputClasses} />
                  </div>

                  {/* DOB Row */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Date of Birth *</label>
                    <input name="dateOfBirth" type="date" required value={formData.dateOfBirth} onChange={handleChange} className={`${inputClasses} [&::-webkit-calendar-picker-indicator]:dark:invert`} />
                  </div>

                  {/* THAY ĐỔI: TRƯỜNG PHONE CÓ DROPDOWN QUỐC GIA */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Phone Number *</label>
                    <div className="relative group flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-transparent rounded-xl focus-within:ring-2 focus-within:ring-primary/40 dark:focus-within:ring-yellow-400/20 focus-within:border-primary dark:focus-within:border-transparent transition-all duration-300">

                      {/* Nút bật/tắt Dropdown */}
                      <button
                        type="button"
                        onClick={() => setShowPhoneDropdown(!showPhoneDropdown)}
                        className="flex items-center gap-2 pl-4 pr-3 py-3.5 text-slate-900 dark:text-white font-body outline-none border-r border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-l-xl transition-colors"
                      >
                        <span className="text-xl leading-none">{COUNTRIES.find(c => c.code === formData.phoneCode)?.flag}</span>
                        <span className="text-sm font-medium">{formData.phoneCode}</span>
                        <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-white/50">expand_more</span>
                      </button>

                      {/* Dropdown Menu */}
                      {showPhoneDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowPhoneDropdown(false)}></div>
                          <div className="absolute z-50 top-[110%] left-0 w-64 max-h-60 overflow-y-auto bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 rounded-xl py-2 no-scrollbar animate-fade-in-up">
                            {COUNTRIES.map((country) => (
                              <button
                                key={country.code}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, phoneCode: country.code }));
                                  setShowPhoneDropdown(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                              >
                                <span className="text-xl leading-none">{country.flag}</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white w-10">{country.code}</span>
                                <span className="text-xs font-medium text-slate-500 dark:text-white/60 truncate">{country.name}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Ô nhập số điện thoại */}
                      <input
                        name="phoneNumber"
                        type="tel"
                        required
                        value={formData.phoneNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setFormData(prev => ({ ...prev, phoneNumber: val }));
                          setErrorMsg("");
                        }}
                        placeholder="90 123 4567"
                        className="w-full px-4 py-3.5 bg-transparent border-none text-slate-900 dark:text-white font-body outline-none placeholder:text-slate-400 dark:placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Email (Optional)</label>
                    <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="name@domain.com" className={inputClasses} />
                  </div>

                  {/* OTP Channel (Chỉ hiện khi có nhập Email) */}
                  {formData.email.trim() !== "" && (
                    <div className="space-y-1.5 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                      <label className="block text-sm font-label font-bold text-slate-700 dark:text-white">Receive OTP via: *</label>
                      <div className="flex gap-6 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-white">
                          <input type="radio" name="otpChannel" value="email" checked={formData.otpChannel === "email"} onChange={handleChange} className="accent-primary" /> Email
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-white">
                          <input type="radio" name="otpChannel" value="phone" checked={formData.otpChannel === "phone"} onChange={handleChange} className="accent-primary" /> SMS / Phone
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Password & Confirm */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative">
                      <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Password *</label>
                      <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className={inputClasses}
                      />
                    </div>
                    <div className="space-y-1.5 relative">
                      <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Confirm *</label>
                      <input
                        name="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        required
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className={inputClasses}
                      />
                      <span onClick={() => setShowPassword(!showPassword)} className="material-symbols-outlined absolute right-3 top-9 text-slate-400 dark:text-white/40 cursor-pointer text-[18px]">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </div>
                  </div>

                  {/* Terms Checkbox */}
                  <div className="flex items-start gap-3 pt-2">
                    <input id="terms" name="termsAccepted" type="checkbox" required checked={formData.termsAccepted} onChange={handleChange} className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-primary mt-0.5 cursor-pointer" />
                    <label className="text-sm font-body text-slate-600 dark:text-white/70 leading-tight" htmlFor="terms">
                      I agree to the <a className="text-primary dark:text-yellow-400 font-bold hover:underline" href="#">Terms of Service</a> and <a className="text-primary dark:text-yellow-400 font-bold hover:underline" href="#">Privacy Policy</a>.
                    </label>
                  </div>

                  <button type="submit" disabled={isLoading} className="w-full liquid-gradient disabled:opacity-70 text-on-primary-fixed font-headline font-bold py-4 rounded-full shadow-md hover:shadow-lg hover:scale-[1.02] transition-all flex justify-center items-center gap-2">
                    {isLoading ? "Processing..." : "Register Account"}
                  </button>

                  <div className="text-center pt-4">
                    <p className="text-sm text-slate-600 dark:text-white/70 font-body">
                      Already have an account? <Link to="/login" className="font-bold text-primary dark:text-yellow-400 hover:underline ml-1">Sign In</Link>
                    </p>
                  </div>
                </form>
              </>
            )}

            {/* BƯỚC 2: MÀN HÌNH XÁC THỰC OTP */}
            {step === 2 && (
              <div className="animate-fade-in-up">
                <header className="mb-8 text-center">
                  <h2 className="font-headline text-3xl font-bold text-slate-900 dark:text-white mb-2">Verify Account</h2>
                  <p className="text-slate-600 dark:text-white/70 font-body text-sm">
                    We've sent an OTP code to your {formData.otpChannel === 'email' ? 'Email' : 'Phone'}
                    <br />
                    <span className="font-bold text-slate-900 dark:text-white mt-1 inline-block">
                      {formData.otpChannel === 'email' ? formData.email : `${formData.phoneCode}${formData.phoneNumber.replace(/^0+/, '')}`}
                    </span>
                  </p>
                </header>

                <form className="space-y-6" onSubmit={handleVerifyOtp}>
                  <div className="space-y-2 text-center">
                    <input
                      type="text"
                      maxLength="10"
                      required
                      value={otpCode}
                      onChange={(e) => { setOtpCode(e.target.value); setErrorMsg(""); }}
                      placeholder="Enter OTP"
                      className="w-full text-center tracking-[0.5em] font-headline font-bold text-2xl px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-transparent rounded-xl focus:ring-2 focus:ring-primary/40 dark:focus:ring-yellow-400/20 focus:border-primary dark:focus:border-transparent text-slate-900 dark:text-white outline-none transition-all uppercase"
                    />
                  </div>

                  <button type="submit" disabled={isLoading} className="w-full liquid-gradient disabled:opacity-70 text-on-primary-fixed font-headline font-bold py-4 rounded-full shadow-md hover:shadow-lg hover:scale-[1.02] transition-all">
                    {isLoading ? "Verifying..." : "Verify OTP"}
                  </button>
                </form>

                <div className="text-center mt-8">
                  {!canResend ? (
                    <p className="text-sm text-slate-500 dark:text-white/60 font-medium">
                      Resend OTP in <span className="font-bold text-primary dark:text-yellow-400">{formatTime(timeLeft)}</span>
                    </p>
                  ) : (
                    <div className="flex flex-col items-center gap-2 animate-fade-in-up">
                      <p className="text-sm text-slate-600 dark:text-white/70 font-body mb-1">Didn't receive the code?</p>
                      <button
                        onClick={handleResendOtp}
                        disabled={isLoading}
                        className="text-sm font-bold text-primary dark:text-yellow-400 hover:underline disabled:opacity-50 transition-all"
                      >
                        Resend OTP
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};