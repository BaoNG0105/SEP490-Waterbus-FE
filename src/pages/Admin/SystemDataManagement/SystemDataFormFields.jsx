import { FormSelect } from "../../../components/FormSelect";
import {
  getKnowledgeCategoryLabel,
  KNOWLEDGE_CATEGORY_ORDER,
  KNOWLEDGE_CONTENT_AI_LIMIT,
} from "../../../services/knowledgeEntryService";

import { required } from "../../../utils/requiredStar";
const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all disabled:opacity-50";
const errorInputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-rose-500 dark:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 shadow-inner transition-all disabled:opacity-50";
const errorTextStyle = "mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400";

/**
 * Khối field dùng chung cho CreateSystemData / EditSystemData.
 *
 * `errors`: { [field]: message } — chỉ hiện khi field tương ứng đã "touched" (do trang cha
 * quyết định khi nào đưa message vào, thường là sau onBlur hoặc sau lần submit đầu tiên).
 * `onFieldBlur`: (field) => void — báo trang cha field vừa rời khỏi.
 */
export function SystemDataFormFields({ lang, formData, onChange, disabled = false, errors = {}, onFieldBlur }) {
  const setField = (field, value) => onChange(field, value);
  const handleBlur = (field) => onFieldBlur?.(field);

  const updateKeyword = (index, value) => {
    setField("keywords", formData.keywords.map((k, i) => (i === index ? value : k)));
  };

  const addKeyword = () => {
    setField("keywords", [...formData.keywords, ""]);
  };

  const removeKeyword = (index) => {
    setField(
      "keywords",
      formData.keywords.length <= 1 ? [""] : formData.keywords.filter((_, i) => i !== index),
    );
  };

  const categoryOptions = KNOWLEDGE_CATEGORY_ORDER.map((category) => ({
    value: category,
    label: getKnowledgeCategoryLabel(category, lang),
  }));

  return (
    <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-5">
      <div>
        <label className={labelStyle}>{<>{lang === "VN" ? "Tiêu đề / Câu hỏi" : "Title / Question"}{required()}</>}</label>
        <input
          value={formData.title}
          onChange={(e) => setField("title", e.target.value)}
          onBlur={() => handleBlur("title")}
          className={errors.title ? errorInputStyle : inputStyle}
          disabled={disabled}
          placeholder={lang === "VN" ? "VD: Chính sách hoàn vé như thế nào?" : "e.g. What is the refund policy?"}
        />
        {errors.title && <p className={errorTextStyle}>{errors.title}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelStyle}>{<>{lang === "VN" ? "Chuyên mục" : "Category"}{required()}</>}</label>
          <FormSelect
            value={formData.category}
            onChange={(value) => {
              setField("category", value);
              handleBlur("category");
            }}
            options={categoryOptions}
            disabled={disabled}
            className={errors.category ? errorInputStyle : inputStyle}
          />
          {errors.category && <p className={errorTextStyle}>{errors.category}</p>}
        </div>
        <div>
          <label className={labelStyle}>{<>{lang === "VN" ? "Thứ tự hiển thị" : "Display order"}{required()}</>}</label>
          <input
            type="number"
            min={1}
            value={formData.displayOrder}
            onChange={(e) => setField("displayOrder", e.target.value)}
            onBlur={() => handleBlur("displayOrder")}
            className={errors.displayOrder ? errorInputStyle : inputStyle}
            disabled={disabled}
          />
          {errors.displayOrder && <p className={errorTextStyle}>{errors.displayOrder}</p>}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            {<>{lang === "VN" ? "Nội dung" : "Content"}{required()}</>}
          </label>
          <span className={`text-[10px] font-bold ${formData.content.length > KNOWLEDGE_CONTENT_AI_LIMIT ? "text-amber-500" : "text-slate-400"}`}>
            {formData.content.length}/{KNOWLEDGE_CONTENT_AI_LIMIT}
            {formData.content.length > KNOWLEDGE_CONTENT_AI_LIMIT
              ? (lang === "VN" ? " — trợ lý chỉ đọc phần đầu" : " — assistant reads the first part only")
              : ""}
          </span>
        </div>
        <textarea
          value={formData.content}
          onChange={(e) => setField("content", e.target.value)}
          onBlur={() => handleBlur("content")}
          rows={10}
          className={`${errors.content ? errorInputStyle : inputStyle} resize-y leading-relaxed`}
          disabled={disabled}
          placeholder={lang === "VN" ? "Nội dung câu trả lời đầy đủ, khách và trợ lý AI sẽ đọc." : "Full answer content — shown to customers and read by the AI assistant."}
        />
        {errors.content && <p className={errorTextStyle}>{errors.content}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
            {<>{lang === "VN" ? "Từ khóa tìm kiếm" : "Search keywords"}{required()}</>}
          </label>
          <button type="button" onClick={addKeyword} disabled={disabled} className="text-[10px] font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400 inline-flex items-center gap-1 disabled:opacity-50">
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
          {formData.keywords.map((keyword, index) => (
            <div key={`keyword-${index}`} className="flex gap-2">
              <input
                value={keyword}
                onChange={(e) => updateKeyword(index, e.target.value)}
                onBlur={() => handleBlur("keywords")}
                className={errors.keywords ? errorInputStyle : inputStyle}
                disabled={disabled}
                placeholder={lang === "VN" ? "VD: hoàn vé, trả lại vé" : "e.g. refund, cancel ticket"}
              />
              <button
                type="button"
                onClick={() => removeKeyword(index)}
                disabled={disabled}
                className="px-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-all shrink-0 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          ))}
        </div>
        {errors.keywords && <p className={errorTextStyle}>{errors.keywords}</p>}
      </div>
    </div>
  );
}