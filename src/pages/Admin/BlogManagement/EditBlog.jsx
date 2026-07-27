import { useState, useEffect, useMemo } from "react";
import { Navigate, useParams, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import {
    fetchBlogPostManagementDetail,
    modifyBlogPost,
    buildBlogMultipartPayload,
    collectBlogImageUrls,
    getBlogEditableContent,
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
    const canManage = isAdminUser(currentUser);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [existingImageUrls, setExistingImageUrls] = useState([]);
    const [imageFiles, setImageFiles] = useState([]);

    const [formData, setFormData] = useState({
        title: "",
        summary: "",
        category: BLOG_CATEGORY.NEWS,
        imageAltText: "",
        content: "",
        status: BLOG_STATUS.DRAFT,
    });

    const applyBlogData = (blog) => {
        const urls = collectBlogImageUrls(blog);
        setExistingImageUrls(urls);
        setFormData({
            title: blog.title || "",
            summary: blog.summary || "",
            category: blog.category || BLOG_CATEGORY.NEWS,
            imageAltText: blog.imageAltText || "",
            content: getBlogEditableContent(blog),
            status: blog.status || BLOG_STATUS.DRAFT,
        });
    };

    useEffect(() => {
        const getBlogRecord = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");

                // List management thường không kèm body — luôn gọi detail để lấy content staff gửi.
                const preloaded = location.state?.blog;
                if (preloaded && String(preloaded.id) === String(id)) {
                    applyBlogData(preloaded);
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

    const newCoverPreview = useMemo(() => {
        if (imageFiles[0]) return URL.createObjectURL(imageFiles[0]);
        return "";
    }, [imageFiles]);

    useEffect(() => {
        if (!newCoverPreview) return undefined;
        return () => URL.revokeObjectURL(newCoverPreview);
    }, [newCoverPreview]);

    const handleFieldChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleImageFilesChange = (e) => {
        const files = Array.from(e.target.files || []).filter(Boolean);
        setImageFiles(files);
        e.target.value = "";
    };

    const clearImageFiles = () => setImageFiles([]);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            setErrorMsg("");

            const nextStatus = formData.status;

            const hasCover = imageFiles.length > 0 || existingImageUrls.length > 0;
            if (nextStatus === BLOG_STATUS.PUBLISHED && !hasCover) {
                setErrorMsg(
                    lang === "VN"
                        ? "Bài viết Published bắt buộc phải có ảnh bìa."
                        : "Published posts must have at least one cover image.",
                );
                setIsSubmitting(false);
                return;
            }

            // Không chọn ảnh mới → không append images (BE giữ ảnh cũ)
            const payload = buildBlogMultipartPayload({
                title: formData.title,
                summary: formData.summary,
                content: formData.content,
                category: formData.category,
                status: nextStatus,
                imageAltText: formData.imageAltText,
                imageFiles,
            });

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

    const coverPreview = newCoverPreview || existingImageUrls[0] || "";
    const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
    const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all disabled:opacity-50";

    if (!canManage) {
        return <Navigate to="/admin" replace />;
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64 w-full">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-5xl mx-auto animate-fade-in">
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
                        {lang === "VN"
                            ? "Cập nhật nội dung (text), ảnh bìa và trạng thái. Slug do BE tự tạo từ tiêu đề."
                            : "Update plain-text content, cover images and status. Slug is generated by the backend."}
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
                        <label className={labelStyle}>{lang === "VN" ? "Tóm tắt" : "Summary"}</label>
                        <textarea
                            rows={5}
                            value={formData.summary}
                            onChange={(e) => handleFieldChange("summary", e.target.value)}
                            className={`${inputStyle} min-h-28 resize-y`}
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
                        {lang === "VN" ? "Ảnh bìa" : "Cover Images"}
                    </h3>

                    <div className="flex flex-col sm:flex-row gap-5 items-start">
                        <div className="w-full sm:w-40 aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0">
                            <img
                                src={coverPreview || DEFAULT_BLOG_IMAGE}
                                alt={formData.imageAltText || "preview"}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.src = DEFAULT_BLOG_IMAGE; }}
                            />
                        </div>
                        <div className="flex-1 w-full space-y-3">
                            {existingImageUrls.length > 0 && imageFiles.length === 0 && (
                                <div className="space-y-2">
                                    <label className={labelStyle}>
                                        {lang === "VN" ? "Ảnh hiện tại (BE giữ nếu không chọn ảnh mới)" : "Current images (kept if no new files)"}
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {existingImageUrls.map((url) => (
                                            <div
                                                key={url}
                                                className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900"
                                            >
                                                <img
                                                    src={url}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => { e.target.src = DEFAULT_BLOG_IMAGE; }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <label className={labelStyle}>
                                {lang === "VN" ? "Chọn ảnh mới (tuỳ chọn)" : "Select new images (optional)"}
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleImageFilesChange}
                                className={`${inputStyle} file:mr-3 file:rounded-lg file:border-0 file:bg-[#124757] file:px-3 file:py-1.5 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:text-white dark:file:bg-yellow-400 dark:file:text-slate-900`}
                            />
                            {imageFiles.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-[11px] font-semibold text-slate-500">
                                        {lang === "VN"
                                            ? `Sẽ thay bằng ${imageFiles.length} ảnh mới`
                                            : `Will replace with ${imageFiles.length} new image(s)`}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={clearImageFiles}
                                        className="text-[10px] font-headline font-black uppercase tracking-wider text-rose-500"
                                    >
                                        {lang === "VN" ? "Huỷ chọn ảnh mới" : "Cancel new selection"}
                                    </button>
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-400 font-bold">
                                    {lang === "VN"
                                        ? "Không chọn ảnh mới → BE giữ ảnh cũ. Không gửi imageUrl."
                                        : "No new files → BE keeps existing images. Do not send imageUrl."}
                                </p>
                            )}
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
                        <label className={labelStyle}>{lang === "VN" ? "Nội dung bài viết" : "Article content"}</label>
                        <textarea
                            rows={12}
                            placeholder={lang === "VN" ? "Nhập nội dung dạng văn bản thường (không HTML)..." : "Enter plain text content (not HTML)..."}
                            value={formData.content}
                            onChange={(e) => handleFieldChange("content", e.target.value)}
                            className={`${inputStyle} leading-relaxed`}
                        />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                    <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
                        {lang === "VN" ? "Trạng thái" : "Status"}
                    </h3>
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
                            {lang === "VN" ? "Bài viết Published bắt buộc phải có ít nhất 1 ảnh bìa." : "Published posts must have at least one cover image."}
                        </p>
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
