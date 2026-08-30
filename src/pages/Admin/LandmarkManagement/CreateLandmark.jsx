import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { addNewLandmark } from "../../../services/landmarksService";
import { notify } from "../../../utils/swalToast";
import { getApiErrorMessage } from "../../../utils/apiError";
import { LandmarkFormFields } from "./LandmarkFormFields";
import { validateLandmarkFields } from "../../../utils/landmarkValidation";

export function CreateLandmark() {
    const { lang } = useApp();
    const navigate = useNavigate();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const [formData, setFormData] = useState({
        landmarkName: "",
        latitude: 10.7876,
        longitude: 106.706,
        description: "",
        // Không còn field nhập tay trên UI — luôn mặc định 0 dưới code.
        displayOrder: 0,
        triggerRadiusMeters: 300,
        isActive: true,
    });

    // Validate real-time các field bắt buộc (*) — lỗi chỉ hiện cho field đã "touched" (rời khỏi
    // ít nhất 1 lần), nhưng nút Tạo bị khóa ngay khi còn lỗi dù chưa touched hết.
    const [touchedFields, setTouchedFields] = useState({});
    const fieldErrors = useMemo(() => validateLandmarkFields(formData, lang), [formData, lang]);
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    const visibleFieldErrors = useMemo(() => {
        const visible = {};
        Object.keys(fieldErrors).forEach((field) => {
            if (touchedFields[field]) visible[field] = fieldErrors[field];
        });
        return visible;
    }, [fieldErrors, touchedFields]);

    const handleFieldChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleFieldBlur = (field) => {
        setTouchedFields((prev) => ({ ...prev, [field]: true }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        // Bấm submit (VD: nhấn Enter) khi còn lỗi → hiện hết lỗi lên thay vì âm thầm chặn.
        setTouchedFields({ landmarkName: true, description: true, triggerRadiusMeters: true });
        if (hasFieldErrors) return;

        const name = formData.landmarkName.trim();
        const latitude = Number(formData.latitude);
        const longitude = Number(formData.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            setErrorMsg(lang === "VN" ? "Tọa độ vĩ độ / kinh độ không hợp lệ." : "Latitude / longitude are invalid.");
            return;
        }

        try {
            setIsSubmitting(true);
            setErrorMsg("");

            const payload = {
                landmarkName: name,
                latitude,
                longitude,
                description: formData.description.trim(),
                displayOrder: Number(formData.displayOrder),
                triggerRadiusMeters: Number(formData.triggerRadiusMeters),
                isActive: formData.isActive,
            };

            await addNewLandmark(payload);

            notify({
                icon: "success",
                title: lang === "VN" ? "Tạo landmark thành công!" : "Landmark created!",
                text: lang === "VN"
                    ? "Landmark đã được thêm. Bake audio thuyết minh và gắn ở màn chỉnh sửa khi sẵn sàng."
                    : "Landmark saved. Bake the narration audio and attach it from the edit screen when ready.",
                confirmButtonColor: "#124757",
            }).then(() => navigate("/admin/landmarks-management"));
        } catch (error) {
            console.error("Lỗi tạo landmark:", error);
            setErrorMsg(getApiErrorMessage(error, lang === "VN" ? "Không tạo được landmark." : "Failed to create landmark."));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl animate-fade-in space-y-6 px-2 pb-10 font-body sm:px-4">
            <div className="flex items-center gap-4 rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
                <button
                    type="button"
                    onClick={() => navigate("/admin/landmarks-management")}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 shadow-inner transition-all hover:bg-[#124757] hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-yellow-400 dark:hover:text-slate-900"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div>
                    <h2 className="font-headline text-xl font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400 md:text-2xl">
                        {lang === "VN" ? "Thêm landmark mới" : "Add New Landmark"}
                    </h2>
                </div>
            </div>

            {errorMsg ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600 shadow-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                    {errorMsg}
                </div>
            ) : null}

            <form onSubmit={handleFormSubmit} className="space-y-6">
                <LandmarkFormFields
                    lang={lang}
                    formData={formData}
                    onChange={handleFieldChange}
                    errors={visibleFieldErrors}
                    onFieldBlur={handleFieldBlur}
                />

                <button
                    type="submit"
                    disabled={isSubmitting || hasFieldErrors}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#124757] py-4 font-headline text-xs font-black uppercase tracking-wider text-white shadow-md transition-all hover:brightness-110 disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
                >
                    {isSubmitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
                    {lang === "VN" ? "Tạo landmark" : "Create Landmark"}
                </button>
            </form>
        </div>
    );
}
