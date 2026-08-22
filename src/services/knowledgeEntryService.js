import {
  getKnowledgeEntries as apiGetKnowledgeEntries,
  getKnowledgeEntriesAdmin as apiGetKnowledgeEntriesAdmin,
  getKnowledgeEntryMetadata as apiGetKnowledgeEntryMetadata,
  testKnowledgeSearch as apiTestKnowledgeSearch,
  createKnowledgeEntry as apiCreateKnowledgeEntry,
  updateKnowledgeEntry as apiUpdateKnowledgeEntry,
  updateKnowledgeEntryStatus as apiUpdateKnowledgeEntryStatus,
  deleteKnowledgeEntry as apiDeleteKnowledgeEntry,
} from "../api/knowledgeEntryApi";

export const KNOWLEDGE_STATUS = {
  DRAFT: "Draft",
  PRIVATE: "Private",
  PUBLISHED: "Published",
};

// Draft — không ai dùng. Private — chỉ trợ lý AI đọc, không hiện trên web.
// Published — hiện trên web và trợ lý AI đọc.
export const KNOWLEDGE_STATUS_ORDER = [
  KNOWLEDGE_STATUS.DRAFT,
  KNOWLEDGE_STATUS.PRIVATE,
  KNOWLEDGE_STATUS.PUBLISHED,
];

export const labelKnowledgeStatus = (status, lang = "VN") => {
  if (status === KNOWLEDGE_STATUS.PUBLISHED) return lang === "VN" ? "Đã xuất bản" : "Published";
  if (status === KNOWLEDGE_STATUS.PRIVATE) return lang === "VN" ? "Nội bộ" : "Private";
  return lang === "VN" ? "Bản nháp" : "Draft";
};

export const describeKnowledgeStatus = (status, lang = "VN") => {
  if (status === KNOWLEDGE_STATUS.PUBLISHED) {
    return lang === "VN"
      ? "Hiện trên web và trợ lý AI đọc."
      : "Shown on the website and read by the assistant.";
  }
  if (status === KNOWLEDGE_STATUS.PRIVATE) {
    return lang === "VN"
      ? "Chỉ trợ lý AI đọc, không hiện trên web."
      : "Read by the assistant only — not shown on the website.";
  }
  return lang === "VN" ? "Bản nháp — không ai dùng." : "Draft — not used anywhere.";
};

export const KNOWLEDGE_CONTENT_AI_LIMIT = 4000;

export const KNOWLEDGE_CATEGORY_ORDER = [
  "Booking",
  "Payment",
  "Refund",
  "Rules",
  "Luggage",
  "Service",
  "Other",
];

export const KNOWLEDGE_CATEGORY_LABELS = {
  Booking: { VN: "Đặt vé", ENG: "Booking" },
  Payment: { VN: "Thanh toán", ENG: "Payment" },
  Refund: { VN: "Hoàn tiền", ENG: "Refund" },
  Rules: { VN: "Quy định", ENG: "Rules" },
  Luggage: { VN: "Hành lý", ENG: "Luggage" },
  Service: { VN: "Dịch vụ", ENG: "Service" },
  Other: { VN: "Khác", ENG: "Other" },
};

export const KNOWLEDGE_CATEGORY_ICONS = {
  Booking: "confirmation_number",
  Payment: "payments",
  Refund: "currency_exchange",
  Rules: "gavel",
  Luggage: "luggage",
  Service: "support_agent",
  Other: "info",
};

export const getKnowledgeCategoryLabel = (category, lang = "VN") =>
  KNOWLEDGE_CATEGORY_LABELS[category]?.[lang] || category;

const extractRows = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const sortByCategoryOrder = (a, b) => {
  const ia = KNOWLEDGE_CATEGORY_ORDER.indexOf(a);
  const ib = KNOWLEDGE_CATEGORY_ORDER.indexOf(b);
  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
};

export const fetchKnowledgeEntries = async () => {
  const data = await apiGetKnowledgeEntries();
  const rows = extractRows(data);

  const grouped = new Map();
  rows.forEach((entry) => {
    const category = entry?.category || "Other";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(entry);
  });

  grouped.forEach((entries) =>
    entries.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
  );

  return [...grouped.keys()]
    .sort(sortByCategoryOrder)
    .map((category) => ({ category, entries: grouped.get(category) }));
};

export const fetchKnowledgeEntriesAdmin = async (params = {}) => {
  const data = await apiGetKnowledgeEntriesAdmin(params);
  if (Array.isArray(data)) {
    return {
      totalCount: data.length,
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || data.length,
      items: data,
    };
  }

  return {
    totalCount: Number(data?.totalCount) || 0,
    page: Number(data?.page) || Number(params.page) || 1,
    pageSize: Number(data?.pageSize) || Number(params.pageSize) || 20,
    items: extractRows(data),
  };
};

