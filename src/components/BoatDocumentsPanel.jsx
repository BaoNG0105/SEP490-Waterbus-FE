import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { useApp } from "../context/AppContext";
import {
  fetchBoatDocuments,
  removeBoatDocument,
  uploadBoatDocument,
} from "../services/boatService";
import {
  BOAT_DOCUMENT_ACCEPT,
  BOAT_DOCUMENT_MAX_SIZE,
  BOAT_DOCUMENT_META,
  BOAT_DOCUMENT_MIME_TYPES,
  areDocumentsFreshAfterMaintenance,
  normalizeBoatDocuments,
} from "../utils/boatDocuments";

const formatDateTime = (value, lang) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(lang === "VN" ? "vi-VN" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isValidFile = (file) =>
  BOAT_DOCUMENT_MIME_TYPES.includes(file.type) && file.size <= BOAT_DOCUMENT_MAX_SIZE;

export function BoatDocumentsPanel({ boatId, boatCode, boatStatus, maintenanceStartedAt }) {
  const { lang } = useApp();
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [pendingFiles, setPendingFiles] = useState({});
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [deletingType, setDeletingType] = useState(null);

  const isUnderMaintenance = boatStatus?.toLowerCase() === "undermaintenance";
  const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const data = await fetchBoatDocuments(boatId);
      setDocuments(normalizeBoatDocuments(data));
    } catch (error) {
      console.error(error);
      setErrorMsg(
        error.response?.data?.message ||
          (lang === "VN" ? "Không tải được hồ sơ tàu." : "Failed to load boat documents.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (boatId) loadDocuments();
  }, [boatId, lang]);

  const setPendingFile = (type, file) => {
    if (file && !isValidFile(file)) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "File không hợp lệ" : "Invalid file",
        text: lang === "VN"
          ? "Chỉ hỗ trợ PDF, JPG, PNG, WEBP và tối đa 10MB."
          : "Only PDF, JPG, PNG, WEBP files up to 10MB are supported.",
        confirmButtonColor: "#124757",
      });
      return;
    }
    setPendingFiles((prev) => {
      const next = { ...prev };
      if (file) next[type] = file;
      else delete next[type];
      return next;
    });
  };

  const clearPendingFile = (type) => {
    setPendingFiles((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  const openFile = (fileUrl) => {
    if (fileUrl) window.open(fileUrl, "_blank", "noopener,noreferrer");
  };

  const pendingEntries = useMemo(
    () => Object.entries(pendingFiles).filter(([, file]) => Boolean(file)),
    [pendingFiles]
  );
  const pendingCount = pendingEntries.length;

  const handleSaveAll = async () => {
    if (pendingCount === 0) return;

    try {
      setIsSavingAll(true);
      const failures = [];

      for (const [type, file] of pendingEntries) {
        const formData = new FormData();
        formData.append("file", file);
        try {
          await uploadBoatDocument(boatId, type, formData);
        } catch (error) {
          console.error(error);
          const label = lang === "VN" ? BOAT_DOCUMENT_META[type]?.labelVn : BOAT_DOCUMENT_META[type]?.labelEn;
          failures.push(label || type);
        }
      }

      setPendingFiles({});
      await loadDocuments();

      if (failures.length > 0) {
        Swal.fire({
          icon: "warning",
          title: lang === "VN" ? "Một số hồ sơ chưa lưu được" : "Some documents failed",
          text: (lang === "VN" ? "Không lưu được: " : "Failed: ") + failures.join(", "),
          confirmButtonColor: "#124757",
        });
      } else {
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: lang === "VN" ? "Đã lưu tất cả hồ sơ" : "All documents saved",
          showConfirmButton: false,
          timer: 1800,
        });
      }
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleDelete = async (type, label) => {
    const confirmResult = await Swal.fire({
      icon: "warning",
      title: lang === "VN" ? "Xóa hồ sơ?" : "Delete document?",
      text:
        lang === "VN"
          ? `Bạn có chắc muốn xóa hồ sơ "${label}" của tàu ${boatCode}?`
          : `Remove "${label}" for boat ${boatCode}?`,
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#124757",
      confirmButtonText: lang === "VN" ? "Xóa" : "Delete",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    });

    if (!confirmResult.isConfirmed) return;

    try {
      setDeletingType(type);
      await removeBoatDocument(boatId, type);
      clearPendingFile(type);
      await loadDocuments();

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã xóa hồ sơ" : "Document removed",
        showConfirmButton: false,
        timer: 1800,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Xóa thất bại" : "Delete failed",
        text:
          error.response?.data?.message ||
          (lang === "VN" ? "Không thể xóa hồ sơ lúc này." : "Could not delete the document."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setDeletingType(null);
    }
  };

  const uploadedCount = useMemo(
    () => documents.filter((doc) => doc.isUploaded).length,
    [documents]
  );

  const documentsReadyForActivation = areDocumentsFreshAfterMaintenance(
    { status: boatStatus, maintenanceStartedAt },
    documents
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48 w-full">
        <div className="w-10 h-10 border-4 border-[#124757] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
              {lang === "VN" ? "Hồ sơ pháp lý tàu" : "Boat Legal Documents"}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {lang === "VN"
                ? "Chọn file cho các mục cần cập nhật rồi bấm Lưu tất cả một lần."
                : "Pick files for the slots you want, then click Save all once."}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span className="material-symbols-outlined text-sm">folder_open</span>
            {uploadedCount}/4 {lang === "VN" ? "đã nộp" : "uploaded"}
          </div>
        </div>
      </div>

      {isUnderMaintenance && (
        <div
          className={`p-4 rounded-xl text-xs font-bold border shadow-sm ${
            documentsReadyForActivation
              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-500/20"
              : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-500/20"
          }`}
        >
          {documentsReadyForActivation
            ? (lang === "VN"
                ? "Hồ sơ đã được cập nhật sau bảo trì. Có thể chuyển tàu sang Hoạt động."
                : "Documents have been refreshed after maintenance. You can switch the boat to Active.")
            : (lang === "VN"
                ? "Tàu đang bảo trì. Vui lòng upload lại toàn bộ hồ sơ mới trước khi chuyển sang Hoạt động."
                : "This boat is under maintenance. Re-upload all documents before switching to Active.")}
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {documents.map((doc) => {
          const meta = BOAT_DOCUMENT_META[doc.type];
          const label = lang === "VN" ? meta.labelVn : meta.labelEn;
          const isDeleting = deletingType === doc.type;
          const pendingFile = pendingFiles[doc.type] || null;

          return (
            <div
              key={doc.type}
              className={`bg-white dark:bg-slate-800 p-5 rounded-4xl border shadow-sm space-y-4 transition-colors ${
                pendingFile
                  ? "border-[#124757]/40 dark:border-yellow-400/40"
                  : "border-slate-100 dark:border-slate-700/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">

                  <div className="min-w-0">
                    <h4 className="font-headline font-black text-xs text-slate-800 dark:text-white uppercase tracking-wide">
                      {label}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {doc.isUploaded
                        ? (lang === "VN" ? "Đã có hồ sơ" : "Document uploaded")
                        : (lang === "VN" ? "Chưa có hồ sơ" : "No document yet")}
                    </p>
                  </div>
                </div>

                {doc.isUploaded && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20 shrink-0">
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    {lang === "VN" ? "Đã nộp" : "Uploaded"}
                  </span>
                )}
              </div>

              {doc.isUploaded ? (
                <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => openFile(doc.fileUrl)}
                        disabled={!doc.fileUrl}
                        className="flex items-center gap-1.5 min-w-0 max-w-full text-left group disabled:cursor-default"
                      >
                        <span className="material-symbols-outlined text-[15px] text-slate-400 group-hover:text-[#124757] dark:group-hover:text-yellow-400 shrink-0">description</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate group-hover:underline">
                          {doc.fileName || (lang === "VN" ? "Tệp đính kèm" : "Attached file")}
                        </span>
                      </button>
                      {doc.updatedAt && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-5.5">
                          {lang === "VN" ? "Cập nhật lần cuối:" : "Last updated:"}{" "}
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {formatDateTime(doc.updatedAt, lang)}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {doc.fileUrl && (
                        <button
                          type="button"
                          onClick={() => openFile(doc.fileUrl)}
                          title={lang === "VN" ? "Xem file" : "View file"}
                          className="h-8 px-2.5 rounded-lg bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                          {lang === "VN" ? "Xem" : "View"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => handleDelete(doc.type, label)}
                        title={lang === "VN" ? "Xóa" : "Delete"}
                        className="h-8 px-2.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wide hover:bg-red-100 transition-all inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        )}
                        {lang === "VN" ? "Xóa" : "Del"}
                      </button>
                      <label
                        title={lang === "VN" ? "Thay file" : "Replace"}
                        className="h-8 px-2.5 rounded-lg border border-[#124757]/30 dark:border-yellow-400/40 bg-white dark:bg-slate-800 text-[#124757] dark:text-yellow-300 text-[10px] font-bold uppercase tracking-wide hover:bg-[#124757]/5 dark:hover:bg-yellow-400/10 transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">upload_file</span>
                        {lang === "VN" ? "Thay" : "Replace"}
                        <input
                          type="file"
                          accept={BOAT_DOCUMENT_ACCEPT}
                          onChange={(e) => setPendingFile(doc.type, e.target.files?.[0] || null)}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  </div>

                  {pendingFile ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-[#124757]/5 dark:bg-yellow-400/10 px-3 py-2">
                      <span className="text-[11px] font-bold text-[#124757] dark:text-yellow-300 truncate inline-flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {pendingFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => clearPendingFile(doc.type)}
                        className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                        title={lang === "VN" ? "Bỏ chọn" : "Clear"}
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400">
                      {lang === "VN" ? "PDF, JPG, PNG, WEBP · tối đa 10MB" : "PDF, JPG, PNG, WEBP · max 10MB"}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 p-4 space-y-2">
                  <label className={labelStyle}>
                    {lang === "VN" ? "Chọn tệp hồ sơ" : "Choose document file"}
                  </label>
                  <input
                    type="file"
                    accept={BOAT_DOCUMENT_ACCEPT}
                    onChange={(e) => setPendingFile(doc.type, e.target.files?.[0] || null)}
                    className="block w-full text-[11px] font-bold text-slate-600 dark:text-slate-300 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#124757] file:text-white dark:file:bg-yellow-400 dark:file:text-slate-900 file:font-bold file:cursor-pointer"
                  />
                  {pendingFile ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-[#124757]/5 dark:bg-yellow-400/10 px-3 py-2">
                      <span className="text-[11px] font-bold text-[#124757] dark:text-yellow-300 truncate inline-flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {pendingFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => clearPendingFile(doc.type)}
                        className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                        title={lang === "VN" ? "Bỏ chọn" : "Clear"}
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400">
                      {lang === "VN" ? "PDF, JPG, PNG, WEBP · tối đa 10MB" : "PDF, JPG, PNG, WEBP · max 10MB"}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-4 z-10">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur px-5 py-3 shadow-lg">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {pendingCount > 0
              ? (lang === "VN" ? `${pendingCount} hồ sơ đang chờ lưu` : `${pendingCount} document(s) pending`)
              : (lang === "VN" ? "Chưa có thay đổi cần lưu" : "No changes to save")}
          </span>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={pendingCount === 0 || isSavingAll}
            className="px-6 py-2.5 rounded-xl bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 text-[11px] font-black uppercase tracking-wide hover:brightness-110 transition-all inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSavingAll && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
            {lang === "VN" ? "Lưu tất cả" : "Save all"}
          </button>
        </div>
      </div>
    </div>
  );
}
