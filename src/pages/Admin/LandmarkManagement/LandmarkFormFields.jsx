import { WaterwayMap } from "../../../components/WaterwayMap";
import { required } from "../../../utils/required";

const labelStyle = "mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500";
const inputStyle = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 outline-none shadow-inner transition-all focus:ring-2 focus:ring-[#124757] dark:border-slate-700/60 dark:bg-slate-900 dark:text-white dark:focus:ring-yellow-400";
const errorInputStyle = "w-full rounded-xl border border-rose-500 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 outline-none shadow-inner transition-all focus:ring-2 focus:ring-rose-500 dark:border-rose-500 dark:bg-slate-900 dark:text-white";
const errorTextStyle = "mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400";

/**
 * Khối field dùng chung cho CreateLandmark / EditLandmark.
 * Bố cục: "Thông tin landmark" cạnh "Vị trí trên bản đồ" trên cùng 1 hàng.
 *
 * `errors`: { [field]: message } — chỉ hiện khi field tương ứng đã "touched" (do trang cha
 * quyết định khi nào đưa message vào, thường là sau onBlur hoặc sau lần submit đầu tiên).
 * `onFieldBlur`: (field) => void — báo trang cha field vừa rời khỏi.
 */
export function LandmarkFormFields({ lang, formData, onChange, errors = {}, onFieldBlur }) {
    const setField = (field, value) => onChange(field, value);
    const handleBlur = (field) => onFieldBlur?.(field);

    return (
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
                            onClick={() => setField("isActive", !formData.isActive)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${formData.isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                        >
                            <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${formData.isActive ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </div>
                </div>

                <div>
                    <label className={labelStyle}>{<>{lang === "VN" ? "Tên landmark" : "Landmark Name"}{required()}</>}</label>
                    <input
                        type="text"
                        required
                        value={formData.landmarkName}
                        onChange={(e) => setField("landmarkName", e.target.value)}
                        onBlur={() => handleBlur("landmarkName")}
                        placeholder={lang === "VN" ? "VD: Cầu Ba Son" : "e.g. Ba Son Bridge"}
                        className={errors.landmarkName ? errorInputStyle : inputStyle}
                    />
                    {errors.landmarkName && <p className={errorTextStyle}>{errors.landmarkName}</p>}
                </div>

                <div>
                    <label className={labelStyle}>{<>{lang === "VN" ? "Mô tả (nội dung sẽ được bake thành audio)" : "Description (text used to bake audio)"}{required()}</>}</label>
                    <textarea
                        rows={4}
                        required
                        value={formData.description}
                        onChange={(e) => setField("description", e.target.value)}
                        onBlur={() => handleBlur("description")}
                        className={`${errors.description ? errorInputStyle : inputStyle} resize-none font-medium`}
                    />
                    {errors.description && <p className={errorTextStyle}>{errors.description}</p>}
                </div>

                <div>
                    <label className={labelStyle}>{<>{lang === "VN" ? "Bán kính kích hoạt (m)" : "Trigger Radius (m)"}{required()}</>}</label>
                    <input
                        type="number"
                        required
                        min={1}
                        value={formData.triggerRadiusMeters}
                        onChange={(e) => setField("triggerRadiusMeters", e.target.value)}
                        onBlur={() => handleBlur("triggerRadiusMeters")}
                        className={errors.triggerRadiusMeters ? errorInputStyle : inputStyle}
                    />
                    {errors.triggerRadiusMeters && <p className={errorTextStyle}>{errors.triggerRadiusMeters}</p>}
                </div>
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