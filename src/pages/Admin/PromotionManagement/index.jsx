import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ChevronLeft, ChevronRight, CirclePlus, Copy, Eye, Pause, Pencil, Play, Search } from "lucide-react";
import { useApp } from "../../../context/AppContext";

import {
    fetchPromotions,
    modifyPromotion,
    buildPromotionPayload,
    formFromPromotion,
    PROMOTION_TYPE,
    PROMOTION_STATUS,
} from "../../../services/promotionService";

import { isAdminUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";
import { FormSelect } from "../../../components/FormSelect";
import { ImageWithFallback } from "../../../components/ImageWithFallback";

const STATUS_LABELS = {
    [PROMOTION_STATUS.DRAFT]: { vn: "Nháp", en: "Draft" },
    [PROMOTION_STATUS.ACTIVE]: { vn: "Đang hoạt động", en: "Active" },
    [PROMOTION_STATUS.PAUSED]: { vn: "Tạm dừng", en: "Paused" },
    [PROMOTION_STATUS.ARCHIVED]: { vn: "Đã lưu trữ", en: "Archived" },
};

const getStatusLabel = (status, lang) => {
    const entry = STATUS_LABELS[status];
    if (!entry) return status || "--";
    return lang === "VN" ? entry.vn : entry.en;
};

const formatCurrency = (value) => `${(Number(value) || 0).toLocaleString("vi-VN")}đ`;

const vndFormatter = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
});

const formatBudgetCurrency = (value) => {
    if (value === null || value === undefined || value === "") return "--";
    return Number.isFinite(Number(value)) ? vndFormatter.format(Number(value)) : "--";
};

const getBudgetMeta = (promo, lang) => {
    if (promo.budgetCap == null) {
        return {
            unlimited: true,
            label: lang === "VN" ? "Không giới hạn" : "Unlimited",
        };
    }

    const budgetCap = Number(promo.budgetCap);
    const budgetSpent = promo.budgetSpent == null ? null : Number(promo.budgetSpent);
    const remainingBudget = promo.remainingBudget == null ? null : Number(promo.remainingBudget);
    const effectiveState = String(promo.effectiveState || "").trim().toLowerCase();
    const percent = Number.isFinite(budgetSpent) && Number.isFinite(budgetCap) && budgetCap > 0
        ? Math.min(100, Math.max(0, (budgetSpent / budgetCap) * 100))
        : 0;
    const exhausted = remainingBudget === 0 || effectiveState === "exhausted";
    const nearlyExhausted = !exhausted
        && Number.isFinite(remainingBudget)
        && Number.isFinite(budgetCap)
        && budgetCap > 0
        && remainingBudget / budgetCap <= 0.1;

    return {
        unlimited: false,
        budgetCap,
        budgetSpent,
        remainingBudget,
        percent,
        exhausted,
        nearlyExhausted,
        label: exhausted
            ? (lang === "VN" ? "Đã hết ngân sách" : "Budget exhausted")
            : nearlyExhausted
                ? (lang === "VN" ? "Sắp hết ngân sách" : "Budget nearly exhausted")
                : "",
    };
};

const formatDiscount = (promo) =>
    promo.promotionType === PROMOTION_TYPE.PERCENT
        ? `${promo.discountValue}%`
        : formatCurrency(promo.discountValue);

const formatDate = (value) => {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("vi-VN");
};

const getPromotionLifecycle = (promo) => {
    const now = new Date();
    const validTo = promo.validTo ? new Date(promo.validTo) : null;
    const validFrom = promo.validFrom ? new Date(promo.validFrom) : null;
    if (promo.status !== PROMOTION_STATUS.ACTIVE) return "inactive";
    if (validTo && validTo < now) return "expired";
    if (validFrom && validFrom > now) return "upcoming";
    return "active";
};

