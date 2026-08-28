import { useEffect, useState, useMemo } from "react";
import { Navigate, useParams, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import {
  fetchKnowledgeEntriesAdmin,
  modifyKnowledgeEntry,
  buildKnowledgeEntryPayload,
  validateKnowledgeEntryFields,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_CATEGORY_ORDER,
} from "../../../services/knowledgeEntryService";
import { isAdminUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";
import { SystemDataFormFields } from "./SystemDataFormFields";

const emptyForm = () => ({
  title: "",
  content: "",
  category: KNOWLEDGE_CATEGORY_ORDER[0],
  keywords: [""],
  status: KNOWLEDGE_STATUS.DRAFT,
  displayOrder: 1,
});

const toFormState = (entry) => ({
  title: entry.title || "",
  content: entry.content || "",
  category: entry.category || KNOWLEDGE_CATEGORY_ORDER[0],
  keywords: Array.isArray(entry.keywords) && entry.keywords.length > 0 ? entry.keywords : [""],
  status: entry.status || KNOWLEDGE_STATUS.DRAFT,
  displayOrder: Number(entry.displayOrder) || 1,
});

export function EditSystemData() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user: currentUser } = useSelector((state) => state.auth);
  const canManage = isAdminUser(currentUser);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState(emptyForm());

  // Validate real-time các field bắt buộc (*) — lỗi chỉ hiện cho field đã "touched" (rời khỏi
  // ít nhất 1 lần), nhưng các nút Lưu bị khóa ngay khi còn lỗi dù chưa touched hết.
  const [touchedFields, setTouchedFields] = useState({});
  const fieldErrors = useMemo(() => validateKnowledgeEntryFields(form, lang), [form, lang]);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const visibleFieldErrors = useMemo(() => {
    const visible = {};
    Object.keys(fieldErrors).forEach((field) => {
      if (touchedFields[field]) visible[field] = fieldErrors[field];
    });
    return visible;
  }, [fieldErrors, touchedFields]);

  useEffect(() => {
    const loadEntry = async () => {
      try {
        setIsLoading(true);
        setErrorMsg("");

        const preloaded = location.state?.entry;
        if (preloaded && String(preloaded.knowledgeEntryId) === String(id)) {
          setForm(toFormState(preloaded));
        }

        // Không có API lấy chi tiết 1 mục — list admin đã trả đủ content nên dùng lại.
        const result = await fetchKnowledgeEntriesAdmin({ page: 1, pageSize: 100 });
        const found = (result.items || []).find((e) => String(e.knowledgeEntryId) === String(id));
        if (!found) {
          notify({
            icon: "error",
            title: lang === "VN" ? "Không tìm thấy mục dữ liệu!" : "Entry not found!",
            text: lang === "VN" ? "Mục dữ liệu không tồn tại. Quay về danh sách." : "The requested entry does not exist.",
            confirmButtonColor: "#124757",
            allowOutsideClick: false,
          }).then(() => navigate("/admin/system-data"));
          return;
        }
        setForm(toFormState(found));
      } catch (error) {
        console.error("Lỗi khi tải chi tiết mục dữ liệu:", error);
        setErrorMsg(lang === "VN" ? "Không thể lấy thông tin mục dữ liệu do lỗi kết nối mạng." : "Failed to retrieve entry details.");
      } finally {
        setIsLoading(false);
      }
    };
    loadEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!canManage) {
    return <Navigate to="/admin/reports/revenue" replace />;
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldBlur = (field) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const status = e.nativeEvent.submitter?.value || KNOWLEDGE_STATUS.DRAFT;
    const submittedForm = { ...form, status };

    // Bấm submit khi còn lỗi → hiện hết lỗi lên thay vì âm thầm chặn.
    setTouchedFields({ title: true, category: true, content: true, keywords: true, displayOrder: true });
    if (hasFieldErrors) return;

    try {
      setIsSaving(true);
      setErrorMsg("");
      const payload = buildKnowledgeEntryPayload(submittedForm);
      await modifyKnowledgeEntry(id, payload);

      notify({
        icon: "success",
        title: lang === "VN" ? "Đã cập nhật mục dữ liệu" : "Entry updated",
        text: lang === "VN" ? "Thông tin mục dữ liệu đã được lưu." : "Entry details updated successfully.",
        confirmButtonColor: "#124757",
      }).then(() => navigate("/admin/system-data"));
    } catch (error) {
      setErrorMsg(
        error.response?.data?.message || (lang === "VN" ? "Không thể lưu mục dữ liệu." : "Could not save the entry."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
      </div>
    );
  }

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
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide truncate">
            {lang === "VN" ? `Sửa mục dữ liệu: ${form.title}` : `Edit entry: ${form.title}`}
          </h2>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-6">
      <SystemDataFormFields
        lang={lang}
        formData={form}
        onChange={updateField}
        disabled={isSaving}
        errors={visibleFieldErrors}
        onFieldBlur={handleFieldBlur}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="submit"
          name="status"
          value={KNOWLEDGE_STATUS.DRAFT}
          disabled={isSaving || hasFieldErrors}
          title={lang === "VN" ? "Không ai dùng." : "Not used anywhere."}
          className="w-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {isSaving && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
          {lang === "VN" ? "Lưu bản nháp" : "Save as Draft"}
        </button>
        <button
          type="submit"
          name="status"
          value={KNOWLEDGE_STATUS.PRIVATE}
          disabled={isSaving || hasFieldErrors}
          title={lang === "VN" ? "Chỉ trợ lý AI đọc, không hiện trên web." : "Read by the assistant only — not shown on the website."}
          className="w-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 font-headline font-black uppercase text-xs tracking-wider py-4 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {isSaving && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
          {lang === "VN" ? "Lưu nội bộ" : "Save as Private"}
        </button>
        <button
          type="submit"
          name="status"
          value={KNOWLEDGE_STATUS.PUBLISHED}
          disabled={isSaving || hasFieldErrors}
          title={lang === "VN" ? "Hiện trên web và trợ lý AI đọc." : "Shown on the website and read by the assistant."}
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
