import api from "./axios";

export const getAllUsers = (params) =>
  api.get("/users", { params }).then((response) => response.data);

export const getUserRoles = () =>
  api.get("/users/roles").then((response) => response.data);

export const getUserDetail = (userId) =>
  api.get(`/users/detail/${userId}`).then((response) => response.data);

export const createManagedUser = (payload) =>
  api.post("/users/managed", payload).then((response) => response.data);

export const updateManagedUser = (userId, payload) =>
  api.put(`/users/update/${userId}`, payload).then((response) => response.data);

export const deleteManagedUser = (userId) =>
  api.delete(`/users/delete/${userId}`).then((response) => response.data);