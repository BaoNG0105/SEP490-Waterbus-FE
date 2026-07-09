import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useApp } from "../../../context/AppContext";
import { addBlogPost, BLOG_CATEGORY, BLOG_STATUS } from "../../../services/blogService";

const DEFAULT_BLOG_IMAGE = "https://res.cloudinary.com/dygipvoal/image/upload/v1776077167/vbxeolfuttvnbyql60ct.jpg";

const slugify = (value) =>
    (value || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

export function CreateBlog() {
    const { lang } = useApp();
    const navigate = useNavigate();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const [formData, setFormData] = useState({
        title: "",
        slug: "",
        summary: "",
        category: BLOG_CATEGORY.NEWS,
        imageUrl: "",
        imageAltText: "",
        content: "",
        status: BLOG_STATUS.DRAFT,
    });

    const handleFieldChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            setErrorMsg("");

            if (formData.status === BLOG_STATUS.PUBLISHED && !formData.imageUrl.trim()) {
                setErrorMsg(lang === "VN" ? "Bài viết Published bắt buộc phải có ảnh bìa (Image URL)." : "Published posts must have a cover image (Image URL).");
                setIsSubmitting(false);
                return;
            }

            const payload = {
                title: formData.title.trim(),
                slug: formData.slug.trim() ? slugify(formData.slug) : undefined,
                summary: formData.summary.trim(),
                category: formData.category,
                imageUrl: formData.imageUrl.trim(),
                imageAltText: formData.imageAltText.trim(),
                content: formData.content,
                status: formData.status,
            };

            await addBlogPost(payload);

            Swal.fire({
                icon: "success",
                title: lang === "VN" ? "Tạo bài viết thành công!" : "Post Created Successfully!",
                text: lang === "VN" ? "Bài viết mới đã được thêm vào hệ thống." : "New blog post has been added to the system.",
                confirmButtonColor: "#124757",
            }).then(() => navigate("/admin/news"));
        } catch (error) {
            console.error("Lỗi tạo blog:", error);
            let validationError = "";
            if (error.response?.data?.errors) {
                validationError = Object.values(error.response.data.errors).flat().join(" | ");
            }
            setErrorMsg(validationError || error.response?.data?.message || (lang === "VN" ? "Tạo bài viết thất bại." : "Failed to create post."));
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
                    onClick={() => navigate("/admin/news")}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Viết bài mới" : "New Blog Post"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Nhập nội dung bài viết, chuyên mục và trạng thái xuất bản." : "Enter the post content, category and publish status."}
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

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Tiêu đề (*)" : "Title (*)"}</label>
                        <input
                            type="text"
                            required
                            placeholder={lang === "VN" ? "VD: Khám phá Sài Gòn bằng Waterbus" : "e.g. Discover Saigon by Waterbus"}
                            value={formData.title}
                            onChange={(e) => handleFieldChange("title", e.target.value)}
                            className={inputStyle}
                        />
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Đường dẫn (Slug)" : "Slug"}</label>
                        <input
                            type="text"
                            placeholder="kham-pha-sai-gon-bang-waterbus"
                            value={formData.slug}
                            onChange={(e) => handleFieldChange("slug", e.target.value)}
                            className={inputStyle}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">{lang === "VN" ? "Để trống nếu muốn hệ thống tự sinh từ tiêu đề." : "Leave blank to auto-generate from the title."}</p>
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Tóm tắt" : "Summary"}</label>
                        <textarea
                            rows={2}
                            placeholder={lang === "VN" ? "Đoạn tóm tắt ngắn hiển thị ở danh sách bài viết..." : "Short summary shown on the post listing..."}
                            value={formData.summary}
                            onChange={(e) => handleFieldChange("summary", e.target.value)}
                            className={`${inputStyle} resize-none`}
                        />
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Chuyên mục" : "Category"}</label>
                        <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                            {[
                                { value: BLOG_CATEGORY.NEWS, vn: "Tin tức", en: "News" },
                                { value: BLOG_CATEGORY.EVENT, vn: "Sự kiện", en: "Event" },
                                { value: BLOG_CATEGORY.ACTIVITY, vn: "Hoạt động", en: "Activity" },
                            ].map((option) => {
                                const selected = formData.category === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleFieldChange("category", option.value)}
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

                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                    <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
                        {lang === "VN" ? "Ảnh bìa" : "Cover Image"}
                    </h3>

                    <div className="flex flex-col sm:flex-row gap-5 items-start">
                        <div className="w-full sm:w-40 aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0">
                            <img
                                src={formData.imageUrl || DEFAULT_BLOG_IMAGE}
                                alt={formData.imageAltText || "preview"}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.src = DEFAULT_BLOG_IMAGE; }}
                            />
                        </div>
                        <div className="flex-1 w-full space-y-4">
                            <div>
                                <label className={labelStyle}>{lang === "VN" ? `Image URL ${formData.status === BLOG_STATUS.PUBLISHED ? "(*)" : ""}` : `Image URL ${formData.status === BLOG_STATUS.PUBLISHED ? "(*)" : ""}`}</label>
                                <input
                                    type="text"
                                    placeholder="https://res.cloudinary.com/.../blog-cover.webp"
                                    value={formData.imageUrl}
                                    onChange={(e) => handleFieldChange("imageUrl", e.target.value)}
                                    className={inputStyle}
                                />
                            </div>
                            <div>
                                <label className={labelStyle}>{lang === "VN" ? "Mô tả ảnh (Alt Text)" : "Image Alt Text"}</label>
                                <input
                                    type="text"
                                    placeholder={lang === "VN" ? "VD: Tàu waterbus trên sông Sài Gòn" : "e.g. Waterbus boat on the Saigon river"}
                                    value={formData.imageAltText}
                                    onChange={(e) => handleFieldChange("imageAltText", e.target.value)}
                                    className={inputStyle}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                    <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
                        {lang === "VN" ? "Nội dung bài viết" : "Post Content"}
                    </h3>
                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Nội dung (HTML)" : "Content (HTML)"}</label>
                        <textarea
                            rows={12}
                            placeholder={lang === "VN" ? "Nhập nội dung bài viết (hỗ trợ thẻ HTML cơ bản)..." : "Enter post content (supports basic HTML tags)..."}
                            value={formData.content}
                            onChange={(e) => handleFieldChange("content", e.target.value)}
                            className={`${inputStyle} font-mono text-[11px] leading-relaxed`}
                        />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                    <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
                        {lang === "VN" ? "Trạng thái" : "Status"}
                    </h3>
                    <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                        {[
                            { value: BLOG_STATUS.DRAFT, vn: "Lưu nháp", en: "Save as Draft" },
                            { value: BLOG_STATUS.PUBLISHED, vn: "Xuất bản ngay", en: "Publish Now" },
                        ].map((option) => {
                            const selected = formData.status === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => handleFieldChange("status", option.value)}
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
                    {formData.status === BLOG_STATUS.PUBLISHED && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                            {lang === "VN" ? "Bài viết xuất bản ngay bắt buộc phải có ảnh bìa." : "Posts published immediately must have a cover image."}
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                    {isSubmitting && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                    {lang === "VN" ? "Tạo bài viết" : "Create Post"}
                </button>
            </form>
        </div>
    );
}
