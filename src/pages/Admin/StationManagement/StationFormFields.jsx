import { WaterwayMap } from "../../../components/WaterwayMap";

const labelStyle = "mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500";
const inputStyle = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 outline-none shadow-inner transition-all focus:ring-2 focus:ring-[#124757] dark:border-slate-700/60 dark:bg-slate-900 dark:text-white dark:focus:ring-yellow-400";

/**
 * Khối field dùng chung cho CreateStation / EditStation.
 * Bố cục: "Thông tin nhà ga" cạnh "Vị trí trên bản đồ" trên cùng 1 hàng.
 * Mô tả / trạng thái / tiện ích chỉ hiện ở Edit (Create chưa có các field này).
 */
export function StationFormFields({
    lang,
    formData,
    onChange,
    isCreate = true,
    imagePreviews = [],
    maxImages = 6,
    onImagesChange,
    onRemoveImage,
}) {
    const setField = (field, value) => onChange(field, value);

    return (
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <div className="flex h-full flex-col space-y-6 rounded-4xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-700/50 dark:bg-slate-800">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-700">
                    <h3 className="font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                        {lang === "VN" ? "Thông tin nhà ga" : "Station details"}
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase ${formData.isWaterbusStation ? "text-yellow-600 dark:text-yellow-400" : "text-slate-400"}`}>
                            {lang === "VN" ? "Trạm Waterbus" : "Waterbus Pier"}
                        </span>
                        <button
                            type="button"
                            onClick={() => setField("isWaterbusStation", !formData.isWaterbusStation)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${formData.isWaterbusStation ? "bg-yellow-400" : "bg-slate-300 dark:bg-slate-600"}`}
                        >
                            <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${formData.isWaterbusStation ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-3">
                    <div>
                        <label className={labelStyle}>
                            {lang === "VN" ? "Mã nhà ga (*)" : "Station Code (*)"}
                        </label>
                        <input
                            type="text"
                            required
                            maxLength={16}
                            readOnly={!isCreate}
                            disabled={!isCreate}
                            value={formData.stationCode}
                            onChange={(e) => setField("stationCode", e.target.value.toUpperCase())}
                            placeholder={lang === "VN" ? "VD: BD, TT" : "e.g. BD, TT"}
                            className={`${inputStyle} uppercase tracking-wider ${!isCreate ? "cursor-not-allowed opacity-70 bg-slate-100 dark:bg-slate-800" : ""}`}
                        />
                    </div>
                    <div className="sm:col-span-2">
                        <label className={labelStyle}>
                            {lang === "VN" ? "Tên nhà ga (*)" : "Station Name (*)"}
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.stationName}
                            onChange={(e) => setField("stationName", e.target.value)}
                            className={inputStyle}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelStyle}>{lang === "VN" ? "Địa chỉ" : "Address"}</label>
                    <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setField("address", e.target.value)}
                        className={inputStyle}
                    />
                </div>

                <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Giờ mở cửa" : "Opening Time"}</label>
                        <input
                            type="time"
                            value={formData.openingTime}
                            onChange={(e) => setField("openingTime", e.target.value)}
                            className={inputStyle}
                        />
                    </div>
                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Giờ đóng cửa" : "Closing Time"}</label>
                        <input
                            type="time"
                            value={formData.closingTime}
                            onChange={(e) => setField("closingTime", e.target.value)}
                            className={inputStyle}
                        />
                    </div>
                </div>

                {!isCreate && (
                    <>
                        <div className="flex flex-col gap-1.5 pt-1">
                            <label className={labelStyle}>{lang === "VN" ? "Trạng thái hoạt động" : "Operational Status"}</label>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setField("status", formData.status === "Active" ? "Inactive" : "Active")}
                                    className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 ${formData.status === "Active" ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                                >
                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-300 ease-in-out ${formData.status === "Active" ? "translate-x-7" : "translate-x-0"}`} />
                                </button>
                                <span className={`text-xs font-black uppercase tracking-wider ${formData.status === "Active" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>
                                    {formData.status === "Active"
                                        ? (lang === "VN" ? "Hoạt động (Active)" : "Active")
                                        : (lang === "VN" ? "Tạm ngưng (Inactive)" : "Inactive")}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Mô tả chi tiết" : "General Description"}</label>
                            <textarea
                                rows={2}
                                value={formData.description}
                                onChange={(e) => setField("description", e.target.value)}
                                className={`${inputStyle} resize-none font-medium`}
                            />
                        </div>

                        <div className="space-y-3 pt-1">
                            <label className={labelStyle}>{lang === "VN" ? "Danh mục dịch vụ bến bãi" : "Station Facilities Checklist"}</label>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 transition-all ${formData.hasWaitingArea ? "border-blue-200 bg-blue-50/40 dark:border-blue-500/30 dark:bg-blue-500/10" : "border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900"}`}>
                                    <input type="checkbox" checked={formData.hasWaitingArea} onChange={(e) => setField("hasWaitingArea", e.target.checked)} className="h-4 w-4 cursor-pointer rounded text-[#124757] focus:ring-0" />
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{lang === "VN" ? "Phòng chờ" : "Lounge"}</span>
                                </label>
                                <label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 transition-all ${formData.hasParking ? "border-teal-200 bg-teal-50/40 text-teal-600 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-400" : "border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900"}`}>
                                    <input type="checkbox" checked={formData.hasParking} onChange={(e) => setField("hasParking", e.target.checked)} className="h-4 w-4 cursor-pointer rounded text-[#124757] focus:ring-0" />
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{lang === "VN" ? "Bãi đỗ xe" : "Parking"}</span>
                                </label>
                                <label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 transition-all ${formData.hasTicketCounter ? "border-indigo-200 bg-indigo-50/40 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400" : "border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900"}`}>
                                    <input type="checkbox" checked={formData.hasTicketCounter} onChange={(e) => setField("hasTicketCounter", e.target.checked)} className="h-4 w-4 cursor-pointer rounded text-[#124757] focus:ring-0" />
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{lang === "VN" ? "Quầy bán vé" : "Counter"}</span>
                                </label>
                            </div>
                        </div>
                    </>
                )}

                <div className="mt-auto space-y-4 border-t border-slate-100 pt-6 dark:border-slate-700">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span>{lang === "VN" ? "Hình ảnh" : "Photos"}</span>
                        <span className={imagePreviews.length === maxImages ? "text-rose-500" : ""}>
                            {imagePreviews.length} / {maxImages}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {imagePreviews.map((previewUrl, index) => (
                            <div
                                key={previewUrl}
                                className="group relative aspect-4/3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                            >
                                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => onRemoveImage(index)}
                                    aria-label={lang === "VN" ? "Xóa ảnh" : "Remove image"}
                                    className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-white/95 text-slate-600 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-900/90 dark:text-slate-300 dark:ring-slate-600"
                                >
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                            </div>
                        ))}
                        {imagePreviews.length < maxImages ? (
                            <label className="flex aspect-4/3 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition-all hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800">
                                <span className="material-symbols-outlined text-lg text-slate-400">
                                    add_photo_alternate
                                </span>
                                <span className="mt-0.5 text-[9px] font-bold uppercase text-slate-400">
                                    {lang === "VN" ? "Thêm ảnh" : "Add"}
                                </span>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={onImagesChange}
                                    className="hidden"
                                />
                            </label>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="flex h-145 min-h-145 flex-col rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 lg:h-auto">
                <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-2">
                    <div>
                        <h3 className="font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                            {lang === "VN" ? "Vị trí trên bản đồ" : "Map location"}
                        </h3>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            {lang === "VN" ? "Click bản đồ để đánh dấu vị trí bến." : "Click the map to mark the pier location."}
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
                                name: formData.stationName || (lang === "VN" ? "Vị trí bến mới" : "New pier"),
                                latitude: Number(formData.latitude) || 10.7749,
                                longitude: Number(formData.longitude) || 106.706,
                            }}
                            onLocationSelect={(lat, lng) => {
                                setField("latitude", lat);
                                setField("longitude", lng);
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}