export const fetchKnowledgeEntryMetadata = async () => {
  const data = await apiGetKnowledgeEntryMetadata();
  return {
    categories: Array.isArray(data?.categories) && data.categories.length
      ? data.categories
      : KNOWLEDGE_CATEGORY_ORDER,
    statuses: Array.isArray(data?.statuses) && data.statuses.length
      ? data.statuses
      : KNOWLEDGE_STATUS_ORDER,
    maxKeywords: Number(data?.maxKeywords) || 30,
    maxKeywordLength: Number(data?.maxKeywordLength) || 100,
    maxContentChars: Number(data?.maxContentChars) || KNOWLEDGE_CONTENT_AI_LIMIT,
    maxTotalContentChars: Number(data?.maxTotalContentChars) || 8000,
    defaultSearchTake: Number(data?.defaultSearchTake) || 3,
    maxSearchTake: Number(data?.maxSearchTake) || 5,
  };
};

export const runKnowledgeSearchTest = async ({ query, take } = {}) =>
  apiTestKnowledgeSearch({
    query: String(query || "").trim(),
    take: Number(take) || 3,
  });

export const addKnowledgeEntry = async (payload) => {
  try {
    return await apiCreateKnowledgeEntry(payload);
  } catch (error) {
    console.error("Failed to create knowledge entry:", error);
    throw error;
  }
};

export const modifyKnowledgeEntry = async (id, payload) => {
  try {
    return await apiUpdateKnowledgeEntry(id, payload);
  } catch (error) {
    console.error(`Failed to update knowledge entry ${id}:`, error);
    throw error;
  }
};

export const changeKnowledgeEntryStatus = async (id, status) => {
  try {
    return await apiUpdateKnowledgeEntryStatus(id, status);
  } catch (error) {
    console.error(`Failed to change knowledge entry ${id} status:`, error);
    throw error;
  }
};

export const removeKnowledgeEntry = async (id) => {
  try {
    return await apiDeleteKnowledgeEntry(id);
  } catch (error) {
    console.error(`Failed to delete knowledge entry ${id}:`, error);
    throw error;
  }
};

export const buildKnowledgeEntryPayload = (form) => ({
  title: String(form.title || "").trim(),
  content: String(form.content || "").trim(),
  category: form.category,
  keywords: (form.keywords || []).map((k) => k.trim()).filter(Boolean),
  status: form.status || KNOWLEDGE_STATUS.DRAFT,
  displayOrder: Number(form.displayOrder) || 0,
});

/**
 * Validate từng field bắt buộc (*) dùng chung cho CreateSystemData / EditSystemData: Tiêu đề,
 * Chuyên mục, Nội dung, Từ khóa tìm kiếm (cần ít nhất 1 từ khóa không rỗng), Thứ tự hiển thị
 * (phải là số lớn hơn 0). Trả về { [field]: message } — rỗng nghĩa là hợp lệ.
 */
export const validateKnowledgeEntryFields = (form, lang = "VN") => {
  const errors = {};

  if (!String(form.title || "").trim()) {
    errors.title = lang === "VN" ? "Vui lòng nhập tiêu đề." : "Title is required.";
  }

  if (!KNOWLEDGE_CATEGORY_ORDER.includes(form.category)) {
    errors.category = lang === "VN" ? "Vui lòng chọn chuyên mục hợp lệ." : "Please select a valid category.";
  }

  if (!String(form.content || "").trim()) {
    errors.content = lang === "VN" ? "Vui lòng nhập nội dung." : "Content is required.";
  }

  const keywords = (form.keywords || []).map((k) => k.trim()).filter(Boolean);
  if (keywords.length === 0) {
    errors.keywords = lang === "VN"
      ? "Cần ít nhất 1 từ khóa để trợ lý AI tìm đúng mục này."
      : "At least 1 keyword is required so the assistant can match this entry.";
  }

  if (String(form.displayOrder ?? "").trim() === "") {
    errors.displayOrder = lang === "VN" ? "Vui lòng nhập thứ tự hiển thị." : "Display order is required.";
  } else if (!Number.isFinite(Number(form.displayOrder)) || Number(form.displayOrder) <= 0) {
    errors.displayOrder = lang === "VN" ? "Thứ tự hiển thị phải là số lớn hơn 0." : "Display order must be a number greater than 0.";
  }

  return errors;
};
