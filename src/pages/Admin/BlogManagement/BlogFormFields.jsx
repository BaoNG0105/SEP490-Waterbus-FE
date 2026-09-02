import { BLOG_CATEGORY } from "../../../services/blogService";
import { RichTextEditor } from "../../../components/RichTextEditor";
import { BlogCoverField } from "../../../components/BlogCoverField";
import { required } from "../../../utils/required";

const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all disabled:opacity-50";
const errorInputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-rose-500 dark:border-rose-500 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 shadow-inner transition-all disabled:opacity-50";
const errorTextStyle = "mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400";

/**
 * Khối field dùng chung cho CreateBlog / EditBlog.
 * Bố cục: hàng 1 = Thông tin cơ bản + Ảnh bìa (cạnh nhau), hàng 2 = Nội dung bài viết.
 *
 * `errors`: { [field]: message } — chỉ hiện khi field tương ứng đã "touched" (do trang cha
 * quyết định, thường sau onBlur hoặc sau lần bấm submit đầu tiên).
 * `onFieldBlur`: (field) => void — báo trang cha field vừa rời khỏi.
 */
export function BlogFormFields({
    lang,
    formData,
    onChange,
    imageFiles,
    coverPreview,
    existingImageUrls = [],
    onFileChange,
    onClearNewFile,
    disabled = false,
    errors = {},
    onFieldBlur,
}) {
    const setField = (field, value) => onChange(field, value);
    const handleBlur = (field) => onFieldBlur?.(field);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                    <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
                        {lang === "VN" ? "Thông tin cơ bản" : "Basic Information"}
                    </h3>

                    <div>
                        <label className={labelStyle}>{<>{lang === "VN" ? "Tiêu đề" : "Title"}{required()}</>}</label>
                        <input
                            type="text"
                            required
                            placeholder={lang === "VN" ? "VD: Khám phá Sài Gòn bằng Waterbus" : "e.g. Discover Saigon by Waterbus"}
                            value={formData.title}
                            onChange={(e) => setField("title", e.target.value)}
                            onBlur={() => handleBlur("title")}
                            className={errors.title ? errorInputStyle : inputStyle}
                        />
                        {errors.title && <p className={errorTextStyle}>{errors.title}</p>}
                    </div>

                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Tóm tắt" : "Summary"}</label>
                        <textarea
                            rows={5}
                            placeholder={lang === "VN" ? "Đoạn tóm tắt ngắn hiển thị ở danh sách bài viết..." : "Short summary shown on the post listing..."}
                            value={formData.summary}
                            onChange={(e) => setField("summary", e.target.value)}
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
                                        onClick={() => setField("category", option.value)}
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
                        {lang === "VN" ? "Ảnh bìa" : "Cover"}
                    </h3>

                    <BlogCoverField
                        lang={lang}
                        previewUrl={coverPreview}
                        hasExisting={existingImageUrls.length > 0}
                        hasNewFile={imageFiles.length > 0}
                        fileName={imageFiles[0]?.name || ""}
                        altText={formData.imageAltText}
                        onAltChange={(value) => setField("imageAltText", value)}
                        onFileChange={onFileChange}
                        onClearNewFile={onClearNewFile}
                        disabled={disabled}
                        errorText={errors.cover}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
                <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-3 mb-2">
                    {lang === "VN" ? "Nội dung bài viết" : "Post Content"}
                </h3>
                <div onBlur={() => handleBlur("content")}>
                    <label className={labelStyle}>{<>{lang === "VN" ? "Nội dung bài viết" : "Article content"}{required()}</>}</label>
                    <RichTextEditor
                        value={formData.content}
                        onChange={(html) => setField("content", html)}
                        placeholder={lang === "VN" ? "Nhập nội dung bài viết..." : "Enter article content..."}
                        className={errors.content ? "[&>div:last-child>div:last-child]:border-rose-500 dark:[&>div:last-child>div:last-child]:border-rose-500" : ""}
                    />
                    {errors.content && <p className={errorTextStyle}>{errors.content}</p>}
                </div>
            </div>
        </div>
    );
}