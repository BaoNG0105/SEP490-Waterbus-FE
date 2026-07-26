import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchUserDetail, fetchUserRoles, updateUser, fetchUserStations, assignUserStations } from "../../../services/userService";
import { fetchAllStations } from "../../../services/stationService";
import { canManageUserRow, getRoleSystemName, isAdminUser } from "../../../utils/roleHelpers";
import { getApiErrorMessage } from "../../../utils/apiError";
import { FormSelect } from "../../../components/FormSelect";
import { AppDateInput } from "../../../components/AppDateInput";
import { NationalitySelect } from "../../../components/NationalitySelect";
import { canAssignStations } from "../../../components/StationAssignField";
import { notify } from "../../../utils/swalToast";

const ALLOWED_EMAIL_DOMAINS = ["gmail.com", "fpt.edu.vn"];

const isAllowedEmail = (email) => {
    const trimmed = String(email || "").trim().toLowerCase();
    if (!trimmed) return true;
    const at = trimmed.lastIndexOf("@");
    if (at < 1 || at === trimmed.length - 1) return false;
    return ALLOWED_EMAIL_DOMAINS.includes(trimmed.slice(at + 1));
};

const DEFAULT_AVATAR = "https://res.cloudinary.com/dygipvoal/image/upload/v1782985383/piwocu1i25ijlua88bn0.webp";

// Chuyển đổi chuỗi ngày sinh trả về từ BE (có thể là ISO hoặc dd/MM/yyyy) sang định dạng yyyy-MM-dd cho input HTML5
const toInputDate = (value) => {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return "";
};

const normalizeStaffTypeValue = (value) => {
    const raw = String(value || "").toLowerCase().replace(/[_\s-]/g, "");
    if (raw === "onboard" || raw === "2") return "OnBoard";
    if (raw === "ground" || raw === "1") return "Ground";
    return "";
};

