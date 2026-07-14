import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchStationDetail, modifyStation } from "../../../services/stationService";
import { WaterwayMap } from "../../../components/WaterwayMap";
import { notify } from "../../../utils/swalToast";

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
    const [staff, setStaff] = useState([]);

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
                setStaff(data.staff || []);

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

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
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
        try {
            setIsSubmitting(true);
            setErrorMsg("");

            const legacyUrls = imagePreviews.filter(p => p.startsWith("http"));

            const commonFields = {
                stationName: formData.stationName.trim(),
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
                text: lang === "VN" ? "Hồ sơ hạ tầng nhà ga đã được lưu trữ an toàn." : "Infrastructure details updated successfully.",
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
            
            {/* KHỐI TIÊU ĐỀ HEADER TRANG */}
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
                
                {/* PANEL BÊN TRÁI: FORM ĐIỀN THÔNG TIN */}
                <form onSubmit={handleFormSubmit} className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                            {lang === "VN" ? "Thông tin nhà ga" : "Station Profile"}
                        </h3>
                        
                        {/* TOGGLE PHÂN LOẠI TRẠM WATERBUS VS TRẠM NGOÀI */}
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase ${formData.isWaterbusStation ? "text-yellow-600 dark:text-yellow-400" : "text-slate-400"}`}>
                                {lang === "VN" ? "Trạm Waterbus" : "Waterbus Pier"}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleFieldChange("isWaterbusStation", !formData.isWaterbusStation)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out border-2 border-transparent focus:outline-none ${
                                    formData.isWaterbusStation ? 'bg-yellow-400' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                            >
                                <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${
                                    formData.isWaterbusStation ? 'translate-x-4' : 'translate-x-0'
                                }`} />
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Tên nhà ga bến tàu (*)" : "Station Pier Name (*)"}</label>
                        <input type="text" required value={formData.stationName} onChange={(e) => handleFieldChange("stationName", e.target.value)} className={inputStyle} />
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Địa chỉ bến ga" : "Street Address"}</label>
                        <input type="text" value={formData.address} onChange={(e) => handleFieldChange("address", e.target.value)} className={inputStyle} />
                    </div>

                    {/* GIỜ HOẠT ĐỘNG CỦA BẾN */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Giờ mở cửa" : "Opening Time"}</label>
                            <input type="time" value={formData.openingTime} onChange={(e) => handleFieldChange("openingTime", e.target.value)} className={inputStyle} />
                        </div>
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Giờ đóng cửa" : "Closing Time"}</label>
                            <input type="time" value={formData.closingTime} onChange={(e) => handleFieldChange("closingTime", e.target.value)} className={inputStyle} />
                        </div>
                    </div>

                    {/* TOGGLE STATUS TRẠNG THÁI ACTIVE / INACTIVE */}
                    <div className="flex flex-col gap-1.5 pt-1">
                        <label className={labelStyle}>{lang === "VN" ? "Trạng thái hoạt động" : "Operational Status"}</label>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => handleFieldChange("status", formData.status === "Active" ? "Inactive" : "Active")}
                                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 ${
                                    formData.status === "Active" ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-300 ease-in-out ${
                                    formData.status === "Active" ? 'translate-x-7' : 'translate-x-0'
                                }`} />
                            </button>
                            <span className={`text-xs font-black uppercase tracking-wider ${formData.status === "Active" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>
                                {formData.status === "Active" ? (lang === "VN" ? "Hoạt động (Active)" : "Active") : (lang === "VN" ? "Tạm ngưng (Inactive)" : "Inactive")}
                            </span>
                        </div>
                    </div>

                    {/* THÔNG TIN TỌA ĐỘ TRỰC QUAN KHÔNG GIAN */}
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
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Mô tả chi tiết" : "General Description"}</label>
                        <textarea rows={2} value={formData.description} onChange={(e) => handleFieldChange("description", e.target.value)} className={`${inputStyle} resize-none font-medium`} />
                    </div>

                    {/* CHECKBOX TIỆN ÍCH HẠ TẦNG */}
                    <div className="pt-1 space-y-3">
                        <label className={labelStyle}>{lang === "VN" ? "Danh mục dịch vụ bến bãi" : "Station Facilities Checklist"}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${formData.hasWaitingArea ? "bg-blue-50/40 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30" : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700/60"}`}>
                                <input type="checkbox" checked={formData.hasWaitingArea} onChange={(e) => handleFieldChange("hasWaitingArea", e.target.checked)} className="w-4 h-4 rounded text-[#124757] focus:ring-0 cursor-pointer" />
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{lang === "VN" ? "Phòng chờ" : "Lounge"}</span>
                            </label>
                            <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${formData.hasParking ? "bg-teal-50/40 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 text-teal-600" : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700/60"}`}>
                                <input type="checkbox" checked={formData.hasParking} onChange={(e) => handleFieldChange("hasParking", e.target.checked)} className="w-4 h-4 rounded text-[#124757] focus:ring-0 cursor-pointer" />
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{lang === "VN" ? "Bãi đỗ xe" : "Parking"}</span>
                            </label>
                            <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${formData.hasTicketCounter ? "bg-indigo-50/40 border-indigo-200 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700/60"}`}>
                                <input type="checkbox" checked={formData.hasTicketCounter} onChange={(e) => handleFieldChange("hasTicketCounter", e.target.checked)} className="w-4 h-4 rounded text-[#124757] focus:ring-0 cursor-pointer" />
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{lang === "VN" ? "Quầy bán vé" : "Counter"}</span>
                            </label>
                        </div>
                    </div>

                    {/* THƯ VIỆN HÌNH ẢNH */}
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

                    <button type="submit" disabled={isSubmitting} className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-3.5 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-4">
                        {isSubmitting && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                        {lang === "VN" ? "Lưu thông tin nhà ga" : "Apply Specifications"}
                    </button>
                </form>

                {/* PANEL PHẢI: BẢN ĐỒ VÀ CHI TIẾT NHÂN SỰ CHỈ ĐỂ XEM */}
                <div className="lg:col-span-3 space-y-6 flex flex-col">             
                    {/* BẢN ĐỒ SỐ GIS TOÀN KHUNG */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col h-145">
                        <div>
                            <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">{lang === "VN" ? "Vị trí thực địa (GIS Map)" : "GIS Mapping"}</h3>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 mb-4">
                                {lang === "VN" ? "Click trực tiếp lên bản đồ nền địa cầu để tự động ghim lấy cặp số tọa độ." : "Click on the globe mapping grid to fetch geo values."}
                            </p>
                        </div>
                        {/* Wrapper bọc bản đồ cố định chiều cao bệ đỡ cho Leaflet */}
                        <div className="flex-1 w-full relative min-h-75">
                            <WaterwayMap 
                                stationPoint={{
                                    name: formData.stationName || "Vị trí bến trạm",
                                    latitude: Number(formData.latitude) || 10.7719,
                                    longitude: Number(formData.longitude) || 106.7067
                                }}
                                onLocationSelect={(lat, lng) => {
                                    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
                                }}
                            />
                        </div>
                    </div>
                    
                    {/* DANH SÁCH ĐỘI NGŨ NHÂN SỰ TẠI GA (chỉ xem — gắn bến ở Quản lý người dùng) */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                            {lang === "VN" ? "Nhân sự trực thuộc tại ga" : "Station Personnel"}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">{lang === "VN" ? "Quản lý (Managers)" : "Managers"}</span>
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
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">{lang === "VN" ? "Nhân viên trực bến (Staff)" : "Active Staff"}</span>
                                {staff.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic font-medium">{lang === "VN" ? "Chưa phân phối nhân viên trực." : "No shift staff logs."}</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {staff.map((s, i) => {
                                            const label = typeof s === "string" ? s : (s?.fullName || s?.name || s?.email || "--");
                                            return (
                                                <span key={s?.userId || s?.id || i} className="px-2.5 py-1 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-600">{label}</span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}