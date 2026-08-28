import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";

import { registerCustomer, verifyRegisterOtp, resendRegisterOtp } from "../../services/authService";

import { FormSelect } from "../../components/FormSelect";
import { AppDateInput } from "../../components/AppDateInput";
import { NationalitySelect } from "../../components/NationalitySelect";
import { required } from "../../utils/requiredStar";

import { getApiErrorMessage } from "../../utils/apiError";
import { getTodayDateString } from "../../utils/dateOnly";
import { isBlank, isValidEmailFormat, isValidPhoneFormat } from "../../utils/formValidation";
import { notify } from "../../utils/swalToast";

/** UI dùng SMS/EMAIL; BE chỉ nhận phone/email. */
const toApiOtpChannel = (channel) => {
  const value = String(channel || "").trim().toUpperCase();
  if (value === "EMAIL") return "email";
  return "phone";
};

const MAX_OTP_ATTEMPTS = 5;

const SELECT_TRIGGER_CLASS =
  "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner";

// Field lỗi (đã touched) → đổi viền sang đỏ thay vì viền slate mặc định.
const withErrorBorder = (base, hasError) =>
  hasError ? base.replace(/border-slate-200 dark:border-slate-700/, "border-rose-500 dark:border-rose-500") : base;
const fieldErrorText = "mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400";

