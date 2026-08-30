import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ChevronLeft, ChevronRight, CirclePlus, Eye, Pause, Pencil, Play, Search } from "lucide-react";
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
        draft: promotions.filter((p) => p.status === PROMOTION_STATUS.DRAFT).length,
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
        <div className="space-y-5 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">

            {/* KHỐI TIÊU ĐỀ HEADER & NÚT THÊM MỚI */}
            <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
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
                        className="flex shrink-0 items-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 font-headline text-xs font-black uppercase tracking-widest text-slate-900 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
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

            {/* KHỐI CARD THỐNG KÊ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">{lang === "VN" ? "Tổng số" : "Total"}</span>
                        <h3 className="text-2xl font-black font-headline text-[#124757] dark:text-white mt-1">{stats.total}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đang hoạt động" : "Active"}</span>
                        <h3 className="text-2xl font-black font-headline text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tạm dừng" : "Paused"}</span>
                        <h3 className="text-2xl font-black font-headline text-rose-500 mt-1">{stats.paused}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đã hết hạn" : "Expired"}</span>
                        <h3 className="text-2xl font-black font-headline text-amber-600 dark:text-amber-400 mt-1">{stats.expired}</h3>
                    </div>
                </div>
            </div>

            {/* THANH TÌM KIẾM VÀ BỘ LỌC */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col xl:flex-row gap-3 items-stretch xl:items-center">
                <div className="w-full xl:flex-1 relative flex items-center">
                    <Search size={18} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder={lang === "VN" ? "Tìm kiếm theo mã hoặc tên khuyến mãi..." : "Search by promotion code or name..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-3.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto justify-end overflow-visible">
                    <div className="relative z-20 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Loại:" : "Type:"}</span>
                        <FormSelect
                            value={typeFilter}
                            onChange={setTypeFilter}
                            options={[
                                { value: "All", label: lang === "VN" ? "Tất cả loại" : "All Types" },
                                { value: PROMOTION_TYPE.PERCENT, label: lang === "VN" ? "Giảm theo %" : "Percent" },
                                { value: PROMOTION_TYPE.FIXED, label: lang === "VN" ? "Giảm số tiền" : "Fixed" },
                            ]}
                            className="min-w-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 dark:text-white"
                        />
                    </div>

                    <div className="relative z-10 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Trạng thái:" : "Status:"}</span>
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
                            className="min-w-45 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* BẢNG DANH SÁCH KHUYẾN MÃI */}
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                                <th className="py-4 px-6">{lang === "VN" ? "Khuyến mãi" : "Promotion"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Mã" : "Code"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Giảm giá" : "Discount"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Hiệu lực" : "Validity"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Lượt dùng" : "Usage"}</th>
                                <th className="min-w-52 py-4 px-4">{lang === "VN" ? "Ngân sách" : "Budget"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {currentPromotions.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        {lang === "VN" ? "Không có khuyến mãi nào." : "No records found."}
                                    </td>
                                </tr>
                            ) : (
                                currentPromotions.map((promo) => {
                                    const lifecycle = getPromotionLifecycle(promo);
                                    const budget = getBudgetMeta(promo, lang);
                                    return (
                                        <tr key={promo.id} className="hover:bg-[#124757]/[0.035] dark:hover:bg-yellow-400/[0.04] transition-colors group">
                                            {/* Cột 1: Thông tin khuyến mãi */}
                                            <td className="py-4 px-6">
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4
                                                            className="font-bold text-slate-800 dark:text-white text-sm tracking-tight leading-snug cursor-pointer hover:text-[#124757] dark:hover:text-yellow-400"
                                                            onClick={() => navigate(`/admin/promotions/view/${promo.id}`, { state: { promotion: promo } })}
                                                        >
                                                            {promo.promotionName}
                                                        </h4>
                                                        {lifecycle === "expired" && (
                                                            <span className="bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest shrink-0">
                                                                {lang === "VN" ? "Hết hạn" : "Expired"}
                                                            </span>
                                                        )}
                                                        {lifecycle === "upcoming" && (
                                                            <span className="bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 text-[8px] px-1.5 py-0.5 rounded uppercase font-black tracking-widest shrink-0">
                                                                {lang === "VN" ? "Sắp diễn ra" : "Upcoming"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Cột 2: Mã khuyến mãi */}
                                            <td className="py-4 px-4">
                                                <span
                                                    onClick={() => handleCopyCode(promo.promotionCode)}
                                                    title={lang === "VN" ? "Nhấn để sao chép" : "Click to copy"}
                                                    className="font-headline font-black text-[11px] tracking-wide text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg border inline-block cursor-pointer hover:border-[#124757] dark:hover:border-yellow-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors"
                                                >
                                                    {promo.promotionCode}
                                                </span>
                                            </td>

                                            {/* Cột 3: Loại & Giá trị giảm */}
                                            <td className="py-4 px-4">
                                                <div className="space-y-1">
                                                    <span className="text-sm font-black font-headline text-[#124757] dark:text-yellow-400">
                                                        {formatDiscount(promo)}
                                                    </span>
                                                    <p className="text-[10px] text-slate-400">
                                                        {promo.promotionType === PROMOTION_TYPE.PERCENT
                                                            ? (lang === "VN" ? "Giảm theo %" : "Percent off")
                                                            : (lang === "VN" ? "Giảm số tiền cố định" : "Fixed amount")}
                                                    </p>
                                                    {promo.minOrderValue != null && (
                                                        <p className="text-[10px] text-slate-400">
                                                            {lang === "VN" ? "Đơn tối thiểu: " : "Min order: "}{formatCurrency(promo.minOrderValue)}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Cột 3: Hiệu lực */}
                                            <td className="py-4 px-4">
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    {formatDate(promo.validFrom)} - {formatDate(promo.validTo)}
                                                </p>
                                            </td>

                                            {/* Cột 4: Lượt sử dụng */}
                                            <td className="py-4 px-4 text-center">
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    {promo.usageCount}/{promo.usageLimit ?? "∞"}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {promo.maxUsesPerAccount != null
                                                        ? (lang === "VN"
                                                            ? `≤${promo.maxUsesPerAccount}/TK`
                                                            : `≤${promo.maxUsesPerAccount}/acct`)
                                                        : (lang === "VN" ? "Không giới hạn/TK" : "Unlimited/acct")}
                                                </p>
                                            </td>

                                            {/* Cột 6: Ngân sách */}
                                            <td className="min-w-52 py-4 px-4">
                                                {budget.unlimited ? (
                                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-300">
                                                        {budget.label}
                                                    </p>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        <p className="text-xs font-black text-slate-700 dark:text-slate-100">
                                                            {formatBudgetCurrency(budget.remainingBudget)} {lang === "VN" ? "còn lại" : "remaining"}
                                                        </p>
                                                        <p className="text-[10px] text-slate-400">
                                                            {lang === "VN" ? "Đã dùng" : "Spent"} {formatBudgetCurrency(budget.budgetSpent)} / {formatBudgetCurrency(budget.budgetCap)}
                                                        </p>
                                                        <div
                                                            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
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
                                                        {budget.label && (
                                                            <p className={`text-[10px] font-black ${
                                                                budget.exhausted
                                                                    ? "text-rose-600 dark:text-rose-400"
                                                                    : "text-amber-600 dark:text-amber-400"
                                                            }`}>
                                                                {budget.label}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Cột 7: Trạng thái */}
                                            <td className="py-4 px-4 text-center">
                                                <span className={`inline-flex items-center text-[10px] font-headline font-black uppercase tracking-wide ${
                                                    promo.status === PROMOTION_STATUS.ACTIVE
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : promo.status === PROMOTION_STATUS.DRAFT
                                                            ? "text-amber-700 dark:text-amber-400"
                                                            : promo.status === PROMOTION_STATUS.PAUSED
                                                                ? "text-sky-700 dark:text-sky-400"
                                                                : "text-slate-500 dark:text-slate-400"
                                                    }`}>
                                                    {getStatusLabel(promo.status, lang)}
                                                </span>
                                            </td>

                                            {/* Cột 8: Hành động */}
                                            <td className="py-4 px-6 text-center">
                                                {canManage ? (
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => navigate(`/admin/promotions/view/${promo.id}`, { state: { promotion: promo } })}
                                                            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-[#124757] hover:bg-slate-50 dark:hover:bg-slate-900 dark:hover:text-yellow-400 transition-all"
                                                            title={lang === "VN" ? "Xem chi tiết" : "View"}
                                                        >
                                                            <Eye size={17} aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            onClick={() => navigate(`/admin/promotions/edit/${promo.id}`, { state: { promotion: promo } })}
                                                            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/20 hover:border-amber-200 dark:hover:border-amber-500/30 transition-all"
                                                            title={lang === "VN" ? "Chỉnh sửa" : "Edit"}
                                                        >
                                                            <Pencil size={17} aria-hidden="true" />
                                                        </button>
                                                        {promo.status === PROMOTION_STATUS.ACTIVE ? (
                                                            <button
                                                                onClick={() => handlePause(promo)}
                                                                disabled={processingId === promo.id}
                                                                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sky-600 hover:bg-sky-600 hover:text-white flex items-center justify-center transition-all disabled:opacity-50"
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
                                                                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all disabled:opacity-50"
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
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => navigate(`/admin/promotions/view/${promo.id}`, { state: { promotion: promo } })}
                                                            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-[#124757] transition-all"
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
                <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
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
