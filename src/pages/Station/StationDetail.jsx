import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fetchStationDetail } from "../../services/stationService";
import { ImageWithFallback } from "../../components/ImageWithFallback";
import { StationLocationMap } from "../../components/StationLocationMap";

export function StationDetail() {
    const { lang } = useApp();
    const { id } = useParams();
    const navigate = useNavigate();

    const [station, setStation] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const getDetails = async () => {
            try {
                setIsLoading(true);
                const data = await fetchStationDetail(id);
                setStation(data);
            } catch (err) {
                console.error("Lỗi tải chi tiết bến:", err);
                navigate("/"); // Đẩy về trang chủ nếu bến không tồn tại
            } finally {
                setIsLoading(false);
            }
        };
        getDetails();
    }, [id, navigate]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96 w-full pt-28 md:pt-32">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 md:px-12 pt-28 md:pt-32 pb-12 font-body animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-xs font-headline font-black text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors uppercase tracking-wider"
                >
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    {lang === "VN" ? "Quay lại" : "Back"}
                </button>
            </div>

            {/* Tiêu đề tên bến — tách riêng phía trên, đồng bộ kiểu với trang Schedule / Promotion / Blog */}
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
                <h1 className="text-3xl md:text-5xl font-headline font-bold text-[#124757] dark:text-white leading-tight">
                    {station?.stationName}
                </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                {/* Khối Trái: Ảnh bìa nhà ga bến tàu */}
                <div className="aspect-16/10 overflow-hidden shadow-sm bg-slate-100 relative group">
                    <ImageWithFallback
                        src={station?.imageUrl}
                        alt={station?.stationName}
                        className="w-full h-full"
                        imgClassName="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {/* BADGE TRẠM CHÍNH THỨC HOẶC VỆ TINH */}
                    {station?.isWaterbusStation ? (
                        <div className="absolute top-5 left-5 bg-[#124757] text-yellow-400 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl shadow-md border border-[#124757]/50 flex items-center gap-1.5">
                            {lang === "VN" ? "Trạm Saigon Waterbus" : "Official Waterbus Pier"}
                        </div>
                    ) : (
                        <div className="absolute top-5 left-5 bg-slate-800/90 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-xl shadow-md backdrop-blur border border-slate-700 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">hub</span>
                            {lang === "VN" ? "Trạm liên kết vệ tinh" : "Partner Pier"}
                        </div>
                    )}
                </div>

                {/* Khối Phải: Chi tiết hồ sơ hạ tầng bến */}
                <div className="space-y-6">
                    <div className="space-y-3">
                        <p className="text-sm text-slate-500 flex items-start gap-2">
                            <span className="material-symbols-outlined text-base mt-0.5">location_on</span>
                            <span className="flex-1 leading-relaxed">
                                {station?.address || (lang === "VN" ? "Chưa cập nhật địa chỉ bến ga" : "Address unlisted")}
                            </span>
                        </p>

                        {/* GIỜ HOẠT ĐỘNG */}
                        {(station?.openingTime || station?.closingTime) && (
                            <p className="text-sm text-slate-500 flex items-start gap-2">
                                <span className="material-symbols-outlined text-base mt-0.5 text-emerald-500">schedule</span>
                                <span className="flex-1 leading-relaxed">
                                    {lang === "VN" ? "Giờ mở cửa: " : "Operating Hours: "}
                                    <span className="font-bold text-[#124757] dark:text-yellow-400">
                                        {station?.openingTime ? station.openingTime.slice(0, 5) : "--:--"} - {station?.closingTime ? station.closingTime.slice(0, 5) : "--:--"}
                                    </span>
                                </span>
                            </p>
                        )}

                        {/* Bản đồ vị trí bến */}
                        {station?.latitude != null && station?.longitude != null && (
                            <div className="space-y-2 pt-1">
                                <div className="h-80 rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
                                    <StationLocationMap
                                        latitude={station.latitude}
                                        longitude={station.longitude}
                                        label={station.stationName}
                                        className="w-full h-full"
                                    />
                                </div>
                                <a
                                    href={`https://www.google.com/maps?q=${station.latitude},${station.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-xs font-bold text-[#124757] dark:text-yellow-400 hover:underline w-max"
                                >
                                    <span className="material-symbols-outlined text-base">open_in_new</span>
                                    {lang === "VN" ? "Mở bằng Google Maps" : "Open in Google Maps"}
                                </a>
                            </div>
                        )}
                    </div>

                    <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed">
                        {station?.description || (lang === "VN" ? "Chưa có cập nhật mô tả chi tiết" : "No detailed description available")}
                    </p>

                    {/* Tiện ích bến */}
                    <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-headline font-black uppercase text-slate-400 tracking-wider">
                            {lang === "VN" ? "Tiện ích tích hợp tại bến ga" : "Amenities at this pier"}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {station?.hasParking && (
                                <span className="px-3 py-1.5 bg-teal-50 text-teal-600 rounded-xl text-xs font-bold shadow-sm">
                                    {lang === "VN" ? "Bãi gửi xe gắn máy" : "Motorbike parking"}
                                </span>
                            )}
                            {station?.hasTicketCounter && (
                                <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold shadow-sm">
                                    {lang === "VN" ? "Quầy bán vé trực tiếp" : "On-site ticket counter"}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}