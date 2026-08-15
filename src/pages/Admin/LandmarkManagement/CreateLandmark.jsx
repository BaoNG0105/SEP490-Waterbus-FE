import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { addNewLandmark } from "../../../services/landmarksService";
import { notify } from "../../../utils/swalToast";
import { getApiErrorMessage } from "../../../utils/apiError";
import { LandmarkFormFields } from "./LandmarkFormFields";

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
        displayOrder: 1,
        triggerRadiusMeters: 300,
        isActive: true,
    });

    const handleFieldChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const name = formData.landmarkName.trim();
        if (!name) {
            setErrorMsg(lang === "VN" ? "Vui lòng nhập tên landmark." : "Landmark name is required.");
            return;
        }

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
                description: formData.description.trim() || null,
                displayOrder: Number(formData.displayOrder) || 0,
                triggerRadiusMeters: Number(formData.triggerRadiusMeters) || 300,
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
                <LandmarkFormFields lang={lang} formData={formData} onChange={handleFieldChange} />

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#124757] py-4 font-headline text-xs font-black uppercase tracking-wider text-white shadow-md transition-all hover:brightness-110 disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
                >
                    {isSubmitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
                    {lang === "VN" ? "Tạo landmark" : "Create Landmark"}
                </button>
            </form>
        </div>
    );
}
