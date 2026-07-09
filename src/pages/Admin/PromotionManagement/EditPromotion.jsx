import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import { useApp } from "../../../context/AppContext";
import {
    fetchPromotions,
    modifyPromotion,
    PROMOTION_TYPE,
    PROMOTION_USAGE_POLICY,
    PROMOTION_STATUS,
} from "../../../services/promotionService";

const toIsoWithOffset = (datetimeLocalValue) => {
    if (!datetimeLocalValue) return null;
    return `${datetimeLocalValue}:00+07:00`;
};

const toDatetimeLocal = (isoValue) => {
    if (!isoValue) return "";
    return isoValue.slice(0, 16);
};

export function EditPromotion() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const [promotionCode, setPromotionCode] = useState("");
    const [promotionType, setPromotionType] = useState(PROMOTION_TYPE.PERCENT);

    const [formData, setFormData] = useState({
        promotionName: "",
        discountValue: "",
        hasMinOrderValue: false,
        minOrderValue: "",
        validFrom: "",
        validTo: "",
        hasUsageLimit: false,
        usageLimit: "",
        accountUsagePolicy: PROMOTION_USAGE_POLICY.MULTIPLE,
        status: PROMOTION_STATUS.ACTIVE,
    });

    const applyPromotionData = (promo) => {
        setPromotionCode(promo.promotionCode || "");
        setPromotionType(promo.promotionType || PROMOTION_TYPE.PERCENT);
        setFormData({
            promotionName: promo.promotionName || "",
            discountValue: promo.discountValue ?? "",
            hasMinOrderValue: promo.minOrderValue != null,
            minOrderValue: promo.minOrderValue ?? "",
            validFrom: toDatetimeLocal(promo.validFrom),
            validTo: toDatetimeLocal(promo.validTo),
            hasUsageLimit: promo.usageLimit != null,
            usageLimit: promo.usageLimit ?? "",
            accountUsagePolicy: promo.accountUsagePolicy || PROMOTION_USAGE_POLICY.MULTIPLE,
            status: promo.status || PROMOTION_STATUS.ACTIVE,
        });
    };

    useEffect(() => {
        const getPromotionRecord = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");

                const preloaded = location.state?.promotion;
                if (preloaded && String(preloaded.id) === String(id)) {
                    applyPromotionData(preloaded);
                    return;
                }

                const list = await fetchPromotions();
                const found = list.find((p) => String(p.id) === String(id));
                if (!found) {
                    Swal.fire({
                        icon: "error",
                        title: lang === "VN" ? "Không tìm thấy khuyến mãi!" : "Promotion Not Found!",
                        text: lang === "VN" ? "Mã định danh khuyến mãi không tồn tại. Quay về danh sách." : "The requested promotion does not exist.",
                        confirmButtonColor: "#124757",
                        allowOutsideClick: false,
                    }).then(() => navigate("/admin/promotions"));
                    return;
                }
                applyPromotionData(found);
            } catch (error) {
                console.error("Lỗi khi tải chi tiết khuyến mãi:", error);
                setErrorMsg(lang === "VN" ? "Không thể lấy thông tin khuyến mãi do lỗi kết nối mạng." : "Failed to retrieve promotion details.");
            } finally {
                setIsLoading(false);
            }
        };
        getPromotionRecord();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

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
                promotionName: formData.promotionName.trim(),
                discountValue: Number(formData.discountValue) || 0,
                minOrderValue: formData.hasMinOrderValue ? (Number(formData.minOrderValue) || 0) : null,
                validFrom: toIsoWithOffset(formData.validFrom),
                validTo: toIsoWithOffset(formData.validTo),
                usageLimit: formData.hasUsageLimit ? (Number(formData.usageLimit) || 0) : null,
                accountUsagePolicy: formData.accountUsagePolicy,
                status: formData.status,
            };

            await modifyPromotion(id, payload);

            Swal.fire({
                icon: "success",
                title: lang === "VN" ? "Cập nhật thành công!" : "Successfully Saved!",
                text: lang === "VN" ? "Thông tin khuyến mãi đã được lưu." : "Promotion details updated successfully.",
                confirmButtonColor: "#124757",
            }).then(() => navigate("/admin/promotions"));
        } catch (error) {
            console.error("Lỗi cập nhật khuyến mãi:", error);
            let validationError = "";
            if (error.response?.data?.errors) {
                validationError = Object.values(error.response.data.errors).flat().join(" | ");
            }
            setErrorMsg(validationError || error.response?.data?.message || (lang === "VN" ? "Gặp lỗi trong quá trình lưu thông tin." : "Failed to save changes."));
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
    const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all disabled:opacity-50";

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64 w-full">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
        );
    }

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
                        {lang === "VN" ? `Chỉnh sửa khuyến mãi: ${promotionCode}` : `Edit Promotion: ${promotionCode}`}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Mã khuyến mãi và hình thức giảm giá không thể thay đổi sau khi tạo." : "Promotion code and discount type cannot be changed after creation."}
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
                            <label className={labelStyle}>{lang === "VN" ? "Mã khuyến mãi" : "Promotion Code"}</label>
                            <input type="text" disabled value={promotionCode} className={`${inputStyle} uppercase tracking-wider cursor-not-allowed`} />
                        </div>
                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Hình thức giảm giá" : "Discount Type"}</label>
                            <input
                                type="text"
                                disabled
                                value={promotionType === PROMOTION_TYPE.PERCENT
                                    ? (lang === "VN" ? "Giảm theo %" : "Percent")
                                    : (lang === "VN" ? "Giảm số tiền" : "Fixed amount")}
                                className={`${inputStyle} cursor-not-allowed`}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Tên khuyến mãi (*)" : "Promotion Name (*)"}</label>
                        <input
                            type="text"
                            required
                            value={formData.promotionName}
                            onChange={(e) => handleFieldChange("promotionName", e.target.value)}
                            className={inputStyle}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className={labelStyle}>
                                {promotionType === PROMOTION_TYPE.PERCENT
                                    ? (lang === "VN" ? "Phần trăm giảm (%) (*)" : "Discount Percent (%) (*)")
                                    : (lang === "VN" ? "Số tiền giảm (VND) (*)" : "Discount Amount (VND) (*)")}
                            </label>
                            <input
                                type="number"
                                required
                                min={0}
                                max={promotionType === PROMOTION_TYPE.PERCENT ? 100 : undefined}
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
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
                        <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                            {lang === "VN" ? "Thời gian & Giới hạn sử dụng" : "Validity & Usage Limits"}
                        </h3>

                        {/* TOGGLE STATUS ACTIVE / INACTIVE */}
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase ${formData.status === PROMOTION_STATUS.ACTIVE ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                                {formData.status === PROMOTION_STATUS.ACTIVE ? (lang === "VN" ? "Active" : "Active") : (lang === "VN" ? "Inactive" : "Inactive")}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleFieldChange("status", formData.status === PROMOTION_STATUS.ACTIVE ? PROMOTION_STATUS.INACTIVE : PROMOTION_STATUS.ACTIVE)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out border-2 border-transparent focus:outline-none ${formData.status === PROMOTION_STATUS.ACTIVE ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                                    }`}
                            >
                                <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${formData.status === PROMOTION_STATUS.ACTIVE ? "translate-x-4" : "translate-x-0"
                                    }`} />
                            </button>
                        </div>
                    </div>

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
                    {lang === "VN" ? "Lưu thay đổi" : "Save Changes"}
                </button>
            </form>
        </div>
    );
}
