import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchStationDetail, modifyStation } from "../../../services/stationService";
import { WaterwayMap } from "../../../components/WaterwayMap";
import Swal from "sweetalert2";

export function EditStation() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const { id } = useParams();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // QUẢN LÝ ẢNH (GIỐNG VESSEL)
    const [selectedImages, setSelectedImages] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);

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
        hasTicketCounter: false
    });

    useEffect(() => {
        const getStationRecord = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");
                const data = await fetchStationDetail(id);
                
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
                    hasTicketCounter: !!data.hasTicketCounter
                });

                // Tải ảnh cũ từ server lên Preview (Tối đa 6 ảnh)
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
                    Swal.fire({
                        icon: "error",
                        title: lang === "VN" ? "Không tìm thấy nhà ga!" : "Station Not Found!",
                        text: lang === "VN" ? "Mã định danh nhà ga không tồn tại. Quay về danh sách." : "The requested station logs do not exist.",
                        confirmButtonColor: "#124757",
                        allowOutsideClick: false
                    }).then(() => navigate("/admin/stations-management"));
                } else {
                    setErrorMsg(lang === "VN" ? "Không thể lấy thông tin nhà ga do lỗi đường truyền mạng." : "Failed to retrieve station details.");
                }
            } finally {
                setIsLoading(false);
            }
        };
        getStationRecord();
    }, [id, lang]);

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // XỬ LÝ ẢNH: Kiểm tra Max 6 ảnh, Max 5MB, Đúng định dạng
    const handleImagesChange = (e) => {
        const files = Array.from(e.target.files);
        
        if (selectedImages.length + imagePreviews.length + files.length > 6) {
            Swal.fire({ icon: 'warning', title: lang === "VN" ? 'Quá giới hạn' : 'Limit Exceeded', text: lang === "VN" ? 'Mỗi trạm chỉ được tối đa 6 hình ảnh.' : 'Maximum 6 images allowed.', confirmButtonColor: '#124757' });
            return;
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 5 * 1024 * 1024;
        const newValidFiles = [];
        const newPreviews = [];

        for (let file of files) {
            if (!validTypes.includes(file.type)) {
                alert(lang === "VN" ? `File ${file.name} sai định dạng JPEG/PNG/WebP.` : `File ${file.name} must be JPEG, PNG, or WebP.`);
                continue;
            }
            if (file.size > maxSize) {
                alert(lang === "VN" ? `File ${file.name} quá nặng (>5MB).` : `File ${file.name} exceeds 5MB.`);
                continue;
            }
            newValidFiles.push(file);
            newPreviews.push(URL.createObjectURL(file));
        }

        setSelectedImages((prev) => [...prev, ...newValidFiles]);
        setImagePreviews((prev) => [...prev, ...newPreviews]);
        e.target.value = null; // Reset input
    };

    const handleRemoveImage = (indexToRemove) => {
        setSelectedImages((prev) => prev.filter((_, i) => i !== indexToRemove));
        setImagePreviews((prev) => prev.filter((_, i) => i !== indexToRemove));
    };

    // LOGIC SUBMIT (FORMDATA vs JSON)
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            setErrorMsg("");

            let payload;
            const legacyUrls = imagePreviews.filter(p => p.startsWith("http")); // Lọc lại các ảnh cũ giữ lại

            if (selectedImages.length > 0) {
                // TRƯỜNG HỢP 1: CÓ ẢNH MỚI -> FORMDATA
                payload = new FormData();
                payload.append("stationName", formData.stationName.trim());
                if (formData.address.trim()) payload.append("address", formData.address.trim());
                if (formData.description.trim()) payload.append("description", formData.description.trim());
                payload.append("latitude", String(formData.latitude));
                payload.append("longitude", String(formData.longitude));
                payload.append("status", formData.status);
                payload.append("hasWaitingArea", String(formData.hasWaitingArea));
                payload.append("hasParking", String(formData.hasParking));
                payload.append("hasTicketCounter", String(formData.hasTicketCounter));

                // Up file thực tế
                selectedImages.forEach(file => payload.append("images", file));
                
                // Giữ lại URL cũ 
                legacyUrls.forEach(url => payload.append("imageUrls", url));
            } else {
                // TRƯỜNG HỢP 2: KHÔNG UP ẢNH -> JSON
                payload = {
                    stationName: formData.stationName.trim(),
                    address: formData.address.trim() || null,
                    description: formData.description.trim() || null,
                    latitude: Number(formData.latitude),
                    longitude: Number(formData.longitude),
                    status: formData.status,
                    imageUrls: legacyUrls,
                    hasWaitingArea: formData.hasWaitingArea,
                    hasParking: formData.hasParking,
                    hasTicketCounter: formData.hasTicketCounter
                };
            }

            await modifyStation(id, payload);

            Swal.fire({
                icon: "success",
                title: lang === "VN" ? "Cập nhật thành công!" : "Successfully Saved!",
                text: lang === "VN" ? "Thông số hạ tầng nhà ga đã được lưu trữ an toàn." : "Infrastructure details updated successfully.",
                confirmButtonColor: "#124757"
            }).then(() => navigate("/admin/stations-management"));

        } catch (error) {
            console.error("Lỗi cập nhật trạm bến:", error);
            let validationError = "";
            if (error.response?.data?.errors) {
                validationError = Object.values(error.response.data.errors).flat().join(" | ");
            }
            setErrorMsg(validationError || error.response?.data?.message || (lang === "VN" ? "Lưu thông tin thất bại." : "Failed to record system updates."));
        } finally {
            setIsSubmitting(false);
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
                    onClick={() => navigate("/admin/stations-management")}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? `Cấu hình nhà ga: ${formData.stationCode}` : `Configure Pier: ${formData.stationCode}`}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Thay đổi hồ sơ kỹ thuật, hình ảnh, cập nhật vị trí tọa độ trực quan và tiện ích hạ tầng." : "Update pier specifications, re-locate GIS global coordinates and facilities."}
                    </p>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
                    {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                
                {/* PANEL TRÁI: FORM ĐIỀN */}
                <form onSubmit={handleFormSubmit} className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                    <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                        {lang === "VN" ? "Hồ sơ thông tin nhà ga" : "Station Profile"}
                    </h3>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Tên nhà ga bến tàu (*)" : "Station Pier Name (*)"}</label>
                        <input type="text" required value={formData.stationName} onChange={(e) => handleFieldChange("stationName", e.target.value)} className={inputStyle} />
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Địa chỉ bến ga" : "Street Address"}</label>
                        <input type="text" value={formData.address} onChange={(e) => handleFieldChange("address", e.target.value)} className={inputStyle} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className={labelStyle}>{lang === "VN" ? "Trạng thái hoạt động" : "Operational Status"}</label>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => handleFieldChange("status", formData.status === "Active" ? "Inactive" : "Active")}
                                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800 border-2 border-transparent ${
                                    formData.status === "Active" ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                                role="switch"
                                aria-checked={formData.status === "Active"}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${
                                        formData.status === "Active" ? 'translate-x-7' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                            
                            {/* Chữ hiển thị động theo trạng thái */}
                            <span className={`text-xs font-black uppercase tracking-wider transition-colors ${
                                formData.status === "Active" 
                                    ? "text-emerald-600 dark:text-emerald-400" 
                                    : "text-slate-500 dark:text-slate-400"
                            }`}>
                                {formData.status === "Active" 
                                    ? (lang === "VN" ? "Hoạt động" : "Active") 
                                    : (lang === "VN" ? "Tạm ngưng" : "Inactive")}
                            </span>
                        </div>
                    </div>

                    {/* VÙNG TỌA ĐỘ VỚI STYLE RIÊNG ĐỂ GÂY CHÚ Ý */}
                    <div className="p-3 bg-blue-50/50 dark:bg-slate-900/50 border border-blue-100 dark:border-slate-700 rounded-xl space-y-3">
                        <label className="text-[10px] font-black uppercase text-blue-800 dark:text-yellow-400 tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">location_on</span>
                            {lang === "VN" ? "Tọa độ không gian (GIS)" : "GIS Coordinates"}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Vĩ độ (Lat) *</label>
                                <input type="number" step="any" required value={formData.latitude} onChange={(e) => handleFieldChange("latitude", e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-[#124757]" />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Kinh độ (Lng) *</label>
                                <input type="number" step="any" required value={formData.longitude} onChange={(e) => handleFieldChange("longitude", e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-[#124757]" />
                            </div>
                        </div>
                        <p className="text-[9px] italic text-slate-400 font-medium">Mẹo: Bạn có thể nhập số thủ công hoặc click trực tiếp lên bản đồ bên cạnh để tự động ghim vị trí.</p>
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Mô tả chi tiết" : "General Description"}</label>
                        <textarea rows={2} value={formData.description} onChange={(e) => handleFieldChange("description", e.target.value)} className={`${inputStyle} resize-none font-medium`} />
                    </div>

                    {/* KHỐI CHECKBOX TIỆN ÍCH */}
                    <div className="pt-2 space-y-3">
                        <label className={labelStyle}>{lang === "VN" ? "Danh mục dịch vụ bến bãi" : "Station Facilities Checklist"}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${formData.hasWaitingArea ? "bg-blue-50/40 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30" : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700/60"}`}>
                                <input type="checkbox" checked={formData.hasWaitingArea} onChange={(e) => handleFieldChange("hasWaitingArea", e.target.checked)} className="w-4 h-4 rounded text-[#124757] focus:ring-0 cursor-pointer" />
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{lang === "VN" ? "Phòng chờ" : "Lounge"}</span>
                            </label>
                            <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${formData.hasParking ? "bg-teal-50/40 border-teal-200 dark:bg-teal-500/10 dark:border-teal-500/30" : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700/60"}`}>
                                <input type="checkbox" checked={formData.hasParking} onChange={(e) => handleFieldChange("hasParking", e.target.checked)} className="w-4 h-4 rounded text-[#124757] focus:ring-0 cursor-pointer" />
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{lang === "VN" ? "Bãi đỗ xe" : "Parking"}</span>
                            </label>
                            <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${formData.hasTicketCounter ? "bg-indigo-50/40 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30" : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700/60"}`}>
                                <input type="checkbox" checked={formData.hasTicketCounter} onChange={(e) => handleFieldChange("hasTicketCounter", e.target.checked)} className="w-4 h-4 rounded text-[#124757] focus:ring-0 cursor-pointer" />
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{lang === "VN" ? "Quầy bán vé" : "Counter"}</span>
                            </label>
                        </div>
                    </div>

                    {/* VÙNG CHỌN ẢNH (MAX 6) */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                            <span>{lang === "VN" ? "Thư viện ảnh nhà ga" : "Image Gallery"}</span>
                            <span className={imagePreviews.length === 6 ? "text-rose-500" : ""}>{imagePreviews.length} / 6</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {imagePreviews.map((previewUrl, index) => (
                                <div key={index} className="aspect-4/3 relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <button type="button" onClick={() => handleRemoveImage(index)} className="bg-rose-500 text-white p-1.5 rounded-full hover:scale-105 transition-all">
                                            <span className="material-symbols-outlined text-xs">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {imagePreviews.length < 6 && (
                                <label className="aspect-4/3 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center cursor-pointer transition-all">
                                    <span className="material-symbols-outlined text-lg text-slate-400">add_photo_alternate</span>
                                    <input type="file" multiple accept="image/jpeg, image/png, image/webp" onChange={handleImagesChange} className="hidden" />
                                </label>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-3.5 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        {isSubmitting && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                        {lang === "VN" ? "Lưu thông tin nhà ga" : "Apply Specifications"}
                    </button>
                </form>

                {/* PANEL PHẢI: BẢN ĐỒ TƯƠNG TÁC */}
                <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                    <div>
                        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                            {lang === "VN" ? "Vị trí thực địa tọa độ không gian (GIS Map)" : "GIS Spatial Mapping"}
                        </h3>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                            {lang === "VN" ? "Click trực tiếp lên bản đồ để thay đổi và ghim chính xác vị trí tọa độ của trạm bến." : "Click anywhere on the map grid to adjust pier coordinates."}
                        </p>
                    </div>

                    {/* Gọi Component bản đồ truyền hàm onLocationSelect để bắt tọa độ */}
                    <WaterwayMap 
                        stationPoint={{
                            name: formData.stationName || "Vị trí bến trạm",
                            latitude: Number(formData.latitude) || 10.7719,
                            longitude: Number(formData.longitude) || 106.7067
                        }}
                        onLocationSelect={(lat, lng) => {
                            // Hàm này được trigger khi click lên map
                            setFormData(prev => ({
                                ...prev,
                                latitude: lat,
                                longitude: lng
                            }));
                        }}
                    />
                </div>

            </div>
        </div>
    );
}