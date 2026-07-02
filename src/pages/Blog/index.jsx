import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fetchPublishedBlogPosts } from "../../services/blogService";

export function BlogList() {
    const { lang } = useApp();
    const [blogs, setBlogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const DEFAULT_BLOG_IMAGE = "https://res.cloudinary.com/dygipvoal/image/upload/v1776077167/vbxeolfuttvnbyql60ct.jpg";

    useEffect(() => {
        const loadAllBlogs = async () => {
            try {
                setIsLoading(true);
                const data = await fetchPublishedBlogPosts();
                setBlogs(data || []);
            } catch (err) {
                console.error("Lỗi khi tải danh sách bài viết:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadAllBlogs();
    }, []);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96 w-full bg-slate-50 dark:bg-slate-900/40">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="w-full bg-slate-50 dark:bg-slate-900/40 min-h-screen py-30 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-12 animate-fade-in">
                
                {/* TIÊU ĐỀ TRANG TỔNG TRUNG TÂM TIN TỨC */}
                <div className="text-center max-w-2xl mx-auto space-y-3">
                    <h1 className="text-3xl md:text-5xl font-headline font-bold text-[#124757] dark:text-white leading-tight">
                        {lang === "VN" ? "Tin tức & Sự kiện" : "News & Public Announcements"}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-body">
                        {lang === "VN" 
                            ? "Cập nhật các chương trình khuyến mãi, cẩm nang du lịch trải nghiệm bến sông Sài Gòn mới nhất." 
                            : "Stay updated with recent cruise promotions, local guides and corporate operations."}
                    </p>
                </div>

                {/* LƯỚI KHỐI RENDER DANH SÁCH BÀI VIẾT */}
                {blogs.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 dark:text-slate-500 font-bold">
                        <span className="material-symbols-outlined text-5xl block mb-2">article</span>
                        {lang === "VN" ? "Hiện tại hệ thống chưa xuất bản bài viết nào." : "No articles published on the network grid yet."}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
                        {blogs.map((blog) => (
                            <Link
                                key={blog.blogPostId}
                                to={`/blog/${blog.slug}`}
                                className="flex flex-col bg-white dark:bg-slate-800 overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-500 hover:-translate-y-2 group"
                            >
                                {/* Khung chứa ảnh thu nhỏ */}
                                <div className="relative aspect-16/10 overflow-hidden bg-slate-100 dark:bg-slate-900 shrink-0">
                                    <img
                                        src={blog.imageUrl || DEFAULT_BLOG_IMAGE}
                                        alt={blog.imageAltText || blog.title}
                                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                                        onError={(e) => { e.target.src = DEFAULT_BLOG_IMAGE; }}
                                    />
                                    <span className="absolute top-4 left-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-sm px-3 py-1 rounded-xl text-[10px] font-headline font-black uppercase text-yellow-600 dark:text-yellow-400 tracking-wide">
                                        {blog.category || (lang === "VN" ? "Tin tức" : "News")}
                                    </span>
                                </div>

                                {/* Khối thân nội dung tóm tắt bài viết */}
                                <div className="p-7 flex flex-col flex-1 justify-between gap-5">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                                            <span>{new Date(blog.publishedAt).toLocaleDateString(lang === "VN" ? "vi-VN" : "en-US")}</span>
                                        </div>
                                        <h3 className="text-xl font-headline font-bold text-slate-800 dark:text-white line-clamp-2 leading-snug group-hover:text-yellow-500 transition-colors">
                                            {blog.title}
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 font-body text-sm leading-relaxed line-clamp-3">
                                            {blog.summary}
                                        </p>
                                    </div>

                                    {/* Footer card */}
                                    <div className="pt-4 flex items-center justify-between mt-auto">
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                            <span className="material-symbols-outlined text-sm">edit_document</span>
                                            {blog.authorName || "Admin"}
                                        </span>
                                        <span className="text-xs font-headline font-black text-[#124757] dark:text-yellow-400 group-hover:translate-x-1.5 transition-transform uppercase flex items-center gap-1">
                                            {lang === "VN" ? "Đọc tiếp" : "Read Post"}
                                            <span className="material-symbols-outlined text-[16px] font-bold">arrow_right_alt</span>
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}