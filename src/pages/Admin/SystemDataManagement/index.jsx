import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { FormSelect } from "../../../components/FormSelect";
import { useApp } from "../../../context/AppContext";
import {
  changeKnowledgeEntryStatus,
  describeKnowledgeStatus,
  fetchKnowledgeEntriesAdmin,
  fetchKnowledgeEntryMetadata,
  getKnowledgeCategoryLabel,
  KNOWLEDGE_CATEGORY_ORDER,
  KNOWLEDGE_STATUS,
  KNOWLEDGE_STATUS_ORDER,
  labelKnowledgeStatus,
  removeKnowledgeEntry,
} from "../../../services/knowledgeEntryService";
import { isAdminUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";

const STATUS_STYLE = {
  [KNOWLEDGE_STATUS.DRAFT]: {
    badge: "text-slate-500 dark:text-slate-400",
  },
  [KNOWLEDGE_STATUS.PRIVATE]: {
    badge: "text-indigo-600 dark:text-indigo-400",
  },
  [KNOWLEDGE_STATUS.PUBLISHED]: {
    badge: "text-emerald-600 dark:text-emerald-400",
  },
};

const PAGE_SIZE = 8;

const emptyMetadata = {
  categories: KNOWLEDGE_CATEGORY_ORDER,
  statuses: KNOWLEDGE_STATUS_ORDER,
  maxKeywords: 30,
  maxKeywordLength: 100,
  maxContentChars: 4000,
  maxTotalContentChars: 8000,
  defaultSearchTake: 3,
  maxSearchTake: 5,
};

export function SystemDataManagement() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { user: currentUser } = useSelector((state) => state.auth);
  const canManage = isAdminUser(currentUser);

  const [metadata, setMetadata] = useState(emptyMetadata);
  const [entries, setEntries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, published: 0, private: 0, draft: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [processingId, setProcessingId] = useState(null);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const categoryOptions = useMemo(() => (
    metadata.categories || KNOWLEDGE_CATEGORY_ORDER
  ).map((category) => ({
    value: category,
    label: getKnowledgeCategoryLabel(category, lang),
  })), [lang, metadata.categories]);

  const statusOptions = useMemo(() => (
    metadata.statuses || [KNOWLEDGE_STATUS.DRAFT, KNOWLEDGE_STATUS.PUBLISHED]
  ).map((status) => ({
    value: status,
    label: labelKnowledgeStatus(status, lang),
  })), [lang, metadata.statuses]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, totalCount);

  useEffect(() => {
    if (!canManage) return;

    const loadMetadata = async () => {
      try {
        setMetadata(await fetchKnowledgeEntryMetadata());
      } catch (error) {
        console.error("Failed to load knowledge metadata:", error);
      }
    };

    loadMetadata();
  }, [canManage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, statusFilter, categoryFilter]);

  useEffect(() => {
    if (!canManage) return undefined;

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        setErrorMsg("");

        const params = {
          page: currentPage,
          pageSize: PAGE_SIZE,
          keyword: keyword.trim() || undefined,
          status: statusFilter === "All" ? undefined : statusFilter,
          category: categoryFilter === "All" ? undefined : categoryFilter,
        };

        const [pageResult, allResult, publishedResult, privateResult, draftResult] = await Promise.all([
          fetchKnowledgeEntriesAdmin(params),
          fetchKnowledgeEntriesAdmin({ page: 1, pageSize: 1 }),
          fetchKnowledgeEntriesAdmin({ status: KNOWLEDGE_STATUS.PUBLISHED, page: 1, pageSize: 1 }),
          fetchKnowledgeEntriesAdmin({ status: KNOWLEDGE_STATUS.PRIVATE, page: 1, pageSize: 1 }),
          fetchKnowledgeEntriesAdmin({ status: KNOWLEDGE_STATUS.DRAFT, page: 1, pageSize: 1 }),
        ]);

        setEntries(pageResult.items || []);
        setTotalCount(pageResult.totalCount || 0);
        setStats({
          total: allResult.totalCount || 0,
          published: publishedResult.totalCount || 0,
          private: privateResult.totalCount || 0,
          draft: draftResult.totalCount || 0,
        });
      } catch (error) {
        console.error("Failed to load knowledge entries:", error);
        const status = error?.response?.status;
        setErrorMsg(
          status === 403
            ? (lang === "VN" ? "Chỉ quản trị viên được quản lý dữ liệu kiến thức." : "Only Admin can manage knowledge entries.")
            : (lang === "VN" ? "Không tải được danh sách kiến thức." : "Failed to load knowledge entries.")
        );
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [canManage, categoryFilter, currentPage, keyword, lang, statusFilter]);

  if (!canManage) {
    return <Navigate to="/admin/reports/revenue" replace />;
  }

  const reloadCurrentPage = async () => {
    const result = await fetchKnowledgeEntriesAdmin({
      page: currentPage,
      pageSize: PAGE_SIZE,
      keyword: keyword.trim() || undefined,
      status: statusFilter === "All" ? undefined : statusFilter,
      category: categoryFilter === "All" ? undefined : categoryFilter,
    });
    setEntries(result.items || []);
    setTotalCount(result.totalCount || 0);
  };

  const getPaginationGroup = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 4, "...", totalPages];
    if (currentPage >= totalPages - 2) return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
  };

  const statKeyForStatus = (status) => {
    if (status === KNOWLEDGE_STATUS.PUBLISHED) return "published";
    if (status === KNOWLEDGE_STATUS.PRIVATE) return "private";
    return "draft";
  };

  const handleChangeStatus = async (entry, nextStatus) => {
    if (!nextStatus || nextStatus === entry.status) return;

    const confirmResult = await notify({
      title: lang === "VN"
        ? `Đổi trạng thái sang "${labelKnowledgeStatus(nextStatus, lang)}"?`
        : `Change status to "${labelKnowledgeStatus(nextStatus, lang)}"?`,
      html: lang === "VN"
        ? `Mục <b>${entry.title}</b>: ${describeKnowledgeStatus(nextStatus, lang)}`
        : `Entry <b>${entry.title}</b>: ${describeKnowledgeStatus(nextStatus, lang)}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Xác nhận" : "Confirm",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    });
    if (!confirmResult.isConfirmed) return;

    const prevStatus = entry.status;
    try {
      setProcessingId(entry.knowledgeEntryId);
      await changeKnowledgeEntryStatus(entry.knowledgeEntryId, nextStatus);
      await reloadCurrentPage();
      setStats((prev) => ({
        ...prev,
        [statKeyForStatus(prevStatus)]: Math.max(0, prev[statKeyForStatus(prevStatus)] - 1),
        [statKeyForStatus(nextStatus)]: prev[statKeyForStatus(nextStatus)] + 1,
      }));
      notify({
        toast: true,
        icon: "success",
        title: lang === "VN" ? "Đã cập nhật trạng thái" : "Status updated",
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
        ? `Mục <b>${entry.title}</b> sẽ bị <b>xóa vĩnh viễn</b>.`
        : `Entry <b>${entry.title}</b> will be <b>permanently deleted</b>.`,
      icon: "warning",
      tone: "danger",
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Xóa" : "Delete",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    });
    if (!confirmResult.isConfirmed) return;

    try {
      setProcessingId(entry.knowledgeEntryId);
      await removeKnowledgeEntry(entry.knowledgeEntryId);
      await reloadCurrentPage();
      setStats((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        [statKeyForStatus(entry.status)]: Math.max(0, prev[statKeyForStatus(entry.status)] - 1),
      }));
      notify({
        toast: true,
        icon: "success",
        title: lang === "VN" ? "Đã xóa" : "Deleted",
        showConfirmButton: false,
        timer: 1600,
      });
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

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Quản lý dữ liệu hệ thống" : "Data Knowledge Management"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "Quản lý chính sách, quy định và hướng dẫn của hệ thống."
              : "Manage system policies, regulations, and guidelines."}
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: lang === "VN" ? "Tổng số" : "Total", value: stats.total, tone: "text-[#124757] dark:text-white" },
          { label: lang === "VN" ? "Đã xuất bản" : "Published", value: stats.published, tone: "text-emerald-600 dark:text-emerald-400" },
          { label: lang === "VN" ? "Nội bộ" : "Private", value: stats.private, tone: "text-indigo-600 dark:text-indigo-400" },
          { label: lang === "VN" ? "Bản nháp" : "Draft", value: stats.draft, tone: "text-amber-600 dark:text-amber-400" },
        ].map((card) => (
          <div key={card.label} className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{card.label}</span>
            <h3 className={`text-xl font-black font-headline mt-0.5 ${card.tone}`}>{card.value}</h3>
          </div>
        ))}
      </div>

      <div className="space-y-5 min-w-0">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col xl:flex-row gap-3 items-center">
            <div className="w-full xl:flex-1 relative flex items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 text-lg pointer-events-none">search</span>
              <input
                type="text"
                placeholder={lang === "VN" ? "Tìm tiêu đề, nội dung hoặc từ khóa..." : "Search title, content or keyword..."}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
              <FormSelect
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={[
                  { value: "All", label: lang === "VN" ? "Tất cả chuyên mục" : "All categories" },
                  ...categoryOptions,
                ]}
                className="min-w-45 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
              />
              <FormSelect
                value={statusFilter}
                onChange={setStatusFilter}
                menuAlign="right"
                options={[
                  { value: "All", label: lang === "VN" ? "Tất cả trạng thái" : "All status" },
                  ...statusOptions,
                ]}
                className="min-w-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
              />
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
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-14">
                        <div className="mx-auto w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                        {lang === "VN" ? "Không có mục kiến thức nào." : "No knowledge entries found."}
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => {
                      const statusStyle = STATUS_STYLE[entry.status] || STATUS_STYLE[KNOWLEDGE_STATUS.DRAFT];
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
                            <FormSelect
                              value={entry.status}
                              onChange={(nextStatus) => handleChangeStatus(entry, nextStatus)}
                              disabled={processingId === entry.knowledgeEntryId}
                              fullWidth={false}
                              menuAlign="right"
                              options={KNOWLEDGE_STATUS_ORDER.map((status) => ({
                                value: status,
                                label: labelKnowledgeStatus(status, lang),
                              }))}
                              className={`mx-auto inline-flex items-center gap-1 text-[10px] font-headline font-black uppercase tracking-wide px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 disabled:opacity-50 ${statusStyle.badge}`}
                            />
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

          <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
            <span className="text-xs font-bold text-slate-400">
              {lang === "VN"
                ? `Hiển thị ${startIndex}-${endIndex} trong ${totalCount} kết quả`
                : `Showing ${startIndex}-${endIndex} of ${totalCount} entries`}
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all bg-white text-slate-500 border border-slate-200 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>

              {getPaginationGroup().map((item, index) => item === "..." ? (
                <span key={`ellipsis-${index}`} className="w-8 h-8 flex items-center justify-center text-slate-400 font-bold tracking-widest shrink-0">
                  ...
                </span>
              ) : (
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
              ))}

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all bg-white text-slate-500 border border-slate-200 hover:border-slate-400 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}
