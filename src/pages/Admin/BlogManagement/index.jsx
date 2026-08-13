import { useState, useEffect, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import {
    fetchBlogPostsManagement,
    removeBlogPost,
    publishBlogPostById,
    unpublishBlogPostById,
    BLOG_STATUS,
    BLOG_CATEGORY,
    labelBlogCategory,
    labelBlogStatus,
} from "../../../services/blogService";
import { isAdminUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import { FormSelect } from "../../../components/FormSelect";

const STATUS_STYLE = {
    [BLOG_STATUS.DRAFT]: {
        dot: "bg-slate-400",
        badge: "text-slate-500 dark:text-slate-400",
    },
    [BLOG_STATUS.PUBLISHED]: {
        dot: "bg-emerald-500",
        badge: "text-emerald-600 dark:text-emerald-400",
    },
};

const formatDate = (value) => {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("vi-VN");
};

export function BlogManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const { user: currentUser } = useSelector((state) => state.auth);

    const [blogs, setBlogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");
    const [processingId, setProcessingId] = useState(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [categoryFilter, setCategoryFilter] = useState("All");

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 8;

    const canManage = isAdminUser(currentUser);

    const loadBlogs = async () => {
        try {
            setIsLoading(true);
            setErrorMsg("");
            const data = await fetchBlogPostsManagement();
            setBlogs(data || []);
        } catch (error) {
            console.error("Lỗi giao diện tải danh sách blog:", error);
            const status = error?.response?.status;
            setErrorMsg(
                status === 403
                    ? (lang === "VN" ? "Chỉ Admin được quản lý blog." : "Only Admin can manage blog posts.")
                    : (lang === "VN"
                        ? "Không thể kết nối tới máy chủ để tải danh sách bài viết."
                        : "Failed to connect to server to fetch blog posts.")
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!canManage) return;
        loadBlogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang, canManage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, categoryFilter]);

    const stats = useMemo(() => ({
        total: blogs.length,
        published: blogs.filter((b) => b.status === BLOG_STATUS.PUBLISHED).length,
        draft: blogs.filter((b) => b.status === BLOG_STATUS.DRAFT).length,
    }), [blogs]);

    const filteredBlogs = blogs.filter((blog) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch =
            !term ||
            (blog.title?.toLowerCase() || "").includes(term) ||
            (blog.slug?.toLowerCase() || "").includes(term);

        const matchesStatus = statusFilter === "All" || blog.status === statusFilter;
        const matchesCategory = categoryFilter === "All" || blog.category === categoryFilter;

        return matchesSearch && matchesStatus && matchesCategory;
    });

    const totalPages = Math.ceil(filteredBlogs.length / ITEMS_PER_PAGE);
    const currentBlogs = filteredBlogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const startIndex = filteredBlogs.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredBlogs.length);

    if (!canManage) {
        return <Navigate to="/admin" replace />;
    }

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

    const handlePublish = async (blog) => {
        const hasCover = Boolean(blog.imageUrl || (Array.isArray(blog.imageUrls) && blog.imageUrls.length > 0));
        if (!hasCover) {
            notify({
                icon: "warning",
                title: lang === "VN" ? "Thiếu ảnh bìa" : "Missing cover image",
                text: lang === "VN"
                    ? "Bài viết Published bắt buộc phải có ảnh bìa."
                    : "Published posts must have at least one cover image.",
                confirmButtonColor: "#124757",
            });
            return;
        }

        const confirmResult = await notify({
            title: lang === "VN" ? "Xuất bản bài viết?" : "Publish this post?",
            html: lang === "VN"
                ? `Bài viết <b>${blog.title}</b> sẽ hiển thị công khai trên trang Blog.`
                : `Post <b>${blog.title}</b> will become publicly visible on the Blog page.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#124757",
            cancelButtonColor: "#94a3b8",
            confirmButtonText: lang === "VN" ? "Xuất bản" : "Publish",
            cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
        });
        if (!confirmResult.isConfirmed) return;

        try {
            setProcessingId(blog.id);
            await publishBlogPostById(blog.id);
            notify({
                toast: true,
                position: "top-end",
                icon: "success",
                title: lang === "VN" ? "Đã xuất bản" : "Published",
                showConfirmButton: false,
                timer: 1600,
            });
            await loadBlogs();
        } catch (error) {
            console.error("Lỗi khi xuất bản blog:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Thất bại" : "Failed",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể xuất bản bài viết này." : "Failed to publish this post."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setProcessingId(null);
        }
    };

    const handleUnpublish = async (blog) => {
        const confirmResult = await notify({
            title: lang === "VN" ? "Hạ về bản nháp?" : "Move to draft?",
            html: lang === "VN"
                ? `Bài viết <b>${blog.title}</b> sẽ không còn hiển thị công khai.`
                : `Post <b>${blog.title}</b> will no longer be publicly visible.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#124757",
            cancelButtonColor: "#94a3b8",
            confirmButtonText: lang === "VN" ? "Về nháp" : "Set draft",
            cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
        });
        if (!confirmResult.isConfirmed) return;

        try {
            setProcessingId(blog.id);
            await unpublishBlogPostById(blog.id);
            notify({
                toast: true,
                position: "top-end",
                icon: "success",
                title: lang === "VN" ? "Đã về nháp" : "Moved to draft",
                showConfirmButton: false,
                timer: 1600,
            });
            await loadBlogs();
        } catch (error) {
            console.error("Lỗi khi hạ nháp blog:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Thất bại" : "Failed",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể đổi trạng thái bài viết." : "Failed to change post status."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setProcessingId(null);
        }
    };

    const handleDelete = async (blog) => {
        const confirmResult = await notify({
            title: lang === "VN" ? "Xóa bài viết?" : "Delete this post?",
            html: lang === "VN"
                ? `Bài viết <b>${blog.title}</b> sẽ bị <b>xóa vĩnh viễn</b> khỏi hệ thống.`
                : `Post <b>${blog.title}</b> will be <b>permanently deleted</b>.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#124757",
            confirmButtonText: lang === "VN" ? "Xóa" : "Delete",
            cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
        });
        if (!confirmResult.isConfirmed) return;

        try {
            setProcessingId(blog.id);
            await removeBlogPost(blog.id);
            notify({
                toast: true,
                position: "top-end",
                icon: "success",
                title: lang === "VN" ? "Đã xóa" : "Deleted",
                showConfirmButton: false,
                timer: 1600,
            });
            await loadBlogs();
        } catch (error) {
            console.error("Lỗi khi xóa blog:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Thất bại" : "Failed",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể xóa bài viết này." : "Failed to delete this post."),
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
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">

            {/* KHỐI TIÊU ĐỀ HEADER & NÚT THÊM MỚI */}
            <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Quản lý Blog" : "Blog Management"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN"
                            ? "Quản lý danh sách bài viết, tin tức của hệ thống"
                            : "Manage the system's blog posts and news articles"}
                    </p>
                </div>
                {canManage && (
                    <button
                        onClick={() => navigate("/admin/news/create")}
                        className="px-5 py-3 bg-yellow-400 text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
                    >
                        <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
                        {lang === "VN" ? "Viết bài mới" : "New Post"}
                    </button>
                )}
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
                    {errorMsg}
                </div>
            )}

            {/* KHỐI CARD THỐNG KÊ */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số" : "Total"}</span>
                        <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{stats.total}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đã xuất bản" : "Published"}</span>
                        <h3 className="text-xl font-black font-headline text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.published}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Bản nháp" : "Draft"}</span>
                        <h3 className="text-xl font-black font-headline text-amber-600 dark:text-amber-400 mt-0.5">{stats.draft}</h3>
                    </div>
                </div>
            </div>

            {/* THANH TÌM KIẾM VÀ BỘ LỌC */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col xl:flex-row gap-3 items-center">
                <div className="w-full xl:flex-1 relative flex items-center">
                    <span className="material-symbols-outlined absolute left-4 text-slate-400 text-lg pointer-events-none">search</span>
                    <input
                        type="text"
                        placeholder={lang === "VN" ? "Tìm kiếm theo tiêu đề hoặc slug..." : "Search by title or slug..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto justify-end overflow-visible">
                    <div className="relative z-20 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Chuyên mục:" : "Category:"}</span>
                        <FormSelect
                            value={categoryFilter}
                            onChange={setCategoryFilter}
                            options={[
                                { value: "All", label: lang === "VN" ? "Tất cả chuyên mục" : "All Categories" },
                                { value: BLOG_CATEGORY.NEWS, label: lang === "VN" ? "Tin tức" : "News" },
                                { value: BLOG_CATEGORY.EVENT, label: lang === "VN" ? "Sự kiện" : "Event" },
                            ]}
                            className="min-w-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                        />
                    </div>

                    <div className="relative z-10 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Trạng thái:" : "Status:"}</span>
                        <FormSelect
                            value={statusFilter}
                            onChange={setStatusFilter}
                            menuAlign="right"
                            options={[
                                { value: "All", label: lang === "VN" ? "Tất cả trạng thái" : "All Status" },
                                { value: BLOG_STATUS.PUBLISHED, label: lang === "VN" ? "Đã xuất bản" : "Published" },
                                { value: BLOG_STATUS.DRAFT, label: lang === "VN" ? "Nháp" : "Draft" },
                            ]}
                            className="min-w-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* BẢNG DANH SÁCH BLOG */}
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                                <th className="py-4 px-6">{lang === "VN" ? "Bài viết" : "Post"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Chuyên mục" : "Category"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Ngày xuất bản" : "Published"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {currentBlogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        {lang === "VN" ? "Không có bài viết nào." : "No posts found."}
                                    </td>
                                </tr>
                            ) : (
                                currentBlogs.map((blog) => {
                                    const statusStyle = STATUS_STYLE[blog.status] || STATUS_STYLE[BLOG_STATUS.DRAFT];
                                    return (
                                        <tr key={blog.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors group">
                                            {/* Cột 1: Thông tin bài viết */}
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <ImageWithFallback
                                                        src={blog.imageUrl || blog.imageUrls?.[0]}
                                                        alt={blog.imageAltText || blog.title}
                                                        className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0"
                                                        iconClassName="w-6 h-6"
                                                    />
                                                    <div className="space-y-1 min-w-0">
                                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm tracking-tight leading-snug line-clamp-1">
                                                            {blog.title}
                                                        </h4>
                                                        <span className="font-headline font-black text-[10px] tracking-wide text-slate-400 truncate block">
                                                            /{blog.slug}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Cột 2: Chuyên mục */}
                                            <td className="py-4 px-4">
                                                <span className="text-[10px] font-headline font-black tracking-wide text-slate-700 dark:text-slate-200 uppercase">
                                                    {labelBlogCategory(blog.category, lang)}
                                                </span>
                                            </td>

                                            {/* Cột 3: Ngày xuất bản */}
                                            <td className="py-4 px-4">
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    {formatDate(blog.publishedAt)}
                                                </p>
                                            </td>

                                            {/* Cột 4: Trạng thái */}
                                            <td className="py-4 px-4 text-center">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-headline font-black uppercase tracking-wide ${statusStyle.badge}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyle}`}></span>
                                                    {labelBlogStatus(blog.status, lang)}
                                                </span>
                                            </td>

                                            {/* Cột 5: Hành động */}
                                            <td className="py-4 px-6 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => navigate(`/admin/news/edit/${blog.id}`, { state: { blog } })}
                                                        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 hover:border-amber-200 dark:hover:border-amber-500/30 transition-all shadow-sm"
                                                        title={lang === "VN" ? "Chỉnh sửa" : "Edit"}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                                    </button>
                                                    {blog.status !== BLOG_STATUS.PUBLISHED ? (
                                                        <button
                                                            onClick={() => handlePublish(blog)}
                                                            disabled={processingId === blog.id}
                                                            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-500 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400 flex items-center justify-center transition-all shadow-sm disabled:opacity-50"
                                                            title={lang === "VN" ? "Xuất bản" : "Publish"}
                                                        >
                                                            {processingId === blog.id ? (
                                                                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                            ) : (
                                                                <span className="material-symbols-outlined text-[18px]">publish</span>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleUnpublish(blog)}
                                                            disabled={processingId === blog.id}
                                                            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-amber-500 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500/20 dark:hover:text-amber-400 flex items-center justify-center transition-all shadow-sm disabled:opacity-50"
                                                            title={lang === "VN" ? "Về nháp" : "Set draft"}
                                                        >
                                                            {processingId === blog.id ? (
                                                                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                            ) : (
                                                                <span className="material-symbols-outlined text-[18px]">unpublished</span>
                                                            )}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(blog)}
                                                        disabled={processingId === blog.id}
                                                        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500/20 dark:hover:text-rose-400 flex items-center justify-center transition-all shadow-sm disabled:opacity-50"
                                                        title={lang === "VN" ? "Xóa" : "Delete"}
                                                    >
                                                        {processingId === blog.id ? (
                                                            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        )}
                                                    </button>
                                                </div>
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
                    <span className="text-xs font-bold text-slate-400">
                        {lang === "VN"
                            ? `Hiển thị ${startIndex}-${endIndex} trong số ${filteredBlogs.length} kết quả`
                            : `Showing ${startIndex}-${endIndex} of ${filteredBlogs.length} entries`}
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
                            <span className="material-symbols-outlined text-base">chevron_left</span>
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
                            <span className="material-symbols-outlined text-base">chevron_right</span>
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
