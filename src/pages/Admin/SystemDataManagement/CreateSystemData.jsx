import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import {
  addKnowledgeEntry,
  buildKnowledgeEntryPayload,
  validateKnowledgeEntryForm,
  getKnowledgeCategoryLabel,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_CATEGORY_ORDER,
  KNOWLEDGE_CONTENT_AI_LIMIT,
} from "../../../services/knowledgeEntryService";
import { isAdminUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";

const emptyForm = () => ({
  title: "",
  content: "",
  category: KNOWLEDGE_CATEGORY_ORDER[0],
  keywords: [""],
  status: KNOWLEDGE_STATUS.DRAFT,
  displayOrder: 1,
});

export function CreateSystemData() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { user: currentUser } = useSelector((state) => state.auth);
  const canManage = isAdminUser(currentUser);

  const [form, setForm] = useState(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!canManage) {
    return <Navigate to="/admin" replace />;
  }

  const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
  const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all disabled:opacity-50";

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateKeyword = (index, value) => {
    setForm((prev) => ({
      ...prev,
      keywords: prev.keywords.map((k, i) => (i === index ? value : k)),
    }));
  };

  const addKeyword = () => {
    setForm((prev) => ({ ...prev, keywords: [...prev.keywords, ""] }));
  };

  const removeKeyword = (index) => {
    setForm((prev) => ({
      ...prev,
      keywords: prev.keywords.length <= 1 ? [""] : prev.keywords.filter((_, i) => i !== index),
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const status = e.nativeEvent.submitter?.value || KNOWLEDGE_STATUS.DRAFT;
    const submittedForm = { ...form, status };

    const validationError = validateKnowledgeEntryForm(submittedForm, lang);
    if (validationError) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Thiếu thông tin" : "Missing information",
        text: validationError,
      });
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg("");
      const payload = buildKnowledgeEntryPayload(submittedForm);
      await addKnowledgeEntry(payload);

      notify({
        icon: "success",
        title: lang === "VN" ? "Đã tạo mục dữ liệu" : "Entry created",
        text: lang === "VN"
          ? "Mục dữ liệu mới đã được thêm vào hệ thống."
          : "New entry has been added to the system.",
        confirmButtonColor: "#124757",
      }).then(() => navigate("/admin/system-data"));
    } catch (error) {
      const forbidden = error.response?.status === 403;
      setErrorMsg(
        forbidden
          ? (lang === "VN" ? "Chỉ Admin được quản lý dữ liệu hệ thống." : "Only Admin can manage the system data.")
          : (error.response?.data?.message || (lang === "VN" ? "Không thể lưu mục dữ liệu." : "Could not save the entry.")),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-5xl mx-auto animate-fade-in">
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/system-data")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Thêm mục dữ liệu" : "New system data entry"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "Tạo nội dung chính sách, quy định mới cho trợ lý AI và trang Điều khoản & Chính sách."
              : "Create new policy & rules content for the AI assistant and the Terms & Policy page."}
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
        <div>
          <label className={labelStyle}>{lang === "VN" ? "Tiêu đề / Câu hỏi (*)" : "Title / Question (*)"}</label>
          <input
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            className={inputStyle}
            disabled={isSaving}
            placeholder={lang === "VN" ? "VD: Chính sách hoàn vé như thế nào?" : "e.g. What is the refund policy?"}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Chuyên mục (*)" : "Category (*)"}</label>
            <select
              value={form.category}
              onChange={(e) => updateField("category", e.target.value)}
              className={inputStyle}
              disabled={isSaving}
            >
              {KNOWLEDGE_CATEGORY_ORDER.map((category) => (
                <option key={category} value={category}>
                  {getKnowledgeCategoryLabel(category, lang)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Thứ tự hiển thị" : "Display order"}</label>
            <input
              type="number"
              min={0}
              value={form.displayOrder}
              onChange={(e) => updateField("displayOrder", e.target.value)}
              className={inputStyle}
              disabled={isSaving}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
              {lang === "VN" ? "Nội dung (*)" : "Content (*)"}
            </label>
            <span className={`text-[10px] font-bold ${form.content.length > KNOWLEDGE_CONTENT_AI_LIMIT ? "text-amber-500" : "text-slate-400"}`}>
              {form.content.length}/{KNOWLEDGE_CONTENT_AI_LIMIT}
              {form.content.length > KNOWLEDGE_CONTENT_AI_LIMIT
                ? (lang === "VN" ? " — trợ lý chỉ đọc phần đầu" : " — assistant reads the first part only")
                : ""}
            </span>
          </div>
          <textarea
            value={form.content}
            onChange={(e) => updateField("content", e.target.value)}
            rows={10}
            className={`${inputStyle} resize-y leading-relaxed`}
            disabled={isSaving}
            placeholder={lang === "VN" ? "Nội dung câu trả lời đầy đủ, khách và trợ lý AI sẽ đọc." : "Full answer content — shown to customers and read by the AI assistant."}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
              {lang === "VN" ? "Từ khóa tìm kiếm (*)" : "Search keywords (*)"}
            </label>
            <button type="button" onClick={addKeyword} disabled={isSaving} className="text-[10px] font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400 inline-flex items-center gap-1 disabled:opacity-50">
              <span className="material-symbols-outlined text-sm">add</span>
              {lang === "VN" ? "Thêm" : "Add"}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">
            {lang === "VN"
              ? "Liệt kê mọi cách khách hay hỏi về chủ đề này để trợ lý AI khớp đúng mục."
              : "List every way customers might ask about this topic so the assistant matches it correctly."}
          </p>
          <div className="space-y-2">
            {form.keywords.map((keyword, index) => (
              <div key={`keyword-${index}`} className="flex gap-2">
                <input
                  value={keyword}
                  onChange={(e) => updateKeyword(index, e.target.value)}
                  className={inputStyle}
                  disabled={isSaving}
                  placeholder={lang === "VN" ? "VD: hoàn vé, trả lại vé" : "e.g. refund, cancel ticket"}
                />
                <button
                  type="button"
                  onClick={() => removeKeyword(index)}
                  disabled={isSaving}
                  className="px-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-all shrink-0 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="submit"
          name="status"
          value={KNOWLEDGE_STATUS.DRAFT}
          disabled={isSaving}
          className="w-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {isSaving && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
          {lang === "VN" ? "Lưu bản nháp" : "Save as Draft"}
        </button>
        <button
          type="submit"
          name="status"
          value={KNOWLEDGE_STATUS.PUBLISHED}
          disabled={isSaving}
          className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl shadow-xl hover:scale-[1.01] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {isSaving && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
          {lang === "VN" ? "Xuất bản" : "Publish"}
        </button>
      </div>
      </form>
    </div>
  );
}
