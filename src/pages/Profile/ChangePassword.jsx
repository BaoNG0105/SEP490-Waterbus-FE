import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { changePasswordService } from "../../services/authService";
import Swal from "sweetalert2";
import { useDispatch } from "react-redux";
import { logout } from "../../redux/authSlice";

export const ChangePassword = () => {
  const { lang, isDarkMode } = useApp();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // THUẬT TOÁN KIỂM TRA ĐỘ MẠNH MẬT KHẨU
  const calculatePasswordStrength = (password) => {
    let score = 0;
    if (!password) return score;

    // 1. Ít nhất 8 ký tự
    if (password.length >= 8) score += 1;
    // 2. Chứa ít nhất 1 chữ hoa
    if (/[A-Z]/.test(password)) score += 1;
    // 3. Chứa ít nhất 1 chữ thường
    if (/[a-z]/.test(password)) score += 1;
    // 4. Chứa ít nhất 1 ký tự đặc biệt
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

    return score;
  };

  const strengthScore = calculatePasswordStrength(formData.newPassword);

  const renderStrengthBar = () => {
    const bars = [];
    for (let i = 1; i <= 4; i++) {
      let colorClass = "bg-slate-200 dark:bg-slate-700";

      if (i <= strengthScore) {
        if (strengthScore === 1) colorClass = "bg-rose-500";         
        else if (strengthScore === 2) colorClass = "bg-orange-400"; 
        else if (strengthScore === 3) colorClass = "bg-yellow-400"; 
        else if (strengthScore === 4) colorClass = "bg-emerald-500"; 
      }

      bars.push(
        <div key={i} className={`h-1.5 w-full rounded-full transition-all duration-300 ${colorClass}`}></div>
      );
    }
    return <div className="flex gap-1.5 mt-2">{bars}</div>;
  };

  // XỬ LÝ SUBMIT VÀ ĐĂNG XUẤT
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (strengthScore < 4) {
      setErrorMsg(
        lang === "VN"
          ? "Vui lòng nhập mật khẩu mới đạt đủ các yêu cầu bảo mật."
          : "Please ensure the new password meets all security requirements."
      );
      return;
    }

    if (formData.newPassword !== formData.confirmNewPassword) {
      setErrorMsg(lang === "VN" ? "Mật khẩu mới nhập lại không khớp nhau!" : "Confirm new password does not match!");
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setErrorMsg(lang === "VN" ? "Mật khẩu mới không được trùng với mật khẩu hiện tại!" : "New password must be different from current password!");
      return;
    }

    try {
      setIsLoading(true);
      
      const payload = {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      };

      await changePasswordService(payload);

      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đổi mật khẩu thành công!" : "Password Changed!",
        text: lang === "VN" ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại với mật khẩu mới." : "Session expired. Please log in again with your new password.",
        confirmButtonColor: "#124757",
        background: isDarkMode ? "#1e293b" : "#fff",
        color: isDarkMode ? "#fff" : "#000",
      }).then(() => {
        // Đăng xuất và đẩy về trang Login
        dispatch(logout());
        navigate("/login"); 
      });

    } catch (error) {
      console.error("Lỗi đổi mật khẩu:", error);
      if (error.response?.data?.errors) {
        const validationErrors = Object.values(error.response.data.errors).flat().join(" | ");
        setErrorMsg(validationErrors);
      } else {
        setErrorMsg(error.response?.data?.title || error.response?.data?.message || (lang === "VN" ? "Mật khẩu hiện tại không chính xác." : "Incorrect current password."));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors font-body flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
      
      <div className="absolute top-6 left-6 sm:top-8 sm:left-12 z-20">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          <span>{lang === "VN" ? "Quay lại hồ sơ" : "Back to Profile"}</span>
        </button>
      </div>

      <section className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-[#124757] dark:text-yellow-400 font-headline uppercase tracking-widest mb-1">
          {lang === "VN" ? "Đổi mật khẩu" : "Change Password"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
            {lang === "VN" ? "Thiết lập lại mật khẩu bảo mật" : "Reset your account security password"}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 text-xs font-bold flex items-start gap-2 border border-rose-100 dark:border-rose-500/20 animate-shake">
            <span className="material-symbols-outlined text-base">error</span>
            <span className="mt-0.5">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* MẬT KHẨU HIỆN TẠI */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              {lang === "VN" ? "Mật khẩu hiện tại (*)" : "Current Password (*)"}
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"} name="currentPassword" required
                value={formData.currentPassword} onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
                placeholder="••••••••"
              />
              <button
                type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showCurrent ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>
          </div>

          {/* MẬT KHẨU MỚI & THANH TIẾN TRÌNH */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex justify-between">
              <span>{lang === "VN" ? "Mật khẩu mới (*)" : "New Password (*)"}</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"} name="newPassword" required
                value={formData.newPassword} onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
                placeholder="••••••••"
              />
              <button
                type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showNew ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>
            
            {renderStrengthBar()}
            
            <p className={`text-[10px] font-medium mt-1.5 transition-colors ${strengthScore === 4 ? 'text-emerald-500' : 'text-slate-400'}`}>
              {strengthScore === 4 
                ? (lang === "VN" ? "✓ Mật khẩu đã đạt yêu cầu bảo mật mạnh." : "✓ Password meets strong security standards.")
                : (lang === "VN" ? "Yêu cầu: Ít nhất 8 ký tự, 1 chữ hoa, 1 chữ thường và 1 ký tự đặc biệt." : "Requires: Min 8 chars, 1 uppercase, 1 lowercase, 1 special char.")
              }
            </p>
          </div>

          {/* NHẬP LẠI MẬT KHẨU MỚI */}
          <div className="space-y-1 pt-1">
            <label className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              {lang === "VN" ? "Xác nhận mật khẩu mới (*)" : "Confirm New Password (*)"}
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"} name="confirmNewPassword" required
                value={formData.confirmNewPassword} onChange={handleInputChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
                placeholder="••••••••"
              />
              <button
                type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showConfirm ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>
          </div>

          {/* NÚT SUBMIT */}
          <button
            type="submit" disabled={isLoading}
            className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 py-4 mt-4 rounded-xl font-black font-headline uppercase text-sm tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
          >
            {isLoading && (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            )}
            {lang === "VN" ? "Xác nhận đổi mật khẩu" : "Update Password"}
          </button>
        </form>
      </section>
    </div>
  );
};