import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useApp } from "../../context/AppContext";
import { forgotPassword, resetPassword, resendRegisterOtp } from "../../services/authService";

export const ForgotPassword = () => {
  const { lang, isDarkMode } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // BƯỚC 1: NHẬP EMAIL / SỐ ĐIỆN THOẠI
  const [emailOrPhone, setEmailOrPhone] = useState("");

  // BƯỚC 2: XÁC THỰC OTP + MẬT KHẨU MỚI
  const [challengeId, setChallengeId] = useState(null);
  const [maskedTarget, setMaskedTarget] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [expireTime, setExpireTime] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(60);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Bộ đếm thời gian hiệu lực OTP
  useEffect(() => {
    let timer;
    if (step === 2 && expireTime > 0) {
      timer = setInterval(() => setExpireTime((prev) => prev - 1), 1000);
    } else if (expireTime === 0 && step === 2) {
      setStep(1);
      setErrorMsg(
        lang === "VN"
          ? "Phiên xác thực đã hết hạn, vui lòng yêu cầu mã mới."
          : "Verification session expired, please request a new code."
      );
    }
    return () => clearInterval(timer);
  }, [step, expireTime, lang]);

  // Bộ đếm thời gian chờ gửi lại OTP
  useEffect(() => {
    let timer;
    if (step === 2 && resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  // BƯỚC 1: GỬI YÊU CẦU OTP QUÊN MẬT KHẨU
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!emailOrPhone.trim()) {
      setErrorMsg(lang === "VN" ? "Vui lòng nhập Email hoặc Số điện thoại." : "Please enter your Email or Phone number.");
      return;
    }

    try {
      setIsLoading(true);
      const response = await forgotPassword(emailOrPhone.trim());

      setChallengeId(response.challengeId ?? response.id);
      setMaskedTarget(response.maskedDestination || response.maskedEmail || response.maskedPhone || emailOrPhone.trim());

      const now = new Date().getTime();
      const expireDiff = response.expiresAt
        ? Math.max(0, Math.floor((new Date(response.expiresAt).getTime() - now) / 1000))
        : 300;
      const resendDiff = response.resendAvailableAt
        ? Math.max(0, Math.floor((new Date(response.resendAvailableAt).getTime() - now) / 1000))
        : 60;

      setExpireTime(expireDiff > 0 ? expireDiff : 300);
      setResendCooldown(resendDiff > 0 ? resendDiff : 60);

      setStep(2);
    } catch (error) {
      console.error("Lỗi yêu cầu OTP quên mật khẩu:", error);
      setErrorMsg(
        error.response?.data?.message ||
          (lang === "VN" ? "Không thể gửi mã OTP. Vui lòng kiểm tra lại thông tin." : "Failed to send OTP. Please check your information.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  // BƯỚC 2: ĐẶT LẠI MẬT KHẨU BẰNG OTP
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!otpCode || otpCode.length < 6) {
      setErrorMsg(lang === "VN" ? "Vui lòng nhập đủ mã OTP." : "Please enter the complete OTP code.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg(lang === "VN" ? "Mật khẩu mới phải có ít nhất 8 ký tự." : "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(lang === "VN" ? "Mật khẩu xác nhận không khớp!" : "Passwords do not match!");
      return;
    }

    try {
      setIsLoading(true);
      await resetPassword({
        challengeId,
        code: otpCode,
        newPassword,
      });

      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Thành công!" : "Success!",
        text: lang === "VN" ? "Mật khẩu của bạn đã được đặt lại thành công." : "Your password has been reset successfully.",
        confirmButtonColor: "#124757",
        background: isDarkMode ? "#1e293b" : "#fff",
        color: isDarkMode ? "#fff" : "#000",
      }).then(() => navigate("/login"));
    } catch (error) {
      console.error("Lỗi đặt lại mật khẩu:", error);
      setErrorMsg(
        error.response?.data?.message ||
          (lang === "VN" ? "Mã OTP không hợp lệ hoặc đã hết hạn." : "Invalid or expired OTP.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  // GỬI LẠI MÃ OTP
  const handleResendOtp = async () => {
    setErrorMsg("");
    try {
      setIsLoading(true);
      const response = await resendRegisterOtp(challengeId);

      if (response.challengeId ?? response.id) {
        setChallengeId(response.challengeId ?? response.id);
      }

      const now = new Date().getTime();
      const expireDiff = response.expiresAt
        ? Math.max(0, Math.floor((new Date(response.expiresAt).getTime() - now) / 1000))
        : 300;
      const resendDiff = response.resendAvailableAt
        ? Math.max(0, Math.floor((new Date(response.resendAvailableAt).getTime() - now) / 1000))
        : 60;

      setExpireTime(expireDiff > 0 ? expireDiff : 300);
      setResendCooldown(resendDiff > 0 ? resendDiff : 60);

      Swal.fire({
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
      setErrorMsg(
        error.response?.data?.message || (lang === "VN" ? "Lỗi gửi lại OTP. Thử lại sau." : "Failed to resend OTP. Try again.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex font-body bg-white dark:bg-slate-900 transition-colors duration-300 overflow-x-hidden">
      {/* CỘT TRÁI: BANNER HÌNH ẢNH */}
      <div className="w-1/2 h-screen top-0 hidden md:block relative overflow-hidden shrink-0 select-none">
        <img
          src="https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png"
          alt="Waterbus Fullscreen Banner"
          className="w-full h-full object-cover transform scale-100 hover:scale-[1.01] transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#124757] via-[#124757]/40 to-transparent opacity-90"></div>

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

      {/* CỘT PHẢI: FORM QUÊN MẬT KHẨU */}
      <div className="flex-1 min-h-screen flex flex-col justify-center bg-white dark:bg-slate-900 px-6 py-12 sm:px-12 md:px-16 lg:px-24 relative">
        <Link
          to="/login"
          className="absolute top-8 right-8 text-slate-400 hover:text-[#124757] dark:hover:text-[#FFD100] transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider z-20"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
          {lang === "VN" ? "Đóng" : "Close"}
        </Link>

        <div className="w-full max-w-md mx-auto space-y-8 animate-fade-in">
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-headline font-black text-[#124757] dark:text-yellow-400 tracking-tight">
              {lang === "VN" ? "Quên Mật Khẩu" : "Forgot Password"}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              {step === 1
                ? lang === "VN"
                  ? "Nhập Email hoặc Số điện thoại để nhận mã OTP"
                  : "Enter your Email or Phone to receive an OTP code"
                : lang === "VN"
                ? `Nhập mã OTP đã gửi đến ${maskedTarget} và mật khẩu mới`
                : `Enter the OTP sent to ${maskedTarget} and your new password`}
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100 dark:border-red-500/20 shadow-inner">
              <span className="material-symbols-outlined text-[20px]">error</span>
              {errorMsg}
            </div>
          )}

          {/* BƯỚC 1: NHẬP EMAIL / SỐ ĐIỆN THOẠI */}
          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
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
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#124757] dark:bg-[#FFD100] text-white dark:text-slate-900 font-headline font-black uppercase tracking-wider py-4 rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-70 transition-all flex justify-center items-center gap-2 mt-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : lang === "VN" ? (
                  "Gửi mã OTP"
                ) : (
                  "Send OTP"
                )}
              </button>

              <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                {lang === "VN" ? "Đã nhớ mật khẩu?" : "Remembered your password?"}{" "}
                <Link to="/login" className="font-bold text-[#124757] dark:text-[#FFD100] hover:underline">
                  {lang === "VN" ? "Đăng nhập" : "Sign in"}
                </Link>
              </p>
            </form>
          )}

          {/* BƯỚC 2: XÁC THỰC OTP + ĐẶT MẬT KHẨU MỚI */}
          {step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-5 animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lang === "VN" ? "Mã OTP" : "OTP Code"}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 text-center text-2xl font-black tracking-[0.5em] text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] focus:border-transparent transition-all"
                  placeholder="------"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lang === "VN" ? "Mật khẩu mới" : "New Password"}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    lock
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-12 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lang === "VN" ? "Xác nhận mật khẩu mới" : "Confirm New Password"}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    lock
                  </span>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-12 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showConfirmPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length < 6}
                className="w-full bg-[#124757] dark:bg-[#FFD100] text-white dark:text-slate-900 font-headline font-black uppercase tracking-wider py-4 rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-70 transition-all flex justify-center items-center gap-2 mt-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : lang === "VN" ? (
                  "Đặt lại mật khẩu"
                ) : (
                  "Reset Password"
                )}
              </button>

              <div className="text-center pt-2">
                {resendCooldown > 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    {lang === "VN" ? "Gửi lại mã mới sau: " : "Resend OTP in "}
                    <span className="font-bold text-[#124757] dark:text-[#FFD100]">{formatTime(resendCooldown)}</span>
                  </p>
                ) : (
                  <div className="flex flex-col items-center gap-2 animate-fade-in-up">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      {lang === "VN" ? "Bạn vẫn chưa nhận được mã?" : "Didn't receive the code?"}
                    </p>
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isLoading}
                      className="text-sm font-bold text-[#124757] dark:text-[#FFD100] hover:underline disabled:opacity-50 transition-all"
                    >
                      {lang === "VN" ? "Gửi lại mã OTP mới" : "Resend OTP"}
                    </button>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 mt-6 uppercase tracking-wider font-bold">
                  {lang === "VN" ? "Mã hết hạn sau: " : "Session expires in "} {formatTime(expireTime)}
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};