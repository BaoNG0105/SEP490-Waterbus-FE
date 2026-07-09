import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useApp } from "../../../context/AppContext";
import { addPromotion, PROMOTION_TYPE, PROMOTION_USAGE_POLICY } from "../../../services/promotionService";

const toIsoWithOffset = (datetimeLocalValue) => {
    if (!datetimeLocalValue) return null;
    return `${datetimeLocalValue}:00+07:00`;
};

export function CreatePromotion() {
    const { lang } = useApp();
    const navigate = useNavigate();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const [formData, setFormData] = useState({
        promotionCode: "",
        promotionName: "",
        promotionType: PROMOTION_TYPE.PERCENT,
        discountValue: "",
        hasMinOrderValue: false,
        minOrderValue: "",
        validFrom: "",
        validTo: "",
        hasUsageLimit: false,
        usageLimit: "",
        accountUsagePolicy: PROMOTION_USAGE_POLICY.MULTIPLE,
    });

    const handleFieldChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            setErrorMsg("");

            if (formData.validFrom && formData.validTo && formData.validTo < formData.validFrom) {
                setErrorMsg(lang === "VN" ? "Ngày kết thúc phải sau ngày bắt đầu." : "End date must be after the start date.");
                setIsSubmitting(false);
                return;
            }

            const payload = {
                promotionCode: formData.promotionCode.trim().toUpperCase(),
                promotionName: formData.promotionName.trim(),
                promotionType: formData.promotionType,
                discountValue: Number(formData.discountValue) || 0,
                minOrderValue: formData.hasMinOrderValue ? (Number(formData.minOrderValue) || 0) : null,
                validFrom: toIsoWithOffset(formData.validFrom),
                validTo: toIsoWithOffset(formData.validTo),
                usageLimit: formData.hasUsageLimit ? (Number(formData.usageLimit) || 0) : null,
                accountUsagePolicy: formData.accountUsagePolicy,
            };

            await addPromotion(payload);

            Swal.fire({
                icon: "success",
                title: lang === "VN" ? "Tạo khuyến mãi thành công!" : "Promotion Created Successfully!",
                text: lang === "VN" ? "Mã khuyến mãi mới đã được thêm vào hệ thống." : "New promotion code has been added to the system.",
                confirmButtonColor: "#124757",
            }).then(() => navigate("/admin/promotions"));
        } catch (error) {
            console.error("Lỗi tạo khuyến mãi:", error);
            let validationError = "";
            if (error.response?.data?.errors) {
                validationError = Object.values(error.response.data.errors).flat().join(" | ");
            }
            setErrorMsg(validationError || error.response?.data?.message || (lang === "VN" ? "Tạo khuyến mãi thất bại." : "Failed to create promotion."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
    const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all disabled:opacity-50";

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-3xl mx-auto animate-fade-in">

            {/* KHỐI TIÊU ĐỀ HEADER */}
            <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
                <button
                    type="button"
                    onClick={() => navigate("/admin/promotions")}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Thêm khuyến mãi mới" : "Add New Promotion"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Khai báo mã khuyến mãi, mức giảm giá và thời gian áp dụng." : "Register the promotion code, discount value and active period."}
                    </p>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
                    {errorMsg}
                </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6">
                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                    <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
                        {lang === "VN" ? "Thông tin cơ bản" : "Basic Information"}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Mã khuyến mãi (*)" : "Promotion Code (*)"}</label>
                            <input
                                type="text"
                                required
                                placeholder="WELCOME10"
                                value={formData.promotionCode}
                                onChange={(e) => handleFieldChange("promotionCode", e.target.value.toUpperCase())}
                                className={`${inputStyle} uppercase tracking-wider`}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">{lang === "VN" ? "Mã sẽ tự động chuyển thành chữ hoa và phải là duy nhất." : "Code auto-uppercases and must be unique."}</p>
                        </div>
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Tên khuyến mãi (*)" : "Promotion Name (*)"}</label>
                            <input
                                type="text"
                                required
                                placeholder={lang === "VN" ? "VD: Chào mừng khách mới" : "e.g. Welcome new customers"}
                                value={formData.promotionName}
                                onChange={(e) => handleFieldChange("promotionName", e.target.value)}
                                className={inputStyle}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Hình thức giảm giá" : "Discount Type"}</label>
                        <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                            {[
                                { value: PROMOTION_TYPE.PERCENT, vn: "Giảm theo %", en: "Percent" },
                                { value: PROMOTION_TYPE.FIXED, vn: "Giảm số tiền", en: "Fixed amount" },
                            ].map((option) => {
                                const selected = formData.promotionType === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleFieldChange("promotionType", option.value)}
                                        className={`h-10 rounded-lg px-2 text-[11px] font-headline font-black uppercase tracking-wider transition-all ${selected
                                                ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                                                : "text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                                            }`}
                                    >
                                        {lang === "VN" ? option.vn : option.en}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className={labelStyle}>
                                {formData.promotionType === PROMOTION_TYPE.PERCENT
                                    ? (lang === "VN" ? "Phần trăm giảm (%) (*)" : "Discount Percent (%) (*)")
                                    : (lang === "VN" ? "Số tiền giảm (VND) (*)" : "Discount Amount (VND) (*)")}
                            </label>
                            <input
                                type="number"
                                required
                                min={0}
                                max={formData.promotionType === PROMOTION_TYPE.PERCENT ? 100 : undefined}
                                value={formData.discountValue}
                                onChange={(e) => handleFieldChange("discountValue", e.target.value)}
                                className={inputStyle}
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                                    {lang === "VN" ? "Giá trị đơn tối thiểu (VND)" : "Minimum Order Value (VND)"}
                                </label>
                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!formData.hasMinOrderValue}
                                        onChange={(e) => handleFieldChange("hasMinOrderValue", !e.target.checked)}
                                        className="w-3.5 h-3.5 rounded text-[#124757] focus:ring-0 cursor-pointer"
                                    />
                                    {lang === "VN" ? "Không yêu cầu" : "No minimum"}
                                </label>
                            </div>
                            <input
                                type="number"
                                min={0}
                                disabled={!formData.hasMinOrderValue}
                                value={formData.minOrderValue}
                                onChange={(e) => handleFieldChange("minOrderValue", e.target.value)}
                                className={inputStyle}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                    <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
                        {lang === "VN" ? "Thời gian & Giới hạn sử dụng" : "Validity & Usage Limits"}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Hiệu lực từ (*)" : "Valid From (*)"}</label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.validFrom}
                                onChange={(e) => handleFieldChange("validFrom", e.target.value)}
                                className={inputStyle}
                            />
                        </div>
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Hiệu lực đến (*)" : "Valid To (*)"}</label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.validTo}
                                onChange={(e) => handleFieldChange("validTo", e.target.value)}
                                className={inputStyle}
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                                {lang === "VN" ? "Giới hạn lượt sử dụng" : "Usage Limit"}
                            </label>
                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!formData.hasUsageLimit}
                                    onChange={(e) => handleFieldChange("hasUsageLimit", !e.target.checked)}
                                    className="w-3.5 h-3.5 rounded text-[#124757] focus:ring-0 cursor-pointer"
                                />
                                {lang === "VN" ? "Không giới hạn" : "Unlimited"}
                            </label>
                        </div>
                        <input
                            type="number"
                            min={0}
                            disabled={!formData.hasUsageLimit}
                            value={formData.usageLimit}
                            onChange={(e) => handleFieldChange("usageLimit", e.target.value)}
                            className={inputStyle}
                        />
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Chính sách sử dụng theo tài khoản" : "Account Usage Policy"}</label>
                        <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                            {[
                                { value: PROMOTION_USAGE_POLICY.MULTIPLE, vn: "Nhiều lần / tài khoản", en: "Multiple per account" },
                                { value: PROMOTION_USAGE_POLICY.ONCE, vn: "1 lần / tài khoản", en: "Once per account" },
                            ].map((option) => {
                                const selected = formData.accountUsagePolicy === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleFieldChange("accountUsagePolicy", option.value)}
                                        className={`h-10 rounded-lg px-2 text-[11px] font-headline font-black uppercase tracking-wider transition-all ${selected
                                                ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                                                : "text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                                            }`}
                                    >
                                        {lang === "VN" ? option.vn : option.en}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                    {lang === "VN" ? "Tạo khuyến mãi" : "Create Promotion"}
                </button>
            </form>
        </div>
    );
}
