import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchUserRoles, createUser } from "../../../services/userService";
import { getRoleSystemName } from "../../../utils/roleHelpers";
import { getApiErrorMessage } from "../../../utils/apiError";
import { notify } from "../../../utils/swalToast";
import { ManagerFormFields } from "./ManagerFormFields";

const ALLOWED_EMAIL_DOMAINS = ["gmail.com", "fpt.edu.vn"];

const isAllowedEmail = (email) => {
  const trimmed = String(email || "").trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(trimmed.slice(at + 1));
};

export function CreateManager() {
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
        stationIds: [],
    });

    useEffect(() => {
        const loadRoles = async () => {
            try {
                setIsLoadingRoles(true);
                const data = await fetchUserRoles({ force: true });
                setRoles(data || []);
            } catch (error) {
                console.error("Lỗi khi tải danh sách vai trò:", error);
                setErrorMsg(
                    lang === "VN"
                        ? "Không thể tải vai trò Manager để gán."
                        : "Failed to load the Manager role."
                );
            } finally {
                setIsLoadingRoles(false);
            }
        };
        loadRoles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const managerRole = useMemo(
        () => roles.find((role) => getRoleSystemName(role) === "MANAGER"),
        [roles]
    );

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            setErrorMsg("");

            if (!managerRole) {
                setErrorMsg(lang === "VN" ? "Không tìm thấy vai trò Manager." : "Manager role not found.");
                return;
            }

            if (!isAllowedEmail(formData.email)) {
                setErrorMsg(
                    lang === "VN"
                        ? "Email chỉ hỗ trợ @gmail.com hoặc @fpt.edu.vn."
                        : "Email must be @gmail.com or @fpt.edu.vn."
                );
                return;
            }

            const payload = {
                fullName: formData.fullName.trim(),
                ...(formData.dateOfBirth ? { dateOfBirth: formData.dateOfBirth } : {}),
                gender: formData.gender,
                nationality: formData.nationality.trim() || null,
                phoneNumber: formData.phoneNumber.trim(),
                email: formData.email.trim(),
                roleId: managerRole.id,
                stationIds: formData.stationIds.map(String),
            };

            const result = await createUser(payload);

            const generatedPassword = result?.generatedPassword;

            await notify({
                icon: "success",
                title: lang === "VN" ? "Tạo quản lý thành công!" : "Manager Created Successfully!",
                html: generatedPassword
                    ? (lang === "VN"
                        ? `Tài khoản đã được tạo. Mật khẩu khởi tạo: <b>${generatedPassword}</b><br/>Vui lòng gửi cho người dùng và yêu cầu đổi mật khẩu khi đăng nhập lần đầu.`
                        : `Account created. Initial password: <b>${generatedPassword}</b><br/>Please share it with the user and ask them to change it on first login.`)
                    : (lang === "VN" ? "Tài khoản quản lý mới đã được thêm vào hệ thống." : "New manager account has been added to the system."),
                confirmButtonColor: "#124757",
            });

            navigate("/admin/managers-management");
        } catch (error) {
            console.error("Lỗi tạo quản lý:", error);
            setErrorMsg(
                getApiErrorMessage(
                    error,
                    lang === "VN" ? "Tạo quản lý thất bại." : "Failed to create manager."
                )
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-5xl mx-auto">

            {/* KHỐI TIÊU ĐỀ HEADER */}
            <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
                <button
                    type="button"
                    onClick={() => navigate("/admin/managers-management")}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Thêm quản lý mới" : "Add New Manager"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Khai báo hồ sơ và gắn bến phụ trách cho tài khoản Quản lý mới." : "Register profile details and assign stations for the new manager account."}
                    </p>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm whitespace-pre-line">
                    {errorMsg}
                </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6">
                <ManagerFormFields
                    lang={lang}
                    formData={formData}
                    onChange={handleInputChange}
                    roleLabel={
                        isLoadingRoles
                            ? (lang === "VN" ? "Đang tải..." : "Loading...")
                            : (managerRole?.displayName || managerRole?.systemName || "Manager")
                    }
                    namePlaceholder={lang === "VN" ? "VD: Nguyễn Văn A" : "e.g. John Doe"}
                    phonePlaceholder="0901234567"
                    emailPlaceholder="name@gmail.com"
                />

                <button
                    type="submit"
                    disabled={isSubmitting || isLoadingRoles || !managerRole}
                    className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                    {lang === "VN" ? "Tạo quản lý" : "Create Manager"}
                </button>
            </form>
        </div>
    );
}
