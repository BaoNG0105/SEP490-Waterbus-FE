import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import {
    fetchCurrentUserProfile,
    updateProfile,
    verifyEmailChangeOtp,
    verifyPhoneChangeOtp
} from "../../services/authService";
import Swal from "sweetalert2";
import "flag-icons/css/flag-icons.min.css";

import countries from "i18n-iso-countries";
import viLocale from "i18n-iso-countries/langs/vi.json";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(viLocale);
countries.registerLocale(enLocale);

const convertDateForInput = (dateString) => {
    if (!dateString) return "";
    const parts = dateString.split("/");
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateString;
};

export const EditProfile = () => {
    const { lang, isDarkMode } = useApp();
    const navigate = useNavigate();

    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
    const [selectedFlag, setSelectedFlag] = useState("vn");

    // State lưu dữ liệu gốc để so sánh xem user có đổi Email hay Phone không
    const [originalData] = useState(null);

    const [profileData, setProfileData] = useState({
        fullName: "",
        email: "",
        phoneNumber: "",
        dob: "",
        gender: "Male",
        nationality: "Vietnam",
        avatarUrl: "",
    });

    const countryList = useMemo(() => {
        const countryObj = countries.getNames(lang === "VN" ? "vi" : "en", { select: "official" });
        return Object.entries(countryObj).map(([code, name]) => ({
            code: code.toLowerCase(),
            name: name,
            isoCode: code
        }));
    }, [lang]);

    useEffect(() => {
        const loadProfileData = async () => {
            try {
                setIsLoadingProfile(true);
                const data = await fetchCurrentUserProfile();

                const userNationality = data.nationality || "Vietnam";

                // Tìm mã ISO code dựa trên tên tiếng Anh chuẩn lưu từ Backend 
                // Thay vì tìm trên 'countryList' bị đổi ngôn ngữ động, ta tra thẳng bằng thư viện gốc với ngôn ngữ 'en'
                const countryCodeIso = countries.getAlpha2Code(userNationality, "en");

                let targetFlag = "vn"; // Mặc định phòng hờ
                if (countryCodeIso) {
                    targetFlag = countryCodeIso.toLowerCase();
                } else {
                    // Nếu không tìm thấy bằng tên tiếng Anh, thử tìm bằng tên tiếng Việt (phòng dữ liệu cũ)
                    const backupCodeIso = countries.getAlpha2Code(userNationality, "vi");
                    if (backupCodeIso) targetFlag = backupCodeIso.toLowerCase();
                }

                // Cập nhật cờ quốc gia hiển thị chính xác
                setSelectedFlag(targetFlag);

                setProfileData({
                    fullName: data.fullName || "",
                    email: data.email || "",
                    phoneNumber: data.phoneNumber || "",
                    dob: convertDateForInput(data.dateOfBirth),
                    gender: data.gender || "Male",
                    nationality: userNationality,
                    avatarUrl: data.avatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
                });
            } catch (error) {
                console.error("Lỗi khi tải Profile:", error);
            } finally {
                setIsLoadingProfile(false);
            }
        };

        loadProfileData();
    }, []); // 💡 ĐÃ SỬA: Bỏ 'countryList' khỏi mảng dependency để tránh hàm chạy lại làm reset lại cờ khi đổi ngôn ngữ ngẫu nhiên

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
                nationality: countries.getName(matched.isoCode, "en")
            }));
        }
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                Swal.fire({ icon: 'error', title: 'Định dạng không hợp lệ', text: 'Chỉ hỗ trợ JPEG, PNG, WebP.' });
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                Swal.fire({ icon: 'error', title: 'File quá lớn', text: 'Dung lượng ảnh tối đa 5MB.' });
                return;
            }
            setSelectedAvatarFile(file);
            setProfileData(prev => ({ ...prev, avatarUrl: URL.createObjectURL(file) }));
        }
    };

    // ==========================================
    // XỬ LÝ LƯU THÔNG TIN & XÁC THỰC OTP
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
        if (selectedAvatarFile) {
            payload = new FormData();
            if (profileData.fullName) payload.append("fullName", profileData.fullName.trim());
            if (formattedDate) payload.append("dateOfBirth", formattedDate);
            if (profileData.gender) payload.append("gender", profileData.gender);
            if (profileData.nationality) payload.append("nationality", profileData.nationality);
            if (profileData.phoneNumber) payload.append("phoneNumber", profileData.phoneNumber.trim());
            if (profileData.email) payload.append("email", profileData.email.trim());
            payload.append("file", selectedAvatarFile);
        } else {
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
            const response = await updateProfile(payload);

            // Lấy ID từ emailVerification hoặc phoneVerification tùy theo trường hợp
            const challengeId =
                response?.emailVerification?.id ||
                response?.phoneVerification?.id ||
                response?.challengeId; // Giữ lại fallback phòng hờ

            // NẾU BACKEND TRẢ VỀ CHALLENGE ID -> YÊU CẦU NHẬP OTP
            if (challengeId) {
                const isEmailChanged = profileData.email.trim() !== originalData.email;
                const isPhoneChanged = profileData.phoneNumber.trim() !== originalData.phoneNumber;

                const { value: otpCode } = await Swal.fire({
                    title: lang === "VN" ? "Xác thực thay đổi" : "Verify Changes",
                    html: lang === "VN"
                        ? `Hệ thống đã gửi mã OTP xác nhận đến <b>${isEmailChanged ? "Email" : "Số điện thoại"}</b> mới của bạn.<br/>Vui lòng nhập mã OTP để hoàn tất.`
                        : `We have sent an OTP to your new <b>${isEmailChanged ? "Email" : "Phone number"}</b>.<br/>Please enter it to confirm.`,
                    input: "text",
                    inputPlaceholder: "Nhập mã OTP (Enter OTP)...",
                    showCancelButton: true,
                    confirmButtonColor: "#124757",
                    cancelButtonColor: "#d33",
                    confirmButtonText: lang === "VN" ? "Xác nhận" : "Verify",
                    cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
                    allowOutsideClick: false,
                    inputValidator: (value) => {
                        if (!value) return lang === "VN" ? "Mã OTP không được để trống!" : "OTP is required!";
                    }
                });

                if (otpCode) {
                    try {
                        // Gọi đúng API xác thực tùy theo việc đổi Email hay Phone
                        if (isEmailChanged) {
                            await verifyEmailChangeOtp({ challengeId, code: otpCode });
                        } else if (isPhoneChanged) {
                            await verifyPhoneChangeOtp({ challengeId, code: otpCode });
                        }

                        Swal.fire({
                            icon: "success",
                            title: lang === "VN" ? "Thành công!" : "Success!",
                            text: lang === "VN" ? "Cập nhật và xác thực thông tin thành công." : "Profile updated and verified successfully.",
                            confirmButtonColor: "#124757"
                        }).then(() => navigate(-1));

                    } catch (verifyError) {
                        console.error("Lỗi xác thực OTP:", verifyError);
                        Swal.fire({
                            icon: "error",
                            title: lang === "VN" ? "Xác thực thất bại" : "Verification Failed",
                            text: verifyError.response?.data?.message || (lang === "VN" ? "Mã OTP không hợp lệ hoặc đã hết hạn." : "Invalid or expired OTP code."),
                            confirmButtonColor: "#124757"
                        });
                    }
                }
            }
            // NẾU KHÔNG CẦN OTP -> CẬP NHẬT THÀNH CÔNG LUÔN
            else {
                Swal.fire({
                    icon: "success",
                    title: lang === "VN" ? "Cập nhật thành công!" : "Profile Updated!",
                    confirmButtonColor: "#124757",
                    background: isDarkMode ? "#1e293b" : "#fff",
                    color: isDarkMode ? "#fff" : "#000",
                }).then(() => {
                    navigate(-1);
                });
            }
        } catch (error) {
            console.error("Lỗi cập nhật:", error);
            Swal.fire({
                icon: "error",
                title: lang === "VN" ? "Cập nhật thất bại" : "Update Failed",
                text: error.response?.data?.message || (lang === "VN" ? "Vui lòng kiểm tra lại thông tin cung cấp." : "Please check your input details."),
                confirmButtonColor: "#124757"
            });
        } finally {
            setIsUpdating(false);
        }
    };

    const labelClasses = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
    const inputClasses = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner";

    if (isLoadingProfile) {
        return (
            <div className="py-24 flex justify-center items-center w-full">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="w-full bg-white dark:bg-slate-900 py-10 px-4 sm:px-6 lg:px-8 font-body transition-colors duration-300">
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">

                <div className="flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">arrow_back</span>
                        <span>{lang === "VN" ? "Quay lại hồ sơ" : "Back to Profile"}</span>
                    </button>
                </div>

                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-[#124757] dark:text-yellow-400 font-headline uppercase tracking-widest">
                        {lang === "VN" ? "Cập nhật hồ sơ" : "Edit Profile"}
                    </h1>
                    <p className="text-slate-400 dark:text-slate-500 text-xs font-bold mt-1">
                        {lang === "VN" ? "Thay đổi thông tin tài khoản cá nhân của bạn trên hệ thống" : "Modify your public profile details and information"}
                    </p>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-8">

                    {/* AVATAR */}
                    <div className="flex flex-col sm:flex-row items-center gap-5 bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <div className="w-20 h-24 rounded-2xl border-2 border-[#124757] dark:border-yellow-400 overflow-hidden bg-slate-100 dark:bg-slate-700 relative group cursor-pointer shadow-md shrink-0">
                            <img src={profileData.avatarUrl} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-40 transition-opacity" />
                            <label className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[#124757] dark:text-yellow-400 cursor-pointer bg-black/10">
                                <span className="material-symbols-outlined">photo_camera</span>
                                <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleAvatarChange} className="hidden" />
                            </label>
                        </div>
                        <div className="text-center sm:text-left space-y-1">
                            <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                {lang === "VN" ? "Ảnh đại diện tài khoản" : "Profile Avatar Picture"}
                            </h4>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-normal">
                                {lang === "VN" ? "Hỗ trợ định dạng ảnh JPEG, PNG hoặc WebP. Dung lượng file tối đa 5MB." : "Supports JPEG, PNG or WebP images format. Max file limit 5MB."}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className={labelClasses}>{lang === "VN" ? "Họ và Tên (*)" : "Full Name (*)"}</label>
                            <input required name="fullName" type="text" value={profileData.fullName} onChange={handleProfileDataChange} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>{lang === "VN" ? "Giới tính" : "Gender"}</label>
                            <select name="gender" value={profileData.gender} onChange={handleProfileDataChange} className={inputClasses}>
                                <option value="Male">{lang === "VN" ? "Nam" : "Male"}</option>
                                <option value="Female">{lang === "VN" ? "Nữ" : "Female"}</option>
                                <option value="Other">{lang === "VN" ? "Khác" : "Other"}</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>{lang === "VN" ? "Địa chỉ Email (*)" : "Email Address (*)"}</label>
                            <input required name="email" type="email" value={profileData.email} onChange={handleProfileDataChange} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>
                                {lang === "VN" ? "Số điện thoại" : "Phone Number"}
                            </label>
                            <input
                                name="phoneNumber"
                                type="tel"
                                value={profileData.phoneNumber}
                                onChange={handleProfileDataChange}
                                className={inputClasses}
                                placeholder={lang === "VN" ? "Cập nhật số điện thoại..." : "Add phone number..."}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>{lang === "VN" ? "Ngày tháng năm sinh" : "Date of Birth"}</label>
                            <input name="dob" type="date" value={profileData.dob} onChange={handleProfileDataChange} className={inputClasses} />
                        </div>

                        <div className="space-y-1">
                            <label className={labelClasses}>{lang === "VN" ? "Quốc tịch" : "Nationality"}</label>
                            <div className="relative flex items-center">
                                <span className={`fi fi-${selectedFlag} absolute left-8 text-sm rounded-sm shadow-sm pointer-events-none`}></span>
                                <select
                                    value={selectedFlag}
                                    onChange={handleNationalityChange}
                                    className={`${inputClasses} pl-11 appearance-none font-semibold`}
                                >
                                    {countryList.map((country) => (
                                        <option key={country.code} value={country.code}>
                                            {country.name}
                                        </option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined text-slate-400 absolute right-3 pointer-events-none">arrow_drop_down</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 justify-end pt-6 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => navigate(-1)}
                            className="px-6 py-3 rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
                        >
                            {lang === "VN" ? "Hủy bỏ" : "Cancel"}
                        </button>
                        <button
                            type="submit"
                            disabled={isUpdating}
                            className="px-8 py-3 rounded-xl font-black bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 hover:brightness-110 active:scale-[0.98] transition-all shadow-md font-headline uppercase tracking-widest text-xs disabled:opacity-50 flex items-center gap-2"
                        >
                            {isUpdating && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                            {lang === "VN" ? "Lưu thay đổi" : "Save Changes"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};