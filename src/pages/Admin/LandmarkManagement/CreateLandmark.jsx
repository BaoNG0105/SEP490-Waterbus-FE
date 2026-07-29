import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { addNewLandmark } from "../../../services/landmarksService";
import { WaterwayMap } from "../../../components/WaterwayMap";
import { notify } from "../../../utils/swalToast";
import { getApiErrorMessage } from "../../../utils/apiError";

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

    const labelStyle = "mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500";
    const inputStyle = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 outline-none shadow-inner transition-all focus:ring-2 focus:ring-[#124757] dark:border-slate-700/60 dark:bg-slate-900 dark:text-white dark:focus:ring-yellow-400";

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
                    <p className="mt-0.5 text-xs text-slate-400">
                        {lang === "VN"
                            ? "Landmark không gắn tuyến — định danh bằng tọa độ, dùng chung mọi tuyến đi ngang qua."
                            : "Landmarks aren't tied to a route — they're identified by coordinates and shared across every route passing through."}
                    </p>
                </div>
            </div>

            {errorMsg ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600 shadow-sm dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                    {errorMsg}
                </div>
            ) : null}

            <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
                    <div className="flex h-full flex-col space-y-6 rounded-4xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-700/50 dark:bg-slate-800">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-700">
                            <h3 className="font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                                {lang === "VN" ? "Thông tin landmark" : "Landmark details"}
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold uppercase ${formData.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                                    {formData.isActive ? (lang === "VN" ? "Kích hoạt" : "Active") : (lang === "VN" ? "Tạm ẩn" : "Inactive")}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleFieldChange("isActive", !formData.isActive)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${formData.isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                                >
                                    <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${formData.isActive ? "translate-x-4" : "translate-x-0"}`} />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Tên landmark (*)" : "Landmark Name (*)"}</label>
                            <input
                                type="text"
                                required
                                value={formData.landmarkName}
                                onChange={(e) => handleFieldChange("landmarkName", e.target.value)}
                                placeholder={lang === "VN" ? "VD: Cầu Ba Son" : "e.g. Ba Son Bridge"}
                                className={inputStyle}
                            />
                        </div>

                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Mô tả (nội dung sẽ được bake thành audio)" : "Description (text used to bake audio)"}</label>
                            <textarea
                                rows={4}
                                value={formData.description}
                                onChange={(e) => handleFieldChange("description", e.target.value)}
                                className={`${inputStyle} resize-none font-medium`}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                            <div>
                                <label className={labelStyle}>{lang === "VN" ? "Thứ tự hiển thị" : "Display Order"}</label>
                                <input
                                    type="number"
                                    value={formData.displayOrder}
                                    onChange={(e) => handleFieldChange("displayOrder", e.target.value)}
                                    className={inputStyle}
                                />
                            </div>
                            <div>
                                <label className={labelStyle}>{lang === "VN" ? "Bán kính kích hoạt (m)" : "Trigger Radius (m)"}</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formData.triggerRadiusMeters}
                                    onChange={(e) => handleFieldChange("triggerRadiusMeters", e.target.value)}
                                    className={inputStyle}
                                />
                            </div>
                        </div>

                        <p className="mt-auto rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] font-medium text-slate-400 dark:border-slate-700/60 dark:bg-slate-900">
                            {lang === "VN"
                                ? "displayOrder chỉ dùng để sắp xếp ở màn admin; triggerRadiusMeters là bán kính kích hoạt phát audio."
                                : "displayOrder is only used for sorting in the admin screen; triggerRadiusMeters is the playback trigger radius."}
                        </p>
                    </div>

                    <div className="flex h-145 min-h-145 flex-col rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 lg:h-auto">
                        <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-2">
                            <div>
                                <h3 className="font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                                    {lang === "VN" ? "Vị trí trên bản đồ" : "Map location"}
                                </h3>
                                <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                    {lang === "VN" ? "Click bản đồ để đánh dấu vị trí landmark." : "Click the map to mark the landmark location."}
                                </p>
                            </div>
                            <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold tabular-nums text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                {Number(formData.latitude).toFixed(5)}, {Number(formData.longitude).toFixed(5)}
                            </p>
                        </div>
                        <div className="relative min-h-75 w-full flex-1">
                            <div className="absolute inset-0">
                                <WaterwayMap
                                    stationPoint={{
                                        name: formData.landmarkName || (lang === "VN" ? "Landmark mới" : "New landmark"),
                                        latitude: Number(formData.latitude) || 10.7876,
                                        longitude: Number(formData.longitude) || 106.706,
                                    }}
                                    onLocationSelect={(lat, lng) => {
                                        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

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
