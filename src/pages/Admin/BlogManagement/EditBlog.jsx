import { useState, useEffect, useMemo } from "react";
import { Navigate, useParams, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import {
    fetchBlogPostManagementDetail,
    modifyBlogPost,
    buildBlogWritePayload,
    collectBlogImageUrls,
    BLOG_CATEGORY,
    BLOG_STATUS,
} from "../../../services/blogService";
import { isAdminUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";
import { BlogFormFields } from "./BlogFormFields";

/** Rich text rỗng khi không còn ký tự sau khi bóc hết thẻ HTML (VD "<p><br></p>"). */
const isContentBlank = (html) => String(html || "").replace(/<[^>]*>/g, "").trim() === "";

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
    });

    const applyBlogData = (blog) => {
        const urls = collectBlogImageUrls(blog);
        setExistingImageUrls(urls);
        setFormData({
            title: blog.title || "",
            summary: blog.summary || "",
            category: blog.category || BLOG_CATEGORY.NEWS,
            imageAltText: blog.imageAltText || "",
            content: blog.contentHtml || blog.content || "",
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
    const coverError = (imageFiles.length === 0 && existingImageUrls.length === 0)
        ? (lang === "VN" ? "Bắt buộc phải có ảnh bìa để xuất bản" : "A cover image is required to publish")
        : "";
    const formFieldErrors = { ...visibleFieldErrors, cover: coverError };
    const hasPublishBlockingErrors = hasFieldErrors || Boolean(coverError);

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
        const nextStatus = e.nativeEvent.submitter?.value || BLOG_STATUS.DRAFT;
        // Bấm submit khi còn field lỗi (VD: nhấn Enter) → hiện hết lỗi lên thay vì âm thầm chặn.
        setTouchedFields({ title: true, content: true });
        if (hasFieldErrors) return;
        try {
            setIsSubmitting(true);
            setErrorMsg("");

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

            // Có ảnh mới → multipart; không → JSON (không gửi imageUrl — BE giữ ảnh cũ).
            const payload = buildBlogWritePayload({
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
            const status = error.response?.status;
            const beMessage = error.response?.data?.message
                || (error.response?.data?.errors
                    ? Object.values(error.response.data.errors).flat().join(" | ")
                    : "");
            setErrorMsg(
                beMessage
                || (status === 415
                    ? (lang === "VN"
                        ? "Kiểu gửi không đúng (415). Thử refresh rồi lưu lại."
                        : "Unsupported media type (415). Refresh and retry.")
                    : (lang === "VN" ? "Gặp lỗi trong quá trình lưu thông tin." : "Failed to save changes.")),
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const coverPreview = newCoverPreview || existingImageUrls[0] || "";

    if (!canManage) {
        return <Navigate to="/admin/reports/revenue" replace />;
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64 w-full">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
        );
    }

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
                <div className="min-w-0">
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide truncate">
                        {lang === "VN" ? `Chỉnh sửa bài viết: ${formData.title}` : `Edit Post: ${formData.title}`}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN"
                            ? "Cập nhật nội dung, ảnh bìa và trạng thái cho bài viết"
                            : "Update content, cover images and status for the post"}
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
                    existingImageUrls={existingImageUrls}
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
                        className="w-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
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
