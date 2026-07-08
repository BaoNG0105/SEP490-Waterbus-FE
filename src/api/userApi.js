import api from "./axios";

export const getAllUsers = () =>
  api.get("/users").then((response) => response.data);

export const getUserRoles = () =>
  api.get("/users/roles").then((response) => response.data);