export const Register = () => {
  const { lang, isDarkMode } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [challengeId, setChallengeId] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [otpFailedAttempts, setOtpFailedAttempts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [expireTime, setExpireTime] = useState(300); 
  const [resendCooldown, setResendCooldown] = useState(60); 

  // Lưu thông tin đích đến đã được che (Masked) để hiện lên màn hình bảo mật OTP
  const [maskedTarget, setMaskedDestination] = useState("");

  // STATE LƯU TRỮ DỮ LIỆU ĐĂNG KÝ
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    phone: "", 
    email: "",
    password: "",
    confirmPassword: "",
    otpChannel: "SMS",
    gender: "Male",
    nationality: "Vietnam", 
    termsAccepted: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const genderOptions = useMemo(() => ([
    { value: "Male", label: lang === "VN" ? "Nam" : "Male" },
    { value: "Female", label: lang === "VN" ? "Nữ" : "Female" },
    { value: "Other", label: lang === "VN" ? "Khác" : "Other" },
  ]), [lang]);

  // KIỂM TRA ĐỘ MẠNH MẬT KHẨU: tối thiểu 8 ký tự, 1 chữ hoa, 1 số, 1 ký tự đặc biệt
  const passwordCriteria = useMemo(() => ({
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[^A-Za-z0-9]/.test(formData.password),
  }), [formData.password]);

  const passwordScore = Object.values(passwordCriteria).filter(Boolean).length;
  const isPasswordStrong = passwordScore === 4;

  const strengthBarColors = ["bg-rose-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-500"];
  const strengthLabels = lang === "VN"
    ? ["Rất yếu", "Yếu", "Trung bình", "Khá", "Mạnh"]
    : ["Very weak", "Weak", "Medium", "Good", "Strong"];
  const strengthTextColors = ["text-rose-500", "text-rose-500", "text-orange-500", "text-yellow-500", "text-emerald-500"];

  const passwordRules = [
    { key: "length", met: passwordCriteria.length, label: lang === "VN" ? "Tối thiểu 8 ký tự" : "At least 8 characters" },
    { key: "uppercase", met: passwordCriteria.uppercase, label: lang === "VN" ? "1 chữ hoa" : "1 uppercase letter" },
    { key: "number", met: passwordCriteria.number, label: lang === "VN" ? "1 chữ số" : "1 number" },
    { key: "special", met: passwordCriteria.special, label: lang === "VN" ? "1 ký tự đặc biệt" : "1 special character" },
  ];

  // Validate real-time toàn bộ field bắt buộc — lỗi chỉ hiện cho field đã "touched" (rời khỏi ít
  // nhất 1 lần), nhưng nút Đăng ký bị khóa ngay khi còn lỗi dù chưa touched hết.
  const [touchedFields, setTouchedFields] = useState({});
  const handleBlur = (e) => {
    setTouchedFields((prev) => ({ ...prev, [e.target.name]: true }));
  };

  const fieldErrors = useMemo(() => {
    const errors = {};
    if (isBlank(formData.fullName)) {
      errors.fullName = lang === "VN" ? "Vui lòng nhập họ và tên." : "Full name is required.";
    }

    const hasPhone = !isBlank(formData.phone);
    const hasEmail = !isBlank(formData.email);
    if (!hasPhone && !hasEmail) {
      errors.contact = lang === "VN"
        ? "Vui lòng nhập Số điện thoại hoặc Email."
        : "Please provide either a Phone number or an Email.";
    }
    if (hasPhone && !isValidPhoneFormat(formData.phone)) {
      errors.phone = lang === "VN"
        ? "Số điện thoại không hợp lệ (VD: 0901234567)."
        : "Invalid phone number (e.g. 0901234567).";
    }
    if (hasEmail && !isValidEmailFormat(formData.email)) {
      errors.email = lang === "VN" ? "Email không đúng định dạng." : "Invalid email format.";
    }

    if (isBlank(formData.password)) {
      errors.password = lang === "VN" ? "Vui lòng nhập mật khẩu." : "Password is required.";
    } else if (!isPasswordStrong) {
      errors.password = lang === "VN"
        ? "Mật khẩu chưa đủ mạnh, xem các tiêu chí bên dưới."
        : "Password is not strong enough, see the criteria below.";
    }

    if (isBlank(formData.confirmPassword)) {
      errors.confirmPassword = lang === "VN" ? "Vui lòng xác nhận mật khẩu." : "Please confirm your password.";
    } else if (formData.confirmPassword !== formData.password) {
      errors.confirmPassword = lang === "VN" ? "Mật khẩu xác nhận không khớp." : "Passwords do not match.";
    }

    if (!formData.termsAccepted) {
      errors.termsAccepted = lang === "VN"
        ? "Bạn cần đồng ý với Điều khoản sử dụng."
        : "You must accept the Terms of Use.";
    }

    return errors;
  }, [formData, isPasswordStrong, lang]);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  const showOtpSelection = formData.phone.trim() !== "" && formData.email.trim() !== "";

  // TỰ ĐỘNG GÁN KÊNH OTP KHI CHỈ NHẬP 1 TRONG 2
  useEffect(() => {
    if (formData.phone.trim() !== "" && formData.email.trim() === "") {
      setFormData((prev) => ({ ...prev, otpChannel: "SMS" }));
    } else if (formData.email.trim() !== "" && formData.phone.trim() === "") {
      setFormData((prev) => ({ ...prev, otpChannel: "EMAIL" }));
    }
  }, [formData.phone, formData.email]);

  // Bộ đếm thời gian hiệu lực OTP
  useEffect(() => {
    let timer;
    if (step === 2 && expireTime > 0) {
      timer = setInterval(() => setExpireTime(prev => prev - 1), 1000);
    } else if (expireTime === 0 && step === 2) {
      setStep(1);
      setErrorMsg(lang === "VN" ? "Phiên xác thực đã hết hạn, vui lòng đăng ký lại." : "Verification session expired, please register again.");
    }
    return () => clearInterval(timer);
  }, [step, expireTime, lang]);

  // Bộ đếm thời gian chờ gửi lại OTP
  useEffect(() => {
    let timer;
    if (step === 2 && resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // BƯỚC 1: XỬ LÝ NGHIỆP VỤ SUBMIT FORM ĐĂNG KÝ
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    // Bấm submit khi còn lỗi (VD: nhấn Enter trước khi rời hết field) → hiện hết lỗi lên thay vì
    // âm thầm chặn. Các rule chi tiết (SĐT/Email bắt buộc 1 trong 2, mật khẩu đủ mạnh, khớp xác
    // nhận, đồng ý điều khoản...) đã được validate real-time ở fieldErrors bên trên.
    setTouchedFields({
      fullName: true,
      phone: true,
      email: true,
      password: true,
      confirmPassword: true,
      termsAccepted: true,
    });
    if (hasFieldErrors) return;

    // 💡 NGHIỆP VỤ: Xử lý ngày sinh mặc định ngày hiện tại nếu bỏ trống
    let formattedDate = "";
    let dobToProcess = formData.dateOfBirth;
    if (!dobToProcess) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dobToProcess = `${yyyy}-${mm}-${dd}`;
    }
    const [year, month, day] = dobToProcess.split("-");
    formattedDate = `${day}/${month}/${year}`;

    const payload = {
      fullName: formData.fullName,
      dateOfBirth: formattedDate,
      password: formData.password,
      phone: formData.phone,
      email: formData.email,
      otpChannel: toApiOtpChannel(formData.otpChannel),
      gender: formData.gender,
      nationality: formData.nationality
    };

    try {
      setIsLoading(true);
      const response = await registerCustomer(payload);
      
      // Map "id" của response vào challengeId
      setChallengeId(response.id);
      setMaskedDestination(response.maskedDestination || response.maskedEmail);

      // Tính số giây đếm ngược động từ mốc thời gian thực tế Server trả về
      const now = new Date().getTime();
      const expireDiff = Math.max(0, Math.floor((new Date(response.expiresAt).getTime() - now) / 1000));
      const resendDiff = Math.max(0, Math.floor((new Date(response.resendAvailableAt).getTime() - now) / 1000));

      setExpireTime(expireDiff > 0 ? expireDiff : 300);
      setResendCooldown(resendDiff > 0 ? resendDiff : 60);
      setOtpFailedAttempts(0);
      setOtpCode("");
      
      setStep(2); // Tiến tới bước xác thực OTP

    } catch (error) {
      console.error("Lỗi đăng ký hành khách:", error);
      setErrorMsg(getApiErrorMessage(
        error,
        lang === "VN" ? "Đăng ký thất bại. Vui lòng thử lại." : "Registration failed. Please try again.",
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // BƯỚC 2: XÁC THỰC MÃ OTP KHI ĐĂNG KÝ
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!otpCode || otpCode.length < 6) {
      setErrorMsg(lang === "VN" ? "Vui lòng nhập đủ mã OTP." : "Please enter the complete OTP code.");
      return;
    }

    try {
      setIsLoading(true);
      
      // Đóng gói đúng mảng đối tượng { challengeId, code } theo quy định DTO Backend
      const payload = {
        challengeId: challengeId, 
        code: otpCode,           
      };

      await verifyRegisterOtp(payload);

      notify({
        icon: "success",
        title: lang === "VN" ? "Thành công!" : "Success!",
        text: lang === "VN" ? "Tài khoản của bạn đã được tạo thành công." : "Your account has been successfully created.",
        confirmButtonColor: "#124757",
        background: isDarkMode ? "#1e293b" : "#fff",
        color: isDarkMode ? "#fff" : "#000",
      }).then(() => navigate("/login"));

    } catch (error) {
      console.error("Lỗi khi xác thực OTP:", error);
      const apiMessage = getApiErrorMessage(
        error,
        lang === "VN" ? "Mã OTP không hợp lệ hoặc đã hết hạn." : "Invalid or expired OTP.",
      );
      // Lỗi mạng/5xx không phải do người dùng nhập sai nên không trừ lượt.
      if (!error?.response || Number(error.response.status) >= 500) {
        setErrorMsg(apiMessage);
        return;
      }
      const nextFailedAttempts = otpFailedAttempts + 1;

      if (nextFailedAttempts >= MAX_OTP_ATTEMPTS) {
        setStep(1);
        setChallengeId(0);
        setOtpCode("");
        setOtpFailedAttempts(0);
        setErrorMsg(
          lang === "VN"
            ? "Bạn đã nhập sai OTP 5 lần. Phiên xác thực đã đóng, vui lòng đăng ký lại."
            : "You entered an incorrect OTP 5 times. The verification session was closed; please register again.",
        );
      } else {
        setOtpFailedAttempts(nextFailedAttempts);
        setOtpCode("");
        const remainingAttempts = MAX_OTP_ATTEMPTS - nextFailedAttempts;
        setErrorMsg(
          lang === "VN"
            ? `${apiMessage} Bạn còn ${remainingAttempts} lần thử.`
            : `${apiMessage} You have ${remainingAttempts} attempts remaining.`,
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setErrorMsg("");
    try {
      setIsLoading(true);
      const response = await resendRegisterOtp(challengeId);
      
      // Đồng bộ cập nhật lại thời gian đếm ngược dựa trên mốc mới Server trả về
      const now = new Date().getTime();
      const expireDiff = Math.max(0, Math.floor((new Date(response.expiresAt).getTime() - now) / 1000));
      const resendDiff = Math.max(0, Math.floor((new Date(response.resendAvailableAt).getTime() - now) / 1000));

      setExpireTime(expireDiff > 0 ? expireDiff : 300);
      setResendCooldown(resendDiff > 0 ? resendDiff : 60);
      setOtpFailedAttempts(0);
      setOtpCode("");

      notify({
        icon: "success",
        title: lang === "VN" ? "Đã gửi lại OTP!" : "OTP Resent!",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
        background: isDarkMode ? "#1e293b" : "#fff",
        color: isDarkMode ? "#fff" : "#000",
      });
    } catch (error) {
      console.error("Lỗi gửi lại OTP:", error);
      setErrorMsg(getApiErrorMessage(
        error,
        lang === "VN" ? "Lỗi gửi lại OTP. Thử lại sau." : "Failed to resend OTP. Try again.",
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white dark:bg-slate-900 transition-colors font-body">
      
      {/* CỘT TRÁI - ẢNH BANNER */}
      <div className="hidden lg:block relative bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-black/30 z-10"></div>
        <img 
          src="https://pub-1d02c0e903fd425fae0b0bd4d59909b4.r2.dev/register.png" 
          alt="Register Banner" 
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute bottom-12 left-12 right-12 z-20 text-yellow-400 animate-fade-in-up">
          <h2 className="text-4xl font-black font-headline mb-4 leading-tight">
            {lang === "VN" ? "Hành Trình Chờ Đón Bạn" : "Your Journey Awaits"}
          </h2>
          <p className="text-white/80 text-sm max-w-md leading-relaxed">
            {lang === "VN" 
              ? "Tạo tài khoản ngay hôm nay để đặt vé nhanh chóng, quản lý chuyến đi dễ dàng và nhận các ưu đãi đặc quyền." 
              : "Create an account today for quick booking, easy trip management, and exclusive offers."}
          </p>
        </div>
      </div>

      {/* CỘT PHẢI - BIỂU MẪU */}
      <main className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24 relative overflow-y-auto custom-scrollbar h-screen">
        
        <div className="absolute top-6 left-6 sm:top-8 sm:left-12 z-20">
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span>{lang === "VN" ? "Trang chủ" : "Back to Site"}</span>
          </Link>
        </div>

        <div className="absolute top-6 right-6 sm:top-8 sm:right-12 z-20">
          <Link to="/login" className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors">
            {lang === "VN" ? "Đăng nhập" : "Login instead"}
          </Link>
        </div>

        <section className="w-full max-w-md mx-auto mt-10 lg:mt-0">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-[#124757] dark:text-yellow-400 font-headline uppercase tracking-widest mb-1">
            {lang === "VN" ? "Đăng ký tài khoản" : "Create Account"}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
              {step === 1 
                ? (lang === "VN" ? "Tạo tài khoản thành viên mới" : "Create a new passenger account")
                : (lang === "VN" ? "Xác thực mã bảo mật gửi đến bạn" : "Security Verification Challenge")
              }
            </p>
          </div>

          {/* HIỂN THỊ LỖI */}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 text-xs font-bold flex items-start gap-2 border border-rose-100 dark:border-rose-500/20 animate-shake">
              <span className="material-symbols-outlined text-base">error</span>
              <span className="mt-0.5">{errorMsg}</span>
            </div>
          )}

          {/* BƯỚC 1: ĐIỀN FORM ĐĂNG KÝ */}
          {step === 1 && (
            <form onSubmit={handleRegister} className="space-y-4 animate-fade-in">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {/* HỌ VÀ TÊN */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    {<>{lang === "VN" ? "Họ và Tên" : "Full Name"}{required()}</>}
                  </label>
                  <input
                    type="text" name="fullName" required
                    value={formData.fullName} onChange={handleChange} onBlur={handleBlur}
                    className={withErrorBorder("w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner", touchedFields.fullName && fieldErrors.fullName)}
                    placeholder="Nguyen Van A"
                  />
                  {touchedFields.fullName && fieldErrors.fullName && <p className={fieldErrorText}>{fieldErrors.fullName}</p>}
                </div>
                {/* NGÀY SINH */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    {lang === "VN" ? "Ngày sinh" : "Date of Birth"}
                  </label>
                  <AppDateInput
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    max={getTodayDateString()}
                    onChange={handleChange}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
                  />
                </div>
              </div>
              {/* EMAIL & PHONE */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  {lang === "VN" ? "Thông tin liên hệ" : "Contact information"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <input
                      type="tel" name="phone" value={formData.phone} onChange={handleChange} onBlur={handleBlur}
                      className={withErrorBorder("w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-md", touchedFields.phone && fieldErrors.phone)}
                      placeholder={lang === "VN" ? "Số điện thoại..." : "Phone Number..."}
                    />
                    {touchedFields.phone && fieldErrors.phone && <p className={fieldErrorText}>{fieldErrors.phone}</p>}
                  </div>
                  <div>
                    <input
                      type="email" name="email" value={formData.email} onChange={handleChange} onBlur={handleBlur}
                      className={withErrorBorder("w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-md", touchedFields.email && fieldErrors.email)}
                      placeholder="Email..."
                    />
                    {touchedFields.email && fieldErrors.email && <p className={fieldErrorText}>{fieldErrors.email}</p>}
                  </div>
                </div>
                <p className={(touchedFields.phone || touchedFields.email) && fieldErrors.contact ? fieldErrorText : "pt-0.5 text-[11px] font-medium text-slate-400"}>
                  {(touchedFields.phone || touchedFields.email) && fieldErrors.contact
                    ? fieldErrors.contact
                    : (lang === "VN" ? "Cần điền SĐT hoặc Email." : "Please fill in phone or email.")}
                </p>
              </div>
              {/* GIỚI TÍNH */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    {lang === "VN" ? "Giới tính" : "Gender"}
                  </label>
                  <FormSelect
                    value={formData.gender}
                    onChange={(value) => setFormData((prev) => ({ ...prev, gender: String(value || "Male") }))}
                    options={genderOptions}
                    className={SELECT_TRIGGER_CLASS}
                    placeholder={lang === "VN" ? "Chọn giới tính" : "Select gender"}
                  />
                </div>
                {/* QUỐC TỊCH */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    {lang === "VN" ? "Quốc tịch" : "Nationality"}
                  </label>
                  <NationalitySelect
                    value={formData.nationality}
                    onChange={(value) => setFormData((prev) => ({ ...prev, nationality: String(value || "Vietnam") }))}
                    className={SELECT_TRIGGER_CLASS}
                    placeholder={lang === "VN" ? "Chọn quốc tịch" : "Select nationality"}
                  />
                </div>
              </div>

              {showOtpSelection && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 animate-fade-in">
                  <label className="text-[10px] font-bold uppercase text-[#124757] dark:text-yellow-400 tracking-wider mb-1.5 sm:mb-0">
                    {lang === "VN" ? "Nhận mã xác nhận qua:" : "Receive verification via:"}
                  </label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="radio" name="otpChannel" value="SMS"
                        checked={formData.otpChannel === "SMS"} onChange={handleChange}
                        className="text-[#124757] focus:ring-[#124757] dark:text-yellow-400 dark:focus:ring-yellow-400 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">SMS</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="radio" name="otpChannel" value="EMAIL"
                        checked={formData.otpChannel === "EMAIL"} onChange={handleChange}
                        className="text-[#124757] focus:ring-[#124757] dark:text-yellow-400 dark:focus:ring-yellow-400 w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">Email</span>
                    </label>
                  </div>
                </div>
              )}
              {/* PASSWORD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    {<>{lang === "VN" ? "Mật khẩu" : "Password"}{required()}</>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"} name="password" required
                      value={formData.password} onChange={handleChange} onBlur={handleBlur}
                      className={withErrorBorder("w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner", touchedFields.password && fieldErrors.password)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                  {/* Chỉ hiện lỗi text khi để trống — khi có gõ nhưng chưa đủ mạnh thì bảng tiêu
                      chí bên dưới đã tự nêu rõ tiêu chí nào còn thiếu, không cần lặp lại bằng chữ. */}
                  {touchedFields.password && isBlank(formData.password) && (
                    <p className={fieldErrorText}>{fieldErrors.password}</p>
                  )}

                  {/* THANH TIẾN TRÌNH ĐỘ MẠNH MẬT KHẨU */}
                  {formData.password.length > 0 && (
                    <div className="space-y-1.5 pt-1 animate-fade-in">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1 flex-1">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                i < passwordScore ? strengthBarColors[passwordScore - 1] : "bg-slate-200 dark:bg-slate-700"
                              }`}
                            ></div>
                          ))}
                        </div>
                        <span className={`text-[10px] font-bold whitespace-nowrap ${strengthTextColors[passwordScore]}`}>
                          {strengthLabels[passwordScore]}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {passwordRules.map((rule) => (
                          <span
                            key={rule.key}
                            className={`flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                              rule.met ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {rule.met ? "check_circle" : "radio_button_unchecked"}
                            </span>
                            {rule.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    {<>{lang === "VN" ? "Xác nhận mật khẩu" : "Confirm"}{required()}</>}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"} name="confirmPassword" required
                      value={formData.confirmPassword} onChange={handleChange} onBlur={handleBlur}
                      className={withErrorBorder("w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner", touchedFields.confirmPassword && fieldErrors.confirmPassword)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showConfirmPassword ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                  {touchedFields.confirmPassword && fieldErrors.confirmPassword && (
                    <p className={fieldErrorText}>{fieldErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <div className="pt-2 pb-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox" name="termsAccepted"
                    checked={formData.termsAccepted} onChange={handleChange} onBlur={handleBlur}
                    className="mt-1 rounded text-[#124757] focus:ring-[#124757] dark:text-yellow-400 dark:focus:ring-yellow-400 cursor-pointer w-4 h-4"
                  />
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                    {lang === "VN" ? "Tôi đồng ý với " : "I agree to the "}
                    <a
                      href="/terms-and-policy"
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-[#124757] dark:text-yellow-400 hover:underline"
                    >
                      {lang === "VN" ? "Điều khoản dịch vụ" : "Terms of Service"}
                    </a>
                    {lang === "VN" ? " và " : " and "}
                    <a
                      href="/terms-and-policy"
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-[#124757] dark:text-yellow-400 hover:underline"
                    >
                      {lang === "VN" ? "Chính sách bảo mật" : "Privacy Policy"}
                    </a>.
                  </span>
                </label>
                {touchedFields.termsAccepted && fieldErrors.termsAccepted && (
                  <p className={fieldErrorText}>{fieldErrors.termsAccepted}</p>
                )}
              </div>
              {/* NÚT ĐĂNG KÝ */}
              <button
                type="submit" disabled={isLoading || hasFieldErrors}
                className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 py-4 mt-2 rounded-xl font-black font-headline uppercase text-sm tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
              >
                {isLoading && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                {lang === "VN" ? "Đăng ký tài khoản" : "Sign Up"}
              </button>
            </form>
          )}

          {/* BƯỚC 2: XÁC THỰC MÃ OTP */}
          {step === 2 && (
            <div className="animate-fade-in">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#124757]/10 dark:bg-yellow-400/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#124757]/20 dark:border-yellow-400/20">
                  <span className="material-symbols-outlined text-3xl text-[#124757] dark:text-yellow-400">lock_open</span>
                </div>
                <h3 className="text-xl font-black font-headline text-slate-800 dark:text-white mb-2">
                  {lang === "VN" ? "Nhập mã OTP" : "Enter OTP Code"}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-xs mx-auto">
                  {lang === "VN" 
                    ? `Hệ thống đã gửi mã xác minh gồm 6 chữ số đến ${maskedTarget}` 
                    : `We sent a 6-digit verification code to your ${maskedTarget}`}
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <input
                    type="text" maxLength={6} value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 text-center text-2xl font-black tracking-[0.5em] text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
                    placeholder="------"
                  />
                  <p className="mt-2 text-center text-[11px] font-bold text-slate-400">
                    {lang === "VN"
                      ? `Còn ${MAX_OTP_ATTEMPTS - otpFailedAttempts} lần nhập`
                      : `${MAX_OTP_ATTEMPTS - otpFailedAttempts} attempts remaining`}
                  </p>
                </div>

                <button
                  type="submit" disabled={isLoading || otpCode.length < 6}
                  className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 py-4 rounded-xl font-black font-headline uppercase text-sm tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                  {isLoading ? (lang === "VN" ? "Đang xác thực..." : "Verifying...") : (lang === "VN" ? "Xác thực OTP" : "Verify OTP")}
                </button>
              </form>

              <div className="text-center mt-8">
                {resendCooldown > 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    {lang === "VN" ? "Gửi lại mã mới sau: " : "Resend OTP in "} <span className="font-bold text-[#124757] dark:text-yellow-400">{formatTime(resendCooldown)}</span>
                  </p>
                ) : (
                  <div className="flex flex-col items-center gap-2 animate-fade-in-up">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-1">
                      {lang === "VN" ? "Bạn vẫn chưa nhận được mã?" : "Didn't receive the code?"}
                    </p>
                    <button 
                      type="button" onClick={handleResendOtp} disabled={isLoading}
                      className="text-sm font-bold text-[#124757] dark:text-yellow-400 hover:underline disabled:opacity-50 transition-all"
                    >
                      {lang === "VN" ? "Gửi lại mã OTP mới" : "Resend OTP"}
                    </button>
                  </div>
                )}
                
                <p className="text-[11px] text-slate-400 mt-8 uppercase tracking-wider font-bold">
                  {lang === "VN" ? "Mã hết hạn sau: " : "Session expires in "} {formatTime(expireTime)}
                </p>
              </div>
            </div>
          )}

        </section>
      </main>
    </div>
  );
};