import api from "./axios";

/**
 * GET /api/knowledge-entries — Kiến thức công khai (khách).
 * params: category? — Refund | Luggage | Rules | Booking | Payment | Service | Other (bỏ trống lấy tất cả)
 * Anonymous — public, không cần token.
 */
export const getKnowledgeEntries = (params = {}) =>
  api
    .get("/knowledge-entries", { params, skipAuth: true })
    .then((response) => response.data);

/**
 * GET /api/knowledge-entries/admin — Danh sách đầy đủ (kể cả Draft/Private), không phân trang.
 * params: status? (Draft | Private | Published), category?
 * Quyền truy cập: Admin.
 */
export const getKnowledgeEntriesAdmin = (params = {}) =>
  api.get("/knowledge-entries/admin", { params }).then((response) => response.data);

/** GET /api/knowledge-entries/metadata — Options/gioi han cho man Admin. Quyen: Admin. */
export const getKnowledgeEntryMetadata = () =>
  api.get("/knowledge-entries/metadata").then((response) => response.data);

/** POST /api/knowledge-entries/admin/test-search — Test chatbot match knowledge nao. Quyen: Admin. */
export const testKnowledgeSearch = (data) =>
  api.post("/knowledge-entries/admin/test-search", data).then((response) => response.data);

/** POST /api/knowledge-entries — Tạo mục kiến thức. Quyền: Admin. */
export const createKnowledgeEntry = (data) =>
  api.post("/knowledge-entries", data).then((response) => response.data);

/** PUT /api/knowledge-entries/{id} — Full replace. Quyền: Admin. */
export const updateKnowledgeEntry = (id, data) =>
  api.put(`/knowledge-entries/${id}`, data).then((response) => response.data);

/** PUT /api/knowledge-entries/{id}/status — Bật/tắt hiển thị cho trợ lý. Quyền: Admin. */
export const updateKnowledgeEntryStatus = (id, status) =>
  api.put(`/knowledge-entries/${id}/status`, { status }).then((response) => response.data);

/** DELETE /api/knowledge-entries/{id} — Trả về 204. Quyền: Admin. */
export const deleteKnowledgeEntry = (id) =>
  api.delete(`/knowledge-entries/${id}`).then((response) => response.data);
