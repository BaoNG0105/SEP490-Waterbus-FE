export const BOAT_DOCUMENT_TYPES = [
  "Inspection",
  "Registration",
  "Insurance",
  "OperationLicense",
];

export const BOAT_DOCUMENT_META = {
  Inspection: {
    labelVn: "Đăng kiểm / Kiểm định",
    labelEn: "Inspection Certificate",
  },
  Registration: {
    labelVn: "Đăng ký tàu",
    labelEn: "Boat Registration",
  },
  Insurance: {
    labelVn: "Bảo hiểm",
    labelEn: "Insurance",
  },
  OperationLicense: {
    labelVn: "Giấy phép hoạt động",
    labelEn: "Operating License",
  },
};

export const BOAT_DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";
export const BOAT_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const BOAT_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;

const pickFirstValue = (source, keys) => {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

export const normalizeBoatDocuments = (documents = []) => {
  const byType = new Map(
    (Array.isArray(documents) ? documents : []).map((doc) => [doc.type, doc])
  );

  return BOAT_DOCUMENT_TYPES.map((type) => {
    const existing = byType.get(type);
    const requiresRefreshRaw = existing?.requiresRefresh ?? existing?.RequiresRefresh;
    return {
      type,
      isUploaded: Boolean(existing?.isUploaded),
      fileUrl: existing?.fileUrl ?? existing?.FileUrl ?? null,
      fileName: existing?.fileName ?? existing?.FileName ?? null,
      updatedAt: pickFirstValue(existing, ["updatedAt", "uploadedAt", "createdAt"]),
      // BE: file vẫn còn (isUploaded); requiresRefresh = cần cập nhật sau bảo trì, KHÔNG = thiếu file.
      requiresRefresh: requiresRefreshRaw === true,
    };
  });
};

export const getMaintenanceStartedAt = (boat) =>
  pickFirstValue(boat, [
    "maintenanceStartedAt",
    "maintenanceAt",
    "statusChangedAt",
    "lastMaintenanceAt",
  ]);

export const getDocumentUpdatedAt = (doc) =>
  pickFirstValue(doc, ["updatedAt", "uploadedAt", "createdAt"]);

export const areAllDocumentsUploaded = (documents = []) =>
  normalizeBoatDocuments(documents).every((doc) => doc.isUploaded);

/** Có ít nhất 1 hồ sơ BE đánh dấu cần refresh (thường là Inspection). */
export const hasDocumentsRequiringRefresh = (documents = []) =>
  normalizeBoatDocuments(documents).some((doc) => doc.requiresRefresh === true);

/**
 * Đủ điều kiện Active sau bảo trì:
 * - Đủ 4 file isUploaded
 * - Không còn doc.requiresRefresh === true
 * - Fallback legacy: nếu BE chưa gửi requiresRefresh → kiểm tra Inspection updatedAt > maintenanceStartedAt
 *
 * Lưu ý: boat.documentsRequireRefresh chỉ là banner tổng, KHÔNG coi là "thiếu file".
 */
export const areDocumentsFreshAfterMaintenance = (boat, documents = []) => {
  const normalized = normalizeBoatDocuments(documents);

  if (!normalized.every((doc) => doc.isUploaded)) {
    return false;
  }

  const hasExplicitRefreshFlags = (Array.isArray(documents) ? documents : [])
    .some((doc) => doc?.requiresRefresh !== undefined || doc?.RequiresRefresh !== undefined);

  if (hasExplicitRefreshFlags) {
    return !normalized.some((doc) => doc.requiresRefresh);
  }

  // Legacy fallback khi BE chưa có field requiresRefresh trên từng doc.
  if (boat?.documentsRequireRefresh === false) {
    return true;
  }

  const maintenanceStartedAt = getMaintenanceStartedAt(boat);
  if (!maintenanceStartedAt) {
    // Không có mốc bảo trì → chỉ cần đủ 4 file.
    return boat?.documentsRequireRefresh !== true;
  }

  const maintenanceTime = new Date(maintenanceStartedAt).getTime();
  if (Number.isNaN(maintenanceTime)) {
    return boat?.documentsRequireRefresh !== true;
  }

  // Chỉ bắt buộc Inspection mới hơn thời điểm bảo trì.
  const inspection = normalized.find((doc) => doc.type === "Inspection");
  const updatedAt = getDocumentUpdatedAt(inspection);
  if (!updatedAt) return false;
  const updatedTime = new Date(updatedAt).getTime();
  return !Number.isNaN(updatedTime) && updatedTime > maintenanceTime;
};

export const getActivateBoatBlockReason = (boat, documents, lang = "VN", { requireFreshInspection = false } = {}) => {
  const normalized = normalizeBoatDocuments(documents);
  const missingCount = normalized.filter((doc) => !doc.isUploaded).length;

  if (missingCount > 0) {
    return lang === "VN"
      ? `Cần upload đủ 4 hồ sơ pháp lý trước khi kích hoạt (còn thiếu ${missingCount}).`
      : `Upload all 4 legal documents before activating (${missingCount} missing).`;
  }

  if (requireFreshInspection && !areDocumentsFreshAfterMaintenance(boat, documents)) {
    const needsRefresh = normalized.filter((doc) => doc.requiresRefresh).map((doc) => doc.type);
    if (needsRefresh.length > 0) {
      const labels = needsRefresh
        .map((type) => (lang === "VN" ? BOAT_DOCUMENT_META[type]?.labelVn : BOAT_DOCUMENT_META[type]?.labelEn) || type)
        .join(", ");
      return lang === "VN"
        ? `Cần cập nhật hồ sơ sau bảo trì trước khi Active: ${labels}.`
        : `Update documents after maintenance before Active: ${labels}.`;
    }
    return lang === "VN"
      ? "Tàu từng bảo trì. Cần upload lại hồ sơ Đăng kiểm (Inspection) sau bảo trì trước khi chuyển sang Hoạt động."
      : "This boat was under maintenance. Re-upload the Inspection document after maintenance before switching to Active.";
  }

  return "";
};

export const getActivateAfterMaintenanceBlockReason = (boat, documents, lang = "VN") =>
  getActivateBoatBlockReason(boat, documents, lang, { requireFreshInspection: true });
