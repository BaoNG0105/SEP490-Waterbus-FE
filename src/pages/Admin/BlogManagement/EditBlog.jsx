import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import {
    fetchBlogPostManagementDetail,
    modifyBlogPost,
    BLOG_CATEGORY,
    BLOG_STATUS,
} from "../../../services/blogService";
import { isAdminUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";

const DEFAULT_BLOG_IMAGE = "https://res.cloudinary.com/dygipvoal/image/upload/v1776077167/vbxeolfuttvnbyql60ct.jpg";

export function EditBlog() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const { user: currentUser } = useSelector((state) => state.auth);
    const canPublish = isAdminUser(currentUser);

    const [isLoading, setIsLoading] = useState(true);
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

    const applyBlogData = (blog) => {
        setFormData({
            title: blog.title || "",
            slug: blog.slug || "",
            summary: blog.summary || "",
            category: blog.category || BLOG_CATEGORY.NEWS,
            imageUrl: blog.imageUrl || "",
            imageAltText: blog.imageAltText || "",
            content: blog.content || "",
            status: blog.status || BLOG_STATUS.DRAFT,
        });
    };

    useEffect(() => {
        const getBlogRecord = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");

                const preloaded = location.state?.blog;
                if (preloaded && String(preloaded.id) === String(id) && preloaded.content !== undefined) {
                    applyBlogData(preloaded);
                    setIsLoading(false);
                    return;
                }

                const found = await fetchBlogPostManagementDetail(id);
                if (!found) {
                    notify({
                        icon: "error",
                        title: lang === "VN" ? "Không tìm thấy bài viết!" : "Post Not Found!",
                        text: lang === "VN" ? "Bài viết không tồn tại. Quay về danh sách." : "The requested post does not exist.",
                        confirmButtonColor: "#124757",
                        allowOutsideClick: false,
                    }).then(() => navigate("/admin/news"));
                    return;
                }
                applyBlogData(found);
            } catch (error) {
                console.error("Lỗi khi tải chi tiết blog:", error);
                setErrorMsg(lang === "VN" ? "Không thể lấy thông tin bài viết do lỗi kết nối mạng." : "Failed to retrieve post details.");
            } finally {
                setIsLoading(false);
            }
        };
        getBlogRecord();
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

            const nextStatus = canPublish ? formData.status : formData.status === BLOG_STATUS.PUBLISHED || formData.status === BLOG_STATUS.ARCHIVED
                ? formData.status
                : BLOG_STATUS.DRAFT;

            if (nextStatus === BLOG_STATUS.PUBLISHED && !formData.imageUrl.trim()) {
                setErrorMsg(lang === "VN" ? "Bài viết Published bắt buộc phải có ảnh bìa (Image URL)." : "Published posts must have a cover image (Image URL).");
                setIsSubmitting(false);
                return;
            }

            const payload = {
                title: formData.title.trim(),
                slug: formData.slug.trim() || undefined,
                summary: formData.summary.trim(),
                category: formData.category,
                imageUrl: formData.imageUrl.trim(),
                imageAltText: formData.imageAltText.trim(),
                content: formData.content,
                status: nextStatus,
            };

            await modifyBlogPost(id, payload);

            notify({
                icon: "success",
                title: lang === "VN" ? "Cập nhật thành công!" : "Successfully Saved!",
                text: lang === "VN" ? "Thông tin bài viết đã được lưu." : "Post details updated successfully.",
                confirmButtonColor: "#124757",
            }).then(() => navigate("/admin/news"));
        } catch (error) {
            console.error("Lỗi cập nhật blog:", error);
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
                    onClick={() => navigate("/admin/news")}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div className="min-w-0">
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide truncate">
                        {lang === "VN" ? `Chỉnh sửa bài viết: ${formData.title}` : `Edit Post: ${formData.title}`}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Cập nhật nội dung, ảnh bìa và trạng thái xuất bản của bài viết." : "Update the post content, cover image and publish status."}
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
                            value={formData.title}
                            onChange={(e) => handleFieldChange("title", e.target.value)}
                            className={inputStyle}
                        />
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Đường dẫn (Slug)" : "Slug"}</label>
                        <input
                            type="text"
                            value={formData.slug}
                            onChange={(e) => handleFieldChange("slug", e.target.value)}
                            className={inputStyle}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">{lang === "VN" ? "Để trống nếu muốn hệ thống tự sinh lại từ tiêu đề." : "Leave blank to let the system regenerate it from the title."}</p>
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Tóm tắt" : "Summary"}</label>
                        <textarea
                            rows={2}
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
                    {canPublish ? (
                        <>
                            <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                                {[
                                    { value: BLOG_STATUS.DRAFT, vn: "Nháp", en: "Draft" },
                                    { value: BLOG_STATUS.PUBLISHED, vn: "Xuất bản", en: "Published" },
                                    { value: BLOG_STATUS.ARCHIVED, vn: "Lưu trữ", en: "Archived" },
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
                                    {lang === "VN" ? "Bài viết Published bắt buộc phải có ảnh bìa." : "Published posts must have a cover image."}
                                </p>
                            )}
                        </>
                    ) : (
                        <div className={`${inputStyle} flex flex-col justify-center gap-1`}>
                            <span className="font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                                {formData.status === BLOG_STATUS.DRAFT
                                    ? lang === "VN"
                                        ? "Nháp"
                                        : "Draft"
                                    : formData.status}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                                {lang === "VN"
                                    ? "Không đổi được trạng thái — chỉ Admin xuất bản / lưu trữ."
                                    : "Status is locked — only Admin can publish / archive."}
                            </span>
                        </div>
                    )}
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
