import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchUserDetail, fetchUserRoles, updateUser, fetchUserStations, assignUserStations } from "../../../services/userService";
import { canResetManagedUserPassword, getRoleSystemName } from "../../../utils/roleHelpers";
import { getApiErrorMessage } from "../../../utils/apiError";
import { UserAvatar } from "../../../components/UserAvatar";
import { promptResetManagedPassword } from "../../../utils/managedPasswordReset";
import { notify } from "../../../utils/swalToast";
import { ManagerFormFields } from "./ManagerFormFields";
import { validateManagerFields } from "./managerValidation";

// Chuyển đổi chuỗi ngày sinh trả về từ BE (có thể là ISO hoặc dd/MM/yyyy) sang định dạng yyyy-MM-dd cho input HTML5
const toInputDate = (value) => {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return "";
};

export function EditManager() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const { id } = useParams();
    const { user: currentUser } = useSelector((state) => state.auth);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [roles, setRoles] = useState([]);
    const [userInfo, setUserInfo] = useState(null);

    const [formData, setFormData] = useState({
        fullName: "",
        dateOfBirth: "",
        gender: "Male",
        nationality: "",
        phoneNumber: "",
        email: "",
        stationIds: [],
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");

                const [detail, roleList] = await Promise.all([
                    fetchUserDetail(id),
                    fetchUserRoles(),
                ]);

                if (getRoleSystemName(detail.roles?.[0]) !== "MANAGER") {
                    notify({
                        icon: "warning",
                        title: lang === "VN" ? "Không có quyền" : "Access Denied",
                        text: lang === "VN" ? "Tài khoản này không phải là Quản lý." : "This account is not a Manager.",
                        confirmButtonColor: "#124757",
                        allowOutsideClick: false,
                    }).then(() => navigate("/admin/managers-management"));
                    return;
                }

                setUserInfo(detail);
                setRoles(roleList || []);

                let stationIds = [];
                try {
                    stationIds = await fetchUserStations(id);
                } catch (stationError) {
                    console.warn("Không tải được danh sách bến của user:", stationError);
                    const fromDetail = detail.stationIds || detail.stations;
                    if (Array.isArray(fromDetail)) {
                        stationIds = fromDetail
                            .map((item) =>
                                typeof item === "object"
                                    ? String(item.stationId || item.id || "")
                                    : String(item || "")
                            )
                            .filter(Boolean);
                    }
                }

                setFormData({
                    fullName: detail.fullName || "",
                    dateOfBirth: toInputDate(detail.dateOfBirth),
                    gender: detail.gender || "Male",
                    nationality: detail.nationality || "",
                    phoneNumber: detail.phoneNumber || "",
                    email: detail.email || "",
                    stationIds,
                });
            } catch (error) {
                console.error("Lỗi khi tải chi tiết quản lý:", error);
                if (error.response?.status === 404) {
                    notify({
                        icon: "error",
                        title: lang === "VN" ? "Không tìm thấy!" : "Not Found!",
                        text: lang === "VN" ? "Tài khoản quản lý không tồn tại." : "This manager account does not exist.",
                        confirmButtonColor: "#124757",
                        allowOutsideClick: false,
                    }).then(() => navigate("/admin/managers-management"));
                } else if (error.response?.status === 403) {
                    notify({
                        icon: "warning",
                        title: lang === "VN" ? "Không có quyền" : "Access Denied",
                        text: lang === "VN" ? "Bạn không có quyền xem hoặc chỉnh sửa quản lý này." : "You do not have permission to view or edit this manager.",
                        confirmButtonColor: "#124757",
                        allowOutsideClick: false,
                    }).then(() => navigate("/admin/managers-management"));
                } else {
                    setErrorMsg(lang === "VN" ? "Không thể tải thông tin quản lý do lỗi kết nối." : "Failed to retrieve manager details.");
                }
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const managerRole = useMemo(
        () => roles.find((role) => getRoleSystemName(role) === "MANAGER"),
        [roles]
    );

    // Validate real-time các field bắt buộc (*) — lỗi chỉ hiện cho field đã "touched" (rời khỏi
    // ít nhất 1 lần), nhưng nút Lưu bị khóa ngay khi còn lỗi dù chưa touched hết.
    const [touchedFields, setTouchedFields] = useState({});
    const fieldErrors = useMemo(() => validateManagerFields(formData, lang), [formData, lang]);
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    const visibleFieldErrors = useMemo(() => {
        const visible = {};
        Object.keys(fieldErrors).forEach((field) => {
            if (touchedFields[field]) visible[field] = fieldErrors[field];
        });
        return visible;
    }, [fieldErrors, touchedFields]);

    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleFieldBlur = (field) => {
        setTouchedFields((prev) => ({ ...prev, [field]: true }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        // Bấm submit (VD: nhấn Enter) khi còn lỗi → hiện hết lỗi lên thay vì âm thầm chặn.
        setTouchedFields({ fullName: true, phoneNumber: true, email: true, stationIds: true });
        if (hasFieldErrors) return;
        try {
            setIsSubmitting(true);
            setErrorMsg("");

            const payload = {
                fullName: formData.fullName.trim(),
                dateOfBirth: formData.dateOfBirth || null,
                phoneNumber: formData.phoneNumber.trim(),
                email: formData.email.trim() || null,
                roleId: managerRole?.id,
                gender: formData.gender,
                nationality: formData.nationality.trim() || null,
            };

            await updateUser(id, payload);

            try {
                await assignUserStations(id, formData.stationIds);
            } catch (stationError) {
                console.error("Lỗi gắn bến:", stationError);
                setErrorMsg(
                    getApiErrorMessage(
                        stationError,
                        lang === "VN"
                            ? "Đã lưu hồ sơ nhưng gắn bến thất bại."
                            : "Profile saved but station assignment failed."
                    )
                );
                return;
            }

            notify({
                icon: "success",
                title: lang === "VN" ? "Cập nhật thành công!" : "Successfully Updated!",
                text: lang === "VN" ? "Thông tin quản lý đã được lưu." : "Manager information has been saved.",
                confirmButtonColor: "#124757",
            }).then(() => navigate("/admin/managers-management"));
        } catch (error) {
            console.error("Lỗi cập nhật quản lý:", error);
            setErrorMsg(
                getApiErrorMessage(
                    error,
                    lang === "VN" ? "Cập nhật thất bại." : "Failed to update manager."
                )
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64 w-full">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!userInfo) return null;

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
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <UserAvatar
                        avatarUrl={userInfo.avatarUrl}
                        alt={userInfo.fullName}
                        className="w-12 h-12 rounded-full overflow-hidden border shadow-sm shrink-0"
                    />
                    <div className="min-w-0">
                        <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide truncate">
                            {lang === "VN" ? `Chỉnh sửa quản lí: ${userInfo.code}` : `Edit manager: ${userInfo.code}`}
                        </h2>
                    </div>
                </div>
                {canResetManagedUserPassword(currentUser, userInfo) && (
                    <button
                        type="button"
                        onClick={() => promptResetManagedPassword({ user: userInfo, lang })}
                        className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:border-[#124757] hover:text-[#124757] dark:hover:border-yellow-400 dark:hover:text-yellow-400 transition-all"
                    >
                        <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                        {lang === "VN" ? "Đặt lại mật khẩu" : "Reset password"}
                    </button>
                )}
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
                    {errorMsg}
                </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6">
                <ManagerFormFields
                    lang={lang}
                    formData={formData}
                    onChange={handleInputChange}
                    errors={visibleFieldErrors}
                    onFieldBlur={handleFieldBlur}
                />

                <button
                    type="submit"
                    disabled={isSubmitting || hasFieldErrors}
                    className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                    {lang === "VN" ? "Lưu thay đổi" : "Save Changes"}
                </button>
            </form>
        </div>
    );
}
