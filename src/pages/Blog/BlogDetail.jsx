import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fetchBlogPostDetail, getBlogCoverUrl, getBlogDisplayHtml } from "../../services/blogService";

export function BlogDetail() {
    const { lang } = useApp();
    const { slug } = useParams();
    const navigate = useNavigate();

    const [blog, setBlog] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const getBlogDetail = async () => {
            try {
                setIsLoading(true);
                setError(false);
                const data = await fetchBlogPostDetail(slug);
                setBlog(data);
            } catch (err) {
                console.error("Không tìm thấy bài viết hoặc lỗi máy chủ:", err);
                setError(true);
            } finally {
                setIsLoading(false);
            }
        };
        getBlogDetail();
    }, [slug]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96 w-full bg-white dark:bg-slate-900 pt-28 md:pt-32">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !blog) {
        return (
            <div className="max-w-xl mx-auto text-center pt-28 md:pt-32 pb-24 px-6 font-body">
                <span className="material-symbols-outlined text-5xl text-rose-500 mb-2">article_off</span>
                <h3 className="text-xl font-headline font-black text-[#124757] dark:text-white uppercase">{lang === "VN" ? "Bài viết không tồn tại" : "Article Not Found"}</h3>
                <p className="text-xs text-slate-400 mt-2">{lang === "VN" ? "Nội dung bài viết này đã bị gỡ bỏ hoặc đường dẫn slug của bạn không chính xác." : "The post you are searching for is unlisted or removed."}</p>
                <button onClick={() => navigate("/")} className="mt-6 px-6 py-2.5 bg-[#124757] text-white text-xs font-bold rounded-xl shadow-md uppercase tracking-wider">{lang === "VN" ? "Quay về trang chủ" : "Back to Home"}</button>
            </div>
        );
    }

    const coverUrl = getBlogCoverUrl(blog);
    const gallery = Array.isArray(blog.imageUrls) ? blog.imageUrls : (coverUrl ? [coverUrl] : []);
    const contentHtml = getBlogDisplayHtml(blog);

    return (
        <div className="w-full bg-white dark:bg-slate-900 transition-colors duration-300 min-h-screen pt-28 md:pt-32 pb-24">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 space-y-8 animate-fade-in">
                
                <div className="flex items-center justify-between">
                    <Link 
                        to="/blog" 
                        className="flex items-center gap-1.5 text-xs font-headline font-black text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors uppercase tracking-wider"
                    >
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        {lang === "VN" ? "Quay lại" : "Back"}
                    </Link>
                </div>

                <div className="space-y-4">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-headline font-black text-[#124757] dark:text-white leading-tight tracking-tight">
                        {blog.title}
                    </h1>
                    
                    <div className="flex flex-wrap items-center gap-4 text-slate-400 text-xs font-semibold pt-2 border-b border-slate-100 dark:border-slate-800 pb-4">
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-base">calendar_today</span>
                            {blog.publishedAt
                                ? new Date(blog.publishedAt).toLocaleDateString(lang === "VN" ? "vi-VN" : "en-US")
                                : "—"}
                        </span>
                    </div>
                </div>

                {coverUrl ? (
                    <div className="w-full aspect-video overflow-hidden shadow-sm bg-slate-50 dark:bg-slate-800">
                        <img 
                            src={coverUrl} 
                            alt={blog.imageAltText || blog.title} 
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : null}

                {gallery.length > 1 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {gallery.slice(1).map((url) => (
                            <div key={url} className="aspect-video overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                                <img src={url} alt={blog.imageAltText || blog.title} className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                ) : null}

                <div className="prose prose-slate dark:prose-invert max-w-none font-body text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed space-y-6">
                    {blog.summary ? (
                        <p className="font-bold italic text-slate-800 dark:text-slate-200 text-base border-l-4 border-yellow-400 pl-4 py-1 bg-slate-50/50 dark:bg-slate-800/20 rounded-r-xl">
                            {blog.summary}
                        </p>
                    ) : null}
                    
                    {contentHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: contentHtml }} className="space-y-4" />
                    ) : blog.contentText || blog.content ? (
                        <div className="whitespace-pre-line space-y-4">
                            {blog.contentText || blog.content}
                        </div>
                    ) : (
                        <div className="whitespace-pre-line space-y-4">
                            {blog.description || blog.summary}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
