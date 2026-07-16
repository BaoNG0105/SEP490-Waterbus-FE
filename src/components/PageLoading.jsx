/**
 * Spinner tải trang / overlay làm mới — dùng khi load chậm để tránh hiện chữ trạng thái nửa mùa.
 */
export function PageLoading({
  lang = "VN",
  message,
  fullscreen = false,
  overlay = false,
  fixed = false,
  className = "",
}) {
  const text = message
    || (lang === "VN" ? "Đang tải..." : "Loading...");

  const body = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757] dark:border-slate-600 dark:border-t-yellow-400" />
      <p className="text-xs font-headline font-black uppercase tracking-wider text-slate-400">
        {text}
      </p>
    </div>
  );

  if (overlay) {
    return (
      <div
        className={`${fixed ? "fixed" : "absolute"} inset-0 z-[80] flex items-center justify-center bg-white/70 backdrop-blur-[1px] dark:bg-slate-900/70`}
      >
        {body}
      </div>
    );
  }

  if (fullscreen) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        {body}
      </div>
    );
  }

  return body;
}