export function PromotionManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const { user: currentUser } = useSelector((state) => state.auth);

    const [promotions, setPromotions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");
    const [processingId, setProcessingId] = useState(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [typeFilter, setTypeFilter] = useState("All");

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 8;

    const canManage = isAdminUser(currentUser);

    const loadPromotions = async () => {
        try {
            setIsLoading(true);
            setErrorMsg("");
            const data = await fetchPromotions();
            setPromotions(data || []);
        } catch (error) {
            console.error("Lỗi giao diện tải danh sách khuyến mãi:", error);
            setErrorMsg(
                lang === "VN"
                    ? "Không thể kết nối tới máy chủ để tải danh sách khuyến mãi."
                    : "Failed to connect to server to fetch promotion records."
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPromotions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, typeFilter]);

    const stats = useMemo(() => ({
        total: promotions.length,
        active: promotions.filter((p) => p.status === PROMOTION_STATUS.ACTIVE).length,
        paused: promotions.filter((p) => p.status === PROMOTION_STATUS.PAUSED).length,
        expired: promotions.filter((p) => getPromotionLifecycle(p) === "expired").length,
    }), [promotions]);

    const filteredPromotions = promotions.filter((promo) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch =
            !term ||
            (promo.promotionCode?.toLowerCase() || "").includes(term) ||
            (promo.promotionName?.toLowerCase() || "").includes(term);

        const matchesStatus = statusFilter === "All" || promo.status === statusFilter;
        const matchesType = typeFilter === "All" || promo.promotionType === typeFilter;

        return matchesSearch && matchesStatus && matchesType;
    });

    const totalPages = Math.ceil(filteredPromotions.length / ITEMS_PER_PAGE);
    const currentPromotions = filteredPromotions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const startIndex = filteredPromotions.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredPromotions.length);

    const getPaginationGroup = () => {
        let pages = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else if (currentPage <= 3) {
            pages = [1, 2, 3, 4, "...", totalPages];
        } else if (currentPage >= totalPages - 2) {
            pages = [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
            pages = [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
        }
        return pages;
    };

    const handleCopyCode = (code) => {
        if (!code) return;
        navigator.clipboard?.writeText(code);
        notify({
            icon: "success",
            title: lang === "VN" ? "Đã sao chép mã!" : "Code copied!",
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 1600,
        });
    };

    const handlePause = async (promo) => {
        try {
            setProcessingId(promo.id);
            const payload = buildPromotionPayload(formFromPromotion(promo), { includeCode: true });
            payload.status = PROMOTION_STATUS.PAUSED;
            payload.validFrom = promo.validFrom;
            payload.validTo = promo.validTo;
            await modifyPromotion(promo.id, payload);
            notify({
                toast: true,
                position: "top-end",
                icon: "success",
                title: lang === "VN" ? "Đã tạm dừng" : "Paused",
                showConfirmButton: false,
                timer: 1600,
            });
            await loadPromotions();
        } catch (error) {
            console.error("Lỗi khi tạm dừng khuyến mãi:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Thất bại" : "Failed",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể tạm dừng khuyến mãi này." : "Failed to pause this promotion."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setProcessingId(null);
        }
    };

    const handleActivate = async (promo) => {
        try {
            setProcessingId(promo.id);
            const payload = buildPromotionPayload(formFromPromotion(promo), { includeCode: true });
            payload.status = PROMOTION_STATUS.ACTIVE;
            // Giữ nguyên ISO gốc từ BE (tránh lệch timezone khi round-trip datetime-local)
            payload.validFrom = promo.validFrom;
            payload.validTo = promo.validTo;
            await modifyPromotion(promo.id, payload);
            notify({
                toast: true,
                position: "top-end",
                icon: "success",
                title: lang === "VN" ? "Đã kích hoạt" : "Activated",
                showConfirmButton: false,
                timer: 1600,
            });
            await loadPromotions();
        } catch (error) {
            console.error("Lỗi khi kích hoạt khuyến mãi:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Thất bại" : "Failed",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể kích hoạt khuyến mãi này." : "Failed to activate this promotion."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setProcessingId(null);
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
        <div className="mx-auto max-w-7xl space-y-4 px-2 pb-10 font-body animate-fade-in sm:px-4">

            {/* KHỐI TIÊU ĐỀ HEADER & NÚT THÊM MỚI */}
            <div className="flex flex-col items-start justify-between gap-4 rounded-4xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center">
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Quản lý Khuyến mãi" : "Promotion Management"}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {lang === "VN" ? "Danh sách mã khuyến mãi, hạn mức sử dụng và trạng thái áp dụng." : "Manage promotion codes, usage limits and active status."}
                    </p>
                </div>
                {canManage && (
                    <button
                        onClick={() => navigate("/admin/promotions/create")}
                        className="flex shrink-0 items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2.5 font-headline text-xs font-black uppercase tracking-wider text-slate-900 transition-colors hover:bg-yellow-300"
                    >
                        <CirclePlus size={18} strokeWidth={2.5} />
                        {lang === "VN" ? "Thêm khuyến mãi mới" : "New Promotion"}
                    </button>
                )}
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
                    {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                    [lang === "VN" ? "Tổng số" : "Total", stats.total, "text-[#124757] dark:text-white"],
                    [lang === "VN" ? "Hoạt động" : "Active", stats.active, "text-emerald-600 dark:text-emerald-400"],
                    [lang === "VN" ? "Tạm dừng" : "Paused", stats.paused, "text-sky-600 dark:text-sky-400"],
                    [lang === "VN" ? "Hết hạn" : "Expired", stats.expired, "text-amber-600 dark:text-amber-400"],
                ].map(([label, value, tone]) => (
                    <div
                        key={label}
                        className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800"
                    >
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {label}
                        </span>
                        <strong className={`mt-0.5 block font-headline text-xl font-black ${tone}`}>
                            {value}
                        </strong>
                    </div>
                ))}
            </div>

            {/* THANH TÌM KIẾM VÀ BỘ LỌC */}
            <div className="flex flex-col items-stretch gap-3 rounded-4xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:flex-row lg:items-center">
                <div className="w-full xl:flex-1 relative flex items-center">
                    <Search size={18} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder={lang === "VN" ? "Tìm kiếm theo mã hoặc tên khuyến mãi..." : "Search by promotion code or name..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-xs font-semibold text-slate-800 outline-none transition-colors focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-yellow-400"
                    />
                </div>

                <div className="flex w-full flex-col gap-2 overflow-visible sm:flex-row lg:w-auto">
                    <div className="relative z-20 min-w-44">
                        <FormSelect
                            value={typeFilter}
                            onChange={setTypeFilter}
                            options={[
                                { value: "All", label: lang === "VN" ? "Tất cả loại" : "All Types" },
                                { value: PROMOTION_TYPE.PERCENT, label: lang === "VN" ? "Giảm theo %" : "Percent" },
                                { value: PROMOTION_TYPE.FIXED, label: lang === "VN" ? "Giảm số tiền" : "Fixed" },
                            ]}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                    </div>

                    <div className="relative z-10 min-w-48">
                        <FormSelect
                            value={statusFilter}
                            onChange={setStatusFilter}
                            menuAlign="right"
                            options={[
                                { value: "All", label: lang === "VN" ? "Tất cả trạng thái" : "All statuses" },
                                { value: PROMOTION_STATUS.DRAFT, label: getStatusLabel(PROMOTION_STATUS.DRAFT, lang) },
                                { value: PROMOTION_STATUS.ACTIVE, label: getStatusLabel(PROMOTION_STATUS.ACTIVE, lang) },
                                { value: PROMOTION_STATUS.PAUSED, label: getStatusLabel(PROMOTION_STATUS.PAUSED, lang) },
                            ]}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* BẢNG DANH SÁCH KHUYẾN MÃI */}
            <div className="overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-245 border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80 font-headline text-[10px] font-black uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
                                <th className="min-w-87.5 px-5 py-3">{lang === "VN" ? "Khuyến mãi" : "Promotion"}</th>
                                <th className="min-w-36 px-4 py-3">{lang === "VN" ? "Ưu đãi" : "Offer"}</th>
                                <th className="min-w-40 px-4 py-3">{lang === "VN" ? "Hiệu lực" : "Validity"}</th>
                                <th className="min-w-52 px-4 py-3">{lang === "VN" ? "Sử dụng & ngân sách" : "Usage & budget"}</th>
                                <th className="min-w-28 px-4 py-3">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="min-w-40 px-5 py-3 text-right">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600 dark:divide-slate-700/60 dark:text-slate-300">
                            {currentPromotions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-14 text-center font-bold text-slate-400 dark:text-slate-500">
                                        {lang === "VN" ? "Không có khuyến mãi nào." : "No records found."}
                                    </td>
                                </tr>
                            ) : (
                                currentPromotions.map((promo) => {
                                    const lifecycle = getPromotionLifecycle(promo);
                                    const budget = getBudgetMeta(promo, lang);
                                    return (
                                        <tr key={promo.id} className="group transition-colors hover:bg-[#124757]/03 dark:hover:bg-yellow-400/4">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/admin/promotions/view/${promo.id}`, { state: { promotion: promo } })}
                                                        className="h-18 w-18 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1 transition-colors hover:border-[#124757] focus:outline-none focus:ring-2 focus:ring-[#124757]/20 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-yellow-400"
                                                        title={lang === "VN" ? "Xem ảnh và chi tiết" : "View image and details"}
                                                    >
                                                        <ImageWithFallback
                                                            src={promo.imageUrl}
                                                            alt={promo.promotionName}
                                                            className="h-full w-full bg-transparent dark:bg-transparent"
                                                            imgClassName="h-full w-full object-contain"
                                                            iconClassName="h-8 w-8"
                                                        />
                                                    </button>
                                                    <div className="min-w-0 space-y-1.5">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <button
                                                                type="button"
                                                                className="line-clamp-2 text-left text-sm font-bold leading-snug text-slate-800 hover:text-[#124757] dark:text-white dark:hover:text-yellow-400"
                                                                onClick={() => navigate(`/admin/promotions/view/${promo.id}`, { state: { promotion: promo } })}
                                                            >
                                                                {promo.promotionName}
                                                            </button>
                                                            {lifecycle === "expired" && (
                                                                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                                                                    {lang === "VN" ? "Hết hạn" : "Expired"}
                                                                </span>
                                                            )}
                                                            {lifecycle === "upcoming" && (
                                                                <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
                                                                    {lang === "VN" ? "Sắp diễn ra" : "Upcoming"}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyCode(promo.promotionCode)}
                                                            title={lang === "VN" ? "Sao chép mã" : "Copy code"}
                                                            className="inline-flex items-center gap-1.5 font-headline text-[10px] font-black tracking-wide text-[#124757] hover:underline dark:text-yellow-400"
                                                        >
                                                            {promo.promotionCode}
                                                            <Copy size={11} aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5 align-middle">
                                                <div className="space-y-0.5">
                                                    <strong className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                                                        {formatDiscount(promo)}
                                                    </strong>
                                                    <p className="text-[10px] text-slate-400">
                                                        {promo.promotionType === PROMOTION_TYPE.PERCENT
                                                            ? (lang === "VN" ? "Giảm theo %" : "Percent off")
                                                            : (lang === "VN" ? "Giảm số tiền cố định" : "Fixed amount")}
                                                    </p>
                                                    {promo.minOrderValue != null && (
                                                        <p className="text-[10px] text-slate-400">
                                                            {lang === "VN" ? "Từ " : "From "}<span className="font-bold text-slate-600 dark:text-slate-300">{formatCurrency(promo.minOrderValue)}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5 align-middle">
                                                <p className="font-bold text-slate-700 dark:text-slate-200">{formatDate(promo.validFrom)}</p>
                                                <p className="mt-1 text-[10px] text-slate-400">{lang === "VN" ? "đến" : "to"} {formatDate(promo.validTo)}</p>
                                            </td>

                                            <td className="px-4 py-3.5 align-middle">
                                                <div className="mb-2 flex items-baseline justify-between gap-3">
                                                    <span className="text-[10px] text-slate-400">{lang === "VN" ? "Lượt dùng" : "Usage"}</span>
                                                    <strong className="text-xs text-slate-700 dark:text-slate-200">{promo.usageCount}/{promo.usageLimit ?? "∞"}</strong>
                                                </div>
                                                {budget.unlimited ? (
                                                    <p className="text-[10px] font-semibold text-slate-400">{lang === "VN" ? "Ngân sách không giới hạn" : "Unlimited budget"}</p>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between gap-2 text-[10px]">
                                                            <span className="text-slate-400">{lang === "VN" ? "Ngân sách" : "Budget"}</span>
                                                            <strong className="text-slate-600 dark:text-slate-300">{formatBudgetCurrency(budget.remainingBudget)}</strong>
                                                        </div>
                                                        <div
                                                            className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
                                                            role="progressbar"
                                                            aria-label={lang === "VN" ? "Tỷ lệ ngân sách đã dùng" : "Budget used"}
                                                            aria-valuemin={0}
                                                            aria-valuemax={100}
                                                            aria-valuenow={Math.round(budget.percent)}
                                                        >
                                                            <div
                                                                className={`h-full rounded-full transition-[width] ${
                                                                    budget.exhausted
                                                                        ? "bg-rose-500"
                                                                        : budget.nearlyExhausted
                                                                            ? "bg-amber-500"
                                                                            : "bg-[#124757] dark:bg-yellow-400"
                                                                }`}
                                                                style={{ width: `${budget.percent}%` }}
                                                            />
                                                        </div>
                                                        {budget.label ? (
                                                            <p className={`text-[9px] font-bold ${
                                                                budget.exhausted
                                                                    ? "text-rose-600 dark:text-rose-400"
                                                                    : "text-amber-600 dark:text-amber-400"
                                                            }`}>
                                                                {budget.label}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5 align-middle">
                                                <span className={`inline-flex text-[9px] font-headline font-black uppercase tracking-wide ${
                                                promo.status === PROMOTION_STATUS.ACTIVE
                                                    ? "text-emerald-700 dark:text-emerald-400"
                                                    : promo.status === PROMOTION_STATUS.DRAFT
                                                        ? "text-amber-700 dark:text-amber-400"
                                                        : promo.status === PROMOTION_STATUS.PAUSED
                                                            ? "text-sky-700 dark:text-sky-400"
                                                            : "text-slate-500 dark:text-slate-400"
                                                }`}>
                                                    {getStatusLabel(promo.status, lang)}
                                                </span>
                                            </td>

                                            <td className="px-5 py-3.5 align-middle">
                                                {canManage ? (
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => navigate(`/admin/promotions/view/${promo.id}`, { state: { promotion: promo } })}
                                                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-[#124757] hover:text-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:hover:border-yellow-400 dark:hover:text-yellow-400"
                                                            title={lang === "VN" ? "Xem chi tiết" : "View"}
                                                        >
                                                            <Eye size={17} aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            onClick={() => navigate(`/admin/promotions/edit/${promo.id}`, { state: { promotion: promo } })}
                                                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-amber-400 hover:text-amber-600 dark:border-slate-700 dark:bg-slate-800"
                                                            title={lang === "VN" ? "Chỉnh sửa" : "Edit"}
                                                        >
                                                            <Pencil size={17} aria-hidden="true" />
                                                        </button>
                                                        {promo.status === PROMOTION_STATUS.ACTIVE ? (
                                                            <button
                                                                onClick={() => handlePause(promo)}
                                                                disabled={processingId === promo.id}
                                                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-sky-600 transition-colors hover:border-sky-600 hover:bg-sky-600 hover:text-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
                                                                title={lang === "VN" ? "Tạm dừng" : "Pause"}
                                                            >
                                                                {processingId === promo.id ? (
                                                                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                                ) : (
                                                                    <Pause size={17} fill="currentColor" aria-hidden="true" />
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleActivate(promo)}
                                                                disabled={processingId === promo.id}
                                                                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-emerald-600 transition-colors hover:border-emerald-600 hover:bg-emerald-600 hover:text-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
                                                                title={lang === "VN" ? "Kích hoạt" : "Activate"}
                                                            >
                                                                {processingId === promo.id ? (
                                                                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                                ) : (
                                                                    <Play size={17} fill="currentColor" aria-hidden="true" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => navigate(`/admin/promotions/view/${promo.id}`, { state: { promotion: promo } })}
                                                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-[#124757] hover:text-[#124757] dark:border-slate-700 dark:bg-slate-800"
                                                            title={lang === "VN" ? "Xem chi tiết" : "View"}
                                                        >
                                                            <Eye size={17} aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* KHỐI PHÂN TRANG */}
            {totalPages > 0 && (
                <div className="flex flex-col items-center justify-between gap-4 rounded-4xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-row">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {lang === "VN"
                            ? `Hiển thị ${startIndex}-${endIndex} trong số ${filteredPromotions.length} kết quả`
                            : `Showing ${startIndex}-${endIndex} of ${filteredPromotions.length} entries`}
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${currentPage === 1
                                    ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                                }`}
                        >
                            <ChevronLeft size={16} aria-hidden="true" />
                        </button>

                        {getPaginationGroup().map((item, index) => {
                            if (item === "...") {
                                return (
                                    <span key={`ellipsis-${index}`} className="w-8 h-8 flex items-center justify-center text-slate-400 font-bold tracking-widest shrink-0">
                                        ...
                                    </span>
                                );
                            }
                            return (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setCurrentPage(item)}
                                    className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black font-headline text-xs transition-all ${currentPage === item
                                            ? "bg-[#124757] text-white shadow-md border-transparent dark:bg-yellow-400 dark:text-slate-900"
                                            : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 hover:bg-slate-50"
                                        }`}
                                >
                                    {item}
                                </button>
                            );
                        })}

                        <button
                            type="button"
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${currentPage === totalPages
                                    ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                                }`}
                        >
                            <ChevronRight size={16} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
