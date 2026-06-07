import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { useDispatch } from "react-redux";
import { loginSuccess } from "../../redux/authSlice";
import { sendGooglePhoneOtp, verifyGooglePhoneOtp } from "../../services/authService";

export const VerifyGooglePhone = () => {
  const { lang } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // Lấy tempToken được truyền từ trang Login sang
  const tempToken = location.state?.tempToken;

  const [step, setStep] = useState(1); // 1: Nhập SĐT, 2: Nhập OTP
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Bảo mật: Nếu truy cập trang này mà không có tempToken (VD: gõ URL trực tiếp) -> Đá về Login
  useEffect(() => {
    if (!tempToken) {
      navigate("/login", { replace: true });
    }
  }, [tempToken, navigate]);

  // XỬ LÝ BƯỚC 1: GỬI SỐ ĐIỆN THOẠI
  const handleSendPhone = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      setErrorMsg(lang === "VN" ? "Vui lòng nhập số điện thoại" : "Phone number required");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      // Gửi SĐT lên Backend. Backend sẽ kiểm tra trùng lặp và bắn OTP
      await sendGooglePhoneOtp({ phone, tempToken });
      
      // Thành công -> Chuyển sang bước nhập OTP
      setStep(2);
    } catch (error) {
      const backendError = error.response?.data?.message;
      setErrorMsg(backendError || (lang === "VN" ? "Số điện thoại đã tồn tại hoặc không hợp lệ." : "Phone number invalid or already exists."));
    } finally {
      setIsLoading(false);
    }
  };

  // XỬ LÝ BƯỚC 2: XÁC THỰC OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setErrorMsg(lang === "VN" ? "Vui lòng nhập mã OTP" : "OTP required");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      // Xác thực OTP. Thành công Backend sẽ trả về JWT thực (accessToken)
      const response = await verifyGooglePhoneOtp({ phone, otp, tempToken });
      
      if (response.accessToken) {
        dispatch(loginSuccess({ token: response.accessToken }));
        navigate("/", { replace: true }); // Về trang chủ
      }
    } catch (error) {
      const backendError = error.response?.data?.message;
      setErrorMsg(backendError || (lang === "VN" ? "Mã OTP không chính xác hoặc đã hết hạn." : "Invalid or expired OTP."));
    } finally {
      setIsLoading(false);
    }
  };

  if (!tempToken) return null; // Tránh render nháy khi redirect

  return (
    <div className="min-h-screen w-full flex font-body bg-white dark:bg-slate-900 transition-colors duration-300">
      {/* CỘT TRÁI: ẢNH NỀN GIAO DIỆN (GIỮ NGUYÊN LAYOUT ĐỒNG BỘ) */}
      <div className="w-1/2 h-screen top-0 hidden md:block relative overflow-hidden shrink-0 select-none">
        <img 
          src="https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png" 
          alt="Waterbus Banner" 
          className="w-full h-full object-cover transform scale-100 hover:scale-[1.01] transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#124757] via-[#124757]/40 to-transparent opacity-90"></div>
        <div className="absolute bottom-12 left-12 right-12 text-white space-y-2 z-10">
          <h2 className="font-headline font-black text-4xl uppercase tracking-wider text-[#FFD100]">WaterBus.</h2>
          <p className="text-base font-medium text-white/80 max-w-sm leading-relaxed">
            {lang === "VN" ? "Cập nhật thông tin liên lạc để hoàn tất trải nghiệm." : "Update your contact info to complete your profile."}
          </p>
        </div>
      </div>

      {/* CỘT PHẢI: FORM CẬP NHẬT SĐT VÀ XÁC NHẬN OTP */}
      <div className="flex-1 min-h-screen flex flex-col justify-center bg-white dark:bg-slate-800 px-6 py-12 sm:px-12 md:px-16 lg:px-24 relative">
        <Link 
          to="/login" 
          className="absolute top-8 right-8 text-slate-400 hover:text-[#124757] dark:hover:text-[#FFD100] transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider z-20"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {lang === "VN" ? "Quay lại" : "Back"}
        </Link>

        <div className="w-full max-w-md mx-auto space-y-8 animate-fade-in">
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-3xl font-headline font-black text-[#124757] dark:text-white tracking-tight">
              {lang === "VN" ? "Xác minh tài khoản" : "Verify Account"}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              {step === 1 
                ? (lang === "VN" ? "Nhập số điện thoại để hoàn tất liên kết tài khoản Google của bạn." : "Enter phone number to link your Google account.")
                : (lang === "VN" ? `Mã OTP đã được gửi đến SĐT: ${phone}` : `OTP sent to: ${phone}`)}
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 p-4 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100 dark:border-red-500/20 shadow-inner">
              <span className="material-symbols-outlined text-[20px]">error</span>
              {errorMsg}
            </div>
          )}

          {step === 1 ? (
            /* BƯỚC 1: FORM NHẬP SĐT */
            <form onSubmit={handleSendPhone} className="space-y-5 animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lang === "VN" ? "Số điện thoại" : "Phone Number"}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">call</span>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={lang === "VN" ? "Nhập số điện thoại của bạn..." : "Enter your phone number..."}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all"
                  />
                </div>
              </div>
              <button 
                type="submit" disabled={isLoading}
                className="w-full bg-[#124757] dark:bg-[#FFD100] text-white dark:text-slate-900 font-headline font-black uppercase tracking-wider py-4 rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-70 transition-all flex justify-center items-center gap-2 mt-4"
              >
                {isLoading ? <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"></div> : (lang === "VN" ? "Gửi mã OTP" : "Send OTP")}
              </button>
            </form>
          ) : (
            /* BƯỚC 2: FORM NHẬP OTP */
            <form onSubmit={handleVerifyOtp} className="space-y-5 animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lang === "VN" ? "Mã xác nhận OTP" : "OTP Verification Code"}
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">password</span>
                  <input 
                    type="text" 
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="••••••"
                    maxLength={6}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-sm tracking-[0.5em] text-center font-black text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] transition-all"
                  />
                </div>
              </div>
              <button 
                type="submit" disabled={isLoading}
                className="w-full bg-[#124757] dark:bg-[#FFD100] text-white dark:text-slate-900 font-headline font-black uppercase tracking-wider py-4 rounded-xl text-sm shadow-md hover:opacity-90 disabled:opacity-70 transition-all flex justify-center items-center gap-2 mt-4"
              >
                {isLoading ? <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"></div> : (lang === "VN" ? "Xác nhận & Đăng nhập" : "Verify & Login")}
              </button>
              <button 
                type="button" 
                onClick={() => setStep(1)}
                className="w-full text-center text-xs font-bold text-slate-400 hover:text-[#124757] dark:hover:text-[#FFD100] mt-2 transition-colors uppercase"
              >
                {lang === "VN" ? "Sử dụng số điện thoại khác" : "Use a different phone number"}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};