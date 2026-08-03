import {
  getKnowledgeEntries as apiGetKnowledgeEntries,
  getKnowledgeEntriesAdmin as apiGetKnowledgeEntriesAdmin,
  createKnowledgeEntry as apiCreateKnowledgeEntry,
  updateKnowledgeEntry as apiUpdateKnowledgeEntry,
  updateKnowledgeEntryStatus as apiUpdateKnowledgeEntryStatus,
  deleteKnowledgeEntry as apiDeleteKnowledgeEntry,
} from "../api/knowledgeEntryApi";

export const KNOWLEDGE_STATUS = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
};

export const labelKnowledgeStatus = (status, lang = "VN") => {
  if (status === KNOWLEDGE_STATUS.PUBLISHED) return lang === "VN" ? "Đã xuất bản" : "Published";
  return lang === "VN" ? "Bản nháp" : "Draft";
};

/** Giới hạn nội dung mà trợ lý AI đọc — phần dư khách vẫn thấy trên web bình thường. */
export const KNOWLEDGE_CONTENT_AI_LIMIT = 4000;

/** Thứ tự hiển thị category trên trang Điều khoản & Chính sách. */
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

/**
 * Public: Điều khoản & Chính sách — nhóm entry Published theo category,
 * sắp xếp trong nhóm theo displayOrder (mục chính displayOrder nhỏ nhất lên đầu).
 */
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

/**
 * Admin: toàn bộ mục kiến thức (kể cả Draft), không phân trang.
 * params: status? (Draft | Published), category?
 */
export const fetchKnowledgeEntriesAdmin = async (params = {}) => {
  const data = await apiGetKnowledgeEntriesAdmin(params);
  return extractRows(data);
};

export const addKnowledgeEntry = async (payload) => {
  try {
    return await apiCreateKnowledgeEntry(payload);
  } catch (error) {
    console.error("Lỗi khi tạo mục kiến thức:", error);
    throw error;
  }
};

export const modifyKnowledgeEntry = async (id, payload) => {
  try {
    return await apiUpdateKnowledgeEntry(id, payload);
  } catch (error) {
    console.error(`Lỗi khi cập nhật mục kiến thức ${id}:`, error);
    throw error;
  }
};

export const changeKnowledgeEntryStatus = async (id, status) => {
  try {
    return await apiUpdateKnowledgeEntryStatus(id, status);
  } catch (error) {
    console.error(`Lỗi khi đổi trạng thái mục kiến thức ${id}:`, error);
    throw error;
  }
};

export const removeKnowledgeEntry = async (id) => {
  try {
    return await apiDeleteKnowledgeEntry(id);
  } catch (error) {
    console.error(`Lỗi khi xóa mục kiến thức ${id}:`, error);
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

export const validateKnowledgeEntryForm = (form, lang = "VN") => {
  if (!String(form.title || "").trim()) {
    return lang === "VN" ? "Vui lòng nhập tiêu đề." : "Title is required.";
  }
  if (!String(form.content || "").trim()) {
    return lang === "VN" ? "Vui lòng nhập nội dung." : "Content is required.";
  }
  if (!KNOWLEDGE_CATEGORY_ORDER.includes(form.category)) {
    return lang === "VN" ? "Vui lòng chọn chuyên mục hợp lệ." : "Please select a valid category.";
  }
  const keywords = (form.keywords || []).map((k) => k.trim()).filter(Boolean);
  if (keywords.length === 0) {
    return lang === "VN"
      ? "Cần ít nhất 1 từ khóa để trợ lý AI tìm đúng mục này."
      : "At least 1 keyword is required so the assistant can match this entry.";
  }
  return "";
};
