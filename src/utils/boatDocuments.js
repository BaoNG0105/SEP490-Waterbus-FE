export const BOAT_DOCUMENT_TYPES = [
  "Inspection",
  "Registration",
  "Insurance",
  "OperationLicense",
];

export const BOAT_DOCUMENT_META = {
  Inspection: {
    icon: "fact_check",
    labelVn: "Đăng kiểm / Kiểm định",
    labelEn: "Inspection Certificate",
  },
  Registration: {
    icon: "description",
    labelVn: "Đăng ký tàu",
    labelEn: "Boat Registration",
  },
  Insurance: {
    icon: "shield",
    labelVn: "Bảo hiểm",
    labelEn: "Insurance",
  },
  OperationLicense: {
    icon: "verified",
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
    return {
      type,
      isUploaded: Boolean(existing?.isUploaded),
      fileUrl: existing?.fileUrl ?? null,
      fileName: existing?.fileName ?? null,
      updatedAt: pickFirstValue(existing, ["updatedAt", "uploadedAt", "createdAt"]),
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

export const areDocumentsFreshAfterMaintenance = (boat, documents = []) => {
  const normalized = normalizeBoatDocuments(documents);

  if (!normalized.every((doc) => doc.isUploaded)) {
    return false;
  }

  if (boat?.documentsRequireRefresh === false) {
    return true;
  }

  if (boat?.documentsRequireRefresh === true) {
    return false;
  }

  const maintenanceStartedAt = getMaintenanceStartedAt(boat);
  if (!maintenanceStartedAt) {
    return true;
  }

  const maintenanceTime = new Date(maintenanceStartedAt).getTime();
  if (Number.isNaN(maintenanceTime)) {
    return false;
  }

  // Sau bảo trì chỉ bắt buộc upload lại Inspection (đăng kiểm) với ngày sau thời điểm bảo trì.
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
    return lang === "VN"
      ? "Tàu từng bảo trì. Cần upload lại hồ sơ Đăng kiểm (Inspection) sau bảo trì trước khi chuyển sang Hoạt động."
      : "This boat was under maintenance. Re-upload the Inspection document after maintenance before switching to Active.";
  }

  return "";
};

export const getActivateAfterMaintenanceBlockReason = (boat, documents, lang = "VN") =>
  getActivateBoatBlockReason(boat, documents, lang, { requireFreshInspection: true });
