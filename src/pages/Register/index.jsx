import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useApp } from "../../context/AppContext";
import { registerCustomer, verifyRegisterOtp, resendRegisterOtp } from "../../services/authService";
import { useSelector } from "react-redux";

import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

export const Register = () => {
  const { lang, isDarkMode } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [challengeId, setChallengeId] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [expireTime, setExpireTime] = useState(300); 
  const [resendCooldown, setResendCooldown] = useState(60); 

  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    phone: "", 
    email: "",
    password: "",
    confirmPassword: "",
    otpChannel: "phone",
    termsAccepted: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); 
  const [errorMsg, setErrorMsg] = useState("");
  
  const [fieldErrors, setFieldErrors] = useState({});

  const { isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    let interval;
    if (step === 2) {
      interval = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        setExpireTime((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            Swal.fire({
              icon: 'warning',
              title: lang === "VN" ? 'Hết thời gian' : 'Session Expired',
              text: lang === "VN" ? 'Phiên đăng ký đã hết hạn sau 5 phút. Vui lòng đăng ký lại.' : 'Registration session expired after 5 minutes. Please register again.',
              background: isDarkMode ? '#1e293b' : '#ffffff',
              color: isDarkMode ? '#ffffff' : '#0f172a',
              confirmButtonColor: "#3085d6",
              allowOutsideClick: false
            }).then(() => {
              setStep(1);
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, lang, isDarkMode]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // HÀM KIỂM TRA LỖI TỪNG FIELD ĐỘC LẬP
  const getFieldError = (name, value) => {
    switch (name) {
      case "fullName":
        return (!value.trim() || value.length > 150) ? (lang === "VN" ? "Họ tên không được trống và tối đa 150 ký tự." : "Invalid Full Name.") : "";
      case "dateOfBirth":
        if (value) {
          const dob = new Date(value);
          if (dob > new Date()) return lang === "VN" ? "Ngày sinh không hợp lệ (ở tương lai)." : "Date of birth cannot be in the future.";
        }
        return "";
      case "phone":
        return (!value || !/^\+[1-9]\d{7,14}$/.test(value)) ? (lang === "VN" ? "Số điện thoại không hợp lệ." : "Invalid phone format.") : "";
      case "password":
        return (value.length < 6) ? (lang === "VN" ? "Mật khẩu phải có ít nhất 6 ký tự." : "Password must be at least 6 characters.") : "";
      case "confirmPassword":
        return (value !== formData.password) ? (lang === "VN" ? "Mật khẩu xác nhận không khớp." : "Passwords do not match.") : "";
      case "termsAccepted":
        return (!value) ? (lang === "VN" ? "Vui lòng đồng ý với điều khoản." : "You must accept the terms.") : "";
      default:
        return "";
    }
  };

  // XỬ LÝ ON-BLUR (KHI NGƯỜI DÙNG RỜI KHỎI Ô NHẬP)
  const handleBlur = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    const error = getFieldError(name, val);
    setFieldErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    
    setFormData((prev) => ({ ...prev, [name]: val }));
    setErrorMsg("");

    // Xóa lỗi tạm thời của field đang gõ để UI phản hồi nhanh
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: "" }));
    }

    // Đặc biệt: Nếu đổi pass thì phải check lại confirmPass
    if (name === "password" && formData.confirmPassword) {
      setFieldErrors(prev => ({ 
        ...prev, 
        confirmPassword: val !== formData.confirmPassword ? (lang === "VN" ? "Mật khẩu xác nhận không khớp." : "Passwords do not match.") : "" 
      }));
    }
  };

  // HÀM ĐÁNH GIÁ ĐỘ MẠNH PASSWORD
  const getPasswordStrength = (pass) => {
    if (!pass) return null;
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1; // Có viết hoa
    if (/[0-9]/.test(pass)) score += 1; // Có số
    if (/[^A-Za-z0-9]/.test(pass)) score += 1; // Có ký tự đặc biệt

    if (score <= 2) return { text: lang === "VN" ? "Yếu" : "Weak", color: "bg-red-500", textColor: "text-red-500", width: "w-1/3" };
    if (score <= 4) return { text: lang === "VN" ? "Trung bình" : "Fair", color: "bg-yellow-500", textColor: "text-yellow-500", width: "w-2/3" };
    return { text: lang === "VN" ? "Mạnh" : "Strong", color: "bg-green-500", textColor: "text-green-500", width: "w-full" };
  };

  // HÀM VALIDATE CÁC THÔNG TIN
  const validateForm = () => {
    const newErrors = {
      fullName: getFieldError("fullName", formData.fullName),
      dateOfBirth: getFieldError("dateOfBirth", formData.dateOfBirth),
      phone: getFieldError("phone", formData.phone),
      password: getFieldError("password", formData.password),
      confirmPassword: getFieldError("confirmPassword", formData.confirmPassword),
      termsAccepted: getFieldError("termsAccepted", formData.termsAccepted),
    };
    setFieldErrors(newErrors);
    
    const hasError = Object.values(newErrors).some(err => err !== "");
    return hasError ? (lang === "VN" ? "Vui lòng kiểm tra lại các trường thông tin bị đỏ." : "Please check the highlighted fields.") : null;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      setErrorMsg(error);
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        fullName: formData.fullName,
        dateOfBirth: formData.dateOfBirth || null, 
        phone: formData.phone,
        password: formData.password,
        email: formData.email.trim() !== "" ? formData.email : undefined,
        otpChannel: formData.email.trim() !== "" ? formData.otpChannel : "phone"
      };

      const response = await registerCustomer(payload);

      if (response && response.challengeId) {
        setChallengeId(response.challengeId);
        setExpireTime(300);
        setResendCooldown(60);
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

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      await resendRegisterOtp(challengeId);
      setExpireTime(300);
      setResendCooldown(60);
      
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
      const beErrorMsg = err?.response?.data?.message || "";
      Swal.fire({
        icon: 'error',
        title: lang === "VN" ? 'Lỗi' : 'Error',
        text: beErrorMsg || (lang === "VN" ? 'Không thể gửi lại OTP lúc này.' : 'Cannot resend OTP at this time.'),
        background: isDarkMode ? '#1e293b' : '#ffffff',
        color: isDarkMode ? '#ffffff' : '#0f172a',
      });

      if (beErrorMsg.toLowerCase().includes("hết hạn") || 
          beErrorMsg.toLowerCase().includes("expired") || 
          beErrorMsg.toLowerCase().includes("hủy")) {
         setStep(1);
      }
    } finally {
      setIsLoading(false);
    }
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

  const pwdStrength = getPasswordStrength(formData.password);

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

        <section className="w-full md:w-1/2 lg:w-2/5 bg-white dark:bg-slate-900 flex flex-col justify-start px-6 lg:px-20 relative transition-colors h-screen overflow-y-auto">
          {/* ĐÃ CHỈNH pt-32 THÀNH pt-20 ĐỂ FORM ĐƯỢC KÉO LÊN TRÊN */}
          <div className="w-full max-w-md mx-auto pt-20 lg:pt-24 pb-12">

            {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
                <span className="material-symbols-outlined inline-block align-text-bottom mr-1 text-[18px]">error</span>
                {errorMsg}
              </div>
            )}

            {step === 1 && (
              <>
                <header className="mb-8">
                  <h2 className="font-headline text-3xl font-bold text-slate-900 dark:text-white mb-2">Create an account</h2>
                  <p className="text-slate-500 dark:text-white/70 font-body">Join the elite network of river travelers today.</p>
                </header>

                <form className="space-y-4" onSubmit={handleRegister}>
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Full Name *</label>
                    <input name="fullName" type="text" required value={formData.fullName} onChange={handleChange} onBlur={handleBlur} placeholder="Nguyễn Văn A" className={getInputClasses("fullName")} />
                    {fieldErrors.fullName && <p className="text-red-500 text-xs ml-1 mt-1">{fieldErrors.fullName}</p>}
                  </div>

                  {/* Date Of Birth */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Date of Birth (Optional)</label>
                    <input name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} onBlur={handleBlur} className={`${getInputClasses("dateOfBirth")} [&::-webkit-calendar-picker-indicator]:dark:invert`} />
                    {fieldErrors.dateOfBirth && <p className="text-red-500 text-xs ml-1 mt-1">{fieldErrors.dateOfBirth}</p>}
                  </div>

                  {/* Phone Input */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Phone Number *</label>
                    <PhoneInput
                      international
                      defaultCountry="VN"
                      value={formData.phone}
                      onChange={(value) => {
                        setFormData((prev) => ({ ...prev, phone: value }));
                        setErrorMsg("");
                        if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: "" }));
                      }}
                      onBlur={() => handleBlur({ target: { name: "phone", value: formData.phone } })}
                      className={phoneInputClasses}
                    />
                    {fieldErrors.phone && <p className="text-red-500 text-xs ml-1 mt-1">{fieldErrors.phone}</p>}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Email (Optional)</label>
                    <input name="email" type="email" value={formData.email} onChange={handleChange} onBlur={handleBlur} placeholder="name@domain.com" className={getInputClasses("email")} />
                  </div>

                  {/* OTP Channel */}
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

                  {/* PASSWORD KÈM THANH ĐO ĐỘ MẠNH */}
                  <div className="space-y-1.5 relative">
                    <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Password *</label>
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={getInputClasses("password")}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-[38px] text-slate-400 dark:text-white/40 cursor-pointer text-[20px] transition-colors hover:text-primary dark:hover:text-yellow-400">
                      <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                    </button>
                    {fieldErrors.password && <p className="text-red-500 text-xs ml-1 mt-1">{fieldErrors.password}</p>}
                    
                    {/* UI Kiểm tra mật khẩu mạnh yếu Real-time */}
                    {formData.password && pwdStrength && (
                      <div className="mt-2 ml-1 pr-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-label text-slate-500 dark:text-white/60">
                            {lang === "VN" ? "Độ bảo mật:" : "Strength:"}
                          </span>
                          <span className={`text-xs font-bold ${pwdStrength.textColor}`}>
                            {pwdStrength.text}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${pwdStrength.color} ${pwdStrength.width} transition-all duration-300`}></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CONFIRM PASSWORD */}
                  <div className="space-y-1.5 relative">
                    <label className="block text-sm font-label font-bold text-slate-700 dark:text-white/90 ml-1">Confirm Password *</label>
                    <input
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className={getInputClasses("confirmPassword")}
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-[38px] text-slate-400 dark:text-white/40 cursor-pointer text-[20px] transition-colors hover:text-primary dark:hover:text-yellow-400">
                      <span className="material-symbols-outlined">{showConfirmPassword ? "visibility_off" : "visibility"}</span>
                    </button>
                    {fieldErrors.confirmPassword && <p className="text-red-500 text-xs ml-1 mt-1">{fieldErrors.confirmPassword}</p>}
                  </div>

                  {/* Terms Checkbox */}
                  <div className="flex items-start gap-3 pt-2">
                    <input id="terms" name="termsAccepted" type="checkbox" required checked={formData.termsAccepted} onChange={handleChange} onBlur={handleBlur} className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-primary mt-0.5 cursor-pointer" />
                    <label className="text-sm font-body text-slate-600 dark:text-white/70 leading-tight" htmlFor="terms">
                      I agree to the <a className="text-primary dark:text-yellow-400 font-bold hover:underline" href="#">Terms of Service</a> and <a className="text-primary dark:text-yellow-400 font-bold hover:underline" href="#">Privacy Policy</a>.
                    </label>
                  </div>
                  {fieldErrors.termsAccepted && <p className="text-red-500 text-xs ml-8">{fieldErrors.termsAccepted}</p>}

                  <button type="submit" disabled={isLoading} className="w-full liquid-gradient disabled:opacity-70 text-on-primary-fixed font-headline font-bold py-4 rounded-full shadow-md hover:shadow-lg hover:scale-[1.02] transition-all flex justify-center items-center gap-2 mt-4">
                    {isLoading ? "Processing..." : "Register Account"}
                  </button>

                  <div className="text-center pt-2">
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
                  <div className="w-16 h-16 bg-primary/10 dark:bg-yellow-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl text-primary dark:text-yellow-400">mark_email_read</span>
                  </div>
                  <h2 className="font-headline text-3xl font-bold text-slate-900 dark:text-white mb-2">Verify Account</h2>
                  <p className="text-slate-600 dark:text-white/70 font-body text-sm">
                    We've sent an OTP code to your {formData.otpChannel === 'email' ? 'Email' : 'Phone'}
                    <br />
                    <span className="font-bold text-slate-900 dark:text-white mt-1 inline-block">
                      {formData.otpChannel === 'email' ? formData.email : formData.phone}
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
                  {resendCooldown > 0 ? (
                    <p className="text-sm text-slate-500 dark:text-white/60 font-medium">
                      Resend OTP in <span className="font-bold text-primary dark:text-yellow-400">{formatTime(resendCooldown)}</span>
                    </p>
                  ) : (
                    <div className="flex flex-col items-center gap-2 animate-fade-in-up">
                      <p className="text-sm text-slate-600 dark:text-white/70 font-body mb-1">Didn't receive the code?</p>
                      <button 
                        type="button"
                        onClick={handleResendOtp}
                        disabled={isLoading}
                        className="text-sm font-bold text-primary dark:text-yellow-400 hover:underline disabled:opacity-50 transition-all"
                      >
                        Resend OTP
                      </button>
                    </div>
                  )}
                  
                  <p className="text-[11px] text-slate-400 mt-6 uppercase tracking-wider font-label">
                    Session expires in {formatTime(expireTime)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};