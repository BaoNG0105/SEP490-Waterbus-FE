import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import {
  fetchKnowledgeEntriesAdmin,
  addKnowledgeEntry,
  modifyKnowledgeEntry,
  changeKnowledgeEntryStatus,
  removeKnowledgeEntry,
  buildKnowledgeEntryPayload,
  validateKnowledgeEntryForm,
  labelKnowledgeStatus,
  getKnowledgeCategoryLabel,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_CATEGORY_ORDER,
  KNOWLEDGE_CONTENT_AI_LIMIT,
} from "../../../services/knowledgeEntryService";
import { isAdminUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";

const STATUS_STYLE = {
  [KNOWLEDGE_STATUS.DRAFT]: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
  },
  [KNOWLEDGE_STATUS.PUBLISHED]: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
};

const emptyForm = () => ({
  title: "",
  content: "",
  category: KNOWLEDGE_CATEGORY_ORDER[0],
  keywords: [""],
  status: KNOWLEDGE_STATUS.DRAFT,
  displayOrder: 1,
});

export function KnowledgeManagement() {
  const { lang } = useApp();
  const { user: currentUser } = useSelector((state) => state.auth);
  const canManage = isAdminUser(currentUser);

  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [processingId, setProcessingId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [isSaving, setIsSaving] = useState(false);

  const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
  const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const data = await fetchKnowledgeEntriesAdmin();
      setEntries(data || []);
    } catch (error) {
      console.error("Lỗi khi tải danh sách kiến thức:", error);
      const status = error?.response?.status;
      setErrorMsg(
        status === 403
          ? (lang === "VN" ? "Chỉ Admin được quản lý cơ sở tri thức." : "Only Admin can manage the knowledge base.")
          : (lang === "VN" ? "Không tải được danh sách mục kiến thức." : "Failed to load knowledge entries.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canManage) return;
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, categoryFilter]);

  const stats = useMemo(() => ({
    total: entries.length,
    published: entries.filter((e) => e.status === KNOWLEDGE_STATUS.PUBLISHED).length,
    draft: entries.filter((e) => e.status === KNOWLEDGE_STATUS.DRAFT).length,
  }), [entries]);

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return entries
      .filter((entry) => {
        const matchesSearch =
          !term ||
          (entry.title?.toLowerCase() || "").includes(term) ||
          (entry.keywords || []).some((k) => k.toLowerCase().includes(term));
        const matchesStatus = statusFilter === "All" || entry.status === statusFilter;
        const matchesCategory = categoryFilter === "All" || entry.category === categoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
      })
      .sort((a, b) => {
        if (a.category !== b.category) return String(a.category).localeCompare(String(b.category));
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      });
  }, [entries, searchTerm, statusFilter, categoryFilter]);

  const totalPages = Math.ceil(filteredEntries.length / ITEMS_PER_PAGE);
  const currentEntries = filteredEntries.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const startIndex = filteredEntries.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredEntries.length);

  if (!canManage) {
    return <Navigate to="/admin" replace />;
  }

  const getPaginationGroup = () => {
    let pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      pages = [1, 2, 3, 4, "...", totalPages];
    } else if (currentPage >= totalPages - 2) {
      pages = [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
      pages = [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
    }
    return pages;
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (entry) => {
    setEditingId(entry.knowledgeEntryId);
    setForm({
      title: entry.title || "",
      content: entry.content || "",
      category: entry.category || KNOWLEDGE_CATEGORY_ORDER[0],
      keywords: Array.isArray(entry.keywords) && entry.keywords.length > 0 ? entry.keywords : [""],
      status: entry.status || KNOWLEDGE_STATUS.DRAFT,
      displayOrder: Number(entry.displayOrder) || 1,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingId(null);
  };

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

  const handleSave = async () => {
    const validationError = validateKnowledgeEntryForm(form, lang);
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
      const payload = buildKnowledgeEntryPayload(form);
      if (editingId) {
        await modifyKnowledgeEntry(editingId, payload);
      } else {
        await addKnowledgeEntry(payload);
      }
      setIsModalOpen(false);
      setEditingId(null);
      await loadEntries();

      notify({
        toast: true,
        icon: "success",
        title: editingId
          ? (lang === "VN" ? "Đã cập nhật mục kiến thức" : "Entry updated")
          : (lang === "VN" ? "Đã tạo mục kiến thức" : "Entry created"),
        showConfirmButton: false,
        timer: 1800,
      });
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Lưu thất bại" : "Save failed",
        text: error.response?.data?.message || (lang === "VN" ? "Không thể lưu mục kiến thức." : "Could not save the entry."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (entry) => {
    const nextStatus = entry.status === KNOWLEDGE_STATUS.PUBLISHED
      ? KNOWLEDGE_STATUS.DRAFT
      : KNOWLEDGE_STATUS.PUBLISHED;

    const confirmResult = await notify({
      title: nextStatus === KNOWLEDGE_STATUS.PUBLISHED
        ? (lang === "VN" ? "Xuất bản mục kiến thức?" : "Publish this entry?")
        : (lang === "VN" ? "Hạ về bản nháp?" : "Move to draft?"),
      html: nextStatus === KNOWLEDGE_STATUS.PUBLISHED
        ? (lang === "VN"
          ? `Mục <b>${entry.title}</b> sẽ hiển thị công khai trên trang Điều khoản & Chính sách và trợ lý AI có thể sử dụng.`
          : `Entry <b>${entry.title}</b> will become publicly visible on the Terms & Policy page and usable by the assistant.`)
        : (lang === "VN"
          ? `Mục <b>${entry.title}</b> sẽ không còn hiển thị công khai và trợ lý AI sẽ ngừng dùng.`
          : `Entry <b>${entry.title}</b> will no longer be public and the assistant will stop using it.`),
      icon: "question",
      showCancelButton: true,
      confirmButtonText: nextStatus === KNOWLEDGE_STATUS.PUBLISHED
        ? (lang === "VN" ? "Xuất bản" : "Publish")
        : (lang === "VN" ? "Về nháp" : "Set draft"),
      cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
    });
    if (!confirmResult.isConfirmed) return;

    try {
      setProcessingId(entry.knowledgeEntryId);
      await changeKnowledgeEntryStatus(entry.knowledgeEntryId, nextStatus);
      setEntries((prev) => prev.map((e) => (
        e.knowledgeEntryId === entry.knowledgeEntryId ? { ...e, status: nextStatus } : e
      )));
      notify({
        toast: true,
        icon: "success",
        title: nextStatus === KNOWLEDGE_STATUS.PUBLISHED
          ? (lang === "VN" ? "Đã xuất bản" : "Published")
          : (lang === "VN" ? "Đã về nháp" : "Moved to draft"),
        showConfirmButton: false,
        timer: 1600,
      });
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Thất bại" : "Failed",
        text: error.response?.data?.message || (lang === "VN" ? "Không thể đổi trạng thái." : "Failed to change status."),
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (entry) => {
    const confirmResult = await notify({
      title: lang === "VN" ? "Xóa mục kiến thức?" : "Delete this entry?",
      html: lang === "VN"
        ? `Mục <b>${entry.title}</b> sẽ bị <b>xóa vĩnh viễn</b> khỏi hệ thống.`
        : `Entry <b>${entry.title}</b> will be <b>permanently deleted</b>.`,
      icon: "warning",
      tone: "danger",
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Xóa" : "Delete",
      cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
    });
    if (!confirmResult.isConfirmed) return;

    try {
      setProcessingId(entry.knowledgeEntryId);
      await removeKnowledgeEntry(entry.knowledgeEntryId);
      notify({
        toast: true,
        icon: "success",
        title: lang === "VN" ? "Đã xóa" : "Deleted",
        showConfirmButton: false,
        timer: 1600,
      });
      await loadEntries();
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Thất bại" : "Failed",
        text: error.response?.data?.message || (lang === "VN" ? "Không thể xóa mục này." : "Failed to delete this entry."),
      });
    } finally {
      setProcessingId(null);
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
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Cơ sở tri thức" : "Knowledge Base"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "Nội dung chính sách, quy định — trợ lý AI dùng để trả lời và trang Điều khoản & Chính sách hiển thị công khai."
              : "Policy & rules content — used by the AI assistant and shown publicly on the Terms & Policy page."}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-5 py-3 bg-yellow-400 text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
          {lang === "VN" ? "Thêm mục" : "New entry"}
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số" : "Total"}</span>
          <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{stats.total}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đã xuất bản" : "Published"}</span>
          <h3 className="text-xl font-black font-headline text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.published}</h3>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Bản nháp" : "Draft"}</span>
          <h3 className="text-xl font-black font-headline text-amber-600 dark:text-amber-400 mt-0.5">{stats.draft}</h3>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col xl:flex-row gap-3 items-center">
        <div className="w-full xl:flex-1 relative flex items-center">
          <span className="material-symbols-outlined absolute left-4 text-slate-400 text-lg pointer-events-none">search</span>
          <input
            type="text"
            placeholder={lang === "VN" ? "Tìm theo tiêu đề hoặc từ khóa..." : "Search by title or keyword..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto overflow-x-auto shrink-0">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 outline-none cursor-pointer shadow-inner shrink-0"
          >
            <option value="All">{lang === "VN" ? "Tất cả chuyên mục" : "All Categories"}</option>
            {KNOWLEDGE_CATEGORY_ORDER.map((category) => (
              <option key={category} value={category}>
                {getKnowledgeCategoryLabel(category, lang)}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            {[
              { key: "All", vn: "Tất cả trạng thái", en: "All Status" },
              { key: KNOWLEDGE_STATUS.PUBLISHED, vn: "Đã xuất bản", en: "Published" },
              { key: KNOWLEDGE_STATUS.DRAFT, vn: "Nháp", en: "Draft" },
            ].map((btn) => (
              <button
                key={btn.key}
                type="button"
                onClick={() => setStatusFilter(btn.key)}
                className={`px-5 py-3.5 rounded-xl text-[10px] font-headline font-black uppercase tracking-wider border transition-all shrink-0 ${statusFilter === btn.key
                  ? " border-transparent bg-yellow-400 text-slate-900 shadow-md"
                  : "bg-white text-slate-500 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                  }`}
              >
                {lang === "VN" ? btn.vn : btn.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-6">{lang === "VN" ? "Tiêu đề" : "Title"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Chuyên mục" : "Category"}</th>
                <th className="py-4 px-4 text-center">{lang === "VN" ? "Thứ tự" : "Order"}</th>
                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
              {currentEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                    {lang === "VN" ? "Không có mục kiến thức nào." : "No knowledge entries found."}
                  </td>
                </tr>
              ) : (
                currentEntries.map((entry) => {
                  const statusStyle = STATUS_STYLE[entry.status] || STATUS_STYLE[KNOWLEDGE_STATUS.DRAFT];
                  const isPublished = entry.status === KNOWLEDGE_STATUS.PUBLISHED;
                  return (
                    <tr key={entry.knowledgeEntryId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors group">
                      <td className="py-4 px-6 max-w-xs">
                        <h4 className="font-bold text-slate-800 dark:text-white text-sm tracking-tight leading-snug line-clamp-1">
                          {entry.title}
                        </h4>
                        {Array.isArray(entry.keywords) && entry.keywords.length > 0 && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {entry.keywords.slice(0, 4).join(", ")}
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-[10px] font-headline font-black tracking-wide text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 inline-block uppercase">
                          {getKnowledgeCategoryLabel(entry.category, lang)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{Number(entry.displayOrder) || 0}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${statusStyle.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
                          {labelKnowledgeStatus(entry.status, lang)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(entry)}
                            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 hover:border-amber-200 dark:hover:border-amber-500/30 transition-all shadow-sm"
                            title={lang === "VN" ? "Chỉnh sửa" : "Edit"}
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(entry)}
                            disabled={processingId === entry.knowledgeEntryId}
                            className={`w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all shadow-sm disabled:opacity-50 ${isPublished
                              ? "text-amber-500 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500/20 dark:hover:text-amber-400"
                              : "text-emerald-500 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400"
                              }`}
                            title={isPublished ? (lang === "VN" ? "Về nháp" : "Set draft") : (lang === "VN" ? "Xuất bản" : "Publish")}
                          >
                            {processingId === entry.knowledgeEntryId ? (
                              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">{isPublished ? "unpublished" : "publish"}</span>
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(entry)}
                            disabled={processingId === entry.knowledgeEntryId}
                            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500/20 dark:hover:text-rose-400 flex items-center justify-center transition-all shadow-sm disabled:opacity-50"
                            title={lang === "VN" ? "Xóa" : "Delete"}
                          >
                            {processingId === entry.knowledgeEntryId ? (
                              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 0 && (
        <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
          <span className="text-xs font-bold text-slate-400">
            {lang === "VN"
              ? `Hiển thị ${startIndex}-${endIndex} trong số ${filteredEntries.length} kết quả`
              : `Showing ${startIndex}-${endIndex} of ${filteredEntries.length} entries`}
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${currentPage === 1
                ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                }`}
            >
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>

            {getPaginationGroup().map((item, index) => {
              if (item === "...") {
                return (
                  <span key={`ellipsis-${index}`} className="w-8 h-8 flex items-center justify-center text-slate-400 font-bold tracking-widest shrink-0">
                    ...
                  </span>
                );
              }
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item)}
                  className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black font-headline text-xs transition-all ${currentPage === item
                    ? "bg-[#124757] text-white shadow-md border-transparent dark:bg-yellow-400 dark:text-slate-900"
                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 hover:bg-slate-50"
                    }`}
                >
                  {item}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${currentPage === totalPages
                ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                }`}
            >
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            onClick={closeModal}
            disabled={isSaving}
          />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-4xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-800">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 bg-white dark:bg-slate-800 dark:border-slate-700">
              <div>
                <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Mục kiến thức" : "Knowledge entry"}
                </p>
                <h3 className="mt-1 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                  {editingId ? (lang === "VN" ? "Sửa mục kiến thức" : "Edit entry") : (lang === "VN" ? "Thêm mục kiến thức" : "Add entry")}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:hover:text-slate-200"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Tiêu đề / Câu hỏi (*)" : "Title / Question (*)"}</label>
                <input
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  className={inputStyle}
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
                  placeholder={lang === "VN" ? "Nội dung câu trả lời đầy đủ, khách và trợ lý AI sẽ đọc." : "Full answer content — shown to customers and read by the AI assistant."}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    {lang === "VN" ? "Từ khóa tìm kiếm (*)" : "Search keywords (*)"}
                  </label>
                  <button type="button" onClick={addKeyword} className="text-[10px] font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400 inline-flex items-center gap-1">
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
                        placeholder={lang === "VN" ? "VD: hoàn vé, trả lại vé" : "e.g. refund, cancel ticket"}
                      />
                      <button
                        type="button"
                        onClick={() => removeKeyword(index)}
                        className="px-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 transition-all shrink-0"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelStyle}>{lang === "VN" ? "Trạng thái" : "Status"}</label>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                  {[
                    { value: KNOWLEDGE_STATUS.DRAFT, labelVn: "Nháp", labelEn: "Draft" },
                    { value: KNOWLEDGE_STATUS.PUBLISHED, labelVn: "Xuất bản", labelEn: "Published" },
                  ].map((option) => {
                    const selected = form.status === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateField("status", option.value)}
                        className={`h-10 rounded-lg px-2 text-[11px] font-headline font-black uppercase tracking-wider transition-all ${selected
                          ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                          : "text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                      >
                        {lang === "VN" ? option.labelVn : option.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 bg-white sm:flex-row sm:justify-end dark:border-slate-700 dark:bg-slate-800">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {lang === "VN" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-2xl bg-[#124757] px-6 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-white transition-colors hover:bg-[#0d3541] disabled:opacity-60 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300 inline-flex items-center justify-center gap-2"
              >
                {isSaving && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {editingId ? (lang === "VN" ? "Lưu thay đổi" : "Save changes") : (lang === "VN" ? "Tạo mục" : "Create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
