import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useApp } from "../../../context/AppContext";
import { fetchUserRoles, createUser } from "../../../services/userService";

export function CreateUser() {
    const { lang } = useApp();
    const navigate = useNavigate();

    const [roles, setRoles] = useState([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const [formData, setFormData] = useState({
        fullName: "",
        dateOfBirth: "",
        gender: "Male",
        nationality: "Vietnam",
        phoneNumber: "",
        email: "",
        roleId: "",
    });

    useEffect(() => {
        const loadRoles = async () => {
            try {
                setIsLoadingRoles(true);
                const data = await fetchUserRoles({ force: true });
                setRoles(data || []);
                if (data?.length) {
                    setFormData((prev) => ({ ...prev, roleId: data[0].id }));
                }
            } catch (error) {
                console.error("Lỗi khi tải danh sách vai trò:", error);
                setErrorMsg(
                    lang === "VN"
                        ? "Không thể tải danh sách vai trò có thể gán."
                        : "Failed to load assignable roles."
                );
            } finally {
                setIsLoadingRoles(false);
            }
        };
        loadRoles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            setErrorMsg("");

            const payload = {
                fullName: formData.fullName.trim(),
                dateOfBirth: formData.dateOfBirth || null,
                gender: formData.gender,
                nationality: formData.nationality.trim() || null,
                phoneNumber: formData.phoneNumber.trim(),
                email: formData.email.trim() || null,
                roleId: formData.roleId,
            };

            const result = await createUser(payload);

            const generatedPassword = result?.generatedPassword;

            await Swal.fire({
                icon: "success",
                title: lang === "VN" ? "Tạo người dùng thành công!" : "User Created Successfully!",
                html: generatedPassword
                    ? (lang === "VN"
                        ? `Tài khoản đã được tạo. Mật khẩu khởi tạo: <b>${generatedPassword}</b><br/>Vui lòng gửi cho người dùng và yêu cầu đổi mật khẩu khi đăng nhập lần đầu.`
                        : `Account created. Initial password: <b>${generatedPassword}</b><br/>Please share it with the user and ask them to change it on first login.`)
                    : (lang === "VN" ? "Tài khoản mới đã được thêm vào hệ thống." : "New account has been added to the system."),
                confirmButtonColor: "#124757",
            });

            navigate("/admin/users-management");
        } catch (error) {
            console.error("Lỗi tạo người dùng:", error);
            let validationError = "";
            if (error.response?.data?.errors) {
                validationError = Object.values(error.response.data.errors).flat().join(" | ");
            }
            setErrorMsg(validationError || error.response?.data?.message || (lang === "VN" ? "Tạo người dùng thất bại." : "Failed to create user."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
    const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-3xl mx-auto animate-fade-in">

            {/* KHỐI TIÊU ĐỀ HEADER */}
            <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
                <button
                    type="button"
                    onClick={() => navigate("/admin/users-management")}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Thêm người dùng mới" : "Add New User"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Khai báo hồ sơ và gán vai trò cho tài khoản Nhân viên/Quản lý mới." : "Register profile details and assign a role for the new staff/manager account."}
                    </p>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
                    {errorMsg}
                </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                    <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
                        {lang === "VN" ? "Thông tin cá nhân" : "Personal Information"}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Họ và Tên (*)" : "Full Name (*)"}</label>
                            <input type="text" required placeholder={lang === "VN" ? "VD: Nguyễn Văn A" : "e.g. John Doe"} value={formData.fullName} onChange={(e) => handleInputChange("fullName", e.target.value)} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Ngày sinh" : "Date of Birth"}</label>
                            <input type="date" value={formData.dateOfBirth} onChange={(e) => handleInputChange("dateOfBirth", e.target.value)} className={inputStyle} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Giới tính" : "Gender"}</label>
                            <select value={formData.gender} onChange={(e) => handleInputChange("gender", e.target.value)} className={`${inputStyle} cursor-pointer`}>
                                <option value="Male">{lang === "VN" ? "Nam" : "Male"}</option>
                                <option value="Female">{lang === "VN" ? "Nữ" : "Female"}</option>
                                <option value="Other">{lang === "VN" ? "Khác" : "Other"}</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Quốc tịch" : "Nationality"}</label>
                            <input type="text" placeholder="Vietnam" value={formData.nationality} onChange={(e) => handleInputChange("nationality", e.target.value)} className={inputStyle} />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                    <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
                        {lang === "VN" ? "Thông tin liên hệ & Vai trò" : "Contact & Role"}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Số điện thoại (*)" : "Phone Number (*)"}</label>
                            <input type="tel" required placeholder="0912345678" value={formData.phoneNumber} onChange={(e) => handleInputChange("phoneNumber", e.target.value)} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Email</label>
                            <input type="email" placeholder="email@example.com" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} className={inputStyle} />
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Vai trò được gán (*)" : "Assigned Role (*)"}</label>
                        <select
                            required
                            disabled={isLoadingRoles || roles.length === 0}
                            value={formData.roleId}
                            onChange={(e) => handleInputChange("roleId", e.target.value)}
                            className={`${inputStyle} cursor-pointer font-bold text-[#124757] dark:text-yellow-400`}
                        >
                            {isLoadingRoles && <option>{lang === "VN" ? "Đang tải..." : "Loading..."}</option>}
                            {!isLoadingRoles && roles.length === 0 && (
                                <option>{lang === "VN" ? "Không có vai trò khả dụng" : "No roles available"}</option>
                            )}
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>{role.displayName || role.systemName}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                            {lang === "VN" ? "Hệ thống tự sinh mật khẩu ban đầu và hiển thị sau khi tạo thành công." : "The system auto-generates an initial password shown after successful creation."}
                        </p>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || isLoadingRoles || roles.length === 0}
                    className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                    {lang === "VN" ? "Tạo người dùng" : "Create User"}
                </button>
            </form>
        </div>
    );
}
