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
    return normalized.every((doc) => doc.isUploaded);
  }

  const maintenanceTime = new Date(maintenanceStartedAt).getTime();
  if (Number.isNaN(maintenanceTime)) {
    return false;
  }

  return normalized.every((doc) => {
    const updatedAt = getDocumentUpdatedAt(doc);
    if (!updatedAt) return false;
    const updatedTime = new Date(updatedAt).getTime();
    return !Number.isNaN(updatedTime) && updatedTime > maintenanceTime;
  });
};

export const getActivateAfterMaintenanceBlockReason = (boat, documents, lang = "VN") => {
  const normalized = normalizeBoatDocuments(documents);
  const missingCount = normalized.filter((doc) => !doc.isUploaded).length;

  if (missingCount > 0) {
    return lang === "VN"
      ? `Tàu đang bảo trì. Cần upload đủ 4 hồ sơ trước khi kích hoạt lại (còn thiếu ${missingCount}).`
      : `This boat is under maintenance. Upload all 4 documents before activating (${missingCount} missing).`;
  }

  if (!areDocumentsFreshAfterMaintenance(boat, documents)) {
    return lang === "VN"
      ? "Tàu đang bảo trì. Vui lòng cập nhật lại toàn bộ hồ sơ sau bảo trì trước khi chuyển sang Hoạt động."
      : "This boat is under maintenance. Re-upload all documents after maintenance before switching to Active.";
  }

  return "";
};
