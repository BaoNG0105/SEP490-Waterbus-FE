import api from "./axios";

/** GET /api/operations/schedule — lịch vận hành + GPS mới nhất (FE không gọi GPS hook). */
export const getOperationsSchedule = (params = {}) =>
  api.get("/operations/schedule", { params }).then((response) => response.data);
