import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import {
    addBlogPost,
    buildBlogMultipartPayload,
    BLOG_CATEGORY,
    BLOG_STATUS,
} from "../../../services/blogService";
import { isAdminUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";
import { RichTextEditor } from "../../../components/RichTextEditor";

export function CreateBlog() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const { user: currentUser } = useSelector((state) => state.auth);
    const canManage = isAdminUser(currentUser);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [imageFiles, setImageFiles] = useState([]);

    const [formData, setFormData] = useState({
        title: "",
        summary: "",
        category: BLOG_CATEGORY.NEWS,
        imageAltText: "",
        content: "",
    });

    const coverPreview = useMemo(() => {
        if (imageFiles[0]) return URL.createObjectURL(imageFiles[0]);
        return "";
    }, [imageFiles]);

    useEffect(() => {
        if (!coverPreview) return undefined;
        return () => URL.revokeObjectURL(coverPreview);
    }, [coverPreview]);

    if (!canManage) {
        return <Navigate to="/admin" replace />;
    }

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
        const status = e.nativeEvent.submitter?.value || BLOG_STATUS.DRAFT;
        try {
            setIsSubmitting(true);
            setErrorMsg("");

            if (status === BLOG_STATUS.PUBLISHED && imageFiles.length === 0) {
                setErrorMsg(
                    lang === "VN"
                        ? "Bài viết xuất bản bắt buộc phải có ảnh bìa."
                        : "Published posts must have at least one cover image.",
                );
                setIsSubmitting(false);
                return;
            }

            const payload = buildBlogMultipartPayload({
                title: formData.title,
                summary: formData.summary,
                content: formData.content,
                category: formData.category,
                status,
                imageAltText: formData.imageAltText,
                imageFiles,
            });

            await addBlogPost(payload);

            notify({
                icon: "success",
                title: lang === "VN" ? "Tạo bài viết thành công!" : "Post Created Successfully!",
                text: lang === "VN"
                    ? "Bài viết mới đã được thêm vào hệ thống."
                    : "New blog post has been added to the system.",
                confirmButtonColor: "#124757",
            }).then(() => navigate("/admin/news"));
        } catch (error) {
            console.error("Lỗi tạo blog:", error);
            let validationError = "";
            if (error.response?.data?.errors) {
                validationError = Object.values(error.response.data.errors).flat().join(" | ");
            }
            const forbidden = error.response?.status === 403;
            setErrorMsg(
                forbidden
                    ? (lang === "VN" ? "Chỉ Admin được tạo bài viết." : "Only Admin can create posts.")
                    : (validationError || error.response?.data?.message || (lang === "VN" ? "Tạo bài viết thất bại." : "Failed to create post.")),
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
    const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all disabled:opacity-50";

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
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Viết bài mới" : "New Blog Post"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN"
                            ? "Soạn thảo và đăng bài viết mới cho hệ thống"
                            : "Compose and publish a new blog post for the system"}
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
                        <label className={labelStyle}>{lang === "VN" ? "Tóm tắt" : "Summary"}</label>
                        <textarea
                            rows={5}
                            placeholder={lang === "VN" ? "Đoạn tóm tắt ngắn hiển thị ở danh sách bài viết..." : "Short summary shown on the post listing..."}
                            value={formData.summary}
                            onChange={(e) => handleFieldChange("summary", e.target.value)}
                            className={`${inputStyle} min-h-28 resize-y`}
                        />
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Chuyên mục" : "Category"}</label>
                        <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                            {[
                                { value: BLOG_CATEGORY.NEWS, vn: "Tin tức", en: "News" },
                                { value: BLOG_CATEGORY.EVENT, vn: "Sự kiện", en: "Event" },
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
                        <div className="w-full sm:w-40 aspect-video rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                            {coverPreview ? (
                                <img
                                    src={coverPreview}
                                    alt={formData.imageAltText || "preview"}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">image</span>
                            )}
                        </div>
                        <div className="flex-1 w-full space-y-3">
                            <label className={labelStyle}>
                                {lang === "VN" ? "Chọn ảnh (bắt buộc nếu xuất bản)" : "Select images (required to publish)"}
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
                                            ? `Đã chọn ${imageFiles.length} ảnh`
                                            : `${imageFiles.length} image(s) selected`}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={clearImageFiles}
                                        className="text-[10px] font-headline font-black uppercase tracking-wider text-rose-500"
                                    >
                                        {lang === "VN" ? "Xóa ảnh đã chọn" : "Clear selected"}
                                    </button>
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-400 font-bold">
                                    {lang === "VN"
                                        ? "Upload file ảnh (multipart). Không dán URL."
                                        : "Upload image files (multipart). Do not paste URLs."}
                                </p>
                            )}
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
                        <label className={labelStyle}>{lang === "VN" ? "Nội dung bài viết" : "Article content"}</label>
                        <RichTextEditor
                            value={formData.content}
                            onChange={(html) => handleFieldChange("content", html)}
                            placeholder={lang === "VN" ? "Nhập nội dung bài viết..." : "Enter article content..."}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="submit"
                        name="status"
                        value={BLOG_STATUS.DRAFT}
                        disabled={isSubmitting}
                        className="w-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                        {lang === "VN" ? "Lưu bản nháp" : "Save as Draft"}
                    </button>
                    <button
                        type="submit"
                        name="status"
                        value={BLOG_STATUS.PUBLISHED}
                        disabled={isSubmitting}
                        className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                        {lang === "VN" ? "Xuất bản" : "Publish"}
                    </button>
                </div>
            </form>
        </div>
    );
}