export function EditStaff() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const { id } = useParams();
    const { user: currentUser } = useSelector((state) => state.auth);
    const isCurrentUserAdmin = isAdminUser(currentUser);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [roles, setRoles] = useState([]);
    const [userInfo, setUserInfo] = useState(null);
    const [stations, setStations] = useState([]);

    const [formData, setFormData] = useState({
        fullName: "",
        dateOfBirth: "",
        gender: "Male",
        nationality: "",
        phoneNumber: "",
        email: "",
        staffType: "",
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

                if (!canManageUserRow(currentUser, detail.roles)) {
                    notify({
                        icon: "warning",
                        title: lang === "VN" ? "Không có quyền" : "Access Denied",
                        text: lang === "VN" ? "Bạn không có quyền chỉnh sửa nhân viên này." : "You do not have permission to edit this staff.",
                        confirmButtonColor: "#124757",
                        allowOutsideClick: false,
                    }).then(() => navigate("/admin/staffs-management"));
                    return;
                }

                if (getRoleSystemName(detail.roles?.[0]) !== "STAFF") {
                    notify({
                        icon: "warning",
                        title: lang === "VN" ? "Không có quyền" : "Access Denied",
                        text: lang === "VN" ? "Tài khoản này không phải là Nhân viên." : "This account is not a Staff.",
                        confirmButtonColor: "#124757",
                        allowOutsideClick: false,
                    }).then(() => navigate("/admin/staffs-management"));
                    return;
                }

                setUserInfo(detail);
                setRoles(roleList || []);

                const staffType = normalizeStaffTypeValue(detail.staffType) || "Ground";

                let stationIds = [];
                const eligible = canAssignStations({ roleSystemName: "STAFF", staffType });
                if (eligible) {
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
                }

                setFormData({
                    fullName: detail.fullName || "",
                    dateOfBirth: toInputDate(detail.dateOfBirth),
                    gender: detail.gender || "Male",
                    nationality: detail.nationality || "",
                    phoneNumber: detail.phoneNumber || "",
                    email: detail.email || "",
                    staffType,
                    stationIds,
                });
            } catch (error) {
                console.error("Lỗi khi tải chi tiết nhân viên:", error);
                if (error.response?.status === 404) {
                    notify({
                        icon: "error",
                        title: lang === "VN" ? "Không tìm thấy!" : "Not Found!",
                        text: lang === "VN" ? "Tài khoản nhân viên không tồn tại." : "This staff account does not exist.",
                        confirmButtonColor: "#124757",
                        allowOutsideClick: false,
                    }).then(() => navigate("/admin/staffs-management"));
                } else if (error.response?.status === 403) {
                    notify({
                        icon: "warning",
                        title: lang === "VN" ? "Không có quyền" : "Access Denied",
                        text: lang === "VN" ? "Bạn không có quyền xem hoặc chỉnh sửa nhân viên này." : "You do not have permission to view or edit this staff.",
                        confirmButtonColor: "#124757",
                        allowOutsideClick: false,
                    }).then(() => navigate("/admin/staffs-management"));
                } else {
                    setErrorMsg(lang === "VN" ? "Không thể tải thông tin nhân viên do lỗi kết nối." : "Failed to retrieve staff details.");
                }
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        fetchAllStations()
            .then((data) => {
                const rows = (Array.isArray(data) ? data : [])
                    .filter((s) => String(s?.status || "Active").toLowerCase() !== "inactive")
                    .filter((s) => s?.isWaterbusStation === true)
                    .sort((a, b) =>
                        String(a.stationName || "").localeCompare(String(b.stationName || ""), "vi")
                    );
                setStations(rows);
            })
            .catch((error) => console.warn("Không tải được danh sách bến:", error));
    }, []);

    const staffRole = useMemo(
        () => roles.find((role) => getRoleSystemName(role) === "STAFF"),
        [roles]
    );
    const showStationAssign = canAssignStations({
        roleSystemName: "STAFF",
        staffType: formData.staffType,
    });

    const stationNameById = useMemo(() => {
        const map = new Map();
        stations.forEach((s) => {
            const sid = String(s?.stationId || s?.id || "");
            if (sid) map.set(sid, s.stationName || s.name || s.stationCode || sid);
        });
        return map;
    }, [stations]);

    const stationOptions = useMemo(
        () => stations.map((s) => {
            const sid = String(s?.stationId || s?.id || "");
            const code = s.stationCode || s.code || "";
            const name = s.stationName || s.name || "";
            return { value: sid, label: [code, name].filter(Boolean).join(" · ") || sid };
        }),
        [stations]
    );

    const handleInputChange = (field, value) => {
        setFormData((prev) => {
            const next = { ...prev, [field]: value };
            if (field === "staffType" && !canAssignStations({ roleSystemName: "STAFF", staffType: value })) {
                next.stationIds = [];
            }
            return next;
        });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            setErrorMsg("");

            if (!formData.staffType) {
                setErrorMsg(lang === "VN" ? "Chọn loại nhân viên (bến tàu / trên tàu)." : "Select staff type (Station / OnBoard).");
                return;
            }

            if (isCurrentUserAdmin && showStationAssign && formData.stationIds.length === 0) {
                setErrorMsg(
                    lang === "VN"
                        ? "Vui lòng chọn bến làm việc cho nhân viên."
                        : "Please select a working station for the staff."
                );
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
                dateOfBirth: formData.dateOfBirth || null,
                phoneNumber: formData.phoneNumber.trim(),
                email: formData.email.trim() || null,
                roleId: staffRole?.id,
                gender: formData.gender,
                nationality: formData.nationality.trim() || null,
                staffType: formData.staffType,
            };

            await updateUser(id, payload);

            // Đồng bộ gắn bến (Staff Ground). OnBoard → clear [].
            try {
                await assignUserStations(
                    id,
                    showStationAssign ? formData.stationIds : []
                );
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
                text: lang === "VN" ? "Thông tin nhân viên đã được lưu." : "Staff information has been saved.",
                confirmButtonColor: "#124757",
            }).then(() => navigate("/admin/staffs-management"));
        } catch (error) {
            console.error("Lỗi cập nhật nhân viên:", error);
            setErrorMsg(
                getApiErrorMessage(
                    error,
                    lang === "VN" ? "Cập nhật thất bại." : "Failed to update staff."
                )
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
    const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
    const selectStyle = `${inputStyle} cursor-pointer`;
    const readOnlyStyle = "w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 shadow-inner opacity-70 cursor-not-allowed";

    const genderOptions = [
        { value: "Male", label: lang === "VN" ? "Nam" : "Male" },
        { value: "Female", label: lang === "VN" ? "Nữ" : "Female" },
        { value: "Other", label: lang === "VN" ? "Khác" : "Other" },
    ];
    const staffTypeLabel = formData.staffType === "OnBoard"
        ? (lang === "VN" ? "Trên tàu" : "Onboard")
        : (lang === "VN" ? "Bến tàu" : "Station");

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64 w-full">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!userInfo) return null;

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-3xl mx-auto">

            {/* KHỐI TIÊU ĐỀ HEADER */}
            <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
                <button
                    type="button"
                    onClick={() => navigate("/admin/staffs-management")}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden border bg-slate-100 dark:bg-slate-700 shadow-sm shrink-0">
                        <img
                            src={userInfo.avatarUrl || DEFAULT_AVATAR}
                            alt={userInfo.fullName}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                        />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide truncate">
                            {lang === "VN" ? `Chỉnh sửa: ${userInfo.code}` : `Edit: ${userInfo.code}`}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {lang === "VN" ? "Cập nhật hồ sơ cá nhân và loại nhân viên" : "Update the staff's personal profile and staff type"}
                        </p>
                    </div>
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
                            <input type="text" required value={formData.fullName} onChange={(e) => handleInputChange("fullName", e.target.value)} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Ngày sinh" : "Date of Birth"}</label>
                            <AppDateInput value={formData.dateOfBirth} onChange={(e) => handleInputChange("dateOfBirth", e.target.value)} className={inputStyle} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Giới tính" : "Gender"}</label>
                            <FormSelect
                                value={formData.gender}
                                onChange={(v) => handleInputChange("gender", v)}
                                options={genderOptions}
                                className={selectStyle}
                            />
                        </div>
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Quốc tịch" : "Nationality"}</label>
                            <NationalitySelect
                                value={formData.nationality}
                                onChange={(v) => handleInputChange("nationality", v)}
                                className={selectStyle}
                            />
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
                            <input type="tel" required value={formData.phoneNumber} onChange={(e) => handleInputChange("phoneNumber", e.target.value)} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Email (*)</label>
                            <input type="email" required value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} className={inputStyle} />
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Vai trò được gán" : "Assigned Role"}</label>
                        <div className={readOnlyStyle}>
                            {staffRole?.displayName || staffRole?.systemName || "Staff"}
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Loại nhân viên (*)" : "Staff type (*)"}</label>
                        <div className={readOnlyStyle}>
                            {staffTypeLabel}
                        </div>
                    </div>

                    {showStationAssign && (
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Gắn bến làm việc" : "Assigned stations"}</label>
                            {isCurrentUserAdmin ? (
                                <FormSelect
                                    required
                                    value={formData.stationIds[0] || ""}
                                    onChange={(value) => setFormData((prev) => ({ ...prev, stationIds: value ? [String(value)] : [] }))}
                                    options={stationOptions}
                                    searchable
                                    placeholder={lang === "VN" ? "-- Chọn bến --" : "-- Select station --"}
                                    searchPlaceholder={lang === "VN" ? "Tìm mã / tên bến..." : "Search station..."}
                                    emptyLabel={lang === "VN" ? "Không có bến" : "No stations"}
                                    className={selectStyle}
                                />
                            ) : (
                                <div className={readOnlyStyle}>
                                    {formData.stationIds.length > 0
                                        ? formData.stationIds
                                            .map((sid) => stationNameById.get(String(sid)) || sid)
                                            .join(", ")
                                        : (lang === "VN" ? "Chưa gắn bến." : "No station assigned.")}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || (isCurrentUserAdmin && showStationAssign && formData.stationIds.length === 0)}
                    className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                    {lang === "VN" ? "Lưu thay đổi" : "Save Changes"}
                </button>
            </form>
        </div>
    );
}
