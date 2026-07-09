import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Swal from "sweetalert2";
import { useApp } from "../../../context/AppContext";
import {
    fetchBlogPostsManagement,
    removeBlogPost,
    publishBlogPostById,
    BLOG_STATUS,
    BLOG_CATEGORY,
} from "../../../services/blogService";
import { isOperationsUser } from "../../../utils/roleHelpers";

const DEFAULT_BLOG_IMAGE = "https://res.cloudinary.com/dygipvoal/image/upload/v1776077167/vbxeolfuttvnbyql60ct.jpg";

const STATUS_STYLE = {
    [BLOG_STATUS.DRAFT]: {
        dot: "bg-slate-400",
        badge: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
    },
    [BLOG_STATUS.PUBLISHED]: {
        dot: "bg-emerald-500",
        badge: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400",
    },
    [BLOG_STATUS.ARCHIVED]: {
        dot: "bg-rose-500",
        badge: "bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400",
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

    const canManage = isOperationsUser(currentUser);

    const loadBlogs = async () => {
        try {
            setIsLoading(true);
            setErrorMsg("");
            const data = await fetchBlogPostsManagement();
            setBlogs(data || []);
        } catch (error) {
            console.error("Lỗi giao diện tải danh sách blog:", error);
            setErrorMsg(
                lang === "VN"
                    ? "Không thể kết nối tới máy chủ để tải danh sách bài viết."
                    : "Failed to connect to server to fetch blog posts."
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadBlogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, categoryFilter]);

    const stats = useMemo(() => ({
        total: blogs.length,
        published: blogs.filter((b) => b.status === BLOG_STATUS.PUBLISHED).length,
        draft: blogs.filter((b) => b.status === BLOG_STATUS.DRAFT).length,
        archived: blogs.filter((b) => b.status === BLOG_STATUS.ARCHIVED).length,
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
        if (!blog.imageUrl) {
            Swal.fire({
                icon: "warning",
                title: lang === "VN" ? "Thiếu ảnh bìa" : "Missing cover image",
                text: lang === "VN"
                    ? "Bài viết cần có ảnh bìa (imageUrl) trước khi có thể xuất bản."
                    : "This post needs a cover image (imageUrl) before it can be published.",
                confirmButtonColor: "#124757",
            });
            return;
        }

        const confirmResult = await Swal.fire({
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
            Swal.fire({
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
            Swal.fire({
                icon: "error",
                title: lang === "VN" ? "Thất bại" : "Failed",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể xuất bản bài viết này." : "Failed to publish this post."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setProcessingId(null);
        }
    };

    const handleArchive = async (blog) => {
        const confirmResult = await Swal.fire({
            title: lang === "VN" ? "Lưu trữ bài viết?" : "Archive this post?",
            html: lang === "VN"
                ? `Bài viết <b>${blog.title}</b> sẽ bị gỡ khỏi trang Blog công khai.`
                : `Post <b>${blog.title}</b> will be removed from the public Blog page.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#124757",
            confirmButtonText: lang === "VN" ? "Lưu trữ" : "Archive",
            cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
        });
        if (!confirmResult.isConfirmed) return;

        try {
            setProcessingId(blog.id);
            await removeBlogPost(blog.id);
            Swal.fire({
                toast: true,
                position: "top-end",
                icon: "success",
                title: lang === "VN" ? "Đã lưu trữ" : "Archived",
                showConfirmButton: false,
                timer: 1600,
            });
            await loadBlogs();
        } catch (error) {
            console.error("Lỗi khi lưu trữ blog:", error);
            Swal.fire({
                icon: "error",
                title: lang === "VN" ? "Thất bại" : "Failed",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể lưu trữ bài viết này." : "Failed to archive this post."),
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
                        {lang === "VN" ? "Danh sách bài viết, trạng thái xuất bản và nội dung tin tức." : "Manage blog posts, publish status and article content."}
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 group-hover:bg-[#124757] group-hover:text-white dark:group-hover:bg-yellow-400 dark:group-hover:text-slate-900 transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-2xl">feed</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số" : "Total"}</span>
                        <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{stats.total}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-2xl">task_alt</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đã xuất bản" : "Published"}</span>
                        <h3 className="text-xl font-black font-headline text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.published}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-2xl">edit_note</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Bản nháp" : "Draft"}</span>
                        <h3 className="text-xl font-black font-headline text-amber-600 dark:text-amber-400 mt-0.5">{stats.draft}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-500 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-2xl">archive</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đã lưu trữ" : "Archived"}</span>
                        <h3 className="text-xl font-black font-headline text-rose-500 mt-0.5">{stats.archived}</h3>
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

                <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto overflow-x-auto shrink-0">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 outline-none cursor-pointer shadow-inner shrink-0"
                    >
                        <option value="All">{lang === "VN" ? "Tất cả chuyên mục" : "All Categories"}</option>
                        <option value={BLOG_CATEGORY.NEWS}>{lang === "VN" ? "Tin tức" : "News"}</option>
                        <option value={BLOG_CATEGORY.EVENT}>{lang === "VN" ? "Sự kiện" : "Event"}</option>
                        <option value={BLOG_CATEGORY.ACTIVITY}>{lang === "VN" ? "Hoạt động" : "Activity"}</option>
                    </select>

                    <div className="flex gap-2">
                        {[
                            { key: "All", vn: "Tất cả trạng thái", en: "All Status" },
                            { key: BLOG_STATUS.PUBLISHED, vn: "Đã xuất bản", en: "Published" },
                            { key: BLOG_STATUS.DRAFT, vn: "Nháp", en: "Draft" },
                            { key: BLOG_STATUS.ARCHIVED, vn: "Lưu trữ", en: "Archived" },
                        ].map((btn) => (
                            <button
                                key={btn.key}
                                type="button"
                                onClick={() => setStatusFilter(btn.key)}
                                className={`px-5 py-3.5 rounded-xl text-[10px] font-headline font-black uppercase tracking-wider border transition-all shrink-0 ${statusFilter === btn.key
                                        ? " border-transparent bg-yellow-400 text-slate-900 shadow-md"
                                        : "bg-white text-slate-500 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                                    }`}
                            >
                                {lang === "VN" ? btn.vn : btn.en}
                            </button>
                        ))}
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
                                <th className="py-4 px-4">{lang === "VN" ? "Tác giả" : "Author"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Ngày xuất bản" : "Published"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {currentBlogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        <span className="material-symbols-outlined text-4xl block mb-2">article</span>
                                        {lang === "VN" ? "Không có bài viết nào phù hợp bộ lọc." : "No posts found matching filters."}
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
                                                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0">
                                                        <img
                                                            src={blog.imageUrl || DEFAULT_BLOG_IMAGE}
                                                            alt={blog.imageAltText || blog.title}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { e.target.src = DEFAULT_BLOG_IMAGE; }}
                                                        />
                                                    </div>
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
                                                <span className="text-[10px] font-headline font-black tracking-wide text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 inline-block uppercase">
                                                    {blog.category}
                                                </span>
                                            </td>

                                            {/* Cột 3: Tác giả */}
                                            <td className="py-4 px-4">
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    {blog.authorName || "Admin"}
                                                </p>
                                            </td>

                                            {/* Cột 4: Ngày xuất bản */}
                                            <td className="py-4 px-4">
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    {formatDate(blog.publishedAt)}
                                                </p>
                                            </td>

                                            {/* Cột 5: Trạng thái */}
                                            <td className="py-4 px-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${statusStyle.badge}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
                                                    {blog.status}
                                                </span>
                                            </td>

                                            {/* Cột 6: Hành động */}
                                            <td className="py-4 px-6 text-center">
                                                {canManage ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => navigate(`/admin/news/edit/${blog.id}`, { state: { blog } })}
                                                            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 hover:border-amber-200 dark:hover:border-amber-500/30 transition-all shadow-sm"
                                                            title={lang === "VN" ? "Chỉnh sửa" : "Edit"}
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                                        </button>
                                                        {blog.status !== BLOG_STATUS.PUBLISHED && (
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
                                                        )}
                                                        {blog.status !== BLOG_STATUS.ARCHIVED && (
                                                            <button
                                                                onClick={() => handleArchive(blog)}
                                                                disabled={processingId === blog.id}
                                                                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500/20 dark:hover:text-rose-400 flex items-center justify-center transition-all shadow-sm disabled:opacity-50"
                                                                title={lang === "VN" ? "Lưu trữ" : "Archive"}
                                                            >
                                                                {processingId === blog.id ? (
                                                                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-[18px]">archive</span>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wider flex items-center justify-center gap-1">
                                                        <span className="material-symbols-outlined text-sm">visibility</span>
                                                        {lang === "VN" ? "Chỉ xem" : "View only"}
                                                    </span>
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
