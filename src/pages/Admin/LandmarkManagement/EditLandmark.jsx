import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import {
    fetchLandmarkDetail,
    modifyLandmark,
    saveLandmarkAudio,
    removeLandmarkAudio,
} from "../../../services/landmarksService";
import { WaterwayMap } from "../../../components/WaterwayMap";
import { notify } from "../../../utils/swalToast";
import { getApiErrorMessage } from "../../../utils/apiError";

const EMPTY_AUDIO_FORM = { voiceId: "", audioUrl: "", durationSeconds: "" };

export function EditLandmark() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const [audios, setAudios] = useState([]);
    const [audioForm, setAudioForm] = useState(EMPTY_AUDIO_FORM);
    const [isSavingAudio, setIsSavingAudio] = useState(false);
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

            await modifyLandmark(id, payload);

            notify({
                icon: "success",
                title: lang === "VN" ? "Cập nhật thành công!" : "Successfully saved!",
                text: lang === "VN"
                    ? "Nếu vừa đổi mô tả, nhớ bake lại audio và lưu ở khối bên dưới — server không tự re-bake."
                    : "If you changed the description, remember to re-bake the audio in the panel below — the server won't do it automatically.",
                confirmButtonColor: "#124757",
            }).then(() => navigate("/admin/landmarks-management"));
        } catch (error) {
            console.error("Lỗi cập nhật landmark:", error);
            setErrorMsg(getApiErrorMessage(error, lang === "VN" ? "Không thể lưu thông tin landmark." : "Failed to save landmark details."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAudioFieldChange = (field, value) => {
        setAudioForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSaveAudio = async (e) => {
        e.preventDefault();
        const voiceId = audioForm.voiceId.trim();
        const audioUrl = audioForm.audioUrl.trim();
        if (!voiceId || !audioUrl) {
            notify({
                icon: "warning",
                title: lang === "VN" ? "Thiếu thông tin" : "Missing fields",
                text: lang === "VN" ? "Cần nhập voiceId và audioUrl." : "voiceId and audioUrl are required.",
                confirmButtonColor: "#124757",
            });
            return;
        }

        try {
            setIsSavingAudio(true);
            const updated = await saveLandmarkAudio(id, {
                voiceId,
                audioUrl,
                durationSeconds: Number(audioForm.durationSeconds) || 0,
            });

            notify({
                toast: true,
                icon: "success",
                title: lang === "VN" ? "Đã lưu audio" : "Audio saved",
                showConfirmButton: false,
                timer: 1600,
            });

            if (Array.isArray(updated?.audios)) {
                setAudios(updated.audios);
            } else {
                const refreshed = await fetchLandmarkDetail(id);
                setAudios(refreshed.audios || []);
            }
            setAudioForm(EMPTY_AUDIO_FORM);
        } catch (error) {
            console.error("Lỗi khi lưu audio landmark:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Thất bại" : "Failed",
                text: getApiErrorMessage(error, lang === "VN" ? "Không thể lưu audio này." : "Failed to save this audio."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setIsSavingAudio(false);
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

    const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
    const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";

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
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN"
                            ? "Cập nhật full replace — mọi field bỏ trống sẽ bị ghi đè."
                            : "This is a full replace — any field left blank will be overwritten."}
                    </p>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
                    {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

                <form onSubmit={handleFormSubmit} className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                            {lang === "VN" ? "Thông tin landmark" : "Landmark Profile"}
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase ${formData.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                                {formData.isActive ? (lang === "VN" ? "Kích hoạt" : "Active") : (lang === "VN" ? "Tạm ẩn" : "Inactive")}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleFieldChange("isActive", !formData.isActive)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out border-2 border-transparent focus:outline-none ${formData.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                            >
                                <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${formData.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Tên landmark (*)" : "Landmark Name (*)"}</label>
                        <input type="text" required value={formData.landmarkName} onChange={(e) => handleFieldChange("landmarkName", e.target.value)} className={inputStyle} />
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Mô tả (nội dung bake audio)" : "Description (text used to bake audio)"}</label>
                        <textarea rows={4} value={formData.description} onChange={(e) => handleFieldChange("description", e.target.value)} className={`${inputStyle} resize-none font-medium`} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Thứ tự hiển thị" : "Display Order"}</label>
                            <input type="number" value={formData.displayOrder} onChange={(e) => handleFieldChange("displayOrder", e.target.value)} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Bán kính kích hoạt (m)" : "Trigger Radius (m)"}</label>
                            <input type="number" min={0} value={formData.triggerRadiusMeters} onChange={(e) => handleFieldChange("triggerRadiusMeters", e.target.value)} className={inputStyle} />
                        </div>
                    </div>

                    <button type="submit" disabled={isSubmitting} className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-3.5 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4">
                        {isSubmitting && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                        {lang === "VN" ? "Lưu thông tin landmark" : "Save Landmark"}
                    </button>
                </form>

                <div className="lg:col-span-3 space-y-6 flex flex-col">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col h-115">
                        <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-2">
                            <div>
                                <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                                    {lang === "VN" ? "Vị trí trên bản đồ" : "Map location"}
                                </h3>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
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
                                        name: formData.landmarkName || "Landmark",
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

                    <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                        <div className="border-b border-slate-100 dark:border-slate-700 pb-2">
                            <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                                {lang === "VN" ? "Audio thuyết minh đã bake" : "Baked Narration Audio"}
                            </h3>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                                {lang === "VN"
                                    ? "Mỗi giọng (voiceId) có 1 audio. Bake bằng VieNeu-TTS, upload Cloudinary, rồi dán link vào đây."
                                    : "Each voice (voiceId) has one audio. Bake with VieNeu-TTS, upload to Cloudinary, then paste the link here."}
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

                        <form onSubmit={handleSaveAudio} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                            <div className="sm:col-span-2">
                                <label className={labelStyle}>voiceId (*)</label>
                                <input
                                    type="text"
                                    required
                                    value={audioForm.voiceId}
                                    onChange={(e) => handleAudioFieldChange("voiceId", e.target.value)}
                                    placeholder="3fa85f64-5717-4562-b3fc-2c963f66afa6"
                                    className={inputStyle}
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelStyle}>audioUrl (*)</label>
                                <input
                                    type="text"
                                    required
                                    value={audioForm.audioUrl}
                                    onChange={(e) => handleAudioFieldChange("audioUrl", e.target.value)}
                                    placeholder="https://res.cloudinary.com/.../ba_son_nam.mp3"
                                    className={inputStyle}
                                />
                            </div>
                            <div>
                                <label className={labelStyle}>{lang === "VN" ? "Thời lượng (giây)" : "Duration (sec)"}</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min={0}
                                    value={audioForm.durationSeconds}
                                    onChange={(e) => handleAudioFieldChange("durationSeconds", e.target.value)}
                                    className={inputStyle}
                                />
                            </div>
                            <div className="sm:col-span-3 flex items-end">
                                <button
                                    type="submit"
                                    disabled={isSavingAudio}
                                    className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-[11px] tracking-wider py-2.5 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {isSavingAudio && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                                    {lang === "VN" ? "Lưu / Cập nhật audio" : "Save / Update audio"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
