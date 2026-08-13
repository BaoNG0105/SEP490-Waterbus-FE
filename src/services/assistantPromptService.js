import {
  getAssistantPromptAdmin as apiGetAssistantPrompt,
  updateAssistantPromptAdmin as apiUpdateAssistantPrompt,
  restoreAssistantPromptAdmin as apiRestoreAssistantPrompt,
  resetAssistantPromptAdmin as apiResetAssistantPrompt,
  previewAssistantPromptAdmin as apiPreviewAssistantPrompt,
} from "../api/assistantApi";
import { getApiErrorMessage } from "../utils/apiError";

export const PROMPT_SOURCE = {
  FILE: "file",
  BUILTIN: "builtin",
};

// Dùng khi BE chưa kịp trả placeholders[] (không nên xảy ra, nhưng tránh trắng UI).
export const FALLBACK_REQUIRED_PLACEHOLDERS = [
  { token: "{{today}}", description: "" },
  { token: "{{language}}", description: "" },
  { token: "{{booking_draft}}", description: "" },
];

export const PREVIEW_STATUS = {
  COMPLETED: "Completed",
  PROVIDER_FAILED: "ProviderFailed",
  TOOL_LIMIT_REACHED: "ToolLimitReached",
};

const emptyPromptState = {
  content: "",
  source: PROMPT_SOURCE.BUILTIN,
  updatedAt: null,
  errors: [],
  lockedRules: "",
  defaultContent: "",
  placeholders: FALLBACK_REQUIRED_PLACEHOLDERS,
  minLength: 0,
  maxLength: 20000,
  storageLocation: "",
  versions: [],
};

const normalizePromptState = (data) => ({
  ...emptyPromptState,
  ...(data || {}),
  errors: Array.isArray(data?.errors) ? data.errors : [],
  placeholders: Array.isArray(data?.placeholders) && data.placeholders.length
    ? data.placeholders
    : FALLBACK_REQUIRED_PLACEHOLDERS,
  versions: Array.isArray(data?.versions) ? data.versions : [],
});

export const fetchAssistantPrompt = async () =>
  normalizePromptState(await apiGetAssistantPrompt());

export const saveAssistantPrompt = async (content) =>
  normalizePromptState(await apiUpdateAssistantPrompt(String(content ?? "")));

export const restoreAssistantPromptVersion = async (versionId) =>
  normalizePromptState(await apiRestoreAssistantPrompt(versionId));

export const resetAssistantPromptToDefault = async () =>
  normalizePromptState(await apiResetAssistantPrompt());

export const runAssistantPromptPreview = async ({ content, question, language, withTools }) =>
  apiPreviewAssistantPrompt({
    content: String(content ?? ""),
    question: String(question ?? "").trim(),
    language,
    withTools: Boolean(withTools),
  });

/** Placeholder nào trong danh sách bắt buộc chưa xuất hiện (nguyên văn) trong content. */
export const getMissingPlaceholders = (content, placeholders = FALLBACK_REQUIRED_PLACEHOLDERS) => {
  const text = String(content || "");
  return (placeholders || []).filter((p) => !text.includes(p.token));
};

/**
 * Kiểm tra nhanh phía FE trước khi gọi PUT/preview — server vẫn là nguồn xác thực cuối cùng,
 * đây chỉ để cản sớm các lỗi rõ ràng (thiếu placeholder / sai độ dài) đỡ tốn 1 round-trip.
 */
export const validatePromptContentLocally = (content, promptState, lang = "VN") => {
  const text = String(content || "");
  const missing = getMissingPlaceholders(text, promptState?.placeholders);

  if (missing.length > 0) {
    const tokens = missing.map((p) => p.token).join(", ");
    return lang === "VN"
      ? `Thiếu placeholder bắt buộc: ${tokens}`
      : `Missing required placeholder: ${tokens}`;
  }

  const minLength = Number(promptState?.minLength) || 0;
  const maxLength = Number(promptState?.maxLength) || Infinity;
  if (text.length < minLength) {
    return lang === "VN"
      ? `Nội dung quá ngắn — cần tối thiểu ${minLength} ký tự (đang có ${text.length}).`
      : `Content is too short — needs at least ${minLength} characters (currently ${text.length}).`;
  }
  if (text.length > maxLength) {
    return lang === "VN"
      ? `Nội dung quá dài — tối đa ${maxLength} ký tự (đang có ${text.length}).`
      : `Content is too long — max ${maxLength} characters (currently ${text.length}).`;
  }

  return "";
};

/**
 * API prompt trả lỗi ở 2 dạng khác nhau tuỳ endpoint:
 * - PUT/preview 400: { errors: { content: ["..."] } }
 * - restore 404: { error: "Không tìm thấy bản lưu '...'." }
 * getApiErrorMessage (dùng chung toàn app) đã xử lý dạng đầu; dạng sau (field "error" số ít)
 * chưa có nơi nào xử lý nên bắt riêng ở đây trước khi rơi về fallback chung.
 */
export const extractAssistantPromptError = (error, fallback) => {
  const singleError = error?.response?.data?.error;
  if (typeof singleError === "string" && singleError.trim()) return singleError.trim();
  return getApiErrorMessage(error, fallback);
};

/** versionId dạng yyyyMMddTHHmmss — parse ra Date để hiển thị đẹp, không tin nguyên "createdAt". */
export const parseVersionId = (versionId) => {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(String(versionId || ""));
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateTime = (value, lang = "VN") => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(lang === "VN" ? "vi-VN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const labelPromptSource = (source, lang = "VN") => {
  if (source === PROMPT_SOURCE.FILE) return lang === "VN" ? "Bản admin đã sửa" : "Admin-edited";
  return lang === "VN" ? "Bản gốc trong code" : "Built-in default";
};

export const labelPreviewStatus = (status, lang = "VN") => {
  if (status === PREVIEW_STATUS.COMPLETED) return lang === "VN" ? "Hoàn tất" : "Completed";
  if (status === PREVIEW_STATUS.PROVIDER_FAILED) return lang === "VN" ? "LLM lỗi / quá tải" : "Provider failed";
  if (status === PREVIEW_STATUS.TOOL_LIMIT_REACHED) return lang === "VN" ? "Vượt giới hạn gọi tool" : "Tool limit reached";
  return status || (lang === "VN" ? "Không xác định" : "Unknown");
};