import { useId, useRef } from "react";

/** Ảnh bìa blog — preview lớn + nút chọn file (ẩn input native). */
export function BlogCoverField({
  lang = "VN",
  previewUrl = "",
  hasExisting = false,
  hasNewFile = false,
  fileName = "",
  altText = "",
  onAltChange,
  onFileChange,
  onClearNewFile,
  disabled = false,
  errorText = "",
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const isVn = lang === "VN";

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleClear = () => {
    if (inputRef.current) inputRef.current.value = "";
    onClearNewFile?.();
  };

  let statusLabel = "";
  if (hasNewFile) statusLabel = isVn ? "Ảnh mới · chưa lưu" : "New · unsaved";
  else if (hasExisting) statusLabel = isVn ? "Đang dùng" : "Current";

  let hintText = isVn
    ? "Bắt buộc khi xuất bản"
    : "Required to publish";
  if (hasNewFile) {
    hintText = isVn
      ? `Sẽ thay ảnh khi lưu · ${fileName || "file đã chọn"}`
      : `Replaces cover on save · ${fileName || "selected file"}`;
  } else if (hasExisting) {
    hintText = isVn
      ? "Giữ ảnh hiện tại nếu không chọn file mới. JPEG / PNG / WebP, tối đa 5 MB."
      : "Keep current cover unless you pick a new file. JPEG / PNG / WebP, max 5 MB.";
  }

  const actionLabel = previewUrl
    ? (isVn ? "Đổi ảnh" : "Replace")
    : (isVn ? "Chọn ảnh" : "Choose image");

  return (
    <div className="space-y-4">
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled}
        onChange={onFileChange}
      />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,17rem)_1fr] sm:items-stretch">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
          <div className="aspect-16/10 w-full">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={altText || (isVn ? "Ảnh bìa" : "Cover")}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.opacity = "0.3";
                }}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600">
                  add_photo_alternate
                </span>
                <p className="text-[11px] font-bold text-slate-400">
                  {isVn ? "Chưa có ảnh bìa" : "No cover yet"}
                </p>
              </div>
            )}
          </div>

          {statusLabel ? (
            <span
              className={`absolute left-2.5 top-2.5 rounded-lg px-2 py-0.5 text-[9px] font-headline font-black uppercase tracking-wider ${
                hasNewFile
                  ? "bg-amber-400 text-amber-950"
                  : "bg-white/90 text-[#124757] dark:bg-slate-900/90 dark:text-yellow-400"
              }`}
            >
              {statusLabel}
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-3">
          <div>
            <p className="font-headline text-sm font-black text-[#124757] dark:text-white">
              {isVn ? "Ảnh bìa bài viết" : "Post cover"}
            </p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              {hintText}
            </p>
            {errorText ? (
              <p className="mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">{errorText}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#124757] px-3.5 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-white transition hover:bg-[#0e3a47] disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300"
            >
              <span className="material-symbols-outlined text-[16px]">
                {previewUrl ? "sync" : "upload"}
              </span>
              {actionLabel}
            </button>

            {hasNewFile ? (
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                {isVn ? "Huỷ" : "Undo"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <label
          htmlFor={`${inputId}-alt`}
          className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
        >
          {isVn ? "Mô tả ảnh" : "Image description"}
        </label>
        <input
          id={`${inputId}-alt`}
          type="text"
          value={altText}
          disabled={disabled}
          onChange={(e) => onAltChange?.(e.target.value)}
          placeholder={isVn ? "VD: Tàu waterbus trên sông Sài Gòn" : "e.g. Waterbus on the Saigon river"}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800 outline-none transition-all focus:ring-2 focus:ring-[#124757] disabled:opacity-50 dark:border-slate-700/60 dark:bg-slate-900 dark:text-white dark:focus:ring-yellow-400"
        />
      </div>
    </div>
  );
}
