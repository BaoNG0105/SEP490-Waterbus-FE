import { useState, useEffect, useMemo, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../../redux/authSlice";
import { fetchCurrentUserProfile, updateProfile } from "../../services/authService";
import Swal from "sweetalert2";
import "flag-icons/css/flag-icons.min.css";

import countries from "i18n-iso-countries";
import viLocale from "i18n-iso-countries/langs/vi.json";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(viLocale);
countries.registerLocale(enLocale);

// DATA MẪU TẠM THỜI
const mockUserStats = { points: 12840 };
const mockUpcomingTrips = []; // Lược bớt hiển thị chuyến đi để tập trung code

const convertDateForInput = (dateString) => {
  if (!dateString) return "";
  const parts = dateString.split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateString;
};

export const Profile = () => {
  const { lang, isDarkMode } = useApp();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);

  // Lấy danh sách quốc gia
  const countryList = useMemo(() => {
    const countryObj = countries.getNames(lang === "VN" ? "vi" : "en", { select: "official" });
    return Object.entries(countryObj).map(([code, name]) => ({
      code: code.toLowerCase(),
      name: name,
      isoCode: code
    }));
  }, [lang]);

  const [selectedFlag, setSelectedFlag] = useState("vn");

  const [profileData, setProfileData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    dob: "",
    gender: "Male",
    nationality: "Vietnam",
    avatarUrl: "",
    roleName: "Khách hàng",
    emailUnverified: false // Biến tạm lưu trạng thái chờ verify email
  });

  // HÀM TẢI DỮ LIỆU ĐƯỢC TÁCH RA ĐỂ GỌI LẠI SAU KHI CẬP NHẬT THÀNH CÔNG
  const loadProfileData = useCallback(async () => {
    try {
      setIsLoadingProfile(true);
      const data = await fetchCurrentUserProfile();

      const userNationality = data.nationality || "Vietnam";
      const matchedCountry = countryList.find(c => c.name === userNationality || c.isoCode.toUpperCase() === userNationality.toUpperCase());
      if (matchedCountry) setSelectedFlag(matchedCountry.code);

      setProfileData({
        fullName: data.fullName || "",
        email: data.email || "",
        phoneNumber: data.phoneNumber || "",
        dob: convertDateForInput(data.dateOfBirth),
        gender: data.gender || "Male",
        nationality: userNationality,
        avatarUrl: data.avatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
        roleName: data.roles?.[0]?.displayName || "Khách hàng"
      });
      setSelectedAvatarFile(null); // Reset lại file
    } catch (error) {
      console.error("Lỗi khi tải Profile:", error);
      if (error.response && error.response.status === 401) {
        Swal.fire({
          icon: "warning",
          title: lang === "VN" ? "Hết phiên đăng nhập!" : "Session Expired!",
          text: lang === "VN" ? "Vui lòng đăng nhập lại để tiếp tục." : "Please log in again to continue.",
          confirmButtonColor: "#124757",
        }).then(() => {
          dispatch(logout());
          navigate("/login");
        });
      }
    } finally {
      setIsLoadingProfile(false);
    }
  }, [countryList, dispatch, lang, navigate]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // ==========================================
  // XỬ LÝ NHẬP LIỆU & ĐỔI ẢNH (BẮT LỖI TỪ CLIENT)
  // ==========================================
  const handleProfileDataChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNationalityChange = (e) => {
    const matched = countryList.find(item => item.code === e.target.value);
    if (matched) {
      setSelectedFlag(matched.code);
      setProfileData(prev => ({
        ...prev,
        nationality: countries.getName(matched.isoCode, "en") // Gửi tiếng Anh lên BE
      }));
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        Swal.fire({ icon: 'error', title: 'Định dạng không hợp lệ', text: 'Chỉ hỗ trợ JPEG, PNG, WebP.' });
        e.target.value = null;
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire({ icon: 'error', title: 'File quá lớn', text: 'Dung lượng ảnh tối đa 5MB.' });
        e.target.value = null;
        return;
      }
      setSelectedAvatarFile(file);
      setProfileData(prev => ({ ...prev, avatarUrl: URL.createObjectURL(file) }));
    }
  };

  // ==========================================
  // SUBMIT CẬP NHẬT (TỰ ĐỘNG CHIA NHÁNH JSON / MULTIPART)
  // ==========================================
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);

    let formattedDate = null;
    if (profileData.dob) {
      const [year, month, day] = profileData.dob.split("-");
      formattedDate = `${day}/${month}/${year}`;
    }

    let payload;

    // NẾU CÓ ẢNH THÌ GÓI THÀNH FORMDATA
    if (selectedAvatarFile) {
      payload = new FormData();
      if (profileData.fullName) payload.append("fullName", profileData.fullName.trim());
      if (formattedDate) payload.append("dateOfBirth", formattedDate);
      if (profileData.gender) payload.append("gender", profileData.gender);
      if (profileData.nationality) payload.append("nationality", profileData.nationality);
      if (profileData.phoneNumber) payload.append("phoneNumber", profileData.phoneNumber.trim());
      if (profileData.email) payload.append("email", profileData.email.trim());
      payload.append("file", selectedAvatarFile);
    }
    // NẾU KHÔNG CÓ ẢNH THÌ GỬI JSON THƯỜNG
    else {
      payload = {
        fullName: profileData.fullName.trim() || undefined,
        dateOfBirth: formattedDate,
        gender: profileData.gender,
        nationality: profileData.nationality,
        phoneNumber: profileData.phoneNumber.trim() || undefined,
        email: profileData.email.trim() || undefined
      };
    }

    try {
      await updateProfile(payload);

      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Cập nhật thành công!" : "Profile Updated!",
        text: lang === "VN" ? "Hệ thống sẽ gửi OTP nếu bạn vừa thay đổi Email." : "OTP will be sent if email was changed.",
        confirmButtonColor: "#124757",
        background: isDarkMode ? "#1e293b" : "#fff",
        color: isDarkMode ? "#fff" : "#000",
      });

      setIsEditProfileOpen(false);
      loadProfileData(); // Render lại dữ liệu mới nhất

    } catch (error) {
      console.error("Lỗi cập nhật:", error);
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Cập nhật thất bại" : "Update Failed",
        text: error.response?.data?.message || "Vui lòng thử lại sau.",
        confirmButtonColor: "#124757"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    Swal.fire({
      title: lang === "VN" ? "Bạn có chắc chắn muốn đăng xuất?" : "Are you sure you want to log out?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#124757",
      cancelButtonColor: "#d33",
      confirmButtonText: lang === "VN" ? "Đăng xuất" : "Log out",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
      background: isDarkMode ? "#1e293b" : "#fff",
      color: isDarkMode ? "#fff" : "#000",
    }).then((result) => {
      if (result.isConfirmed) {
        dispatch(logout());
        navigate("/");
      }
    });
  };

  const labelClasses = "text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5 block";
  const inputClasses = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-10 px-4 sm:px-6 lg:px-8 font-body transition-colors">

      <div className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          {lang === "VN" ? "Quay lại" : "Back"}
        </button>
      </div>

      {isLoadingProfile ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-[2rem] overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700/50 mb-8 animate-fade-in-up">
            <div className="h-40 sm:h-48 bg-[#124757] dark:bg-slate-900 relative overflow-hidden">
              <div className="absolute inset-0 bg-black/20 z-10"></div>
              <img src="https://res.cloudinary.com/dygipvoal/image/upload/v1781725530/c3i0whtz6gszslc5pa9f.jpg" alt="Cover" className="w-full h-full object-cover object-center opacity-80" />
            </div>

            <div className="px-6 sm:px-10 pb-8 relative">
              <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 -mt-16 sm:-mt-20 relative z-20">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
                  <div className="w-32 h-32 rounded-[2rem] border-4 border-white dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-700 shadow-lg shrink-0">
                    <img src={profileData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div className="pb-2">
                    <h1 className="text-2xl sm:text-3xl font-black font-headline text-yellow-400 dark:text-yellow-400 leading-tight">
                      {profileData.fullName || "Member"}
                    </h1>
                    <p className="text-white dark:text-white font-medium text-sm mt-1">
                      {profileData.phoneNumber} {profileData.email ? `• ${profileData.email}` : ""}
                    </p>
                    <div className="flex items-center gap-2 justify-center sm:justify-start mt-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        {lang === "VN" ? "Đã xác thực" : "Verified"}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-500/20">
                        {profileData.roleName}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto pb-2">
                  <button onClick={() => setIsEditProfileOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-yellow-400 text-slate-900 dark:bg-yellow-400 dark:text-slate-900 font-bold text-xs uppercase tracking-widest hover:brightness-110 hover:shadow-lg transition-all">
                    <span className="material-symbols-outlined text-base">edit</span>
                    {lang === "VN" ? "Chỉnh sửa" : "Edit Profile"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 pt-8 border-t border-slate-100 dark:border-slate-700">
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800 shadow-inner">
                  <span className="material-symbols-outlined text-3xl text-amber-500 mb-2">stars</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">
                    {lang === "VN" ? "Điểm tích lũy" : "Reward Points"}
                  </p>
                  <h3 className="text-2xl font-black font-headline text-[#124757] dark:text-yellow-400">
                    {mockUserStats.points.toLocaleString()}
                  </h3>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800 shadow-inner">
                  <span className="material-symbols-outlined text-3xl text-[#124757] dark:text-yellow-400 mb-2">directions_boat</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">
                    {lang === "VN" ? "Chuyến đi" : "Total Trips"}
                  </p>
                  <h3 className="text-2xl font-black font-headline text-[#124757] dark:text-yellow-400">0</h3>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800 shadow-inner">
                  <span className="material-symbols-outlined text-3xl text-rose-500 mb-2">local_activity</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">
                    {lang === "VN" ? "Voucher hiện có" : "Available Vouchers"}
                  </p>
                  <h3 className="text-2xl font-black font-headline text-[#124757] dark:text-yellow-400">0</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 pb-10">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 sm:p-8 shadow-xl border border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-black font-headline text-[#124757] dark:text-yellow-400 uppercase tracking-widest">
                    {lang === "VN" ? "Chuyến đi sắp tới" : "Upcoming Trips"}
                  </h2>
                </div>
                <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                  <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">sailing</span>
                  <p className="text-sm font-bold text-slate-400">
                    {lang === "VN" ? "Chưa có chuyến đi nào được đặt." : "No upcoming trips found."}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 sm:p-8 shadow-xl border border-slate-100 dark:border-slate-700/50">
                <h2 className="text-lg font-black font-headline text-[#124757] dark:text-yellow-400 uppercase tracking-widest mb-6">
                  {lang === "VN" ? "Bảo mật" : "Security"}
                </h2>
                <div className="space-y-3">
                  <button onClick={() => navigate("/profile/change-password")} className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500 group-hover:text-[#124757] dark:group-hover:text-yellow-400 transition-colors">
                        <span className="material-symbols-outlined">lock</span>
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {lang === "VN" ? "Đổi mật khẩu" : "Change Password"}
                      </span>
                    </div>
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                  <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-sm hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 transition-all">
                    <span className="material-symbols-outlined">logout</span>
                    {lang === "VN" ? "Đăng xuất" : "Log out"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL CẬP NHẬT HỒ SƠ */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden relative mt-auto mb-auto sm:my-8 animate-fade-in-up">

            <div className="px-6 md:px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div>
                <h2 className="text-xl font-black font-headline text-[#124757] dark:text-yellow-400 uppercase tracking-widest">
                  {lang === "VN" ? "Cập nhật hồ sơ" : "Edit Profile"}
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  {lang === "VN" ? "Thay đổi thông tin cá nhân của bạn" : "Update your personal details"}
                </p>
              </div>
              <button disabled={isUpdating} onClick={() => setIsEditProfileOpen(false)} className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 transition-all border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 md:p-8">
              <form id="profileForm" onSubmit={handleSaveProfile} className="space-y-5">

                {/* ẢNH ĐẠI DIỆN VỚI INPUT FILE */}
                <div className="flex flex-col items-center mb-6">
                  <div className="w-24 h-24 rounded-2xl border-2 border-[#124757] dark:border-yellow-400 overflow-hidden bg-slate-100 dark:bg-slate-700 relative group cursor-pointer mb-3 shadow-lg">
                    <img src={profileData.avatarUrl} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-40 transition-opacity" />
                    <label className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[#124757] dark:text-yellow-400 cursor-pointer bg-black/10">
                      <span className="material-symbols-outlined drop-shadow-md">photo_camera</span>
                      <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleAvatarChange} className="hidden" />
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">JPEG, PNG, WebP (Max 5MB)</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelClasses}>{lang === "VN" ? "Họ và Tên (*)" : "Full Name (*)"}</label>
                    <input required name="fullName" type="text" value={profileData.fullName} onChange={handleProfileDataChange} className={inputClasses} />
                  </div>

                  <div>
                    <label className={labelClasses}>{lang === "VN" ? "Giới tính" : "Gender"}</label>
                    <select name="gender" value={profileData.gender} onChange={handleProfileDataChange} className={inputClasses}>
                      <option value="Male">{lang === "VN" ? "Nam" : "Male"}</option>
                      <option value="Female">{lang === "VN" ? "Nữ" : "Female"}</option>
                      <option value="Other">{lang === "VN" ? "Khác" : "Other"}</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClasses}>{lang === "VN" ? "Email (*)" : "Email (*)"}</label>
                    <input required name="email" type="email" value={profileData.email} onChange={handleProfileDataChange} className={inputClasses} />
                    <p className="text-[10px] text-amber-500 mt-1.5 font-bold italic">
                      * {lang === "VN" ? "Cần verify OTP nếu thay đổi" : "OTP required if changed"}
                    </p>
                  </div>

                  <div>
                    <label className={labelClasses}>{lang === "VN" ? "Số điện thoại (*)" : "Phone Number (*)"}</label>
                    <input required name="phoneNumber" type="tel" value={profileData.phoneNumber} onChange={handleProfileDataChange} className={inputClasses} />
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      * {lang === "VN" ? "User Google chỉ thêm 1 lần" : "Google users can add once"}
                    </p>
                  </div>

                  <div>
                    <label className={labelClasses}>{lang === "VN" ? "Ngày sinh" : "Date of Birth"}</label>
                    <input name="dob" type="date" value={profileData.dob} onChange={handleProfileDataChange} className={inputClasses} />
                  </div>

                  {/* CHỌN QUỐC GIA */}
                  <div>
                    <label className={labelClasses}>{lang === "VN" ? "Quốc tịch" : "Nationality"}</label>
                    <div className="relative flex items-center">
                      <span className={`fi fi-${selectedFlag} absolute left-4 text-sm rounded-sm pointer-events-none shadow-sm`}></span>
                      <select value={selectedFlag} onChange={handleNationalityChange} className={`${inputClasses} pl-11 appearance-none`}>
                        {countryList.map((country) => (
                          <option key={country.code} value={country.code}>{country.name}</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined text-slate-400 absolute right-3 pointer-events-none">arrow_drop_down</span>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 md:px-8 py-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-4 bg-slate-50 dark:bg-slate-900/50 rounded-b-[2rem]">
              <button type="button" disabled={isUpdating} onClick={() => setIsEditProfileOpen(false)} className="px-6 py-3 rounded-xl font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-xs uppercase tracking-widest shadow-sm disabled:opacity-50">
                {lang === "VN" ? "Hủy" : "Cancel"}
              </button>
              <button form="profileForm" type="submit" disabled={isUpdating} className="px-8 py-3 rounded-xl font-black bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 hover:brightness-110 transition-all shadow-md font-headline uppercase tracking-widest text-xs disabled:opacity-50 flex items-center gap-2">
                {isUpdating && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                {lang === "VN" ? "Lưu thay đổi" : "Save Changes"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};