import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchUserRoles, createUser } from "../../../services/userService";
import { fetchAllStations } from "../../../services/stationService";
import { getRoleSystemName, isAdminUser, isManagerUser } from "../../../utils/roleHelpers";
import { getApiErrorMessage } from "../../../utils/apiError";
import { FormSelect } from "../../../components/FormSelect";
import { AppDateInput } from "../../../components/AppDateInput";
import { NationalitySelect } from "../../../components/NationalitySelect";
import { canAssignStations } from "../../../components/StationAssignField";
import { notify } from "../../../utils/swalToast";

const ALLOWED_EMAIL_DOMAINS = ["gmail.com", "fpt.edu.vn"];

const isAllowedEmail = (email) => {
  const trimmed = String(email || "").trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(trimmed.slice(at + 1));
};

const getStationId = (station) => String(station?.stationId || station?.id || "");

export function CreateStaff() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user: currentUser } = useSelector((state) => state.auth);

    const isAdmin = isAdminUser(currentUser);
    const isManagerOnly = isManagerUser(currentUser) && !isAdmin;
    const canAccess = isAdmin || isManagerOnly;

    // Admin có quyền tạo cả 2 loại — loại tạo lấy từ query (?type=onboard|ground).
    // Manager chỉ được tạo nhân viên bến, không phụ thuộc query.
    const requestedType = searchParams.get("type");
    const targetStaffType = isManagerOnly
        ? "Ground"
        : requestedType === "ground"
            ? "Ground"
            : "OnBoard";
    const isOnBoardSession = targetStaffType === "OnBoard";

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
        staffType: targetStaffType,
        stationIds: [],
    });

    const [allStations, setAllStations] = useState([]);
    const [isLoadingStations, setIsLoadingStations] = useState(false);

    useEffect(() => {
        if (!canAccess) {
            navigate("/admin/staffs-management", { replace: true });
        }
    }, [canAccess, navigate]);

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
                        ? "Không thể tải vai trò Nhân viên để gán."
                        : "Failed to load the Staff role."
                );
            } finally {
                setIsLoadingRoles(false);
            }
        };
        loadRoles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Admin tạo nhân viên bến → chọn 1 trong tất cả các bến waterbus hiện có.
    useEffect(() => {
        if (!isAdmin || targetStaffType !== "Ground") return;
        let cancelled = false;
        const loadStations = async () => {
            try {
                setIsLoadingStations(true);
                const data = await fetchAllStations();
                if (cancelled) return;
                const rows = (Array.isArray(data) ? data : [])
                    .filter((s) => String(s?.status || "Active").toLowerCase() !== "inactive")
                    .filter((s) => s?.isWaterbusStation === true)
                    .sort((a, b) =>
                        String(a.stationName || "").localeCompare(String(b.stationName || ""), "vi")
                    );
                setAllStations(rows);
            } catch (error) {
                console.error("Lỗi khi tải danh sách bến:", error);
            } finally {
                if (!cancelled) setIsLoadingStations(false);
            }
        };
        loadStations();
        return () => {
            cancelled = true;
        };
    }, [isAdmin, targetStaffType]);

    const staffRole = useMemo(
        () => roles.find((role) => getRoleSystemName(role) === "STAFF"),
        [roles]
    );
    const showStationAssign = canAssignStations({
        roleSystemName: "STAFF",
        staffType: formData.staffType,
    });

    const stationOptions = useMemo(
        () => allStations.map((s) => {
            const id = getStationId(s);
            const code = s.stationCode || s.code || "";
            const name = s.stationName || s.name || "";
            return { value: id, label: [code, name].filter(Boolean).join(" · ") || id };
        }),
        [allStations]
    );

    // Manager chỉ được gắn nhân viên bến vào (các) bến mà chính họ phụ trách — không tự chọn bến khác.
    const managerStations = useMemo(
        () => (currentUser?.stationAssignments || []).filter((s) => s?.isActive !== false),
        [currentUser]
    );

    // Manager chỉ có đúng 1 bến → tự động gắn, không cần tick. Từ 2 bến trở lên → cho tick chọn.
    useEffect(() => {
        if (!isManagerOnly) return;
        if (managerStations.length <= 1) {
            const ids = managerStations.map((s) => String(s.stationId)).filter(Boolean);
            setFormData((prev) => ({ ...prev, stationIds: ids }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isManagerOnly, managerStations.length]);

    const selectManagerStation = (stationId) => {
        setFormData((prev) => ({ ...prev, stationIds: [String(stationId)] }));
    };

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

            if (!staffRole) {
                setErrorMsg(lang === "VN" ? "Không tìm thấy vai trò Nhân viên." : "Staff role not found.");
                return;
            }

            if (targetStaffType === "Ground") {
                if (isManagerOnly) {
                    if (managerStations.length === 0) {
                        setErrorMsg(
                            lang === "VN"
                                ? "Bạn chưa được gắn bến nào nên không thể thêm nhân viên bến."
                                : "You are not assigned to any station, so you cannot add station staff."
                        );
                        return;
                    }
                    if (managerStations.length > 1 && formData.stationIds.length === 0) {
                        setErrorMsg(
                            lang === "VN"
                                ? "Vui lòng chọn ít nhất 1 bến làm việc cho nhân viên."
                                : "Please select at least one working station for the staff."
                        );
                        return;
                    }
                } else if (isAdmin && formData.stationIds.length === 0) {
                    setErrorMsg(
                        lang === "VN"
                            ? "Vui lòng chọn bến làm việc cho nhân viên."
                            : "Please select a working station for the staff."
                    );
                    return;
                }
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
                roleId: staffRole.id,
                staffType: targetStaffType,
                ...(targetStaffType === "Ground" ? { stationIds: formData.stationIds.map(String) } : {}),
            };

            const result = await createUser(payload);
            const generatedPassword = result?.generatedPassword;

            await notify({
                icon: "success",
                title: lang === "VN" ? "Tạo nhân viên thành công!" : "Staff Created Successfully!",
                html: generatedPassword
                    ? (lang === "VN"
                        ? `Tài khoản đã được tạo. Mật khẩu khởi tạo: <b>${generatedPassword}</b><br/>Vui lòng gửi cho người dùng và yêu cầu đổi mật khẩu khi đăng nhập lần đầu.`
                        : `Account created. Initial password: <b>${generatedPassword}</b><br/>Please share it with the user and ask them to change it on first login.`)
                    : (lang === "VN" ? "Tài khoản nhân viên mới đã được thêm vào hệ thống." : "New staff account has been added to the system."),
                confirmButtonColor: "#124757",
            });

            navigate("/admin/staffs-management");
        } catch (error) {
            console.error("Lỗi tạo nhân viên:", error);
            setErrorMsg(
                getApiErrorMessage(
                    error,
                    lang === "VN" ? "Tạo nhân viên thất bại." : "Failed to create staff."
                )
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
    const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
    const selectStyle = `${inputStyle} cursor-pointer`;

    const genderOptions = [
        { value: "Male", label: lang === "VN" ? "Nam" : "Male" },
        { value: "Female", label: lang === "VN" ? "Nữ" : "Female" },
        { value: "Other", label: lang === "VN" ? "Khác" : "Other" },
    ];

    const isSubmitDisabled =
        isSubmitting ||
        isLoadingRoles ||
        !staffRole ||
        (targetStaffType === "Ground" && (
            (isManagerOnly && (managerStations.length === 0 || formData.stationIds.length === 0)) ||
            (isAdmin && formData.stationIds.length === 0)
        ));

    if (!canAccess) return null;

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-3xl mx-auto">
            <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
                <button
                    type="button"
                    onClick={() => navigate("/admin/staffs-management")}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {isOnBoardSession
                            ? (lang === "VN" ? "Thêm nhân viên trên tàu" : "Add boat crew")
                            : (lang === "VN" ? "Thêm nhân viên bến" : "Add station staff")}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {isOnBoardSession
                            ? (lang === "VN"
                                ? "Tạo tài khoản cho nhân viên tàu"
                                : "Create an onboard crew account")
                            : (lang === "VN"
                                ? "Tạo tài khoản cho nhân viên bến"
                                : "Create station staff account")}
                    </p>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm whitespace-pre-line">
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
                            <input type="tel" required placeholder="0901234567" value={formData.phoneNumber} onChange={(e) => handleInputChange("phoneNumber", e.target.value)} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>Email (*)</label>
                            <input
                                type="email"
                                required
                                placeholder="name@gmail.com"
                                value={formData.email}
                                onChange={(e) => handleInputChange("email", e.target.value)}
                                className={inputStyle}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Vai trò được gán" : "Assigned Role"}</label>
                        <div className={`${inputStyle} flex items-center font-bold text-[#124757] dark:text-yellow-400`}>
                            {isLoadingRoles
                                ? (lang === "VN" ? "Đang tải..." : "Loading...")
                                : (staffRole?.displayName || staffRole?.systemName || "Staff")}
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Loại nhân viên" : "Staff type"}</label>
                        <div className={`${inputStyle} flex items-center font-bold text-[#124757] dark:text-yellow-400`}>
                            {isOnBoardSession
                                ? (lang === "VN" ? "Trên tàu" : "Onboard")
                                : (lang === "VN" ? "Bến tàu" : "Station")}
                        </div>
                    </div>

                    {showStationAssign && (
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Bến làm việc" : "Working station"}</label>
                            {isAdmin ? (
                                <>
                                    <FormSelect
                                        required
                                        value={formData.stationIds[0] || ""}
                                        onChange={(value) => setFormData((prev) => ({ ...prev, stationIds: value ? [String(value)] : [] }))}
                                        options={stationOptions}
                                        searchable
                                        disabled={isLoadingStations}
                                        placeholder={
                                            isLoadingStations
                                                ? (lang === "VN" ? "Đang tải bến..." : "Loading stations...")
                                                : (lang === "VN" ? "-- Chọn bến --" : "-- Select station --")
                                        }
                                        searchPlaceholder={lang === "VN" ? "Tìm mã / tên bến..." : "Search station..."}
                                        emptyLabel={lang === "VN" ? "Không có bến" : "No stations"}
                                        className={selectStyle}
                                    />
                                </>
                            ) : managerStations.length > 1 ? (
                                <>
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 divide-y divide-slate-100 dark:divide-slate-700/60">
                                        {managerStations.map((s) => {
                                            const id = String(s.stationId);
                                            const checked = formData.stationIds.map(String).includes(id);
                                            return (
                                                <label
                                                    key={id}
                                                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors"
                                                >
                                                    <input
                                                        type="radio"
                                                        name="managerStation"
                                                        checked={checked}
                                                        onChange={() => selectManagerStation(id)}
                                                        className="accent-[#124757] dark:accent-yellow-400"
                                                    />
                                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                                        {s.stationName || s.stationCode || id}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className={`${inputStyle} flex items-center gap-2 font-bold text-[#124757] dark:text-yellow-400`}>
                                        <span className="material-symbols-outlined text-base">storefront</span>
                                        {managerStations.length > 0
                                            ? managerStations.map((s) => s.stationName).filter(Boolean).join(", ")
                                            : (lang === "VN" ? "Bạn chưa được gắn bến nào." : "You are not assigned to any station.")}
                                    </div>
                                    <p className="mt-1 text-[10px] text-slate-400">
                                        {lang === "VN"
                                            ? "Nhân viên sẽ tự động được gắn vào bến bạn đang phụ trách."
                                            : "Staff will automatically be assigned to the station you manage."}
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                    {isOnBoardSession
                        ? (lang === "VN" ? "Tạo nhân viên trên tàu" : "Create boat crew")
                        : (lang === "VN" ? "Tạo nhân viên bến" : "Create station staff")}
                </button>
            </form>
        </div>
    );
}
