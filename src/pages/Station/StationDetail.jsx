import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fetchStationDetail } from "../../services/stationService";

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
            <div className="flex justify-center items-center h-96 w-full">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 font-body animate-fade-in">
            <button 
                onClick={() => navigate(-1)} 
                className="flex items-center gap-1.5 text-xs font-headline font-black text-slate-400 hover:text-[#124757] uppercase tracking-wider mb-6"
            >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                {lang === "VN" ? "Quay lại" : "Back"}
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                {/* Khối Trái: Ảnh bìa nhà ga bến tàu */}
                <div className="aspect-16/10 rounded-[2.5rem] overflow-hidden shadow-sm bg-slate-100 relative group">
                    <img 
                        src={station?.imageUrl || "https://res.cloudinary.com/dygipvoal/image/upload/v1776077167/vbxeolfuttvnbyql60ct.jpg"} 
                        alt={station?.stationName} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {/* BADGE TRẠM CHÍNH THỨC HOẶC VỆ TINH */}
                    {station?.isWaterbusStation ? (
                        <div className="absolute top-5 left-5 bg-[#124757] text-yellow-400 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl shadow-md border border-[#124757]/50 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">directions_boat</span>
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
                        <span className="bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-3 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-widest inline-block">
                            Mã trạm: {station?.stationCode}
                        </span>
                        <h1 className="text-2xl md:text-4xl font-headline font-black text-[#124757] dark:text-white leading-tight">
                            {station?.stationName}
                        </h1>
                        <p className="text-sm text-slate-500 flex items-start gap-2">
                            <span className="material-symbols-outlined text-base mt-0.5">location_on</span>
                            <span className="flex-1 leading-relaxed">
                                {station?.address || (lang === "VN" ? "Chưa cập nhật địa chỉ bến ga" : "Address unlisted")}
                            </span>
                        </p>
                        
                        {/* GIỜ HOẠT ĐỘNG */}
                        {(station?.openingTime || station?.closingTime) && (
                            <div className="inline-flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                                <span className="material-symbols-outlined text-sm text-emerald-500">schedule</span>
                                {lang === "VN" ? "Giờ mở cửa:" : "Operating Hours:"} 
                                <span className="text-[#124757] dark:text-yellow-400">
                                    {station?.openingTime ? station.openingTime.slice(0, 5) : "--:--"} - {station?.closingTime ? station.closingTime.slice(0, 5) : "--:--"}
                                </span>
                            </div>
                        )}
                    </div>

                    <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed">
                        {station?.description || (lang === "VN" ? "Chưa có cập nhật mô tả chi tiết" : "No detailed description available")}
                    </p>

                    {/* Danh mục tiện ích bến bãi */}
                    <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-headline font-black uppercase text-slate-400 tracking-wider">Tiện ích tích hợp tại bến ga</h4>
                        <div className="flex flex-wrap gap-2">
                            {station?.hasWaitingArea && <span className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold shadow-sm">🛋️ Phòng chờ điều hòa</span>}
                            {station?.hasParking && <span className="px-3 py-1.5 bg-teal-50 text-teal-600 rounded-xl text-xs font-bold shadow-sm">🅿️ Bãi gửi xe gắn máy</span>}
                            {station?.hasTicketCounter && <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold shadow-sm">🎫 Quầy bán vé trực tiếp</span>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}