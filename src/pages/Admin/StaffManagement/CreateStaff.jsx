import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchUserRoles, createUser } from "../../../services/userService";
import { fetchAllStations } from "../../../services/stationService";
import { getRoleSystemName, isAdminUser, isManagerUser } from "../../../utils/roleHelpers";
import { getApiErrorMessage } from "../../../utils/apiError";
import { FormSelect } from "../../../components/FormSelect";
import { canAssignStations } from "../../../components/StationAssignField";
import { notify } from "../../../utils/swalToast";
import { StaffFormFields } from "./StaffFormFields";
import { validateStaffFields } from "../../../utils/staffValidation";

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
            return { value: id, label: name || code || id, searchText: `${code} ${name}` };
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

    // Validate real-time các field bắt buộc (*) — lỗi chỉ hiện cho field đã "touched" (rời khỏi
    // ít nhất 1 lần), nhưng nút Tạo bị khóa ngay khi còn lỗi dù chưa touched hết.
    const [touchedFields, setTouchedFields] = useState({});
    const fieldErrors = useMemo(() => validateStaffFields(formData, lang), [formData, lang]);
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    const visibleFieldErrors = useMemo(() => {
        const visible = {};
        Object.keys(fieldErrors).forEach((field) => {
            if (touchedFields[field]) visible[field] = fieldErrors[field];
        });
        return visible;
    }, [fieldErrors, touchedFields]);

    const handleInputChange = (field, value) => {
        setFormData((prev) => {
            const next = { ...prev, [field]: value };
            if (field === "staffType" && !canAssignStations({ roleSystemName: "STAFF", staffType: value })) {
                next.stationIds = [];
            }
            return next;
        });
    };

    const handleFieldBlur = (field) => {
        setTouchedFields((prev) => ({ ...prev, [field]: true }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        // Bấm submit (VD: nhấn Enter) khi còn lỗi → hiện hết lỗi lên thay vì âm thầm chặn.
        setTouchedFields({ fullName: true, phoneNumber: true, email: true });
        if (hasFieldErrors) return;
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

    const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
    const selectStyle = `${inputStyle} cursor-pointer`;

    const isSubmitDisabled =
        isSubmitting ||
        isLoadingRoles ||
        !staffRole ||
        hasFieldErrors ||
        (targetStaffType === "Ground" && (
            (isManagerOnly && (managerStations.length === 0 || formData.stationIds.length === 0)) ||
            (isAdmin && formData.stationIds.length === 0)
        ));
    const stationSelectionError = targetStaffType === "Ground" && formData.stationIds.length === 0
        ? (lang === "VN" ? "Vui lòng chọn bến làm việc." : "Please select a working station.")
        : "";
    const stationErrorSelectStyle = `${selectStyle} !border-rose-500 !bg-rose-50/50 focus:!ring-rose-500 dark:!bg-rose-500/10`;

    if (!canAccess) return null;

    return (
        <div className="mx-auto max-w-4xl space-y-5 px-2 pb-10 font-body sm:px-4">
            <div className="flex items-center gap-3 rounded-4xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:px-6">
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
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm whitespace-pre-line">
                    {errorMsg}
                </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-5">
                <StaffFormFields
                    lang={lang}
                    formData={formData}
                    onChange={handleInputChange}
                    errors={visibleFieldErrors}
                    onFieldBlur={handleFieldBlur}
                    namePlaceholder={lang === "VN" ? "VD: Nguyễn Văn A" : "e.g. John Doe"}
                    phonePlaceholder="0901234567"
                    emailPlaceholder="name@gmail.com"
                    showStationAssign={showStationAssign}
                    stationAssignLabel={lang === "VN" ? "Bến làm việc" : "Working station"}
                    stationError={stationSelectionError}
                    stationAssignSlot={
                        isAdmin ? (
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
                                searchPlaceholder={lang === "VN" ? "Tìm tên bến..." : "Search station name..."}
                                emptyLabel={lang === "VN" ? "Không có bến" : "No stations"}
                                className={stationSelectionError ? stationErrorSelectStyle : selectStyle}
                            />
                        ) : managerStations.length > 1 ? (
                            <div className={`rounded-xl border bg-slate-50/80 divide-y divide-slate-100 dark:bg-slate-900/60 dark:divide-slate-700/60 ${stationSelectionError ? "!border-rose-500" : "border-slate-200 dark:border-slate-700"}`}>
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
                        ) : (
                            <div className={`${inputStyle} flex items-center gap-2 font-bold text-[#124757] dark:text-yellow-400`}>
                                {managerStations.length > 0
                                    ? managerStations.map((s) => s.stationName).filter(Boolean).join(", ")
                                    : (lang === "VN" ? "Bạn chưa được gắn bến nào." : "You are not assigned to any station.")}
                            </div>
                        )
                    }
                />

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
