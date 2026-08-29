import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchStationDetail, modifyStation, changeStationStatus } from "../../../services/stationService";
import { notify } from "../../../utils/swalToast";
import { StationFormFields } from "./StationFormFields";
import { isValidStationName, normalizeStationName } from "../../../utils/stationValidation";

export function EditStation() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const { id } = useParams();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // QUẢN LÝ THƯ VIỆN HÌNH ẢNH (MAX 6 HÌNH)
    const [selectedImages, setSelectedImages] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);

    // DANH SÁCH NHÂN SỰ ĐANG ĐƯỢC GẮN VỚI NHÀ GA (READ-ONLY)
    const [managers, setManagers] = useState([]);

    const [formData, setFormData] = useState({
        stationCode: "",
        stationName: "",
        address: "",
        description: "",
        latitude: 10.7719,
        longitude: 106.7067,
        status: "Active",
        hasWaitingArea: false,
        hasParking: false,
        hasTicketCounter: false,
        openingTime: "",
        closingTime: "",
        isWaterbusStation: true
    });

    useEffect(() => {
        const getStationRecord = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");
                const data = await fetchStationDetail(id);

                // Trích xuất định dạng thời gian HH:mm thích hợp cho thẻ input HTML5
                const formatTime = (timeStr) => timeStr ? timeStr.slice(0, 5) : "";

                setFormData({
                    stationCode: data.stationCode || "",
                    stationName: data.stationName || "",
                    address: data.address || "",
                    description: data.description || "",
                    latitude: Number(data.latitude) || 10.7719,
                    longitude: Number(data.longitude) || 106.7067,
                    status: data.status || "Active",
                    hasWaitingArea: !!data.hasWaitingArea,
                    hasParking: !!data.hasParking,
                    hasTicketCounter: !!data.hasTicketCounter,
                    openingTime: formatTime(data.openingTime),
                    closingTime: formatTime(data.closingTime),
                    isWaterbusStation: data.isWaterbusStation !== false
                });

                // Đồng bộ mảng danh sách nhân sự
                setManagers(data.managers || []);

                let existingImages = [];
                if (data.imageUrls && data.imageUrls.length > 0) {
                    existingImages = data.imageUrls;
                } else if (data.imageUrl) {
                    existingImages = [data.imageUrl];
                }
                setImagePreviews(existingImages.slice(0, 6));

            } catch (error) {
                console.error("Lỗi khi tải chi tiết trạm bến:", error);
                if (error.response?.status === 404) {
                    notify({
                        icon: "error",
                        title: lang === "VN" ? "Không tìm thấy nhà ga!" : "Station Not Found!",
                        text: lang === "VN" ? "Mã định danh nhà ga không tồn tại. Quay về danh sách." : "The requested station logs do not exist.",
                        confirmButtonColor: "#124757",
                        allowOutsideClick: false
                    }).then(() => navigate("/admin/stations-management"));
                } else {
                    setErrorMsg(lang === "VN" ? "Không thể lấy thông tin nhà ga do lỗi kết nối mạng." : "Failed to retrieve station details.");
                }
            } finally {
                setIsLoading(false);
            }
        };
        getStationRecord();
    }, [id, lang, navigate]);

    // Mã nhà ga bị khóa khi sửa; tên vẫn phải theo rule BE mới.
    const [touchedFields, setTouchedFields] = useState({});
    const fieldErrors = {
        ...(!formData.stationName.trim()
            ? { stationName: lang === "VN" ? "Vui lòng nhập tên nhà ga" : "Station name is required" }
            : !isValidStationName(formData.stationName)
                ? { stationName: lang === "VN" ? "Tên chỉ gồm chữ, số và khoảng trắng" : "Name may contain letters, numbers and spaces only" }
                : {}),
    };
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    const visibleFieldErrors = {
        ...(touchedFields.stationName ? { stationName: fieldErrors.stationName } : {}),
    };

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleFieldBlur = (field) => {
        setTouchedFields((prev) => ({ ...prev, [field]: true }));
    };

    // Bật/tắt trạng thái hoạt động — PATCH riêng ngay khi bấm nút (không cần chờ bấm "Lưu thông
    // tin nhà ga"), đồng thời đồng bộ vào formData để lần Lưu sau không gửi ngược trạng thái cũ.
    const [isTogglingStatus, setIsTogglingStatus] = useState(false);
    const handleToggleStatus = async () => {
        const previousStatus = formData.status || "Inactive";
        const nextStatus = previousStatus === "Active" ? "Inactive" : "Active";

        setIsTogglingStatus(true);
        setFormData((prev) => ({ ...prev, status: nextStatus }));
        try {
            await changeStationStatus(id, nextStatus);
            notify({
                toast: true,
                position: "top-end",
                icon: "success",
                title: nextStatus === "Active"
                    ? (lang === "VN" ? "Đã bật nhà ga" : "Station activated")
                    : (lang === "VN" ? "Đã tắt nhà ga" : "Station deactivated"),
                showConfirmButton: false,
                timer: 1800,
            });
        } catch (error) {
            console.error(`Lỗi khi đổi trạng thái nhà ga ${id}:`, error);
            setFormData((prev) => ({ ...prev, status: previousStatus }));
            notify({
                icon: "error",
                title: lang === "VN" ? "Cập nhật thất bại" : "Update failed",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể đổi trạng thái nhà ga." : "Could not update station status."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setIsTogglingStatus(false);
        }
    };

    // LOGIC KIỂM SOÁT THƯ VIỆN HÌNH ẢNH UPLOAD
    const handleImagesChange = (e) => {
        const files = Array.from(e.target.files);
        if (selectedImages.length + imagePreviews.length + files.length > 6) {
            notify({
                icon: 'warning',
                title: lang === "VN" ? 'Quá giới hạn' : 'Limit Exceeded',
                text: lang === "VN" ? 'Mỗi bến trạm chỉ được lưu trữ tối đa 6 hình ảnh.' : 'Maximum 6 images allowed per station.',
                confirmButtonColor: '#124757'
            });
            return;
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5 MB
        const newValidFiles = [];
        const newPreviews = [];

        for (let file of files) {
            if (!validTypes.includes(file.type)) {
                alert(lang === "VN" ? `File ${file.name} sai định dạng JPEG/PNG/WebP.` : `File ${file.name} must be JPEG, PNG, or WebP.`);
                continue;
            }
            if (file.size > maxSize) {
                alert(lang === "VN" ? `File ${file.name} vượt quá dung lượng tối đa 5MB.` : `File ${file.name} exceeds 5MB size limit.`);
                continue;
            }
            newValidFiles.push(file);
            newPreviews.push(URL.createObjectURL(file));
        }

        setSelectedImages(prev => [...prev, ...newValidFiles]);
        setImagePreviews(prev => [...prev, ...newPreviews]);
        e.target.value = null; // Clear input file
    };

    const handleRemoveImage = (indexToRemove) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== indexToRemove));
        setImagePreviews(prev => prev.filter((_, i) => i !== indexToRemove));
    };

    // LOGIC ĐÓNG GÓI PAYLOAD GỬI LÊN BACKEND
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        // Bấm submit khi còn field rỗng (VD: nhấn Enter) → hiện hết lỗi lên thay vì âm thầm chặn.
        setTouchedFields({ stationName: true });
        if (hasFieldErrors) return;
        try {
            setIsSubmitting(true);
            setErrorMsg("");

            const legacyUrls = imagePreviews.filter(p => p.startsWith("http"));

            const commonFields = {
                stationName: normalizeStationName(formData.stationName),
                address: formData.address.trim() || null,
                description: formData.description.trim() || null,
                latitude: Number(formData.latitude),
                longitude: Number(formData.longitude),
                status: formData.status,
                hasWaitingArea: formData.hasWaitingArea,
                hasParking: formData.hasParking,
                hasTicketCounter: formData.hasTicketCounter,
                openingTime: formData.openingTime ? `${formData.openingTime}:00` : null, // Thêm giây (:00) chuẩn DTO
                closingTime: formData.closingTime ? `${formData.closingTime}:00` : null,
                isWaterbusStation: formData.isWaterbusStation
            };

            let payload;
            if (selectedImages.length > 0) {
                // TRƯỜNG HỢP 1: CÓ FILE ẢNH MỚI -> multipart/form-data
                payload = new FormData();
                Object.entries(commonFields).forEach(([key, value]) => {
                    if (value !== null) payload.append(key, String(value));
                });
                selectedImages.forEach(file => payload.append("images", file));
                legacyUrls.forEach(url => payload.append("imageUrls", url));
            } else {
                // TRƯỜNG HỢP 2: KHÔNG THAY ĐỔI ẢNH -> application/json
                payload = { ...commonFields, imageUrls: legacyUrls };
            }

            await modifyStation(id, payload);

            notify({
                icon: "success",
                title: lang === "VN" ? "Cập nhật thành công!" : "Successfully Saved!",
                text: lang === "VN" ? "Hồ sơ hạ tầng nhà ga đã được lưu trữ." : "Infrastructure details updated successfully.",
                confirmButtonColor: "#124757"
            }).then(() => navigate("/admin/stations-management"));

        } catch (error) {
            console.error("Lỗi cập nhật trạm bến:", error);
            let validationError = "";
            if (error.response?.data?.errors) {
                validationError = Object.values(error.response.data.errors).flat().join(" | ");
            }
            setErrorMsg(validationError || error.response?.data?.message || (lang === "VN" ? "Gặp lỗi trong quá trình lưu trữ thông tin." : "Failed to record system updates."));
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

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">

            {/* KHỐI TIÊU ĐỀ HEADER TRANG */}
            <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
                <button
                    type="button"
                    onClick={() => navigate("/admin/stations-management")}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div className="min-w-0 flex-1">
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? `Cấu hình nhà ga: ${formData.stationName}` : `Configure Pier: ${formData.stationCode}`}
                    </h2>
                </div>

                {/* CÔNG TẮC BẬT/TẮT TRẠNG THÁI HOẠT ĐỘNG — cập nhật ngay qua PATCH riêng, không cần bấm Lưu */}
                <div className="flex shrink-0 items-center gap-3">
                    <span className={`text-xs font-black uppercase tracking-wider ${formData.status === "Active" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                        {formData.status === "Active"
                            ? (lang === "VN" ? "Hoạt động" : "Active")
                            : (lang === "VN" ? "Tạm ngưng" : "Inactive")}
                    </span>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={formData.status === "Active"}
                        disabled={isTogglingStatus}
                        onClick={handleToggleStatus}
                        title={formData.status === "Active"
                            ? (lang === "VN" ? "Bấm để tắt hoạt động" : "Click to deactivate")
                            : (lang === "VN" ? "Bấm để bật hoạt động" : "Click to activate")}
                        className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#124757] disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-yellow-400 ${formData.status === "Active" ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                    >
                        {isTogglingStatus ? (
                            <span className="absolute inset-0 flex items-center justify-center">
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                            </span>
                        ) : (
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-300 ease-in-out ${formData.status === "Active" ? "translate-x-7" : "translate-x-0"}`} />
                        )}
                    </button>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
                    {errorMsg}
                </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6">
                <StationFormFields
                    lang={lang}
                    formData={formData}
                    onChange={handleFieldChange}
                    isCreate={false}
                    imagePreviews={imagePreviews}
                    maxImages={6}
                    onImagesChange={handleImagesChange}
                    onRemoveImage={handleRemoveImage}
                    errors={visibleFieldErrors}
                    onFieldBlur={handleFieldBlur}
                />
                <button type="submit" disabled={isSubmitting || hasFieldErrors} className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-3.5 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                    {isSubmitting && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                    {lang === "VN" ? "Lưu thông tin nhà ga" : "Apply Specifications"}
                </button>
            </form>

            {/* NHÂN SỰ TRỰC THUỘC TẠI GA (chỉ xem — gắn bến ở Quản lý người dùng) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                    {lang === "VN" ? "Nhân sự trực thuộc tại ga" : "Station Personnel"}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">{lang === "VN" ? "Quản lý" : "Managers"}</span>
                        {managers.length === 0 ? (
                            <p className="text-xs text-slate-400 italic font-medium">{lang === "VN" ? "Chưa chỉ định quản lý bến." : "No manager assigned."}</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {managers.map((m, i) => {
                                    const label = typeof m === "string" ? m : (m?.fullName || m?.name || m?.email || "--");
                                    return (
                                        <span key={m?.userId || m?.id || i} className="px-2.5 py-1 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 text-[10px] font-bold rounded-lg border border-amber-100 dark:border-amber-500/20">{label}</span>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
