import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { FormSelect } from "../../../components/FormSelect";
import { useApp } from "../../../context/AppContext";
import { isAdminUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";
import {
  extractAssistantPromptError,
  fetchAssistantPrompt,
  formatDateTime,
  getMissingPlaceholders,
  labelPreviewStatus,
  labelPromptSource,
  parseVersionId,
  PREVIEW_STATUS,
  PROMPT_SOURCE,
  resetAssistantPromptToDefault,
  restoreAssistantPromptVersion,
  runAssistantPromptPreview,
  saveAssistantPrompt,
  validatePromptContentLocally,
} from "../../../services/assistantPromptService";

const LANGUAGE_OPTIONS = [
  { value: "VN", label: "Tiếng Việt (VN)" },
  { value: "ENG", label: "English (ENG)" },
];

const PREVIEW_STATUS_STYLE = {
  [PREVIEW_STATUS.COMPLETED]: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  [PREVIEW_STATUS.PROVIDER_FAILED]: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400",
  [PREVIEW_STATUS.TOOL_LIMIT_REACHED]: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function AssistantPromptManagement() {
  const { lang } = useApp();
  const { user: currentUser } = useSelector((state) => state.auth);
  const canManage = isAdminUser(currentUser);

  const [promptState, setPromptState] = useState(null);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [showLockedRules, setShowLockedRules] = useState(false);
  const [showVersions, setShowVersions] = useState(true);

  const [previewQuestion, setPreviewQuestion] = useState("");
  const [previewLanguage, setPreviewLanguage] = useState(lang === "ENG" ? "ENG" : "VN");
  const [previewWithTools, setPreviewWithTools] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);

  const loadPrompt = async () => {
    try {
      setIsLoading(true);
      setLoadError("");
      const data = await fetchAssistantPrompt();
      setPromptState(data);
      setContent(data.content || "");
    } catch (error) {
      console.error("Failed to load assistant prompt:", error);
      const status = error?.response?.status;
      setLoadError(
        status === 403
          ? (lang === "VN" ? "Chỉ quản trị viên được quản lý system prompt." : "Only Admin can manage the system prompt.")
          : extractAssistantPromptError(error, lang === "VN" ? "Không tải được system prompt." : "Failed to load system prompt.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    loadPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  if (!canManage) {
    return <Navigate to="/admin" replace />;
  }

  const isDirty = promptState ? content !== (promptState.content || "") : false;
  const missingPlaceholders = promptState ? getMissingPlaceholders(content, promptState.placeholders) : [];
  const charCount = content.length;
  const minLength = promptState?.minLength || 0;
  const maxLength = promptState?.maxLength || 20000;
  const lengthOk = charCount >= minLength && charCount <= maxLength;

  const handleDiscard = () => {
    if (!promptState) return;
    setContent(promptState.content || "");
    setSaveError("");
  };

  const handleInsertPlaceholder = (token) => {
    setContent((prev) => (prev && !prev.endsWith("\n") ? `${prev}\n${token}` : `${prev}${token}`));
  };

  const handleSave = async () => {
    if (!promptState) return;
    const localError = validatePromptContentLocally(content, promptState, lang);
    if (localError) {
      setSaveError(localError);
      return;
    }

    const confirmResult = await notify({
      title: lang === "VN" ? "Lưu system prompt mới?" : "Save new system prompt?",
      html: lang === "VN"
        ? "Bản mới sẽ <b>có hiệu lực ngay</b> với mọi hội thoại tiếp theo của trợ lý."
        : "The new version takes <b>effect immediately</b> for every conversation from now on.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Lưu & áp dụng" : "Save & apply",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    });
    if (!confirmResult.isConfirmed) return;

    try {
      setIsSaving(true);
      setSaveError("");
      const data = await saveAssistantPrompt(content);
      setPromptState(data);
      setContent(data.content || "");
      notify({
        toast: true,
        icon: "success",
        title: lang === "VN" ? "Đã lưu prompt mới" : "Prompt saved",
        showConfirmButton: false,
        timer: 1800,
      });
    } catch (error) {
      console.error("Failed to save assistant prompt:", error);
      setSaveError(extractAssistantPromptError(error, lang === "VN" ? "Không thể lưu prompt." : "Failed to save prompt."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const confirmResult = await notify({
      title: lang === "VN" ? "Về bản gốc trong code?" : "Reset to built-in default?",
      html: lang === "VN"
        ? "Prompt đang chạy sẽ đổi thành <b>bản mặc định trong code</b>. Các bản đã lưu trước đó vẫn còn trong lịch sử để khôi phục lại."
        : "The live prompt will switch to the <b>built-in default</b>. Previous saves stay in version history so you can restore them.",
      icon: "warning",
      tone: "danger",
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Về bản gốc" : "Reset",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    });
    if (!confirmResult.isConfirmed) return;

    try {
      setIsResetting(true);
      setSaveError("");
      const data = await resetAssistantPromptToDefault();
      setPromptState(data);
      setContent(data.content || "");
      notify({
        toast: true,
        icon: "success",
        title: lang === "VN" ? "Đã về bản gốc" : "Reset to default",
        showConfirmButton: false,
        timer: 1800,
      });
    } catch (error) {
      console.error("Failed to reset assistant prompt:", error);
      notify({
        icon: "error",
        title: lang === "VN" ? "Thất bại" : "Failed",
        text: extractAssistantPromptError(error, lang === "VN" ? "Không thể reset prompt." : "Failed to reset prompt."),
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleRestore = async (version) => {
    const versionDate = parseVersionId(version.id);
    const versionLabel = formatDateTime(versionDate, lang) || version.id;

    const confirmResult = await notify({
      title: lang === "VN" ? "Khôi phục bản này?" : "Restore this version?",
      html: lang === "VN"
        ? `Prompt đang chạy sẽ được thay bằng bản lưu lúc <b>${versionLabel}</b>.`
        : `The live prompt will be replaced by the save from <b>${versionLabel}</b>.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Khôi phục" : "Restore",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    });
    if (!confirmResult.isConfirmed) return;

    try {
      setRestoringId(version.id);
      const data = await restoreAssistantPromptVersion(version.id);
      setPromptState(data);
      setContent(data.content || "");
      notify({
        toast: true,
        icon: "success",
        title: lang === "VN" ? "Đã khôi phục" : "Restored",
        showConfirmButton: false,
        timer: 1800,
      });
    } catch (error) {
      console.error("Failed to restore assistant prompt version:", error);
      notify({
        icon: "error",
        title: lang === "VN" ? "Thất bại" : "Failed",
        text: extractAssistantPromptError(error, lang === "VN" ? "Không thể khôi phục bản này." : "Failed to restore this version."),
      });
    } finally {
      setRestoringId(null);
    }
  };

  const handlePreview = async (event) => {
    event.preventDefault();
    const question = previewQuestion.trim();
    if (!question) {
      setPreviewError(lang === "VN" ? "Nhập câu hỏi khách để chạy thử." : "Enter a customer question to test.");
      return;
    }
    const localError = validatePromptContentLocally(content, promptState, lang);
    if (localError) {
      setPreviewError(localError);
      return;
    }

    try {
      setIsPreviewing(true);
      setPreviewError("");
      const result = await runAssistantPromptPreview({
        content,
        question,
        language: previewLanguage,
        withTools: previewWithTools,
      });
      setPreviewResult(result);
    } catch (error) {
      console.error("Failed to run assistant prompt preview:", error);
      setPreviewResult(null);
      const status = error?.response?.status;
      setPreviewError(
        status === 429
          ? (lang === "VN"
            ? "Vượt giới hạn kiểm thử (5 lượt / 300 giây). Đợi một chút rồi thử lại."
            : "Preview rate limit reached (5 runs / 300s). Wait a bit and try again.")
          : extractAssistantPromptError(error, lang === "VN" ? "Không thể chạy kiểm thử." : "Could not run preview.")
      );
    } finally {
      setIsPreviewing(false);
    }
  };

  if (isLoading && !promptState) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "System Prompt Trợ lý AI" : "AI Assistant System Prompt"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "Chỉnh phần hướng dẫn trợ lý dùng để trả lời khách — có hiệu lực ngay, không cần deploy."
              : "Edit the instructions the assistant uses to answer customers — takes effect immediately, no deploy needed."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={isResetting || isSaving}
          className="px-5 py-3 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-sm hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500/20 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
        >
          {isResetting ? (
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="material-symbols-outlined text-sm font-bold">restart_alt</span>
          )}
          {lang === "VN" ? "Về bản gốc" : "Reset to default"}
        </button>
      </div>

      {loadError && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {loadError}
        </div>
      )}

      {promptState && promptState.errors.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 p-4 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-500/20 space-y-1">
          <p>
            {lang === "VN"
              ? "Nội dung đang lưu bị hỏng (có thể do sửa tay trực tiếp trên máy chủ). Trợ lý đang chạy tạm bằng bản mặc định:"
              : "The saved content is corrupted (likely edited directly on the server). The assistant is temporarily running on the default prompt:"}
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {promptState.errors.map((err, idx) => (
              <li key={idx}>{String(err)}</li>
            ))}
          </ul>
        </div>
      )}

      {promptState && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              {lang === "VN" ? "Nguồn hiện tại" : "Current source"}
            </span>
            <h3 className={`text-sm font-black font-headline mt-1 ${promptState.source === PROMPT_SOURCE.FILE ? "text-[#124757] dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
              {labelPromptSource(promptState.source, lang)}
            </h3>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              {lang === "VN" ? "Cập nhật lần cuối" : "Last updated"}
            </span>
            <h3 className="text-sm font-black font-headline mt-1 text-[#124757] dark:text-white">
              {formatDateTime(promptState.updatedAt, lang) || (lang === "VN" ? "Chưa từng sửa" : "Never edited")}
            </h3>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm min-w-0">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              {lang === "VN" ? "Nơi lưu file" : "Storage location"}
            </span>
            <h3 className="text-xs font-bold font-mono mt-1 text-slate-600 dark:text-slate-300 truncate" title={promptState.storageLocation}>
              {promptState.storageLocation || "—"}
            </h3>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-5">
        <div className="space-y-5 min-w-0">
          {promptState && (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
              <h3 className="text-xs font-headline font-black text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {lang === "VN" ? "Placeholder bắt buộc" : "Required placeholders"}
              </h3>
              <div className="flex flex-wrap gap-2">
                {promptState.placeholders.map((p) => {
                  const missing = missingPlaceholders.some((m) => m.token === p.token);
                  return (
                    <div
                      key={p.token}
                      title={p.description}
                      className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl text-[11px] font-bold border ${
                        missing
                          ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/20"
                          : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{missing ? "error" : "check_circle"}</span>
                      <span className="font-mono">{p.token}</span>
                      {missing && (
                        <button
                          type="button"
                          onClick={() => handleInsertPlaceholder(p.token)}
                          className="ml-1 underline decoration-dotted hover:text-rose-800 dark:hover:text-rose-300"
                        >
                          {lang === "VN" ? "chèn" : "insert"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-headline font-black text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {lang === "VN" ? "Nội dung prompt (phần sửa được)" : "Prompt content (editable part)"}
              </h3>
              <span className={`text-[11px] font-bold ${lengthOk ? "text-slate-400" : "text-rose-500"}`}>
                {charCount.toLocaleString()} / {maxLength.toLocaleString()} {lang === "VN" ? "ký tự" : "chars"}
                {minLength > 0 ? ` (${lang === "VN" ? "tối thiểu" : "min"} ${minLength.toLocaleString()})` : ""}
              </span>
            </div>

            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (saveError) setSaveError("");
              }}
              rows={22}
              spellCheck={false}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-mono leading-relaxed text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner resize-y"
              placeholder={lang === "VN" ? "Nhập nội dung system prompt..." : "Enter the system prompt content..."}
            />

            {saveError && (
              <p className="text-xs font-bold text-rose-500 whitespace-pre-line">{saveError}</p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={!isDirty || isSaving}
                className="px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-sm hover:border-slate-400 transition-all disabled:opacity-50"
              >
                {lang === "VN" ? "Hủy thay đổi" : "Discard changes"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className="px-5 py-3 bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSaving ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-sm font-bold">save</span>
                )}
                {lang === "VN" ? "Lưu & áp dụng" : "Save & apply"}
              </button>
            </div>
          </div>

          {promptState && (
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-5 space-y-3">
              <button
                type="button"
                onClick={() => setShowLockedRules((v) => !v)}
                className="w-full flex items-center justify-between gap-2"
              >
                <h3 className="text-xs font-headline font-black text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {lang === "VN" ? "Khối luật cứng (chỉ đọc, không sửa được)" : "Locked rules (read-only, cannot be edited)"}
                </h3>
                <span className={`material-symbols-outlined text-slate-400 transition-transform ${showLockedRules ? "rotate-180" : ""}`}>
                  expand_more
                </span>
              </button>
              {showLockedRules && (
                <>
                  <p className="text-[11px] text-slate-400">
                    {lang === "VN"
                      ? "Server luôn nối khối này vào CUỐI prompt trước khi gửi cho model — phần nội dung bạn soạn ở trên không thể ghi đè lên đây."
                      : "The server always appends this block to the END of the prompt before calling the model — the content you edit above cannot override it."}
                  </p>
                  <pre className="whitespace-pre-wrap text-[11px] leading-relaxed font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 max-h-80 overflow-y-auto custom-scrollbar">
                    {promptState.lockedRules}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4 min-w-0">
          {promptState && (
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm p-5 space-y-3">
              <button
                type="button"
                onClick={() => setShowVersions((v) => !v)}
                className="w-full flex items-center justify-between gap-2"
              >
                <h3 className="text-sm font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                  {lang === "VN" ? "Lịch sử bản lưu" : "Version history"}
                </h3>
                <span className={`material-symbols-outlined text-slate-400 transition-transform ${showVersions ? "rotate-180" : ""}`}>
                  expand_more
                </span>
              </button>

              {showVersions && (
                promptState.versions.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 text-center py-4">
                    {lang === "VN" ? "Chưa có bản lưu nào." : "No saved versions yet."}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                    {promptState.versions.map((version) => {
                      const versionDate = parseVersionId(version.id);
                      return (
                        <div
                          key={version.id}
                          className="flex items-center justify-between gap-2 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                              {formatDateTime(versionDate || version.createdAt, lang) || version.id}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {Number(version.length || 0).toLocaleString()} {lang === "VN" ? "ký tự" : "chars"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRestore(version)}
                            disabled={restoringId === version.id}
                            className="shrink-0 w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-[#124757] hover:bg-[#124757]/10 dark:hover:text-yellow-400 dark:hover:bg-yellow-400/10 transition-all shadow-sm disabled:opacity-50"
                            title={lang === "VN" ? "Khôi phục bản này" : "Restore this version"}
                          >
                            {restoringId === version.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">history</span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          )}

          <form onSubmit={handlePreview} className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                {lang === "VN" ? "Chạy thử prompt" : "Test this prompt"}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                {lang === "VN"
                  ? "Chạy 1 lượt LLM với nội dung ĐANG SOẠN ở trên (chưa cần lưu). Không lưu hội thoại, không đổi prompt đang chạy."
                  : "Runs one LLM turn using the content you're currently editing above (no need to save first). Nothing is stored and the live prompt is untouched."}
              </p>
            </div>

            <textarea
              value={previewQuestion}
              onChange={(e) => setPreviewQuestion(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner resize-y"
              placeholder={lang === "VN" ? "Ví dụ: chào bạn, mai còn chuyến nào không?" : "e.g. Hi, any trips left tomorrow?"}
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <FormSelect
                value={previewLanguage}
                onChange={setPreviewLanguage}
                options={LANGUAGE_OPTIONS}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
              />
              <label className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={previewWithTools}
                  onChange={(e) => setPreviewWithTools(e.target.checked)}
                  className="accent-[#124757] dark:accent-yellow-400"
                />
                {lang === "VN" ? "Cho gọi tool (tốn quota hơn)" : "Allow tool calls (costs more quota)"}
              </label>
            </div>
            {previewWithTools && (
              <p className="text-[10px] text-amber-500 font-bold -mt-2">
                {lang === "VN"
                  ? "Chạy như thật, tốn 2-4 lần gọi LLM mỗi lượt — dùng nhiều sẽ ăn vào hạn mức chat thật của khách."
                  : "Runs like production, costs 2-4 LLM calls per turn — heavy use eats into real customer chat quota."}
              </p>
            )}

            {previewError && (
              <p className="text-xs font-bold text-rose-500 whitespace-pre-line">{previewError}</p>
            )}

            <button
              type="submit"
              disabled={isPreviewing}
              className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-3 rounded-xl shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isPreviewing && (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {lang === "VN" ? "Chạy kiểm thử" : "Run test"}
            </button>
            <p className="text-[10px] text-slate-400 text-center">
              {lang === "VN" ? "Giới hạn 5 lượt / 300 giây cho tài khoản admin hiện tại." : "Limited to 5 runs / 300s for the current admin account."}
            </p>
          </form>

          {previewResult && (
            <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${PREVIEW_STATUS_STYLE[previewResult.status] || "bg-slate-100 dark:bg-slate-900 text-slate-500"}`}>
                  {labelPreviewStatus(previewResult.status, lang)}
                </span>
                {typeof previewResult.promptLength === "number" && (
                  <span className="text-[10px] font-bold text-slate-400">
                    {lang === "VN" ? "Prompt hoàn chỉnh" : "Full prompt"}: {previewResult.promptLength.toLocaleString()} {lang === "VN" ? "ký tự" : "chars"}
                  </span>
                )}
              </div>

              {Array.isArray(previewResult.usedTools) && previewResult.usedTools.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {previewResult.usedTools.map((tool) => (
                    <span key={tool} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-[10px] font-bold text-slate-600 dark:text-slate-300 font-mono">
                      {tool}
                    </span>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 p-4">
                {previewResult.reply ? (
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                    {previewResult.reply}
                  </p>
                ) : (
                  <p className="text-xs font-bold text-slate-400 text-center">
                    {lang === "VN" ? "Không có câu trả lời (xem trạng thái ở trên)." : "No reply (see status above)."}
                  </p>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
