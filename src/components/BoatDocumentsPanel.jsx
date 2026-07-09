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

const emptyDraft = () => ({
  file: null,
});

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

export function BoatDocumentsPanel({ boatId, boatCode, boatStatus, maintenanceStartedAt }) {
  const { lang } = useApp();
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [editingType, setEditingType] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [submittingType, setSubmittingType] = useState(null);
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

  const getDraft = (type) => drafts[type] || emptyDraft();

  const setDraftFile = (type, file) => {
    setDrafts((prev) => ({
      ...prev,
      [type]: { file },
    }));
  };

  const startUpload = (type) => {
    setEditingType(type);
    setDrafts((prev) => ({
      ...prev,
      [type]: emptyDraft(),
    }));
  };

  const cancelUpload = (type) => {
    setEditingType((current) => (current === type ? null : current));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  const openFile = (fileUrl) => {
    if (fileUrl) window.open(fileUrl, "_blank", "noopener,noreferrer");
  };

  const validateDraft = (draft) => {
    if (!draft.file) {
      return lang === "VN" ? "Vui lòng chọn file hồ sơ." : "Please select a document file.";
    }

    if (!BOAT_DOCUMENT_MIME_TYPES.includes(draft.file.type)) {
      return lang === "VN"
        ? "Chỉ hỗ trợ PDF, JPG, PNG hoặc WEBP."
        : "Only PDF, JPG, PNG or WEBP files are supported.";
    }

    if (draft.file.size > BOAT_DOCUMENT_MAX_SIZE) {
      return lang === "VN" ? "File không được vượt quá 10MB." : "File must be 10MB or smaller.";
    }

    return "";
  };

  const handleSubmit = async (type) => {
    const draft = getDraft(type);
    const validationError = validateDraft(draft);
    if (validationError) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Thiếu thông tin" : "Missing information",
        text: validationError,
        confirmButtonColor: "#124757",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", draft.file);

    try {
      setSubmittingType(type);
      await uploadBoatDocument(boatId, type, formData);
      cancelUpload(type);
      await loadDocuments();

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã lưu hồ sơ" : "Document saved",
        showConfirmButton: false,
        timer: 1800,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Upload thất bại" : "Upload failed",
        text:
          error.response?.data?.message ||
          (lang === "VN" ? "Không thể lưu hồ sơ lúc này." : "Could not save the document."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setSubmittingType(null);
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
      cancelUpload(type);
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
                ? "Upload hoặc cập nhật file. Bấm Xem file để mở trong tab mới. Sau bảo trì phải upload lại hồ sơ trước khi kích hoạt tàu."
                : "Upload or replace files. Click View file to open it in a new tab. After maintenance, re-upload before activating the boat."}
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
          const isEditing = editingType === doc.type;
          const draft = getDraft(doc.type);
          const isSubmitting = submittingType === doc.type;
          const isDeleting = deletingType === doc.type;

          return (
            <div
              key={doc.type}
              className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#124757]/10 dark:bg-yellow-400/10 text-[#124757] dark:text-yellow-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl">{meta.icon}</span>
                  </div>
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

                {doc.isUploaded && !isEditing && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20 shrink-0">
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    {lang === "VN" ? "Đã nộp" : "Uploaded"}
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 p-4 space-y-3">
                  <div>
                    <label className={labelStyle}>{lang === "VN" ? "Chọn tệp hồ sơ (*)" : "Choose document file (*)"}</label>
                    <input
                      type="file"
                      accept={BOAT_DOCUMENT_ACCEPT}
                      onChange={(e) => setDraftFile(doc.type, e.target.files?.[0] || null)}
                      className="block w-full text-[11px] font-bold text-slate-600 dark:text-slate-300 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#124757] file:text-white dark:file:bg-yellow-400 dark:file:text-slate-900 file:font-bold file:cursor-pointer"
                    />
                    {draft.file && (
                      <p className="text-[11px] text-slate-500 mt-1 truncate">{draft.file.name}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      {lang === "VN" ? "PDF, JPG, PNG, WEBP · tối đa 10MB" : "PDF, JPG, PNG, WEBP · max 10MB"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSubmit(doc.type)}
                      className="px-4 py-2.5 rounded-xl bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 text-[11px] font-black uppercase tracking-wide hover:brightness-110 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSubmitting && (
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      )}
                      {lang === "VN" ? "Lưu hồ sơ" : "Save document"}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelUpload(doc.type)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      {lang === "VN" ? "Hủy" : "Cancel"}
                    </button>
                  </div>
                </div>
              ) : doc.isUploaded ? (
                <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => openFile(doc.fileUrl)}
                    disabled={!doc.fileUrl}
                    className="flex items-center gap-2 min-w-0 w-full text-left group disabled:cursor-default"
                  >
                    <span className="material-symbols-outlined text-base text-slate-400 group-hover:text-[#124757] dark:group-hover:text-yellow-400">description</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate group-hover:underline">
                      {doc.fileName || (lang === "VN" ? "Tệp đính kèm" : "Attached file")}
                    </span>
                  </button>

                  {doc.updatedAt && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === "VN" ? "Cập nhật lần cuối:" : "Last updated:"}{" "}
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {formatDateTime(doc.updatedAt, lang)}
                      </span>
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {doc.fileUrl && (
                      <button
                        type="button"
                        onClick={() => openFile(doc.fileUrl)}
                        className="px-3 py-2 rounded-xl bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 text-[11px] font-bold uppercase tracking-wide hover:brightness-110 transition-all inline-flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        {lang === "VN" ? "Xem file" : "View file"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startUpload(doc.type)}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-slate-700 transition-all inline-flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">upload</span>
                      {lang === "VN" ? "Cập nhật file" : "Update file"}
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDelete(doc.type, label)}
                      className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-bold uppercase tracking-wide hover:bg-red-100 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-sm">delete</span>
                      )}
                      {lang === "VN" ? "Xóa" : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startUpload(doc.type)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                  {lang === "VN" ? "Tải hồ sơ lên" : "Upload document"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
