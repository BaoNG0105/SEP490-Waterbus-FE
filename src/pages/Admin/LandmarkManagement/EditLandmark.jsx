import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import {
    fetchLandmarkDetail,
    modifyLandmark,
    removeLandmarkAudio,
} from "../../../services/landmarksService";
import { notify } from "../../../utils/swalToast";
import { getApiErrorMessage } from "../../../utils/apiError";
import { LandmarkFormFields } from "./LandmarkFormFields";
import { validateLandmarkFields } from "../../../utils/landmarkValidation";

export function EditLandmark() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const [audios, setAudios] = useState([]);
    const [deletingAudioId, setDeletingAudioId] = useState(null);

    const [formData, setFormData] = useState({
        landmarkName: "",
        latitude: 10.7876,
        longitude: 106.706,
        description: "",
        displayOrder: 1,
        triggerRadiusMeters: 300,
        isActive: true,
    });

    const applyLandmarkRecord = (data) => {
        setFormData({
            landmarkName: data.landmarkName || "",
            latitude: Number(data.latitude) || 10.7876,
            longitude: Number(data.longitude) || 106.706,
            description: data.description || "",
            displayOrder: Number(data.displayOrder) || 0,
            triggerRadiusMeters: Number(data.triggerRadiusMeters) || 300,
            isActive: data.isActive !== false,
        });
        setAudios(data.audios || []);
    };

    useEffect(() => {
        const preloaded = location.state?.landmark;
        if (preloaded && String(preloaded.id) === String(id)) {
            applyLandmarkRecord(preloaded);
            setIsLoading(false);
            return;
        }

        const getLandmarkRecord = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");
                const data = await fetchLandmarkDetail(id);
                applyLandmarkRecord(data);
            } catch (error) {
                console.error("Lỗi khi tải chi tiết landmark:", error);
                if (error.response?.status === 404) {
                    notify({
                        icon: "error",
                        title: lang === "VN" ? "Không tìm thấy landmark!" : "Landmark Not Found!",
                        text: lang === "VN" ? "Landmark này không tồn tại. Quay về danh sách." : "This landmark no longer exists.",
                        confirmButtonColor: "#124757",
                        allowOutsideClick: false,
                    }).then(() => navigate("/admin/landmarks-management"));
                } else {
                    setErrorMsg(getApiErrorMessage(error, lang === "VN" ? "Không thể lấy thông tin landmark." : "Failed to retrieve landmark details."));
                }
            } finally {
                setIsLoading(false);
            }
        };
        getLandmarkRecord();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Validate real-time các field bắt buộc (*) — lỗi chỉ hiện cho field đã "touched" (rời khỏi
    // ít nhất 1 lần), nhưng nút Lưu bị khóa ngay khi còn lỗi dù chưa touched hết.
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
        setTouchedFields({ landmarkName: true, description: true, displayOrder: true, triggerRadiusMeters: true });
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

            await modifyLandmark(id, payload);

            notify({
                icon: "success",
                title: lang === "VN" ? "Cập nhật thành công!" : "Successfully saved!",
                text: lang === "VN"
                    ? "Nếu vừa đổi mô tả, nhớ bake lại audio — server không tự re-bake."
                    : "If you changed the description, remember to re-bake the audio — the server won't do it automatically.",
                confirmButtonColor: "#124757",
            }).then(() => navigate("/admin/landmarks-management"));
        } catch (error) {
            console.error("Lỗi cập nhật landmark:", error);
            setErrorMsg(getApiErrorMessage(error, lang === "VN" ? "Không thể lưu thông tin landmark." : "Failed to save landmark details."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAudio = async (audio) => {
        const confirmResult = await notify({
            title: lang === "VN" ? "Xóa audio này?" : "Delete this audio?",
            html: lang === "VN"
                ? `Audio giọng <b>${audio.voiceName || audio.voiceId}</b> sẽ bị xóa vĩnh viễn.`
                : `Audio for voice <b>${audio.voiceName || audio.voiceId}</b> will be permanently deleted.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#124757",
            confirmButtonText: lang === "VN" ? "Xóa" : "Delete",
            cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
        });
        if (!confirmResult.isConfirmed) return;

        try {
            setDeletingAudioId(audio.audioId);
            await removeLandmarkAudio(audio.audioId);
            setAudios((prev) => prev.filter((item) => item.audioId !== audio.audioId));
            notify({
                toast: true,
                icon: "success",
                title: lang === "VN" ? "Đã xóa audio" : "Audio deleted",
                showConfirmButton: false,
                timer: 1600,
            });
        } catch (error) {
            console.error("Lỗi khi xóa audio landmark:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Thất bại" : "Failed",
                text: getApiErrorMessage(error, lang === "VN" ? "Không thể xóa audio này." : "Failed to delete this audio."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setDeletingAudioId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64 w-full">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">

            <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
                <button
                    type="button"
                    onClick={() => navigate("/admin/landmarks-management")}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? `Cấu hình landmark: ${formData.landmarkName}` : `Configure Landmark: ${formData.landmarkName}`}
                    </h2>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
                    {errorMsg}
                </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6">
                <LandmarkFormFields
                    lang={lang}
                    formData={formData}
                    onChange={handleFieldChange}
                    errors={visibleFieldErrors}
                    onFieldBlur={handleFieldBlur}
                />
                <button type="submit" disabled={isSubmitting || hasFieldErrors} className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-3.5 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                    {isSubmitting && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                    {lang === "VN" ? "Lưu thông tin landmark" : "Save Landmark"}
                </button>
            </form>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                <div className="border-b border-slate-100 dark:border-slate-700 pb-2">
                    <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                        {lang === "VN" ? "Audio thuyết minh đã bake" : "Baked Narration Audio"}
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                        {lang === "VN"
                            ? "Mỗi giọng (voiceId) có 1 audio đã được bake sẵn."
                            : "Each voice (voiceId) has one pre-baked audio."}
                    </p>
                </div>

                {audios.length === 0 ? (
                    <p className="text-xs text-slate-400 italic font-medium py-2">
                        {lang === "VN" ? "Chưa có audio nào được bake cho landmark này." : "No audio has been baked for this landmark yet."}
                    </p>
                ) : (
                    <div className="space-y-2">
                        {audios.map((audio) => (
                            <div key={audio.audioId} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900 p-3">
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 shrink-0">
                                            {audio.voiceName || (lang === "VN" ? "Giọng" : "Voice")}
                                        </span>
                                        <span className="text-[10px] text-slate-400 truncate">{audio.voiceId}</span>
                                    </div>
                                    <audio controls src={audio.audioUrl} className="h-8 w-full max-w-sm" />
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {audio.durationSeconds > 0 && (
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                                            {audio.durationSeconds.toFixed(1)}s
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteAudio(audio)}
                                        disabled={deletingAudioId === audio.audioId}
                                        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 transition-all disabled:opacity-40"
                                        title={lang === "VN" ? "Xóa audio" : "Delete audio"}
                                    >
                                        {deletingAudioId === audio.audioId ? (
                                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
