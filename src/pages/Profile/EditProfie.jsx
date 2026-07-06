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
    const { lang } = useApp();
    const navigate = useNavigate();

    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
    const [selectedFlag, setSelectedFlag] = useState("vn");

    // Khai báo originalData để lưu bản gốc phục vụ cho việc so sánh OTP
    const [originalData, setOriginalData] = useState(null);

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
                const countryCodeIso = countries.getAlpha2Code(userNationality, "en");

                let targetFlag = "vn";
                if (countryCodeIso) {
                    targetFlag = countryCodeIso.toLowerCase();
                } else {
                    const backupCodeIso = countries.getAlpha2Code(userNationality, "vi");
                    if (backupCodeIso) targetFlag = backupCodeIso.toLowerCase();
                }

                setSelectedFlag(targetFlag);

                const formattedData = {
                    fullName: data.fullName || "",
                    email: data.email || "",
                    phoneNumber: data.phoneNumber || "",
                    dob: convertDateForInput(data.dateOfBirth),
                    gender: data.gender || "Male",
                    nationality: userNationality,
                    avatarUrl: data.avatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
                };

                setProfileData(formattedData);
                // Phải lưu lại bản gốc lúc tải xong để lúc Save có cái so sánh
                setOriginalData(formattedData);
            } catch (error) {
                console.error("Lỗi khi tải Profile:", error);
            } finally {
                setIsLoadingProfile(false);
            }
        };

        loadProfileData();
    }, []);

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

        const isEmailChanged = profileData.email.trim() !== "" && profileData.email.trim() !== (originalData?.email || "");
        const isPhoneChanged = profileData.phoneNumber.trim() !== (originalData?.phoneNumber || "");

        // 1. BẪY LỖI FRONTEND: Kiểm tra xem user có đổi cả 2 trường cùng lúc không
        if (isEmailChanged && isPhoneChanged) {
            Swal.fire({
                icon: "warning",
                title: lang === "VN" ? "Không hợp lệ" : "Invalid Request",
                text: lang === "VN"
                    ? "Bạn không thể đổi Email và Số điện thoại cùng lúc. Vui lòng xác thực đổi Email trước khi cập nhật Số điện thoại."
                    : "Please verify email change before updating phone number. You cannot change both simultaneously.",
                confirmButtonColor: "#124757"
            });
            return;
        }

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

            const challengeId =
                response?.emailVerification?.id ||
                response?.phoneVerification?.id ||
                response?.challengeId;

            // 💡 2. LUỒNG CÓ OTP: Giao diện nhập 6 ô vuông
            if (challengeId) {
                const maskedDest = response?.emailVerification?.maskedDestination || response?.phoneVerification?.maskedDestination;
                const targetTypeLabel = isEmailChanged ? (lang === "VN" ? "Email" : "Email") : (lang === "VN" ? "Số điện thoại" : "Phone number");

                const { value: otpCode } = await Swal.fire({
                    title: lang === "VN" ? "Xác thực thay đổi" : "Verify Changes",
                    // Nhúng HTML 6 ô input
                    html: `
                <p class="text-sm text-slate-500 mb-5 font-medium leading-relaxed">
                  ${lang === "VN"
                            ? `Hệ thống đã gửi mã xác nhận đến <b>${targetTypeLabel}</b> mới của bạn ${maskedDest ? `(<b>${maskedDest}</b>)` : ""}. Vui lòng nhập mã OTP để hoàn tất.`
                            : `We have sent a verification code to your new <b>${targetTypeLabel}</b> ${maskedDest ? `(<b>${maskedDest}</b>)` : ""}. Please enter it to confirm.`}
                </p>
                <div id="otp-container" class="flex justify-center gap-2 sm:gap-3" dir="ltr">
                  ${Array(6).fill(0).map(() =>
                                `<input type="text" class=" otp-input w-10 h-12 sm:w-12 sm:h-14 m-0 text-center text-xl font-black rounded-xl border-2 border-slate-200 focus:border-[#124757] focus:ring-0 shadow-inner" maxlength="1" pattern="[0-9]*" inputmode="numeric" />`
                            ).join('')}
                </div>
              `,
                    showCancelButton: true,
                    confirmButtonColor: "#124757",
                    cancelButtonColor: "#d33",
                    confirmButtonText: lang === "VN" ? "Xác nhận" : "Verify",
                    cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
                    allowOutsideClick: false,

                    // Logic UX/UI cho 6 ô nhập
                    didOpen: () => {
                        const inputs = Swal.getHtmlContainer().querySelectorAll('.otp-input');
                        if (inputs.length > 0) inputs[0].focus();

                        inputs.forEach((input, index) => {
                            // Tự động nhảy ô kế tiếp khi nhập
                            input.addEventListener('input', (e) => {
                                e.target.value = e.target.value.replace(/[^0-9]/g, ''); // Chỉ cho nhập số
                                if (e.target.value !== '' && index < inputs.length - 1) {
                                    inputs[index + 1].focus();
                                }
                            });
                            // Nhấn Backspace tự động lùi về ô trước
                            input.addEventListener('keydown', (e) => {
                                if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
                                    inputs[index - 1].focus();
                                }
                            });
                            // Hỗ trợ Paste nguyên dãy 6 số vào
                            input.addEventListener('paste', (e) => {
                                e.preventDefault();
                                const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
                                if (pastedData) {
                                    for (let i = 0; i < pastedData.length; i++) {
                                        if (inputs[index + i]) {
                                            inputs[index + i].value = pastedData[i];
                                            if (index + i < inputs.length - 1) inputs[index + i + 1].focus();
                                        }
                                    }
                                }
                            });
                        });
                    },
                    // Gom 6 ô lại thành 1 chuỗi string để gửi lên BE
                    preConfirm: () => {
                        const inputs = Swal.getHtmlContainer().querySelectorAll('.otp-input');
                        const code = Array.from(inputs).map(i => i.value).join('');
                        if (code.length < 6) {
                            Swal.showValidationMessage(lang === "VN" ? "Vui lòng nhập đầy đủ 6 số OTP!" : "Please enter the full 6-digit OTP!");
                            return false;
                        }
                        return code;
                    }
                });

                if (otpCode) {
                    try {
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
            // 3. LUỒNG KHÔNG CÓ OTP: Chỉ đổi avatar, tên, ngày sinh...
            else {
                Swal.fire({
                    icon: "success",
                    title: lang === "VN" ? "Cập nhật thành công!" : "Profile Updated!",
                    confirmButtonColor: "#124757"
                }).then(() => navigate(-1));
            }
        } catch (error) {
            console.error("Lỗi cập nhật:", error);

            let validationMsg = "";
            if (error.response?.data?.errors) {
                validationMsg = Object.values(error.response.data.errors).flat().join(" | ");
            }

            Swal.fire({
                icon: "error",
                title: lang === "VN" ? "Cập nhật thất bại" : "Update Failed",
                text: validationMsg || error.response?.data?.message || (lang === "VN" ? "Vui lòng kiểm tra lại thông tin cung cấp." : "Please check your input details."),
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
                            <label className={labelClasses}>{lang === "VN" ? "Địa chỉ Email" : "Email Address"}</label>
                            <input name="email" type="email" value={profileData.email} onChange={handleProfileDataChange} className={inputClasses} />
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
                                <span className={`fi fi-${selectedFlag} absolute! left-4 top-1/2 -translate-y-1/2 text-sm rounded-sm shadow-sm pointer-events-none`}></span>
                                <select value={selectedFlag} onChange={handleNationalityChange} className={`${inputClasses} pl-11 appearance-none font-semibold`}>
                                    {countryList.map((country) => (
                                        <option key={country.code} value={country.code}>{country.name}</option>
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
