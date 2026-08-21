import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import {
    addBlogPost,
    buildBlogWritePayload,
    BLOG_CATEGORY,
    BLOG_STATUS,
} from "../../../services/blogService";
import { isAdminUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";
import { BlogFormFields } from "./BlogFormFields";

/** Rich text rỗng khi không còn ký tự sau khi bóc hết thẻ HTML (VD "<p><br></p>"). */
const isContentBlank = (html) => String(html || "").replace(/<[^>]*>/g, "").trim() === "";

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

    // Validate real-time field bắt buộc (*) — lỗi chỉ hiện cho field đã "touched" (rời khỏi ít
    // nhất 1 lần), nhưng nút Lưu/Xuất bản bị khóa ngay khi còn field lỗi dù chưa touched hết.
    const [touchedFields, setTouchedFields] = useState({});
    const handleFieldBlur = (field) => {
        setTouchedFields((prev) => ({ ...prev, [field]: true }));
    };
    const fieldErrors = {
        ...(formData.title.trim() ? {} : {
            title: lang === "VN" ? "Vui lòng nhập tiêu đề" : "Title is required",
        }),
        ...(isContentBlank(formData.content) ? {
            content: lang === "VN" ? "Vui lòng nhập nội dung bài viết" : "Article content is required",
        } : {}),
    };
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    const visibleFieldErrors = {
        ...(touchedFields.title ? { title: fieldErrors.title } : {}),
        ...(touchedFields.content ? { content: fieldErrors.content } : {}),
    };

    // Ảnh bìa chỉ bắt buộc khi Xuất bản (bản nháp không cần) — hiện lỗi ngay tại field, không
    // chờ "touched", để người dùng biết vì sao nút Xuất bản đang bị khóa.
    const coverError = imageFiles.length === 0
        ? (lang === "VN" ? "Bắt buộc phải có ảnh bìa để xuất bản" : "A cover image is required to publish")
        : "";
    const formFieldErrors = { ...visibleFieldErrors, cover: coverError };
    const hasPublishBlockingErrors = hasFieldErrors || Boolean(coverError);

    if (!canManage) {
        return <Navigate to="/admin" replace />;
    }

    const handleFieldChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleImageFilesChange = (e) => {
        const file = e.target.files?.[0];
        setImageFiles(file ? [file] : []);
    };

    const clearImageFiles = () => setImageFiles([]);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const status = e.nativeEvent.submitter?.value || BLOG_STATUS.DRAFT;
        // Bấm submit khi còn field lỗi (VD: nhấn Enter) → hiện hết lỗi lên thay vì âm thầm chặn.
        setTouchedFields({ title: true, content: true });
        if (hasFieldErrors) return;
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

            const payload = buildBlogWritePayload({
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

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-6xl mx-auto animate-fade-in">
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
                <BlogFormFields
                    lang={lang}
                    formData={formData}
                    onChange={handleFieldChange}
                    imageFiles={imageFiles}
                    coverPreview={coverPreview}
                    onFileChange={handleImageFilesChange}
                    onClearNewFile={clearImageFiles}
                    disabled={isSubmitting}
                    errors={formFieldErrors}
                    onFieldBlur={handleFieldBlur}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="submit"
                        name="status"
                        value={BLOG_STATUS.DRAFT}
                        disabled={isSubmitting || hasFieldErrors}
                        className="w-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                        {lang === "VN" ? "Lưu bản nháp" : "Save as Draft"}
                    </button>
                    <button
                        type="submit"
                        name="status"
                        value={BLOG_STATUS.PUBLISHED}
                        disabled={isSubmitting || hasPublishBlockingErrors}
                        title={coverError || undefined}
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
