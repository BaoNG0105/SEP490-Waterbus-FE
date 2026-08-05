import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import {
  fetchKnowledgeEntriesAdmin,
  changeKnowledgeEntryStatus,
  removeKnowledgeEntry,
  labelKnowledgeStatus,
  getKnowledgeCategoryLabel,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_CATEGORY_ORDER,
} from "../../../services/knowledgeEntryService";
import { isAdminUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";
import { FormSelect } from "../../../components/FormSelect";

const STATUS_STYLE = {
  [KNOWLEDGE_STATUS.DRAFT]: {
    dot: "bg-slate-400",
    badge: "text-slate-500 dark:text-slate-400",
  },
  [KNOWLEDGE_STATUS.PUBLISHED]: {
    dot: "bg-emerald-500",
    badge: "text-emerald-600 dark:text-emerald-400",
  },
};

export function SystemDataManagement() {
  const { lang } = useApp();
  const navigate = useNavigate();
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

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const data = await fetchKnowledgeEntriesAdmin();
      setEntries(data || []);
    } catch (error) {
      console.error("Lỗi khi tải danh sách dữ liệu hệ thống:", error);
      const status = error?.response?.status;
      setErrorMsg(
        status === 403
          ? (lang === "VN" ? "Chỉ Admin được quản lý dữ liệu hệ thống." : "Only Admin can manage the system data.")
          : (lang === "VN" ? "Không tải được danh sách mục dữ liệu." : "Failed to load system data entries.")
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

  const handleToggleStatus = async (entry) => {
    const nextStatus = entry.status === KNOWLEDGE_STATUS.PUBLISHED
      ? KNOWLEDGE_STATUS.DRAFT
      : KNOWLEDGE_STATUS.PUBLISHED;

    const confirmResult = await notify({
      title: nextStatus === KNOWLEDGE_STATUS.PUBLISHED
        ? (lang === "VN" ? "Xuất bản mục dữ liệu?" : "Publish this entry?")
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
      title: lang === "VN" ? "Xóa mục dữ liệu?" : "Delete this entry?",
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
            {lang === "VN" ? "Quản lý dữ liệu hệ thống" : "System Data Management"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "Nội dung chính sách, quy định — trợ lý AI dùng để trả lời và trang Điều khoản & Chính sách hiển thị công khai."
              : "Policy & rules content — used by the AI assistant and shown publicly on the Terms & Policy page."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/system-data/create")}
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

        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto justify-end overflow-visible">
          <div className="relative z-20 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Chuyên mục:" : "Category:"}</span>
            <FormSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "All", label: lang === "VN" ? "Tất cả chuyên mục" : "All Categories" },
                ...KNOWLEDGE_CATEGORY_ORDER.map((category) => ({
                  value: category,
                  label: getKnowledgeCategoryLabel(category, lang),
                })),
              ]}
              className="min-w-45 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>

          <div className="relative z-10 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Trạng thái:" : "Status:"}</span>
            <FormSelect
              value={statusFilter}
              onChange={setStatusFilter}
              menuAlign="right"
              options={[
                { value: "All", label: lang === "VN" ? "Tất cả trạng thái" : "All Status" },
                { value: KNOWLEDGE_STATUS.PUBLISHED, label: lang === "VN" ? "Đã xuất bản" : "Published" },
                { value: KNOWLEDGE_STATUS.DRAFT, label: lang === "VN" ? "Nháp" : "Draft" },
              ]}
              className="min-w-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
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
                    {lang === "VN" ? "Không có mục dữ liệu nào." : "No system data entries found."}
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
                        <span className="text-[10px] font-headline font-black tracking-wide text-slate-700 dark:text-slate-200 uppercase">
                          {getKnowledgeCategoryLabel(entry.category, lang)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{Number(entry.displayOrder) || 0}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-headline font-black uppercase tracking-wide ${statusStyle.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
                          {labelKnowledgeStatus(entry.status, lang)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`/admin/system-data/edit/${entry.knowledgeEntryId}`, { state: { entry } })}
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
    </div>
  );
}
